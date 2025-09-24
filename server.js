const express = require('express');
const db = require('./database');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

const motivationalQuotes = [
    "The secret of getting ahead is getting started.",
    "Well done is better than well said.",
    "A year from now you may wish you had started today.",
    "Don't watch the clock; do what it does. Keep going."
];

// --- API ROUTES ---
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'register.html')); });

app.get('/index.html', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        await db.createUser(username, password);
        res.status(201).json({ message: 'User created successfully!' });
    } catch (err) {
        res.status(400).json({ message: 'Username already taken.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.findUserByUsername(username);
    if (!user || user.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials.' });
    }
    res.json({ message: 'Login successful!', user: { id: user.id, username: user.username } });
});

app.get('/api/home-snapshot/:userId', async (req, res) => {
    const snapshotData = await db.getHomeSnapshotData(req.params.userId);
    res.json(snapshotData);
});

app.get('/api/habit-insights/:userId', async (req, res) => {
    const data = await db.getHabitInsights(req.params.userId);
    res.json(data);
});

app.get('/api/habits/:userId/:date', async (req, res) => {
    const habits = await db.getAllHabitsForDate(req.params.userId, req.params.date);
    res.json({ habits });
});

app.post('/api/habits/:userId', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await db.addHabit(name, req.params.userId);
        res.status(201).json({ id: result.id });
    } catch (err) {
        res.status(400).json({ error: 'Habit may already exist.' });
    }
});

app.delete('/api/habits/:id', async (req, res) => {
    await db.deleteHabit(req.params.id);
    res.status(200).json({ message: 'Habit deleted' });
});

app.post('/api/habits/:id/toggle', async (req, res) => {
    const { date, completed } = req.body;
    if (completed) {
        await db.addHabitCompletion(req.params.id, date);
    } else {
        await db.removeHabitCompletion(req.params.id, date);
    }
    res.json({ success: true });
});

app.get('/api/dashboard/:userId/:date', async (req, res) => {
    const stats = await db.getDashboardStats(req.params.userId, req.params.date);
    const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    res.json({ ...stats, quote });
});

app.get('/api/calendar/:userId/:year/:month', async (req, res) => {
    const { userId, year, month } = req.params;
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const completions = await db.getMonthlyCompletions(userId, yearMonth);
    res.json({ completions });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});