<?php
declare(strict_types=1);
namespace Labos;

function migrate(\PDO $pdo): array
{
    $lock = 'labosv2-migrations-' . $pdo->query('SELECT DATABASE()')->fetchColumn();
    if ((int)query($pdo, 'SELECT GET_LOCK(?, 10)', [$lock])->fetchColumn() !== 1) fail(503, 'migration_busy', 'Javlja se druga migracija. Pokušaj ponovno.');
    try {
        $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) CHARACTER SET ascii PRIMARY KEY, checksum CHAR(64) CHARACTER SET ascii NOT NULL, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $result = [];
        foreach (glob(dirname(__DIR__) . '/migrations/*.sql') as $path) {
            $version = basename($path); $sql = file_get_contents($path); $checksum = hash('sha256', $sql);
            $prior = query($pdo, 'SELECT checksum FROM schema_migrations WHERE version = ?', [$version])->fetchColumn();
            if ($prior !== false) {
                if (!hash_equals($prior, $checksum)) fail(409, 'migration_changed', 'Već primijenjena migracija izmijenjena je: ' . $version);
                $result[] = ['version' => $version, 'status' => 'already_applied']; continue;
            }
            // MySQL DDL implicitly commits. Initial CREATE IF NOT EXISTS statements are
            // resumable; only record a version after every statement has succeeded.
            foreach (preg_split('/;\s*(?:\r?\n|$)/', trim($sql)) as $statement) {
                if (trim($statement) !== '') $pdo->exec($statement);
            }
            query($pdo, 'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', [$version, $checksum]);
            $result[] = ['version' => $version, 'status' => 'applied'];
        }
        return $result;
    } finally { query($pdo, 'SELECT RELEASE_LOCK(?)', [$lock]); }
}

function bootstrapAdmin(\PDO $pdo, array $input): array
{
    $username = username($input['username'] ?? null); $display = displayName($input['displayName'] ?? null); $password = password($input['password'] ?? null);
    $lock = 'labosv2-bootstrap-' . $pdo->query('SELECT DATABASE()')->fetchColumn();
    if ((int)query($pdo, 'SELECT GET_LOCK(?, 10)', [$lock])->fetchColumn() !== 1) fail(503, 'bootstrap_busy', 'Stvaranje administratora već je u tijeku.');
    try {
        return transaction($pdo, function () use ($pdo, $username, $display, $password) {
            if ((int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() !== 0) fail(409, 'already_initialized', 'Instalacija već ima korisnike. Početni administrator ne može se ponovno stvoriti.');
            query($pdo, 'INSERT INTO users (username, display_name, role, password_hash, must_change_password) VALUES (?, ?, ?, ?, FALSE)', [$username, $display, 'admin', password_hash($password, PASSWORD_DEFAULT)]);
            $id = (int)$pdo->lastInsertId(); audit($pdo, $id, $id, 'installation.initialized');
            return ['id' => $id, 'username' => $username, 'role' => 'admin'];
        });
    } finally { query($pdo, 'SELECT RELEASE_LOCK(?)', [$lock]); }
}
