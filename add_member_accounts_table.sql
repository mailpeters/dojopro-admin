-- Add member_accounts table to link members to user accounts for login
USE clubdirector;

-- Create member_accounts table to link members to user authentication
CREATE TABLE member_accounts (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_member_accounts_email (email),
    INDEX idx_member_accounts_member_id (member_id)
);

-- Add default temporary password constant that indicates password setup is needed
-- This matches what the admin portal expects: 'TEMP_HASH_TO_BE_SET'

SELECT 'member_accounts table created successfully!' as Status;