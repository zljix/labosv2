<?php
declare(strict_types=1);
namespace Labos;

function textField(mixed $value, int $max, string $label, bool $empty = false): string
{
    // UTF-8 is checked before character counts; no mbstring dependency.
    if (!is_string($value) || !preg_match('//u', $value)) fail(422, 'field', $label . ' nije valjan tekst.');
    $value = trim($value);
    if ((!$empty && $value === '') || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/', $value) || preg_match_all('/./us', $value) > $max) fail(422, 'field', $label . ': dopušteno je do ' . $max . ' znakova.');
    return $value;
}

function requireStaff(array $actor): void
{
    if (!in_array($actor['role'], ['teacher', 'admin'], true)) fail(403, 'forbidden', 'Ta je funkcija dostupna nastavniku i administratoru.');
}

function schoolClass(\PDO $pdo, array $actor, mixed $value, bool $manage = false, bool $lock = false): array
{
    $id = targetId($value);
    $row = query($pdo, 'SELECT * FROM school_classes WHERE id = ?' . ($lock ? ' FOR UPDATE' : ''), [$id])->fetch();
    $allowed = $row && ($actor['role'] === 'admin'
        || ($actor['role'] === 'teacher' && query($pdo, 'SELECT 1 FROM class_teachers WHERE class_id = ? AND teacher_id = ?', [$id, $actor['id']])->fetchColumn())
        || (!$manage && $actor['role'] === 'student' && query($pdo, 'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?', [$id, $actor['id']])->fetchColumn()));
    if (!$allowed) fail(403, 'forbidden', 'Nemaš pristup tom razredu.');
    $archived = yearArchived($pdo, $row['school_year']);
    if ($lock && $archived) fail(409, 'year_archived', 'Školska godina je arhivirana. Dostupni su pregled i izvozi.');
    return ['id' => (int)$row['id'], 'name' => $row['name'], 'schoolYear' => $row['school_year'], 'archived' => $archived];
}

function listClasses(\PDO $pdo, array $actor): array
{
    $join = $actor['role'] === 'student' ? ' JOIN class_students m ON m.class_id = c.id AND m.student_id = ?'
        : ($actor['role'] === 'teacher' ? ' JOIN class_teachers m ON m.class_id = c.id AND m.teacher_id = ?' : '');
    $rows = query($pdo, 'SELECT c.*, (SELECT COUNT(*) FROM class_students s WHERE s.class_id=c.id) AS students FROM school_classes c' . $join . ' ORDER BY c.school_year DESC, c.name LIMIT 1000', $join ? [$actor['id']] : [])->fetchAll();
    return array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'schoolYear' => $r['school_year'], 'archived' => yearArchived($pdo, $r['school_year']), 'students' => (int)$r['students']], $rows);
}

function createClass(\PDO $pdo, array $actor, array $body): array
{
    requireStaff($actor); $name = textField($body['name'] ?? null, 80, 'Naziv razreda');
    $year = $body['schoolYear'] ?? '';
    if (!is_string($year) || !preg_match('/^(20\d{2})\/(20\d{2})$/D', $year, $m) || (int)$m[2] !== (int)$m[1] + 1) fail(422, 'school_year', 'Školsku godinu upiši kao 2026/2027.');
    return transaction($pdo, function () use ($pdo, $actor, $name, $year) {
        $actor = lockActor($pdo, $actor); requireStaff($actor);
        if (query($pdo,'SELECT archived FROM school_year_archives WHERE school_year=? FOR UPDATE',[$year])->fetchColumn()) fail(409, 'year_archived', 'Odabrana školska godina je arhivirana.');
        try { query($pdo, 'INSERT INTO school_classes (name, school_year) VALUES (?, ?)', [$name, $year]); }
        catch (\PDOException $e) { if (($e->errorInfo[1] ?? 0) === 1062) fail(409, 'class_exists', 'Taj razred već postoji u odabranoj školskoj godini.'); throw $e; }
        $id = (int)$pdo->lastInsertId();
        if ($actor['role'] === 'teacher') query($pdo, 'INSERT INTO class_teachers (class_id, teacher_id) VALUES (?, ?)', [$id, $actor['id']]);
        audit($pdo, (int)$actor['id'], null, 'class.created', ['classId' => $id]);
        return schoolClass($pdo, $actor, $id, true);
    });
}

