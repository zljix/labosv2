<?php
declare(strict_types=1);

// Copy outside the web root. Supply the password through the server environment.
return [
    'database' => [
        'dsn' => 'mysql:host=127.0.0.1;port=3306;dbname=labosv2;charset=utf8mb4',
        'user' => 'labosv2_app',
        'password' => getenv('LAB_DB_PASSWORD') ?: '',
    ],
    'timezone' => 'Europe/Zagreb',
];
