-- Enemy archive watch flags + moderated comments
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enemy_watch_flags (
  entity_type ENUM('formation','opponent') NOT NULL,
  entity_key VARCHAR(190) NOT NULL,
  watch_flag TINYINT(1) NOT NULL DEFAULT 1,
  note VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type, entity_key),
  KEY idx_enemy_watch (watch_flag, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_type ENUM('general','formation','tactic') NOT NULL,
  entity_id VARCHAR(190) NOT NULL,
  poster_name VARCHAR(80) NOT NULL DEFAULT '匿名',
  comment_text TEXT NOT NULL,
  status ENUM('pending','approved','rejected','deleted') NOT NULL DEFAULT 'pending',
  ip_hash CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_content_comments_entity (entity_type, entity_id, status, id),
  KEY idx_content_comments_pending (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_versions (version,description)
VALUES ('2026-09-23-archive-flags-comments','Enemy watch flags and moderated comments')
ON DUPLICATE KEY UPDATE description=VALUES(description);