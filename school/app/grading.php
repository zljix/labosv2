<?php
declare(strict_types=1);
namespace Labos;

function gradingRegistry(): array
{
    return json_decode(file_get_contents(dirname(__DIR__) . '/grading/profiles.json'), true, 32, JSON_THROW_ON_ERROR);
}

function gradingRubric(string $profileId, string $taskKey): array
{
    $registry = gradingRegistry();
    foreach ($registry['profiles'] as $p) if ($p['id'] === $profileId && $p['taskKey'] === $taskKey) {
        return ['format' => 'labosv2-rubric', 'version' => 1, 'authority' => 'server-verified', 'checkerVersion' => $p['checkerVersion'] ?? $registry['checkerVersion'],
            'profileId' => $p['id'], 'targets' => $p['targets'], 'instructions' => $p['instructions'], 'title' => $p['title'],
            'criteria' => $p['criteria'], 'maxPoints' => array_sum(array_column($p['criteria'], 'maxPoints'))]
            + (isset($p['contract']) ? ['taskKey'=>$p['taskKey'], 'contract'=>$p['contract']] : []);
    }
    fail(422, 'grading_profile', 'Odabrana provjera ne pripada toj vježbi.');
}

function gradingDigest(mixed $value): string
{
    // Convert associative arrays to objects before the shared canonical encoder.
    return hash('sha256', canonicalJson(json_decode(json_encode($value, JSON_THROW_ON_ERROR), false, 64, JSON_THROW_ON_ERROR)));
}

function gradingContext(\PDO $pdo, int $attemptId): array
{
    $r = query($pdo, 'SELECT a.target, v.rubric, v.content_hash AS rubric_hash FROM school_attempts w JOIN class_assignments a ON a.id=w.assignment_id JOIN task_versions v ON v.id=a.task_version_id WHERE w.id=?', [$attemptId])->fetch();
    $r['rubric'] = json_decode($r['rubric'], true, 32, JSON_THROW_ON_ERROR); return $r;
}

function jobSummary(?array $job, array $context, int $revision): array
{
    $rubric = $context['rubric'];
    if (($rubric['authority'] ?? '') !== 'server-verified') return ['status' => 'not_enabled', 'points' => null];
    if (!in_array($context['target'], $rubric['targets'], true)) return ['status' => 'unsupported', 'points' => null, 'message' => 'Ovaj cilj još nema službenu provjeru.'];
    $value = ['status' => $job['status'] ?? 'not_requested', 'points' => null, 'revision' => $revision, 'maxPoints' => $rubric['maxPoints'], 'profileId' => $rubric['profileId']];
    if ($job) {
        if ($job['status'] === 'running' && $job['lease_until'] !== null && (new \DateTimeImmutable($job['lease_until'],new \DateTimeZone('UTC')))->getTimestamp() < time()) $value['status']='technical_error';
        $value['jobId'] = (int)$job['id']; $value['requestedAt'] = utcTime($job['created_at']); $value['finishedAt'] = utcTime($job['finished_at']);
        if ($job['report'] !== null) $value['report'] = json_decode($job['report'], true, 32, JSON_THROW_ON_ERROR);
        if (in_array($job['status'], ['evaluated', 'program_error'], true)) $value['points'] = $value['report']['points'];
    }
    return $value;
}

function snapshotGrading(\PDO $pdo, int $attemptId, int $revision, ?array $context = null): array
{
    $context ??= gradingContext($pdo, $attemptId);
    $job = query($pdo, 'SELECT * FROM grading_jobs WHERE attempt_id=? AND revision=? ORDER BY id DESC LIMIT 1', [$attemptId, $revision])->fetch();
    return attachTeacherReview(jobSummary($job ?: null, $context, $revision), teacherReview($pdo, $attemptId, $revision));
}

