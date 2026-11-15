CREATE TABLE IF NOT EXISTS school_submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    attempt_id BIGINT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL,
    request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    task_version_id BIGINT UNSIGNED NOT NULL,
    rubric_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    submitted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY one_submission_per_attempt (attempt_id),
    FOREIGN KEY (attempt_id, revision) REFERENCES work_snapshots(attempt_id, revision),
    FOREIGN KEY (task_version_id) REFERENCES task_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attempt_reopenings (
    from_submission_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    new_attempt_id BIGINT UNSIGNED NOT NULL,
    request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    opened_by BIGINT UNSIGNED NOT NULL,
    opened_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY one_parent_per_attempt (new_attempt_id),
    FOREIGN KEY (from_submission_id) REFERENCES school_submissions(id),
    FOREIGN KEY (new_attempt_id) REFERENCES school_attempts(id),
    FOREIGN KEY (opened_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
