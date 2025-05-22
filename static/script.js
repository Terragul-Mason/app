// Создаем карту и ставим центр на Москву
var map = L.map('map').setView([55.751244, 37.618423], 10);

// Добавляем слой OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Карта © OpenStreetMap участники'
}).addTo(map);

// Массив для хранения точек и маркеров
var points = [];
var markers = [];
var routeLine = null;

// Функция для добавления маркера с подписью
function addMarker(lat, lng, label) {
    var marker = L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
    markers.push(marker);
}

// Обработка клика на карту
map.on('click', function (e) {
    if (points.length >= 2) {
        alert('Можно выбрать только 2 точки! Нажмите "Очистить карту", чтобы начать заново.');
        return;
    }

    var coord = e.latlng;
    var lat = coord.lat;
    var lng = coord.lng;

    points.push([lng, lat]);
    if (points.length === 2) {
        document.getElementById('build-route').disabled = false;
    }    

    var label = points.length === 1 ? 'Стартовая точка' : 'Финишная точка';
    addMarker(lat, lng, label);

    console.log("Добавлена точка:", points);
});

// Построение маршрута
document.getElementById('build-route').addEventListener('click', function () {
    if (points.length !== 2) {
        alert('Нужно выбрать ровно 2 точки!');
        return;
    }

    // Получаем выбранный тип маршрута
    var routeType = document.getElementById('route-type').value;

    // Удаляем старый маршрут перед новым
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    fetch('/route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ points: points, profile: routeType })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Маршрут получен:', data);

            routeLine = L.polyline(data.route, { color: 'blue' }).addTo(map);
            map.fitBounds(routeLine.getBounds());

            // Выводим расстояние и время
            const distanceKm = (data.distance / 1000).toFixed(2);
            const durationMin = Math.round(data.duration / 60);

            document.getElementById('route-info').textContent =
                `Расстояние: ${distanceKm} км · Время: ${durationMin} мин`;

                // Сохраняем всё в localStorage
localStorage.setItem('lastRoute', JSON.stringify({
    points: points,
    profile: routeType,
    route: data.route,
    distance: data.distance,
    duration: data.duration
}));

        })
        .catch(error => {
            console.error('Ошибка получения маршрута:', error);
        });
        
        
});

// Очистка карты
document.getElementById('reset-map').addEventListener('click', function () {
    // Удалить маркеры
    markers.forEach(function (marker) {
        map.removeLayer(marker);
    });
    markers = [];

    // Удалить маршрут
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    // Очистить данные
    points = [];

    // Очистить текст
    document.getElementById('route-info').textContent = '';

    document.getElementById('build-route').disabled = true;

    localStorage.removeItem('lastRoute');

    console.log('Карта очищена');

    
});

// При загрузке страницы: восстановление маршрута
window.addEventListener('load', () => {
    const saved = localStorage.getItem('lastRoute');
    if (!saved) return;

    const data = JSON.parse(saved);

    // Восстановим профиль (в селекторе) ДО построения маршрута
    document.getElementById('route-type').value = data.profile;

    // Восстановим точки и маркеры
    points = data.points;
    data.points.forEach((pair, index) => {
        const lat = pair[1];
        const lng = pair[0];
        const label = index === 0 ? 'Стартовая точка' : 'Финишная точка';
        const marker = L.marker([lat, lng]).addTo(map).bindPopup(label);
        markers.push(marker);
    });

    // Восстановим маршрут
    routeLine = L.polyline(data.route, { color: 'blue' }).addTo(map);
    map.fitBounds(routeLine.getBounds());

    // Восстановим надпись
    const distanceKm = (data.distance / 1000).toFixed(2);
    const durationMin = Math.round(data.duration / 60);
    document.getElementById('route-info').textContent =
        `Расстояние: ${distanceKm} км · Время: ${durationMin} мин`;

    // Активируем кнопку построения
    document.getElementById('build-route').disabled = false;

    console.log('Маршрут восстановлен из localStorage');
});
