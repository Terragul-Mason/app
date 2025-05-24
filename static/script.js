// === КАРТА И ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ===
var map = L.map('map').setView([55.751244, 37.618423], 10);
loadUserMarkers();
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Карта © OpenStreetMap участники'
}).addTo(map);

var points = [];
var markers = [];
var routeLine = null;
let userMarkers = [];
let activeMarkerId = null;

// === ДОБАВЛЕНИЕ МАРКЕРА НА КАРТУ ===
function addMarker(lat, lng, label) {
    var marker = L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
    markers.push(marker);
}

// === ЗАГРУЗКА ПОЛЬЗОВАТЕЛЬСКИХ МЕТОК ===
function loadUserMarkers() {
    fetch("/get_markers")
        .then(res => res.json())
        .then(data => {
            data.forEach(marker => {
                const m = L.marker([marker.lat, marker.lon])
                    .addTo(map)
                    .bindPopup(marker.name)
                    .on("click", () => openEditModal(marker));

                // Подсказка при наведении
                setTimeout(() => {
                    if (m.getElement()) {
                        m.getElement().setAttribute("title", marker.name);
                    }
                }, 0);

                userMarkers.push({ leaflet: m, data: marker });

                // Добавим кнопку использования
                const list = document.getElementById("marker-list");
                if (list) {
                    const li = document.createElement("li");
                    li.innerHTML = `${marker.name} 
                    <button onclick="useMarker(${marker.lat}, ${marker.lon})">➤</button>`;
                    list.appendChild(li);
                }
            });
        });
}

// === ИСПОЛЬЗОВАТЬ МЕТКУ ДЛЯ МАРШРУТА ===
function useMarker(lat, lon) {
    if (points.length >= 2) {
        alert("Можно выбрать только 2 точки! Очистите карту.");
        return;
    }
    points.push([lon, lat]);
    const label = points.length === 1 ? "Стартовая точка (из метки)" : "Финишная точка (из метки)";
    addMarker(lat, lon, label);
    if (points.length === 2) document.getElementById("build-route").disabled = false;
}

// === МОДАЛКА ДЛЯ РЕДАКТИРОВАНИЯ ===
function openEditModal(marker) {
    document.getElementById("markerEditText").value = marker.name;
    activeMarkerId = marker.id;
    document.getElementById("markerModal").classList.remove("hidden");
}
function closeModal() {
    document.getElementById("markerModal").classList.add("hidden");
    activeMarkerId = null;
}
document.getElementById("saveMarkerBtn").addEventListener("click", () => {
    const newName = document.getElementById("markerEditText").value;
    if (!activeMarkerId || !newName) return;
    fetch("/update_marker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeMarkerId, name: newName })
    }).then(() => location.reload());
});
document.getElementById("deleteMarkerBtn").addEventListener("click", () => {
    if (!activeMarkerId) return;
    fetch(`/delete_marker/${activeMarkerId}`, { method: "DELETE" }).then(() => location.reload());
});
document.getElementById("cancelMarkerBtn").addEventListener("click", closeModal);

// === ПРАВЫЙ КЛИК ДЛЯ ДОБАВЛЕНИЯ МЕТКИ ===
map.on("contextmenu", function (e) {
    const name = prompt("Название метки:");
    if (!name) return;
    fetch("/save_marker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, lat: e.latlng.lat, lon: e.latlng.lng })
    }).then(() => location.reload());
});

// === ЛКМ НА КАРТЕ ===
map.on('click', function (e) {
    if (points.length >= 2) {
        alert('Можно выбрать только 2 точки!');
        return;
    }
    var coord = e.latlng;
    points.push([coord.lng, coord.lat]);
    var label = points.length === 1 ? 'Стартовая точка' : 'Финишная точка';
    addMarker(coord.lat, coord.lng, label);
    if (points.length === 2) document.getElementById('build-route').disabled = false;
});

// === СТРОИТЬ МАРШРУТ ===
document.getElementById('build-route').addEventListener('click', function () {
    if (points.length !== 2) return alert('Нужно выбрать 2 точки!');
    var routeType = document.getElementById('route-type').value;
    if (routeLine) map.removeLayer(routeLine);
    fetch('/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: points, profile: routeType })
    })
    .then(response => response.json())
    .then(data => {
        routeLine = L.polyline(data.route, { color: 'blue' }).addTo(map);
        map.fitBounds(routeLine.getBounds());
        const distanceKm = (data.distance / 1000).toFixed(2);
        const durationMin = Math.round(data.duration / 60);
        document.getElementById('route-info').textContent =
            `Расстояние: ${distanceKm} км · Время: ${durationMin} мин`;
        localStorage.setItem('lastRoute', JSON.stringify({
            points, profile: routeType, route: data.route,
            distance: data.distance, duration: data.duration
        }));
    });
});

// === СБРОС КАРТЫ ===
document.getElementById('reset-map').addEventListener('click', function () {
    markers.forEach(m => map.removeLayer(m));
    markers = []; points = [];
    if (routeLine) map.removeLayer(routeLine);
    routeLine = null;
    document.getElementById('route-info').textContent = '';
    document.getElementById('build-route').disabled = true;
    localStorage.removeItem('lastRoute');
});

// === ВОССТАНОВЛЕНИЕ ИЗ LOCALSTORAGE ===
window.addEventListener('load', () => {
    const saved = localStorage.getItem('lastRoute');
    if (!saved) return;
    const data = JSON.parse(saved);
    points = data.points;
    data.points.forEach((pair, index) => {
        const label = index === 0 ? 'Стартовая точка' : 'Финишная точка';
        const marker = L.marker([pair[1], pair[0]]).addTo(map).bindPopup(label);
        markers.push(marker);
    });
    routeLine = L.polyline(data.route, { color: 'blue' }).addTo(map);
    map.fitBounds(routeLine.getBounds());
    const distanceKm = (data.distance / 1000).toFixed(2);
    const durationMin = Math.round(data.duration / 60);
    document.getElementById('route-info').textContent =
        `Расстояние: ${distanceKm} км · Время: ${durationMin} мин`;
    document.getElementById('route-type').value = data.profile;
    document.getElementById('build-route').disabled = false;
});