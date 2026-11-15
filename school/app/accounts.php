<?php
declare(strict_types=1);
namespace Labos;

function lockActor(\PDO $pdo, array $actor): array
{
    $fresh = query($pdo, 'SELECT * FROM users WHERE id = ? FOR UPDATE', [$actor['id']])->fetch();
    if (!$fresh || !$fresh['active'] || $fresh['must_change_password'] || (int)$fresh['auth_version'] !== (int)$actor['auth_version']) fail(401, 'authentication_required', 'Račun je promijenjen. Prijavi se ponovno.');
    return $fresh;
}

function canManageStudent(\PDO $pdo, array $actor, array $student): bool
{
    return $actor['role'] === 'admin' || ($actor['role'] === 'teacher' && $student['role'] === 'student'
        && (bool)query($pdo, 'SELECT 1 FROM class_teachers t JOIN class_students s ON s.class_id = t.class_id WHERE t.teacher_id = ? AND s.student_id = ? LIMIT 1', [$actor['id'], $student['id']])->fetchColumn());
}

function listUsers(\PDO $pdo, array $actor): array
{
    if ($actor['role'] === 'admin') $users = $pdo->query('SELECT * FROM users ORDER BY username LIMIT 1000')->fetchAll();
    elseif ($actor['role'] === 'teacher') $users = query($pdo, "SELECT DISTINCT u.* FROM users u JOIN class_students s ON s.student_id = u.id JOIN class_teachers t ON t.class_id = s.class_id WHERE t.teacher_id = ? AND u.role = 'student' ORDER BY u.username LIMIT 1000", [$actor['id']])->fetchAll();
    else fail(403, 'forbidden', 'Pregled računa dostupan je nastavniku i administratoru.');
    return array_map(publicUser(...), $users);
}

function targetId(mixed $value): int
{
    if (!(is_int($value) || (is_string($value) && preg_match('/^[0-9]+$/D', $value))) || (int)$value < 1 || (int)$value > 9007199254740991) fail(422, 'user_id', 'Odaberi valjani korisnički račun.');
    return (int)$value;
}

function readUser(\PDO $pdo, array $actor, mixed $id): array
{
    $id = targetId($id);
    $target = query($pdo, 'SELECT * FROM users WHERE id = ?', [$id])->fetch();
    if (!$target || ((int)$actor['id'] !== $id && !canManageStudent($pdo, $actor, $target))) fail(403, 'forbidden', 'Nemaš pristup tom računu.');
    return publicUser($target);
}

function createUser(\PDO $pdo, array $actor, array $body): array
{
    if ($actor['role'] !== 'admin') fail(403, 'forbidden', 'Račune stvara administrator.');
    $name = username($body['username'] ?? null); $display = displayName($body['displayName'] ?? null); $pass = password($body['temporaryPassword'] ?? null); $role = $body['role'] ?? '';
    if (!in_array($role, ['student', 'teacher', 'admin'], true)) fail(422, 'role', 'Odaberi ulogu korisnika.');
    return transaction($pdo, function () use ($pdo, $actor, $name, $display, $pass, $role) {
        $actor = lockActor($pdo, $actor);
        if ($actor['role'] !== 'admin') fail(403, 'forbidden', 'Račune stvara administrator.');
        if (query($pdo, 'SELECT id FROM users WHERE username = ?', [$name])->fetchColumn()) fail(409, 'username_taken', 'To korisničko ime već postoji.');
        try { query($pdo, 'INSERT INTO users (username, display_name, role, password_hash) VALUES (?, ?, ?, ?)', [$name, $display, $role, password_hash($pass, PASSWORD_DEFAULT)]); }
        catch (\PDOException $error) { if (($error->errorInfo[1] ?? 0) === 1062) fail(409, 'username_taken', 'To korisničko ime već postoji.'); throw $error; }
        $id = (int)$pdo->lastInsertId(); audit($pdo, (int)$actor['id'], $id, 'account.created', ['role' => $role]);
        return publicUser(query($pdo, 'SELECT * FROM users WHERE id = ?', [$id])->fetch());
    });
}

function resetPassword(\PDO $pdo, array $actor, array $body): void
{
    $id = targetId($body['id'] ?? null); $pass = password($body['temporaryPassword'] ?? null);
    transaction($pdo, function () use ($pdo, $actor, $body, $id, $pass) {
        $actor = lockActor($pdo, $actor);
        $target = query($pdo, 'SELECT * FROM users WHERE id = ? FOR UPDATE', [$id])->fetch();
        if (!$target || !canManageStudent($pdo, $actor, $target) || $id === (int)$actor['id']) fail(403, 'forbidden', 'Lozinku možeš resetirati samo dopuštenom korisniku. Vlastitu promijeni u svom računu.');
        if (!is_string($body['currentPassword'] ?? null) || !password_verify($body['currentPassword'], $actor['password_hash'])) fail(403, 'current_password', 'Potvrdi svojom trenutačnom lozinkom.');
        query($pdo, 'UPDATE users SET password_hash = ?, must_change_password = TRUE, auth_version = auth_version + 1 WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $id]);
        audit($pdo, (int)$actor['id'], $id, 'password.reset');
    });
}

function updateUser(\PDO $pdo, array $actor, array $body): array
{
    if ($actor['role'] !== 'admin') fail(403, 'forbidden', 'Ovlasti mijenja administrator.');
    $id = targetId($body['id'] ?? null); $role = $body['role'] ?? '';
    if (!in_array($role, ['student', 'teacher', 'admin'], true) || !is_bool($body['active'] ?? null)) fail(422, 'account', 'Zadaj ulogu i aktivnost računa.');
    if ($id === (int)$actor['id']) fail(403, 'self_change', 'Vlastitu ulogu i aktivnost neka promijeni drugi administrator.');
    return transaction($pdo, function () use ($pdo, $actor, $body, $id, $role) {
        // Serialize administrative changes before locking the target row.
        $pdo->query("SELECT id FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE")->fetchAll();
        $actor = lockActor($pdo, $actor);
        if ($actor['role'] !== 'admin') fail(403, 'forbidden', 'Ovlasti mijenja administrator.');
        $target = query($pdo, 'SELECT * FROM users WHERE id = ? FOR UPDATE', [$id])->fetch();
        if (!$target) fail(404, 'user_missing', 'Račun nije pronađen.');
        query($pdo, 'UPDATE users SET role = ?, active = ?, auth_version = auth_version + 1 WHERE id = ?', [$role, (int)$body['active'], $id]);
        audit($pdo, (int)$actor['id'], $id, 'account.updated', ['before' => ['role' => $target['role'], 'active' => (bool)$target['active']], 'after' => ['role' => $role, 'active' => $body['active']]]);
        return publicUser(query($pdo, 'SELECT * FROM users WHERE id = ?', [$id])->fetch());
    });
}
