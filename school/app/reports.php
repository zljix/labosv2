<?php
declare(strict_types=1);
namespace Labos;

function reviewValue(array $r): array
{
    return ['id'=>(int)$r['id'], 'attemptId'=>(int)$r['attempt_id'], 'revision'=>(int)$r['revision'], 'action'=>$r['action'],
        'points'=>$r['points'] === null ? null : (float)$r['points'], 'maxPoints'=>$r['max_points'] === null ? null : (int)$r['max_points'],
        'reason'=>$r['reason'], 'author'=>['id'=>(int)$r['author_id'], 'displayName'=>$r['author_name']], 'createdAt'=>utcTime($r['created_at'])];
}

function teacherReview(\PDO $pdo, int $id, int $revision): ?array
{
    $r = query($pdo, "SELECT r.*, u.display_name AS author_name FROM work_reviews r JOIN users u ON u.id=r.author_id WHERE r.attempt_id=? AND r.revision=? AND r.action<>'comment' ORDER BY r.id DESC LIMIT 1", [$id,$revision])->fetch();
    return $r ? reviewValue($r) : null;
}

function attachTeacherReview(array $grading, ?array $review): array
{
    if ($review) $grading['teacherReview'] = $review;
    return $grading;
}

function currentTeacherReviews(\PDO $pdo,array $ids): array
{
    if(!$ids) return [];
    $marks=implode(',',array_fill(0,count($ids),'?'));
    $rows=query($pdo,"SELECT r.*,u.display_name AS author_name FROM work_reviews r JOIN users u ON u.id=r.author_id WHERE r.id IN (SELECT MAX(x.id) FROM work_reviews x JOIN school_attempts w ON w.id=x.attempt_id AND w.current_revision=x.revision WHERE x.attempt_id IN ($marks) AND x.action<>'comment' GROUP BY x.attempt_id)",$ids)->fetchAll();
    $result=[];foreach($rows as $r) $result[(int)$r['attempt_id']]=reviewValue($r);return $result;
}

function workFeedback(\PDO $pdo, array $actor, mixed $id, mixed $revision, mixed $before = null): array
{
    $w = accessibleAttempt($pdo,$actor,$id); $revision = targetId($revision);
    if (!query($pdo,'SELECT 1 FROM work_snapshots WHERE attempt_id=? AND revision=?',[$w['id'],$revision])->fetchColumn()) fail(404,'revision_missing','Ta snimka ne postoji.');
    $rows = query($pdo, 'SELECT r.*, u.display_name AS author_name FROM work_reviews r JOIN users u ON u.id=r.author_id WHERE r.attempt_id=? AND r.revision=? AND r.id<? ORDER BY r.id DESC LIMIT 101', [$w['id'],$revision,$before === null ? PHP_INT_MAX : targetId($before)])->fetchAll();
    $more = count($rows)>100; $rows = array_slice($rows,0,100);
    $last = query($pdo,'SELECT MAX(id) FROM work_reviews WHERE attempt_id=? AND revision=?',[$w['id'],$revision])->fetchColumn();
    return ['reviews'=>array_map(reviewValue(...),$rows), 'latestReviewId'=>$last ? (int)$last : 0, 'hasMore'=>$more, 'nextBefore'=>$more ? (int)end($rows)['id'] : null];
}

