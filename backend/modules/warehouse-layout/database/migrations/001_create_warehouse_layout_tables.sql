-- ============================================================================
-- MIGRATION UP: WAREHOUSE LAYOUT & STORAGE MAPPING (PHASE 1 & 2)
-- Database Engine: MySQL / MariaDB (InnoDB)
-- ============================================================================

-- 1. Warehouses Master Table
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `width_mm` INT(11) NOT NULL,
  `length_mm` INT(11) NOT NULL,
  `height_mm` INT(11) NOT NULL,
  `layout_version` INT(11) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouses_code` (`code`),
  CONSTRAINT `chk_warehouses_dims` CHECK (`width_mm` > 0 AND `length_mm` > 0 AND `height_mm` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Zones Table
CREATE TABLE IF NOT EXISTS `zones` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT(11) NOT NULL,
  `zone_code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `color_hex` VARCHAR(20) NOT NULL DEFAULT '#5c732b',
  `x_mm` INT(11) NOT NULL DEFAULT 0,
  `y_mm` INT(11) NOT NULL DEFAULT 0,
  `width_mm` INT(11) NOT NULL,
  `length_mm` INT(11) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_zones_code` (`warehouse_id`, `zone_code`),
  CONSTRAINT `chk_zones_dims` CHECK (`width_mm` > 0 AND `length_mm` > 0),
  CONSTRAINT `chk_zones_coords` CHECK (`x_mm` >= 0 AND `y_mm` >= 0),
  CONSTRAINT `fk_zones_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Aisles Table
CREATE TABLE IF NOT EXISTS `aisles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT(11) NOT NULL,
  `aisle_code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `x_mm` INT(11) NOT NULL DEFAULT 0,
  `y_mm` INT(11) NOT NULL DEFAULT 0,
  `width_mm` INT(11) NOT NULL,
  `length_mm` INT(11) NOT NULL,
  `direction` VARCHAR(20) NOT NULL DEFAULT 'two_way',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `retired_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_aisles_code` (`warehouse_id`, `aisle_code`),
  CONSTRAINT `chk_aisles_dims` CHECK (`width_mm` > 0 AND `length_mm` > 0),
  CONSTRAINT `chk_aisles_coords` CHECK (`x_mm` >= 0 AND `y_mm` >= 0),
  CONSTRAINT `fk_aisles_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Racks Master Table
CREATE TABLE IF NOT EXISTS `racks` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT(11) NOT NULL,
  `zone_id` INT(11) NULL,
  `rack_code` VARCHAR(50) NOT NULL,
  `x_mm` INT(11) NOT NULL DEFAULT 0,
  `y_mm` INT(11) NOT NULL DEFAULT 0,
  `length_mm` INT(11) NOT NULL,
  `depth_mm` INT(11) NOT NULL,
  `height_mm` INT(11) NOT NULL,
  `rotation` INT(11) NOT NULL DEFAULT 0,
  `color_hex` VARCHAR(20) NULL DEFAULT '#5c732b',
  `max_weight_kg` DECIMAL(12,2) NULL DEFAULT NULL,
  `max_volume_m3` DECIMAL(12,4) NULL DEFAULT NULL,
  `version` INT(11) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `retired_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_racks_code` (`warehouse_id`, `rack_code`),
  INDEX `idx_racks_zone` (`zone_id`),
  CONSTRAINT `chk_racks_dims` CHECK (`length_mm` > 0 AND `depth_mm` > 0 AND `height_mm` > 0),
  CONSTRAINT `chk_racks_coords` CHECK (`x_mm` >= 0 AND `y_mm` >= 0),
  CONSTRAINT `chk_racks_rotation` CHECK (`rotation` IN (0, 90, 180, 270)),
  CONSTRAINT `fk_racks_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_racks_zone` FOREIGN KEY (`zone_id`) REFERENCES `zones` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Rack Aisle Access (Many-to-Many with primary flag)
CREATE TABLE IF NOT EXISTS `rack_aisle_access` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `rack_id` INT(11) NOT NULL,
  `aisle_id` INT(11) NOT NULL,
  `access_side` VARCHAR(10) NOT NULL DEFAULT 'left',
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rack_aisle` (`rack_id`, `aisle_id`),
  CONSTRAINT `chk_access_side` CHECK (`access_side` IN ('left', 'right', 'both')),
  CONSTRAINT `fk_raa_rack` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_raa_aisle` FOREIGN KEY (`aisle_id`) REFERENCES `aisles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Rack Bays
CREATE TABLE IF NOT EXISTS `rack_bays` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `rack_id` INT(11) NOT NULL,
  `bay_number` INT(11) NOT NULL,
  `width_mm` INT(11) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `retired_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rack_bay_num` (`rack_id`, `bay_number`),
  UNIQUE KEY `uq_rack_bay_composite` (`rack_id`, `id`),
  CONSTRAINT `chk_bays_width` CHECK (`width_mm` > 0),
  CONSTRAINT `chk_bays_num` CHECK (`bay_number` > 0),
  CONSTRAINT `fk_bays_rack` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Rack Levels
