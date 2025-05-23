// Создаем карту и ставим центр на Москву
var map = L.map('map').setView([55.751244, 37.618423], 10);
loadUserMarkers();

// Добавляем слой OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Карта © OpenStreetMap участники'
}).addTo(map);

// Массивы
var points = [];
var markers = [];
var routeLine = null;
let userMarkers = [];
let activeMarkerId = null;

// Функции
function addMarker(lat, lng, label) {
    var marker = L.marker([lat, lng]).addTo(map).bindPopup(label).openPopup();
    markers.push(marker);
}

function loadUserMarkers() {
    fetch("/get_markers")
        .then(res => res.json())
        .then(data => {
            data.forEach(marker => {
                const m = L.marker([marker.lat, marker.lon])
                    .addTo(map)
                    .bindPopup(marker.name)
                    .on("click", () => openEditModal(marker));

                // Показываем всплывающую подсказку при наведении
                setTimeout(() => {
                    if (m.getElement()) {
                        m.getElement().setAttribute("title", marker.name);
                    }
                }, 0);

                userMarkers.push({ leaflet: m, data: marker });
            });
        });
}

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
    }).then(() => {
        userMarkers.forEach(m => {
            if (m.data.id === activeMarkerId) {
                m.data.name = newName;
                m.leaflet.setPopupContent(newName);
                setTimeout(() => {
                    if (m.leaflet.getElement()) {
                        m.leaflet.getElement().setAttribute("title", newName);
                    }
                }, 0);
            }
        });
        closeModal();
    });
});

document.getElementById("deleteMarkerBtn").addEventListener("click", () => {
    if (!activeMarkerId) return;
    fetch(`/delete_marker/${activeMarkerId}`, { method: "DELETE" })
        .then(() => {
            userMarkers = userMarkers.filter(m => {
                if (m.data.id === activeMarkerId) {
                    map.removeLayer(m.leaflet);
                    return false;
                }
                return true;
            });
            closeModal();
        });
});

document.getElementById("cancelMarkerBtn").addEventListener("click", closeModal);

map.on("contextmenu", function (e) {
    const name = prompt("Введите название метки:");
    if (!name) return;

    fetch("/save_marker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: name,
            lat: e.latlng.lat,
            lon: e.latlng.lng
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const m = L.marker([e.latlng.lat, e.latlng.lng])
                .addTo(map)
                .bindPopup(name)
                .on("click", () => openEditModal({ id: data.id, name: name, lat: e.latlng.lat, lon: e.latlng.lng }));

            setTimeout(() => {
                if (m.getElement()) {
                    m.getElement().setAttribute("title", name);
                }
            }, 0);

            userMarkers.push({ leaflet: m, data: { id: data.id, name: name, lat: e.latlng.lat, lon: e.latlng.lng } });
        }
    });
});

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

document.getElementById('build-route').addEventListener('click', function () {
    if (points.length !== 2) {
        alert('Нужно выбрать ровно 2 точки!');
        return;
    }

    var routeType = document.getElementById('route-type').value;
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

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
            points: points,
            profile: routeType,
            route: data.route,
            distance: data.distance,
            duration: data.duration
        }));
    })
    .catch(error => console.error('Ошибка маршрута:', error));
});

document.getElementById('reset-map').addEventListener('click', function () {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    points = [];
    document.getElementById('route-info').textContent = '';
    document.getElementById('build-route').disabled = true;
    localStorage.removeItem('lastRoute');

    console.log('Карта очищена');
});

window.addEventListener('load', () => {
    const saved = localStorage.getItem('lastRoute');
    if (!saved) return;

    const data = JSON.parse(saved);
    document.getElementById('route-type').value = data.profile;
    points = data.points;

    data.points.forEach((pair, index) => {
        const lat = pair[1];
        const lng = pair[0];
        const label = index === 0 ? 'Стартовая точка' : 'Финишная точка';
        const marker = L.marker([lat, lng]).addTo(map).bindPopup(label);
        markers.push(marker);
    });

    routeLine = L.polyline(data.route, { color: 'blue' }).addTo(map);
    map.fitBounds(routeLine.getBounds());

    const distanceKm = (data.distance / 1000).toFixed(2);
    const durationMin = Math.round(data.duration / 60);
    document.getElementById('route-info').textContent =
        `Расстояние: ${distanceKm} км · Время: ${durationMin} мин`;

    document.getElementById('build-route').disabled = false;
});