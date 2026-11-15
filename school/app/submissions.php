<?php
declare(strict_types=1);
namespace Labos;

function submissionValue(array $row, ?array $grading = null): array
{
    return ['id' => (int)$row['id'], 'attemptId' => (int)$row['attempt_id'], 'revision' => (int)$row['revision'],
        'contentHash' => $row['snapshot_hash'], 'taskVersionId' => (int)$row['task_version_id'], 'rubricHash' => $row['rubric_hash'],
        'submittedAt' => utcTime($row['submitted_at']), 'grading' => $grading];
}

function attemptSubmission(\PDO $pdo, int $id): ?array
{
    $s = query($pdo, 'SELECT * FROM school_submissions WHERE attempt_id=?', [$id])->fetch();
    return $s ? submissionValue($s, snapshotGrading($pdo, $id, (int)$s['revision'])) : null;
}

function attemptReopening(\PDO $pdo, int $id): ?array
{
    $r = query($pdo, 'SELECT r.*, s.attempt_id AS previous_attempt_id FROM attempt_reopenings r JOIN school_submissions s ON s.id=r.from_submission_id WHERE r.new_attempt_id=?', [$id])->fetch();
    return $r ? reopeningValue($r) : null;
}

function reopeningValue(array $r): array
{
    return ['previousAttemptId' => (int)$r['previous_attempt_id'], 'submissionId' => (int)$r['from_submission_id'],
        'reason' => $r['reason'], 'openedBy' => (int)$r['opened_by'], 'openedAt' => utcTime($r['opened_at'])];
}

function submissionRequest(array $body): array
{
    $revision = $body['expectedRevision'] ?? null; $key = $body['requestKey'] ?? null;
    if (!is_int($revision) || $revision < 1 || $revision > 4294967294 || !is_string($key) || !preg_match('/^[A-Za-z0-9-]{16,80}$/D', $key))
        fail(422, 'revision', 'Pošalji potvrđenu reviziju i jedinstvenu oznaku završetka.');
    return [$revision, $key];
}

function finishAttempt(\PDO $pdo, array $actor, array $body): array
{
    $prior = accessibleAttempt($pdo, $actor, $body['attemptId'] ?? null);
    if ($actor['role'] !== 'student' || (int)$prior['student_id'] !== (int)$actor['id']) fail(403, 'forbidden', 'Samo učenik završava vlastiti rad.');
    [$revision, $key] = submissionRequest($body);
    return transaction($pdo, function () use ($pdo, $actor, $prior, $revision, $key) {
        // Same lock order as autosave: account, class, attempt. Both actions
        // serialize on this row; a late save cannot change a sealed snapshot.
        $actor = lockActor($pdo, $actor); schoolClass($pdo, $actor, $prior['class_id'], false, true);
        $row = query($pdo, 'SELECT * FROM school_attempts WHERE id=? FOR UPDATE', [$prior['id']])->fetch();
        if ($actor['role'] !== 'student' || (int)$row['student_id'] !== (int)$actor['id']) fail(403, 'forbidden', 'Završi vlastiti rad.');
        $assignment = readAssignment($pdo, $actor, $row['assignment_id']);
        $same = query($pdo, 'SELECT * FROM school_submissions WHERE attempt_id=? FOR UPDATE', [$row['id']])->fetch();
        if ($same) {
            if ((int)$same['revision'] !== $revision) fail(409, 'revision_conflict', 'Predaja je već zaključana uz drugu reviziju. Pregledaj potvrđenu predaju.');
            // Two tabs may use different keys for the same revision. There is
            // exactly one submission, also after a lost HTTP response.
            return readAttempt($pdo, $actor, $row['id']);
        }
        if ($row['status'] !== 'in_progress') fail(409, 'attempt_locked', 'Taj pokušaj više nije otvoren.');
        if ((int)$row['current_revision'] !== $revision) fail(409, 'revision_conflict', 'Rad je u međuvremenu spremljen u drugoj reviziji. Ponovno pregledaj završni sažetak.');
        $hash = query($pdo, 'SELECT content_hash FROM work_snapshots WHERE attempt_id=? AND revision=?', [$row['id'], $revision])->fetchColumn();
        query($pdo, 'INSERT INTO school_submissions (attempt_id,revision,request_key,snapshot_hash,task_version_id,rubric_hash) VALUES (?,?,?,?,?,?)',
            [$row['id'], $revision, $key, $hash, $assignment['task']['id'], $assignment['task']['contentHash']]);
        $submissionId = (int)$pdo->lastInsertId();
        query($pdo, "UPDATE school_attempts SET status='locked' WHERE id=?", [$row['id']]);
        enqueueGrading($pdo, (int)$row['id'], $revision, 'finish-' . hash('sha256', $key));
        audit($pdo, (int)$actor['id'], (int)$actor['id'], 'attempt.submitted', ['attemptId' => (int)$row['id'], 'submissionId' => $submissionId, 'revision' => $revision, 'contentHash' => $hash]);
        return readAttempt($pdo, $actor, $row['id']);
    });
}

