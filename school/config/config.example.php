<?php
declare(strict_types=1);

// Copy outside the web root. Supply the password through the server environment.
return [
    'database' => [
        'dsn' => 'mysql:host=127.0.0.1;port=3306;dbname=labosv2;charset=utf8mb4',
        'user' => 'labosv2_app',
        'password' => getenv('LAB_DB_PASSWORD') ?: '',
    ],
    // Enable after tools/compiler-worker.mjs --probe reports ready targets.
    'interactive_compile' => ['enabled' => false],
    'timezone' => 'Europe/Zagreb',
    // Pruning is CLI-only and affects archived years. Dry-run is the default.
    'retention' => ['revision_days' => 90, 'keep_latest' => 10],
    'app' => [
        // Full installation URL; a deliberate subpath is allowed.
        'origin' => 'https://labos.skola.example',
        // Generate once: php tools/console.php key. Keep stable and private.
        'key' => getenv('LAB_APP_KEY') ?: '',
        // Create outside web/, writable only by the PHP service account.
        'session_directory' => dirname(__FILE__) . '/sessions',
        // Development only; accepted exclusively from a loopback client.
        'allow_insecure_localhost' => false,
    ],
];
