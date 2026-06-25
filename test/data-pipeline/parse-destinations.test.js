import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('parse-destinations.js - Relational Terminal Terminus Compiler Suite', () => {
  let scriptCode;
  let mockFs, mockReadline;

  beforeEach(() => {
    // 1. Read production source file contents
    const scriptPath = path.resolve(__dirname, '../../.devcontainer/scripts/parse-destinations.js');
    scriptCode = fs.readFileSync(scriptPath, 'utf8');

    // 2. Mock File System with directory safeguards
    mockFs = {
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      createReadStream: vi.fn().mockImplementation((filePath) => {
        return { targetFile: path.basename(filePath) };
      })
    };

    // 3. Setup dynamic streaming lines matching our relational files
    mockReadline = {
      createInterface: vi.fn().mockImplementation(({ input }) => {
        return {
          [Symbol.asyncIterator]: async function* () {
            if (input.targetFile === 'routes.txt') {
              yield 'route_id,route_short_name,route_long_name';
              yield 'R_10,KCH10,Kuching Sentral Main Line';
            }
            else if (input.targetFile === 'trips.txt') {
              yield 'route_id,trip_id,direction_id';
              yield 'R_10,TRIP_A,1';
              yield 'R_10,TRIP_B,2';
            }
            else if (input.targetFile === 'stop_times.txt') {
              yield 'trip_id,stop_id,stop_sequence';
              // Sequence indicators to test tracking the terminal destination (highest sequence number)
              yield 'TRIP_A,STOP_MID,1';
              yield 'TRIP_A,STOP_END_A,2';
              yield 'TRIP_B,STOP_MID,1';
              yield 'TRIP_B,STOP_END_B,5'; 
            }
            else if (input.targetFile === 'stops.txt') {
              yield 'stop_id,stop_name';
              yield 'STOP_MID,Intermediary Station';
              yield 'STOP_END_A,Waterfront Terminus';
              yield 'STOP_END_B,Kuching Sentral Hub';
            }
          }
        };
      })
    };

    global.console = { log: vi.fn(), error: vi.fn() };
  });

  const runDestinationsScript = async (customFs, customReadline) => {
    const sandboxRequire = (moduleName) => {
      if (moduleName === 'fs') return customFs;
      if (moduleName === 'readline') return customReadline;
      return require(moduleName);
    };

    const dummyDirname = '/workspace/.devcontainer/scripts';
    const runScript = new Function('require', 'console', '__dirname', scriptCode);
    
    runScript(sandboxRequire, global.console, dummyDirname);

    // Call the async processing execution block directly from the context frame
    if (typeof global.compileDestinations === 'function') {
      await global.compileDestinations();
    } else {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };

  it('should guarantee output directory generation before writing compiled assets', async () => {
    await runDestinationsScript(mockFs, mockReadline);

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('assets', 'data')),
      { recursive: true }
    );
  });

  it('should isolate the highest sequence rows and construct clean directional lookup properties', async () => {
    await runDestinationsScript(mockFs, mockReadline);

    expect(mockFs.writeFileSync).toHaveBeenCalled();
    
    // Extract compiled JSON object payload written directly to the disk array
    const compiledPayload = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);

    // Verifies that lookups translate correctly to lowercase matching frontend keys
    expect(compiledPayload['kch10']).toBeDefined();
    
    // Verifies sequence sorting correctly selected terminal stations over middle stops
    expect(compiledPayload['kch10']['1']).toBe('Waterfront Terminus');
    expect(compiledPayload['kch10']['2']).toBe('Kuching Sentral Hub');
  });
});
