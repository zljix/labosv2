CREATE TABLE IF NOT EXISTS compiler_service (
    id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
    heartbeat DATETIME(6) NULL,
    targets JSON NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO compiler_service (id, targets) VALUES (1, JSON_OBJECT());
CREATE TABLE IF NOT EXISTS compile_jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    attempt_id BIGINT UNSIGNED NULL,
    request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    input_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    project JSON NULL,
    target VARCHAR(80) CHARACTER SET ascii NOT NULL,
    node_id VARCHAR(80) CHARACTER SET ascii NOT NULL,
    node_slot ENUM('A','B') NOT NULL,
    status ENUM('queued','running','compiled','compile_error','technical_error','cancelled','expired') NOT NULL DEFAULT 'queued',
    lease_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    lease_until DATETIME(6) NULL,
    result MEDIUMTEXT NULL,
    CONSTRAINT compile_result_json CHECK (result IS NULL OR JSON_VALID(result)),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    UNIQUE KEY compile_request (user_id,request_key),
    INDEX compile_queue (status,id),
    INDEX compile_owner (user_id,created_at),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (attempt_id) REFERENCES school_attempts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