function reopenAttempt(\PDO $pdo, array $actor, array $body): array
{
    requireStaff($actor); $prior = accessibleAttempt($pdo, $actor, $body['attemptId'] ?? null);
    $submissionId = targetId($body['submissionId'] ?? null);
    $reason = textField($body['reason'] ?? null, 1000, 'Razlog dorade'); $key = $body['requestKey'] ?? null;
    if (!is_string($key) || !preg_match('/^[A-Za-z0-9-]{16,80}$/D', $key)) fail(422, 'request_key', 'Pošalji jedinstvenu oznaku dopuštanja dorade.');
    return transaction($pdo, function () use ($pdo, $actor, $prior, $submissionId, $reason, $key) {
        $actor = lockActor($pdo, $actor); requireStaff($actor); schoolClass($pdo, $actor, $prior['class_id'], true, true);
        $row = query($pdo, 'SELECT * FROM school_attempts WHERE id=? FOR UPDATE', [$prior['id']])->fetch();
        $s = query($pdo, 'SELECT * FROM school_submissions WHERE attempt_id=? FOR UPDATE', [$row['id']])->fetch();
        if (!$s || (int)$s['id'] !== $submissionId || $row['status'] !== 'locked') fail(409, 'not_submitted', 'Dorada se dopušta za odabranu zaključanu predaju.');
        $same = query($pdo, 'SELECT * FROM attempt_reopenings WHERE from_submission_id=? FOR UPDATE', [$submissionId])->fetch();
        if ($same) {
            if ($same['request_key'] !== $key || $same['reason'] !== $reason || (int)$same['opened_by'] !== (int)$actor['id']) fail(409, 'already_reopened', 'Dorada je već dopuštena. Otvori povijest pokušaja.');
            return readAttempt($pdo, $actor, $same['new_attempt_id']);
        }
        $last = query($pdo, 'SELECT id, attempt_number FROM school_attempts WHERE assignment_id=? AND student_id=? ORDER BY attempt_number DESC LIMIT 1 FOR UPDATE', [$row['assignment_id'], $row['student_id']])->fetch();
        if ((int)$last['id'] !== (int)$row['id']) fail(409, 'newer_attempt', 'Postoji noviji pokušaj. Doradu dopusti za posljednju predaju.');
        $assignment = readAssignment($pdo, $actor, $row['assignment_id']);
        $p = json_decode(query($pdo, 'SELECT project FROM work_snapshots WHERE attempt_id=? AND revision=?', [$row['id'], $s['revision']])->fetchColumn(), false, 64, JSON_THROW_ON_ERROR);
        $student = query($pdo, 'SELECT display_name FROM users WHERE id=?', [$row['student_id']])->fetch();
        $document = newAttemptDocument($p, $assignment, $student['display_name']);
        query($pdo, 'INSERT INTO school_attempts (assignment_id,student_id,attempt_number,current_revision) VALUES (?,?,?,1)', [$row['assignment_id'], $row['student_id'], (int)$row['attempt_number'] + 1]);
        $id = (int)$pdo->lastInsertId();
        query($pdo, 'INSERT INTO work_snapshots (attempt_id,revision,base_revision,request_key,project,content_hash) VALUES (?,1,0,?,?,?)', [$id, 'initial-snapshot', $document, hash('sha256', $document)]);
        query($pdo, 'INSERT INTO attempt_reopenings (from_submission_id,new_attempt_id,request_key,reason,opened_by) VALUES (?,?,?,?,?)', [$submissionId, $id, $key, $reason, $actor['id']]);
        enqueueGrading($pdo, $id, 1, 'initial-snapshot');
        audit($pdo, (int)$actor['id'], (int)$row['student_id'], 'attempt.reopened', ['previousAttemptId' => (int)$row['id'], 'submissionId' => $submissionId, 'attemptId' => $id, 'reason' => $reason]);
        return readAttempt($pdo, $actor, $id);
    });
}

function attemptHistory(\PDO $pdo, array $actor, mixed $id, mixed $before = null): array
{
    $row = accessibleAttempt($pdo, $actor, $id);
    $limit = $before === null ? 4294967295 : targetId($before);
    $rows = query($pdo, 'SELECT * FROM school_attempts WHERE assignment_id=? AND student_id=? AND attempt_number<? ORDER BY attempt_number DESC LIMIT 101', [$row['assignment_id'], $row['student_id'], $limit])->fetchAll();
    $more = count($rows) > 100; $rows = array_slice($rows, 0, 100);
    $ids = array_column($rows, 'id'); $context = gradingContext($pdo, (int)$row['id']); $jobs = latestAttemptJobs($pdo, $ids);
    $submissions = []; $reopenings = [];
    if ($ids) {
        $marks = implode(',', array_fill(0, count($ids), '?'));
        foreach (query($pdo, 'SELECT * FROM school_submissions WHERE attempt_id IN (' . $marks . ')', $ids)->fetchAll() as $s) $submissions[(int)$s['attempt_id']] = $s;
        foreach (query($pdo, 'SELECT r.*, s.attempt_id AS previous_attempt_id FROM attempt_reopenings r JOIN school_submissions s ON s.id=r.from_submission_id WHERE r.new_attempt_id IN (' . $marks . ')', $ids)->fetchAll() as $r) $reopenings[(int)$r['new_attempt_id']] = $r;
    }
    $reviews = currentTeacherReviews($pdo,$ids);
    $attempts = array_map(function ($r) use ($jobs, $context, $submissions, $reopenings, $reviews) {
        $id = (int)$r['id']; $grading = attachTeacherReview(jobSummary($jobs[$id] ?? null, $context, (int)$r['current_revision']),$reviews[$id]??null);
        return ['attempt' => workSummary($r, $grading), 'submission' => isset($submissions[$id]) ? submissionValue($submissions[$id], $grading) : null,
            'reopening' => isset($reopenings[$id]) ? reopeningValue($reopenings[$id]) : null];
    }, $rows);
    return ['attempts' => $attempts, 'hasMore' => $more, 'nextBefore' => $more ? (int)$rows[array_key_last($rows)]['attempt_number'] : null];
}
