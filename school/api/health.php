<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET', 'HEAD'], true)) {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit;
}
// Liveness only. Database diagnostics are available exclusively through the CLI.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'HEAD') {
    $release = json_decode(file_get_contents(dirname(__DIR__) . '/../release.json'), true, 16, JSON_THROW_ON_ERROR);
    echo json_encode([
        'application' => 'labosv2',
        'stage' => $release['stage'],
        'sourceVersion' => $release['version'],
        'status' => 'alive',
        'features' => ['accounts' => true, 'classes' => true, 'assignments' => true, 'centralStorage' => true, 'officialGrading' => true, 'submissions' => true, 'reports' => true],
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
