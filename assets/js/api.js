// js/api.js

function syncLiveBusTracker() {
    const routeSelectorEl = document.getElementById('route-selector');
    if (!routeSelectorEl) return;
    
    const routeSelection = routeSelectorEl.value;
    let selectedSource = 'live';
    
    if (window.branchName !== 'main') {
        const checkedRadio = document.querySelector('input[name="feed-source"]:checked');
        if (checkedRadio) selectedSource = checkedRadio.value;
    }
    
    const refreshInd = document.getElementById('refresh-indicator');
    if (refreshInd) {
        refreshInd.textContent = window.txtSyncing || document.getElementById('app-shell')?.dataset.txtSyncing || 'Syncing positions...';
    }
    
    const apiEndpoint = selectedSource === 'mock' ? '/api/buses?mock=true' : '/api/buses';

    const busIcon = L.divIcon({
        html: `<div class="map-active-bus-marker"><svg class="map-svg-use"><use href="#icon-bus"></use></svg></div>`,
        className: 'custom-bus-marker', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17]
    });

    fetch(apiEndpoint)
        .then(res => res.json())
        .then(buses => {
            window.busLayer.clearLayers();
            const targetBuses = Array.isArray(buses) ? buses : [];
            const filtered = routeSelection === 'all' 
                ? targetBuses 
                : targetBuses.filter(b => b.routeCode && b.routeCode.toLowerCase() === routeSelection.toLowerCase());

            filtered.forEach(bus => {
                const dirId = bus.directionId !== undefined ? String(bus.directionId) : (bus.tripId ? bus.tripId.split('_')[1] : '0');
                const routeKey = bus.routeCode ? bus.routeCode.toLowerCase() : '';
                
                let finalDestination = bus.routeName;
                if (typeof window.destinationLookup !== 'undefined' && window.destinationLookup[routeKey] && window.destinationLookup[routeKey][dirId]) {
                    finalDestination = window.destinationLookup[routeKey][dirId];
                }

                L.marker([bus.latitude, bus.longitude], { icon: busIcon })
                 .bindPopup(`
                    <div style="font-family: system-ui, sans-serif; font-size: 12px; min-width: 180px; color: #111;">
                        <span style="color: #2563eb; font-size: 10px; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 2px;">${window.txtPopStream}</span>
                        <strong style="font-size: 15px; display: block; margin-bottom: 5px;">${window.txtPopCode} ${getDisplayRouteCode(bus.routeCode)}</strong>
                        <strong>${window.txtPopVehicle}</strong> ${bus.vehicleNumber}<br/>
                        <strong>${window.txtPopDestination}</strong> ${finalDestination}<br/>
                        <span style="color: grey; font-size: 10px; display: block; margin-top: 5px;">${window.txtPopSource} ${selectedSource.toUpperCase()}</span>
                    </div>
                 `, { maxWidth: 250 })
                 .addTo(window.busLayer);
            });

            renderFilteredBusStops(routeSelection);
            if (refreshInd) refreshInd.textContent = window.txtLatest + ` (${selectedSource}): ${new Date().toLocaleTimeString()}`;
        })
        .catch(() => {
            if (refreshInd) refreshInd.textContent = window.txtFailed; 
        });
}
