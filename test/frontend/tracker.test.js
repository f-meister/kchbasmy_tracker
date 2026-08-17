import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('tracker.js - Global App Orchestration Bootstrapper Suite', () => {
  let trackerCode;

  beforeEach(() => {
    // 1. Read production source file contents
    const trackerPath = path.resolve(__dirname, '../../assets/js/tracker.js');
    trackerCode = fs.readFileSync(trackerPath, 'utf8');

    // 2. Create a universal fluent spy object that safely handles chained Leaflet invocations
    const fluentMock = {
      remove: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      setMaxBounds: vi.fn().mockReturnThis(),
      fitBounds: vi.fn().mockReturnThis(),
      unproject: vi.fn().mockReturnValue({ lat: 0, lng: 0 })
    };

    // 3. Initialize window environment variables with perfect functional compliance
    global.window = {
      routesPathsData: {
        features: [
          { properties: { routeCode: 'kch10', routeName: 'Kuching Sentral Main Line' } }
        ]
      },
      routeNamesLookup: {},
      routeStopsIndex: { 'kch10': [101, 102] },
      stopRoutesIndex: {},
      timetableMap: { 'kch10': '/maps/kch10.png' },
      txtPrompt: '◄ Choose the bus route you want to track',
      txtTimetable: 'Click here for %ROUTE% Transit Map',
      
      map: fluentMock, 
      
      injectDynamicCopyrightYear: vi.fn(),
      syncLiveBusTracker: vi.fn(),
      renderFilteredBusStops: vi.fn(),
      updateRouteDescriptionLabel: vi.fn(),
      getDisplayRouteCode: vi.fn().mockImplementation(code => code.toUpperCase())
    };

    // 4. Construct global Leaflet (L) instance configurations
    global.L = {
      map: vi.fn().mockReturnValue(fluentMock),
      imageOverlay: vi.fn().mockReturnValue(fluentMock),
      LatLngBounds: vi.fn().mockReturnValue(fluentMock),
      CRS: { Simple: {} }
    };

    // 5. Build an interactive DOM element spy that tracks configurations seamlessly
    const mockDOMElement = {
      appendChild: vi.fn(),
      addEventListener: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      },
      style: { display: 'none', opacity: '1' },
      innerText: '',
      textContent: '',
      value: ''
    };

    global.listeners = {};
    global.document = {
      addEventListener: vi.fn().mockImplementation((event, callback) => {
        global.listeners[event] = callback;
      }),
      getElementById: vi.fn().mockImplementation((id) => {
        if (id === 'route-selector') return { ...mockDOMElement, value: 'all' };
        return mockDOMElement;
      }),
      createElement: vi.fn().mockReturnValue({ value: '', textContent: '' }),
      querySelectorAll: vi.fn().mockReturnValue([mockDOMElement])
    };

    // 6. Polyfill basic browser global constructor fallbacks
    global.Image = function() {
      return {
        onload: null,
        onerror: null
      };
    };
    global.setInterval = vi.fn();

    // 7. Inject variables context frame directly into the execution sandbox
    // 🌟 FIX: Added 'syncLiveBusTracker' to the sandbox parameters array
    const runScript = new Function(
      'window', 
      'document', 
      'L', 
      'setInterval', 
      'Image', 
      'getDisplayRouteCode', 
      'renderFilteredBusStops', 
      'updateRouteDescriptionLabel', 
      'syncLiveBusTracker',
      trackerCode
    );
    
    runScript(
      global.window, 
      global.document, 
      global.L, 
      global.setInterval, 
      global.Image, 
      global.window.getDisplayRouteCode,
      global.window.renderFilteredBusStops,
      global.window.updateRouteDescriptionLabel,
      global.window.syncLiveBusTracker
    );
  });

  it('should successfully register a DOMContentLoaded listener immediately on execution', () => {
    expect(global.document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    expect(global.listeners['DOMContentLoaded']).toBeDefined();
  });

  it('should compile GeoJSON parameters into state registries and append operational select elements when DOM initializes', () => {
    global.listeners['DOMContentLoaded']();

    expect(global.window.routeNamesLookup['kch10']).toBe('Kuching Sentral Main Line');
    expect(global.window.stopRoutesIndex[101]).toContain('KCH10');
    expect(global.document.createElement).toHaveBeenCalledWith('option');
  });

  it('should boot up synchronization timers and start the telemetry engine loop', () => {
    global.listeners['DOMContentLoaded']();

    expect(global.window.injectDynamicCopyrightYear).toHaveBeenCalled();
    expect(global.window.syncLiveBusTracker).toHaveBeenCalled();
    expect(global.window.renderFilteredBusStops).toHaveBeenCalledWith('all');
    
    expect(global.setInterval).toHaveBeenCalledWith(global.window.syncLiveBusTracker, 30000);
  });
});
