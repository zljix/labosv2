<?php
declare(strict_types=1);
namespace Labos;

function username(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/D', $value)) fail(422, 'username', 'Korisničko ime mora imati 3–64 slova bez kvačica, znamenke, točku, crticu ili podvlaku.');
    return strtolower($value);
}

function displayName(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^\S(?:[^\p{C}]{0,118}\S)?$/uD', trim($value))) fail(422, 'display_name', 'Upiši ime za prikaz, do 120 znakova.');
    return trim($value);
}

function password(mixed $value): string
{
    if (!is_string($value) || strlen($value) < 12 || strlen($value) > 72 || str_contains($value, "\0")) fail(422, 'password', 'Lozinka mora imati 12–72 bajta; razmaci su dopušteni.');
    return $value;
}

function publicUser(array $user): array
{
    return ['id' => (int)$user['id'], 'username' => $user['username'], 'displayName' => $user['display_name'], 'role' => $user['role'], 'active' => (bool)$user['active'], 'mustChangePassword' => (bool)$user['must_change_password']];
}

function startSession(array $config): void
{
    $secure = $config['app']['secure'];
    $local = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
    if ($secure && ($_SERVER['HTTPS'] ?? '') !== 'on' && ($_SERVER['HTTPS'] ?? '') !== '1') fail(400, 'https_required', 'Za prijavu otvori školsku HTTPS adresu.');
    if (!$secure && !$local) fail(400, 'https_required', 'Nešifrirani test dopušten je samo na lokalnom računalu.');
    ini_set('session.use_strict_mode', '1'); ini_set('session.use_only_cookies', '1'); ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', '28800');
    session_save_path($config['app']['session_directory']); session_name('LABOSV2SESSID');
    session_set_cookie_params(['lifetime' => 0, 'path' => $config['app']['cookie_path'], 'secure' => $secure, 'httponly' => true, 'samesite' => 'Strict']);
    session_cache_limiter('');
    if (!session_start()) fail(503, 'session_storage', 'Sesiju trenutačno nije moguće spremiti.');
    $now = time();
    if (isset($_SESSION['user_id']) && ($now - ($_SESSION['last_seen'] ?? 0) > 1800 || $now - ($_SESSION['started_at'] ?? 0) > 28800)) {
        $_SESSION = []; session_regenerate_id(true);
    }
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    if (isset($_SESSION['user_id'])) $_SESSION['last_seen'] = $now;
}

function csrf(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    $parts = parse_url($config['app']['origin']);
    $expected = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
    if (($origin !== null && $origin !== $expected) || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') fail(403, 'origin', 'Zahtjev mora doći iz školskog laboratorija.');
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals($_SESSION['csrf'], $token)) fail(403, 'csrf', 'Sesija obrasca nije valjana. Osvježi stranicu.');
}

function currentUser(\PDO $pdo, bool $required = true): ?array
{
    $user = isset($_SESSION['user_id']) ? query($pdo, 'SELECT * FROM users WHERE id = ?', [$_SESSION['user_id']])->fetch() : false;
    if ($user && (bool)$user['active'] && (int)$user['auth_version'] === ($_SESSION['auth_version'] ?? 0)) return $user;
    if (isset($_SESSION['user_id'])) { $_SESSION = ['csrf' => bin2hex(random_bytes(32))]; session_regenerate_id(true); }
    if ($required) fail(401, 'authentication_required', 'Prijavi se školskim računom.');
    return null;
}

function readyUser(\PDO $pdo): array
{
    $user = currentUser($pdo);
    if ($user['must_change_password']) fail(403, 'password_change_required', 'Prije nastavka promijeni privremenu lozinku.');
    return $user;
}

