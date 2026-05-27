// .devcontainer/scripts/parse-shapes.js
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Helper to handle parsing standard comma-separated GTFS documents with safe string scrubbing
async function parseGtfsFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  
  const records = [];
  let headers = [];
  let isHeader = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    // Split columns while stripping away carriage returns (\r) and quotation marks
    const fields = line.split(',').map(f => f.replace(/[\r\n]/g, '').replace(/^"|"$/g, '').trim());
    
    if (isHeader) {
      headers = fields;
      isHeader = false;
      continue;
    }

    const record = {};
    headers.forEach((header, index) => {
      record[header] = fields[index];
    });
    records.push(record);
  }
  return records;
}

async function compileTransitData() {
  const tmpDir = path.join(__dirname, '..', '..', 'tmp-gtfs');
  const targetDir = path.join(__dirname, '..', '..', 'assets', 'data');
  const publicStaticDir = path.join(__dirname, '..', '..', 'static', 'data');

  // Ensure all target directories exist
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(publicStaticDir, { recursive: true });

  console.log("📖 Reading uploaded GTFS source text tables...");
  
  const routesList = await parseGtfsFile(path.join(tmpDir, 'routes.txt'));
  const tripsList = await parseGtfsFile(path.join(tmpDir, 'trips.txt'));
  const shapesList = await parseGtfsFile(path.join(tmpDir, 'shapes.txt'));
  const stopsList = await parseGtfsFile(path.join(tmpDir, 'stops.txt'));

  // 1. Map Route Metadata for quick cross-referencing
  const routeMeta = {};
  routesList.forEach(r => {
    routeMeta[r.route_id] = {
      shortName: r.route_short_name, // e.g., "Q06", "Q14"
      longName: r.route_long_name,   // e.g., "SAUJANA PARKING - KAMPUNG BENUK"
    };
  });

  // 2. Map Trip IDs directly to Route/Shape properties
  const tripLookup = {};
  tripsList.forEach(t => {
    const meta = routeMeta[t.route_id] || { shortName: t.trip_headsign, longName: 'Kuching Route' };
    tripLookup[t.trip_id] = {
      routeId: t.route_id,
      shapeId: t.shape_id,
      routeCode: t.trip_headsign || meta.shortName, // Matches familiar codes like Q01, Q06
      routeName: meta.longName
    };
  });

  console.log("🔗 Mapping stop-to-route relational matrices...");
  const stopTimesList = await parseGtfsFile(path.join(tmpDir, 'stop_times.txt'));

  // Create a dictionary mapping: routeCode -> Set of unique stop_ids
  const routeStopsMap = {};
  
  stopTimesList.forEach(st => {
    const tripMeta = tripLookup[st.trip_id];
    if (!tripMeta) return;
    
    const code = tripMeta.routeCode;
    if (!routeStopsMap[code]) {
      routeStopsMap[code] = new Set();
    }
    routeStopsMap[code].add(st.stop_id);
  });

  // Convert the Sets into plain arrays so they can be saved cleanly as JSON
  const serializedRouteStops = {};
  Object.keys(routeStopsMap).forEach(code => {
    serializedRouteStops[code] = Array.from(routeStopsMap[code]);
  });

  // 3. Compile Bus Stops into a GeoJSON FeatureCollection
  const stopFeatures = stopsList.map(s => ({
    type: "Feature",
    properties: {
      stop_id: s.stop_id,
      stopName: s.stop_name
    },
    geometry: {
      type: "Point",
      coordinates: [parseFloat(s.stop_lon), parseFloat(s.stop_lat)]
    }
  }));

  // 4. Compile Shape Paths into a GeoJSON FeatureCollection
  const shapes = {};
  shapesList.forEach(row => {
    if (!row.shape_id) return;
    if (!shapes[row.shape_id]) shapes[row.shape_id] = [];
    shapes[row.shape_id].push({
      lat: parseFloat(row.shape_pt_lat),
      lon: parseFloat(row.shape_pt_lon),
      seq: parseInt(row.shape_pt_sequence, 10)
    });
  });

  // Re-map the high-res shape coordinates back to their respective routeCode values
  const pathFeatures = Object.keys(shapes).map(shapeId => {
    // Ensure coordinates are sorted sequentially so the road line doesn't distort
    const sortedPoints = shapes[shapeId]
      .sort((a, b) => a.seq - b.seq)
      .map(pt => [pt.lon, pt.lat]); // GeoJSON standard: [Longitude, Latitude]

    // Find a matching trip that utilizes this specific shape track layout
    const sampleTrip = tripsList.find(t => t.shape_id === shapeId);
    const meta = sampleTrip ? tripLookup[sampleTrip.trip_id] : null;

    if (!meta) return null; // Drop orphaned shape files that aren't tied to active operational schedules

    return {
      type: "Feature",
      properties: {
        shape_id: shapeId,
        routeCode: meta.routeCode,
        routeName: meta.routeName
      },
      geometry: {
        type: "LineString",
        coordinates: sortedPoints
      }
    };
  }).filter(Boolean); // Clean out null entries safely

  // --- OUTPUT GENERATED ARTIFACTS ---
  // 1. Outputs for Hugo Template Compilation Pipeline
  fs.writeFileSync(path.join(targetDir, 'routes_paths.json'), JSON.stringify({ type: "FeatureCollection", features: pathFeatures }, null, 2));
  fs.writeFileSync(path.join(targetDir, 'stops_locations.json'), JSON.stringify({ type: "FeatureCollection", features: stopFeatures }, null, 2));

  // Save our relational dictionary map asset for Hugo templates
  fs.writeFileSync(path.join(targetDir, 'route_stops_index.json'), JSON.stringify(serializedRouteStops, null, 2));

  // 2. Outputs for Serverless Runtime HTTP Engine Fetches
  fs.writeFileSync(path.join(publicStaticDir, 'trip_lookup.json'), JSON.stringify(tripLookup, null, 2));

  console.log("⚡ Relational data extraction successfully written to both /assets/data/ and /static/data/");
}

compileTransitData().catch(console.error);
