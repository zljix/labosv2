CREATE TABLE IF NOT EXISTS school_year_archives (
    school_year VARCHAR(20) NOT NULL PRIMARY KEY,
    archived BOOLEAN NOT NULL DEFAULT TRUE,
    reason VARCHAR(1000) NOT NULL,
    changed_by BIGINT UNSIGNED NOT NULL,
    changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    attempt_id BIGINT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL,
    action ENUM('comment','correct','restore') NOT NULL,
    points DECIMAL(8,2) NULL,
    max_points INT UNSIGNED NULL,
    reason VARCHAR(2000) NOT NULL,
    original_grading JSON NOT NULL,
    previous_review_id BIGINT UNSIGNED NULL,
    author_id BIGINT UNSIGNED NOT NULL,
    request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY review_request (author_id, request_key),
    INDEX snapshot_reviews (attempt_id, revision, id),
    FOREIGN KEY (attempt_id, revision) REFERENCES work_snapshots(attempt_id, revision),
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (previous_review_id) REFERENCES work_reviews(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_selections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    assignment_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    submission_id BIGINT UNSIGNED NULL,
    reason VARCHAR(1000) NOT NULL,
    selected_by BIGINT UNSIGNED NOT NULL,
    request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    selected_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY selection_request (selected_by, request_key),
    INDEX latest_selection (assignment_id, student_id, id),
    FOREIGN KEY (assignment_id) REFERENCES class_assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (submission_id) REFERENCES school_submissions(id),
    FOREIGN KEY (selected_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