function addWorkReview(\PDO $pdo, array $actor, array $body): array
{
    requireStaff($actor); $w = accessibleAttempt($pdo,$actor,$body['attemptId']??null);
    $revision = targetId($body['revision']??null); $action = $body['action']??''; $key = $body['requestKey']??'';
    $reason = textField($body['reason']??null,2000,'Komentar ili razlog korekcije');
    if (!in_array($action,['comment','correct','restore'],true) || !is_string($key) || !preg_match('/^[A-Za-z0-9-]{16,80}$/D',$key)
        || !is_int($body['expectedReviewId']??null) || $body['expectedReviewId']<0) fail(422,'review','Pošalji vrstu zapisa, stanje pregleda i jedinstvenu oznaku.');
    $points = $body['points']??null;
    if ($action==='correct' && ((!is_int($points)&&!is_float($points)) || !is_finite((float)$points) || $points<0 || abs($points*100-round($points*100))>0.000001)) fail(422,'points','Bodovi moraju biti nenegativan broj s najviše dvije decimale.');
    if ($action!=='correct' && $points!==null) fail(422,'points','Komentar i povrat automatskih bodova nemaju nove bodove.');
    return transaction($pdo,function() use($pdo,$actor,$w,$body,$revision,$action,$key,$reason,$points) {
        $actor=lockActor($pdo,$actor); requireStaff($actor); schoolClass($pdo,$actor,$w['class_id'],true,true);
        query($pdo,'SELECT id FROM school_attempts WHERE id=? FOR UPDATE',[$w['id']])->fetch();
        if (!query($pdo,'SELECT 1 FROM work_snapshots WHERE attempt_id=? AND revision=?',[$w['id'],$revision])->fetchColumn()) fail(404,'revision_missing','Ta snimka ne postoji.');
        $same=query($pdo,'SELECT * FROM work_reviews WHERE author_id=? AND request_key=?',[$actor['id'],$key])->fetch();
        if ($same) {
            if ((int)$same['attempt_id']!==(int)$w['id'] || (int)$same['revision']!==$revision || $same['action']!==$action || $same['reason']!==$reason || ($points===null ? $same['points']!==null : (float)$same['points']!==(float)$points)) fail(409,'request_reused','Oznaka već pripada drugom zapisu.');
            return workFeedback($pdo,$actor,$w['id'],$revision);
        }
        $last=(int)query($pdo,'SELECT COALESCE(MAX(id),0) FROM work_reviews WHERE attempt_id=? AND revision=?',[$w['id'],$revision])->fetchColumn();
        if ($last!==$body['expectedReviewId']) fail(409,'review_conflict','Drugi je nastavnik dopunio pregled. Osvježi povijest prije spremanja.');
        $rubric=gradingContext($pdo,(int)$w['id'])['rubric'];
        // A correction never invents a maximum for an unscored task.
        $max=$rubric['maxPoints']??null;
        if ($action==='correct' && (!is_int($max) || $points>$max)) fail(422,'points','Korekcija mora biti unutar objavljenog bodovnog maksimuma.');
        $original=snapshotGrading($pdo,(int)$w['id'],$revision); unset($original['teacherReview']);
        query($pdo,'INSERT INTO work_reviews (attempt_id,revision,action,points,max_points,reason,original_grading,previous_review_id,author_id,request_key) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$w['id'],$revision,$action,$points,$max,$reason,json_encode($original,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$last?:null,$actor['id'],$key]);
        audit($pdo,(int)$actor['id'],(int)$w['student_id'],'work.reviewed',['reviewId'=>(int)$pdo->lastInsertId(),'attemptId'=>(int)$w['id'],'revision'=>$revision,'action'=>$action,'points'=>$points,'reason'=>$reason]);
        return workFeedback($pdo,$actor,$w['id'],$revision);
    });
}

function selectAssessment(\PDO $pdo,array $actor,array $body): array
{
    requireStaff($actor); $a=readAssignment($pdo,$actor,$body['assignmentId']??null); $student=targetId($body['studentId']??null);
    $submission=isset($body['submissionId']) ? targetId($body['submissionId']) : null;
    $reason=textField($body['reason']??null,1000,'Razlog odabira predaje'); $key=$body['requestKey']??'';
    if (!is_string($key)||!preg_match('/^[A-Za-z0-9-]{16,80}$/D',$key)) fail(422,'request_key','Pošalji jedinstvenu oznaku odabira.');
    return transaction($pdo,function() use($pdo,$actor,$a,$student,$submission,$reason,$key) {
        $actor=lockActor($pdo,$actor); requireStaff($actor); schoolClass($pdo,$actor,$a['classId'],true,true);
        if (!query($pdo,'SELECT 1 FROM class_students WHERE class_id=? AND student_id=?',[$a['classId'],$student])->fetchColumn()) fail(403,'forbidden','Učenik nije član odabranog razreda.');
        if ($submission && !query($pdo,'SELECT 1 FROM school_submissions s JOIN school_attempts w ON w.id=s.attempt_id WHERE s.id=? AND w.assignment_id=? AND w.student_id=?',[$submission,$a['id'],$student])->fetchColumn()) fail(422,'submission','Odaberi zaključanu predaju toga učenika i vježbe.');
        $same=query($pdo,'SELECT * FROM assessment_selections WHERE selected_by=? AND request_key=?',[$actor['id'],$key])->fetch();
        if ($same) {
            if ((int)$same['assignment_id']!==$a['id'] || (int)$same['student_id']!==$student || ($same['submission_id']===null?null:(int)$same['submission_id'])!==$submission || $same['reason']!==$reason) fail(409,'request_reused','Oznaka već pripada drugom odabiru.');
        } else {
            query($pdo,'INSERT INTO assessment_selections (assignment_id,student_id,submission_id,reason,selected_by,request_key) VALUES (?,?,?,?,?,?)',[$a['id'],$student,$submission,$reason,$actor['id'],$key]);
            audit($pdo,(int)$actor['id'],$student,'assessment.selected',['assignmentId'=>$a['id'],'submissionId'=>$submission,'reason'=>$reason]);
        }
        return ['message'=>$submission ? 'Odabrana je zaključana predaja za evidenciju.' : 'Evidencija ponovno koristi posljednju zaključanu predaju.'];
    });
}

// One bounded page of student × assignment pairs, including pupils with no work.
// A report uses the selected/last locked submission. An open rework is separate.
function achievementReport(\PDO $pdo,array $actor,array $filter): array
{
    requireStaff($actor); $c=schoolClass($pdo,$actor,$filter['classId']??null,true);
    $where=['a.class_id=?']; $values=[$c['id']];
    foreach (['studentId'=>'u.id','assignmentId'=>'a.id'] as $key=>$column) if (isset($filter[$key]) && $filter[$key]!=='') { $where[]=$column.'=?'; $values[]=targetId($filter[$key]); }
    $afterA=isset($filter['afterAssignment'])?targetId($filter['afterAssignment']):0; $afterU=isset($filter['afterStudent'])?targetId($filter['afterStudent']):0;
    $where[]='(a.id>? OR (a.id=? AND u.id>?))'; array_push($values,$afterA,$afterA,$afterU);
    $sql='SELECT a.id AS assignment_id,u.id AS student_id,u.username,u.display_name FROM class_assignments a JOIN class_students m ON m.class_id=a.class_id JOIN users u ON u.id=m.student_id WHERE '.implode(' AND ',$where).' ORDER BY a.id,u.id LIMIT 101';
    $pairs=query($pdo,$sql,$values)->fetchAll(); $more=count($pairs)>100; $pairs=array_slice($pairs,0,100); $rows=[]; $assignments=[];
    foreach($pairs as $pair) {
        $aid=(int)$pair['assignment_id']; $uid=(int)$pair['student_id']; $a=$assignments[$aid]??=readAssignment($pdo,$actor,$aid);
        $w=query($pdo,'SELECT * FROM school_attempts WHERE assignment_id=? AND student_id=? ORDER BY attempt_number DESC LIMIT 1',[$aid,$uid])->fetch();
        $selection=query($pdo,'SELECT x.*,u.display_name AS author_name FROM assessment_selections x JOIN users u ON u.id=x.selected_by WHERE x.assignment_id=? AND x.student_id=? ORDER BY x.id DESC LIMIT 1',[$aid,$uid])->fetch();
        $sid=$selection['submission_id']??null;
        $s=$sid ? query($pdo,'SELECT s.* FROM school_submissions s WHERE s.id=?',[$sid])->fetch() : query($pdo,'SELECT s.* FROM school_submissions s JOIN school_attempts w ON w.id=s.attempt_id WHERE w.assignment_id=? AND w.student_id=? ORDER BY w.attempt_number DESC LIMIT 1',[$aid,$uid])->fetch();
        $g=$s ? snapshotGrading($pdo,(int)$s['attempt_id'],(int)$s['revision']) : ['status'=>'not_submitted','points'=>null];
        $correction=$g['teacherReview']??null;
        $points=($correction['action']??'')==='correct' ? $correction['points'] : $g['points'];
        $max=($correction['action']??'')==='correct' ? $correction['maxPoints'] : ($g['maxPoints']??null);
        $rows[]=['student'=>['id'=>$uid,'username'=>$pair['username'],'displayName'=>$pair['display_name']],
            'assignment'=>['id'=>$aid,'code'=>$a['task']['definition']['code'],'title'=>$a['task']['definition']['variantTitle'],'version'=>$a['task']['version'],'target'=>$a['target']],
            'status'=>!$w?'not_started':($w['status']==='in_progress' && (int)$w['attempt_number']>1?'reopened':$w['status']),
            'currentAttempt'=>$w?workSummary($w):null,'submission'=>$s?submissionValue($s,$g):null,
            'assessment'=>['points'=>$points,'maxPoints'=>$max,'source'=>($correction['action']??'')==='correct'?'teacher':($points===null?'pending':'automatic'),'grading'=>$g],
            'selection'=>$selection?['id'=>(int)$selection['id'],'submissionId'=>$sid?(int)$sid:null,'reason'=>$selection['reason'],'author'=>$selection['author_name'],'selectedAt'=>utcTime($selection['selected_at'])]:null];
    }
    return ['class'=>$c,'rows'=>$rows,'hasMore'=>$more,'next'=>$more?['afterAssignment'=>(int)end($pairs)['assignment_id'],'afterStudent'=>(int)end($pairs)['student_id']]:null,'serverTime'=>gmdate('Y-m-d\TH:i:s\Z')];
}

function exportAchievements(\PDO $pdo,array $actor,array $filter): array
{
    unset($filter['afterAssignment'],$filter['afterStudent']);
    $rows=[]; $report=null;
    do {
        $page=achievementReport($pdo,$actor,$filter); $report??=$page;
        array_push($rows,...$page['rows']);
        if(count($rows)>5000 || (count($rows)===5000 && $page['hasMore'])) fail(422,'export_limit','Izvoz podržava do 5000 zapisa. Odaberi učenika ili vježbu.');
        if($page['hasMore']) $filter=array_merge($filter,$page['next']);
    } while($page['hasMore']);
    $report['rows']=$rows; $report['hasMore']=false; $report['next']=null; return $report;
}
