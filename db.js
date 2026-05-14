// db.js - Database Connection Pool
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'quizly_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection on startup
pool.getConnection()
    .then((connection) => {
        console.log('✅ Connected to MySQL Database successfully.');
        connection.release();
    })
    .catch((err) => {
        console.error('❌ Database connection failed:', err.message);
    });

module.exports = pool;
