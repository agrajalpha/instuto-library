const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors({
    origin: true, // Allow any origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} [${req.method}] ${req.url}`);
    next();
});

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, '../dist')));

// API Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Instuto Backend is running' });
});

// --- Helper for Settings ---
const getSettings = async () => {
    const [rows] = await db.query('SELECT * FROM settings');
    const settings = {};
    rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });
    return settings;
};

// --- Auth ---
app.post('/api/auth/login', async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM system_users WHERE email = ?', [email]);
        const user = users[0];
        
        if (!user || user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if (!user.is_active) {
            return res.status(403).json({ message: 'Account is disabled' });
        }
        
        await db.query('UPDATE system_users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        const { password: _, ...userWithoutPass } = user;
        res.json(userWithoutPass);
    } catch (e) {
        next(e);
    }
});

// --- Settings ---
app.get('/api/settings', async (req, res, next) => {
    try {
        const settings = await getSettings();
        res.json(settings);
    } catch (e) {
        next(e);
    }
});

app.put('/api/settings', async (req, res, next) => {
    const settings = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        for (const [key, value] of Object.entries(settings)) {
            await connection.query(
                'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                [key, JSON.stringify(value)]
            );
        }
        await connection.commit();
        res.json({ success: true });
    } catch (e) {
        await connection.rollback();
        next(e);
    } finally {
        connection.release();
    }
});

app.post('/api/settings/rename', async (req, res, next) => {
    const { key, oldValue, newValue } = req.body;
    if (!['authors', 'categories', 'genres', 'publishers', 'racks', 'shelves', 'lenderTypes', 'returnFilterOptions'].includes(key)) {
        return res.status(400).json({ message: "Invalid setting key for rename" });
    }
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        // 1. Update the Settings Table
        const [rows] = await connection.query('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
        let list = rows[0]?.setting_value || [];
        
        let updated = false;
        if (key === 'lenderTypes' || key === 'returnFilterOptions') {
             const idx = list.findIndex(i => (i.name || i.label) === oldValue);
             if (idx !== -1) {
                 if (list[idx].name) list[idx].name = newValue;
                 if (list[idx].label) list[idx].label = newValue;
                 updated = true;
             }
        } else {
             const idx = list.indexOf(oldValue);
             if (idx !== -1) {
                 list[idx] = newValue;
                 updated = true;
             }
        }
        
        if (updated) {
            await connection.query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [JSON.stringify(list), key]);
            
            // 2. Cascading Update to Books
            if (['authors', 'categories'].includes(key)) {
                const [books] = await connection.query('SELECT id, authors, categories FROM books');
                for (const book of books) {
                    let changed = false;
                    if (key === 'authors' && book.authors && book.authors.includes(oldValue)) {
                        book.authors = book.authors.map(a => a === oldValue ? newValue : a);
                        changed = true;
                    }
                    if (key === 'categories' && book.categories && book.categories.includes(oldValue)) {
                         book.categories = book.categories.map(c => c === oldValue ? newValue : c);
                         changed = true;
                    }
                    if (changed) {
                        await connection.query('UPDATE books SET authors = ?, categories = ? WHERE id = ?', 
                            [JSON.stringify(book.authors), JSON.stringify(book.categories), book.id]);
                    }
                }
            } else if (['genres', 'publishers', 'racks', 'shelves'].includes(key)) {
                const colMap = { genres: 'genre', publishers: 'publisher', racks: 'location_rack', shelves: 'location_shelf' };
                const col = colMap[key];
                if (col) {
                    await connection.query(`UPDATE books SET ${col} = ? WHERE ${col} = ?`, [newValue, oldValue]);
                }
            }
        }
        
        await connection.commit();
        res.json({ success: true });
    } catch (e) {
        await connection.rollback();
        next(e);
    } finally {
        connection.release();
    }
});

// --- Books ---
app.get('/api/books', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM books');
        const books = rows.map(b => ({
            id: b.id,
            title: b.title,
            authors: b.authors,
            categories: b.categories,
            isbn: b.isbn,
            genre: b.genre,
            publisher: b.publisher,
            publishedYear: b.published_year,
            locationRack: b.location_rack,
            locationShelf: b.location_shelf,
            locCallNumber: b.loc_call_number,
            description: b.description,
            coverUrl: b.cover_url
        }));
        res.json(books);
    } catch (e) {
        next(e);
    }
});

