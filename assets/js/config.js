// js/config.js

// --- RUNTIME ENVIRONMENT CONFIGURATION & L10N STRINGS ---
window.appShell = document.getElementById('app-shell');
window.branchName = window.appShell ? window.appShell.getAttribute('data-branch') : '';

// Pull the Hugo-compiled strings dynamically from the DOM dataset wrapper attributes
window.txtSyncing        = window.appShell?.dataset.txtSyncing        || 'Syncing positions...';
window.txtFailed         = window.appShell?.dataset.txtFailed         || 'Sync execution failure';
window.txtLatest         = window.appShell?.dataset.txtLatest         || 'Last sync';
window.txtPrompt         = window.appShell?.dataset.txtPrompt         || '◄ Choose the bus route you want to track';
window.txtTimetable      = window.appShell?.dataset.txtTimetable      || 'Click here for %ROUTE% Transit Map';
window.txtLgPrompt       = window.appShell?.dataset.txtLgPrompt       || 'Tap icons for info!';
window.txtLgStop         = window.appShell?.dataset.txtLgStop         || 'Bus Stop';
window.txtLgInterchange  = window.appShell?.dataset.txtLgInterchange  || 'Interchange';
window.txtLgStation      = window.appShell?.dataset.txtLgStation      || 'Main Station';
window.txtLgBus          = window.appShell?.dataset.txtLgBus          || 'Active Bus';
window.txtLgGeolocation  = window.appShell?.dataset.txtLgGeolocation  || 'Your Location';
window.txtPopRoutes      = window.appShell?.dataset.txtPopRoutes      || 'Available Routes';
window.txtPopStream      = window.appShell?.dataset.txtPopStream      || 'Active Vehicle Stream';
window.txtPopCode        = window.appShell?.dataset.txtPopCode        || 'Bus Code:';
window.txtPopVehicle     = window.appShell?.dataset.txtPopVehicle     || 'Vehicle ID:';
window.txtPopDestination = window.appShell?.dataset.txtPopDestination || 'Destination:';
window.txtPopSource      = window.appShell?.dataset.txtPopSource      || 'Source:';
window.txtPopScheduled   = window.appShell?.dataset.txtPopScheduled   || 'Scheduled Arrival Times:';
window.txtPopScheduledFailed = window.appShell?.dataset.txtPopScheduledFailed || 'Failed to load scheduled times';
window.txtZoomIn         = window.appShell?.dataset.txtZoomIn         || 'Zoom in';
window.txtZoomOut        = window.appShell?.dataset.txtZoomOut        || 'Zoom out';
window.txtFullscreen     = window.appShell?.dataset.txtFullscreen     || 'View Fullscreen';
window.txtFullscreenExit = window.appShell?.dataset.txtFullscreenExit || 'Exit Fullscreen';
window.txtGeolocate     = window.appShell?.dataset.txtGeolocate     || 'Track My Location';

// Branch Muting Verification States
if (window.branchName === 'main') {
    const panel = document.getElementById('feed-control-wrapper');
    if (panel) panel.style.display = 'none';
} else {
    window['ga-disable-G-Q2NRSC79B6'] = true;
    console.log("Analytics engine muted for non-production workspace branch:", window.branchName);
}

// Global Tracking Registry States
window.geolocationWatchId = null; 
window.userLocationMarker = null;
window.userAccuracyCircle = null;
window.lastCalculatedPosition = null; 
window.currentlyOpenStopId = null;
window.prefixToRouteLookup = null;

// Dynamic Routing & Cache Indices
window.routeNamesLookup = {};
window.stopRoutesIndex = {}; 
window.routingCache = {};
