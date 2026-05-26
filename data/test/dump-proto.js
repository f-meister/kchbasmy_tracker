// dump-proto.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

// switch between the real-time protobuf endpoint and the static GTFS snapshot for testing
// const API_URL = "https://api.data.gov.my/gtfs-realtime/vehicle-position/mybas-kuching";
// const API_URL = "https://api.data.gov.my/gtfs-static/mybas-kuching"

async function dumpRawData() {
  try {
    console.log("📡 Fetching raw protobuf stream from data.gov.my...");
    
    // 1. Fetch the raw binary stream
    const response = await axios({
      method: 'get',
      url: API_URL,
      responseType: 'arraybuffer' 
    });

    console.log("📦 Decoding binary protobuf structure...");
    
    // 2. Decode the binary footprint into a native JS Object using the official bindings
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));

    // 3. Convert the decoded object to a clean, readable JSON format
    // This strips out complex internal Protobuf class methods and keeps raw data
    const cleanJsonString = JSON.stringify(feed, null, 2);

    // 4. Dump it to a file in your workspace root
    const outputPath = path.join(__dirname, 'raw-feed-dump.json');
    fs.writeFileSync(outputPath, cleanJsonString);

    console.log(`✨ Success! Full raw data dumped to: ${outputPath}`);
    
    // Quick log to show how many active entities are on the road right now
    if (feed.entity) {
        console.log(`📊 Found ${feed.entity.length} active vehicle entities in the feed.`);
    }

  } catch (error) {
    console.error("❌ Error fetching or decoding protobuf data:", error.message);
  }
}

dumpRawData();