app.post('/api/books', async (req, res, next) => {
    const b = req.body;
    try {
        const sql = `INSERT INTO books (id, title, authors, categories, isbn, genre, publisher, published_year, location_rack, location_shelf, loc_call_number, description) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE title=VALUES(title), authors=VALUES(authors), categories=VALUES(categories), isbn=VALUES(isbn), genre=VALUES(genre), publisher=VALUES(publisher), published_year=VALUES(published_year), location_rack=VALUES(location_rack), location_shelf=VALUES(location_shelf), loc_call_number=VALUES(loc_call_number), description=VALUES(description)`;
        
        await db.query(sql, [
            b.id, b.title, JSON.stringify(b.authors), JSON.stringify(b.categories), b.isbn, b.genre, b.publisher, b.publishedYear, b.locationRack, b.locationShelf, b.locCallNumber, b.description
        ]);
        res.json(b);
    } catch (e) {
        next(e);
    }
});

app.delete('/api/books/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM books WHERE id = ?', [req.params.id]);
        res.sendStatus(204);
    } catch (e) {
        next(e);
    }
});

// --- Copies ---
app.get('/api/copies', async (req, res, next) => {
    const { bookId } = req.query;
    try {
        let sql = 'SELECT * FROM copies';
        let params = [];
        if (bookId) {
            sql += ' WHERE book_id = ?';
            params.push(bookId);
        }
        const [rows] = await db.query(sql, params);
        const copies = rows.map(c => ({
            id: c.id,
            bookId: c.book_id,
            status: c.status,
            addedDate: c.added_date,
            isReferenceOnly: Boolean(c.is_reference_only),
            narration: c.narration
        }));
        res.json(copies);
    } catch (e) {
        next(e);
    }
});

app.post('/api/copies', async (req, res, next) => {
    const c = req.body;
    try {
        const sql = `INSERT INTO copies (id, book_id, status, added_date, is_reference_only, narration)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE status=VALUES(status), is_reference_only=VALUES(is_reference_only), narration=VALUES(narration)`;
        await db.query(sql, [
            c.id, c.bookId, c.status, new Date(c.addedDate), c.isReferenceOnly, c.narration
        ]);
        res.json(c);
    } catch (e) {
        next(e);
    }
});

app.delete('/api/copies/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM copies WHERE id = ?', [req.params.id]);
        res.sendStatus(204);
    } catch (e) {
        next(e);
    }
});

// --- Users (Borrowers) ---
app.get('/api/users', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM users');
        res.json(rows);
    } catch (e) {
        next(e);
    }
});

app.post('/api/users', async (req, res, next) => {
    const u = req.body;
    try {
        await db.query('INSERT INTO users (id, name, role, email) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role)', [u.id, u.name, u.role, u.email]);
        res.json(u);
    } catch (e) {
        next(e);
    }
});

// --- System Users ---
app.get('/api/system-users', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT id, name, email, role, is_active, last_login FROM system_users');
        const users = rows.map(u => ({
            id: u.id, name: u.name, email: u.email, role: u.role, isActive: Boolean(u.is_active), lastLogin: u.last_login
        }));
        res.json(users);
    } catch (e) {
        next(e);
    }
});

app.post('/api/system-users', async (req, res, next) => {
    const u = req.body;
    try {
        if (!u.id.includes('-')) {
             const count = (await db.query('SELECT count(*) as c FROM system_users WHERE id = ?', [u.id]))[0][0].c;
             if (count === 0) {
                 await db.query('INSERT INTO system_users (id, name, email, role, is_active, password) VALUES (?, ?, ?, ?, ?, ?)', 
                 [u.id, u.name, u.email, u.role, u.isActive, 'password']);
                 return res.json(u);
             }
        }
        await db.query('UPDATE system_users SET name=?, email=?, role=?, is_active=? WHERE id=?', [u.name, u.email, u.role, u.isActive, u.id]);
        res.json(u);
    } catch (e) {
        next(e);
    }
});

