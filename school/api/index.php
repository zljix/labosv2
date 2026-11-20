<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
ini_set('display_errors', '0');

function respond(int $status, array $body): never
{
    http_response_code($status);
    if (isset($_SESSION['csrf'])) $body['csrfToken'] = $_SESSION['csrf'];
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $release = json_decode(file_get_contents(dirname(__DIR__) . '/../release.json'), true, 16, JSON_THROW_ON_ERROR);
    echo json_encode(['application' => 'labosv2', 'stage' => $release['stage'], 'sourceVersion' => $release['version']] + $body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Packaged location: web/api/index.php. PHP application code stays outside web/.
    require dirname(__DIR__, 2) . '/app/bootstrap.php';
    $config = Labos\configuration(); $pdo = Labos\database($config);
    if ((int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = TRUE")->fetchColumn() === 0) Labos\fail(503, 'not_initialized', 'Administrator treba dovršiti privatnu instalaciju.');
    Labos\startSession($config);
    $action = $_GET['action'] ?? 'session'; $method = $_SERVER['REQUEST_METHOD'] ?? '';
    $routes = ['session' => 'GET', 'login' => 'POST', 'logout' => 'POST', 'password' => 'POST', 'users' => 'GET', 'user' => 'GET', 'create-user' => 'POST', 'reset-password' => 'POST', 'update-user' => 'POST',
        'classes' => 'GET', 'class' => 'GET', 'create-class' => 'POST', 'membership' => 'POST', 'preview-students' => 'POST', 'import-students' => 'POST',
        'create-invite' => 'POST', 'revoke-invites' => 'POST', 'register' => 'POST', 'join-class' => 'POST', 'review-join' => 'POST', 'my-requests' => 'GET',
        'catalog' => 'GET', 'task-versions' => 'GET', 'publish-task' => 'POST', 'assignments' => 'GET', 'assignment' => 'GET', 'create-assignment' => 'POST', 'assignment-availability' => 'POST', 'begin-attempt' => 'POST', 'save-work' => 'POST', 'attempt' => 'GET', 'attempt-revisions' => 'GET', 'class-work' => 'GET'];
    $routes['compiler-capabilities']='GET'; $routes['compile']='POST'; $routes['compile-status']='GET'; $routes['cancel-compile']='POST';
    $routes['finish-attempt'] = 'POST';
    $routes['reopen-attempt'] = 'POST';
    $routes['attempt-history'] = 'GET';
    $routes['request-grade'] = 'POST';
    $routes['grading'] = 'GET';
    $routes['achievements'] = 'GET';
    $routes['export-achievements'] = 'GET';
    $routes['work-feedback'] = 'GET';
    $routes['review-work'] = 'POST';
    $routes['select-assessment'] = 'POST';
    $routes['archive-year'] = 'POST';
    if (!is_string($action) || !isset($routes[$action])) Labos\fail(404, 'route_missing', 'Ta funkcija nije dostupna.');
    if ($routes[$action] !== $method) { header('Allow: ' . $routes[$action]); Labos\fail(405, 'method', 'Metoda zahtjeva nije dopuštena.'); }
    $body = [];
    if ($method === 'POST') {
        Labos\csrf($config);
        if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') Labos\fail(415, 'content_type', 'Pošalji JSON zahtjev.');
        $limit = in_array($action, ['preview-students', 'import-students'], true) ? 65536 : (in_array($action, ['save-work','compile'], true) ? 3200000 : ($action === 'publish-task' ? 24576 : ($action === 'review-work' ? 16384 : 8192)));
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) Labos\fail(413, 'body_size', 'Zahtjev je prevelik.');
        $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
        if (strlen($raw) > $limit) Labos\fail(413, 'body_size', 'Zahtjev je prevelik.');
        try { $value = json_decode($raw, false, in_array($action, ['save-work','compile'], true) ? 64 : 16, JSON_THROW_ON_ERROR); }
        catch (JsonException $error) { Labos\fail(400, 'json', 'JSON zahtjev nije ispravan.'); }
        if (!is_object($value)) Labos\fail(400, 'json', 'Zahtjev mora biti JSON objekt.');
        $body = (array)$value;
    }
    if ($action === 'session') respond(200, ['user' => ($user = Labos\currentUser($pdo, false)) ? Labos\publicUser($user) : null, 'features' => ['accounts' => true, 'classes' => true, 'assignments' => true, 'centralStorage' => true, 'officialGrading' => true, 'submissions' => true, 'reports' => true]]);
    if ($action === 'login') respond(200, ['user' => Labos\login($pdo, $config, $body)]);
    if ($action === 'logout') {
        $user = Labos\currentUser($pdo, false);
        if ($user) Labos\audit($pdo, (int)$user['id'], (int)$user['id'], 'session.logout');
        $_SESSION = []; session_destroy();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $config['app']['cookie_path'], 'secure' => $config['app']['secure'], 'httponly' => true, 'samesite' => 'Strict']);
        respond(200, ['user' => null]);
    }
    if ($action === 'password') respond(200, ['user' => Labos\changePassword($pdo, $body)]);
    if ($action === 'register') {
        if (Labos\currentUser($pdo, false)) Labos\fail(409, 'already_signed_in', 'Već si prijavljen/a. Za pridruživanje koristi svoj račun.');
        respond(201, ['request' => Labos\requestClass($pdo, $config, null, $body)]);
    }
    $actor = Labos\readyUser($pdo);
    if ($action === 'compiler-capabilities') respond(200, Labos\compilerCapabilities($pdo,$config,$actor));
    if ($action === 'compile') respond(200, ['job'=>Labos\requestCompile($pdo,$config,$actor,$body)]);
    if ($action === 'compile-status') respond(200, ['job'=>Labos\readCompile($pdo,$actor,$_GET['id']??null)]);
    if ($action === 'cancel-compile') respond(200, ['job'=>Labos\cancelCompile($pdo,$actor,$body['id']??null)]);
    if ($action === 'achievements') respond(200, Labos\transaction($pdo, fn() => Labos\achievementReport($pdo,$actor,$_GET)));
    if ($action === 'export-achievements') respond(200, Labos\transaction($pdo, fn() => Labos\exportAchievements($pdo,$actor,$_GET)));
    if ($action === 'work-feedback') respond(200, Labos\workFeedback($pdo,$actor,$_GET['id']??null,$_GET['revision']??null,$_GET['before']??null));
    if ($action === 'review-work') respond(200, Labos\addWorkReview($pdo,$actor,$body));
    if ($action === 'select-assessment') respond(200, Labos\selectAssessment($pdo,$actor,$body));
    if ($action === 'archive-year') respond(200, Labos\archiveYear($pdo,$actor,$body));
    if ($action === 'users') respond(200, ['users' => Labos\listUsers($pdo, $actor)]);
    if ($action === 'user') respond(200, ['user' => Labos\readUser($pdo, $actor, $_GET['id'] ?? null)]);
    if ($action === 'create-user') respond(201, ['user' => Labos\createUser($pdo, $actor, $body)]);
    if ($action === 'reset-password') { Labos\resetPassword($pdo, $actor, $body); respond(200, ['message' => 'Privremena lozinka je postavljena. Prethodne sesije tog korisnika više ne vrijede.']); }
    if ($action === 'update-user') respond(200, ['user' => Labos\updateUser($pdo, $actor, $body)]);
    if ($action === 'classes') respond(200, ['classes' => Labos\listClasses($pdo, $actor)]);
    if ($action === 'class') respond(200, ['class' => Labos\classDetail($pdo, $actor, $_GET['id'] ?? null)]);
    if ($action === 'create-class') respond(201, ['class' => Labos\createClass($pdo, $actor, $body)]);
    if ($action === 'membership') { Labos\changeMembership($pdo, $actor, $body); respond(200, ['message' => 'Članstvo je spremljeno.']); }
    if ($action === 'preview-students') respond(200, Labos\previewStudents($pdo, $config, $actor, $body));
    if ($action === 'import-students') respond(200, Labos\importStudents($pdo, $config, $actor, $body));
    if ($action === 'create-invite') respond(201, ['invite' => Labos\createInvite($pdo, $config, $actor, $body)]);
    if ($action === 'revoke-invites') { Labos\revokeInvites($pdo, $actor, $body); respond(200, ['message' => 'Pozivni kodovi su opozvani.']); }
    if ($action === 'join-class') respond(200, ['request' => Labos\requestClass($pdo, $config, $actor, $body)]);
    if ($action === 'review-join') { Labos\reviewJoin($pdo, $actor, $body); respond(200, ['message' => 'Zahtjev učenika je obrađen.']); }
    if ($action === 'my-requests') respond(200, ['requests' => Labos\myJoinRequests($pdo, $actor)]);
    if ($action === 'catalog') respond(200, ['catalog' => Labos\publicCatalog($actor)]);
    if ($action === 'task-versions') respond(200, ['versions' => Labos\listTaskVersions($pdo, $actor)]);
    if ($action === 'publish-task') respond(201, ['task' => Labos\publishTask($pdo, $actor, $body)]);
    if ($action === 'assignments') respond(200, ['assignments' => Labos\listAssignments($pdo, $actor, $_GET['classId'] ?? null)]);
    if ($action === 'assignment') respond(200, ['assignment' => Labos\readAssignment($pdo, $actor, $_GET['id'] ?? null, true), 'user' => Labos\publicUser($actor)]);
    if ($action === 'create-assignment') respond(201, ['assignment' => Labos\createAssignment($pdo, $actor, $body)]);
    if ($action === 'assignment-availability') { Labos\setAssignmentAvailability($pdo, $actor, $body); respond(200, ['message' => 'Dostupnost vježbe je spremljena.']); }
    if ($action === 'begin-attempt') respond(200, Labos\beginAttempt($pdo, $actor, $body));
    if ($action === 'save-work') respond(200, ['saved' => Labos\saveAttempt($pdo, $actor, $body)]);
    if ($action === 'finish-attempt') respond(200, Labos\finishAttempt($pdo, $actor, $body));
    if ($action === 'reopen-attempt') respond(200, Labos\reopenAttempt($pdo, $actor, $body));
    if ($action === 'attempt-history') respond(200, Labos\attemptHistory($pdo, $actor, $_GET['id'] ?? null, $_GET['before'] ?? null));
    if ($action === 'attempt') respond(200, Labos\readAttempt($pdo, $actor, $_GET['id'] ?? null, $_GET['revision'] ?? null));
    if ($action === 'attempt-revisions') respond(200, Labos\attemptRevisions($pdo, $actor, $_GET['id'] ?? null, $_GET['before'] ?? null));
    if ($action === 'class-work') respond(200, Labos\classWork($pdo, $actor, $_GET['assignmentId'] ?? null, $_GET['after'] ?? null));
    if ($action === 'request-grade') respond(200, ['grading' => Labos\requestGrading($pdo, $actor, $body)]);
    if ($action === 'grading') {
        $attempt = Labos\accessibleAttempt($pdo,$actor,$_GET['id']??null);
        $revision = isset($_GET['revision']) ? Labos\targetId($_GET['revision']) : (int)$attempt['current_revision'];
        if (!Labos\query($pdo,'SELECT 1 FROM work_snapshots WHERE attempt_id=? AND revision=?',[$attempt['id'],$revision])->fetchColumn()) Labos\fail(404,'revision_missing','Ta snimka ne postoji.');
        respond(200,['grading'=>Labos\snapshotGrading($pdo,(int)$attempt['id'],$revision)]);
    }
} catch (Labos\ApiError $error) {
    if ($error->status === 429) header('Retry-After: 900');
    respond($error->status, ['error' => ['code' => $error->errorCode, 'message' => $error->getMessage()]]);
} catch (Throwable $error) {
    // Do not serialize PDO exceptions, configuration paths, request bodies or credentials.
    error_log('Labosv2 school API: request failed (' . get_class($error) . ').');
    respond(503, ['error' => ['code' => 'service_unavailable', 'message' => 'Školski servis trenutačno nije dostupan. Pokušaj ponovno ili obavijesti administratora.']]);
}
