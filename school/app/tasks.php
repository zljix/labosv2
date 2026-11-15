<?php
declare(strict_types=1);
namespace Labos;

function schoolCatalog(): array
{
    $value = json_decode(file_get_contents(dirname(__DIR__) . '/catalog/catalog.json'), true, 64, JSON_THROW_ON_ERROR);
    if (($value['format'] ?? '') !== 'labosv2-school-catalog' || ($value['version'] ?? null) !== 1) fail(503, 'catalog', 'Školski katalog nije pripremljen.');
    return $value;
}

function publicCatalog(array $actor): array
{
    requireStaff($actor); $catalog = schoolCatalog();
    foreach ($catalog['entries'] as &$entry) unset($entry['templates']);
    $catalog['gradingProfiles'] = gradingRegistry()['profiles'];
    return $catalog;
}

function rubric(mixed $input, array $entry): array
{
    $criteria = [];
    if ($input === null || $input === []) {
        foreach ($entry['criteria'] as $i => $label) $criteria[] = ['id' => 'c' . ($i + 1), 'description' => $label, 'maxPoints' => null];
    } else {
        if (!is_array($input) || !array_is_list($input) || count($input) < 1 || count($input) > 12) fail(422, 'rubric', 'Unesi 1–12 kriterija.');
        foreach ($input as $i => $item) {
            $item = (array)$item;
            if (!is_int($item['maxPoints'] ?? null) || $item['maxPoints'] < 1 || $item['maxPoints'] > 100) fail(422, 'rubric', 'Kriterij mora imati 1–100 mogućih bodova.');
            $criteria[] = ['id' => 'c' . ($i + 1), 'description' => textField($item['description'] ?? null, 400, 'Opis kriterija'), 'maxPoints' => $item['maxPoints']];
        }
    }
    return ['format' => 'labosv2-rubric', 'version' => 1, 'authority' => 'not-yet-enabled', 'criteria' => $criteria,
        'maxPoints' => $criteria[0]['maxPoints'] === null ? null : array_sum(array_column($criteria, 'maxPoints'))];
}

function taskValue(array $row): array
{
    return ['id' => (int)$row['id'], 'taskKey' => $row['task_key'], 'version' => (int)$row['version'],
        'definition' => json_decode($row['definition'], true, 64, JSON_THROW_ON_ERROR),
        'rubric' => json_decode($row['rubric'], true, 32, JSON_THROW_ON_ERROR), 'contentHash' => $row['content_hash'], 'publishedAt' => utcTime($row['published_at'])];
}

function listTaskVersions(\PDO $pdo, array $actor): array
{
    requireStaff($actor);
    return array_map(taskValue(...), $pdo->query('SELECT v.id, t.task_key, v.version, v.definition, v.rubric, v.content_hash, v.published_at FROM task_versions v JOIN school_tasks t ON t.id=v.task_id ORDER BY v.id DESC LIMIT 1000')->fetchAll());
}

