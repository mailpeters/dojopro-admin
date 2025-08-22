-- Copy DojoPro database to ClubDirector (keeping original as backup)
-- This script creates a complete copy of your existing database with the new name

-- Create the new database
CREATE DATABASE IF NOT EXISTS clubdirector;
USE clubdirector;

-- First, let's get the structure by copying table definitions
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

-- Create tables with same structure as original database
-- We'll use CREATE TABLE ... LIKE to copy structure, then INSERT to copy data

-- Copy users table
DROP TABLE IF EXISTS users;
CREATE TABLE users LIKE dojopro.users;
INSERT INTO users SELECT * FROM dojopro.users;

-- Copy clubs table  
DROP TABLE IF EXISTS clubs;
CREATE TABLE clubs LIKE dojopro.clubs;
INSERT INTO clubs SELECT * FROM dojopro.clubs;

-- Copy locations table
DROP TABLE IF EXISTS locations;
CREATE TABLE locations LIKE dojopro.locations;
INSERT INTO locations SELECT * FROM dojopro.locations;

-- Copy households table (if exists)
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'households');
SET @sql = IF(@table_exists > 0, 
    'DROP TABLE IF EXISTS households; CREATE TABLE households LIKE dojopro.households; INSERT INTO households SELECT * FROM dojopro.households;', 
    'SELECT "households table does not exist in source database" as Info;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Copy members table
DROP TABLE IF EXISTS members;
CREATE TABLE members LIKE dojopro.members;
INSERT INTO members SELECT * FROM dojopro.members;

-- Copy club_staff table (if exists)
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'club_staff');
SET @sql = IF(@table_exists > 0, 
    'DROP TABLE IF EXISTS club_staff; CREATE TABLE club_staff LIKE dojopro.club_staff; INSERT INTO club_staff SELECT * FROM dojopro.club_staff;', 
    'SELECT "club_staff table does not exist in source database" as Info;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Copy club_settings table (if exists)
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'club_settings');
SET @sql = IF(@table_exists > 0, 
    'DROP TABLE IF EXISTS club_settings; CREATE TABLE club_settings LIKE dojopro.club_settings; INSERT INTO club_settings SELECT * FROM dojopro.club_settings;', 
    'SELECT "club_settings table does not exist in source database" as Info;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Copy any additional tables that might exist
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'check_ins');
SET @sql = IF(@table_exists > 0, 
    'DROP TABLE IF EXISTS check_ins; CREATE TABLE check_ins LIKE dojopro.check_ins; INSERT INTO check_ins SELECT * FROM dojopro.check_ins;', 
    'SELECT "check_ins table does not exist in source database" as Info;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'membership_payments');
SET @sql = IF(@table_exists > 0, 
    'DROP TABLE IF EXISTS membership_payments; CREATE TABLE membership_payments LIKE dojopro.membership_payments; INSERT INTO membership_payments SELECT * FROM dojopro.membership_payments;', 
    'SELECT "membership_payments table does not exist in source database" as Info;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'classes');
SET @sql = IF(@table_exists > 0, 
    'DROP TABLE IF EXISTS classes; CREATE TABLE classes LIKE dojopro.classes; INSERT INTO classes SELECT * FROM dojopro.classes;', 
    'SELECT "classes table does not exist in source database" as Info;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'dojopro' AND table_name = 'sessions');
SET @sql = IF(@table_exists > 0, 
    'DROP TABLE IF EXISTS sessions; CREATE TABLE sessions LIKE dojopro.sessions; INSERT INTO sessions SELECT * FROM dojopro.sessions;', 
    'CREATE TABLE sessions (session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL, expires INT(11) UNSIGNED NOT NULL, data MEDIUMTEXT COLLATE utf8mb4_bin, PRIMARY KEY (session_id));');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Reset settings
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

COMMIT;

-- Verification and summary
SELECT 'Database copy completed successfully!' as 'Status';
SELECT 'Original dojopro database preserved as backup' as 'Backup_Status';

-- Show what was copied
SELECT 
    'clubdirector' as 'New_Database',
    COUNT(*) as 'Total_Tables' 
FROM information_schema.tables 
WHERE table_schema = 'clubdirector';

-- Show table counts comparison
SELECT 'Table Comparison:' as 'Info';

SELECT 
    'clubs' as 'Table_Name',
    (SELECT COUNT(*) FROM dojopro.clubs) as 'Original_Count',
    (SELECT COUNT(*) FROM clubdirector.clubs) as 'New_Count';

SELECT 
    'users' as 'Table_Name',
    (SELECT COUNT(*) FROM dojopro.users) as 'Original_Count',
    (SELECT COUNT(*) FROM clubdirector.users) as 'New_Count';

SELECT 
    'locations' as 'Table_Name',
    (SELECT COUNT(*) FROM dojopro.locations) as 'Original_Count',
    (SELECT COUNT(*) FROM clubdirector.locations) as 'New_Count';

SELECT 
    'members' as 'Table_Name',
    (SELECT COUNT(*) FROM dojopro.members) as 'Original_Count',
    (SELECT COUNT(*) FROM clubdirector.members) as 'New_Count';

-- Instructions for next steps
SELECT 'Next Steps:' as 'Instructions';
SELECT '1. Test your application with the new clubdirector database' as 'Step_1';
SELECT '2. Verify all functionality works correctly' as 'Step_2';
SELECT '3. Once satisfied, you can optionally remove the dojopro database' as 'Step_3';
SELECT '4. Your original data is safely preserved in dojopro database' as 'Step_4';