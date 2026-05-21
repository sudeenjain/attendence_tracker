require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large JSON payloads if needed

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API: Get all registered users
app.get('/api/users', (req, res) => {
    db.all("SELECT id, name, usn, branch, descriptor FROM users", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        try {
            const users = rows.map(row => ({
                id: row.id,
                name: row.name,
                usn: row.usn,
                branch: row.branch,
                descriptor: JSON.parse(row.descriptor)
            }));
            res.json(users);
        } catch (parseError) {
            res.status(500).json({ error: "Error parsing descriptors from database." });
        }
    });
});

// API: Register new user
app.post('/api/register', (req, res) => {
    const { name, usn, branch, descriptor } = req.body;
    
    if (!name || !usn || !branch || !descriptor) {
        return res.status(400).json({ error: "Name, USN, Branch, and face descriptor are required." });
    }

    const descriptorStr = JSON.stringify(descriptor);

    db.run("INSERT INTO users (name, usn, branch, descriptor) VALUES (?, ?, ?, ?)", [name, usn.toUpperCase(), branch, descriptorStr], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed') || err.message.includes('unique constraint') || err.code === '23505') {
                return res.status(400).json({ error: `USN "${usn.toUpperCase()}" is already registered.` });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, name, usn: usn.toUpperCase(), branch, message: "User registered successfully." });
    });
});

// API: Log attendance
app.post('/api/attend', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
        return res.status(400).json({ error: "User ID is required." });
    }

    // Rate limiting: Only log once every 5 minutes per user
    db.get("SELECT timestamp FROM attendance WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1", [user_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            const lastLogTime = typeof row.timestamp === 'string'
                ? new Date(row.timestamp + ' UTC')
                : new Date(row.timestamp);
            const now = new Date();
            const diffMinutes = (now - lastLogTime) / 1000 / 60;
            
            if (diffMinutes < 5) {
                return res.status(429).json({ message: "Attendance already logged recently." });
            }
        }

        db.run("INSERT INTO attendance (user_id) VALUES (?)", [user_id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, attendance_id: this.lastID, message: "Attendance logged successfully!" });
        });
    });
});

// API: Get today's attendance logs
app.get('/api/attendance', (req, res) => {
    const query = db.isPg ? `
        SELECT a.id, a.timestamp, u.name, u.usn, u.branch 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.timestamp::date = CURRENT_DATE
        ORDER BY a.timestamp DESC
    ` : `
        SELECT a.id, a.timestamp, u.name, u.usn, u.branch 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE date(a.timestamp) = date('now')
        ORDER BY a.timestamp DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server is successfully running on http://localhost:${PORT}`);
});
