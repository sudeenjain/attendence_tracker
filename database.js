require('dotenv').config();
const path = require('path');

let db;

const pgUrl = process.env.DATABASE_URL;

if (pgUrl) {
    // ─── PostgreSQL (Production / Cloud) ───────────────────────────────
    console.log('Connecting to PostgreSQL database...');
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: pgUrl,
        ssl: pgUrl.includes('localhost') || pgUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });

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

} else if (process.env.VERCEL) {
    // ─── In-Memory Store (Vercel Serverless without DATABASE_URL) ──────
    console.log('Running on Vercel without DATABASE_URL — using in-memory store.');
    console.log('NOTE: Data will NOT persist between serverless invocations.');

    let users = [];
    let attendance = [];
    let userIdSeq = 1;
    let attIdSeq = 1;

    db = {
        isPg: false,
        all: (sql, params, callback) => {
            try {
                const upper = sql.trim().toUpperCase();
                if (upper.includes('FROM USERS')) {
                    return callback(null, users);
                }
                if (upper.includes('FROM ATTENDANCE')) {
                    // Return today's attendance joined with user info
                    const today = new Date().toISOString().slice(0, 10);
                    const todayLogs = attendance
                        .filter(a => a.timestamp.startsWith(today))
                        .map(a => {
                            const u = users.find(u => u.id === a.user_id);
                            return {
                                id: a.id,
                                name: u ? u.name : 'Unknown',
                                usn: u ? u.usn : '---',
                                branch: u ? u.branch : '---',
                                timestamp: a.timestamp
                            };
                        });
                    return callback(null, todayLogs);
                }
                callback(null, []);
            } catch (e) {
                callback(e);
            }
        },
        get: (sql, params, callback) => {
            try {
                const upper = sql.trim().toUpperCase();
                if (upper.includes('FROM ATTENDANCE') && params && params.length) {
                    const userId = params[0];
                    const today = new Date().toISOString().slice(0, 10);
                    const found = attendance.find(a => a.user_id === userId && a.timestamp.startsWith(today));
                    return callback(null, found || undefined);
                }
                callback(null, undefined);
            } catch (e) {
                callback(e);
            }
        },
        run: function(sql, params, callback) {
            try {
                const upper = sql.trim().toUpperCase();
                if (upper.startsWith('INSERT INTO USERS')) {
                    const [name, usn, branch, descriptor] = params;
                    if (users.find(u => u.usn === usn.toUpperCase())) {
                        const err = new Error('UNIQUE constraint failed: users.usn');
                        err.code = 'SQLITE_CONSTRAINT';
                        return callback(err);
                    }
                    const newUser = {
                        id: userIdSeq++,
                        name, usn: usn.toUpperCase(), branch, descriptor,
                        created_at: new Date().toISOString()
                    };
                    users.push(newUser);
                    const ctx = { lastID: newUser.id };
                    return callback.call(ctx, null);
                }
                if (upper.startsWith('INSERT INTO ATTENDANCE')) {
                    const userId = params[0];
                    const newAtt = {
                        id: attIdSeq++,
                        user_id: userId,
                        timestamp: new Date().toISOString()
                    };
                    attendance.push(newAtt);
                    const ctx = { lastID: newAtt.id };
                    return callback.call(ctx, null);
                }
                callback.call({}, null);
            } catch (e) {
                callback(e);
            }
        }
    };

} else {
    // ─── SQLite (Local Development) ────────────────────────────────────
    console.log('Connecting to local SQLite database...');
    const sqlite3 = require('sqlite3').verbose();
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
