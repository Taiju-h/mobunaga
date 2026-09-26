-- モブナガ 戦法詳細効果DB
-- MySQL 8.x / MariaDB 10.5+
-- 目的: ダメージ/回復/離反/心攻を数値化し、状態異常をフラグ+確率で検索可能にする

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE tactics
  ADD COLUMN damage_rate_min DECIMAL(10,3) NULL AFTER damage_rate,
  ADD COLUMN damage_rate_max DECIMAL(10,3) NULL AFTER damage_rate_min,
  ADD COLUMN heal_rate_min DECIMAL(10,3) NULL AFTER heal_rate,
  ADD COLUMN heal_rate_max DECIMAL(10,3) NULL AFTER heal_rate_min,
  ADD COLUMN mind_attack_rate DECIMAL(10,3) NULL AFTER lifesteal_rate,
  ADD COLUMN flag_lifesteal TINYINT(1) NULL AFTER flag_special,
  ADD COLUMN flag_mind_attack TINYINT(1) NULL AFTER flag_lifesteal;

CREATE TABLE IF NOT EXISTS tactic_status_effects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tactic_id VARCHAR(120) NOT NULL,
  status_code VARCHAR(64) NOT NULL,
  status_name VARCHAR(64) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  probability_pct DECIMAL(7,3) NULL,
  duration_turns DECIMAL(6,2) NULL,
  target_scope VARCHAR(64) NULL,
  target_count TINYINT UNSIGNED NULL,
  trigger_condition VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tactic_status (tactic_id,status_code),
  KEY idx_status_search (status_code,enabled,probability_pct),
  KEY idx_status_tactic (tactic_id,enabled),
  CONSTRAINT fk_tactic_status_tactic FOREIGN KEY (tactic_id) REFERENCES tactics(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tactic_effect_details (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tactic_id VARCHAR(120) NOT NULL,
  effect_code VARCHAR(64) NOT NULL,
  effect_name VARCHAR(64) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  probability_pct DECIMAL(7,3) NULL,
  rate_min_pct DECIMAL(10,3) NULL,
  rate_max_pct DECIMAL(10,3) NULL,
  flat_value_min DECIMAL(12,3) NULL,
  flat_value_max DECIMAL(12,3) NULL,
  duration_turns DECIMAL(6,2) NULL,
  target_scope VARCHAR(64) NULL,
  target_count TINYINT UNSIGNED NULL,
  stat_basis VARCHAR(64) NULL,
  trigger_condition VARCHAR(255) NULL,
  notes VARCHAR(500) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_effect_search (effect_code,enabled,probability_pct),
  KEY idx_effect_tactic (tactic_id,enabled),
  CONSTRAINT fk_tactic_effect_detail_tactic FOREIGN KEY (tactic_id) REFERENCES tactics(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_versions (version,description)
VALUES ('2026-09-23-tactic-effect-details','Detailed tactic numeric effects and searchable status effects')
ON DUPLICATE KEY UPDATE description=VALUES(description);
