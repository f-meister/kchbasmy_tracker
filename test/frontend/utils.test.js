import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('utils.js - Core Functional Utilities Suite', () => {
  
  beforeEach(() => {
    // 1. Initialize a clean slate browser global environment stub
    global.window = {
      routeSuffixMap: {}
    };
    global.document = {};

    // 2. Read and dynamically execute your real production file contextually
    const utilsPath = path.resolve(__dirname, '../../assets/js/utils.js');
    const utilsCode = fs.readFileSync(utilsPath, 'utf8');
    
    // Evaluates your file, binding window.calculateHaversineDistance, window.getDisplayRouteCode, etc.
    const runInContext = new Function('window', 'document', utilsCode);
    runInContext(global.window, global.document);
  });

  describe('getDisplayRouteCode()', () => {
    it('should return an empty string if routeCode is falsey', () => {
      expect(global.window.getDisplayRouteCode(null)).toBe('');
      expect(global.window.getDisplayRouteCode(undefined)).toBe('');
      expect(global.window.getDisplayRouteCode('')).toBe('');
    });

    it('should correctly append suffixes when map configuration exists', () => {
      global.window.routeSuffixMap = { "KCH10": "-MAIN", "OUT01": "-BORDER" };
      expect(global.window.getDisplayRouteCode('kch10')).toBe('KCH10-MAIN');
      expect(global.window.getDisplayRouteCode('  out01 ')).toBe('OUT01-BORDER');
    });

    it('should fall back safely to formatted code if missing from map dictionary', () => {
      global.window.routeSuffixMap = { "KCH10": "-MAIN" };
      expect(global.window.getDisplayRouteCode('kch11')).toBe('KCH11');
    });
  });

  describe('calculateHaversineDistance()', () => {
    it('should accurately yield 0 when points match identically', () => {
      expect(global.window.calculateHaversineDistance(1.5574, 110.3538, 1.5574, 110.3538)).toBe(0);
    });

    it('should resolve precise distances for valid coordinate points using true engine math', () => {
      // Distance from Kuching Airport to Kuching Sentral Bus Terminal
      const dist = global.window.calculateHaversineDistance(1.4845, 110.3425, 1.4721, 110.3444);
      
      // Asserts against the actual formula evaluation (~1394.90m)
      expect(dist).toBeCloseTo(1394.9, 1);
    });
  });

  describe('injectDynamicCopyrightYear()', () => {
    it('should locate the element and inject the current calendar year into textContent', () => {
      const mockElement = { textContent: '' };
      
      global.document.getElementById = vi.fn().mockReturnValue(mockElement);

      global.window.injectDynamicCopyrightYear();

      expect(global.document.getElementById).toHaveBeenCalledWith('copyright-year');
      expect(mockElement.textContent).toBe(new Date().getFullYear());
    });
  });
});
