import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import mockPayload from '../../data/test/dummy_bus_loc.json';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const useMock = url.searchParams.get('mock') === 'true';
  const API_URL = "https://api.data.gov.my/gtfs-realtime/vehicle-position/mybas-kuching";

  // --- EDGE CACHE INTERCEPT LAYER ---
  const cache = caches.default;
  if (!useMock) {
    const cachedResponse = await cache.match(context.request);
    if (cachedResponse) {
      console.log("⚡ Cloudflare Cache Hit: Returning live transit arrays instantly from the edge!");
      return cachedResponse;
    }
  }
  // ----------------------------------

  try {
    // 1. Core Data Routing Switch Layer
    if (useMock) {
      console.log("🛠️ Mock Flag Detected: Ingesting dummy simulation payload natively...");
      return processFeedEntities(mockPayload.entity, url.origin);
    } else {
      // Standard Production Route: Stream live binary footprint from government API
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Live realtime endpoint unreachable");
      
      const arrayBuffer = await response.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(arrayBuffer));
      
      // Compute fresh records
      const freshResponse = await processFeedEntities(feed.entity, url.origin);
      
      // Store the successful response into Cloudflare's CDN cache memory block before returning it
      context.waitUntil(cache.put(context.request, freshResponse.clone()));
      
      return freshResponse;
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Helper function to handle the relational concatenation logic uniformly
async function processFeedEntities(entities, originUrl) {
  // Fetch our build-time compiled trip lookup mapping dictionary
  const lookupResponse = await fetch(`${originUrl}/data/trip_lookup.json`);
  const tripLookup = lookupResponse.ok ? await lookupResponse.json() : {};

  const cleanBuses = entities.map(entity => {
    const vNode = entity.vehicle || entity;
    if (!vNode || !vNode.position) return null;

    const liveTripId = vNode.trip ? vNode.trip.tripId : null;
    let staticMeta = {};

    if (liveTripId) {
      // 1. First Pass: Check for exact match safety fallback
      if (tripLookup[liveTripId]) {
        staticMeta = tripLookup[liveTripId];
      } else {
        // 2. Dynamic Prefix Matching Fix: Extract schedule block index (e.g. "206" from "206_1_WD_12")
        const prefix = liveTripId.split('_')[0];
        
        // Locate any key in trip_lookup that shares this exact numeric routing block sequence
        const matchingKey = Object.keys(tripLookup).find(k => k.startsWith(`${prefix}_`));
        if (matchingKey) {
          staticMeta = tripLookup[matchingKey];
        }
      }
    }

    return {
      id: entity.id,
      vehicleNumber: vNode.vehicle?.id || vNode.vehicle?.label || 'Unknown',
      latitude: vNode.position.latitude,
      longitude: vNode.position.longitude,
      bearing: vNode.position.bearing || 0,
      tripId: liveTripId,
      // FIX 1: Safely pass the primitive timestamp string/integer to the frontend
      timestamp: vNode.timestamp || null,
      // FIX 2: Default unmapped rows to lowercase 'bus' to match standard string formatting rules cleanly
      routeCode: staticMeta.routeCode || 'bus',
      shapeId: staticMeta.shapeId || null,
      routeName: staticMeta.routeName || 'In-Service Live Vector'
    };
  }).filter(bus => bus !== null && bus.latitude !== null && bus.latitude !== 0);

  return new Response(JSON.stringify(cleanBuses), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=30" 
    }
  });
}