CREATE TABLE IF NOT EXISTS `rack_levels` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `rack_id` INT(11) NOT NULL,
  `level_number` INT(11) NOT NULL,
  `height_from_floor_mm` INT(11) NOT NULL,
  `max_weight_kg` DECIMAL(12,2) NULL DEFAULT NULL,
  `max_volume_m3` DECIMAL(12,4) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `retired_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rack_level_num` (`rack_id`, `level_number`),
  UNIQUE KEY `uq_rack_level_composite` (`rack_id`, `id`),
  CONSTRAINT `chk_levels_height` CHECK (`height_from_floor_mm` >= 0),
  CONSTRAINT `chk_levels_num` CHECK (`level_number` > 0),
  CONSTRAINT `fk_levels_rack` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Rack Bay-Level Configuration (Position counts & append-first tracking)
CREATE TABLE IF NOT EXISTS `rack_bay_level_configs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `rack_id` INT(11) NOT NULL,
  `bay_id` INT(11) NOT NULL,
  `level_id` INT(11) NOT NULL,
  `position_count` INT(11) NOT NULL DEFAULT 1,
  `last_issued_position_number` INT(11) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bay_level_config` (`bay_id`, `level_id`),
  CONSTRAINT `chk_config_pos_count` CHECK (`position_count` > 0),
  CONSTRAINT `chk_config_last_pos` CHECK (`last_issued_position_number` >= 0),
  CONSTRAINT `fk_rblc_rack` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rblc_bay_composite` FOREIGN KEY (`rack_id`, `bay_id`) REFERENCES `rack_bays` (`rack_id`, `id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_rblc_level_composite` FOREIGN KEY (`rack_id`, `level_id`) REFERENCES `rack_levels` (`rack_id`, `id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Storage Locations (Target for 100,000 bins)
CREATE TABLE IF NOT EXISTS `storage_locations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT(11) NOT NULL,
  `rack_id` INT(11) NOT NULL,
  `bay_id` INT(11) NOT NULL,
  `level_id` INT(11) NOT NULL,
  `position_number` INT(11) NOT NULL,
  `location_code` VARCHAR(60) NOT NULL,
  `pattern_version` INT(11) NOT NULL DEFAULT 1,
  `usable_width_mm` INT(11) NOT NULL DEFAULT 0,
  `usable_depth_mm` INT(11) NOT NULL DEFAULT 0,
  `usable_height_mm` INT(11) NOT NULL DEFAULT 0,
  `max_weight_kg` DECIMAL(12,2) NULL DEFAULT NULL,
  `max_volume_m3` DECIMAL(12,4) NULL DEFAULT NULL,
  `manual_status` ENUM('ACTIVE', 'BLOCKED', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `retired_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_storage_loc_code` (`warehouse_id`, `location_code`),
  UNIQUE KEY `uq_bay_level_pos` (`bay_id`, `level_id`, `position_number`),
  INDEX `idx_loc_search` (`warehouse_id`, `location_code`),
  INDEX `idx_loc_rack_status` (`rack_id`, `manual_status`),
  CONSTRAINT `chk_pos_number` CHECK (`position_number` > 0),
  CONSTRAINT `fk_loc_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_loc_bay_composite` FOREIGN KEY (`rack_id`, `bay_id`) REFERENCES `rack_bays` (`rack_id`, `id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_loc_level_composite` FOREIGN KEY (`rack_id`, `level_id`) REFERENCES `rack_levels` (`rack_id`, `id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Code Registry (Permanent registry, prevents code reuse, no CASCADE)
CREATE TABLE IF NOT EXISTS `code_registry` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT(11) NOT NULL,
  `code_type` VARCHAR(20) NOT NULL,
  `normalized_code` VARCHAR(100) NOT NULL,
  `entity_id` INT(11) NULL DEFAULT NULL,
  `registered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_code_registry` (`warehouse_id`, `code_type`, `normalized_code`),
  INDEX `idx_reg_lookup` (`warehouse_id`, `normalized_code`),
  CONSTRAINT `fk_reg_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Layout Obstacle Objects
CREATE TABLE IF NOT EXISTS `layout_objects` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` INT(11) NOT NULL,
  `object_type` VARCHAR(30) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `x_mm` INT(11) NOT NULL DEFAULT 0,
  `y_mm` INT(11) NOT NULL DEFAULT 0,
  `width_mm` INT(11) NOT NULL,
  `length_mm` INT(11) NOT NULL,
  `height_mm` INT(11) NULL DEFAULT 2500,
  `rotation` INT(11) NOT NULL DEFAULT 0,
  `clearance_mm` INT(11) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_lo_dims` CHECK (`width_mm` > 0 AND `length_mm` > 0),
  CONSTRAINT `chk_lo_coords` CHECK (`x_mm` >= 0 AND `y_mm` >= 0),
  CONSTRAINT `chk_lo_rotation` CHECK (`rotation` IN (0, 90, 180, 270)),
  CONSTRAINT `fk_lo_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TRIGGERS FOR DATA INTEGRITY & IMMUTABILITY