function classDetail(\PDO $pdo, array $actor, mixed $id): array
{
    requireStaff($actor); $class = schoolClass($pdo, $actor, $id, true);
    $class['students'] = array_map(publicUser(...), query($pdo, 'SELECT u.* FROM users u JOIN class_students s ON s.student_id=u.id WHERE s.class_id=? ORDER BY u.display_name, u.username', [$class['id']])->fetchAll());
    $class['teachers'] = array_map(publicUser(...), query($pdo, 'SELECT u.* FROM users u JOIN class_teachers t ON t.teacher_id=u.id WHERE t.class_id=? ORDER BY u.display_name', [$class['id']])->fetchAll());
    $class['requests'] = array_map(fn($r) => ['id' => (int)$r['id'], 'student' => ['id' => (int)$r['student_id'], 'username' => $r['username'], 'displayName' => $r['display_name']], 'requestedAt' => utcTime($r['requested_at'])], query($pdo, "SELECT r.*, u.username, u.display_name FROM class_join_requests r JOIN users u ON u.id=r.student_id WHERE r.class_id=? AND r.status='pending' ORDER BY r.id", [$class['id']])->fetchAll());
    $class['invites'] = array_map(fn($r) => ['id' => (int)$r['id'], 'expiresAt' => utcTime($r['expires_at']), 'maxUses' => (int)$r['max_uses'], 'usedCount' => (int)$r['used_count']], query($pdo, 'SELECT * FROM class_invites WHERE class_id=? AND revoked=FALSE AND expires_at>UTC_TIMESTAMP(6) ORDER BY id DESC', [$class['id']])->fetchAll());
    return $class;
}

function changeMembership(\PDO $pdo, array $actor, array $body): void
{
    requireStaff($actor); $kind = $body['kind'] ?? '';
    if (!in_array($kind, ['teacher', 'student'], true) || !is_bool($body['present'] ?? null)) fail(422, 'membership', 'Odaberi vrstu članstva i radnju.');
    if ($kind === 'teacher' && $actor['role'] !== 'admin') fail(403, 'forbidden', 'Nastavnike razredu dodjeljuje administrator.');
    if ($kind === 'student' && $body['present']) fail(422, 'membership', 'Učenike dodaj pregledanim CSV uvozom ili potvrdom njihova zahtjeva.');
    $id = targetId($body['userId'] ?? null);
    transaction($pdo, function () use ($pdo, $actor, $body, $kind, $id) {
        $actor = lockActor($pdo, $actor); requireStaff($actor);
        if ($kind === 'teacher' && $actor['role'] !== 'admin') fail(403, 'forbidden', 'Nastavnike razredu dodjeljuje administrator.');
        $class = schoolClass($pdo, $actor, $body['classId'] ?? null, true, true);
        $user = query($pdo, 'SELECT * FROM users WHERE id=? FOR UPDATE', [$id])->fetch();
        if (!$user || ($body['present'] && (!$user['active'] || $user['role'] !== $kind))) fail(422, 'member_role', 'Odaberi aktivan račun odgovarajuće uloge.');
        $table = $kind === 'teacher' ? 'class_teachers' : 'class_students'; $column = $kind === 'teacher' ? 'teacher_id' : 'student_id';
        if ($body['present']) query($pdo, "INSERT INTO $table (class_id, $column) VALUES (?, ?) ON DUPLICATE KEY UPDATE class_id=$table.class_id", [$class['id'], $id]);
        else query($pdo, "DELETE FROM $table WHERE class_id=? AND $column=?", [$class['id'], $id]);
        audit($pdo, (int)$actor['id'], $id, 'class.membership', ['classId' => $class['id'], 'kind' => $kind, 'present' => $body['present']]);
    });
}

