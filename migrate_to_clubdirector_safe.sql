-- Safe Migration Script: DojoPro to ClubDirector
-- This script checks for existing columns and tables before migrating

USE clubdirector;

-- Disable foreign key checks temporarily for data migration
SET FOREIGN_KEY_CHECKS = 0;

-- Clear sample data first (if you want to keep it, comment out these lines)
DELETE FROM membership_payments;
DELETE FROM check_ins;
DELETE FROM club_settings WHERE club_id = 1;
DELETE FROM club_staff WHERE club_id = 1;
DELETE FROM members WHERE club_id = 1;
DELETE FROM households WHERE club_id = 1;
DELETE FROM locations WHERE club_id = 1;
DELETE FROM clubs WHERE club_id = 1;
DELETE FROM users WHERE user_id = 1;

-- Reset auto increment counters
ALTER TABLE clubs AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE locations AUTO_INCREMENT = 1;
ALTER TABLE households AUTO_INCREMENT = 1;
ALTER TABLE members AUTO_INCREMENT = 1;
ALTER TABLE club_staff AUTO_INCREMENT = 1;

-- Check if old database exists
SET @db_exists = (SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'dojopro');

-- Only proceed if old database exists
SET @sql = IF(@db_exists > 0, 'SELECT "Starting migration from dojopro database..." as Status', 'SELECT "Source database dojopro not found. Skipping migration." as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate users table
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'users');
SET @sql = IF(@table_exists > 0 AND @db_exists > 0, 
    'INSERT INTO clubdirector.users (user_id, email, password_hash, first_name, last_name, phone, created_at, updated_at)
     SELECT user_id, email, password_hash, first_name, last_name, phone, 
            IFNULL(created_at, CURRENT_TIMESTAMP), 
            IFNULL(updated_at, CURRENT_TIMESTAMP)
     FROM dojopro.users', 
    'SELECT "Skipping users migration - table not found" as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate clubs table
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'clubs');
SET @sql = IF(@table_exists > 0 AND @db_exists > 0, 
    'INSERT INTO clubdirector.clubs (club_id, club_name, description, created_at, updated_at)
     SELECT club_id, club_name, 
            IFNULL(description, "Migrated from DojoPro"), 
            IFNULL(created_at, CURRENT_TIMESTAMP), 
            IFNULL(updated_at, CURRENT_TIMESTAMP)
     FROM dojopro.clubs', 
    'SELECT "Skipping clubs migration - table not found" as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate locations table
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'locations');
SET @sql = IF(@table_exists > 0 AND @db_exists > 0, 
    'INSERT INTO clubdirector.locations (location_id, club_id, location_name, address_line1, address_line2, city, state, postal_code, phone, capacity, timezone, is_primary_location, created_at, updated_at)
     SELECT location_id, club_id, location_name, address_line1, address_line2, city, state, postal_code, phone, capacity, 
            IFNULL(timezone, "America/New_York"), 
            IFNULL(is_primary_location, FALSE), 
            IFNULL(created_at, CURRENT_TIMESTAMP), 
            IFNULL(updated_at, CURRENT_TIMESTAMP)
     FROM dojopro.locations', 
    'SELECT "Skipping locations migration - table not found" as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate households table
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'households');
SET @sql = IF(@table_exists > 0 AND @db_exists > 0, 
    'INSERT INTO clubdirector.households (household_id, club_id, household_name, created_at, updated_at)
     SELECT household_id, club_id, household_name, 
            IFNULL(created_at, CURRENT_TIMESTAMP), 
            IFNULL(updated_at, CURRENT_TIMESTAMP)
     FROM dojopro.households', 
    'SELECT "Skipping households migration - table not found" as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate members table
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'members');
SET @sql = IF(@table_exists > 0 AND @db_exists > 0, 
    'INSERT INTO clubdirector.members (member_id, club_id, household_id, first_name, last_name, email, phone, date_of_birth, membership_type, membership_start_date, membership_end_date, status, belt_rank, is_primary_member, emergency_contact_name, emergency_contact_phone, medical_notes, created_at, updated_at)
     SELECT member_id, club_id, household_id, first_name, last_name, email, phone, date_of_birth, 
            IFNULL(membership_type, "individual"), 
            membership_start_date, membership_end_date, 
            IFNULL(status, "pending"), 
            belt_rank, 
            IFNULL(is_primary_member, FALSE), 
            emergency_contact_name, emergency_contact_phone, medical_notes,
            IFNULL(created_at, CURRENT_TIMESTAMP), 
            IFNULL(updated_at, CURRENT_TIMESTAMP)
     FROM dojopro.members', 
    'SELECT "Skipping members migration - table not found" as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate club_staff table
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'club_staff');
SET @sql = IF(@table_exists > 0 AND @db_exists > 0, 
    'INSERT INTO clubdirector.club_staff (club_staff_id, club_id, user_id, role, is_primary_contact, created_at, updated_at)
     SELECT club_staff_id, club_id, user_id, 
            IFNULL(role, "staff"), 
            IFNULL(is_primary_contact, FALSE), 
            IFNULL(created_at, CURRENT_TIMESTAMP), 
            IFNULL(updated_at, CURRENT_TIMESTAMP)
     FROM dojopro.club_staff', 
    'SELECT "Skipping club_staff migration - table not found" as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Migrate club_settings table
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'club_settings');
SET @sql = IF(@table_exists > 0 AND @db_exists > 0, 
    'INSERT INTO clubdirector.club_settings (setting_id, club_id, logo_url, primary_color, secondary_color, locale, timezone, allow_member_registration, require_waiver, waiver_text, created_at, updated_at)
     SELECT setting_id, club_id, logo_url, 
            IFNULL(primary_color, "#667eea"), 
            IFNULL(secondary_color, "#764ba2"), 
            IFNULL(locale, "en_US"), 
            IFNULL(timezone, "America/New_York"), 
            IFNULL(allow_member_registration, TRUE), 
            IFNULL(require_waiver, TRUE), 
            waiver_text,
            IFNULL(created_at, CURRENT_TIMESTAMP), 
            IFNULL(updated_at, CURRENT_TIMESTAMP)
     FROM dojopro.club_settings', 
    'SELECT "Skipping club_settings migration - table not found" as Status');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update primary location references in clubs table
