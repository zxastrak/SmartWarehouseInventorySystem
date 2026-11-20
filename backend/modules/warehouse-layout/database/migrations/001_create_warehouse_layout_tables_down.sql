-- ============================================================================
-- MIGRATION DOWN: ROLLBACK WAREHOUSE LAYOUT & STORAGE MAPPING
-- Drops all layout tables and triggers in reverse dependency order
-- ============================================================================

-- 1. Drop Triggers
DROP TRIGGER IF EXISTS `trg_check_last_issued_pos_update`;
DROP TRIGGER IF EXISTS `trg_check_primary_aisle_update`;
DROP TRIGGER IF EXISTS `trg_check_primary_aisle_insert`;
DROP TRIGGER IF EXISTS `trg_prevent_location_code_update`;
DROP TRIGGER IF EXISTS `trg_prevent_rack_code_update`;

-- 2. Drop Tables in Reverse Dependency Order
DROP TABLE IF EXISTS `layout_objects`;
DROP TABLE IF EXISTS `storage_locations`;
DROP TABLE IF EXISTS `rack_bay_level_configs`;
DROP TABLE IF EXISTS `rack_aisle_access`;
DROP TABLE IF EXISTS `rack_bays`;
DROP TABLE IF EXISTS `rack_levels`;
DROP TABLE IF EXISTS `racks`;
DROP TABLE IF EXISTS `aisles`;
DROP TABLE IF EXISTS `zones`;
DROP TABLE IF EXISTS `code_registry`;
DROP TABLE IF EXISTS `warehouses`;
