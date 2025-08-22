-- Create new clubapp user and remove old dojoapp user

-- Create the new clubapp user with the same password
CREATE USER 'clubapp'@'localhost' IDENTIFIED BY 'djppass';

-- Grant all privileges on clubdirector database to clubapp user
GRANT ALL PRIVILEGES ON clubdirector.* TO 'clubapp'@'localhost';

-- Also grant privileges on the original dojopro database (for backup/migration purposes)
GRANT ALL PRIVILEGES ON dojopro.* TO 'clubapp'@'localhost';

-- Flush privileges to ensure changes take effect
FLUSH PRIVILEGES;

-- Show the new user's privileges
SHOW GRANTS FOR 'clubapp'@'localhost';

-- Remove the old dojoapp user
DROP USER 'dojoapp'@'localhost';

-- Confirm users
SELECT User, Host FROM mysql.user WHERE User IN ('dojoapp', 'clubapp');

SELECT 'User migration completed successfully!' as Status;
SELECT 'Old dojoapp user removed, new clubapp user created' as Details;