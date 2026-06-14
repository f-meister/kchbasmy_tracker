const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Target paths
const INPUT_GTFS_TXT = path.join(__dirname, '../../tmp-gtfs/stop_times.txt'); 
const OUTPUT_MIN_JSON = path.join(__dirname, '../../assets/data/stop_times.json');

async function compileStopTimes() {
    console.log(`🏗️  Starting pre-build compilation for GTFS schedules...`);

    if (!fs.existsSync(INPUT_GTFS_TXT)) {
        console.error(`❌ Error: Cannot find source text file at ${INPUT_GTFS_TXT}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(INPUT_GTFS_TXT);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let headers = [];
    let tripIdIdx = -1;
    let arrivalTimeIdx = -1;
    let stopIdIdx = -1;
    
    const scheduleCollection = {};
    let rowCount = 0;

    // Robust CSV Regex to split by commas while safely ignoring commas inside quotes
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for await (const line of rl) {
        if (!line.trim()) continue;

        // Split columns safely respecting quotes
        const columns = line.split(csvRegex).map(c => c.trim().replace(/^["']|["']$/g, ''));

        if (headers.length === 0) {
            headers = columns;
            tripIdIdx = headers.indexOf('trip_id');
            arrivalTimeIdx = headers.indexOf('arrival_time');
            stopIdIdx = headers.indexOf('stop_id');

            if (tripIdIdx === -1 || arrivalTimeIdx === -1 || stopIdIdx === -1) {
                console.error("❌ Error: stop_times.txt missing vital columns (trip_id, arrival_time, stop_id).");
                process.exit(1);
            }
            continue;
        }

        const tripId = columns[tripIdIdx];
        const stopId = columns[stopIdIdx]; 
        const arrivalTime = columns[arrivalTimeIdx];

        if (tripId && stopId && arrivalTime) {
            // Store the unedited ID to preserve structure (e.g., "0_WE_1")
            const cleanKey = tripId.trim().toUpperCase();

            if (!scheduleCollection[cleanKey]) {
                scheduleCollection[cleanKey] = {};
            }
            // Strip seconds down to HH:MM format
            scheduleCollection[cleanKey][stopId] = arrivalTime.substring(0, 5);
            rowCount++;
        }
    }

    const outputDir = path.dirname(OUTPUT_MIN_JSON);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_MIN_JSON, JSON.stringify(scheduleCollection, null, 2));
    
    console.log(`\n🎉 Success! Processed and compiled ${rowCount} rows into stop_times.json.`);
    console.log(`💾 Asset written to: ${OUTPUT_MIN_JSON}`);
}

compileStopTimes();