// Called while the attempt row is locked. Browser data cannot select a rubric,
// stimulus seed, source snapshot, compiler artefact, result or identity.
function enqueueGrading(\PDO $pdo, int $attemptId, int $revision, string $key, bool $retry = false): array
{
    $context = gradingContext($pdo, $attemptId); $r = $context['rubric'];
    if (($r['authority'] ?? '') !== 'server-verified' || !in_array($context['target'], $r['targets'], true)) return snapshotGrading($pdo, $attemptId, $revision, $context);
    $prior = query($pdo, 'SELECT * FROM grading_jobs WHERE attempt_id=? AND request_key=?', [$attemptId, $key])->fetch();
    if ($prior) {
        if ((int)$prior['revision'] !== $revision) fail(409, 'request_reused', 'Oznaka provjere već pripada drugoj reviziji.');
        return snapshotGrading($pdo, $attemptId, $revision, $context);
    }
    query($pdo, "UPDATE grading_jobs SET status='technical_error',lease_hash=NULL,lease_until=NULL,finished_at=CURRENT_TIMESTAMP(6) WHERE attempt_id=? AND revision=? AND status='running' AND lease_until<CURRENT_TIMESTAMP(6)",[$attemptId,$revision]);
    $last = query($pdo, 'SELECT * FROM grading_jobs WHERE attempt_id=? AND revision=? ORDER BY id DESC LIMIT 1', [$attemptId, $revision])->fetch();
    if ($last && (!$retry || in_array($last['status'], ['queued','running','evaluated','program_error'], true))) return jobSummary($last, $context, $revision);
    query($pdo, "UPDATE grading_jobs SET status='superseded', finished_at=CURRENT_TIMESTAMP(6) WHERE attempt_id=? AND revision<? AND status='queued'", [$attemptId, $revision]);
    // A busy checker must not prevent saving a project. Deferred work is
    // explicit and can be requested again after capacity is available.
    if ((int)$pdo->query("SELECT COUNT(*) FROM grading_jobs WHERE status IN ('queued','running')")->fetchColumn() >= 500
        || (int)query($pdo, 'SELECT COUNT(*) FROM grading_jobs WHERE attempt_id=? AND created_at>CURRENT_TIMESTAMP(6)-INTERVAL 1 MINUTE', [$attemptId])->fetchColumn() >= 30) return snapshotGrading($pdo, $attemptId, $revision, $context);
    $hash = query($pdo, 'SELECT content_hash FROM work_snapshots WHERE attempt_id=? AND revision=?', [$attemptId, $revision])->fetchColumn();
    query($pdo, 'INSERT INTO grading_jobs (attempt_id,revision,request_key,checker_version,profile_id,rubric_hash,snapshot_hash,stimulus_seed) VALUES (?,?,?,?,?,?,?,?)',
        [$attemptId,$revision,$key,$r['checkerVersion'],$r['profileId'],$context['rubric_hash'],$hash,bin2hex(random_bytes(32))]);
    return snapshotGrading($pdo, $attemptId, $revision, $context);
}

function requestGrading(\PDO $pdo, array $actor, array $body): array
{
    $prior = accessibleAttempt($pdo, $actor, $body['attemptId'] ?? null);
    if ($actor['role'] !== 'student' || (int)$prior['student_id'] !== (int)$actor['id']) fail(403, 'forbidden', 'Provjeri vlastiti spremljeni rad.');
    $revision = $body['expectedRevision'] ?? null; $key = $body['requestKey'] ?? null;
    if (!is_int($revision) || !is_string($key) || !preg_match('/^[A-Za-z0-9-]{16,80}$/D', $key)) fail(422, 'revision', 'Pošalji spremljenu reviziju i jedinstvenu oznaku provjere.');
    return transaction($pdo, function () use ($pdo, $actor, $prior, $revision, $key) {
        $actor = lockActor($pdo, $actor); schoolClass($pdo, $actor, $prior['class_id'], false, true);
        $row = query($pdo, 'SELECT * FROM school_attempts WHERE id=? FOR UPDATE', [$prior['id']])->fetch();
        if ($actor['role'] !== 'student' || (int)$row['student_id'] !== (int)$actor['id']) fail(403, 'forbidden', 'Provjeri vlastiti rad.');
        readAssignment($pdo, $actor, $row['assignment_id']);
        if ((int)$row['current_revision'] !== $revision) fail(409, 'revision_conflict', 'Provjeri najnoviju spremljenu reviziju.');
        return enqueueGrading($pdo, (int)$row['id'], $revision, $key, true);
    });
}

