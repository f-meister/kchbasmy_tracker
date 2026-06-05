// .devcontainer/scripts/parse-destinations.js
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

async function compileDestinations() {
  const tmpDir = path.join(__dirname, '..', '..', 'tmp-gtfs');
  const targetDir = path.join(__dirname, '..', '..', 'assets', 'data');

  // Ensure the target directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  console.log("📖 Reading uploaded GTFS source text tables for destinations...");
  
  const routesList = await parseGtfsFile(path.join(tmpDir, 'routes.txt'));
  const tripsList = await parseGtfsFile(path.join(tmpDir, 'trips.txt'));
  const stopTimesList = await parseGtfsFile(path.join(tmpDir, 'stop_times.txt'));
  const stopsList = await parseGtfsFile(path.join(tmpDir, 'stops.txt'));

  // 1. Map route_id -> route_short_name (e.g. 30401 -> "q05")
  const routeMap = {};
  routesList.forEach(row => {
    if (row.route_id && row.route_short_name) {
      routeMap[row.route_id] = row.route_short_name.toLowerCase();
    }
  });

  // 2. Map trip_id -> route code and direction flag
  const tripMap = {};
  tripsList.forEach(row => {
    if (row.trip_id) {
      tripMap[row.trip_id] = {
        routeCode: routeMap[row.route_id] || '',
        directionId: row.direction_id || '0'
      };
    }
  });

  // 3. Scan stop_times to find the highest sequence number for every trip (its final destination)
  const tripLastStop = {};
  stopTimesList.forEach(row => {
    const tId = row.trip_id;
    const seq = parseInt(row.stop_sequence, 10);
    if (!tId || isNaN(seq)) return;

    if (!tripLastStop[tId] || seq > tripLastStop[tId].seq) {
      tripLastStop[tId] = { seq: seq, stopId: row.stop_id };
    }
  });

  // 4. Map stop_id -> stop_name text
  const stopNames = {};
  stopsList.forEach(row => {
    if (row.stop_id) {
      stopNames[row.stop_id] = row.stop_name;
    }
  });

  // 5. Consolidate into our structured lookup object
  const destinationLookup = {};
  Object.keys(tripLastStop).forEach(tId => {
    const tripMeta = tripMap[tId];
    if (tripMeta && tripMeta.routeCode) {
      const rCode = tripMeta.routeCode;
      const dId = tripMeta.directionId;
      const targetStopId = tripLastStop[tId].stopId;
      const terminalName = stopNames[targetStopId] || 'Unknown Terminus';

      if (!destinationLookup[rCode]) {
        destinationLookup[rCode] = {};
      }
      destinationLookup[rCode][dId] = terminalName;
    }
  });

  // 6. Output compiled file directly into the assets folder matching parse-shapes.js layout
  fs.writeFileSync(
    path.join(targetDir, 'destinations.json'),
    JSON.stringify(destinationLookup, null, 2),
    'utf8'
  );
  console.log('✅ Successfully compiled dynamic destination dictionary to assets/data/destinations.json');
}

compileDestinations().catch(console.error);
