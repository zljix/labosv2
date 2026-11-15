<?php
declare(strict_types=1);
namespace Labos;

function maintenanceLock(\PDO $pdo,callable $work): mixed
{
    // Share the migration lock: schema and backup contents cannot diverge.
    $lock='labosv2-migrations-'.$pdo->query('SELECT DATABASE()')->fetchColumn();
    if((int)query($pdo,'SELECT GET_LOCK(?,0)',[$lock])->fetchColumn()!==1) fail(503,'maintenance_busy','Migracija ili drugo održavanje već je u tijeku.');
    try{return $work();}finally{query($pdo,'SELECT RELEASE_LOCK(?)',[$lock]);}
}

function yearArchived(\PDO $pdo,string $year): bool
{
    return (bool)query($pdo,'SELECT archived FROM school_year_archives WHERE school_year=?',[$year])->fetchColumn();
}

function archiveYear(\PDO $pdo,array $actor,array $body): array
{
    if ($actor['role']!=='admin') fail(403,'forbidden','Školsku godinu arhivira administrator.');
    $year=$body['schoolYear']??''; $archive=$body['archived']??null;
    if (!is_string($year)||!preg_match('/^(20\d{2})\/(20\d{2})$/D',$year,$m)||(int)$m[2]!==1+(int)$m[1]||!is_bool($archive)) fail(422,'school_year','Odaberi školsku godinu i arhiviranje ili ponovno otvaranje.');
    $reason=textField($body['reason']??null,1000,'Razlog arhiviranja ili otvaranja');
    return transaction($pdo,function() use($pdo,$actor,$year,$archive,$reason) {
        $actor=lockActor($pdo,$actor); if($actor['role']!=='admin') fail(403,'forbidden','Potrebna je administratorska uloga.');
        // Every class mutation also locks its class, so no autosave can slip
        // through between the archive check and its write.
        query($pdo,'SELECT id FROM school_classes WHERE school_year=? ORDER BY id FOR UPDATE',[$year])->fetchAll();
        query($pdo,'INSERT INTO school_year_archives (school_year,archived,reason,changed_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE archived=?,reason=?,changed_by=?,changed_at=CURRENT_TIMESTAMP(6)',[$year,(int)$archive,$reason,$actor['id'],(int)$archive,$reason,$actor['id']]);
        audit($pdo,(int)$actor['id'],null,'year.archive',['schoolYear'=>$year,'archived'=>$archive,'reason'=>$reason]);
        return ['message'=>$archive?'Godina je arhivirana. Radovi i izvještaji ostaju čitljivi.':'Godina je ponovno otvorena. Zaključane predaje ostaju zaključane.'];
    });
}

function retentionPolicy(array $config): array
{
    $p=$config['retention']??[]; $days=$p['revision_days']??90; $keep=$p['keep_latest']??10;
    if (!is_int($days)||$days<1||$days>3650||!is_int($keep)||$keep<1||$keep>10000) fail(422,'retention_policy','Čuvanje: 1–3650 dana i 1–10000 posljednjih revizija.');
    return ['days'=>$days,'keepLatest'=>$keep];
}

// CLI only. Prune archived years, old intermediate snapshots and only jobs
// without a report that have already been superseded. Keep all evidence.
function pruneRevisions(\PDO $pdo,array $config,bool $apply): array
{
    $policy=retentionPolicy($config); $cutoff=gmdate('Y-m-d H:i:s',time()-$policy['days']*86400);
    return transaction($pdo,function() use($pdo,$policy,$cutoff,$apply) {
        $attempts=query($pdo,'SELECT w.id,w.current_revision FROM school_attempts w JOIN class_assignments a ON a.id=w.assignment_id JOIN school_classes c ON c.id=a.class_id JOIN school_year_archives y ON y.school_year=c.school_year AND y.archived=TRUE ORDER BY w.id FOR UPDATE')->fetchAll();
        $snapshots=0; $jobs=0;
        foreach($attempts as $w) {
            $rows=query($pdo,"SELECT s.revision FROM work_snapshots s WHERE s.attempt_id=? AND s.revision>1 AND s.revision<=? AND s.created_at<? AND NOT EXISTS (SELECT 1 FROM school_submissions x WHERE x.attempt_id=s.attempt_id AND x.revision=s.revision) AND NOT EXISTS (SELECT 1 FROM work_reviews r WHERE r.attempt_id=s.attempt_id AND r.revision=s.revision) AND NOT EXISTS (SELECT 1 FROM grading_jobs j WHERE j.attempt_id=s.attempt_id AND j.revision=s.revision AND (j.report IS NOT NULL OR j.status<>'superseded')) ORDER BY s.revision FOR UPDATE",[$w['id'],(int)$w['current_revision']-$policy['keepLatest'],$cutoff])->fetchAll();
            foreach($rows as $s) {
                ++$snapshots; $jobs+=(int)query($pdo,'SELECT COUNT(*) FROM grading_jobs WHERE attempt_id=? AND revision=?',[$w['id'],$s['revision']])->fetchColumn();
                if($apply) {
                    query($pdo,"DELETE FROM grading_jobs WHERE attempt_id=? AND revision=? AND status='superseded' AND report IS NULL",[$w['id'],$s['revision']]);
                    query($pdo,'DELETE FROM work_snapshots WHERE attempt_id=? AND revision=?',[$w['id'],$s['revision']]);
                }
            }
        }
        if($apply) audit($pdo,null,null,'retention.pruned',['snapshots'=>$snapshots,'supersededJobs'=>$jobs,'policy'=>$policy]);
        return ['applied'=>$apply,'policy'=>$policy,'snapshots'=>$snapshots,'supersededJobs'=>$jobs];
    });
}