function utcTime(?string $value): ?string { return $value === null ? null : str_replace(' ', 'T', $value) . 'Z'; }

function csvPlan(\PDO $pdo, int $classId, mixed $csv): array
{
    if (!is_string($csv) || strlen($csv) > 60000 || !preg_match('//u', $csv) || str_contains($csv, "\0")) fail(422, 'csv', 'CSV mora biti UTF-8 tekst do 60 kB.');
    $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv);
    $stream = fopen('php://temp', 'r+'); fwrite($stream, $csv); rewind($stream);
    $headerLine = fgets($stream); if ($headerLine === false) fail(422, 'csv', 'CSV je prazan.');
    $delimiter = str_contains($headerLine, ';') ? ';' : ','; rewind($stream);
    $header = fgetcsv($stream, 0, $delimiter, '"', '');
    if (!is_array($header) || !in_array($header, [['username', 'displayName', 'temporaryPassword'], ['username', 'displayName']], true)) fail(422, 'csv_header', 'Zaglavlje mora biti username;displayName;temporaryPassword ili username;displayName.');
    $rows = []; $seen = []; $line = 1;
    try {
        while (($fields = fgetcsv($stream, 0, $delimiter, '"', '')) !== false) {
            ++$line; if ($fields === [null]) continue;
            if (count($rows) >= 100 || count($fields) !== count($header)) fail(422, 'csv_row', 'CSV redak ' . $line . ': provjeri stupce i najviše 100 učenika.');
            $name = username($fields[0]); $display = displayName($fields[1]);
            if (isset($seen[$name])) fail(422, 'csv_duplicate', 'Korisničko ime ponavlja se u CSV-u: ' . $name); $seen[$name] = true;
            $user = query($pdo, 'SELECT id, role, active, display_name FROM users WHERE username=?', [$name])->fetch();
            if ($user && ($user['role'] !== 'student' || !$user['active'])) fail(409, 'csv_account', 'CSV navodi račun koji nije aktivan učenik: ' . $name);
            if ($user && $user['display_name'] !== $display) fail(409, 'csv_identity', 'Ime postojećeg računa ne odgovara CSV-u: ' . $name . '. Provjeri identitet prije uvoza.');
            $pass = $fields[2] ?? '';
            if ($user && $pass !== '') fail(422, 'csv_existing_password', 'Za postojeći račun ostavi temporaryPassword prazno: ' . $name . '. Uvoz ne resetira lozinke.');
            if (!$user) $pass = password($pass);
            $member = $user && (bool)query($pdo, 'SELECT 1 FROM class_students WHERE class_id=? AND student_id=?', [$classId, $user['id']])->fetchColumn();
            $rows[] = ['username' => $name, 'displayName' => $display, 'userId' => $user ? (int)$user['id'] : null,
                'action' => $member ? 'member' : ($user ? 'link' : 'create'), 'temporaryPassword' => $pass];
        }
    } finally { fclose($stream); }
    if (!$rows) fail(422, 'csv_empty', 'CSV mora imati barem jednog učenika.');
    return $rows;
}

