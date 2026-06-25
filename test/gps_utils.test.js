import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('gps_utils.js - Core Geolocation Tracking Engine Suite', () => {
  let gpsCode;
  let originalNavigator;

  beforeAll(() => {
    originalNavigator = global.navigator;
  });

  beforeEach(() => {
    const gpsPath = path.resolve(__dirname, '../assets/js/gps_utils.js');
    gpsCode = fs.readFileSync(gpsPath, 'utf8');

    global.window = {
      geolocationWatchId: null,
      userLocationMarker: null,
      userAccuracyCircle: null,
      lastCalculatedPosition: null,
      calculateHaversineDistance: vi.fn(),
      map: {
        removeLayer: vi.fn(),
        setView: vi.fn()
      }
    };

    global.L = {
      divIcon: vi.fn().mockReturnValue({}),
      marker: vi.fn().mockReturnValue({
        addTo: vi.fn().mockReturnThis()
      }),
      circle: vi.fn().mockReturnValue({
        addTo: vi.fn().mockReturnThis()
      })
    };

    global.document = {
      getElementById: vi.fn().mockReturnValue(null)
    };

    global.console = { error: vi.fn(), warn: vi.fn() };

    const mockNavigator = {
      geolocation: {
        watchPosition: vi.fn().mockReturnValue(888),
        clearWatch: vi.fn()
      }
    };
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
      configurable: true
    });

    // 🌟 FIX: Removed 'navigator' and 'console' from parameters so they look up dynamically from 'global'
    const runScript = new Function('window', 'document', 'L', 'calculateHaversineDistance', gpsCode);
    runScript(
      global.window, 
      global.document, 
      global.L, 
      global.window.calculateHaversineDistance
    );
  });

  afterAll(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator });
  });

  describe('startUserLocationTracking()', () => {
    it('should abort cleanly if the toggle button does not exist in the DOM', () => {
      global.document.getElementById = vi.fn().mockReturnValue(null);

      global.window.startUserLocationTracking();

      expect(global.navigator.geolocation.watchPosition).not.toHaveBeenCalled();
    });

    it('should fallback securely and report error to console log if the browser lacks Geolocation API capabilities', () => {
      const mockBtn = { setAttribute: vi.fn() };
      global.document.getElementById = vi.fn().mockReturnValue(mockBtn);

      // Now this runtime override will be read dynamically and accurately!
      Object.defineProperty(global, 'navigator', {
        value: {},
        configurable: true
      });

      global.window.startUserLocationTracking();

      expect(mockBtn.setAttribute).toHaveBeenCalledWith('data-tracking-state', 'seeking');
      expect(mockBtn.setAttribute).toHaveBeenCalledWith('data-tracking-state', 'off');
      expect(global.console.error).toHaveBeenCalledWith("Geolocation API isn't supported by this browser.");
    });

    it('should initialize a high-accuracy geo watch listener if context conditions are met', () => {
      const mockBtn = { setAttribute: vi.fn() };
      global.document.getElementById = vi.fn().mockReturnValue(mockBtn);

      global.window.startUserLocationTracking();

      expect(mockBtn.setAttribute).toHaveBeenCalledWith('data-tracking-state', 'seeking');
      expect(global.navigator.geolocation.watchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      expect(global.window.geolocationWatchId).toBe(888);
    });
  });

  describe('stopUserLocationTracking()', () => {
    it('should clear watch streams and flush Leaflet tracking layer markers out completely', () => {
      const mockBtn = { setAttribute: vi.fn() };
      global.document.getElementById = vi.fn().mockReturnValue(mockBtn);

      global.window.geolocationWatchId = 999;
      global.window.userLocationMarker = { dummyMarker: true };
      global.window.userAccuracyCircle = { dummyCircle: true };
      global.window.lastCalculatedPosition = { lat: 1.55, lon: 110.35 };

      global.window.stopUserLocationTracking();

      expect(global.navigator.geolocation.clearWatch).toHaveBeenCalledWith(999);
      expect(global.window.geolocationWatchId).toBeNull();
      expect(global.window.map.removeLayer).toHaveBeenCalledTimes(2);
      expect(global.window.userLocationMarker).toBeNull();
      expect(global.window.userAccuracyCircle).toBeNull();
      expect(global.window.lastCalculatedPosition).toBeNull();
      expect(mockBtn.setAttribute).toHaveBeenCalledWith('data-tracking-state', 'off');
    });
  });
});
