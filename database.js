const mysql = require('mysql2/promise');

// Create connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'clubapp',
    password: 'djppass',
    database: 'clubdirector',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('Database pool connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('Database pool connection failed:', err);
    });

module.exports = pool;