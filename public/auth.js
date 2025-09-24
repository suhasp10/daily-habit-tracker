// This script handles the logic for the login and register pages.
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = e.target.username.value;
            const password = e.target.password.value;
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();
            if (response.ok) {
                alert('Registration successful! Please log in.');
                window.location.href = '/login.html';
            } else {
                alert(`Error: ${result.message}`);
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = e.target.username.value;
            const password = e.target.password.value;
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();
            if (response.ok) {
                localStorage.setItem('habitUser', JSON.stringify(result.user));
                window.location.href = '/index.html';
            } else {
                alert(`Error: ${result.message}`);
            }
        });
    }
});