import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('parse-trip-routes.js - Multi-Route Interlining Dictionary Compiler Suite', () => {
  let scriptCode;
  let mockFs, mockProcessExit;

  beforeEach(() => {
    // 1. Read production source file contents
    const scriptPath = path.resolve(__dirname, '../.devcontainer/scripts/parse-trip-routes.js');
    scriptCode = fs.readFileSync(scriptPath, 'utf8');

    // 2. Mock File System with compiled mock JSON strings
    mockFs = {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockImplementation((filePath) => {
        if (filePath.endsWith('stop_times.json')) {
          return JSON.stringify({
            // Prefix pattern matching: "PREFIX_TRIP-ID"
            '268_TRIP01': { 'STOP_HUB': '08:30' }
          });
        }
        if (filePath.endsWith('route_stops_index.json')) {
          return JSON.stringify({
            'KCH10': ['STOP_HUB']
          });
        }
        return '{}';
      }),
      writeFileSync: vi.fn()
    };

    mockProcessExit = vi.fn();
    global.process.exit = mockProcessExit;
    global.console = { log: vi.fn(), error: vi.fn() };
  });

  const runTripRoutesScript = (customFs) => {
    const sandboxRequire = (moduleName) => {
      if (moduleName === 'fs') return customFs;
      return require(moduleName);
    };

    const dummyDirname = '/workspace/.devcontainer/scripts';
    const runScript = new Function('require', 'process', 'console', '__dirname', scriptCode);
    
    runScript(sandboxRequire, global.process, global.console, dummyDirname);

    // Call the synchronous execution entry point directly if bound globally
    if (typeof global.generateTripRouteIndex === 'function') {
      global.generateTripRouteIndex();
    }
  };

  it('should immediately fail and trigger exit routines if required source JSON dependencies are missing', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);

    runTripRoutesScript(mockFs);

    expect(global.console.error).toHaveBeenCalledWith(
      expect.stringContaining('Required compiled JSON assets missing')
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it('should successfully match trip ID prefixes to multi-route intersections and write a sorted array lookup map', () => {
    runTripRoutesScript(mockFs);

    expect(mockFs.writeFileSync).toHaveBeenCalled();
    
    // Parse out what the script wrote down to the assets directory
    const outputJson = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);

    // Verifies that trip prefixes map perfectly to their matching lowercased route intersections
    expect(outputJson['268']).toBeDefined();
    expect(outputJson['268']).toContain('kch10');
  });
});
