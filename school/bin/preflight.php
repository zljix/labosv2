<?php
declare(strict_types=1);

// Read-only installation inventory. Never expose this script through Apache.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
date_default_timezone_set('Europe/Zagreb');
$checks = [];
$add = static function (string $id, bool $pass, string $message) use (&$checks): void {
    $checks[] = ['id' => $id, 'status' => $pass ? 'pass' : 'fail', 'message' => $message];
};
$configPath = $argv[1] ?? (getenv('LAB_SCHOOL_CONFIG') ?: '');
$add('php', PHP_VERSION_ID >= 80400 && PHP_VERSION_ID < 80600, 'PHP ' . PHP_VERSION . '; profil 8.4 ili 8.5 s aktualnim sigurnosnim zakrpama.');
foreach (['pdo_mysql', 'json', 'session'] as $extension) {
    $add($extension, extension_loaded($extension), 'PHP proširenje ' . $extension);
}
$config = null;
if ($configPath !== '' && is_file($configPath) && is_readable($configPath)) {
    try { $config = require $configPath; } catch (Throwable $e) { /* No secret-bearing exception output. */ }
}
$validConfig = is_array($config) && is_array($config['database'] ?? null)
    && is_string($config['database']['dsn'] ?? null)
    && preg_match('/^mysql:host=[^;]+;port=[0-9]+;dbname=[A-Za-z0-9_]+;charset=utf8mb4$/D', $config['database']['dsn']) === 1
    && is_string($config['database']['user'] ?? null) && $config['database']['user'] !== ''
    && is_string($config['database']['password'] ?? null);
$add('configuration', $validConfig, $validConfig ? 'Konfiguracija je učitana; vjerodajnice se ne ispisuju.' : 'Zadaj čitljivu privatnu konfiguraciju: php tools/preflight.php /privatno/config.php');
$add('timezone', $validConfig && ($config['timezone'] ?? '') === 'Europe/Zagreb', 'Prikaz vremena Europe/Zagreb; buduća baza čuva UTC.');
$database = null;
if ($validConfig && extension_loaded('pdo_mysql')) {
    try {
        $pdo = new PDO($config['database']['dsn'], $config['database']['user'], $config['database']['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $database = $pdo->query('SELECT VERSION() AS version, @@version_comment AS vendor, @@character_set_connection AS charset, CURRENT_USER() AS account')->fetch(PDO::FETCH_ASSOC);
        $maria = stripos($database['version'] . ' ' . $database['vendor'], 'mariadb') !== false;
        $add('mysql', !$maria && preg_match('/^8\.4\./', $database['version']) === 1, $maria ? 'Otkriven je MariaDB; odabrani profil traži stvarni MySQL 8.4 LTS.' : 'MySQL ' . $database['version'] . '; ' . $database['vendor']);
        $add('utf8mb4', $database['charset'] === 'utf8mb4', 'Kodiranje veze: ' . $database['charset']);
        $engine = $pdo->query("SELECT SUPPORT FROM information_schema.ENGINES WHERE ENGINE='InnoDB'")->fetchColumn();
        $add('innodb', in_array($engine, ['DEFAULT', 'YES'], true), 'InnoDB: ' . (string)$engine);
        $grants = $pdo->query('SHOW GRANTS')->fetchAll(PDO::FETCH_COLUMN);
        $admin = str_starts_with(strtolower($database['account']), 'root@');
        foreach ($grants as $grant) {
            if (preg_match('/\bON\s+\*\.\*/i', $grant) && !preg_match('/^GRANT USAGE ON/i', $grant)) { $admin = true; }
        }
        $add('application_account', !$admin, 'Aplikacijski račun mora imati ovlasti ograničene na svoju bazu.');
        unset($database['account']);
    } catch (Throwable $e) {
        $add('database_connection', false, 'Veza ili čitanje MySQL preduvjeta nije uspjelo. Provjeri servis, bazu i ovlasti privatno; tajni podatci nisu ispisani.');
    }
} else {
    $add('database_connection', false, 'MySQL nije provjeren bez konfiguracije i PDO MySQL upravljačkog programa.');
}
$memory = null;
if (is_readable('/proc/meminfo') && preg_match('/MemTotal:\s+(\d+) kB/', file_get_contents('/proc/meminfo'), $match)) { $memory = (int)$match[1] * 1024; }
$cpu = null;
if (is_readable('/proc/cpuinfo') && preg_match('/model name\s*:\s*(.+)/', file_get_contents('/proc/cpuinfo'), $match)) { $cpu = trim($match[1]); }
$report = [
    'format' => 'labosv2-school-preflight', 'version' => 1, 'stage' => '23B',
    'generatedAt' => gmdate('c'), 'displayTimezone' => 'Europe/Zagreb',
    'environment' => ['os' => PHP_OS_FAMILY, 'kernel' => php_uname('r'), 'architecture' => php_uname('m'), 'cpu' => $cpu, 'memoryBytes' => $memory, 'freeDiskBytes' => disk_free_space(__DIR__)],
    'database' => $database,
    'checks' => $checks,
    'ready' => !in_array('fail', array_column($checks, 'status'), true),
    'scope' => 'Read-only CLI prerequisites; does not run migrations, initialize accounts or confirm HTTP login readiness.',
];
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
exit($report['ready'] ? 0 : 2);
