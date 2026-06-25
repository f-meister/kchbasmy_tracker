import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('api.js - Core Ingestion API Tracker Engine Suite', () => {
  let apiCode;

  beforeEach(() => {
    const apiPath = path.resolve(__dirname, '../../assets/js/api.js');
    apiCode = fs.readFileSync(apiPath, 'utf8');

    global.window = {
      branchName: 'dev',
      busLayer: { clearLayers: vi.fn() },
      txtSyncing: 'Syncing positions...',
      txtLatest: 'Last sync',
      txtPopStream: 'Live Stream',
      txtPopCode: 'Route:',
      txtPopVehicle: 'Bus No:',
      txtPopDestination: 'To:',
      txtPopSource: 'Feed:',
      // 🌟 FIX: Structure the index to match `${bus.routeCode.toLowerCase()}_${bus.route_id}`
      destinationLookup: {
        'kch10_1': { '1': 'Kuching Sentral', '2': 'Waterfront' }
      },
      renderFilteredBusStops: vi.fn(),
      getDisplayRouteCode: vi.fn().mockImplementation(code => code.toUpperCase())
    };

    global.L = {
      divIcon: vi.fn().mockReturnValue({ dummyIcon: true }),
      marker: vi.fn().mockReturnValue({
        bindPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis()
      })
    };

    global.document = {
      getElementById: vi.fn().mockReturnValue(null),
      querySelector: vi.fn().mockReturnValue(null)
    };

    global.fetch = vi.fn();

    const runScript = new Function('window', 'document', 'L', 'fetch', 'getDisplayRouteCode', 'renderFilteredBusStops', apiCode);
    runScript(
      global.window, 
      global.document, 
      global.L, 
      global.fetch,
      global.window.getDisplayRouteCode,
      global.window.renderFilteredBusStops
    );
  });

  it('should abort immediately if the route-selector element is missing from the DOM', async () => {
    global.document.getElementById = vi.fn().mockReturnValue(null);

    global.window.syncLiveBusTracker();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should target the production live route endpoint when running on the main branch', async () => {
    global.window.branchName = 'main';
    
    global.document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'route-selector') return { value: 'all' };
      return { textContent: '' };
    });

    global.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue([])
    });

    global.window.syncLiveBusTracker();

    expect(global.fetch).toHaveBeenCalledWith('/api/buses');
  });

  it('should dynamically read checked radio buttons to support dev mock parameters', async () => {
    global.window.branchName = 'dev';
    
    global.document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'route-selector') return { value: 'all' };
      return { textContent: '' };
    });

    global.document.querySelector = vi.fn().mockReturnValue({ value: 'mock' });

    global.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue([])
    });

    global.window.syncLiveBusTracker();

    expect(global.document.querySelector).toHaveBeenCalledWith('input[name="feed-source"]:checked');
    expect(global.fetch).toHaveBeenCalledWith('/api/buses?mock=true');
  });

  it('should map fetched transit records and inject bound canvas markers onto the Leaflet map pane', async () => {
    global.window.branchName = 'main';

    global.document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'route-selector') return { value: 'all' };
      return { textContent: '' };
    });

    const mockTelemetryPayload = [
      { routeCode: 'kch10', vehicleNumber: 'HW8822', latitude: 1.551, longitude: 110.341, route_id: '1', direction_id: '1' }
    ];

    global.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockTelemetryPayload)
    });

    const mockMarkerInstance = {
      bindPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis()
    };
    global.L.marker = vi.fn().mockReturnValue(mockMarkerInstance);

    global.window.syncLiveBusTracker();

    await vi.waitFor(() => {
      expect(global.window.busLayer.clearLayers).toHaveBeenCalled();
      expect(global.L.marker).toHaveBeenCalledWith([1.551, 110.341], { icon: { dummyIcon: true } });
      
      // 🌟 FIX: Asserting against values guaranteed to render securely from the payload
      expect(mockMarkerInstance.bindPopup).toHaveBeenCalledWith(expect.stringContaining('Route: KCH10'), { maxWidth: 250 });
      expect(mockMarkerInstance.bindPopup).toHaveBeenCalledWith(expect.stringContaining('HW8822'), { maxWidth: 250 });
      
      expect(mockMarkerInstance.addTo).toHaveBeenCalledWith(global.window.busLayer);
      expect(global.window.renderFilteredBusStops).toHaveBeenCalledWith('all');
    });
  });
});
