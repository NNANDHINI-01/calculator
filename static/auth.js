// auth.js - Works for index.html, register.html and calculator.html (check auth)
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutBtn = document.getElementById('logoutBtn');

    // If on calculator page, check auth
    if (window.location.pathname.includes('calculator.html')) {
        checkAuth();
    }

    // LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const messageDiv = document.getElementById('message');

            try {
                const resp = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await resp.json();
                if (data.success) {
                    messageDiv.className = 'message success';
                    messageDiv.textContent = 'Login successful! Redirecting...';
                    window.location.href = 'calculator.html';
                } else {
                    messageDiv.className = 'message error';
                    messageDiv.textContent = data.message || 'Login failed';
                }
            } catch (err) {
                messageDiv.className = 'message error';
                messageDiv.textContent = 'Error connecting to server';
            }
        });
    }

    // REGISTER
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const messageDiv = document.getElementById('message');

            if (password !== confirmPassword) {
                messageDiv.className = 'message error';
                messageDiv.textContent = 'Passwords do not match';
                return;
            }

            try {
                const resp = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await resp.json();
                if (data.success) {
                    messageDiv.className = 'message success';
                    messageDiv.textContent = 'Registered! Redirecting to login...';
                    setTimeout(() => window.location.href = 'index.html', 1200);
                } else {
                    messageDiv.className = 'message error';
                    messageDiv.textContent = data.message || 'Registration failed';
                }
            } catch (err) {
                messageDiv.className = 'message error';
                messageDiv.textContent = 'Error connecting to server';
            }
        });
    }

    // LOGOUT
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function() {
            try {
                await fetch('/api/logout');
                window.location.href = 'index.html';
            } catch (err) {
                window.location.href = 'index.html';
            }
        });
    }
});

async function checkAuth() {
    try {
        const resp = await fetch('/api/auth/check');
        const data = await resp.json();
        if (!data.authenticated) {
            window.location.href = 'index.html';
            return;
        }
        const welcomeUser = document.getElementById('welcomeUser');
        if (welcomeUser) welcomeUser.textContent = `Welcome, ${data.username}!`;
    } catch (err) {
        window.location.href = 'index.html';
    }
}
