// js/map_utils.js

// Core Map Canvas Engine Setup
window.map = L.map('map', {
    zoomControl: false,
    fullscreenControl: false
}).setView([1.5574, 110.3538], 12);

if (window.map.dragging) {
    window.map.dragging.enable();
}

L.control.zoom({
    position: 'topleft',
    zoomInTitle: window.txtZoomIn,
    zoomOutTitle: window.txtZoomOut
}).addTo(window.map);

L.control.fullscreen({
    position: 'topleft',
    title: {
        'false': window.txtFullscreen,
        'true':  window.txtFullscreenExit
    }
}).addTo(window.map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    attribution: '© OpenStreetMap contributors' 
}).addTo(window.map);

window.map.createPane('busStopsPane');
window.map.getPane('busStopsPane').style.zIndex = 450;
window.map.getPane('busStopsPane').style.pointerEvents = 'none';

window.busLayer = L.layerGroup().addTo(window.map);
window.pathLayer = L.layerGroup().addTo(window.map);
window.stopLayer = L.layerGroup().addTo(window.map);

// Custom Interactive GPS Control Wrapper Definition
const LocationControl = L.Control.extend({
    options: { position: 'topleft' }, 
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-location-control');
        container.innerHTML = `
            <button id="location-toggle-btn" data-tracking-state="off" title="${window.txtGeolocate}" aria-label="${window.txtGeolocate}"
                    style="width: 30px; height: 30px; background: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <svg class="map-svg-use" style="width: 18px; height: 18px;"><use href="#icon-crosshair"></use></svg>
            </button>
        `;
        L.DomEvent.disableClickPropagation(container);
        return container;
    }
});
window.map.addControl(new LocationControl());

// Interactive Legend Setup Block
const legend = L.control({ position: 'topright' });
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
        <div style="font-size: 11px; color: #94a3b8; text-align: center; font-style: italic;">${window.txtLgPrompt}</div>
        <div class="legend-item"><span class="legend-marker-stop"></span><span>${window.txtLgStop}</span></div>
        <div class="legend-item"><span class="legend-marker-stop" style="background-color: #f97316 !important;"></span><span>${window.txtLgInterchange}</span></div>
        <div class="legend-item"><span class="legend-marker-stop" style="background-color: #2563eb !important; width: 14px; height: 14px; margin-left: -2px; margin-right: -2px;"></span><span>${window.txtLgStation}</span></div>
        <div class="legend-item"><div class="legend-bus-icon-preview"><svg class="legend-svg-use"><use href="#icon-bus"></use></svg></div><span>${window.txtLgBus}</span></div>
        <div class="legend-item" style="border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px;">
            <div style="width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; margin-right: 6px; position: relative; padding-top: 6px;">
                <div class="legend-geolocation"><svg class="map-svg-use" style="width: 18px; height: 18px;"><use href="#icon-crosshair"></use></svg></div>
            </div>
            <span style="color: #ffffff; margin-left: -6px; padding-top: 6px;">${window.txtLgGeolocation}</span>
        </div>
    `;
    return div;
};
legend.addTo(window.map);

// --- STATIC TRANSIT MAP PATH & SHAPE LINE DRAW ENGINE ---
window.renderSelectedRouteLine = function(code) {
    window.pathLayer.clearLayers();
    if (code === 'all' || !window.routesPathsData) return;

    const lowerCode = code.toLowerCase();

    if (window.routingCache[lowerCode]) {
        window.routingCache[lowerCode].forEach(polyline => polyline.addTo(window.pathLayer));
        const combinedBounds = L.latLngBounds();
        window.routingCache[lowerCode].forEach(polyline => combinedBounds.extend(polyline.getBounds()));
        if (combinedBounds.isValid()) window.map.fitBounds(combinedBounds, { padding: [40, 40] });
        return;
    }

    let features = window.routesPathsData.features.filter(f => f.properties.routeCode.toLowerCase() === lowerCode);
    if (features.length === 0) return;

    if (features.length === 1) {
        console.warn(`⚠️ Data Deficit Detected on [${code.toUpperCase()}]: Mirroring coordinates failsafe active...`);
        const mirroredFeature = JSON.parse(JSON.stringify(features[0])); 
        if (mirroredFeature.geometry && mirroredFeature.geometry.coordinates) mirroredFeature.geometry.coordinates.reverse();
        mirroredFeature.properties.shape_id += "_mirrored_fallback";
        features.push(mirroredFeature);
    }

    const routingPromises = features.map(feature => {
        let rawCoords = feature.geometry.coordinates;
        if (rawCoords.length > 120) {
            const step = Math.ceil(rawCoords.length / 120);
            const sampled = [];
            for (let i = 0; i < rawCoords.length; i += step) sampled.push(rawCoords[i]);
            if (sampled[sampled.length - 1] !== rawCoords[rawCoords.length - 1]) sampled.push(rawCoords[rawCoords.length - 1]); 
            rawCoords = sampled;
        }

        const coordString = rawCoords.map(pt => `${pt[0]},${pt[1]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

        return fetch(osrmUrl)
            .then(res => res.json())
            .then(routingData => {
                if (routingData.routes && routingData.routes.length > 0) {
                    return L.geoJSON(routingData.routes[0].geometry, { style: { color: '#2563eb', weight: 4, opacity: 0.8 } });
                }
                return L.geoJSON(feature, { style: { color: '#2563eb', weight: 4, opacity: 0.8 } });
            })
            .catch(() => L.geoJSON(feature, { style: { color: '#2563eb', weight: 4, opacity: 0.8 } }));
    });

    Promise.all(routingPromises).then(polylines => {
        window.routingCache[lowerCode] = polylines;
        const combinedBounds = L.latLngBounds();
        polylines.forEach(polyline => {
            polyline.addTo(window.pathLayer);
            combinedBounds.extend(polyline.getBounds());
        });
        if (combinedBounds.isValid()) window.map.fitBounds(combinedBounds, { padding: [40, 40] });
    });
}