function backupTables(): array
{
    // Dependency order is also the restore order. Resources, both radio nodes
    // and SD initial media are embedded in the project/task JSON in these rows.
    return ['users','login_limits','school_classes','class_students','class_teachers','class_invites','class_join_requests','school_tasks','task_versions','class_assignments','school_attempts','work_snapshots','grading_jobs','school_submissions','attempt_reopenings','school_year_archives','work_reviews','assessment_selections','audit_events'];
}

function backupSchema(\PDO $pdo): array
{
    return query($pdo,'SELECT version,checksum FROM schema_migrations ORDER BY version')->fetchAll();
}

function privateBackupPath(string $path,bool $creating): string
{
    $dir=realpath(dirname($path)); $web=realpath(dirname(__DIR__).'/web');
    if (!$dir || !$web || inside($dir,$web) || basename($path)==='' || ($creating && file_exists($path))) fail(422,'backup_path','Odaberi novu datoteku izvan javnog web-korijena.');
    $resolved=$dir.'/'.basename($path);
    if (!$creating && (is_link($resolved)||!is_file($resolved)||!is_readable($resolved))) fail(422,'backup_path','Privatna kopija nije dostupna.');
    return $resolved;
}

function backupDatabase(\PDO $pdo,array $config,string $path): array
{
    $path=privateBackupPath($path,true); $temporary=$path.'.partial-'.bin2hex(random_bytes(8));
    $old=umask(0077); $out=fopen($temporary,'x+b'); umask($old);
    if (!$out) fail(503,'backup_write','Ne mogu otvoriti privatnu kopiju.');
    $hash=hash_init('sha256'); $counts=[];
    $write=function(array $record,bool $hashed=true) use($out,$hash) {
        $line=json_encode($record,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n";
        if(fwrite($out,$line)!==strlen($line)) fail(503,'backup_write','Kopija nije u cijelosti zapisana.');
        if($hashed) hash_update($hash,$line);
    };
    try {
        $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $pdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        $write(['format'=>'labosv2-private-backup','version'=>1,'createdAt'=>gmdate('c'),'schema'=>backupSchema($pdo),'keyHash'=>hash('sha256',$config['app']['key']),'tables'=>backupTables()]);
        foreach(backupTables() as $table) {
            // Bounded keyset pages avoid loading all snapshots into memory.
            $columns=$pdo->query('SHOW COLUMNS FROM `'.$table.'`')->fetchAll();
            $names=array_column($columns,'Field'); $primary=array_column(array_filter($columns,fn($c)=>$c['Key']==='PRI'),'Field');
            $write(['table'=>$table,'columns'=>$names]); $counts[$table]=0; $last=null;
            do {
                $condition=''; $values=[];
                if($last!==null) {
                    $parts=[];
                    foreach($primary as $i=>$key) {
                        $prefix=[];
                        for($j=0;$j<$i;++$j) { $prefix[]='`'.$primary[$j].'`=?'; $values[]=$last[$primary[$j]]; }
                        $prefix[]='`'.$key.'`>?'; $values[]=$last[$key]; $parts[]='('.implode(' AND ',$prefix).')';
                    }
                    $condition=' WHERE '.implode(' OR ',$parts);
                }
                $rows=query($pdo,'SELECT * FROM `'.$table.'`'.$condition.' ORDER BY `'.implode('`,`',$primary).'` LIMIT 20',$values)->fetchAll();
                foreach($rows as $row) { $write(['row'=>$row]); ++$counts[$table]; $last=$row; }
            } while(count($rows)===20);
        }
        $pdo->commit(); $digest=hash_final($hash); $write(['end'=>true,'counts'=>$counts,'sha256'=>$digest],false);
        if(!fflush($out)||!fsync($out)) fail(503,'backup_write','Kopija nije potvrđena na disku.'); fclose($out); $out=null;
        // Exclusive creation prevents silently replacing an earlier backup.
        if(!link($temporary,$path)) fail(503,'backup_write','Kopija nije objavljena; odaberi novu datoteku na istom disku.');
        unlink($temporary);
        return ['format'=>'labosv2-private-backup','counts'=>$counts,'sha256'=>$digest];
    } catch(\Throwable $e) {
        if($pdo->inTransaction()) $pdo->rollBack(); if(is_resource($out)) fclose($out); if(is_file($temporary)) unlink($temporary); throw $e;
    }
}

function restoreDatabase(\PDO $pdo,array $config,string $path): array
{
    $path=privateBackupPath($path,false);
    foreach(scandir($config['app']['session_directory']) as $session) if(str_starts_with($session,'sess_')) fail(409,'restore_sessions','Za povrat pripremi novu praznu privatnu mapu sesija.');
    $in=fopen($path,'rb');
    if(!$in) fail(422,'backup_read','Kopija nije dostupna.');
    try {
        return transaction($pdo,function() use($pdo,$config,$in) {
            query($pdo,'SELECT id FROM users FOR UPDATE')->fetchAll();
            foreach(backupTables() as $table) if((int)$pdo->query('SELECT COUNT(*) FROM `'.$table.'`')->fetchColumn()!==0) fail(409,'restore_not_empty','Povrat dopušta samo novu, migriranu i praznu bazu.');
            $hash=hash_init('sha256'); $header=null; $table=null; $index=-1; $columns=[]; $counts=[]; $ended=false;
            while(($line=fgets($in,33554433))!==false) {
                if(strlen($line)>33554432 || !str_ends_with($line,"\n")) fail(422,'backup_record','Kopija je prekinuta ili ima prevelik zapis.');
                $record=json_decode($line,true,80,JSON_THROW_ON_ERROR);
                if(!is_array($record)) fail(422,'backup_record','Neispravan zapis kopije.');
                if(!$header) {
                    if(($record['format']??'')!=='labosv2-private-backup'||($record['version']??null)!==1||($record['tables']??[])!==backupTables()||($record['schema']??[])!==backupSchema($pdo)||!hash_equals(hash('sha256',$config['app']['key']),$record['keyHash']??'')) fail(422,'backup_profile','Kopija zahtijeva istu inačicu migracija i izvorni privatni ključ aplikacije.');
                    $header=$record;
                } elseif(isset($record['end'])) {
                    if($index!==count(backupTables())-1||$record['end']!==true||($record['counts']??[])!==$counts||!hash_equals(hash_final($hash),$record['sha256']??'')) fail(422,'backup_integrity','Kontrolni zapis kopije ne odgovara sadržaju.');
                    $ended=true; if(fgetc($in)!==false) fail(422,'backup_trailing','Kopija sadrži dodatne zapise.'); break;
                } elseif(isset($record['table'])) {
                    ++$index; $table=backupTables()[$index]??null;
                    if($table!==$record['table']) fail(422,'backup_table','Redoslijed tablica kopije nije ispravan.');
                    $columns=$pdo->query('SHOW COLUMNS FROM `'.$table.'`')->fetchAll(\PDO::FETCH_COLUMN);
                    if(($record['columns']??[])!==$columns) fail(422,'backup_columns','Struktura kopije ne odgovara ovoj inačici.'); $counts[$table]=0;
                } elseif(isset($record['row'])&&$table) {
                    $row=$record['row']; if(!is_array($row)||array_keys($row)!==$columns) fail(422,'backup_row','Redak kopije nije valjan.');
                    // FK checks stay enabled, including immutable review chains.
                    query($pdo,'INSERT INTO `'.$table.'` (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($columns),'?')).')',array_values($row)); ++$counts[$table];
                } else fail(422,'backup_record','Neispravan zapis kopije.');
                hash_update($hash,$line);
            }
            if(!$ended) fail(422,'backup_incomplete','Kopija nema valjan završni zapis.');
            // Old browser sessions and in-flight worker leases cannot survive a
            // restore. Keep every report; only unfinished deliveries are reset.
            $pdo->exec('UPDATE users SET auth_version=auth_version+1');
            $pdo->exec("UPDATE grading_jobs SET status='queued',lease_hash=NULL,lease_until=NULL WHERE status='running'");
            audit($pdo,null,null,'backup.restored',['createdAt'=>$header['createdAt'],'counts'=>$counts]);
            return ['restored'=>true,'counts'=>$counts,'reauthenticationRequired'=>true];
        });
    } finally { fclose($in); }
}
