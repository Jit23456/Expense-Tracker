import os
from functools import wraps
from decimal import Decimal
from datetime import datetime
from datetime import date as Date
from flask import Flask, render_template, request, jsonify, redirect, session, url_for
import mysql.connector
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'change-this-secret-key')

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', ''),
    'database': os.environ.get('DB_NAME', 'py_use_db'),
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def normalize_expense(row):
    row = dict(row)
    if isinstance(row.get('amount'), Decimal):
        row['amount'] = float(row['amount'])
    if isinstance(row.get('date'), Date):
        row['date'] = row['date'].isoformat()
    return row

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            `date` DATE NOT NULL,
            notes TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    seed_default_user(cursor, 'admin', os.environ.get('ADMIN_PASSWORD', 'admin123'), 'admin')
    seed_default_user(cursor, 'user', os.environ.get('USER_PASSWORD', 'user123'), 'user')
    conn.commit()
    cursor.close()
    conn.close()

def seed_default_user(cursor, username, password, role):
    cursor.execute('SELECT id FROM users WHERE username = %s', (username,))
    if cursor.fetchone():
        return
    cursor.execute(
        'INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)',
        (username, generate_password_hash(password), role)
    )

def is_api_request():
    return request.path.startswith('/api/')

def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not session.get('user_id'):
            if is_api_request():
                return jsonify({'error': 'Please log in to continue.'}), 401
            return redirect(url_for('login'))
        return view(*args, **kwargs)
    return wrapped_view

def admin_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not session.get('user_id'):
            if is_api_request():
                return jsonify({'error': 'Please log in to continue.'}), 401
            return redirect(url_for('login'))
        if session.get('role') != 'admin':
            if is_api_request():
                return jsonify({'error': 'Admin access is required.'}), 403
            return render_template('forbidden.html'), 403
        return view(*args, **kwargs)
    return wrapped_view

@app.context_processor
def inject_current_user():
    if not session.get('user_id'):
        return {'current_user': None}
    return {
        'current_user': {
            'id': session.get('user_id'),
            'username': session.get('username'),
            'role': session.get('role')
        }
    }

# Initialize Database on launch
init_db()

@app.route('/')
def index():
    if not session.get('user_id'):
        return redirect(url_for('login'))
    if session.get('role') == 'admin':
        return redirect(url_for('admin_page'))
    return redirect(url_for('user_page'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            'SELECT id, username, password_hash, role FROM users WHERE username = %s',
            (username,)
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            session.clear()
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            if user['role'] == 'admin':
                return redirect(url_for('admin_page'))
            return redirect(url_for('user_page'))

        error = 'Invalid username or password.'

    return render_template('login.html', error=error)

@app.route('/register', methods=['GET', 'POST'])
def register():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')
        role = request.form.get('role', 'user')

        if role not in ('user', 'admin'):
            error = 'Invalid account type.'
        elif not username or not password:
            error = 'Username and password are required.'
        elif len(username) < 3:
            error = 'Username must be at least 3 characters long.'
        elif len(password) < 6:
            error = 'Password must be at least 6 characters long.'
        elif password != confirm:
            error = 'Passwords do not match.'
        else:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute('SELECT id FROM users WHERE username = %s', (username,))
            exists = cursor.fetchone()

            if exists:
                error = 'That username is already taken.'
                cursor.close()
                conn.close()
            else:
                cursor.execute(
                    'INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)',
                    (username, generate_password_hash(password), role)
                )
                conn.commit()
                new_id = cursor.lastrowid
                cursor.close()
                conn.close()

                session.clear()
                session['user_id'] = new_id
                session['username'] = username
                session['role'] = role
                if role == 'admin':
                    return redirect(url_for('admin_page'))
                return redirect(url_for('user_page'))

    return render_template('register.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/user')
@login_required
def user_page():
    return render_template('user.html')

@app.route('/admin')
@admin_required
def admin_page():
    return render_template('admin.html')

@app.route('/service')
@app.route('/services')
def service_page():
    return render_template('Service.html')

@app.route('/contact')
def contact_page():
    return render_template('contact.html')

@app.route('/api/expenses', methods=['GET'])
@login_required
def get_expenses():
    category = request.args.get('category')
    search = request.args.get('search')
    
    query = 'SELECT * FROM expenses WHERE 1=1'
    params = []
    
    if category and category != 'All':
        query += ' AND category = %s'
        params.append(category)
        
    if search:
        query += ' AND (title LIKE %s OR notes LIKE %s)'
        params.append(f'%{search}%')
        params.append(f'%{search}%')
        
    query += ' ORDER BY `date` DESC, id DESC'
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(query, params)
    expenses = [normalize_expense(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    
    return jsonify(expenses)

@app.route('/api/expenses', methods=['POST'])
@login_required
def add_expense():
    data = request.get_json()
    title = data.get('title')
    amount = data.get('amount')
    category = data.get('category', 'General')
    date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
    notes = data.get('notes', '')
    
    if not title or amount is None:
        return jsonify({'error': 'Title and Amount are required.'}), 400
        
    try:
        amount = float(amount)
    except ValueError:
        return jsonify({'error': 'Amount must be a valid number.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO expenses (title, amount, category, `date`, notes) VALUES (%s, %s, %s, %s, %s)',
        (title, amount, category, date_str, notes)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        'id': new_id,
        'title': title,
        'amount': amount,
        'category': category,
        'date': date_str,
        'notes': notes


    }), 201

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
@admin_required
def delete_expense(expense_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM expenses WHERE id = %s', (expense_id,))
    conn.commit()
    rows_affected = cursor.rowcount
    conn.close()
    
    if rows_affected == 0:
        return jsonify({'error': 'Expense not found.'}), 404
        
    return jsonify({'message': 'Expense deleted successfully.'})

@app.route('/api/summary', methods=['GET'])
@login_required
def get_summary():
    conn = get_db_connection()
    
    # Total Spending
    cursor = conn.cursor(dictionary=True)
    cursor.execute('SELECT SUM(amount) as total, COUNT(id) as count FROM expenses')
    total_row = cursor.fetchone()
    total_spent = float(total_row['total'] or 0.0)
    total_count = total_row['count'] or 0
    
    # Spending by Category
    cursor.execute('''
        SELECT category, SUM(amount) as total 
        FROM expenses 
        GROUP BY category 
        ORDER BY total DESC
    ''')
    cat_rows = cursor.fetchall()
    
    category_totals = {row['category']: float(row['total'] or 0.0) for row in cat_rows}
    top_category = cat_rows[0]['category'] if cat_rows else 'N/A'
    
    cursor.close()
    conn.close()
    
    return jsonify({
        'total_spent': round(total_spent, 2),
        'total_count': total_count,
        'top_category': top_category,
        'category_totals': category_totals
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
    
