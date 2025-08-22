-- Grant permissions for dojoapp user to access clubdirector database

-- Grant all privileges on clubdirector database to dojoapp user
GRANT ALL PRIVILEGES ON clubdirector.* TO 'dojoapp'@'localhost';

-- Flush privileges to ensure changes take effect
FLUSH PRIVILEGES;

-- Verify the grants
SHOW GRANTS FOR 'dojoapp'@'localhost';

-- Test connection
SELECT 'Permissions granted successfully for dojoapp user on clubdirector database' as Status;