function reserveLogin(\PDO $pdo, array $config, string $name): void
{
    $buckets = [
        [hash_hmac('sha256', 'user:' . $name, $config['app']['key']), 8],
        [hash_hmac('sha256', 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), $config['app']['key']), 120],
    ];
    usort($buckets, fn($a, $b) => strcmp($a[0], $b[0]));
    transaction($pdo, function () use ($pdo, $buckets) {
        $now = time(); $rows = [];
        foreach ($buckets as [$key, $limit]) {
            query($pdo, 'INSERT INTO login_limits (bucket_key, window_started) VALUES (?, ?) ON DUPLICATE KEY UPDATE bucket_key = login_limits.bucket_key', [$key, $now]);
            $row = query($pdo, 'SELECT * FROM login_limits WHERE bucket_key = ? FOR UPDATE', [$key])->fetch();
            $fresh = $now - (int)$row['window_started'] >= 900;
            if (!$fresh && (int)$row['attempt_count'] >= $limit) fail(429, 'login_limited', 'Previše pokušaja prijave. Pokušaj nakon 15 minuta ili se obrati administratoru.');
            $rows[] = [$now, $fresh ? 1 : (int)$row['attempt_count'] + 1, $key];
        }
        foreach ($rows as $values) {
            // Fixed windows are not extended by later attempts.
            query($pdo, 'UPDATE login_limits SET window_started = IF(? - window_started >= 900, ?, window_started), attempt_count = ? WHERE bucket_key = ?', [$values[0], $values[0], $values[1], $values[2]]);
        }
    });
}

function login(\PDO $pdo, array $config, array $body): array
{
    $raw = $body['username'] ?? ''; $pass = $body['password'] ?? '';
    $name = is_string($raw) ? strtolower(substr($raw, 0, 128)) : '';
    reserveLogin($pdo, $config, $name);
    $user = query($pdo, 'SELECT * FROM users WHERE username = ?', [$name])->fetch();
    // A valid fixed bcrypt hash also makes unknown-user requests do a password check.
    $valid = password_verify(is_string($pass) && strlen($pass) <= 72 && !str_contains($pass, "\0") ? $pass : '', $user['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
    if (!$user || !$valid || !$user['active']) fail(401, 'invalid_credentials', 'Korisničko ime ili lozinka nisu ispravni.');
    $user = transaction($pdo, function () use ($pdo, $user, $pass) {
        $fresh = query($pdo, 'SELECT * FROM users WHERE id = ? FOR UPDATE', [$user['id']])->fetch();
        if (!$fresh['active'] || !hash_equals($fresh['password_hash'], $user['password_hash'])) fail(401, 'invalid_credentials', 'Korisničko ime ili lozinka nisu ispravni.');
        if (password_needs_rehash($fresh['password_hash'], PASSWORD_DEFAULT)) query($pdo, 'UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $user['id']]);
        audit($pdo, (int)$user['id'], (int)$user['id'], 'session.login'); return $fresh;
    });
    session_regenerate_id(true);
    $_SESSION = ['user_id' => (int)$user['id'], 'auth_version' => (int)$user['auth_version'], 'started_at' => time(), 'last_seen' => time(), 'csrf' => bin2hex(random_bytes(32))];
    return publicUser($user);
}

function changePassword(\PDO $pdo, array $body): array
{
    $user = currentUser($pdo); $next = password($body['newPassword'] ?? null); $current = $body['currentPassword'] ?? '';
    if (!is_string($current) || $current === $next) fail(422, 'password', 'Nova lozinka mora se razlikovati od trenutačne.');
    $version = transaction($pdo, function () use ($pdo, $user, $current, $next) {
        $fresh = query($pdo, 'SELECT * FROM users WHERE id = ? FOR UPDATE', [$user['id']])->fetch();
        if ((int)$fresh['auth_version'] !== (int)$user['auth_version'] || !password_verify($current, $fresh['password_hash'])) fail(403, 'current_password', 'Trenutačna lozinka nije ispravna.');
        query($pdo, 'UPDATE users SET password_hash = ?, must_change_password = FALSE, auth_version = auth_version + 1 WHERE id = ?', [password_hash($next, PASSWORD_DEFAULT), $user['id']]);
        audit($pdo, (int)$user['id'], (int)$user['id'], 'password.changed'); return (int)$fresh['auth_version'] + 1;
    });
    session_regenerate_id(true); $_SESSION['auth_version'] = $version; $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return publicUser(currentUser($pdo));
}
