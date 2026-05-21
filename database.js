require('dotenv').config();
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

const pgUrl = process.env.DATABASE_URL;

if (pgUrl) {
    console.log('Connecting to PostgreSQL database...');
    const pool = new Pool({
        connectionString: pgUrl,
        ssl: pgUrl.includes('localhost') || pgUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });

    // Helper to translate sqlite style (?) to pg style ($1)
    const translateQuery = (sql) => {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++}`);
    };

    db = {
        isPg: true,
        all: (sql, params, callback) => {
            const pgSql = translateQuery(sql);
            pool.query(pgSql, params, (err, res) => {
                if (err) return callback(err);
                callback(null, res.rows);
            });
        },
        get: (sql, params, callback) => {
            const pgSql = translateQuery(sql);
            pool.query(pgSql, params, (err, res) => {
                if (err) return callback(err);
                callback(null, res.rows[0]);
            });
        },
        run: function(sql, params, callback) {
            let pgSql = translateQuery(sql);
            // If it's an INSERT query, we append RETURNING id to get the last ID
            const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
            if (isInsert) {
                pgSql += ' RETURNING id';
            }
            
            pool.query(pgSql, params, (err, res) => {
                if (err) return callback(err);
                
                const context = {
                    lastID: isInsert && res.rows[0] ? res.rows[0].id : null
                };
                callback.call(context, null);
            });
        }
    };

    // Table creation migrations for PostgreSQL
    pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            usn VARCHAR(50) NOT NULL UNIQUE,
            branch VARCHAR(100) NOT NULL,
            descriptor TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).then(() => {
        return pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }).then(() => {
        console.log('PostgreSQL tables initialized.');
    }).catch(err => {
        console.error('Error initializing PostgreSQL tables:', err);
    });

} else {
    console.log('Connecting to local SQLite database...');
    const dbPath = path.resolve(__dirname, 'attendance.db');
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening SQLite database', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            
            sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                usn TEXT NOT NULL UNIQUE,
                branch TEXT NOT NULL,
                descriptor TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error creating users table:", err);
            });

            sqliteDb.run(`CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) console.error("Error creating attendance table:", err);
            });
        }
    });

    db = sqliteDb;
    db.isPg = false;
}

module.exports = db;
