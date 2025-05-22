from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__, template_folder='templates', static_folder='static')

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
