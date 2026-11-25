CREATE TABLE IF NOT EXISTS collection_documents (
    submission_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    filename VARCHAR(200) NOT NULL,
    sha256 CHAR(64) CHARACTER SET ascii NOT NULL,
    byte_count INT UNSIGNED NOT NULL,
    document MEDIUMBLOB NOT NULL,
    FOREIGN KEY (submission_id) REFERENCES school_submissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
