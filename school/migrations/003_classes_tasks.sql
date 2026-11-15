CREATE TABLE IF NOT EXISTS class_invites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    class_id BIGINT UNSIGNED NOT NULL,
    code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    expires_at DATETIME(6) NOT NULL,
    max_uses INT UNSIGNED NOT NULL,
    used_count INT UNSIGNED NOT NULL DEFAULT 0,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX invite_class (class_id),
    FOREIGN KEY (class_id) REFERENCES school_classes(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_join_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    class_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    invite_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_by BIGINT UNSIGNED NULL,
    reviewed_at DATETIME(6) NULL,
    UNIQUE KEY request_student (class_id, student_id),
    FOREIGN KEY (class_id) REFERENCES school_classes(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (invite_id) REFERENCES class_invites(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS school_tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    last_version INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS task_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    definition JSON NOT NULL,
    rubric JSON NOT NULL,
    starters JSON NOT NULL,
    content_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    published_by BIGINT UNSIGNED NOT NULL,
    published_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY task_revision (task_id, version),
    FOREIGN KEY (task_id) REFERENCES school_tasks(id),
    FOREIGN KEY (published_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    class_id BIGINT UNSIGNED NOT NULL,
    task_version_id BIGINT UNSIGNED NOT NULL,
    target ENUM('micropython', 's3-cpp', 'uno', 'nano') NOT NULL,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    due_at DATETIME(6) NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX assignments_class (class_id, available, id),
    FOREIGN KEY (class_id) REFERENCES school_classes(id),
    FOREIGN KEY (task_version_id) REFERENCES task_versions(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
