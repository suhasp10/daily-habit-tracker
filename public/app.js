document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('habitUser'));
    if (!user) { window.location.href = '/login.html'; return; }

    const state = { viewedDate: new Date(), calendarMonth: new Date() };

    // --- Element References ---
    const welcomeUserEl = document.getElementById('welcome-user');
    const dateElement = document.getElementById('current-date');
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    const habitListEl = document.getElementById('habit-list');
    const statsCompletedEl = document.getElementById('stats-completed');
    const quoteTextEl = document.getElementById('quote-text');
    const calendarGridEl = document.querySelector('.calendar-grid');
    const monthYearHeaderEl = document.getElementById('month-year-header');
    const homeGreetingEl = document.getElementById('home-greeting');
    const homeStatsStreakEl = document.getElementById('home-stats-streak');
    const activityChartEl = document.getElementById('activity-chart');
    const insightStrongestEl = document.getElementById('insight-strongest');
    const insightFocusEl = document.getElementById('insight-focus');

    // --- Core Rendering Functions ---
    const renderHomeSnapshot = async () => {
        const currentHour = new Date().getHours();
        let greeting = (currentHour < 12) ? "Good Morning" : (currentHour < 18) ? "Good Afternoon" : "Good Evening";
        homeGreetingEl.textContent = `${greeting}, ${user.username}!`;

        const response = await fetch(`/api/home-snapshot/${user.id}`);
        const data = await response.json();
        homeStatsStreakEl.textContent = data.currentStreak;

        activityChartEl.innerHTML = '';
        const weeklyDataMap = new Map(data.weeklyActivity.map(item => [item.date, item.completed]));
        const maxCompleted = Math.max(...(data.weeklyActivity.map(d => d.completed)), 1);
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = date.toLocaleString('en-US', { weekday: 'short' });
            const completedCount = weeklyDataMap.get(dateStr) || 0;
            const barHeight = (completedCount / maxCompleted) * 100;
            const barWrapper = document.createElement('div');
            barWrapper.className = 'chart-bar-wrapper';
            barWrapper.innerHTML = `<div class="chart-bar" style="height: ${barHeight}%"><span class="tooltip">${completedCount} completed</span></div><span class="chart-label">${dayName}</span>`;
            activityChartEl.appendChild(barWrapper);
        }
    };

    const renderUIForDate = (date) => {
        const dateISO = date.toISOString().split('T')[0];
        const todayISO = new Date().toISOString().split('T')[0];
        dateElement.textContent = (dateISO === todayISO) ? "Today" : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        nextDayBtn.disabled = new Date(dateISO) >= new Date(todayISO);
        loadDashboard(dateISO);
        loadHabits(dateISO);
    };

    const loadDashboard = async (dateISO) => {
        const response = await fetch(`/api/dashboard/${user.id}/${dateISO}`);
        const data = await response.json();
        statsCompletedEl.textContent = `${data.completed} / ${data.total}`;
        quoteTextEl.textContent = `"${data.quote}"`;

        const insightsResponse = await fetch(`/api/habit-insights/${user.id}`);
        const insightsData = await insightsResponse.json();
        insightStrongestEl.textContent = insightsData.strongest;
        insightFocusEl.textContent = insightsData.focusOn;
    };

    const loadHabits = async (dateISO) => {
        const response = await fetch(`/api/habits/${user.id}/${dateISO}`);
        const data = await response.json();
        habitListEl.innerHTML = '';
        if (data.habits.length === 0) {
            habitListEl.innerHTML = '<li class="empty-message">No habits added.</li>';
        } else {
            data.habits.forEach(renderHabit);
        }
    };

    const renderHabit = (habit) => {
        const li = document.createElement('li');
        li.className = `habit-item ${habit.completed ? 'completed' : ''}`;
        li.innerHTML = `
            <label class="habit-checkbox">
                <input type="checkbox" ${habit.completed ? 'checked' : ''}>
                <span class="checkbox-box"></span>
            </label>
            <span class="habit-name">${habit.name}</span>
            <button class="delete-btn">×</button>`;
        const checkbox = li.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => toggleHabit(habit.id, checkbox.checked, li));
        li.querySelector('.delete-btn').addEventListener('click', () => deleteHabit(habit.id));
        habitListEl.appendChild(li);
    };

    const renderCalendar = async () => {
        const year = state.calendarMonth.getFullYear();
        const month = state.calendarMonth.getMonth() + 1;
        monthYearHeaderEl.textContent = state.calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const response = await fetch(`/api/calendar/${user.id}/${year}/${month}`);
        const data = await response.json();
        const completionsMap = new Map(data.completions.map(c => [c.date, c]));
        calendarGridEl.querySelectorAll('.day').forEach(d => d.remove());
        const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let i = 0; i < firstDayOfMonth; i++) { calendarGridEl.insertAdjacentHTML('beforeend', `<div class="day empty"></div>`); }
        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'day in-month';
            dayEl.textContent = i;
            const dayString = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const completionData = completionsMap.get(dayString);
            let levelClass = 'level-0', tooltipText = "No habits completed";
            if (completionData && completionData.total_habits > 0) {
                const percentage = completionData.completed_count / completionData.total_habits;
                tooltipText = `${completionData.completed_count} of ${completionData.total_habits} habits done`;
                if (percentage >= 1) levelClass = 'level-4';
                else if (percentage >= 0.75) levelClass = 'level-3';
                else if (percentage >= 0.5) levelClass = 'level-2';
                else if (percentage > 0) levelClass = 'level-1';
            }
            dayEl.classList.add(levelClass);
            dayEl.insertAdjacentHTML('beforeend', `<span class="calendar-tooltip">${tooltipText}</span>`);
            calendarGridEl.appendChild(dayEl);
        }
    };

    // --- API Call Functions ---
   const addHabit = async (name) => {
    try {
        const response = await fetch(`/api/habits/${user.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });

        // This is the fix. We now check if the server responded with an error.
        if (!response.ok) {
            const errorData = await response.json();
            // This shows the pop-up message from the server.
            alert(errorData.error || 'Could not add habit.'); 
        } else {
            // This part only runs if the habit was added successfully.
            renderUIForDate(state.viewedDate);
        }

    } catch (error) {
        // This catch is for network errors (e.g., no internet).
        console.error('Network error:', error);
        alert('A network error occurred. Please try again.');
    }
};
    
    const toggleHabit = async (habitId, isCompleted, listItem) => {
        listItem.classList.toggle('completed', isCompleted);
        await fetch(`/api/habits/${habitId}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: state.viewedDate.toISOString().split('T')[0], completed: isCompleted }) });
        loadDashboard(state.viewedDate.toISOString().split('T')[0]);
        if (document.querySelector('.tab-link[data-tab="home"]').classList.contains('active')) { renderHomeSnapshot(); }
    };

    const deleteHabit = async (habitId) => {
        if (!confirm('Are you sure you want to permanently delete this habit?')) return;
        await fetch(`/api/habits/${habitId}`, { method: 'DELETE' });
        renderUIForDate(state.viewedDate);
    };

    // --- Event Listeners ---
    welcomeUserEl.textContent = `Welcome, ${user.username}!`;
    document.querySelector('.logout-btn').addEventListener('click', () => { localStorage.removeItem('habitUser'); window.location.href = '/login.html'; });

    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-link, .tab-content').forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
            if (tab.dataset.tab === 'home') { renderHomeSnapshot(); }
            if (tab.dataset.tab === 'calendar') { state.calendarMonth = new Date(); renderCalendar(); }
            if (tab.dataset.tab === 'dashboard') { loadDashboard(state.viewedDate.toISOString().split('T')[0]); }
        });
    });
    
    document.getElementById('add-habit-form').addEventListener('submit', (e) => { e.preventDefault(); const habitInput = e.target.querySelector('#habit-input'); const name = habitInput.value.trim(); if (name) { addHabit(name); habitInput.value = ''; } });
    prevDayBtn.addEventListener('click', () => { state.viewedDate.setDate(state.viewedDate.getDate() - 1); renderUIForDate(state.viewedDate); });
    nextDayBtn.addEventListener('click', () => { state.viewedDate.setDate(state.viewedDate.getDate() + 1); renderUIForDate(state.viewedDate); });
    document.getElementById('prev-month-btn-calendar').addEventListener('click', () => { state.calendarMonth.setMonth(state.calendarMonth.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month-btn-calendar').addEventListener('click', () => { state.calendarMonth.setMonth(state.calendarMonth.getMonth() + 1); renderCalendar(); });

    // --- Initial Page Load ---
    renderUIForDate(state.viewedDate);
    renderHomeSnapshot();
});