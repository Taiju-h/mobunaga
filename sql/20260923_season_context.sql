-- Mobunaga global season context + spoiler-safe comments
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seasons (
  season_no TINYINT UNSIGNED NOT NULL,
  code VARCHAR(16) NOT NULL,
  label VARCHAR(64) NOT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (season_no),
  UNIQUE KEY uq_seasons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Current source data already contains S1-S4. Keep explicit rows and also absorb future imported seasons below.
INSERT INTO seasons (season_no,code,label) VALUES
  (1,'S1','シーズン1'),
  (2,'S2','シーズン2'),
  (3,'S3','シーズン3'),
  (4,'S4','シーズン4')
ON DUPLICATE KEY UPDATE code=VALUES(code),label=VALUES(label);

INSERT IGNORE INTO seasons (season_no,code,label)
SELECT DISTINCT CAST(REPLACE(season,'S','') AS UNSIGNED), season, CONCAT('シーズン',CAST(REPLACE(season,'S','') AS UNSIGNED))
FROM general_tiers
WHERE season REGEXP '^S[0-9]+$';

INSERT IGNORE INTO seasons (season_no,code,label)
SELECT DISTINCT season, CONCAT('S',season), CONCAT('シーズン',season)
FROM formations
WHERE season BETWEEN 1 AND 99;

INSERT IGNORE INTO seasons (season_no,code,label)
SELECT DISTINCT CAST(REPLACE(first_season,'S','') AS UNSIGNED), first_season, CONCAT('シーズン',CAST(REPLACE(first_season,'S','') AS UNSIGNED))
FROM tactics
WHERE first_season REGEXP '^S[0-9]+$';

-- Fresh installs can create the comments table here. Existing installs are upgraded below.
CREATE TABLE IF NOT EXISTS content_comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_type ENUM('general','formation','tactic') NOT NULL,
  entity_id VARCHAR(190) NOT NULL,
  season_no TINYINT UNSIGNED NOT NULL DEFAULT 1,
  poster_name VARCHAR(80) NOT NULL DEFAULT '匿名',
  comment_text TEXT NOT NULL,
  status ENUM('pending','approved','rejected','deleted') NOT NULL DEFAULT 'pending',
  ip_hash CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_content_comments_entity (entity_type, entity_id, status, id),
  KEY idx_content_comments_pending (status, created_at),
  KEY idx_content_comments_season (season_no, entity_type, entity_id, status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Upgrade an older comments table without failing when the migration is re-run.
SET @has_season_no := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='content_comments' AND COLUMN_NAME='season_no'
);
SET @sql := IF(
  @has_season_no = 0,
  'ALTER TABLE content_comments ADD COLUMN season_no TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER entity_id, ADD KEY idx_content_comments_season (season_no, entity_type, entity_id, status, id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Legacy comments predate season selection; treat them as S1 so they can never reveal a later season.
UPDATE content_comments SET season_no=1 WHERE season_no IS NULL OR season_no<1;

INSERT INTO schema_versions (version,description)
VALUES ('2026-09-23-season-context','Global season catalog and spoiler-safe season-aware comments')
ON DUPLICATE KEY UPDATE description=VALUES(description);
