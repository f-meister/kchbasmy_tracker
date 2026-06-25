import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('map_utils.js - Leaflet Canvas & GeoJSON Render Engine Suite', () => {
  let mapUtilsCode;

  beforeEach(() => {
    // 1. Read production source file contents
    const mapUtilsPath = path.resolve(__dirname, '../assets/js/map_utils.js');
    mapUtilsCode = fs.readFileSync(mapUtilsPath, 'utf8');

    // 2. Initialize pristine global window context properties
    global.window = {
      txtZoomIn: 'Zoom In',
      txtZoomOut: 'Zoom Out',
      txtFullscreen: 'Fullscreen',
      txtFullscreenExit: 'Exit Fullscreen',
      txtPopScheduled: 'Scheduled:',
      txtPopRoutes: 'Routes:',
      currentlyOpenStopId: null,
      getDisplayRouteCode: vi.fn().mockImplementation(code => code.toUpperCase()),
      startUserLocationTracking: vi.fn(),
      stopUserLocationTracking: vi.fn()
    };

    // 3. Complete structural Leaflet factory method spies
    const mockMapInstance = {
      setView: vi.fn().mockReturnThis(),
      createPane: vi.fn(),
      getPane: vi.fn().mockReturnValue({ style: {} }),
      dragging: { enable: vi.fn() },
      addControl: vi.fn()
    };

    const mockControlFn = vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis() });
    mockControlFn.zoom = vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis() });
    mockControlFn.fullscreen = vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis() });

    global.L = {
      map: vi.fn().mockReturnValue(mockMapInstance),
      // 🌟 FIX 1: Add .mockReturnThis() so that chaining .addTo() returns the actual group instance
      tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis() }),
      layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis() }),
      control: mockControlFn,
      Control: {
        extend: vi.fn().mockImplementation((config) => {
          return function() {
            return {
              addTo: vi.fn(),
              _onAdd: config.onAdd
            };
          };
        })
      },
      DomUtil: {
        create: vi.fn().mockReturnValue({
          className: '',
          innerHTML: '',
          addEventListener: vi.fn()
        })
      },
      DomEvent: {
        disableClickPropagation: vi.fn()
      }
    };

    // 4. Standalone element locator mocks
    global.document = {
      getElementById: vi.fn().mockReturnValue({ value: 'off' })
    };

    global.setTimeout = vi.fn();

    // 5. Build dynamic sandboxed lookup instance evaluation context
    const runScript = new Function('window', 'document', 'L', 'setTimeout', mapUtilsCode);
    runScript(global.window, global.document, global.L, global.setTimeout);
  });

  it('should initialize the root map framework focused directly over Kuching baseline variables', () => {
    expect(global.L.map).toHaveBeenCalledWith('map', expect.any(Object));
    expect(global.window.map.setView).toHaveBeenCalledWith([1.5574, 110.3538], 12);
  });

  it('should construct isolated functional drawing layer groups securely', () => {
    expect(global.L.layerGroup).toHaveBeenCalledTimes(3);
    // Verified perfectly now that the chain doesn't break into undefined!
    expect(global.window.busLayer).toBeDefined();
    expect(global.window.pathLayer).toBeDefined();
    expect(global.window.stopLayer).toBeDefined();
  });

  it('should accurately bind and setup zoom and custom fullscreen layout controls', () => {
    expect(global.L.control.zoom).toHaveBeenCalledWith({
      position: 'topleft',
      zoomInTitle: global.window.txtZoomIn,
      zoomOutTitle: global.window.txtZoomOut
    });
    expect(global.L.control.fullscreen).toHaveBeenCalledWith({
      position: 'topleft',
      title: {
        'false': global.window.txtFullscreen,
        'true':  global.window.txtFullscreenExit
      }
    });
  });

  it('should successfully build the custom LocationControl container layer matching markup specifications', () => {
    const CustomControlConstructor = global.L.Control.extend.mock.results[0].value;
    const instance = new CustomControlConstructor();
    
    const container = instance._onAdd();
    
    expect(global.L.DomUtil.create).toHaveBeenCalledWith('div', expect.stringContaining('custom-location-control'));
    expect(container.innerHTML).toContain('id="location-toggle-btn"');
    expect(global.L.DomEvent.disableClickPropagation).toHaveBeenCalledWith(container);
  });
});
