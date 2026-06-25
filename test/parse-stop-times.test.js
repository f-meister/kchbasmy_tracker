import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('parse-stop-times.js - Heavy Schedule Processing Engine Suite', () => {
  let scriptCode;
  let mockFs, mockReadline, mockProcessExit;

  beforeEach(() => {
    // 1. Read production source file contents
    const scriptPath = path.resolve(__dirname, '../.devcontainer/scripts/parse-stop-times.js');
    scriptCode = fs.readFileSync(scriptPath, 'utf8');

    // 2. Setup standard Node File System spies
    mockFs = {
      existsSync: vi.fn().mockReturnValue(true),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
      createReadStream: vi.fn().mockReturnValue({ dummyStream: true })
    };

    // 3. Mock Readline interface to simulate a file streaming lines dynamically
    mockReadline = {
      createInterface: vi.fn().mockImplementation(({ input }) => {
        // Expose an asynchronous iterator framework to mimic "for await (const line of rl)"
        return {
          [Symbol.asyncIterator]: async function* () {
            // Default lines yielded by the stream generator loop
            yield 'trip_id,arrival_time,departure_time,stop_id,stop_sequence';
            yield 'TRIP_01,08:30:22,08:30:45,STOP_99,1';
            yield 'TRIP_01,09:15:00,09:15:15,STOP_100,2';
          }
        };
      })
    };

    // 4. Intercept execution exit states safely
    mockProcessExit = vi.fn();
    global.process.exit = mockProcessExit;
    global.console = { log: vi.fn(), error: vi.fn() };
  });

  const runParserScript = async (customFs, customReadline) => {
    const sandboxRequire = (moduleName) => {
      if (moduleName === 'fs') return customFs;
      if (moduleName === 'readline') return customReadline;
      return require(moduleName); // Fallback securely for 'path'
    };

    const dummyDirname = '/workspace/.devcontainer/scripts';
    const runScript = new Function('require', 'process', 'console', '__dirname', scriptCode);
    
    // Fire the compiler block execution function wrapper
    runScript(sandboxRequire, global.process, global.console, dummyDirname);

    // Call the global async compiler hook embedded in the text script directly
    if (typeof global.compileStopTimes === 'function') {
      await global.compileStopTimes();
    } else {
      // If the function is called immediately at the bottom of the script natively, 
      // flush Node's microtask promise queue instead
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };

  it('should immediately crash with an error status if stop_times.txt cannot be found', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);

    await runParserScript(mockFs, mockReadline);

    expect(global.console.error).toHaveBeenCalledWith(
      expect.stringContaining('Cannot find source text file')
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it('should abort cleanly if the input file contains records but is missing crucial layout headers', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    
    // Simulate a bad CSV header missing trip_id or stop_id
    mockReadline.createInterface = vi.fn().mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () {
        yield 'broken_header,arrival_time,some_other_column';
        yield 'VAL,08:30:00,DATA';
      }
    }));

    await runParserScript(mockFs, mockReadline);

    expect(global.console.error).toHaveBeenCalledWith(
      expect.stringContaining('missing vital columns')
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it('should successfully compile rows down-sampling seconds chunks to clean HH:MM tokens', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);

    await runParserScript(mockFs, mockReadline);

    expect(mockFs.writeFileSync).toHaveBeenCalled();
    
    // Extract the exact payload written out to the assets folder asset
    const writtenJson = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);

    // Verifies that trip index groups records correctly
    expect(writtenJson['TRIP_01']).toBeDefined();
    // Verifies seconds are down-sampled smoothly from "08:30:22" to "08:30"
    expect(writtenJson['TRIP_01']['STOP_99']).toBe('08:30');
    expect(writtenJson['TRIP_01']['STOP_100']).toBe('09:15');
    
    expect(global.console.log).toHaveBeenCalledWith(
      expect.stringContaining('Processed and compiled 2 rows')
    );
  });
});
