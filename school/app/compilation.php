<?php
declare(strict_types=1);
namespace Labos;

function compilerEnabled(array $config): bool { return ($config['interactive_compile']['enabled'] ?? false) === true; }
function expireCompiles(\PDO $pdo): void {
    // Primary-key updates avoid status-index lock upgrades between workers.
    $ids=$pdo->query("SELECT id FROM compile_jobs WHERE (status='running' AND lease_until<CURRENT_TIMESTAMP(6)) OR (status='queued' AND created_at<CURRENT_TIMESTAMP(6)-INTERVAL 10 MINUTE)")->fetchAll(\PDO::FETCH_COLUMN);
    foreach($ids as $id) query($pdo,"UPDATE compile_jobs SET status='technical_error',finished_at=CURRENT_TIMESTAMP(6),lease_hash=NULL,lease_until=NULL WHERE id=? AND ((status='running' AND lease_until<CURRENT_TIMESTAMP(6)) OR (status='queued' AND created_at<CURRENT_TIMESTAMP(6)-INTERVAL 10 MINUTE))",[$id]);
    query($pdo,"UPDATE compile_jobs SET project=NULL,result=NULL,status='expired' WHERE status NOT IN ('queued','running','expired') AND finished_at<CURRENT_TIMESTAMP(6)-INTERVAL 1 DAY");
    query($pdo,"DELETE FROM compile_jobs WHERE status='expired' AND created_at<CURRENT_TIMESTAMP(6)-INTERVAL 7 DAY");
}
function compilerCapabilities(\PDO $pdo,array $config,array $actor): array {
    if(!compilerEnabled($config)) return ['enabled'=>false,'targets'=>[], 'message'=>'Školsko prevođenje nije uključeno.'];
    expireCompiles($pdo);
    $r=$pdo->query('SELECT targets, heartbeat>CURRENT_TIMESTAMP(6)-INTERVAL 150 SECOND AS fresh FROM compiler_service WHERE id=1')->fetch();
    $targets=$r && (int)$r['fresh']===1 ? json_decode($r['targets'],true,16,JSON_THROW_ON_ERROR):[];
    $out=['enabled'=>true,'targets'=>(object)$targets,'message'=>$targets?'Spremnost je provjerena zasebno za svaku pločicu.':'Servis nedostupan; administrator treba pokrenuti radni proces.'];
    if($actor['role']!=='student') $out['queue']=$pdo->query("SELECT status,COUNT(*) AS jobs FROM compile_jobs WHERE status IN ('queued','running') GROUP BY status")->fetchAll();
    return $out;
}
function compileProjectInput(mixed $p): \stdClass {
    if(!$p instanceof \stdClass || ($p->language??'')!=='arduino-cpp' || ($p->entryFile??'')!=='main.ino'
        || !is_string($p->id??null) || !preg_match('/^[A-Za-z0-9-]{8,80}$/D',$p->id) || !($p->files??null) instanceof \stdClass) fail(422,'compile_input','Neispravan C++ projekt.');
    $targets=['arduino.uno-r3.atmega328p'=>'arduino:avr:uno','arduino.nano-classic.atmega328p'=>'arduino:avr:nano:cpu=atmega328','espressif.esp32-s3-devkitc-1.v1.1.n16r8'=>null];
    $board=$p->board->id??'';
    if(!array_key_exists($board,$targets)) fail(422,'compile_target','Nepodržana pločica.');
    // The isolated compiler additionally validates exact profiles, libraries and tool versions.
    $files=new \stdClass();$size=0;$seen=[];
    foreach(get_object_vars($p->files) as $name=>$text){
        if($name!=='arduino-libraries.json' && !preg_match('/\.(ino|c|cpp|h|hpp)$/D',$name))continue;
        if($name!=='arduino-libraries.json' && (!preg_match('~^(?:[A-Za-z_][A-Za-z0-9_-]*\.(?:ino|c|cpp|h|hpp)|src/(?:[A-Za-z_][A-Za-z0-9_-]*/)*[A-Za-z_][A-Za-z0-9_-]*\.(?:c|cpp|h|hpp))$~D',$name)||strtolower($name)==='labsketch.ino'))fail(422,'compile_path','Nedopuštena putanja izvora.');
        if(!is_string($text)||isset($seen[strtolower($name)]))fail(422,'compile_file','Neispravna ili dvostruka datoteka.');
        $seen[strtolower($name)]=true;$size+=strlen($text);$files->{$name}=$text;
    }
    if(!isset($files->{'main.ino'}) || count($seen)>65 || $size>1048576)fail(422,'compile_size','Izvori prelaze dopuštenu veličinu ili nedostaje main.ino.');
    return (object)['id'=>$p->id,'language'=>'arduino-cpp','entryFile'=>'main.ino','board'=>$p->board,'target'=>$p->target??null,'runtimeProfile'=>$p->runtimeProfile??null,'files'=>$files];
}
function compileSummary(array $r): array {
    return ['id'=>(int)$r['id'],'status'=>$r['status'],'nodeId'=>$r['node_id'],'node'=>$r['node_slot'],'target'=>$r['target'],
        'createdAt'=>utcTime($r['created_at']),'startedAt'=>utcTime($r['started_at']),'finishedAt'=>utcTime($r['finished_at']),
        'result'=>$r['result']===null?null:json_decode($r['result'],true,64,JSON_THROW_ON_ERROR)];
}
function ownedCompile(\PDO $pdo,array $actor,mixed $id): array {
    $r=query($pdo,'SELECT * FROM compile_jobs WHERE id=? AND user_id=?',[targetId($id),$actor['id']])->fetch();
    if(!$r)fail(404,'compile_missing','Zahtjev nije pronađen.');
    if($r['attempt_id']!==null)accessibleAttempt($pdo,$actor,(int)$r['attempt_id']);
    return $r;
}
function requestCompile(\PDO $pdo,array $config,array $actor,array $body): array {
    $p=compileProjectInput($body['project']??null);$key=$body['requestKey']??null;$slot=$body['node']??'A';
    if(!is_string($key)||!preg_match('/^[A-Za-z0-9-]{16,80}$/D',$key)||!in_array($slot,['A','B'],true))fail(422,'compile_request','Neispravna oznaka zahtjeva ili čvora.');
    $attemptId=isset($body['attemptId'])?targetId($body['attemptId']):null;
    $hash=gradingDigest([$p,$attemptId,$slot]);
    expireCompiles($pdo);
    return transaction($pdo,function()use($pdo,$config,$actor,$p,$key,$slot,$attemptId,$hash){
        $actor=lockActor($pdo,$actor);
        if($attemptId!==null){
            $a=accessibleAttempt($pdo,$actor,$attemptId);
            $a=query($pdo,'SELECT * FROM school_attempts WHERE id=? FOR UPDATE',[$a['id']])->fetch();
            if((int)$a['student_id']!==(int)$actor['id'])fail(403,'compile_owner','Prevedi vlastiti rad.');
            if($a['status']!=='in_progress')fail(409,'attempt_locked','Predaja je zaključana.');
            $saved=json_decode(query($pdo,'SELECT project FROM work_snapshots WHERE attempt_id=? AND revision=?',[$attemptId,$a['current_revision']])->fetchColumn());
            $node=$slot==='B'?($saved->radio->peer??null):$saved;
            if(!$node || ($node->board->id??'')!==$p->board->id || ($node->language??'')!==$p->language || ($slot==='B' && $node->id!==$p->id))fail(422,'compile_binding','Čvor ne odgovara dodijeljenoj vježbi.');
        }
        $prior=query($pdo,'SELECT * FROM compile_jobs WHERE user_id=? AND request_key=?',[$actor['id'],$key])->fetch();
        if($prior){if(!hash_equals($prior['input_hash'],$hash))fail(409,'request_reused','Oznaka već pripada drugom izvoru.');return compileSummary($prior);}
        if(!compilerEnabled($config))fail(503,'compiler_disabled','Školsko prevođenje nije uključeno.');
        // Serialize global admission and claims; at most one compiler runs initially.
        $service=$pdo->query('SELECT *, heartbeat>CURRENT_TIMESTAMP(6)-INTERVAL 150 SECOND AS fresh FROM compiler_service WHERE id=1 FOR UPDATE')->fetch();
        $targets=json_decode($service['targets']??'{}',true);
        if(!(int)($service['fresh']??0)||($targets[$p->board->id]['ready']??false)!==true)fail(503,'compiler_unavailable','Prevoditelj za ovu pločicu nije spreman.');
        if((int)query($pdo,"SELECT COUNT(*) FROM compile_jobs WHERE user_id=? AND status IN ('queued','running')",[$actor['id']])->fetchColumn()>=2
            ||(int)query($pdo,'SELECT COUNT(*) FROM compile_jobs WHERE user_id=? AND created_at>CURRENT_TIMESTAMP(6)-INTERVAL 1 MINUTE',[$actor['id']])->fetchColumn()>=12
            ||(int)$pdo->query("SELECT COUNT(*) FROM compile_jobs WHERE status IN ('queued','running')")->fetchColumn()>=30)fail(429,'compile_busy','Red je pun. Pričekaj završetak prethodnih zahtjeva.');
        query($pdo,'INSERT INTO compile_jobs(user_id,attempt_id,request_key,input_hash,project,target,node_id,node_slot) VALUES(?,?,?,?,?,?,?,?)',[$actor['id'],$attemptId,$key,$hash,canonicalJson($p),$p->board->id,$p->id,$slot]);
        return compileSummary(query($pdo,'SELECT * FROM compile_jobs WHERE id=?',[(int)$pdo->lastInsertId()])->fetch());
    });
}
function readCompile(\PDO $pdo,array $actor,mixed $id): array {expireCompiles($pdo);return compileSummary(ownedCompile($pdo,$actor,$id));}
function cancelCompile(\PDO $pdo,array $actor,mixed $id): array {
    $r=ownedCompile($pdo,$actor,$id);
    query($pdo,"UPDATE compile_jobs SET status='cancelled',finished_at=CURRENT_TIMESTAMP(6),lease_hash=NULL,lease_until=NULL WHERE id=? AND status IN ('queued','running')",[$r['id']]);
    return readCompile($pdo,$actor,$r['id']);
}
function claimCompile(\PDO $pdo,array $config): ?array {
    expireCompiles($pdo);if(!compilerEnabled($config))return null;
    return transaction($pdo,function()use($pdo){
        $pdo->query('SELECT id FROM compiler_service WHERE id=1 FOR UPDATE')->fetch();
        if((int)$pdo->query("SELECT COUNT(*) FROM compile_jobs WHERE status='running'")->fetchColumn())return null;
        $r=$pdo->query("SELECT * FROM compile_jobs WHERE status='queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")->fetch();
        if(!$r)return null;
        $lease=bin2hex(random_bytes(32));
        query($pdo,"UPDATE compile_jobs SET status='running',lease_hash=?,lease_until=CURRENT_TIMESTAMP(6)+INTERVAL 120 SECOND,started_at=CURRENT_TIMESTAMP(6) WHERE id=?",[hash('sha256',$lease),$r['id']]);
        return ['id'=>(int)$r['id'],'lease'=>$lease,'project'=>json_decode($r['project'],true,32,JSON_THROW_ON_ERROR)];
    });
}
// Store result as validated JSON text: MySQL JSON reorders toolchain keys,
// while the established browser artifact contract preserves their byte order.
function completeCompile(\PDO $pdo,array $body): array {
    $result=$body['result']??null;
    if(!is_array($result)||!in_array($result['status']??'', ['compiled','compile_error','technical_error'],true))fail(422,'compile_result','Neispravan rezultat.');
    $q=query($pdo,"UPDATE compile_jobs SET status=?,result=?,finished_at=CURRENT_TIMESTAMP(6),lease_hash=NULL,lease_until=NULL WHERE id=? AND status='running' AND lease_hash=? AND lease_until>CURRENT_TIMESTAMP(6)",[$result['status'],json_encode($result,JSON_THROW_ON_ERROR),targetId($body['id']??null),hash('sha256',(string)($body['lease']??''))]);
    return ['accepted'=>$q->rowCount()===1];
}
