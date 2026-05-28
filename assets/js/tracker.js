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
            <span class="legend-marker-bus">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h1M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM16 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
                </svg>
            </span>
            <span>Active Bus</span>
        </div>
    `;
    return div;
};

legend.addTo(map);

// Dynamic lookup index mapping: routeCode -> routeLongName
const routeNamesLookup = {};

// Initialization bootstrap routine called once global JSON objects load
function initializeRouteSelector() {
    if (routesPathsData && routesPathsData.features) {
        const selector = document.getElementById('route-selector');
        
        routesPathsData.features.forEach(f => {
            if (f.properties && f.properties.routeCode) {
                routeNamesLookup[f.properties.routeCode.toLowerCase()] = f.properties.routeName || "Operational Route";
            }
        });

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
function updateRouteDescriptionLabel(selectedRoute) {
    const label = document.getElementById('route-description-text');
    if (!label) return;

    if (selectedRoute === 'all') {
        label.style.opacity = '0';
        setTimeout(() => { label.style.display = 'none'; }, 200);
    } else {
        const descriptiveName = routeNamesLookup[selectedRoute.toLowerCase()] || '';
        if (descriptiveName) {
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
        const validStopIds = routeStopsIndex[selectedCode.toLowerCase()] || routeStopsIndex[selectedCode.toUpperCase()] || [];
        targetFeatures = stopsData.features.filter(f => validStopIds.includes(f.properties.stop_id));
    }

    L.geoJSON({ type: "FeatureCollection", features: targetFeatures }, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            radius: 8, weight: 2, fillColor: "#10b981", color: "#ffffff", fillOpacity: 0.9, pane: 'busStopsPane'
        }).bindPopup(`
            <div style="font-family: system-ui, sans-serif; padding: 2px; color: #111;">
                <span style="color: #666; font-size: 10px; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 2px;">Bus Stop</span>
                <strong style="font-size: 13px;">${feature.properties.stopName}</strong>
            </div>
        `, { maxWidth: 250 })
    }).addTo(stopLayer);
}

function renderSelectedRouteLine(code) {
    pathLayer.clearLayers();
    if (code === 'all' || !routesPathsData) return;

    const features = routesPathsData.features.filter(f => f.properties.routeCode.toLowerCase() === code.toLowerCase());
    if (features.length === 0) return;

    const rawCoords = features[0].geometry.coordinates;
    const coordString = rawCoords.map(pt => `${pt[0]},${pt[1]}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
        .then(res => res.json())
        .then(routingData => {
            if (routingData.routes && routingData.routes.length > 0) {
                const polyline = L.geoJSON(routingData.routes[0].geometry, { 
                    style: { color: '#2563eb', weight: 4, opacity: 0.8 } 
                });
                pathLayer.addLayer(polyline);
                map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
            } else {
                renderStraightFallback(features);
            }
        })
        .catch(() => renderStraightFallback(features));
}

function renderStraightFallback(features) {
    const polyline = L.geoJSON(features, { style: { color: '#2563eb', weight: 4, opacity: 0.8 } });
    pathLayer.addLayer(polyline);
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
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
            <div style="background-color: #2563eb; color: #ffffff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h1M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM16 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
                </svg>
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