app.delete('/api/system-users/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM system_users WHERE id = ?', [req.params.id]);
        res.sendStatus(204);
    } catch (e) {
        next(e);
    }
});

app.post('/api/system-users/:id/reset-password', async (req, res, next) => {
    try {
        await db.query('UPDATE system_users SET password = ? WHERE id = ?', ['password', req.params.id]);
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

app.post('/api/system-users/:id/toggle-status', async (req, res, next) => {
    try {
        await db.query('UPDATE system_users SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

app.put('/api/system-users/:id/password', async (req, res, next) => {
    try {
        await db.query('UPDATE system_users SET password = ? WHERE id = ?', [req.body.password, req.params.id]);
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// --- Transactions ---
app.get('/api/transactions', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM transactions');
        const txs = rows.map(t => ({
            id: t.id,
            copyId: t.copy_id,
            bookId: t.book_id,
            userId: t.user_id,
            userName: t.user_name,
            issueDate: t.issue_date,
            dueDate: t.due_date,
            returnDate: t.return_date,
            status: t.status,
            returnCondition: t.return_condition,
            fineAmount: t.fine_amount
        }));
        res.json(txs);
    } catch (e) {
        next(e);
    }
});

app.post('/api/transactions', async (req, res, next) => {
    const t = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        await connection.query(
            `INSERT INTO transactions (id, copy_id, book_id, user_id, user_name, issue_date, due_date, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [t.id, t.copyId, t.bookId, t.userId, t.userName, new Date(t.issueDate), new Date(t.dueDate), t.status]
        );
        
        // Update Copy Status
        await connection.query('UPDATE copies SET status = ? WHERE id = ?', ['BORROWED', t.copyId]);
        
        await connection.commit();
        res.json(t);
    } catch (e) {
        await connection.rollback();
        next(e);
    } finally {
        connection.release();
    }
});

app.put('/api/transactions/:id', async (req, res, next) => {
    const t = req.body;
    try {
        await db.query('UPDATE transactions SET due_date = ? WHERE id = ?', [new Date(t.dueDate), t.id]);
        res.json(t);
    } catch (e) {
        next(e);
    }
});

app.post('/api/transactions/:id/complete', async (req, res, next) => {
    const t = req.body; 
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        await connection.query(
            'UPDATE transactions SET status=?, return_date=?, return_condition=? WHERE id=?',
            [t.status, new Date(t.returnDate), t.returnCondition, t.id]
        );
        
        await connection.query('UPDATE copies SET status=? WHERE id=?', [t.finalCopyStatus, t.copyId]);
        
        await connection.commit();
        res.json(t);
    } catch (e) {
        await connection.rollback();
        next(e);
    } finally {
        connection.release();
    }
});

// --- Logs ---
app.get('/api/logs', async (req, res, next) => {
    try {
        const [rows] = await db.query('SELECT * FROM logs ORDER BY timestamp DESC');
        const logs = rows.map(l => ({
            id: l.id,
            bookId: l.book_id,
            bookTitle: l.book_title,
            action: l.action,
            description: l.description,
            timestamp: l.timestamp,
            userId: l.user_id,
            userName: l.user_name,
            staffId: l.staff_id,
            staffName: l.staff_name
        }));
        res.json(logs);
    } catch (e) {
        next(e);
    }
});

app.post('/api/logs', async (req, res, next) => {
    const l = req.body;
    try {
        await db.query(
            `INSERT INTO logs (id, book_id, book_title, action, description, timestamp, user_id, user_name, staff_id, staff_name) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [l.id, l.bookId, l.bookTitle, l.action, l.description, new Date(l.timestamp), l.userId, l.userName, l.staffId, l.staffName]
        );
        res.json(l);
    } catch (e) {
        next(e);
    }
});

// Catch-all to serve index.html for any other request (client-side routing)
app.get('*', (req, res) => {
  const file = path.join(__dirname, '../dist/index.html');
  res.sendFile(file, (err) => {
    if (err) {
        res.status(404).json({ message: "UI build not found. Please run 'npm run build' to generate static assets." });
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});