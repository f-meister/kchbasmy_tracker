// --- RUNTIME ENVIRONMENT CONFIGURATION & L10N STRINGS ---
const appShell = document.getElementById('app-shell');
const branchName = appShell ? appShell.getAttribute('data-branch') : '';

// Pull the Hugo-compiled strings dynamically from the DOM dataset wrapper attributes
const txtSyncing        = appShell?.dataset.txtSyncing        || 'Syncing positions...';
const txtFailed         = appShell?.dataset.txtFailed         || 'Sync execution failure';
const txtLatest         = appShell?.dataset.txtLatest         || 'Last sync';
const txtPrompt         = appShell?.dataset.txtPrompt         || '◄ Choose the bus route you want to track';
const txtTimetable      = appShell?.dataset.txtTimetable      || 'Click here for %ROUTE% Transit Map';
const txtLgPrompt       = appShell?.dataset.txtLgPrompt       || 'Tap icons for info!';
const txtLgStop         = appShell?.dataset.txtLgStop         || 'Bus Stop';
const txtLgInterchange  = appShell?.dataset.txtLgInterchange  || 'Interchange';
const txtLgStation      = appShell?.dataset.txtLgStation      || 'Main Station';
const txtLgBus          = appShell?.dataset.txtLgBus          || 'Active Bus';
const txtLgGeolocation  = appShell?.dataset.txtLgGeolocation  || 'Your Location';
const txtPopRoutes      = appShell?.dataset.txtPopRoutes      || 'Available Routes';
const txtPopStream      = appShell?.dataset.txtPopStream      || 'Active Vehicle Stream';
const txtPopCode        = appShell?.dataset.txtPopCode        || 'Bus Code:';
const txtPopVehicle     = appShell?.dataset.txtPopVehicle     || 'Vehicle ID:';
const txtPopDestination = appShell?.dataset.txtPopDestination || 'Destination:';
const txtPopSource      = appShell?.dataset.txtPopSource      || 'Source:';

if (branchName === 'main') {
    const panel = document.getElementById('feed-control-wrapper');
    if (panel) panel.style.display = 'none';
} else {
    window['ga-disable-G-Q2NRSC79B6'] = true;
    console.log("Analytics engine muted for non-production workspace branch:", branchName);
}

// 1. Core Map Initializations
const map = L.map('map', {
    fullscreenControl: true,
    fullscreenControlOptions: {
        position: 'topleft'
    }
}).setView([1.5574, 110.3538], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    attribution: '© OpenStreetMap contributors' 
}).addTo(map);

map.createPane('busStopsPane');
map.getPane('busStopsPane').style.zIndex = 450;
map.getPane('busStopsPane').style.pointerEvents = 'none';

const busLayer = L.layerGroup().addTo(map);
const pathLayer = L.layerGroup().addTo(map);
const stopLayer = L.layerGroup().addTo(map);

// Declare tracking parameters globally on the window to ensure cross-module availability
window.geolocationWatchId = null; 
window.userLocationMarker = null;
window.userAccuracyCircle = null;
window.lastCalculatedPosition = null; 

// --- LEAFLET NATIVE GEOLOCATION CONTROL ELEMENT ---
const LocationControl = L.Control.extend({
    options: { position: 'topleft' }, 
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-location-control');
        container.innerHTML = `
            <button id="location-toggle-btn" data-tracking-state="off" title="Track My Location" aria-label="Track My Location" style="width: 30px; height: 30px; background: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <svg class="map-svg-use" style="width: 18px; height: 18px;"><use href="#icon-crosshair"></use></svg>
            </button>
        `;
        
        L.DomEvent.disableClickPropagation(container);
        return container;
    }
});
map.addControl(new LocationControl());

// --- LEAFLET MAP LEGEND LAYER ---
const legend = L.control({ position: 'topright' });

legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
        <div style="font-size: 11px; color: #94a3b8; text-align: center; font-style: italic;">
        ${txtLgPrompt}
        </div>
        <div class="legend-item">
            <span class="legend-marker-stop"></span>
            <span>${txtLgStop}</span>
        </div>
        <div class="legend-item">
            <span class="legend-marker-stop" style="background-color: #f97316 !important;"></span>
            <span>${txtLgInterchange}</span>
        </div>
        <div class="legend-item">
            <span class="legend-marker-stop" style="background-color: #2563eb !important; width: 14px; height: 14px; margin-left: -2px; margin-right: -2px;"></span>
            <span>${txtLgStation}</span>
        </div>
        <div class="legend-item">
            <div class="legend-bus-icon-preview">
                <svg class="legend-svg-use"><use href="#icon-bus"></use></svg>
            </div>
            <span>${txtLgBus}</span>
        </div>
        <div class="legend-item" style="border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px;">
            <div style="width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; margin-right: 6px; position: relative; padding-top: 6px;">
                <div class="legend-geolocation">
                    <svg class="map-svg-use" style="width: 18px; height: 18px;"><use href="#icon-crosshair"></use></svg>
                </div>
            </div>
            <span style="color: #ffffff; margin-left: -6px; padding-top: 6px;">${txtLgGeolocation}</span>
        </div>
    `;
    return div;
};

legend.addTo(map);

// Dynamic lookup indexes
const routeNamesLookup = {};
const stopRoutesIndex = {}; 

// Initialization bootstrap routine called once global JSON objects load
function initializeRouteSelector() {
    if (window.routesPathsData && window.routesPathsData.features) {
        const selector = document.getElementById('route-selector');
        if (!selector) return;
        
        window.routesPathsData.features.forEach(f => {
            if (f.properties && f.properties.routeCode) {
                routeNamesLookup[f.properties.routeCode.toLowerCase()] = f.properties.routeName || "Operational Route";
            }
        });

        if (window.routeStopsIndex) {
            Object.keys(window.routeStopsIndex).forEach(routeKey => {
                const upperRoute = routeKey.toUpperCase();
                const stopIdsArray = window.routeStopsIndex[routeKey] || [];
                
                stopIdsArray.forEach(stopId => {
                    if (!stopRoutesIndex[stopId]) {
                        stopRoutesIndex[stopId] = [];
                    }
                    if (!stopRoutesIndex[stopId].includes(upperRoute)) {
                        stopRoutesIndex[stopId].push(upperRoute);
                    }
                });
            });
        }

        const trackingCodes = window.routesPathsData.features.map(f => f.properties.routeCode ? f.properties.routeCode.toLowerCase() : '').filter(Boolean);
        [...new Set(trackingCodes)].sort().forEach(code => {
            const opt = document.createElement('option');
            opt.value = code; 
            opt.textContent = `${code.toUpperCase()}`; 
            selector.appendChild(opt);
        });
    }
}

// --- DYNAMIC INLINE DESCRIPTIVE LABEL UPDATE LOGIC ---
function updateRouteDescriptionLabel(selectedRoute, isInitialBoot = false) {
    const label = document.getElementById('route-description-text');
    if (!label) return;

    if (selectedRoute === 'all') {
        if (isInitialBoot) {
            label.classList.add('route-prompt-text');
            label.innerHTML = txtPrompt;
            label.style.display = 'inline-block';
            label.style.opacity = '1';
            return;
        }

        label.style.opacity = '0';
        setTimeout(() => {
            const currentSelector = document.getElementById('route-selector');
            if (currentSelector && currentSelector.value === 'all') {
                label.classList.add('route-prompt-text');
                label.innerHTML = txtPrompt;
                label.style.display = 'inline-block';
                void label.offsetWidth; 
                label.style.opacity = '1';
            }
        }, 200);
    } else {
        const descriptiveName = routeNamesLookup[selectedRoute.toLowerCase()] || '';
        if (descriptiveName) {
            label.classList.remove('route-prompt-text');
            label.textContent = ` ${descriptiveName}`;
            label.style.display = 'inline-block';
            void label.offsetWidth; 
            label.style.opacity = '1';
        } else {
            label.style.display = 'none';
        }
    }
}

// Evaluate and update timetable anchor tags
function updateTimetableLink(selectedRoute) {
    const container = document.getElementById('timetable-link-container');
    const anchor = document.getElementById('route-timetable-link');
    const linkText = document.getElementById('timetable-link-text');
    
    if (!container || !anchor || !linkText) return;

    const cleanRouteKey = selectedRoute.trim().toLowerCase();
    const activeLink = timetableMap[cleanRouteKey];

    if (selectedRoute === 'all' || !activeLink) {
        container.style.display = 'none';
    } else {
        anchor.href = activeLink;
        linkText.textContent = txtTimetable.replace('%ROUTE%', selectedRoute.toUpperCase());
        container.style.display = 'inline-flex';
    }
}

function renderFilteredBusStops(selectedCode) {
    stopLayer.clearLayers();
    if (!window.stopsData || !window.stopsData.features) return;

    let targetFeatures = window.stopsData.features;
    if (selectedCode !== 'all') {
        const lowerCode = selectedCode.toLowerCase();
        
        targetFeatures = window.stopsData.features.filter(f => {
            const stopId = f.properties.stop_id;
            const passingRoutes = stopRoutesIndex[stopId] || [];
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
            const passingRoutes = stopRoutesIndex[stopId] || [];
            const lowerStopName = stopName.toLowerCase().trim();
            
            const isMainTerminal = terminalNames.has(lowerStopName);
            const isInterchange = passingRoutes.length > 1;

            let markerRadius = 8;
            let markerColor = "#10b981"; 
            let popupHeaderType = txtLgStop; 
            let customMarkerClass = "";

            if (isMainTerminal) {
                markerRadius = 14;           
                markerColor = "#2563eb";    
                popupHeaderType = "🚨 " + txtLgStation;
                customMarkerClass = "main-terminal-pulse"; 
            } else if (isInterchange) {
                markerRadius = 8;
                markerColor = "#f97316";    
                popupHeaderType = "🔄 " + txtLgInterchange;
            }

            const routeBadgesHtml = passingRoutes.sort().map(r => 
                `<span class="popup-route-badge">${r}</span>`
            ).join('');

            return L.circleMarker(latlng, {
                radius: markerRadius, 
                weight: isMainTerminal ? 3 : 2, 
                fillColor: markerColor, 
                color: "#ffffff", 
                fillOpacity: 0.95, 
                className: customMarkerClass,
                pane: 'busStopsPane'
            }).bindPopup(`
                <div class="stop-popup-content">
                    <span class="popup-label-type ${isMainTerminal ? 'popup-label-terminal' : ''}">${popupHeaderType}</span>
                    <strong class="popup-stop-title ${isMainTerminal ? 'popup-title-terminal' : ''}">${stopName}</strong>
                    <div class="popup-routes-list-wrapper">
                        <span class="popup-routes-label">${txtPopRoutes}</span>
                        <div class="popup-badges-grid">${routeBadgesHtml}</div>
                    </div>
                </div>
            `, { maxWidth: 250 });
        }
    }).addTo(stopLayer);
}

const routingCache = {};

function renderSelectedRouteLine(code) {
    pathLayer.clearLayers();
    if (code === 'all' || !window.routesPathsData) return;

    const lowerCode = code.toLowerCase();

    if (routingCache[lowerCode]) {
        routingCache[lowerCode].forEach(polyline => polyline.addTo(pathLayer));
        
        const combinedBounds = L.latLngBounds();
        routingCache[lowerCode].forEach(polyline => combinedBounds.extend(polyline.getBounds()));
        if (combinedBounds.isValid()) {
            map.fitBounds(combinedBounds, { padding: [40, 40] });
        }
        return;
    }

    let features = window.routesPathsData.features.filter(f => f.properties.routeCode.toLowerCase() === lowerCode);
    if (features.length === 0) return;

    if (features.length === 1) {
        console.warn(`⚠️ Data Deficit Detected on [${code.toUpperCase()}]: Static feed missing a directional variant. Activating coordinate mirroring failsafe...`);
        
        const mirroredFeature = JSON.parse(JSON.stringify(features[0])); 
        if (mirroredFeature.geometry && mirroredFeature.geometry.coordinates) {
            mirroredFeature.geometry.coordinates.reverse();
        }
        mirroredFeature.properties.shape_id += "_mirrored_fallback";
        features.push(mirroredFeature);
    }

    const routingPromises = features.map(feature => {
        let rawCoords = feature.geometry.coordinates;

        if (rawCoords.length > 120) {
            const step = Math.ceil(rawCoords.length / 120);
            const sampled = [];
            for (let i = 0; i < rawCoords.length; i += step) {
                sampled.push(rawCoords[i]);
            }
            if (sampled[sampled.length - 1] !== rawCoords[rawCoords.length - 1]) {
                sampled.push(rawCoords[rawCoords.length - 1]); 
            }
            rawCoords = sampled;
        }

        const coordString = rawCoords.map(pt => `${pt[0]},${pt[1]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

        return fetch(osrmUrl)
            .then(res => res.json())
            .then(routingData => {
                if (routingData.routes && routingData.routes.length > 0) {
                    return L.geoJSON(routingData.routes[0].geometry, { 
                        style: { color: '#2563eb', weight: 4, opacity: 0.8 } 
                    });
                } else {
                    return L.geoJSON(feature, { style: { color: '#2563eb', weight: 4, opacity: 0.8 } });
                }
            })
            .catch(() => {
                return L.geoJSON(feature, { style: { color: '#2563eb', weight: 4, opacity: 0.8 } });
            });
    });

    Promise.all(routingPromises).then(polylines => {
        routingCache[lowerCode] = polylines;

        const combinedBounds = L.latLngBounds();
        polylines.forEach(polyline => {
            polyline.addTo(pathLayer);
            combinedBounds.extend(polyline.getBounds());
        });
        if (combinedBounds.isValid()) {
            map.fitBounds(combinedBounds, { padding: [40, 40] });
        }
    });
}

