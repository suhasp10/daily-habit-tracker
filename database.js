const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'habits.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Error opening database', err.message);
    console.log('Connected to the SQLite database.');
});

// Helper functions
const run = (sql, params = []) => new Promise((resolve, reject) => { db.run(sql, params, function(err) { if (err) reject(err); else resolve({ id: this.lastID }); }); });
const get = (sql, params = []) => new Promise((resolve, reject) => { db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); }); });
const all = (sql, params = []) => new Promise((resolve, reject) => { db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); }); });

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY, name TEXT NOT NULL, user_id INTEGER, FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE, UNIQUE(name, user_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS daily_completions (id INTEGER PRIMARY KEY, habit_id INTEGER, date TEXT NOT NULL, FOREIGN KEY (habit_id) REFERENCES habits (id) ON DELETE CASCADE, UNIQUE(habit_id, date))`);
});

const calculateStreak = (allCompletions) => {
    let streak = 0;
    if (allCompletions.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (allCompletions[0].date === todayStr || allCompletions[0].date === yesterdayStr) {
            streak = 1;
            let lastDate = new Date(allCompletions[0].date);
            for (let i = 1; i < allCompletions.length; i++) {
                const currentDate = new Date(allCompletions[i].date);
                if ((lastDate - currentDate) / (1000 * 60 * 60 * 24) === 1) {
                    streak++;
                    lastDate = currentDate;
                } else {
                    break;
                }
            }
        }
    }
    return streak;
};

const findUserByUsername = (username) => get(`SELECT * FROM users WHERE username = ?`, [username]);
const createUser = (username, password) => run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password]);
const getAllHabitsForDate = (userId, date) => all(`SELECT h.id, h.name, EXISTS (SELECT 1 FROM daily_completions dc WHERE dc.habit_id = h.id AND dc.date = ?) as completed FROM habits h WHERE h.user_id = ?`, [date, userId]);
const addHabit = (name, userId) => run(`INSERT INTO habits (name, user_id) VALUES (?, ?)`, [name, userId]);
const deleteHabit = (id) => run(`DELETE FROM habits WHERE id = ?`, [id]);
const addHabitCompletion = (habitId, date) => run(`INSERT INTO daily_completions (habit_id, date) VALUES (?, ?) ON CONFLICT(habit_id, date) DO NOTHING`, [habitId, date]);
const removeHabitCompletion = (habitId, date) => run(`DELETE FROM daily_completions WHERE habit_id = ? AND date = ?`, [habitId, date]);

const getDashboardStats = async (userId, date) => {
    const totalHabits = await get(`SELECT COUNT(*) as count FROM habits WHERE user_id = ?`, [userId]);
    const completedHabits = await get(`SELECT COUNT(*) as count FROM daily_completions dc JOIN habits h ON dc.habit_id = h.id WHERE h.user_id = ? AND dc.date = ?`, [userId, date]);
    return { total: totalHabits.count, completed: completedHabits.count };
};

const getMonthlyCompletions = (userId, yearMonth) => all(`SELECT dc.date, COUNT(dc.habit_id) as completed_count, (SELECT COUNT(*) FROM habits WHERE user_id = ?) as total_habits FROM daily_completions dc JOIN habits h ON dc.habit_id = h.id WHERE h.user_id = ? AND strftime('%Y-%m', dc.date) = ? GROUP BY dc.date`, [userId, userId, yearMonth]);

const getHomeSnapshotData = async (userId) => {
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weeklyActivity = await all(`SELECT date, COUNT(*) as completed FROM daily_completions dc JOIN habits h ON h.id = dc.habit_id WHERE h.user_id = ? AND dc.date >= ? GROUP BY dc.date ORDER BY dc.date DESC`, [userId, sevenDaysAgoStr]);
    const allCompletions = await all(`SELECT DISTINCT date FROM daily_completions dc JOIN habits h ON h.id = dc.habit_id WHERE h.user_id = ? ORDER BY date DESC`, [userId]);
    const currentStreak = calculateStreak(allCompletions);
    return { weeklyActivity, currentStreak };
};

const getHabitInsights = async (userId) => {
    const query = `
        SELECT h.name, COUNT(dc.id) as completion_count
        FROM habits h
        LEFT JOIN daily_completions dc ON h.id = dc.habit_id
        WHERE h.user_id = ?
        GROUP BY h.id
        ORDER BY completion_count
    `;
    const habitsByCount = await all(query, [userId]);
    if (habitsByCount.length === 0) {
        return { strongest: 'N/A', focusOn: 'N/A' };
    }
    const strongest = habitsByCount[habitsByCount.length - 1].name;
    const focusOn = habitsByCount[0].name;
    return { strongest, focusOn };
};

module.exports = { findUserByUsername, createUser, getAllHabitsForDate, addHabit, deleteHabit, addHabitCompletion, removeHabitCompletion, getDashboardStats, getMonthlyCompletions, getHomeSnapshotData, getHabitInsights };