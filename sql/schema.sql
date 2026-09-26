-- モブナガ MySQL 初期スキーマ
-- MySQL 8.x / MariaDB 10.5+
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+09:00';

CREATE TABLE IF NOT EXISTS source_pages (
  id VARCHAR(64) NOT NULL,
  source_url TEXT NOT NULL,
  local_path VARCHAR(512) NOT NULL DEFAULT '',
  sha256 CHAR(64) NOT NULL,
  fetched_at VARCHAR(64) NOT NULL,
  source_updated VARCHAR(255) NULL,
  title VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_source_pages_sha256 (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tactics (
  id VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  `rank` VARCHAR(64) NULL,
  category VARCHAR(128) NULL,
  activation_rate VARCHAR(128) NULL,
  effect TEXT NULL,
  first_season VARCHAR(32) NULL,
  applicable_troop VARCHAR(255) NULL,
  acquisition TEXT NULL,
  source_id VARCHAR(64) NULL,
  activation_probability DECIMAL(8,5) NULL,
  preparation_turns TINYINT UNSIGNED NOT NULL DEFAULT 0,
  damage_rate DECIMAL(12,4) NULL,
  damage_expected DECIMAL(12,4) NULL,
  damage_upper DECIMAL(12,4) NULL,
  damage_lower DECIMAL(12,4) NULL,
  heal_rate DECIMAL(12,4) NULL,
  heal_expected DECIMAL(12,4) NULL,
  heal_upper DECIMAL(12,4) NULL,
  heal_lower DECIMAL(12,4) NULL,
  lifesteal_rate DECIMAL(12,4) NULL,
  heal_is_estimate TINYINT(1) NOT NULL DEFAULT 0,
  flag_damage TINYINT(1) NULL,
  flag_heal TINYINT(1) NULL,
  flag_buff TINYINT(1) NULL,
  flag_debuff TINYINT(1) NULL,
  flag_control TINYINT(1) NULL,
  flag_special TINYINT(1) NULL,
  metric_note VARCHAR(255) NULL,
  metric_updated_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tactics_name (name), KEY idx_tactics_category (category), KEY idx_tactics_source (source_id), KEY idx_tactics_expected (damage_expected),
  CONSTRAINT fk_tactics_source FOREIGN KEY (source_id) REFERENCES source_pages(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS generals (
  id VARCHAR(120) NOT NULL, name VARCHAR(255) NOT NULL, kana VARCHAR(255) NULL,
  rarity TINYINT UNSIGNED NULL, faction VARCHAR(64) NULL, family VARCHAR(128) NULL,
  cost DECIMAL(5,2) NULL, gender VARCHAR(32) NULL, current_tier VARCHAR(32) NULL,
  portrait VARCHAR(512) NULL, source_id VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_generals_name (name), KEY idx_generals_faction (faction), KEY idx_generals_source (source_id),
  CONSTRAINT fk_generals_source FOREIGN KEY (source_id) REFERENCES source_pages(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS general_stats (
  general_id VARCHAR(120) NOT NULL, attribute_name VARCHAR(32) NOT NULL,
  level1 DECIMAL(10,3) NULL, growth DECIMAL(10,4) NULL, level50 DECIMAL(10,3) NULL,
  PRIMARY KEY (general_id, attribute_name),
  CONSTRAINT fk_general_stats_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS general_troops (
  general_id VARCHAR(120) NOT NULL, troop VARCHAR(64) NOT NULL, bonus DECIMAL(8,3) NULL, cap_bonus DECIMAL(8,3) NULL,
  PRIMARY KEY (general_id, troop),
  CONSTRAINT fk_general_troops_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS general_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, general_id VARCHAR(120) NOT NULL, tag VARCHAR(128) NOT NULL, kind VARCHAR(64) NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_general_tags (general_id, tag, kind),
  CONSTRAINT fk_general_tags_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS general_traits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, general_id VARCHAR(120) NOT NULL,
  position_no SMALLINT UNSIGNED NOT NULL DEFAULT 0, unlock_level VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL, category VARCHAR(128) NULL, grade VARCHAR(64) NULL,
  target_text VARCHAR(255) NULL, effect TEXT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_general_traits_position (general_id, position_no),
  CONSTRAINT fk_general_traits_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS general_tiers (
  general_id VARCHAR(120) NOT NULL, season VARCHAR(32) NOT NULL, tier VARCHAR(32) NOT NULL,
  PRIMARY KEY (general_id, season), KEY idx_general_tiers_season (season, tier),
  CONSTRAINT fk_general_tiers_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS general_unique_tactics (
  general_id VARCHAR(120) NOT NULL, name VARCHAR(255) NOT NULL, category VARCHAR(128) NULL, effect TEXT NULL,
  PRIMARY KEY (general_id),
  CONSTRAINT fk_general_unique_tactics_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS general_detail_images (
  general_id VARCHAR(120) NOT NULL, image_path VARCHAR(512) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (general_id),
  CONSTRAINT fk_general_detail_images_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formation_sources (
  id VARCHAR(64) NOT NULL, season TINYINT UNSIGNED NULL, source_url TEXT NOT NULL,
  title VARCHAR(512) NULL, sha256 CHAR(64) NOT NULL, fetched_at VARCHAR(64) NOT NULL,
  local_path VARCHAR(512) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_formation_sources_sha256 (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formations (
  id VARCHAR(120) NOT NULL, source_id VARCHAR(64) NULL, source_index INT UNSIGNED NULL,
  season TINYINT UNSIGNED NOT NULL, name VARCHAR(255) NOT NULL, tier VARCHAR(64) NULL,
  faction VARCHAR(128) NULL, troops VARCHAR(64) NULL, requirement TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_formations_season_tier (season, tier), KEY idx_formations_faction (faction), KEY idx_formations_source (source_id),
  CONSTRAINT fk_formations_source FOREIGN KEY (source_id) REFERENCES formation_sources(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formation_members (
  formation_id VARCHAR(120) NOT NULL, slot_no TINYINT UNSIGNED NOT NULL, role VARCHAR(32) NULL,
  general_id VARCHAR(120) NULL, general_name VARCHAR(255) NOT NULL, attribute_plan VARCHAR(255) NULL,
  equipment VARCHAR(255) NULL, main_school VARCHAR(255) NULL, sub_school VARCHAR(255) NULL,
  PRIMARY KEY (formation_id, slot_no), KEY idx_formation_members_general (general_id),
  CONSTRAINT fk_formation_members_formation FOREIGN KEY (formation_id) REFERENCES formations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_formation_members_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formation_member_tactics (
  formation_id VARCHAR(120) NOT NULL, member_slot TINYINT UNSIGNED NOT NULL,
  tactic_slot TINYINT UNSIGNED NOT NULL, tactic_id VARCHAR(120) NULL, tactic_name VARCHAR(255) NOT NULL,
  PRIMARY KEY (formation_id, member_slot, tactic_slot), KEY idx_formation_member_tactics_tactic (tactic_id),
  CONSTRAINT fk_formation_member_tactics_member FOREIGN KEY (formation_id, member_slot) REFERENCES formation_members(formation_id, slot_no) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_formation_member_tactics_tactic FOREIGN KEY (tactic_id) REFERENCES tactics(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formation_analyses (
  formation_id VARCHAR(120) NOT NULL, base_danger_deviation DECIMAL(8,3) NULL,
  summary TEXT NULL, movement TEXT NULL, warning_text TEXT NULL, meta_text TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (formation_id),
  CONSTRAINT fk_formation_analyses_formation FOREIGN KEY (formation_id) REFERENCES formations(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formation_limit_break_scores (
  formation_id VARCHAR(120) NOT NULL, limit_break TINYINT UNSIGNED NOT NULL,
  danger_deviation DECIMAL(8,3) NULL, meta_grade VARCHAR(16) NULL,
  PRIMARY KEY (formation_id, limit_break),
  CONSTRAINT fk_formation_limit_break_scores_formation FOREIGN KEY (formation_id) REFERENCES formations(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formation_required_limit_breaks (
  formation_id VARCHAR(120) NOT NULL, general_id VARCHAR(120) NOT NULL,
  required_limit_break TINYINT UNSIGNED NULL, evidence TEXT NULL,
  PRIMARY KEY (formation_id, general_id),
  CONSTRAINT fk_formation_required_limit_breaks_formation FOREIGN KEY (formation_id) REFERENCES formations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_formation_required_limit_breaks_general FOREIGN KEY (general_id) REFERENCES generals(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formation_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  formation_key VARCHAR(120) NOT NULL,
  report_type ENUM('win_with','counter_win') NOT NULL DEFAULT 'win_with',
  result_type ENUM('win','loss','draw') NOT NULL DEFAULT 'win',
  poster_name VARCHAR(80) NOT NULL DEFAULT '匿名', comment_text TEXT NOT NULL,
  opponent_text VARCHAR(255) NOT NULL DEFAULT '', image_mime VARCHAR(32) NOT NULL,
  image_size INT UNSIGNED NOT NULL, image_data MEDIUMBLOB NOT NULL, ip_hash CHAR(64) NOT NULL,
  status ENUM('published','hidden','deleted') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_formation_reports_public (formation_key,status,id),
  KEY idx_formation_reports_rate_limit (ip_hash,created_at), KEY idx_formation_reports_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_submissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, form_key VARCHAR(120) NOT NULL,
  payload_json JSON NOT NULL, submitter_name VARCHAR(120) NULL, submitter_email VARCHAR(255) NULL,
  source_path VARCHAR(255) NULL, ip_hash CHAR(64) NULL, user_agent_hash CHAR(64) NULL,
  status ENUM('new','reviewed','archived','spam','deleted') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_form_submissions_form (form_key,status,created_at),
  KEY idx_form_submissions_created (created_at), KEY idx_form_submissions_ip (ip_hash,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_submission_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, submission_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL, mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL, file_data MEDIUMBLOB NOT NULL, sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id), KEY idx_form_submission_files_submission (submission_id), KEY idx_form_submission_files_sha256 (sha256),
  CONSTRAINT fk_form_submission_files_submission FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_versions (
  version VARCHAR(64) NOT NULL, description VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_versions (version,description)
VALUES ('2026-09-23-full-catalog','Mobunaga full catalog schema')
ON DUPLICATE KEY UPDATE description=VALUES(description);
