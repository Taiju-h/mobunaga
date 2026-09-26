-- モブナガ基幹カタログ再構築用
-- 戦報投稿・FORM投稿は残し、武将/戦法/編成/分析だけ作り直す。
SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS formation_required_limit_breaks;
DROP TABLE IF EXISTS formation_limit_break_scores;
DROP TABLE IF EXISTS formation_analyses;
DROP TABLE IF EXISTS formation_member_tactics;
DROP TABLE IF EXISTS formation_members;
DROP TABLE IF EXISTS formations;
DROP TABLE IF EXISTS formation_sources;

DROP TABLE IF EXISTS general_detail_images;
DROP TABLE IF EXISTS general_unique_tactics;
DROP TABLE IF EXISTS general_tiers;
DROP TABLE IF EXISTS general_traits;
DROP TABLE IF EXISTS general_tags;
DROP TABLE IF EXISTS general_troops;
DROP TABLE IF EXISTS general_stats;
DROP TABLE IF EXISTS generals;

DROP TABLE IF EXISTS tactics;
DROP TABLE IF EXISTS source_pages;
DROP TABLE IF EXISTS schema_versions;

SET FOREIGN_KEY_CHECKS=1;
