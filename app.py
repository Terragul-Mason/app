from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask import session

from flask import Flask, render_template, request, jsonify
import requests

from flask import render_template, request, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash

import csv
from io import StringIO
from flask import Response

app = Flask(__name__, template_folder='templates', static_folder='static')

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:admin@localhost:5432/route_app'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.secret_key = 'секретный_ключ'

db = SQLAlchemy(app)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Route(db.Model):
    __tablename__ = 'routes'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    start_point = db.Column(db.String, nullable=False)
    end_point = db.Column(db.String, nullable=False)
    profile = db.Column(db.String, nullable=False)
    distance = db.Column(db.Float)
    duration = db.Column(db.Float)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    user = db.relationship('User', backref=db.backref('routes', lazy=True))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if User.query.filter_by(username=username).first():
            return 'Пользователь уже существует'

        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/history')
def history():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user_routes = Route.query.filter_by(user_id=session['user_id']).order_by(Route.created_at.desc()).all()
    return render_template('history.html', routes=user_routes)

@app.route('/delete_route/<int:route_id>', methods=['POST'])
def delete_route(route_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    route = Route.query.get(route_id)
    if route and route.user_id == session['user_id']:
        db.session.delete(route)
        db.session.commit()

    return redirect(url_for('history'))

@app.route('/clear_routes', methods=['POST'])
def clear_routes():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    Route.query.filter_by(user_id=session['user_id']).delete()
    db.session.commit()
    return redirect(url_for('history'))

@app.route('/delete_all_routes', methods=['POST'])
def delete_all_routes():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    Route.query.filter_by(user_id=session['user_id']).delete()
    db.session.commit()
    return redirect(url_for('history'))

@app.route('/export_routes')
def export_routes():
    if 'user_id' not in session:
        return redirect(url_for('login'))

    routes = Route.query.filter_by(user_id=session['user_id']).order_by(Route.created_at.desc()).all()

    # создаём CSV в памяти
    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['Начало', 'Конец', 'Профиль', 'Расстояние (м)', 'Длительность (сек)', 'Дата'])

    for route in routes:
        writer.writerow([
            route.start_point,
            route.end_point,
            route.profile,
            f'{route.distance:.2f}',
            f'{route.duration:.2f}',
            route.created_at.strftime('%Y-%m-%d %H:%M')
        ])

    output = si.getvalue()
    si.close()

    filename = f'routes_{session["username"]}.csv'
    return Response(
        output,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment;filename={filename}'}
    )

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            session['is_admin'] = (user.username == 'admin')
            if user.username == 'admin':
                return redirect(url_for('admin_panel'))
            else:
                return redirect(url_for('index'))
        return 'Неверный логин или пароль'

    return render_template('login.html')

@app.route('/admin')
def admin_panel():
    if not session.get('is_admin'):
        return redirect(url_for('index'))

    all_routes = Route.query.order_by(Route.created_at.desc()).all()
    return render_template('admin.html', routes=all_routes)

@app.route('/admin/delete/<int:route_id>', methods=['POST'])
def admin_delete_route(route_id):
    if not session.get('is_admin'):
        return redirect(url_for('index'))
    route = Route.query.get(route_id)
    if route:
        db.session.delete(route)
        db.session.commit()
    return redirect(url_for('admin_panel'))


@app.route('/admin/delete_all', methods=['POST'])
def admin_delete_all():
    if not session.get('is_admin'):
        return redirect(url_for('index'))
    Route.query.delete()
    db.session.commit()
    return redirect(url_for('admin_panel'))


@app.route('/admin/export')
def admin_export():
    if not session.get('is_admin'):
        return redirect(url_for('index'))

    all_routes = Route.query.order_by(Route.created_at.desc()).all()

    from io import StringIO
    import csv
    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['Пользователь', 'Начало', 'Конец', 'Профиль', 'Расстояние (м)', 'Длительность (сек)', 'Дата'])

    for r in all_routes:
        writer.writerow([
            r.user.username,
            r.start_point,
            r.end_point,
            r.profile,
            f'{r.distance:.2f}',
            f'{r.duration:.2f}',
            r.created_at.strftime('%Y-%m-%d %H:%M')
        ])

    output = si.getvalue()
    si.close()

    return Response(
        output,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment;filename=all_routes.csv'}
    )

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/')
def index():
    if session.get('is_admin'):
        return redirect(url_for('admin_panel'))
    return render_template('index.html')

@app.route('/route', methods=['POST'])
def route():
    data = request.get_json()
    points = data['points']
    profile = data['profile']

    lng1, lat1 = points[0]
    lng2, lat2 = points[1]

    url = f"http://router.project-osrm.org/route/v1/{profile}/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson"
    response = requests.get(url)
    route_data = response.json()

    coords = route_data['routes'][0]['geometry']['coordinates']
    distance = route_data['routes'][0]['distance']
    duration = route_data['routes'][0]['duration']

    leaflet_coords = [[lat, lng] for lng, lat in coords]

    # Сохраняем маршрут в базу, если пользователь залогинен
    if 'user_id' in session:
        route_record = Route(
            user_id=session['user_id'],
            start_point=f"{lat1:.6f},{lng1:.6f}",
            end_point=f"{lat2:.6f},{lng2:.6f}",
            profile=profile,
            distance=distance,
            duration=duration
        )
        db.session.add(route_record)
        db.session.commit()

    return jsonify({
        'route': leaflet_coords,
        'distance': distance,
        'duration': duration
    })



if __name__ == '__main__':
    app.run(debug=True)
