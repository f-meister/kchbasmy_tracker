import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import mockPayload from '../../data/test/dummy_bus_loc.json';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const useMock = url.searchParams.get('mock') === 'true';
  const API_URL = "https://api.data.gov.my/gtfs-realtime/vehicle-position/mybas-kuching";

  // --- EDGE CACHE INTERCEPT LAYER ---
  // We check Cloudflare's default global cache memory first (skip for active simulation testing)
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
      // Cloudflare reads the max-age header automatically to set the expiration window
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
      // cache-control tells both the client browser AND the cloudflare cache intercept layer to lock data for 30s
      "Cache-Control": "public, max-age=30" 
    }
  });
}