function injectDynamicCopyrightYear() {
    const yearElement = document.getElementById('copyright-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

function syncLiveBusTracker() {
    const routeSelectorEl = document.getElementById('route-selector');
    if (!routeSelectorEl) return;
    
    const routeSelection = routeSelectorEl.value;
    
    let selectedSource = 'live';
    if (branchName !== 'main') {
        const checkedRadio = document.querySelector('input[name="feed-source"]:checked');
        if (checkedRadio) selectedSource = checkedRadio.value;
    }
    
    const refreshInd = document.getElementById('refresh-indicator');
    if (refreshInd) refreshInd.textContent = txtSyncing; 
    
    const apiEndpoint = selectedSource === 'mock' ? '/api/buses?mock=true' : '/api/buses';

    const busIcon = L.divIcon({
        html: `
            <div class="map-active-bus-marker">
                <svg class="map-svg-use"><use href="#icon-bus"></use></svg>
            </div>
        `,
        className: 'custom-bus-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17]
    });

    fetch(apiEndpoint)
        .then(res => res.json())
        .then(buses => {
            busLayer.clearLayers();
            const targetBuses = Array.isArray(buses) ? buses : [];
            
            const filtered = routeSelection === 'all' 
                ? targetBuses 
                : targetBuses.filter(b => b.routeCode && b.routeCode.toLowerCase() === routeSelection.toLowerCase());

            filtered.forEach(bus => {
                const dirId = bus.directionId !== undefined 
                    ? String(bus.directionId) 
                    : (bus.tripId ? bus.tripId.split('_')[1] : '0');
                
                const routeKey = bus.routeCode ? bus.routeCode.toLowerCase() : '';
                
                let finalDestination = bus.routeName;
                if (typeof destinationLookup !== 'undefined' && destinationLookup[routeKey] && destinationLookup[routeKey][dirId]) {
                    finalDestination = destinationLookup[routeKey][dirId];
                }

                L.marker([bus.latitude, bus.longitude], { icon: busIcon })
                 .bindPopup(`
                    <div style="font-family: system-ui, sans-serif; font-size: 12px; min-width: 180px; color: #111;">
                        <span style="color: #2563eb; font-size: 10px; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 2px;">${txtPopStream}</span>
                        <strong style="font-size: 15px; display: block; margin-bottom: 5px;">${txtPopCode} ${bus.routeCode.toUpperCase()}</strong>
                        <strong>${txtPopVehicle}</strong> ${bus.vehicleNumber}<br/>
                        <strong>${txtPopDestination}</strong> ${finalDestination}<br/>
                        <span style="color: grey; font-size: 10px; display: block; margin-top: 5px;">${txtPopSource} ${selectedSource.toUpperCase()}</span>
                    </div>
                 `, { maxWidth: 250 })
                 .addTo(busLayer);
            });
            if (refreshInd) refreshInd.textContent = txtLatest + ` (${selectedSource}): ${new Date().toLocaleTimeString()}`;
        })
        .catch(() => {
            if (refreshInd) refreshInd.textContent = txtFailed; 
        });
}

// --- EVENT HANDLERS & REGISTRATION INTERFACES ---
document.getElementById('route-selector')?.addEventListener('change', (e) => {
    const code = e.target.value;
    updateRouteDescriptionLabel(code); 
    updateTimetableLink(code);
    renderSelectedRouteLine(code);
    renderFilteredBusStops(code);
    syncLiveBusTracker();
});

const radios = document.querySelectorAll('input[name="feed-source"]');
if (radios) {
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            syncLiveBusTracker();
        });
    });
}

