# app.py — Flask backend for Stack Calculator

from flask import Flask, request, jsonify, session, redirect, url_for, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
import sqlite3, os, math
from datetime import datetime
from functools import wraps

# Load environment variables
load_dotenv()

# --- Configuration ---
DATABASE = 'db.sqlite3'
SECRET_KEY = os.environ.get('FLASK_SECRET', 'change_this_to_random')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

app = Flask(__name__, static_folder='static', static_url_path='')
app.secret_key = SECRET_KEY

# Optional Google OAuth
oauth = OAuth(app) if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET else None
if oauth:
    oauth.register(
        name='google',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        access_token_url='https://oauth2.googleapis.com/token',
        authorize_url='https://accounts.google.com/o/oauth2/v2/auth',
        api_base_url='https://www.googleapis.com/oauth2/v2/',
        client_kwargs={'scope': 'openid email profile'},
    )

# --- Database helpers ---
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        created_at TEXT
    );''')
    cur.execute('''CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        operation_type TEXT,
        input_data TEXT,
        result TEXT,
        created_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );''')
    conn.commit()
    conn.close()

init_db()

# --- Login check decorator ---
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated

# --- Serve frontend ---
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    safe_path = os.path.join(app.static_folder, os.path.normpath(filename))
    if os.path.isfile(safe_path):
        return send_from_directory(app.static_folder, filename)
    return send_from_directory(app.static_folder, 'index.html')

# --- Auth endpoints ---
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    username, email, password = data.get('username'), data.get('email'), data.get('password')

    if not username or not email or not password:
        return jsonify({'success': False, 'message': 'Missing fields'}), 400

    hashed = generate_password_hash(password)
    created_at = datetime.utcnow().isoformat()

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute('INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
                    (username, email, hashed, created_at))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Registered successfully'})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Username or email already exists'}), 409

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username, password = data.get('username'), data.get('password')

    if not username or not password:
        return jsonify({'success': False, 'message': 'Missing username/password'}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, password_hash, username FROM users WHERE username = ? OR email = ?', (username, username))
    user = cur.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'success': True, 'message': 'Login successful', 'username': user['username']})

@app.route('/api/auth/check', methods=['GET'])
def api_check():
    if 'user_id' in session:
        return jsonify({'authenticated': True, 'username': session.get('username')})
    return jsonify({'authenticated': False})

@app.route('/api/logout', methods=['GET'])
def api_logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out'})

# --- Google OAuth (optional) ---
@app.route('/login/google')
def login_google():
    if not oauth:
        return 'Google OAuth not configured.', 400
    redirect_uri = url_for('auth_google_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@app.route('/auth/google/callback')
def auth_google_callback():
    if not oauth:
        return 'Google OAuth not configured.', 400
    token = oauth.google.authorize_access_token()
    user_info = oauth.google.get('userinfo').json()
    email = user_info.get('email')
    username = user_info.get('name') or email

    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id FROM users WHERE email = ?', (email,))
    user = cur.fetchone()
    if not user:
        hashed = generate_password_hash(os.urandom(16).hex())
        created_at = datetime.utcnow().isoformat()
        cur.execute('INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
                    (username, email, hashed, created_at))
        conn.commit()
        user_id = cur.lastrowid
    else:
        user_id = user['id']
    conn.close()

    session['user_id'] = user_id
    session['username'] = username
    return redirect('/calculator.html')

# --- Calculation Logic ---
@app.route('/api/calculate', methods=['POST'])
@login_required
def api_calculate():
    data = request.get_json() or {}
    operation = data.get('operation')
    inputs = data.get('inputs', {})

    try:
        result = compute_operation(operation, inputs)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute('INSERT INTO history (user_id, operation_type, input_data, result, created_at) VALUES (?, ?, ?, ?, ?)',
                (session['user_id'], operation, str(inputs), str(result), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'result': result})

def infix_to_postfix(expression):
    stack = []
    output = []
    precedence = {'+': 1, '-': 1, '*': 2, '/': 2, '^': 3}

    for ch in expression:
        if ch.isalnum():
            output.append(ch)
        elif ch == '(':
            stack.append(ch)
        elif ch == ')':
            while stack and stack[-1] != '(':
                output.append(stack.pop())
            stack.pop()
        else:
            while stack and stack[-1] != '(' and precedence.get(ch, 0) <= precedence.get(stack[-1], 0):
                output.append(stack.pop())
            stack.append(ch)

    while stack:
        output.append(stack.pop())

    return ''.join(output)


def infix_to_prefix(expression):
    # Reverse and swap brackets
    expression = expression[::-1]
    expression = ''.join(['(' if c == ')' else ')' if c == '(' else c for c in expression])
    postfix = infix_to_postfix(expression)
    return postfix[::-1]

def compute_operation(operation, inputs):

    if operation == 'simple_interest':
        p, r, t = float(inputs['principal']), float(inputs['rate']), float(inputs['time'])
        return round((p * r * t) / 100, 2)
    elif operation == 'infix_to_postfix':
        expression = inputs.get('expression', '')
        return infix_to_postfix(expression)

    elif operation == 'infix_to_prefix':
        expression = inputs.get('expression', '')
        return infix_to_prefix(expression)
    elif operation == 'compound_interest':
        p, r, t, n = float(inputs['principal']), float(inputs['rate']), float(inputs['time']), int(inputs['frequency'])
        a = p * ((1 + (r / 100) / n) ** (n * t))
        return round(a - p, 2)
    elif operation == 'circle_area':
        return round(math.pi * float(inputs['radius']) ** 2, 2)
    elif operation == 'rectangle_area':
        return round(float(inputs['length']) * float(inputs['width']), 2)
    elif operation == 'factorial':
        n = int(inputs['number'])
        return math.factorial(n)
    elif operation == 'average':
        nums = [float(x) for x in inputs['numbers']]
        return sum(nums) / len(nums)
    else:
        raise ValueError("Unsupported operation")

# --- History endpoints ---
@app.route('/api/history', methods=['GET'])
@login_required
def api_history():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, operation_type, input_data, result, created_at FROM history WHERE user_id = ? ORDER BY id DESC',
                (session['user_id'],))
    rows = cur.fetchall()
    conn.close()
    history = [dict(r) for r in rows]
    return jsonify({'success': True, 'history': history})



#@app.route('/api/history/delete_oldest', methods=['POST'])
'''@login_required
def api_delete_oldest():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id FROM history WHERE user_id = ? ORDER BY id ASC LIMIT 1', (session['user_id'],))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({'success': False, 'message': 'No history to delete'})
    cur.execute('DELETE FROM history WHERE id = ?', (row['id'],))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Oldest record deleted'})'''

@app.route('/api/history/oldest', methods=['DELETE'])
def delete_oldest_history():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('DELETE FROM history WHERE id = (SELECT id FROM history ORDER BY created_at ASC LIMIT 1)')
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# --- Admin endpoints ---
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if data['username'] == ADMIN_USERNAME and data['password'] == ADMIN_PASSWORD:
        session['admin'] = True
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Invalid admin credentials'})

def admin_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('admin'):
            return jsonify({'success': False, 'message': 'Admin login required'}), 403
        return f(*args, **kwargs)
    return wrapper

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_users():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, username, email, created_at FROM users')
    rows = cur.fetchall()
    conn.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})

@app.route('/api/admin/history', methods=['GET'])
@admin_required
def admin_history():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT * FROM history')
    rows = cur.fetchall()
    conn.close()
    return jsonify({'success': True, 'data': [dict(r) for r in rows]})


# --- Run server ---
if __name__ == '__main__':
    init_db()
    app.run(debug=True)
    