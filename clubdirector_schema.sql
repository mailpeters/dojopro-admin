-- ClubDirector Database Schema
-- Complete database setup script for ClubDirector club management system

-- Drop database if exists and create new one
DROP DATABASE IF EXISTS clubdirector;
CREATE DATABASE clubdirector;
USE clubdirector;

-- Create clubs table
CREATE TABLE clubs (
    club_id INT AUTO_INCREMENT PRIMARY KEY,
    club_name VARCHAR(255) NOT NULL,
    description TEXT,
    primary_location_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create users table (for staff/admin users)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email_verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create locations table
CREATE TABLE locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    phone VARCHAR(20),
    capacity INT,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    is_primary_location BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE
);

-- Create households table (for family groupings)
CREATE TABLE households (
    household_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    household_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE
);

-- Create members table
CREATE TABLE members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    household_id INT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    membership_type ENUM('individual', 'family', 'student', 'adult', 'senior') DEFAULT 'individual',
    membership_start_date DATE,
    membership_end_date DATE,
    status ENUM('active', 'inactive', 'pending', 'suspended') DEFAULT 'pending',
    belt_rank VARCHAR(50),
    is_primary_member BOOLEAN DEFAULT FALSE,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    medical_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE,
    FOREIGN KEY (household_id) REFERENCES households(household_id) ON DELETE SET NULL
);

-- Create club_staff table (relationship between users and clubs)
CREATE TABLE club_staff (
    club_staff_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'admin', 'instructor', 'staff') DEFAULT 'staff',
    is_primary_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_club_user (club_id, user_id)
);

-- Create club_settings table
CREATE TABLE club_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    logo_url VARCHAR(500),
    primary_color VARCHAR(7) DEFAULT '#667eea',
    secondary_color VARCHAR(7) DEFAULT '#764ba2',
    locale VARCHAR(10) DEFAULT 'en_US',
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    allow_member_registration BOOLEAN DEFAULT TRUE,
    require_waiver BOOLEAN DEFAULT TRUE,
    waiver_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE,
    UNIQUE KEY unique_club_settings (club_id)
);

-- Create check_ins table (for tracking member attendance)
CREATE TABLE check_ins (
    check_in_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    member_id INT NOT NULL,
    location_id INT,
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
);

-- Create membership_payments table (for tracking payments)
CREATE TABLE membership_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    member_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash', 'check', 'card', 'transfer', 'other') DEFAULT 'cash',
    payment_period_start DATE,
    payment_period_end DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE
);

-- Create classes table (for scheduled classes/sessions)
CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    club_id INT NOT NULL,
    location_id INT,
    class_name VARCHAR(255) NOT NULL,
    description TEXT,
    instructor_user_id INT,
    day_of_week TINYINT, -- 0=Sunday, 1=Monday, etc.
    start_time TIME,
    end_time TIME,
    max_capacity INT,
    belt_requirements TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    FOREIGN KEY (instructor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create session table for web sessions
CREATE TABLE sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT(11) UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
);

-- Add foreign key constraint for clubs.primary_location_id after locations table is created
ALTER TABLE clubs ADD FOREIGN KEY (primary_location_id) REFERENCES locations(location_id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_members_club_id ON members(club_id);
CREATE INDEX idx_members_household_id ON members(household_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_locations_club_id ON locations(club_id);
CREATE INDEX idx_club_staff_club_id ON club_staff(club_id);
CREATE INDEX idx_club_staff_user_id ON club_staff(user_id);
CREATE INDEX idx_check_ins_club_id ON check_ins(club_id);
CREATE INDEX idx_check_ins_member_id ON check_ins(member_id);
CREATE INDEX idx_check_ins_date ON check_ins(check_in_time);
CREATE INDEX idx_payments_club_id ON membership_payments(club_id);
CREATE INDEX idx_payments_member_id ON membership_payments(member_id);
CREATE INDEX idx_classes_club_id ON classes(club_id);
CREATE INDEX idx_classes_location_id ON classes(location_id);

-- Insert sample data for initial setup
-- Create default admin user (password: 'admin123' - should be changed immediately)
INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES 
('admin@clubdirector.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Administrator', '555-0100');

-- Create sample club
INSERT INTO clubs (club_name, description) VALUES 
('Sample Club', 'Welcome to ClubDirector! This is your sample club to get started.');

-- Create primary location for the sample club
INSERT INTO locations (club_id, location_name, address_line1, city, state, postal_code, phone, is_primary_location) VALUES 
(1, 'Main Location', '123 Main Street', 'Anytown', 'ST', '12345', '555-0123', TRUE);

-- Update club with primary location
UPDATE clubs SET primary_location_id = 1 WHERE club_id = 1;

-- Make admin user the owner of the sample club
INSERT INTO club_staff (club_id, user_id, role, is_primary_contact) VALUES 
(1, 1, 'owner', TRUE);

-- Create default club settings
INSERT INTO club_settings (club_id, primary_color, secondary_color, locale, timezone) VALUES 
(1, '#667eea', '#764ba2', 'en_US', 'America/New_York');

-- Create sample household
INSERT INTO households (club_id, household_name) VALUES 
(1, 'Sample Family');

-- Create sample member
INSERT INTO members (club_id, household_id, first_name, last_name, email, phone, membership_type, status, is_primary_member) VALUES 
(1, 1, 'John', 'Doe', 'john.doe@example.com', '555-0200', 'family', 'active', TRUE);

COMMIT;

-- Display success message
SELECT 'ClubDirector database created successfully!' as 'Status';
SELECT 'Default admin login: admin@clubdirector.com / admin123' as 'Admin_Credentials';
SELECT 'Please change the default password immediately after first login!' as 'Security_Notice';