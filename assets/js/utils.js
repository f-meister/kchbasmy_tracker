// js/utils.js

/**
 * Utility to cleanly append visual-only M/B suffixes without mutating core datasets
 */
window.getDisplayRouteCode = function(routeCode) {
    if (!routeCode) return '';
    const cleanKey = routeCode.trim().toUpperCase();
    const suffix = window.routeSuffixMap && window.routeSuffixMap[cleanKey];
    return suffix ? `${cleanKey}${suffix}` : cleanKey;
}

/**
 * Calculates geographical bounds distance using the Haversine mathematical algorithm
 */
window.calculateHaversineDistance = function(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
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

/**
 * Direct DOM string manipulation injector utility for footer elements
 */
window.injectDynamicCopyrightYear = function() {
    const yearElement = document.getElementById('copyright-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}