// --- RESPONSIVE MODAL CONTROL LOGIC ---
const infoOverlay = document.getElementById('info-modal-overlay');
const infoTrigger = document.getElementById('info-modal-trigger');
const infoClose = document.getElementById('info-modal-close');

function openInfoModal() {
    if (infoOverlay) infoOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden'; 
}

function closeInfoModal() {
    if (infoOverlay) infoOverlay.style.display = 'none';
    document.body.style.overflow = ''; 
}

if (infoTrigger) infoTrigger.addEventListener('click', openInfoModal);
if (infoClose) infoClose.addEventListener('click', closeInfoModal);

if (infoOverlay) {
    infoOverlay.addEventListener('click', (e) => {
        if (e.target === infoOverlay) closeInfoModal();
    });
}

// ============================================================================
// 📍 CLIENT GEOLOCATION TRACKING SERVICES MODULE
// ============================================================================
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const sqrtA = Math.sqrt(a);
    const sqrtB = Math.sqrt(1 - a);
    
    const c = 2 * Math.atan2(sqrtA, sqrtB);
    return R * c; 
}

function handleUserPositionUpdate(position) {
    const btn = document.getElementById('location-toggle-btn');
    if (!btn || btn.getAttribute('data-tracking-state') === 'off') return;

    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    if (window.lastCalculatedPosition) {
        const deltaDistance = calculateHaversineDistance(
            window.lastCalculatedPosition.lat, window.lastCalculatedPosition.lon, 
            lat, lon
        );
        if (deltaDistance < 10) return; 
    }

    window.lastCalculatedPosition = { lat, lon };

    if (!window.userLocationMarker) {
        const pulseIcon = L.divIcon({
            html: `<div class="user-pulse-core"></div><div class="user-pulse-ring"></div>`,
            className: 'user-location-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        window.userLocationMarker = L.marker([lat, lon], { icon: pulseIcon }).addTo(map);
        window.userAccuracyCircle = L.circle([lat, lon], {
            radius: accuracy,
            color: '#d946ef',
            weight: 1,
            fillColor: '#d946ef',
            fillOpacity: 0.15,
            pane: 'busStopsPane'
        }).addTo(map);

        map.setView([lat, lon], 15);
        btn.setAttribute('data-tracking-state', 'locked');
    } else {
        window.userLocationMarker.setLatLng([lat, lon]);
        window.userAccuracyCircle.setLatLng([lat, lon]);
        window.userAccuracyCircle.setRadius(accuracy);

        if (btn.getAttribute('data-tracking-state') === 'locked') {
            map.panTo([lat, lon]);
        }
    }
}

function handleUserPositionError(err) {
    console.warn(`[GPS Engine Error ${err.code}]: ${err.message}`);
    stopUserLocationTracking();
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) indicator.textContent = 'Location access denied or timed out.';
}

function startUserLocationTracking() {
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

function stopUserLocationTracking() {
    const btn = document.getElementById('location-toggle-btn');
    if (window.geolocationWatchId !== null) {
        navigator.geolocation.clearWatch(window.geolocationWatchId);
        window.geolocationWatchId = null;
    }
    if (window.userLocationMarker) { map.removeLayer(window.userLocationMarker); window.userLocationMarker = null; }
    if (window.userAccuracyCircle) { map.removeLayer(window.userAccuracyCircle); window.userAccuracyCircle = null; }
    window.lastCalculatedPosition = null;
    if (btn) btn.setAttribute('data-tracking-state', 'off');
}

// ============================================================================
// SYSTEM BOOTSTRAP INITIALIZATION LAYER
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#location-toggle-btn');
        if (!btn) return;
        
        const currentState = btn.getAttribute('data-tracking-state');
        if (currentState === 'off') {
            startUserLocationTracking();
        } else {
            stopUserLocationTracking();
        }
    });

    map.on('dragstart', () => {
        const btn = document.getElementById('location-toggle-btn');
        if (btn && btn.getAttribute('data-tracking-state') === 'locked') {
            btn.setAttribute('data-tracking-state', 'seeking');
        }
    });

    map.on('fullscreenchange', () => {
        map.invalidateSize({ animate: true });
    });

    // TIMETABLE MODAL VIEWER INITIALIZATION
    let timetableMapInstance = null;
    const timetableLink = document.getElementById('route-timetable-link');

    if (timetableLink) {
        timetableLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Read whatever active image path your route selector injected into the link element
            const imageUrl = this.getAttribute('href');

            const modalOverlay = document.getElementById('timetable-modal-overlay');
            const currentRouteText = document.getElementById('route-description-text').innerText || "Transit Map";
            
            // Sync up the text header inside the modal card to look clean
            document.getElementById('timetable-modal-title').innerText = currentRouteText;
            modalOverlay.style.display = 'block';

            // Instantiating the flat image layout container asynchronously 
            const img = new Image();
            img.src = imageUrl;
            img.onload = function() {
                const w = this.width;
                const h = this.height;

                // Evict the old map interface layout cleanly from memory if switching routes
                if (timetableMapInstance) {
                    timetableMapInstance.remove();
                }

                // Build out the secondary context viewer map instance
                timetableMapInstance = L.map('timetable-image-viewer', {
                    minZoom: -2,
                    maxZoom: 2,
                    center: [0, 0],
                    zoom: 0,
                    crs: L.CRS.Simple, // Crucial: sets coordinate math to simple pixel grids
                    zoomControl: true,
                    attributionControl: false
                });

                // Unproject layout coordinates to maps bounds points
                const southWest = timetableMapInstance.unproject([0, h], timetableMapInstance.getMaxZoom());
                const northEast = timetableMapInstance.unproject([w, 0], timetableMapInstance.getMaxZoom());
                const bounds = new L.LatLngBounds(southWest, northEast);

                // Mount the active image layer asset
                L.imageOverlay(imageUrl, bounds).addTo(timetableMapInstance);

                // Restrict panning boundaries so users can't scroll the image off the screen completely
                timetableMapInstance.setMaxBounds(bounds);
                timetableMapInstance.fitBounds(bounds);
            };
        });
    }

    // Modal Teardown Trigger Hook (X Button)
    const modalCloseBtn = document.getElementById('timetable-modal-close');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            document.getElementById('timetable-modal-overlay').style.display = 'none';
            if (timetableMapInstance) {
                timetableMapInstance.remove();
                timetableMapInstance = null;
            }
        });
    }

    // Backdrop Click Teardown Trigger Hook (Clicking the dark area outside the map card)
    const modalOverlayBtn = document.getElementById('timetable-modal-overlay');
    if (modalOverlayBtn) {
        modalOverlayBtn.addEventListener('click', (e) => {
            if (e.target.id === 'timetable-modal-overlay') {
                modalOverlayBtn.style.display = 'none';
                if (timetableMapInstance) {
                    timetableMapInstance.remove();
                    timetableMapInstance = null;
                }
            }
        });
    }

    injectDynamicCopyrightYear();
    initializeRouteSelector();
    renderFilteredBusStops('all');
    updateRouteDescriptionLabel('all', true);
    syncLiveBusTracker();
    
    setInterval(syncLiveBusTracker, 60000);
});
