<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
require dirname(__DIR__) . '/app/bootstrap.php';

try {
    $action = $argv[1] ?? '';
    if ($action === 'key') { echo bin2hex(random_bytes(32)) . PHP_EOL; exit(0); }
    $config = Labos\configuration($argv[2] ?? null); $pdo = Labos\database($config);
    if ($action === 'migrate') $result = ['migrations' => Labos\migrate($pdo)];
    elseif ($action === 'init-admin') {
        $raw = stream_get_contents(STDIN, 8193);
        if (strlen($raw) > 8192) Labos\fail(422, 'input', 'Instalacijski ulaz je prevelik.');
        $input = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($input)) Labos\fail(422, 'input', 'Pošalji JSON objekt kroz standardni ulaz.');
        $result = ['user' => Labos\bootstrapAdmin($pdo, $input)];
    } else Labos\fail(422, 'command', 'Naredbe: migrate, init-admin, key. Lozinku šalji kroz standardni ulaz, nikada kao argument.');
    echo json_encode(['ok' => true] + $result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Labos\ApiError $error) {
    fwrite(STDERR, json_encode(['ok' => false, 'error' => $error->errorCode, 'message' => $error->getMessage()], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL); exit(2);
} catch (Throwable $error) {
    fwrite(STDERR, "Instalacijska naredba nije uspjela. Provjeri privatnu konfiguraciju, MySQL i redoslijed koraka.\n"); exit(2);
}