function publishTask(\PDO $pdo, array $actor, array $body): array
{
    requireStaff($actor); $key = $body['taskKey'] ?? null; $catalog = schoolCatalog();
    $entry = null; foreach ($catalog['entries'] as $item) if ($item['key'] === $key) { $entry = $item; break; }
    if (!$entry) fail(422, 'task_key', 'Odaberi postojeću vježbu i varijantu iz školskog kataloga.');
    $notes = textField($body['teacherNotes'] ?? '', 6000, 'Nastavnička uputa', true);
    $profileId = $body['gradingProfile'] ?? null;
    if ($profileId !== null && (!is_string($profileId) || ($body['criteria'] ?? null) !== null)) fail(422, 'grading_profile', 'Za automatsku provjeru koristi njezine objavljene kriterije.');
    $rubric = $profileId === null ? rubric($body['criteria'] ?? null, $entry) : gradingRubric($profileId, $key); $starters = [];
    foreach ($entry['templates'] as $target => $filename) {
        // Paths come exclusively from the installed private catalogue.
        if (basename($filename) !== $filename || !str_ends_with($filename, '.json')) fail(503, 'catalog', 'Školski predložak nije valjan.');
        $starters[$target] = json_decode(file_get_contents(dirname(__DIR__) . '/catalog/' . $filename), false, 64, JSON_THROW_ON_ERROR);
    }
    unset($entry['templates']); $entry['teacherNotes'] = $notes; $entry['sourceVersion'] = $catalog['sourceVersion'];
    $json = fn($v) => json_encode($v, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $definition = $json($entry); $rubricJson = $json($rubric); $starterJson = $json($starters);
    $hash = hash('sha256', $definition . "\n" . $rubricJson . "\n" . $starterJson);
    return transaction($pdo, function () use ($pdo, $actor, $key, $definition, $rubricJson, $starterJson, $hash) {
        $actor = lockActor($pdo, $actor); requireStaff($actor);
        query($pdo, 'INSERT INTO school_tasks (task_key) VALUES (?) ON DUPLICATE KEY UPDATE task_key=school_tasks.task_key', [$key]);
        $task = query($pdo, 'SELECT * FROM school_tasks WHERE task_key=? FOR UPDATE', [$key])->fetch(); $version = (int)$task['last_version'] + 1;
        query($pdo, 'INSERT INTO task_versions (task_id, version, definition, rubric, starters, content_hash, published_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [$task['id'], $version, $definition, $rubricJson, $starterJson, $hash, $actor['id']]);
        $id = (int)$pdo->lastInsertId(); query($pdo, 'UPDATE school_tasks SET last_version=? WHERE id=?', [$version, $task['id']]);
        audit($pdo, (int)$actor['id'], null, 'task.published', ['taskVersionId' => $id, 'version' => $version, 'contentHash' => $hash]);
        return taskValue(query($pdo, 'SELECT v.*, t.task_key FROM task_versions v JOIN school_tasks t ON t.id=v.task_id WHERE v.id=?', [$id])->fetch());
    });
}

function deadline(mixed $value): ?string
{
    if ($value === null || $value === '') return null;
    if (!is_string($value) || !preg_match('/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/D', $value)) fail(422, 'deadline', 'Rok pošalji kao izričit UTC datum ili ga ostavi praznim.');
    try { $date = new \DateTimeImmutable($value); } catch (\Exception $e) { fail(422, 'deadline', 'Datum roka nije valjan.'); }
    if ($date->format('Y-m-d\TH:i:s') !== substr($value, 0, 19)) fail(422, 'deadline', 'Datum roka nije valjan.');
    return $date->format('Y-m-d H:i:s.u');
}

function createAssignment(\PDO $pdo, array $actor, array $body): array
{
    requireStaff($actor); $versionId = targetId($body['taskVersionId'] ?? null); $target = $body['target'] ?? '';
    if (!in_array($target, ['micropython', 's3-cpp', 'uno', 'nano'], true)) fail(422, 'target', 'Odaberi podržanu pločicu i jezik.');
    $due = deadline($body['dueAt'] ?? null);
    if (!is_bool($body['available'] ?? true)) fail(422, 'availability', 'Dostupnost mora biti da ili ne.');
    return transaction($pdo, function () use ($pdo, $actor, $body, $versionId, $target, $due) {
        $actor = lockActor($pdo, $actor); requireStaff($actor); $class = schoolClass($pdo, $actor, $body['classId'] ?? null, true, true);
        $version = query($pdo, 'SELECT definition FROM task_versions WHERE id=?', [$versionId])->fetchColumn();
        if (!$version || !in_array($target, json_decode($version, true, 64, JSON_THROW_ON_ERROR)['targets'], true)) fail(422, 'task_target', 'Inačica zadatka ne podržava taj cilj.');
        query($pdo, 'INSERT INTO class_assignments (class_id, task_version_id, target, available, due_at, created_by) VALUES (?, ?, ?, ?, ?, ?)', [$class['id'], $versionId, $target, (int)($body['available'] ?? true), $due, $actor['id']]);
        $id = (int)$pdo->lastInsertId(); audit($pdo, (int)$actor['id'], null, 'assignment.created', ['classId' => $class['id'], 'assignmentId' => $id, 'taskVersionId' => $versionId]);
        return readAssignment($pdo, $actor, $id);
    });
}

function assignmentValue(array $row): array
{
    return ['id' => (int)$row['assignment_id'], 'classId' => (int)$row['class_id'], 'className' => $row['class_name'], 'schoolYear' => $row['school_year'],
        'target' => $row['target'], 'available' => (bool)$row['available'], 'archived' => (bool)$row['archived'], 'dueAt' => utcTime($row['due_at']), 'task' => taskValue($row)];
}

function assignmentSelect(): string
{
    return 'SELECT a.id AS assignment_id, a.class_id, a.target, a.available, a.due_at, c.name AS class_name, c.school_year, EXISTS(SELECT 1 FROM school_year_archives y WHERE y.school_year=c.school_year AND y.archived=TRUE) AS archived, v.id, v.version, v.definition, v.rubric, v.content_hash, v.published_at, t.task_key FROM class_assignments a JOIN school_classes c ON c.id=a.class_id JOIN task_versions v ON v.id=a.task_version_id JOIN school_tasks t ON t.id=v.task_id';
}

function listAssignments(\PDO $pdo, array $actor, mixed $classId = null): array
{
    $values = []; $where = [];
    if ($classId !== null) { $class = schoolClass($pdo, $actor, $classId); $where[] = 'a.class_id=?'; $values[] = $class['id']; }
    if ($actor['role'] === 'student') { $where[] = 'a.available=TRUE AND EXISTS (SELECT 1 FROM class_students m WHERE m.class_id=a.class_id AND m.student_id=?)'; $values[] = $actor['id']; }
    elseif ($actor['role'] === 'teacher') { $where[] = 'EXISTS (SELECT 1 FROM class_teachers m WHERE m.class_id=a.class_id AND m.teacher_id=?)'; $values[] = $actor['id']; }
    return array_map(assignmentValue(...), query($pdo, assignmentSelect() . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY a.id DESC LIMIT 1000', $values)->fetchAll());
}

function readAssignment(\PDO $pdo, array $actor, mixed $value, bool $starter = false): array
{
    $id = targetId($value); $row = query($pdo, assignmentSelect() . ' WHERE a.id=?', [$id])->fetch();
    if (!$row) fail(403, 'forbidden', 'Nemaš pristup toj dodijeljenoj vježbi.');
    schoolClass($pdo, $actor, $row['class_id']);
    if ($actor['role'] === 'student' && !$row['available']) fail(403, 'assignment_unavailable', 'Ta vježba trenutačno nije dostupna.');
    $result = assignmentValue($row);
    if ($starter) {
        $templates = json_decode(query($pdo, 'SELECT starters FROM task_versions WHERE id=?', [$row['id']])->fetchColumn(), false, 64, JSON_THROW_ON_ERROR);
        if (!isset($templates->{$row['target']})) fail(503, 'starter', 'Zamrznuti predložak nije dostupan.');
        $result['starter'] = $templates->{$row['target']};
        repairStarterObjects($result['starter']);
    }
    return $result;
}

function setAssignmentAvailability(\PDO $pdo, array $actor, array $body): void
{
    requireStaff($actor); $id = targetId($body['assignmentId'] ?? null);
    if (!is_bool($body['available'] ?? null)) fail(422, 'availability', 'Dostupnost mora biti da ili ne.');
    transaction($pdo, function () use ($pdo, $actor, $body, $id) {
        $actor = lockActor($pdo, $actor); requireStaff($actor);
        $row = query($pdo, 'SELECT class_id FROM class_assignments WHERE id=?', [$id])->fetch();
        if (!$row) fail(403, 'forbidden', 'Nemaš pristup toj dodijeljenoj vježbi.');
        $class = schoolClass($pdo, $actor, $row['class_id'], true, true);
        query($pdo, 'UPDATE class_assignments SET available=? WHERE id=?', [(int)$body['available'], $id]);
        audit($pdo, (int)$actor['id'], null, 'assignment.availability', ['classId' => $class['id'], 'assignmentId' => $id, 'available' => $body['available']]);
    });
}

// Earlier associative decoding could turn an empty properties object into [].
// Restore only this known object field when reading legacy frozen templates.
function repairStarterObjects(\stdClass $project): void
{
    foreach ($project->circuit->components as $part) if ($part->properties === []) $part->properties = new \stdClass();
    if (isset($project->radio->peer)) repairStarterObjects($project->radio->peer);
}
