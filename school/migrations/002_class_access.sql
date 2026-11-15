CREATE TABLE IF NOT EXISTS school_classes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    school_year VARCHAR(20) NOT NULL,
    UNIQUE KEY class_year_name (school_year, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_students (
    class_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (class_id, student_id),
    CONSTRAINT class_student_class_fk FOREIGN KEY (class_id) REFERENCES school_classes(id),
    CONSTRAINT class_student_user_fk FOREIGN KEY (student_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_teachers (
    class_id BIGINT UNSIGNED NOT NULL,
    teacher_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (class_id, teacher_id),
    CONSTRAINT class_teacher_class_fk FOREIGN KEY (class_id) REFERENCES school_classes(id),
    CONSTRAINT class_teacher_user_fk FOREIGN KEY (teacher_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