UPDATE clubdirector.clubs c 
SET primary_location_id = (
    SELECT location_id 
    FROM clubdirector.locations l 
    WHERE l.club_id = c.club_id 
    AND l.is_primary_location = TRUE 
    LIMIT 1
) 
WHERE primary_location_id IS NULL;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Update auto increment values to continue from highest existing ID + 1
SET @max_club_id = (SELECT IFNULL(MAX(club_id), 0) + 1 FROM clubdirector.clubs);
SET @sql = CONCAT('ALTER TABLE clubdirector.clubs AUTO_INCREMENT = ', @max_club_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @max_user_id = (SELECT IFNULL(MAX(user_id), 0) + 1 FROM clubdirector.users);
SET @sql = CONCAT('ALTER TABLE clubdirector.users AUTO_INCREMENT = ', @max_user_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @max_location_id = (SELECT IFNULL(MAX(location_id), 0) + 1 FROM clubdirector.locations);
SET @sql = CONCAT('ALTER TABLE clubdirector.locations AUTO_INCREMENT = ', @max_location_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @max_household_id = (SELECT IFNULL(MAX(household_id), 0) + 1 FROM clubdirector.households);
SET @sql = CONCAT('ALTER TABLE clubdirector.households AUTO_INCREMENT = ', @max_household_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @max_member_id = (SELECT IFNULL(MAX(member_id), 0) + 1 FROM clubdirector.members);
SET @sql = CONCAT('ALTER TABLE clubdirector.members AUTO_INCREMENT = ', @max_member_id);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;

-- Verification queries
SELECT 'Migration completed successfully!' as 'Status';
SELECT COUNT(*) as 'Total_Clubs' FROM clubdirector.clubs;
SELECT COUNT(*) as 'Total_Users' FROM clubdirector.users;
SELECT COUNT(*) as 'Total_Locations' FROM clubdirector.locations;
SELECT COUNT(*) as 'Total_Members' FROM clubdirector.members;
SELECT COUNT(*) as 'Total_Staff' FROM clubdirector.club_staff;