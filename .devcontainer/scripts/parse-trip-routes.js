const fs = require('fs');
const path = require('path');

function generateTripRouteIndex() {
    console.log(`🔀 Generating precision multi-route interlining dictionary...`);

    const stopTimesJsonPath = path.join(__dirname, '../../assets/data/stop_times.json');
    const routeStopsIndexPath = path.join(__dirname, '../../assets/data/route_stops_index.json');
    const outputPath = path.join(__dirname, '../../assets/data/trip_prefix_routes.json');

    if (!fs.existsSync(stopTimesJsonPath) || !fs.existsSync(routeStopsIndexPath)) {
        console.error("❌ Pre-build Mapping Failed: Required compiled JSON assets missing.");
        process.exit(1);
    }

    const staticTripSchedules = JSON.parse(fs.readFileSync(stopTimesJsonPath, 'utf8'));
    const routeStopsIndex = JSON.parse(fs.readFileSync(routeStopsIndexPath, 'utf8'));

    // Invert routeStopsIndex to find which routes pass through a specific stop ID
    // Structure: { "6521": ["q14", "q08", "q11"] }
    const stopToRoutesMap = {};
    Object.keys(routeStopsIndex).forEach(routeCode => {
        const lowerRoute = routeCode.toLowerCase();
        routeStopsIndex[routeCode].forEach(stopId => {
            if (!stopToRoutesMap[stopId]) {
                stopToRoutesMap[stopId] = new Set();
            }
            stopToRoutesMap[stopId].add(lowerRoute);
        });
    });

    const prefixMap = {}; // { "268": Set(["q14", "q08"]) }

    // Loop through your compiled trips tree structure
    Object.keys(staticTripSchedules).forEach(tripId => {
        const prefix = tripId.split('_')[0].trim().toUpperCase();
        const stopIdsInTrip = Object.keys(staticTripSchedules[tripId]);

        stopIdsInTrip.forEach(stopId => {
            const matchedRoutes = stopToRoutesMap[stopId];
            if (matchedRoutes) {
                if (!prefixMap[prefix]) {
                    prefixMap[prefix] = new Set();
                }
                // Add all possible routes crossing this stop into the prefix profile pool
                matchedRoutes.forEach(route => prefixMap[prefix].add(route));
            }
        });
    });

    // Convert Sets to standard sorted arrays
    const cleanOutput = {};
    Object.keys(prefixMap).sort().forEach(prefix => {
        cleanOutput[prefix] = [...prefixMap[prefix]].sort();
    });

    fs.writeFileSync(outputPath, JSON.stringify(cleanOutput, null, 2));
    console.log(`✅ Success! Generated multi-route trip_prefix_routes.json map file.`);
}

generateTripRouteIndex();