-- ============================================================================

-- Trigger 1: Menolak UPDATE pada rack_code (AC-10)
DROP TRIGGER IF EXISTS `trg_prevent_rack_code_update`;
CREATE TRIGGER `trg_prevent_rack_code_update`
BEFORE UPDATE ON `racks` FOR EACH ROW
BEGIN
  IF OLD.`rack_code` <> NEW.`rack_code` THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'AC-10: rack_code bersifat immutable dan dilarang diubah.';
  END IF;
END;

-- Trigger 2: Menolak UPDATE pada location_code (AC-10)
DROP TRIGGER IF EXISTS `trg_prevent_location_code_update`;
CREATE TRIGGER `trg_prevent_location_code_update`
BEFORE UPDATE ON `storage_locations` FOR EACH ROW
BEGIN
  IF OLD.`location_code` <> NEW.`location_code` THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'AC-10: location_code bersifat immutable dan dilarang diubah.';
  END IF;
END;

-- Trigger 3: Validasi Primary Aisle & Warehouse Match saat INSERT (AC-21)
DROP TRIGGER IF EXISTS `trg_check_primary_aisle_insert`;
CREATE TRIGGER `trg_check_primary_aisle_insert`
BEFORE INSERT ON `rack_aisle_access` FOR EACH ROW
BEGIN
  DECLARE v_rack_wh INT;
  DECLARE v_aisle_wh INT;
  DECLARE v_primary_count INT;

  SELECT `warehouse_id` INTO v_rack_wh FROM `racks` WHERE `id` = NEW.`rack_id`;
  SELECT `warehouse_id` INTO v_aisle_wh FROM `aisles` WHERE `id` = NEW.`aisle_id`;

  IF v_rack_wh IS NOT NULL AND v_aisle_wh IS NOT NULL AND v_rack_wh <> v_aisle_wh THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'AC-21: Rack dan Aisle harus berada dalam warehouse yang sama.';
  END IF;

  IF NEW.`is_primary` = 1 THEN
    SELECT COUNT(*) INTO v_primary_count
    FROM `rack_aisle_access`
    WHERE `rack_id` = NEW.`rack_id` AND `is_primary` = 1;

    IF v_primary_count > 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'AC-21: Rak hanya boleh memiliki maksimal satu primary aisle.';
    END IF;
  END IF;
END;

-- Trigger 4: Validasi Primary Aisle & Warehouse Match saat UPDATE (AC-21)
DROP TRIGGER IF EXISTS `trg_check_primary_aisle_update`;
CREATE TRIGGER `trg_check_primary_aisle_update`
BEFORE UPDATE ON `rack_aisle_access` FOR EACH ROW
BEGIN
  DECLARE v_rack_wh INT;
  DECLARE v_aisle_wh INT;
  DECLARE v_primary_count INT;

  SELECT `warehouse_id` INTO v_rack_wh FROM `racks` WHERE `id` = NEW.`rack_id`;
  SELECT `warehouse_id` INTO v_aisle_wh FROM `aisles` WHERE `id` = NEW.`aisle_id`;

  IF v_rack_wh IS NOT NULL AND v_aisle_wh IS NOT NULL AND v_rack_wh <> v_aisle_wh THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'AC-21: Rack dan Aisle harus berada dalam warehouse yang sama.';
  END IF;

  IF NEW.`is_primary` = 1 THEN
    SELECT COUNT(*) INTO v_primary_count
    FROM `rack_aisle_access`
    WHERE `rack_id` = NEW.`rack_id` AND `is_primary` = 1 AND `id` <> NEW.`id`;

    IF v_primary_count > 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'AC-21: Rak hanya boleh memiliki maksimal satu primary aisle.';
    END IF;
  END IF;
END;

-- Trigger 5: last_issued_position_number hanya boleh bertambah (append-first)
DROP TRIGGER IF EXISTS `trg_check_last_issued_pos_update`;
CREATE TRIGGER `trg_check_last_issued_pos_update`
BEFORE UPDATE ON `rack_bay_level_configs` FOR EACH ROW
BEGIN
  IF NEW.`last_issued_position_number` < OLD.`last_issued_position_number` THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'last_issued_position_number hanya boleh bertambah (append-first).';
  END IF;
END;