// Retry only DB-only grading writes after a full rollback. File-based restore
// and general application transactions keep their original semantics.
function gradingTransaction(\PDO $pdo, callable $work): mixed
{
    for ($attempt = 0; $attempt < 6; $attempt++) {
        try { return transaction($pdo, $work); }
        catch (\PDOException $error) {
            if ($attempt === 5 || ((int)($error->errorInfo[1] ?? 0) !== 1213 && $error->getCode() !== '40001')) throw $error;
            usleep(random_int(10000, 30000) * ($attempt + 1));
        }
    }
    throw new \LogicException('Unreachable grading transaction state.');
}

// These two functions are exposed only by a private CLI, never HTTP.
function claimGrading(\PDO $pdo): ?array
{
    // Expiry cleanup must release its status-index range locks before a claim
    // inserts a new running entry. Two workers must not upgrade the same gap.
    // A deadlock rolls back the reservation, so only this DB-only operation
    // can be retried; file-based restore and other transactions are unchanged.
    for ($attempt = 0; $attempt < 6; $attempt++) {
        try {
            // Discover expired IDs without locking a status-index range. Then
            // take each primary-key lock before changing its status, matching
            // completion's lock order and rechecking expiry after any wait.
            $expired = $pdo->query("SELECT id FROM grading_jobs WHERE status='running' AND lease_until<CURRENT_TIMESTAMP(6) ORDER BY id")->fetchAll(\PDO::FETCH_COLUMN);
            foreach ($expired as $id) query($pdo, "UPDATE grading_jobs SET status='technical_error',lease_hash=NULL,lease_until=NULL,finished_at=CURRENT_TIMESTAMP(6) WHERE id=? AND status='running' AND lease_until<CURRENT_TIMESTAMP(6)", [(int)$id]);
            return transaction($pdo, function () use ($pdo) {
                $job = $pdo->query("SELECT * FROM grading_jobs WHERE status='queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED")->fetch();
                if (!$job) return null;
                $lease = bin2hex(random_bytes(32));
                $leaseSeconds = $job['checker_version'] === '24M.1' ? 300 : 180;
                query($pdo, "UPDATE grading_jobs SET status='running',lease_hash=?,lease_until=TIMESTAMPADD(SECOND,?,CURRENT_TIMESTAMP(6)),deliveries=deliveries+1 WHERE id=?", [hash('sha256', $lease),$leaseSeconds,$job['id']]);
                $snapshot = query($pdo, 'SELECT project FROM work_snapshots WHERE attempt_id=? AND revision=?', [$job['attempt_id'],$job['revision']])->fetchColumn();
                // MySQL's JSON serializer may reorder keys and add whitespace. Rebuild
                // the exact canonical representation used when the snapshot was saved.
                $snapshot = canonicalJson(json_decode($snapshot,false,64,JSON_THROW_ON_ERROR));
                if (!hash_equals($job['snapshot_hash'],hash('sha256',$snapshot))) fail(503,'snapshot_integrity','Spremljena snimka ne odgovara oznaci sadržaja.');
                $context = gradingContext($pdo, (int)$job['attempt_id']);
                $value = ['format'=>'labosv2-grading-job','version'=>1,'jobId'=>(int)$job['id'],'attemptId'=>(int)$job['attempt_id'],'revision'=>(int)$job['revision'],
                    'lease'=>$lease,'checkerVersion'=>$job['checker_version'],'profileId'=>$job['profile_id'],'rubricHash'=>$job['rubric_hash'],
                    'snapshotHash'=>$job['snapshot_hash'],'seed'=>$job['stimulus_seed'],'projectJson'=>$snapshot,'rubric'=>$context['rubric'],'target'=>$context['target']];
                if ($job['checker_version'] === '24M.1') $value['leaseSeconds'] = 300;
                if (isset($context['rubric']['contract'])) {
                    $value['version']=2;
                    $value['taskKey']=$context['rubric']['taskKey'];
                    $value['rubricDigest']=gradingDigest($context['rubric']);
                    $value['contractHash']=gradingDigest($context['rubric']['contract']);
                }
                return $value;
            });
        } catch (\PDOException $error) {
            if ($attempt === 5 || ((int)($error->errorInfo[1] ?? 0) !== 1213 && $error->getCode() !== '40001')) throw $error;
            usleep(random_int(10000, 30000) * ($attempt + 1));
        }
    }
    return null;
}

