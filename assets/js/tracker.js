// --- RUNTIME ENVIRONMENT AUTO-LOCK & GA4 FILTER ---
const appShell = document.getElementById('app-shell');
const branchName = appShell ? appShell.getAttribute('data-branch') : '';

if (branchName === 'main') {
    const panel = document.getElementById('feed-control-wrapper');
    if (panel) panel.style.display = 'none';
} else {
    window['ga-disable-G-Q2NRSC79B6'] = true;
    console.log("Analytics engine muted for non-production workspace branch:", branchName);
}

// 1. Core Map Initializations
const map = L.map('map').setView([1.5574, 110.3538], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    attribution: '© OpenStreetMap contributors' 
}).addTo(map);

map.createPane('busStopsPane');
map.getPane('busStopsPane').style.zIndex = 450;
map.getPane('busStopsPane').style.pointerEvents = 'none';

const busLayer = L.layerGroup().addTo(map);
const pathLayer = L.layerGroup().addTo(map);
const stopLayer = L.layerGroup().addTo(map);

// --- LEAFLET MAP LEGEND LAYER ---
const legend = L.control({ position: 'topright' });

legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
        <div style="font-size: 11px; color: #94a3b8; text-align: center; font-style: italic;">
        Tap icons for info!
        </div>
        <div class="legend-item">
            <span class="legend-marker-stop"></span>
            <span>Bus Stop</span>
        </div>
        <div class="legend-item">
            <span class="legend-marker-stop" style="background-color: #f97316 !important;"></span>
            <span>Interchange</span>
        </div>
        <div class="legend-item">
            <span class="legend-marker-stop" style="background-color: #2563eb !important; width: 14px; height: 14px; margin-left: -2px; margin-right: -2px;"></span>
            <span>Main Station</span>
        </div>
        <div class="legend-item">
            <div class="legend-bus-icon-preview">
                <svg class="legend-svg-use"><use href="#icon-bus"></use></svg>
            </div>
            <span>Active Bus</span>
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
    if (routesPathsData && routesPathsData.features) {
        const selector = document.getElementById('route-selector');
        
        routesPathsData.features.forEach(f => {
            if (f.properties && f.properties.routeCode) {
                routeNamesLookup[f.properties.routeCode.toLowerCase()] = f.properties.routeName || "Operational Route";
            }
        });

        // --- CALCULATE REVERSE INTERCHANGE MAP ON INITIALIZATION ---
        if (routeStopsIndex) {
            Object.keys(routeStopsIndex).forEach(routeKey => {
                const upperRoute = routeKey.toUpperCase();
                const stopIdsArray = routeStopsIndex[routeKey] || [];
                
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

        const trackingCodes = routesPathsData.features.map(f => f.properties.routeCode).filter(Boolean);
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
            label.innerHTML = `◄ Choose the bus route you want to track`;
            label.style.display = 'inline-block';
            label.style.opacity = '1';
            return;
        }

        // Standard dynamic runtime path (fade out first, then swap content)
        label.style.opacity = '0';
        setTimeout(() => {
            if (document.getElementById('route-selector').value === 'all') {
                label.classList.add('route-prompt-text');
                label.innerHTML = `◄ Choose the bus route you want to track`;
                label.style.display = 'inline-block';
                void label.offsetWidth; // Trigger reflow
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
        linkText.textContent = `Click here for ${selectedRoute.toUpperCase()} Transit Map`;
        container.style.display = 'inline-flex';
    }
}

function renderFilteredBusStops(selectedCode) {
    stopLayer.clearLayers();
    if (!stopsData || !stopsData.features) return;

    let targetFeatures = stopsData.features;
    if (selectedCode !== 'all') {
        const lowerCode = selectedCode.toLowerCase();
        
        // Dynamic Extraction: Read live relations directly from stopRoutesIndex
        targetFeatures = stopsData.features.filter(f => {
            const stopId = f.properties.stop_id;
            const passingRoutes = stopRoutesIndex[stopId] || [];
            
            // Checks for an inclusive match regardless of direction loops
            return passingRoutes.some(r => r.toLowerCase() === lowerCode);
        });
    }

    L.geoJSON({ type: "FeatureCollection", features: targetFeatures }, {
        pointToLayer: (feature, latlng) => {
            const stopId = feature.properties.stop_id;
            const stopName = feature.properties.stopName || '';
            const passingRoutes = stopRoutesIndex[stopId] || [];
            
            // Intercept anchor hub terminal strings safely from GeoJSON stream fields
            const lowerStopName = stopName.toLowerCase();
            const isMainTerminal = lowerStopName.includes("saujana parking") || lowerStopName.includes("open air market");
            const isInterchange = passingRoutes.length > 1;

            let markerRadius = 8;
            let markerColor = "#10b981"; 
            let popupHeaderType = "Bus Stop";
            let customMarkerClass = "";

            if (isMainTerminal) {
                markerRadius = 14;           // ~75% upscale expansion factor
                markerColor = "#2563eb";    // Brand blue main terminal identifier (matches bus icon!)
                popupHeaderType = "🚨 INTERCHANGE STATION";
                customMarkerClass = "main-terminal-pulse"; 
            } else if (isInterchange) {
                markerRadius = 8;
                markerColor = "#f97316";    // Orange lane crossover marker
                popupHeaderType = "🔄 Transit Interchange";
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
                        <span class="popup-routes-label">Available Routes:</span>
                        <div class="popup-badges-grid">${routeBadgesHtml}</div>
                    </div>
                </div>
            `, { maxWidth: 250 });
        }
    }).addTo(stopLayer);
}

// Global memory store cache layer to protect the public OSRM API from rate-limiting
const routingCache = {};

// --- OPTIMIZED MULTI-DIRECTIONAL SHAPE ROUTING PATHS ENGINE WITH CACHING ---
function renderSelectedRouteLine(code) {
    pathLayer.clearLayers();
    if (code === 'all' || !routesPathsData) return;

    const lowerCode = code.toLowerCase();

    // 1. PERFORMANCE CHECK: If we already hit this route before, pull it instantly from cache!
    if (routingCache[lowerCode]) {
        routingCache[lowerCode].forEach(polyline => polyline.addTo(pathLayer));
        
        // Calculate the unified bounding box layout safely from cache
        const combinedBounds = L.latLngBounds();
        routingCache[lowerCode].forEach(polyline => combinedBounds.extend(polyline.getBounds()));
        if (combinedBounds.isValid()) {
            map.fitBounds(combinedBounds, { padding: [40, 40] });
        }
        return; // Halt right here—zero network request fired!
    }

    const features = routesPathsData.features.filter(f => f.properties.routeCode.toLowerCase() === lowerCode);
    if (features.length === 0) return;

    // Loop through ALL matching direction layers (Inbound and Outbound) simultaneously
    const routingPromises = features.map(feature => {
        const rawCoords = feature.geometry.coordinates;
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
                // Graceful fallback to raw straight GeoJSON coords if OSRM errors out
                return L.geoJSON(feature, { style: { color: '#2563eb', weight: 4, opacity: 0.8 } });
            });
    });

    // Wait until all direction threads resolve, write to cache, and paint layout
    Promise.all(routingPromises).then(polylines => {
        // Save the generated Leaflet layer groups to our permanent cache map tracking dictionary
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
    const routeSelection = document.getElementById('route-selector').value;
    
    let selectedSource = 'live';
    if (branchName !== 'main') {
        const checkedRadio = document.querySelector('input[name="feed-source"]:checked');
        if (checkedRadio) selectedSource = checkedRadio.value;
    }
    
    document.getElementById('refresh-indicator').textContent = "Syncing positions...";
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
                : targetBuses.filter(b => b.routeCode.toLowerCase() === routeSelection.toLowerCase());

            filtered.forEach(bus => {
                L.marker([bus.latitude, bus.longitude], { icon: busIcon })
                 .bindPopup(`
                    <div style="font-family: system-ui, sans-serif; font-size: 12px; min-width: 180px; color: #111;">
                        <span style="color: #2563eb; font-size: 10px; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 2px;">Active Vehicle Stream</span>
                        <strong style="font-size: 15px; display: block; margin-bottom: 5px;">Bus Code: ${bus.routeCode.toUpperCase()}</strong>
                        <strong>Vehicle ID:</strong> ${bus.vehicleNumber}<br/>
                        <strong>Destination:</strong> ${bus.routeName}<br/>
                        <span style="color: grey; font-size: 10px; display: block; margin-top: 5px;">Source: ${selectedSource.toUpperCase()}</span>
                    </div>
                 `, { maxWidth: 250 })
                 .addTo(busLayer);
            });
            document.getElementById('refresh-indicator').textContent = `Last sync (${selectedSource}): ${new Date().toLocaleTimeString()}`;
        })
        .catch(() => {
            document.getElementById('refresh-indicator').textContent = "Sync execution failure";
        });
}

// --- EVENT HANDLERS & REGISTRATION INTERFACES ---
document.getElementById('route-selector').addEventListener('change', (e) => {
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
