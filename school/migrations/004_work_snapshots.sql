CREATE TABLE IF NOT EXISTS school_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    assignment_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    attempt_number INT UNSIGNED NOT NULL DEFAULT 1,
    status ENUM('in_progress', 'locked') NOT NULL DEFAULT 'in_progress',
    current_revision INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY student_assignment_attempt (assignment_id, student_id, attempt_number),
    INDEX student_attempts (student_id, assignment_id),
    FOREIGN KEY (assignment_id) REFERENCES class_assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_snapshots (
    attempt_id BIGINT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL,
    base_revision INT UNSIGNED NOT NULL,
    request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    project JSON NOT NULL,
    content_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (attempt_id, revision),
    UNIQUE KEY snapshot_request (attempt_id, request_key),
    FOREIGN KEY (attempt_id) REFERENCES school_attempts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
