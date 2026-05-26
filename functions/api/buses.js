import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// Import the dummy file directly from root data folder ---
// Relative path from /functions/api/ to /data/test/
import mockPayload from '../../data/test/dummy_bus_loc.json';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const useMock = url.searchParams.get('mock') === 'true';
  const API_URL = "https://api.data.gov.my/gtfs-realtime/vehicle-position/mybas-kuching";

  try {
    let rawFeedData;
    
    // 1. Core Data Routing Switch Layer
    if (useMock) {
      console.log("🛠️ Mock Flag Detected: Ingesting dummy simulation payload natively...");
      
      // We pass the imported JSON object's entity array straight into our parser
      return processFeedEntities(mockPayload.entity, url.origin);
    } else {
      // Standard Production Route: Stream live binary footprint from government API
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Live realtime endpoint unreachable");
      const arrayBuffer = await response.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(arrayBuffer));
      return processFeedEntities(feed.entity, url.origin);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// Helper function to handle the relational concatenation logic uniformly
async function processFeedEntities(entities, originUrl) {
  // Fetch our build-time compiled trip lookup mapping dictionary
  const lookupResponse = await fetch(`${originUrl}/data/trip_lookup.json`);
  const tripLookup = lookupResponse.ok ? await lookupResponse.json() : {};

  const cleanBuses = entities.map(entity => {
    if (!entity.vehicle) return null;

    const liveTripId = entity.vehicle.trip ? entity.vehicle.trip.tripId : null;
    const staticMeta = tripLookup[liveTripId] || {};

    return {
      id: entity.id,
      vehicleNumber: entity.vehicle.vehicle?.id || 'Unknown',
      latitude: entity.vehicle.position.latitude,
      longitude: entity.vehicle.position.longitude,
      bearing: entity.vehicle.position.bearing || 0,
      tripId: liveTripId,
      routeCode: staticMeta.routeCode || 'bas.my',
      shapeId: staticMeta.shapeId || null,
      routeName: staticMeta.routeName || 'In Service'
    };
  }).filter(bus => bus !== null && bus.latitude !== null);

  return new Response(JSON.stringify(cleanBuses), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=10" // Drop caching down to 10 seconds for active testing iterations
    }
  });
}
