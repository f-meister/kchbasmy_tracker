import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('validate-gtfs.js - Automated Lifecycle Validation Pipeline Suite', () => {
  let scriptCode;
  let mockFs, mockHttps, mockChildProcess, mockProcessExit;
  const requiredFiles = ['routes.txt', 'shapes.txt', 'stop_times.txt', 'stops.txt', 'trips.txt'];

  beforeEach(() => {
    // 1. Read production source file contents
    const scriptPath = path.resolve(__dirname, '../../.devcontainer/scripts/validate-gtfs.js');
    scriptCode = fs.readFileSync(scriptPath, 'utf8');

    // 2. Build explicit spies for standard Node File System rules
    mockFs = {
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue('gtfs-status: normal'),
      // 🌟 FIX: Add isDirectory functional spy layer onto statSync profile maps
      statSync: vi.fn().mockReturnValue({ 
        size: 50000,
        isDirectory: vi.fn().mockReturnValue(false)
      }), 
      mkdirSync: vi.fn(),
      rmSync: vi.fn(),
      readdirSync: vi.fn().mockReturnValue(requiredFiles), 
      renameSync: vi.fn(),
      copyFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      createWriteStream: vi.fn().mockReturnValue({
        on: vi.fn().mockImplementation(function(event, callback) {
          if (event === 'finish') callback();
          return this;
        }),
        close: vi.fn()
      })
    };

    // 3. Mock Node HTTPS requests and stream piping mechanisms
    mockHttps = {
      request: vi.fn().mockImplementation((url, options, callback) => {
        const mockResponse = {
          statusCode: 200,
          headers: { 'content-length': '60000' }, 
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') callback('fake-zip-stream-chunks');
            if (event === 'end') callback();
          })
        };
        if (callback) callback(mockResponse);
        return { on: vi.fn(), end: vi.fn() };
      }),
      get: vi.fn().mockImplementation((url, callback) => {
        const mockResponse = {
          statusCode: 200,
          pipe: vi.fn(),
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'end') callback();
          })
        };
        if (callback) callback(mockResponse);
        return { on: vi.fn() };
      })
    };

    // 4. Mock child process shell system integrations
    mockChildProcess = {
      execSync: vi.fn()
    };

    // 5. Intercept global process handlers cleanly
    mockProcessExit = vi.fn();
    global.process.exit = mockProcessExit;
    global.console = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  // Custom runner block that handles sandboxed microtask queues
  const runValidationScript = async (customFs, customHttps, customChildProcess) => {
    const sandboxRequire = (moduleName) => {
      if (moduleName === 'fs') return customFs;
      if (moduleName === 'https') return customHttps;
      if (moduleName === 'child_process') return customChildProcess;
      return require(moduleName); 
    };

    const dummyDirname = '/workspace/.devcontainer/scripts';
    const runScript = new Function('require', 'process', 'console', '__dirname', scriptCode);
    
    runScript(sandboxRequire, global.process, global.console, dummyDirname);
    
    // Allow unreturned macro/micro async promises to completely flush
    await new Promise(resolve => setTimeout(resolve, 15));
  };

  it('should cleanly fallback to local master baseline archive if run_config.yml is missing', async () => {
    mockFs.existsSync = vi.fn().mockImplementation((p) => {
      if (p.endsWith('run_config.yml')) return false;
      return true;
    });

    await runValidationScript(mockFs, mockHttps, mockChildProcess);

    expect(global.console.log).toHaveBeenCalledWith(
      expect.stringContaining('run_config.yml not found')
    );
  });

  it('should download remote file streams when API content sizes pass validation limits', async () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    
    mockFs.readFileSync = vi.fn().mockImplementation((p) => {
      if (p.endsWith('run_config.yml')) return 'gtfs-status: normal';
      return 'header\nrow1\nrow2\nrow3\n'; 
    });

    await runValidationScript(mockFs, mockHttps, mockChildProcess);

    expect(mockHttps.request).toHaveBeenCalled();
    expect(mockFs.copyFileSync).not.toHaveBeenCalled();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });

  it('should immediately trigger offline failsafe backups if server endpoints throw connection disruptions', async () => {
    mockHttps.request = vi.fn().mockImplementation(() => {
      throw new Error('Connection Timeout');
    });

    await runValidationScript(mockFs, mockHttps, mockChildProcess);

    expect(mockFs.copyFileSync).toHaveBeenCalled();
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });

  it('should enforce self-healing recovery triggers if extracted data contains truncated row metrics', async () => {
    mockFs.readFileSync = vi.fn().mockImplementation((p) => {
      if (p.endsWith('run_config.yml')) return 'gtfs-status: normal';
      return 'header\n'; 
    });

    await runValidationScript(mockFs, mockHttps, mockChildProcess);

    expect(global.console.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed validation metrics')
    );
    expect(mockChildProcess.execSync).toHaveBeenCalled(); 
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });
});
