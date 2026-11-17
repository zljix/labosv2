<?php
declare(strict_types=1);
namespace Labos;

// Canonical encoding binds an idempotency key to the exact submitted document.
// Object keys are sorted; arrays (including wire routes and answers) retain order.
function canonicalJson(mixed $value): string
{
    $sort = function (mixed $v) use (&$sort): mixed {
        if ($v instanceof \stdClass) { $items = get_object_vars($v); ksort($items, SORT_STRING); $out = new \stdClass(); foreach ($items as $k => $item) $out->{$k} = $sort($item); return $out; }
        if (is_array($v)) return array_map($sort, $v);
        return $v;
    };
    return json_encode($sort($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
}

function workSummary(array $row, ?array $grading = null): array
{
    return ['id' => (int)$row['id'], 'assignmentId' => (int)$row['assignment_id'], 'studentId' => (int)$row['student_id'],
        'number' => (int)$row['attempt_number'], 'status' => $row['status'], 'revision' => (int)$row['current_revision'],
        'createdAt' => utcTime($row['created_at']), 'savedAt' => utcTime($row['updated_at']),
        'grading' => $grading ?? ['status' => 'not_enabled', 'points' => null]];
}

function accessibleAttempt(\PDO $pdo, array $actor, mixed $value): array
{
    $row = query($pdo, 'SELECT w.*, a.class_id FROM school_attempts w JOIN class_assignments a ON a.id=w.assignment_id WHERE w.id=?', [targetId($value)])->fetch();
    if (!$row || ($actor['role'] === 'student' && (int)$row['student_id'] !== (int)$actor['id'])) fail(403, 'forbidden', 'Nemaš pristup tom radu.');
    readAssignment($pdo, $actor, $row['assignment_id']);
    return $row;
}

function readAttempt(\PDO $pdo, array $actor, mixed $value, mixed $revision = null): array
{
    $row = accessibleAttempt($pdo, $actor, $value);
    $rev = $revision === null ? (int)$row['current_revision'] : targetId($revision);
    $snapshot = query($pdo, 'SELECT revision, project, content_hash, created_at FROM work_snapshots WHERE attempt_id=? AND revision=?', [$row['id'], $rev])->fetch();
    if (!$snapshot) fail(404, 'revision_missing', 'Ta spremljena revizija ne postoji.');
    $student = query($pdo, 'SELECT id, username, display_name FROM users WHERE id=?', [$row['student_id']])->fetch();
    $grading = snapshotGrading($pdo, (int)$row['id'], $rev);
    return ['attempt' => workSummary($row, $rev === (int)$row['current_revision'] ? $grading : snapshotGrading($pdo, (int)$row['id'], (int)$row['current_revision'])), 'assignment' => readAssignment($pdo, $actor, $row['assignment_id']),
        'student' => ['id' => (int)$student['id'], 'username' => $student['username'], 'displayName' => $student['display_name']],
        'submission' => attemptSubmission($pdo, (int)$row['id']), 'reopening' => attemptReopening($pdo, (int)$row['id']),
        'snapshot' => ['revision' => (int)$snapshot['revision'], 'contentHash' => $snapshot['content_hash'], 'savedAt' => utcTime($snapshot['created_at']),
            'grading' => $grading, 'project' => json_decode($snapshot['project'], false, 64, JSON_THROW_ON_ERROR)]];
}

function applyWorkIdentity(\stdClass $p, string $studentName, string $className): void
{
    foreach (['urs-vjezba.json', 'vjezba.json'] as $workFile) {
        if (!isset($p->files->{$workFile})) continue;
        $work = json_decode($p->files->{$workFile}, false, 32);
        if ($work instanceof \stdClass) {
            $work->student = $studentName; $work->group = $className;
            $p->files->{$workFile} = json_encode($work, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        }
    }
    if (isset($p->radio->peer) && $p->radio->peer instanceof \stdClass) applyWorkIdentity($p->radio->peer, $studentName, $className);
}

function newAttemptDocument(\stdClass $p, array $assignment, string $studentName): string
{
    $p->id = bin2hex(random_bytes(16)); $p->revision = 0;
    $p->createdAt = $p->updatedAt = gmdate('Y-m-d\TH:i:s\Z');
    unset($p->files->{'school-attempt.json'});
    $record = $assignment; unset($record['starter']);
    $p->files->{'school-assignment.json'} = json_encode(['format' => 'labosv2-assignment-copy', 'version' => 1, 'assignment' => $record], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    applyWorkIdentity($p, $studentName, $assignment['className']);
    return canonicalJson($p);
}

function beginAttempt(\PDO $pdo, array $actor, array $body): array
{
    if ($actor['role'] !== 'student') fail(403, 'student_required', 'Nastavnik otvara početnu kopiju bez učeničkog pokušaja.');
    $assignment = readAssignment($pdo, $actor, $body['assignmentId'] ?? null);
    return transaction($pdo, function () use ($pdo, $actor, $assignment) {
        $actor = lockActor($pdo, $actor);
        if ($actor['role'] !== 'student') fail(403, 'student_required', 'Rad je vezan uz učenički račun.');
        schoolClass($pdo, $actor, $assignment['classId'], false, true);
        $assignment = readAssignment($pdo, $actor, $assignment['id'], true);
        $row = query($pdo, 'SELECT * FROM school_attempts WHERE assignment_id=? AND student_id=? ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE', [$assignment['id'], $actor['id']])->fetch();
        if (!$row) {
            $p = json_decode(json_encode($assignment['starter'], JSON_THROW_ON_ERROR), false, 64, JSON_THROW_ON_ERROR);
            $document = newAttemptDocument($p, $assignment, $actor['display_name']);
            query($pdo, 'INSERT INTO school_attempts (assignment_id, student_id, current_revision) VALUES (?, ?, 1)', [$assignment['id'], $actor['id']]);
            $id = (int)$pdo->lastInsertId();
            query($pdo, 'INSERT INTO work_snapshots (attempt_id, revision, base_revision, request_key, project, content_hash) VALUES (?, 1, 0, ?, ?, ?)', [$id, 'initial-snapshot', $document, hash('sha256', $document)]);
            enqueueGrading($pdo, $id, 1, 'initial-snapshot');
            audit($pdo, (int)$actor['id'], (int)$actor['id'], 'attempt.started', ['attemptId' => $id, 'assignmentId' => $assignment['id']]);
        } else $id = (int)$row['id'];
        return readAttempt($pdo, $actor, $id);
    });
}

// Structural and size checks only. The snapshot is data, never evaluated here.
// Behavioural grading and full simulator validation are separate authorities.
function validateWorkProject(mixed $p, \stdClass $initial, int $depth = 0, int &$total = 0): void
{
    if (!$p instanceof \stdClass || ($p->format ?? '') !== 'esp32-micropython-lab' || !in_array($p->schemaVersion ?? null, [3, 4], true)
        || ($p->id ?? null) !== $initial->id || !is_string($p->title ?? null) || trim($p->title) === '' || preg_match_all('/./us', $p->title) > 100
        || !is_int($p->revision ?? null) || $p->revision < 0 || $p->revision > 9007199254740991) fail(422, 'project', 'Projekt ili njegova oznaka nisu valjani.');
    foreach (['board', 'language', 'runtimeProfile', 'entryFile', 'nodeId', 'target'] as $key) {
        if (!property_exists($p, $key) || canonicalJson($p->{$key}) !== canonicalJson($initial->{$key})) fail(422, 'project_target', 'Ova vježba zahtijeva dodijeljenu pločicu i jezik. Drugi cilj otvori kao zasebni lokalni projekt.');
    }
    foreach (['createdAt', 'updatedAt'] as $key) if (!is_string($p->{$key} ?? null) || strlen($p->{$key}) > 40 || strtotime($p->{$key}) === false) fail(422, 'project', 'Datum projekta nije valjan.');
    if (!$p->files instanceof \stdClass || !is_string($p->files->{$p->entryFile} ?? null) || count(get_object_vars($p->files)) > 64) fail(422, 'project_files', 'Nedostaje početna datoteka ili ima previše datoteka.');
    $seen = [];
    foreach (get_object_vars($p->files) as $path => $text) {
        if (strlen($path) > 100 || !preg_match('~^(?:[A-Za-z_][A-Za-z0-9_-]*/)*[A-Za-z_][A-Za-z0-9_-]*\.(py|ino|h|hpp|c|cpp|txt|md|json)$~D', $path)
            || preg_match('~(?:^|/)(?:machine\.py|_lab\.py|project\.json|__proto__|constructor|prototype)(?:/|$)~i', $path)
            || isset($seen[strtolower($path)]) || !is_string($text) || strlen($text) > 131072) fail(422, 'project_files', 'Putanja ili veličina datoteke nije dopuštena.');
        $seen[strtolower($path)] = true; $total += strlen($text);
    }
    if ($total > 1048576) fail(413, 'project_size', 'Datoteke obaju čvorova mogu imati ukupno najviše 1 MiB.');
    $s = $p->settings ?? null;
    if (!$s instanceof \stdClass || !is_string($s->activeFile ?? null) || !isset($p->files->{$s->activeFile}) || !in_array($s->theme ?? null, ['light', 'dark'], true)
        || !is_int($s->fontSize ?? null) || $s->fontSize < 12 || $s->fontSize > 24 || !is_bool($s->powered ?? null) || !is_bool($s->swapped ?? null)
        || !is_string($s->example ?? null) || strlen($s->example) > 160) fail(422, 'project_settings', 'Postavke projekta nisu valjane.');
    $c = $p->circuit ?? null;
    if (!$c instanceof \stdClass || !is_array($c->components ?? null) || !is_array($c->wires ?? null) || count($c->components) > 40 || count($c->wires) > 200
        || !in_array($c->kind ?? null, ['editable', 'stage0-fixture'], true) || ($c->kind === 'editable' && ($c->modelVersion ?? null) !== 1)) fail(422, 'project_circuit', 'Sklop može imati do 40 komponenti i 200 vodiča.');
    $ids = [];
    foreach (array_merge($c->components, $c->wires) as $item) {
        if (!$item instanceof \stdClass || !is_string($item->id ?? null) || !preg_match('/^[a-zA-Z0-9_-]{1,80}$/D', $item->id) || isset($ids[$item->id])) fail(422, 'project_circuit', 'Oznake sklopa nisu valjane ili se ponavljaju.');
        $ids[$item->id] = true;
    }
    foreach ($c->components as $part) if (!is_string($part->kind ?? null) || !is_string($part->label ?? null) || strlen($part->label) > 240 || !$part->properties instanceof \stdClass
        || !is_numeric($part->x ?? null) || !is_numeric($part->y ?? null) || abs((float)$part->x) > 10000 || abs((float)$part->y) > 10000 || !in_array($part->rotation ?? null, [0, 90, 180, 270], true)) fail(422, 'project_circuit', 'Komponenta nije valjana.');
    foreach ($c->wires as $wire) if (!is_array($wire->points ?? null) || count($wire->points) > 24 || !$wire->from instanceof \stdClass || !$wire->to instanceof \stdClass) fail(422, 'project_circuit', 'Vodič nije valjan.');
    if ($p->schemaVersion === 4) {
        if ($depth || ($p->radio->version ?? null) !== 1 || !($initial->radio->peer ?? null) instanceof \stdClass) fail(422, 'project_radio', 'Vježba ne podržava tu mrežu čvorova.');
        validateWorkProject($p->radio->peer ?? null, $initial->radio->peer, 1, $total);
    } elseif (isset($p->radio) || isset($initial->radio)) fail(422, 'project_radio', 'Sačuvaj oba čvora dodijeljene vježbe.');
}

function saveAttempt(\PDO $pdo, array $actor, array $body): array
{
    $prior = accessibleAttempt($pdo, $actor, $body['attemptId'] ?? null);
    if ($actor['role'] !== 'student' || (int)$prior['student_id'] !== (int)$actor['id']) fail(403, 'forbidden', 'Samo učenik sprema vlastiti otvoreni rad.');
    $expected = $body['expectedRevision'] ?? null; $key = $body['requestKey'] ?? null;
    if (!is_int($expected) || $expected < 1 || $expected > 4294967294 || !is_string($key) || !preg_match('/^[A-Za-z0-9-]{16,80}$/D', $key)) fail(422, 'revision', 'Pošalji potvrđenu reviziju i jedinstvenu oznaku spremanja.');
    $p = $body['project'] ?? null;
    $initial = json_decode(query($pdo, 'SELECT project FROM work_snapshots WHERE attempt_id=? AND revision=1', [$prior['id']])->fetchColumn(), false, 64, JSON_THROW_ON_ERROR);
    validateWorkProject($p, $initial);
    unset($p->files->{'school-attempt.json'});
    $document = canonicalJson($p); $hash = hash('sha256', $document);
    if (strlen($document) > 3145728) fail(413, 'project_size', 'Snimka projekta prelazi 3 MiB.');
    return transaction($pdo, function () use ($pdo, $actor, $prior, $expected, $key, $document, $hash) {
        $actor = lockActor($pdo, $actor); schoolClass($pdo, $actor, $prior['class_id'], false, true);
        $row = query($pdo, 'SELECT * FROM school_attempts WHERE id=? FOR UPDATE', [$prior['id']])->fetch();
        if ($actor['role'] !== 'student' || (int)$row['student_id'] !== (int)$actor['id']) fail(403, 'forbidden', 'Nemaš pristup tom radu.');
        readAssignment($pdo, $actor, $row['assignment_id']);
        $same = query($pdo, 'SELECT revision, base_revision, content_hash, created_at FROM work_snapshots WHERE attempt_id=? AND request_key=?', [$row['id'], $key])->fetch();
        if ($same && ((int)$same['base_revision'] !== $expected || !hash_equals($same['content_hash'], $hash))) fail(409, 'request_reused', 'Oznaka spremanja već je korištena za drugi sadržaj.');
        if (!$same) {
            if ($row['status'] !== 'in_progress') fail(409, 'attempt_locked', 'Ovaj rad je zaključan. Lokalni rad sačuvaj izvozom.');
            if ((int)$row['current_revision'] !== $expected) fail(409, 'revision_conflict', 'Na poslužitelju postoji novija revizija. Pregledaj obje verzije prije nastavka.');
            $revision = $expected + 1;
            query($pdo, 'INSERT INTO work_snapshots (attempt_id, revision, base_revision, request_key, project, content_hash) VALUES (?, ?, ?, ?, ?, ?)', [$row['id'], $revision, $expected, $key, $document, $hash]);
            query($pdo, 'UPDATE school_attempts SET current_revision=?, updated_at=CURRENT_TIMESTAMP(6) WHERE id=?', [$revision, $row['id']]);
            enqueueGrading($pdo, (int)$row['id'], $revision, $key);
            $same = query($pdo, 'SELECT revision, content_hash, created_at FROM work_snapshots WHERE attempt_id=? AND revision=?', [$row['id'], $revision])->fetch();
        }
        return ['attemptId' => (int)$row['id'], 'revision' => (int)$same['revision'], 'currentRevision' => (int)query($pdo, 'SELECT current_revision FROM school_attempts WHERE id=?', [$row['id']])->fetchColumn(),
            'contentHash' => $same['content_hash'], 'savedAt' => utcTime($same['created_at'])];
    });
}

function attemptRevisions(\PDO $pdo, array $actor, mixed $value, mixed $before = null): array
{
    $row = accessibleAttempt($pdo, $actor, $value); $limit = $before === null ? (int)$row['current_revision'] + 1 : targetId($before);
    $rows = query($pdo, 'SELECT revision, content_hash, created_at FROM work_snapshots WHERE attempt_id=? AND revision<? ORDER BY revision DESC LIMIT 101', [$row['id'], $limit])->fetchAll();
    $more = count($rows) > 100; $rows = array_slice($rows, 0, 100);
    return ['revisions' => array_map(fn($s) => ['revision' => (int)$s['revision'], 'contentHash' => $s['content_hash'], 'savedAt' => utcTime($s['created_at'])], $rows), 'hasMore' => $more];
}

function latestAttemptJobs(\PDO $pdo, array $ids): array
{
    $jobs = [];
    if ($ids) foreach (query($pdo, 'SELECT j.* FROM grading_jobs j JOIN school_attempts w ON w.id=j.attempt_id AND w.current_revision=j.revision WHERE j.id IN (SELECT MAX(id) FROM grading_jobs WHERE attempt_id IN (' . implode(',',array_fill(0,count($ids),'?')) . ') GROUP BY attempt_id,revision)', $ids)->fetchAll() as $job) $jobs[(int)$job['attempt_id']]=$job;
    return $jobs;
}

function classWork(\PDO $pdo, array $actor, mixed $assignmentId, mixed $after = null): array
{
    requireStaff($actor); $a = readAssignment($pdo, $actor, $assignmentId); $start = $after === null ? 0 : targetId($after);
    $rows = query($pdo, 'SELECT u.id AS user_id, u.username, u.display_name, u.active, w.* FROM class_students m JOIN users u ON u.id=m.student_id LEFT JOIN school_attempts w ON w.student_id=u.id AND w.assignment_id=? AND w.attempt_number=(SELECT MAX(newest.attempt_number) FROM school_attempts newest WHERE newest.student_id=u.id AND newest.assignment_id=w.assignment_id) WHERE m.class_id=? AND u.id>? ORDER BY u.id LIMIT 201', [$a['id'], $a['classId'], $start])->fetchAll();
    $more = count($rows) > 200; $rows = array_slice($rows, 0, 200);
    $ids = array_values(array_filter(array_column($rows, 'id'))); $submissions = [];
    if ($rows) foreach (query($pdo, 'SELECT s.*, w.student_id FROM school_submissions s JOIN school_attempts w ON w.id=s.attempt_id WHERE w.assignment_id=? AND w.student_id IN (' . implode(',',array_fill(0,count($rows),'?')) . ') AND s.id=(SELECT MAX(s2.id) FROM school_submissions s2 JOIN school_attempts w2 ON w2.id=s2.attempt_id WHERE w2.assignment_id=w.assignment_id AND w2.student_id=w.student_id)', [$a['id'], ...array_column($rows,'user_id')])->fetchAll() as $s) {
        $submissions[(int)$s['student_id']] = $s; $ids[] = $s['attempt_id'];
    }
    $jobs = latestAttemptJobs($pdo, array_values(array_unique($ids)));
    $reviews = currentTeacherReviews($pdo,array_values(array_unique($ids)));
    $context=['rubric'=>$a['task']['rubric'],'target'=>$a['target']];
    return ['assignment' => $a, 'rows' => array_map(fn($r) => ['student' => ['id' => (int)$r['user_id'], 'username' => $r['username'], 'displayName' => $r['display_name'], 'active' => (bool)$r['active']],
        'status' => $r['id'] === null ? 'not_started' : ($r['status'] === 'in_progress' && (int)$r['attempt_number'] > 1 ? 'reopened' : $r['status']),
        'lastSubmission' => isset($submissions[(int)$r['user_id']]) ? submissionValue($submissions[(int)$r['user_id']], attachTeacherReview(jobSummary($jobs[(int)$submissions[(int)$r['user_id']]['attempt_id']]??null,$context,(int)$submissions[(int)$r['user_id']]['revision']),$reviews[(int)$submissions[(int)$r['user_id']]['attempt_id']]??null)) : null,
        'attempt' => $r['id'] === null ? null : workSummary($r,attachTeacherReview(jobSummary($jobs[(int)$r['id']]??null,$context,(int)$r['current_revision']),$reviews[(int)$r['id']]??null))], $rows),
        'hasMore' => $more, 'nextAfter' => $more ? (int)$rows[array_key_last($rows)]['user_id'] : null, 'serverTime' => gmdate('Y-m-d\TH:i:s\Z')];
}
