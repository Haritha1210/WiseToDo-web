const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

let dbCache = null;
let dbCacheTime = 0;
const CACHE_TTL = 2000;

// Helper to read DB (cached)
const readDB = () => {
    const now = Date.now();
    if (dbCache && now - dbCacheTime < CACHE_TTL) return dbCache;
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        dbCache = JSON.parse(data);
        dbCacheTime = now;
        return dbCache;
    } catch (err) {
        return { users: [], userData: {} };
    }
};

// Helper to write DB
const writeDB = (db) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    dbCache = db;
    dbCacheTime = Date.now();
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const getNow = () => new Date().toISOString();

const updateDailyHistory = (item) => {
    const today = getTodayDate();
    if (!item.dailyHistory) item.dailyHistory = [];
    let record = item.dailyHistory.find(r => r.date === today);
    if (!record) {
        record = {
            date: today,
            completed: !!item.completed,
            status: item.status || 'Not Started',
            started: !!item.started
        };
        item.dailyHistory.push(record);
    } else {
        record.completed = !!item.completed;
        record.status = item.status || 'Not Started';
        record.started = !!item.started;
    }
};

// --- AUTHENTICATION ---

app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    let db = readDB();
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = {
        id: crypto.randomUUID(),
        username,
        email,
        password, // Stored in plain text for simplicity in this local project
        avatar: "https://ui-avatars.com/api/?name=" + encodeURIComponent(username) + "&background=fff&color=FA8072"
    };

    db.users.push(newUser);
    db.userData[newUser.id] = {
        dashboardTasks: [],
        habits: [],
        rememberTasks: [],
        importantDays: [],
        todoList: [],
        stickyNotes: []
    };
    
    writeDB(db);
    res.json({ token: newUser.id, username: newUser.username });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    let db = readDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ token: user.id, username: user.username, email: user.email, avatar: user.avatar });
});

// Middleware to check authentication
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    let db = readDB();
    const user = db.users.find(u => u.id === token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    
    req.userId = user.id;
    next();
};

// Update Profile
app.put('/api/profile', authMiddleware, (req, res) => {
    let db = readDB();
    const userIndex = db.users.findIndex(u => u.id === req.userId);
    
    if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
    
    if (req.body.username) db.users[userIndex].username = req.body.username;
    if (req.body.email) db.users[userIndex].email = req.body.email;
    if (req.body.avatar) db.users[userIndex].avatar = req.body.avatar;
    
    writeDB(db);
    res.json({ 
        username: db.users[userIndex].username, 
        email: db.users[userIndex].email,
        avatar: db.users[userIndex].avatar 
    });
});

app.get('/api/profile', authMiddleware, (req, res) => {
    let db = readDB();
    const user = db.users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
        username: user.username,
        email: user.email,
        avatar: user.avatar
    });
});

// --- GENERIC DATA ROUTES ---

// Get all data for a specific type
app.get('/api/data/:type', authMiddleware, (req, res) => {
    const { type } = req.params;
    let db = readDB();
    const data = db.userData[req.userId][type] || [];
    res.json(data);
});

// Add new item to a type
app.post('/api/data/:type', authMiddleware, (req, res) => {
    const { type } = req.params;
    let db = readDB();
    
    if (!db.userData[req.userId][type]) {
        db.userData[req.userId][type] = [];
    }

    const today = getTodayDate();
    const now = getNow();
    const newItem = {
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        activityDate: req.body.date || today,
        completed: false,
        ...(type === 'dashboardTasks' ? { status: 'Not Started' } : {}),
        ...req.body
    };

    updateDailyHistory(newItem);

    // Todo limit check
    if (type === 'todoList' && db.userData[req.userId][type].length >= 10) {
        return res.status(400).json({ error: 'Todo list is limited to 10 items.' });
    }

    db.userData[req.userId][type].push(newItem);
    writeDB(db);
    res.status(201).json(newItem);
});

// Update an item
app.put('/api/data/:type/:id', authMiddleware, (req, res) => {
    const { type, id } = req.params;
    let db = readDB();
    
    const items = db.userData[req.userId][type] || [];
    const index = items.findIndex(t => t.id === id);
    
    if (index === -1) return res.status(404).json({ error: 'Item not found' });

    const existing = items[index];
    const today = getTodayDate();
    const now = getNow();
    const merged = {
        ...existing,
        ...req.body,
        updatedAt: now,
        activityDate: today
    };

    if (type === 'habits' && req.body.completed === true) {
        if (existing.lastCompletedAt !== today) {
            merged.streak = (existing.streak || 0) + 1;
            merged.lastCompletedAt = today;
        }
    }

    if (type === 'habits' && req.body.completed === false && existing.lastCompletedAt === today) {
        merged.lastCompletedAt = existing.lastCompletedAt;
    }

    updateDailyHistory(merged);
    items[index] = merged;
    writeDB(db);
    res.json(items[index]);
});

// Delete an item
app.delete('/api/data/:type/:id', authMiddleware, (req, res) => {
    const { type, id } = req.params;
    let db = readDB();
    
    const items = db.userData[req.userId][type] || [];
    const newItems = items.filter(t => t.id !== id);
    
    if (items.length === newItems.length) {
        return res.status(404).json({ error: 'Item not found' });
    }
    
    db.userData[req.userId][type] = newItems;
    writeDB(db);
    res.status(204).send();
});

// --- AI MOCK ROUTE ---
app.get('/api/recommendations', authMiddleware, (req, res) => {
    let db = readDB();
    const tasks = db.userData[req.userId].dashboardTasks || [];
    
    const recommendations = [
        "Drink 2L of water today",
        "Read 10 pages of a book",
        "Take a 15-minute walk",
        "Stretch for 5 minutes",
        "Write down 3 things you're grateful for"
    ];

    // Simple mock logic: shuffle and return 3 random recommendations
    const shuffled = recommendations.sort(() => 0.5 - Math.random());
    res.json(shuffled.slice(0, 3));
});

app.listen(PORT, () => {
    console.log(`Dashboard API Server running on http://localhost:${PORT}`);
});
