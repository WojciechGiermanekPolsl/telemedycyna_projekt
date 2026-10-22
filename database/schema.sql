-- Schemat jest wykonywany w bazie wskazanej przez MYSQL_DATABASE.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Europe/Warsaw',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurrence_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    frequency ENUM('day', 'week', 'month', 'year') NOT NULL,
    interval_value SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    ends_at DATETIME NULL,
    occurrence_limit SMALLINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_recurrence_rules_user (user_id),
    CONSTRAINT fk_recurrence_rules_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT chk_recurrence_interval
        CHECK (interval_value > 0),
    CONSTRAINT chk_recurrence_limit
        CHECK (occurrence_limit IS NULL OR occurrence_limit > 0)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    recurrence_rule_id BIGINT UNSIGNED NULL,
    event_type ENUM('control_visit', 'examination') NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    doctor_name VARCHAR(150) NULL,
    facility VARCHAR(200) NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NULL,
    status ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_appointments_calendar (user_id, starts_at),
    KEY idx_appointments_status (user_id, status, starts_at),
    KEY idx_appointments_recurrence (recurrence_rule_id),
    CONSTRAINT fk_appointments_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_appointments_recurrence
        FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules (id)
        ON DELETE SET NULL,
    CONSTRAINT chk_appointments_time
        CHECK (ends_at IS NULL OR ends_at > starts_at)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    appointment_id BIGINT UNSIGNED NOT NULL,
    remind_at DATETIME NOT NULL,
    status ENUM('pending', 'sent', 'read', 'cancelled') NOT NULL DEFAULT 'pending',
    sent_at DATETIME NULL,
    read_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_notifications_appointment_time (appointment_id, remind_at),
    KEY idx_notifications_pending (status, remind_at),
    CONSTRAINT fk_notifications_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointments (id)
        ON DELETE CASCADE,
    CONSTRAINT chk_notifications_sent_at
        CHECK (sent_at IS NULL OR sent_at >= remind_at),
    CONSTRAINT chk_notifications_read_at
        CHECK (read_at IS NULL OR sent_at IS NULL OR read_at >= sent_at)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