function completeGrading(\PDO $pdo, array $body): array
{
    $id = targetId($body['jobId'] ?? null); $lease = $body['lease'] ?? null; $report = $body['report'] ?? null;
    if (!is_string($lease) || !preg_match('/^[a-f0-9]{64}$/D', $lease) || !is_array($report)) fail(422, 'report', 'Neispravan rezultat provjeravača.');
    return gradingTransaction($pdo, function () use ($pdo, $id, $lease, $report) {
        $job = query($pdo, 'SELECT *, lease_until>CURRENT_TIMESTAMP(6) AS live FROM grading_jobs WHERE id=? FOR UPDATE', [$id])->fetch();
        if (!$job || !$job['lease_hash'] || !hash_equals($job['lease_hash'], hash('sha256',$lease))) fail(409, 'lease', 'Ta isporuka više ne pripada radniku.');
        if ($job['status'] !== 'running') return ['jobId'=>$id,'status'=>$job['status']]; // Lost completion response is safe to repeat.
        if (!(bool)$job['live']) fail(409, 'lease', 'Isporuka je istekla. Rezultat nije prihvaćen.');
        foreach (['checkerVersion'=>'checker_version','profileId'=>'profile_id','snapshotHash'=>'snapshot_hash','rubricHash'=>'rubric_hash'] as $field=>$column) if (($report[$field] ?? null) !== $job[$column]) fail(422, 'report_binding', 'Rezultat ne pripada snimci i objavljenoj rubrici.');
        $status = $report['status'] ?? '';
        if (!in_array($status, ['evaluated','program_error','execution_limit','technical_error','unsupported'], true)) fail(422, 'report_status', 'Nevaljano stanje provjere.');
        if (!preg_match('/^[a-f0-9]{64}$/D', $report['checkerHash'] ?? '')) fail(422,'checker_hash','Nedostaje oznaka izvršenog provjeravača.');
        $context = gradingContext($pdo,(int)$job['attempt_id']); $rubric=$context['rubric'];
        if (isset($rubric['contract'])) {
            $binding=['jobId'=>(int)$job['id'], 'attemptId'=>(int)$job['attempt_id'], 'revision'=>(int)$job['revision'],
                'target'=>$context['target'], 'rubricDigest'=>gradingDigest($rubric), 'contractHash'=>gradingDigest($rubric['contract']),
                'seedHash'=>hash('sha256',$job['stimulus_seed'])];
            foreach ($binding as $field=>$expected) if (($report[$field]??null)!==$expected)
                fail(422,'report_binding','Rezultat ne pripada tom poslu, pokušaju i zamrznutim uvjetima.');
        }
        if (in_array($status,['evaluated','program_error'],true)) {
            $criteria=$report['criteria'] ?? null; $points=0;
            if (!is_array($criteria) || count($criteria)!==count($rubric['criteria'])) fail(422,'criteria','Neispravni kriteriji.');
            foreach ($rubric['criteria'] as $i=>$expected) {
                $c=$criteria[$i];
                if (($c['id']??null)!==$expected['id'] || ($c['maxPoints']??null)!==$expected['maxPoints'] || !is_int($c['points']??null) || !in_array($c['points'],[0,$expected['maxPoints']],true)) fail(422,'criteria','Bodovi ne odgovaraju objavljenoj rubrici.');
                if (isset($rubric['contract']) && (($c['description']??null)!==$expected['description'] || ($c['passed']??null)!==($c['points']===$expected['maxPoints']))) fail(422,'criteria','Opis i ostvarenje kriterija ne odgovaraju objavljenoj rubrici.');
                $points+=$c['points'];
            }
            if (($report['points']??null)!==$points || ($report['maxPoints']??null)!==$rubric['maxPoints']) fail(422,'points','Zbroj bodova ne odgovara kriterijima.');
        } elseif (($report['points']??null)!==null) fail(422,'points','Tehnička ili nepodržana provjera nema osvojene bodove.');
        $json=json_encode($report, JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
        if (strlen($json)>65536) fail(422,'report_size','Izvještaj je prevelik.');
        query($pdo,'UPDATE grading_jobs SET status=?,report=?,finished_at=CURRENT_TIMESTAMP(6),lease_until=NULL WHERE id=?',[$status,$json,$id]);
        audit($pdo,null,null,'grading.completed',['jobId'=>$id,'attemptId'=>(int)$job['attempt_id'],'revision'=>(int)$job['revision'],'status'=>$status]);
        return ['jobId'=>$id,'status'=>$status];
    });
}
