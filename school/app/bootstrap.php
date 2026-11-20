<?php
declare(strict_types=1);

namespace Labos;

final class ApiError extends \RuntimeException
{
    public function __construct(public int $status, public string $errorCode, string $message) { parent::__construct($message); }
}

function fail(int $status, string $code, string $message): never { throw new ApiError($status, $code, $message); }

function inside(string $path, string $directory): bool
{
    $path = str_replace('\\', '/', $path); $directory = rtrim(str_replace('\\', '/', $directory), '/') . '/';
    if (PHP_OS_FAMILY === 'Windows') { $path = strtolower($path); $directory = strtolower($directory); }
    return str_starts_with($path . '/', $directory);
}

function configuration(?string $path = null): array
{
    if (PHP_VERSION_ID < 80400 || PHP_VERSION_ID >= 80600) fail(503, 'php_profile', 'Školski profil zahtijeva PHP 8.4 ili 8.5.');
    $path ??= getenv('LAB_SCHOOL_CONFIG') ?: '';
    $real = $path !== '' ? realpath($path) : false;
    $web = realpath(dirname(__DIR__) . '/web');
    if (!$real || !is_readable($real) || ($web && inside($real, $web))) fail(503, 'configuration', 'Školska instalacija još nije konfigurirana.');
    $config = require $real;
    if (!is_array($config)) fail(503, 'configuration', 'Privatna konfiguracija nije valjana.');
    $db = $config['database'] ?? [];
    if (!is_array($config) || !is_string($db['dsn'] ?? null)
        || !preg_match('/^mysql:host=[^;]+;port=[0-9]+;dbname=[A-Za-z0-9_]+;charset=utf8mb4$/D', $db['dsn'])
        || !is_string($db['user'] ?? null) || $db['user'] === '' || !is_string($db['password'] ?? null)) fail(503, 'configuration', 'Provjeri privatnu konfiguraciju baze.');
    $app = $config['app'] ?? [];
    $origin = $app['origin'] ?? '';
    $url = is_string($origin) ? parse_url($origin) : false;
    $local = $url && in_array($url['host'] ?? '', ['localhost', '127.0.0.1', '[::1]'], true);
    if (!$url || !isset($url['scheme'], $url['host']) || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])
        || (($url['scheme'] ?? '') !== 'https' && !(($app['allow_insecure_localhost'] ?? false) === true && $local && $url['scheme'] === 'http'))
        || !preg_match('~^/(?:[a-zA-Z0-9_-]+/)*$~D', ($url['path'] ?? '/') . (str_ends_with($url['path'] ?? '/', '/') ? '' : '/'))
        || !is_string($app['key'] ?? null) || strlen($app['key']) < 32) fail(503, 'configuration', 'Postavi školsku HTTPS adresu i privatni ključ aplikacije.');
    $config['app']['origin'] = rtrim($origin, '/');
    $config['app']['cookie_path'] = rtrim($url['path'] ?? '', '/') . '/';
    $config['app']['secure'] = $url['scheme'] === 'https';
    $sessions = $app['session_directory'] ?? dirname($real) . '/sessions';
    $sessions = is_string($sessions) ? realpath($sessions) : false;
    if (!$sessions || !is_dir($sessions) || !is_writable($sessions) || ($web && inside($sessions, $web))) fail(503, 'configuration', 'Pripremi privatnu mapu sesija s pravom upisa za PHP.');
    $config['app']['session_directory'] = $sessions;
    return $config;
}

function database(array $config): \PDO
{
    $db = $config['database'];
    $pdo = new \PDO($db['dsn'], $db['user'], $db['password'], [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION, \PDO::ATTR_EMULATE_PREPARES => false, \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC, \PDO::ATTR_TIMEOUT => 5]);
    $info = $pdo->query('SELECT VERSION() AS version, @@version_comment AS vendor, CURRENT_USER() AS account')->fetch();
    if (stripos($info['version'] . ' ' . $info['vendor'], 'mariadb') !== false || !preg_match('/^8\.4\./', $info['version'])) fail(503, 'database_profile', 'Školski profil zahtijeva MySQL 8.4.');
    $admin = str_starts_with(strtolower($info['account']), 'root@');
    foreach ($pdo->query('SHOW GRANTS')->fetchAll(\PDO::FETCH_COLUMN) as $grant) {
        if (preg_match('/\bON\s+\*\.\*/i', $grant) && !preg_match('/^GRANT USAGE ON/i', $grant)) $admin = true;
    }
    if ($admin) fail(503, 'database_account', 'Aplikacija zahtijeva račun ograničen na svoju bazu.');
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function query(\PDO $pdo, string $sql, array $values = []): \PDOStatement
{
    $statement = $pdo->prepare($sql); $statement->execute($values); return $statement;
}

function transaction(\PDO $pdo, callable $work): mixed
{
    $pdo->beginTransaction();
    try { $result = $work(); $pdo->commit(); return $result; }
    catch (\Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
}

function audit(\PDO $pdo, ?int $actor, ?int $subject, string $event, array $details = []): void
{
    query($pdo, 'INSERT INTO audit_events (actor_id, subject_id, event, details) VALUES (?, ?, ?, ?)', [$actor, $subject, $event, json_encode((object)$details, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
}

require __DIR__ . '/migrations.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/accounts.php';
require __DIR__ . '/classes.php';
require __DIR__ . '/tasks.php';
require __DIR__ . '/work.php';
require __DIR__ . '/grading.php';
require __DIR__ . '/submissions.php';
require __DIR__ . '/reports.php';
require __DIR__ . '/administration.php';

require __DIR__ . '/compilation.php';