function importDigest(array $config, array $actor, int $classId, array $rows, int $expires): string
{
    return hash_hmac('sha256', json_encode([$actor['id'], $classId, $rows, $expires], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $config['app']['key']);
}

function previewStudents(\PDO $pdo, array $config, array $actor, array $body): array
{
    requireStaff($actor); $class = schoolClass($pdo, $actor, $body['classId'] ?? null, true);
    $rows = csvPlan($pdo, $class['id'], $body['csv'] ?? null); $expires = time() + 600;
    return ['rows' => array_map(function ($r) { unset($r['temporaryPassword']); return $r; }, $rows),
        'previewToken' => $expires . '.' . importDigest($config, $actor, $class['id'], $rows, $expires)];
}

function importStudents(\PDO $pdo, array $config, array $actor, array $body): array
{
    requireStaff($actor);
    $token = $body['previewToken'] ?? '';
    if (!is_string($token) || !preg_match('/^(\d{10})\.([a-f0-9]{64})$/D', $token, $m) || (int)$m[1] < time() || (int)$m[1] > time() + 600) fail(409, 'csv_preview', 'Najprije ponovno pregledaj CSV uvoz.');
    return transaction($pdo, function () use ($pdo, $config, $actor, $body, $m) {
        $actor = lockActor($pdo, $actor); requireStaff($actor);
        $class = schoolClass($pdo, $actor, $body['classId'] ?? null, true, true);
        $rows = csvPlan($pdo, $class['id'], $body['csv'] ?? null);
        if (!hash_equals($m[2], importDigest($config, $actor, $class['id'], $rows, (int)$m[1]))) fail(409, 'csv_changed', 'CSV ili računi promijenili su se nakon pregleda. Ponovno pregledaj uvoz.');
        if (array_filter($rows, fn($r) => $r['action'] === 'link') && ($body['linkExisting'] ?? false) !== true) fail(422, 'csv_confirm', 'Izričito potvrdi povezivanje pregledanih postojećih računa.');
        $created = 0; $linked = 0;
        foreach ($rows as $row) {
            $id = $row['userId'];
            if ($id === null) {
                try { query($pdo, "INSERT INTO users (username, display_name, role, password_hash) VALUES (?, ?, 'student', ?)", [$row['username'], $row['displayName'], password_hash($row['temporaryPassword'], PASSWORD_DEFAULT)]); }
                catch (\PDOException $e) { if (($e->errorInfo[1] ?? 0) === 1062) fail(409, 'csv_changed', 'Račun je upravo stvoren drugdje. Ponovno pregledaj uvoz.'); throw $e; }
                $id = (int)$pdo->lastInsertId(); ++$created;
            } else {
                $fresh = query($pdo, 'SELECT role, active, display_name FROM users WHERE id=? FOR UPDATE', [$id])->fetch();
                if (!$fresh || $fresh['role'] !== 'student' || !$fresh['active'] || $fresh['display_name'] !== $row['displayName']) fail(409, 'csv_changed', 'Račun je promijenjen tijekom uvoza. Ponovno pregledaj uvoz.');
            }
            if ($row['action'] !== 'member') {
                query($pdo, 'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)', [$class['id'], $id]); ++$linked;
                query($pdo, "UPDATE class_join_requests SET status='approved', reviewed_by=?, reviewed_at=UTC_TIMESTAMP(6) WHERE class_id=? AND student_id=? AND status='pending'", [$actor['id'], $class['id'], $id]);
                audit($pdo, (int)$actor['id'], (int)$id, 'class.student_imported', ['classId' => $class['id'], 'created' => $row['userId'] === null]);
            }
        }
        return ['created' => $created, 'added' => $linked, 'unchanged' => count($rows) - $linked];
    });
}

function createInvite(\PDO $pdo, array $config, array $actor, array $body): array
{
    requireStaff($actor); $hours = $body['hours'] ?? 24; $uses = $body['maxUses'] ?? 30;
    if (!is_int($hours) || $hours < 1 || $hours > 168 || !is_int($uses) || $uses < 1 || $uses > 100) fail(422, 'invite_limits', 'Kod traje 1–168 sati i dopušta 1–100 zahtjeva.');
    return transaction($pdo, function () use ($pdo, $config, $actor, $body, $hours, $uses) {
        $actor = lockActor($pdo, $actor); requireStaff($actor); $class = schoolClass($pdo, $actor, $body['classId'] ?? null, true, true);
        $code = strtoupper(bin2hex(random_bytes(12))); $hash = hash_hmac('sha256', $code, $config['app']['key']);
        query($pdo, 'UPDATE class_invites SET revoked=TRUE WHERE class_id=?', [$class['id']]);
        query($pdo, 'INSERT INTO class_invites (class_id, code_hash, expires_at, max_uses, created_by) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? HOUR), ?, ?)', [$class['id'], $hash, $hours, $uses, $actor['id']]);
        $id = (int)$pdo->lastInsertId(); audit($pdo, (int)$actor['id'], null, 'class.invite_created', ['classId' => $class['id'], 'inviteId' => $id]);
        return ['id' => $id, 'code' => $code, 'expiresAt' => utcTime(query($pdo, 'SELECT expires_at FROM class_invites WHERE id=?', [$id])->fetchColumn()), 'maxUses' => $uses];
    });
}

function revokeInvites(\PDO $pdo, array $actor, array $body): void
{
    requireStaff($actor);
    transaction($pdo, function () use ($pdo, $actor, $body) {
        $actor = lockActor($pdo, $actor); requireStaff($actor); $class = schoolClass($pdo, $actor, $body['classId'] ?? null, true, true);
        query($pdo, 'UPDATE class_invites SET revoked=TRUE WHERE class_id=?', [$class['id']]);
        audit($pdo, (int)$actor['id'], null, 'class.invites_revoked', ['classId' => $class['id']]);
    });
}

function requestClass(\PDO $pdo, array $config, ?array $actor, array $body): array
{
    if ($actor && $actor['role'] !== 'student') fail(403, 'forbidden', 'Pridruživanje kodom namijenjeno je učenicima.');
    $code = $body['code'] ?? '';
    if (!is_string($code) || !preg_match('/^[A-Fa-f0-9]{24}$/D', trim($code))) fail(422, 'invite', 'Kod nije valjan, istekao je ili više nije dostupan.');
    $hash = hash_hmac('sha256', strtoupper(trim($code)), $config['app']['key']);
    reserveLogin($pdo, $config, 'admission:' . ($actor ? $actor['id'] : (is_string($body['username'] ?? null) ? strtolower($body['username']) : 'unknown')));
    return transaction($pdo, function () use ($pdo, $actor, $body, $hash) {
        if ($actor) $actor = lockActor($pdo, $actor);
        $invite = query($pdo, 'SELECT * FROM class_invites WHERE code_hash=?', [$hash])->fetch();
        if (!$invite) fail(422, 'invite', 'Kod nije valjan, istekao je ili više nije dostupan.');
        $schoolClass = query($pdo, 'SELECT id, school_year FROM school_classes WHERE id=? FOR UPDATE', [$invite['class_id']])->fetch();
        if (yearArchived($pdo, $schoolClass['school_year'])) fail(409, 'year_archived', 'Ta školska godina je arhivirana.');
        $invite = query($pdo, 'SELECT *, expires_at>UTC_TIMESTAMP(6) AS valid_time FROM class_invites WHERE id=? FOR UPDATE', [$invite['id']])->fetch();
        if ($invite['revoked'] || !$invite['valid_time']) fail(422, 'invite', 'Kod nije valjan, istekao je ili više nije dostupan.');
        if ($actor) {
            $prior = query($pdo, 'SELECT status FROM class_join_requests WHERE class_id=? AND student_id=? FOR UPDATE', [$invite['class_id'], $actor['id']])->fetch();
            if (query($pdo, 'SELECT 1 FROM class_students WHERE class_id=? AND student_id=? FOR UPDATE', [$invite['class_id'], $actor['id']])->fetchColumn()) return ['status' => 'member'];
            if ($prior && $prior['status'] === 'pending') return ['status' => 'pending'];
        }
        if ((int)$invite['used_count'] >= (int)$invite['max_uses']) fail(422, 'invite', 'Kod nije valjan, istekao je ili više nije dostupan.');
        if (!$actor) {
            $name = username($body['username'] ?? null); $display = displayName($body['displayName'] ?? null); $pass = password($body['password'] ?? null);
            try { query($pdo, "INSERT INTO users (username, display_name, role, password_hash, must_change_password) VALUES (?, ?, 'student', ?, FALSE)", [$name, $display, password_hash($pass, PASSWORD_DEFAULT)]); }
            catch (\PDOException $e) { if (($e->errorInfo[1] ?? 0) === 1062) fail(409, 'username_taken', 'Račun s tim korisničkim imenom već postoji. Prijavi se postojećim računom ili odaberi drugo ime.'); throw $e; }
            $actor = ['id' => (int)$pdo->lastInsertId()];
        }
        query($pdo, "INSERT INTO class_join_requests (class_id, student_id, invite_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status='pending', invite_id=?, requested_at=UTC_TIMESTAMP(6), reviewed_by=NULL, reviewed_at=NULL", [$invite['class_id'], $actor['id'], $invite['id'], $invite['id']]);
        query($pdo, 'UPDATE class_invites SET used_count=used_count+1 WHERE id=?', [$invite['id']]);
        audit($pdo, (int)$actor['id'], (int)$actor['id'], 'class.join_requested', ['classId' => (int)$invite['class_id']]);
        return ['status' => 'pending'];
    });
}

function reviewJoin(\PDO $pdo, array $actor, array $body): void
{
    requireStaff($actor); $id = targetId($body['requestId'] ?? null);
    if (!is_bool($body['approve'] ?? null)) fail(422, 'decision', 'Odaberi potvrdu ili odbijanje.');
    transaction($pdo, function () use ($pdo, $actor, $body, $id) {
        $actor = lockActor($pdo, $actor); requireStaff($actor);
        $row = query($pdo, 'SELECT * FROM class_join_requests WHERE id=?', [$id])->fetch();
        if (!$row) fail(403, 'forbidden', 'Nemaš pristup tom zahtjevu.');
        $class = schoolClass($pdo, $actor, $row['class_id'], true, true);
        $row = query($pdo, 'SELECT * FROM class_join_requests WHERE id=? FOR UPDATE', [$id])->fetch();
        if ($row['status'] !== 'pending') fail(409, 'join_reviewed', 'Zahtjev je već obrađen. Osvježi razred.');
        $student = query($pdo, 'SELECT * FROM users WHERE id=? FOR UPDATE', [$row['student_id']])->fetch();
        if ($body['approve'] && (!$student['active'] || $student['role'] !== 'student')) fail(409, 'member_role', 'Račun više nije aktivan učenik.');
        if ($body['approve']) query($pdo, 'INSERT INTO class_students (class_id, student_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE class_id=class_students.class_id', [$class['id'], $row['student_id']]);
        query($pdo, 'UPDATE class_join_requests SET status=?, reviewed_by=?, reviewed_at=UTC_TIMESTAMP(6) WHERE id=?', [$body['approve'] ? 'approved' : 'rejected', $actor['id'], $id]);
        audit($pdo, (int)$actor['id'], (int)$row['student_id'], 'class.join_reviewed', ['classId' => $class['id'], 'approved' => $body['approve']]);
    });
}

function myJoinRequests(\PDO $pdo, array $actor): array
{
    if ($actor['role'] !== 'student') return [];
    return array_map(fn($r) => ['id' => (int)$r['id'], 'className' => $r['name'], 'schoolYear' => $r['school_year'], 'status' => $r['status']], query($pdo, 'SELECT r.id, r.status, c.name, c.school_year FROM class_join_requests r JOIN school_classes c ON c.id=r.class_id WHERE r.student_id=? ORDER BY r.id DESC', [$actor['id']])->fetchAll());
}
