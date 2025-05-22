from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask import session

from flask import Flask, render_template, request, jsonify
import requests

from flask import render_template, request, redirect, url_for, session
from werkzeug.security import generate_password_hash, check_password_hash


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


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            return redirect(url_for('index'))
        return 'Неверный логин или пароль'

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/route', methods=['POST'])
def route():
    data = request.get_json()
    points = data['points']
    profile = data.get('profile', 'driving')  # получаем тип маршрута, по умолчанию машина

    coords = ';'.join([f"{lng},{lat}" for lng, lat in points])

    osrm_url = f"http://router.project-osrm.org/route/v1/{profile}/{coords}?overview=full&geometries=geojson"
    response = requests.get(osrm_url)

    if response.status_code != 200:
        return jsonify({'error': 'Ошибка запроса к OSRM'}), 500

    route = response.json()

    route_coords = route['routes'][0]['geometry']['coordinates']
    leaflet_coords = [[lat, lng] for lng, lat in route_coords]

    return jsonify({
    'route': leaflet_coords,
    'distance': route['routes'][0]['distance'],
    'duration': route['routes'][0]['duration']
})


if __name__ == '__main__':
    app.run(debug=True)
