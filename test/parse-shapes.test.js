import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('parse-shapes.js - Spatial GeoJSON Compiler Engine Suite', () => {
  let scriptCode;
  let mockFs, mockReadline;

  beforeEach(() => {
    const scriptPath = path.resolve(__dirname, '../.devcontainer/scripts/parse-shapes.js');
    scriptCode = fs.readFileSync(scriptPath, 'utf8');

    mockFs = {
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      createReadStream: vi.fn().mockImplementation((filePath) => {
        return { targetFile: path.basename(filePath) };
      })
    };

    mockReadline = {
      createInterface: vi.fn().mockImplementation(({ input }) => {
        return {
          [Symbol.asyncIterator]: async function* () {
            if (input.targetFile === 'routes.txt') {
              yield 'route_id,route_short_name,route_long_name';
              yield 'R_K10,KCH10,Kuching Sentral Main';
            }
            else if (input.targetFile === 'trips.txt') {
              yield 'route_id,trip_id,shape_id';
              yield 'R_K10,TRIP_01,SHAPE_V1';
            }
            else if (input.targetFile === 'stop_times.txt') {
              yield 'trip_id,stop_id,stop_sequence';
              yield 'TRIP_01,STOP_HUB,1';
            }
            else if (input.targetFile === 'stops.txt') {
              yield 'stop_id,stop_name,stop_lat,stop_lon';
              yield 'STOP_HUB,Kuching Sentral,1.492,110.334';
            }
            else if (input.targetFile === 'shapes.txt') {
              yield 'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence';
              yield 'SHAPE_V1,1.495,110.338,2';
              yield 'SHAPE_V1,1.492,110.334,1';
            }
          }
        };
      })
    };

    global.console = { log: vi.fn(), error: vi.fn() };
  });

  const runShapesScript = async (customFs, customReadline) => {
    const sandboxRequire = (moduleName) => {
      if (moduleName === 'fs') return customFs;
      if (moduleName === 'readline') return customReadline;
      return require(moduleName);
    };

    const dummyDirname = '/workspace/.devcontainer/scripts';
    const runScript = new Function('require', 'console', '__dirname', scriptCode);
    
    runScript(sandboxRequire, global.console, dummyDirname);

    if (typeof global.compileTransitData === 'function') {
      await global.compileTransitData();
    } else {
      await new Promise(resolve => setTimeout(resolve, 15));
    }
  };

  it('should successfully establish target compilation folders upon booting', async () => {
    await runShapesScript(mockFs, mockReadline);

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('assets'), { recursive: true });
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('static'), { recursive: true });
  });

  it('should process, numerically sort spatial shape tracking segments, and construct valid GeoJSON paths', async () => {
    await runShapesScript(mockFs, mockReadline);

    expect(mockFs.writeFileSync).toHaveBeenCalled();

    const pathsCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('routes_paths.json'));
    expect(pathsCall).toBeDefined();

    const pathsGeoJson = JSON.parse(pathsCall[1]);
    expect(pathsGeoJson.type).toBe('FeatureCollection');
    
    const lineFeature = pathsGeoJson.features[0];
    expect(lineFeature.properties.shape_id).toBe('SHAPE_V1');
    // 🌟 FIX: Checked against true production uppercase formatting mapping rules
    expect(lineFeature.properties.routeCode).toBe('KCH10'); 
    
    const coordinates = lineFeature.geometry.coordinates;
    expect(coordinates[0]).toEqual([110.334, 1.492]); 
    expect(coordinates[1]).toEqual([110.338, 1.495]); 
  });

  it('should generate accurate stop location collections and map relational stop indices cleanly', async () => {
    await runShapesScript(mockFs, mockReadline);

    const indexCall = mockFs.writeFileSync.mock.calls.find(c => c[0].endsWith('route_stops_index.json'));
    expect(indexCall).toBeDefined();

    const stopIndexJson = JSON.parse(indexCall[1]);
    // 🌟 FIX: Look up using production uppercase indexing properties
    expect(stopIndexJson['KCH10']).toContain('STOP_HUB');
  });
});