// --- BUS STOPS VECTOR CIRCLES RENDER COMPILER ---
window.renderFilteredBusStops = function(selectedCode) {
    window.stopLayer.clearLayers();
    if (!window.stopsData || !window.stopsData.features) return;

    let targetFeatures = window.stopsData.features;
    if (selectedCode !== 'all') {
        const lowerCode = selectedCode.toLowerCase();
        targetFeatures = window.stopsData.features.filter(f => {
            const passingRoutes = window.stopRoutesIndex[f.properties.stop_id] || [];
            return passingRoutes.some(r => r.toLowerCase() === lowerCode);
        });
    }

    const terminalNames = new Set();
    if (window.destinationLookup) {
        Object.values(window.destinationLookup).forEach(directions => {
            Object.values(directions).forEach(name => {
                if (name) terminalNames.add(name.toLowerCase().trim());
            });
        });
    }

    L.geoJSON({ type: "FeatureCollection", features: targetFeatures }, {
        pointToLayer: (feature, latlng) => {
            const stopId = feature.properties.stop_id;
            const stopName = feature.properties.stopName || '';
            const passingRoutes = window.stopRoutesIndex[stopId] || [];
            const isMainTerminal = terminalNames.has(stopName.toLowerCase().trim());
            const isInterchange = passingRoutes.length > 1;

            let markerRadius = 8, markerColor = "#10b981", popupHeaderType = window.txtLgStop, customMarkerClass = "";

            if (isMainTerminal) {
                markerRadius = 14; markerColor = "#2563eb"; popupHeaderType = "🚨 " + window.txtLgStation; customMarkerClass = "main-terminal-pulse"; 
            } else if (isInterchange) {
                markerColor = "#f97316"; popupHeaderType = "🔄 " + window.txtLgInterchange;
            }

            // Generate Prefix Lookups dynamically if uninitialized
            if (!window.prefixToRouteLookup) {
                window.prefixToRouteLookup = {};
                if (window.staticTripSchedules && window.routeStopsIndex) {
                    Object.keys(window.staticTripSchedules).forEach(tId => {
                        const prefix = tId.split('_')[0].trim().toUpperCase();
                        if (window.prefixToRouteLookup[prefix]) return;
                        const stopIds = Object.keys(window.staticTripSchedules[tId]);
                        for (let sId of stopIds) {
                            const matchingRoutes = Object.keys(window.routeStopsIndex).filter(rKey => window.routeStopsIndex[rKey].includes(sId));
                            if (matchingRoutes.length === 1) {
                                window.prefixToRouteLookup[prefix] = matchingRoutes[0].toLowerCase();
                                break;
                            }
                        }
                    });
                }
            }

            let allStopTimes = [];
            if (window.staticTripSchedules) {
                Object.keys(window.staticTripSchedules).forEach(tripId => {
                    const stopTimesMap = window.staticTripSchedules[tripId];
                    if (stopTimesMap && stopTimesMap[stopId]) {
                        if (selectedCode !== 'all') {
                            const lowerCode = selectedCode.toLowerCase();
                            const prefix = tripId.split('_')[0].trim().toUpperCase();
                            const supportedRoutes = (window.tripPrefixRoutesIndex && window.tripPrefixRoutesIndex[prefix]) || [];
                            if (!supportedRoutes.includes(lowerCode)) return;
                            const exactRouteMatch = window.prefixToRouteLookup[prefix];
                            if (exactRouteMatch && exactRouteMatch !== lowerCode) return;
                        }
                        allStopTimes.push(stopTimesMap[stopId]);
                    }
                });
            }

            const uniqueSortedTimes = [...new Set(allStopTimes)].sort((a, b) => a.localeCompare(b));
            const scheduleListHtml = uniqueSortedTimes.length === 0
                ? `<div class="stop-schedule-empty">${window.txtPopScheduledFailed}</div>`
                : uniqueSortedTimes.map(timeStr => `<span class="stop-schedule-tag">${timeStr}</span>`).join('');

            const routeBadgesHtml = passingRoutes.sort().map(r => `<span class="popup-route-badge">${getDisplayRouteCode(r)}</span>`).join('');

            const marker = L.circleMarker(latlng, {
                radius: markerRadius, weight: isMainTerminal ? 3 : 2, fillColor: markerColor, color: "#ffffff", fillOpacity: 0.95, className: customMarkerClass, pane: 'busStopsPane'
            }).bindPopup(`
                <div class="stop-popup-content">
                    <span class="popup-label-type ${isMainTerminal ? 'popup-label-terminal' : ''}">${popupHeaderType}</span>
                    <strong class="popup-stop-title ${isMainTerminal ? 'popup-title-terminal' : ''}">${stopName}</strong>
                    <div class="stop-schedule-section"><span class="stop-schedule-title">${window.txtPopScheduled}</span><div class="stop-schedule-grid">${scheduleListHtml}</div></div>
                    <div class="popup-routes-list-wrapper"><span class="popup-routes-label">${window.txtPopRoutes}</span><div class="popup-badges-grid">${routeBadgesHtml}</div></div>
                </div>
            `, { maxWidth: 280 });

            if (window.currentlyOpenStopId === String(stopId)) setTimeout(() => marker.openPopup(), 10);
            marker.on('popupopen', () => { window.currentlyOpenStopId = String(stopId); });

            return marker;
        }
    }).addTo(window.stopLayer);
}
