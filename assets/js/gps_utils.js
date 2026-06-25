// js/gps_utils.js

function handleUserPositionUpdate(position) {
    const btn = document.getElementById('location-toggle-btn');
    if (!btn || btn.getAttribute('data-tracking-state') === 'off') return;

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    if (window.lastCalculatedPosition) {
        const deltaDistance = calculateHaversineDistance(window.lastCalculatedPosition.lat, window.lastCalculatedPosition.lon, lat, lon);
        if (deltaDistance < 10) return; // Discard precision micro-jittering
    }

    window.lastCalculatedPosition = { lat, lon };

    if (!window.userLocationMarker) {
        const pulseIcon = L.divIcon({
            html: `<div class="user-pulse-core"></div><div class="user-pulse-ring"></div>`,
            className: 'user-location-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        window.userLocationMarker = L.marker([lat, lon], { icon: pulseIcon }).addTo(window.map);
        window.userAccuracyCircle = L.circle([lat, lon], {
            radius: accuracy, color: '#d946ef', weight: 1, fillColor: '#d946ef', fillOpacity: 0.15, pane: 'busStopsPane'
        }).addTo(window.map);

        window.map.setView([lat, lon], 15);
        btn.setAttribute('data-tracking-state', 'locked');
    } else {
        window.userLocationMarker.setLatLng([lat, lon]);
        window.userAccuracyCircle.setLatLng([lat, lon]);
        window.userAccuracyCircle.setRadius(accuracy);

        if (btn.getAttribute('data-tracking-state') === 'locked') {
            window.map.panTo([lat, lon]);
        }
    }
}

function handleUserPositionError(err) {
    console.warn(`[GPS Engine Error ${err.code}]: ${err.message}`);
    stopUserLocationTracking();
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) indicator.textContent = 'Location access denied or timed out.';
}

window.startUserLocationTracking = function() {
    const btn = document.getElementById('location-toggle-btn');
    if (!btn || window.geolocationWatchId !== null) return;

    btn.setAttribute('data-tracking-state', 'seeking');

    if (!navigator.geolocation) {
        console.error("Geolocation API isn't supported by this browser.");
        btn.setAttribute('data-tracking-state', 'off');
        return;
    }

    window.geolocationWatchId = navigator.geolocation.watchPosition(
        handleUserPositionUpdate,
        handleUserPositionError,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

window.stopUserLocationTracking = function() {
    const btn = document.getElementById('location-toggle-btn');
    if (window.geolocationWatchId !== null) {
        navigator.geolocation.clearWatch(window.geolocationWatchId);
        window.geolocationWatchId = null;
    }
    if (window.userLocationMarker) { window.map.removeLayer(window.userLocationMarker); window.userLocationMarker = null; }
    if (window.userAccuracyCircle) { window.map.removeLayer(window.userAccuracyCircle); window.userAccuracyCircle = null; }
    window.lastCalculatedPosition = null;
    if (btn) btn.setAttribute('data-tracking-state', 'off');
}
