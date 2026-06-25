import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('config.js - Global App Configuration & L10N Environment Suite', () => {
  let configCode;

  beforeEach(() => {
    // 1. Load the raw production source file
    const configPath = path.resolve(__dirname, '../../assets/js/config.js');
    configCode = fs.readFileSync(configPath, 'utf8');

    // 2. Set up a pristine global object frame mock matching the browser structure
    global.window = {};
    global.console = { log: vi.fn() };
    
    // 3. Default DOM element structure spies
    global.document = {
      getElementById: vi.fn().mockReturnValue(null)
    };
  });

  const executeConfigScript = () => {
    // Dynamically evaluate your source within our custom window/document context sandbox
    const runScript = new Function('window', 'document', 'console', configCode);
    runScript(global.window, global.document, global.console);
  };

  it('should fall back smoothly to default English strings if app-shell element is missing', () => {
    executeConfigScript();

    // Verify properties are bound onto window frame cleanly
    expect(global.window.branchName).toBe('');
    expect(global.window.txtSyncing).toBe('Syncing positions...');
    expect(global.window.txtLatest).toBe('Last sync');
    expect(global.window.txtGeolocate).toBe('Track My Location');
    expect(global.window.geolocationWatchId).toBeNull();
  });

  it('should parse datasets and branches correctly when app-shell wrapper exists', () => {
    const mockAppShell = {
      getAttribute: vi.fn().mockReturnValue('dev'),
      dataset: {
        txtSyncing: 'Mengemas kini...',
        txtLatest: 'Senarai terakhir'
      }
    };

    global.document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'app-shell') return mockAppShell;
      return null;
    });

    executeConfigScript();

    expect(mockAppShell.getAttribute).toHaveBeenCalledWith('data-branch');
    expect(global.window.branchName).toBe('dev');
    expect(global.window.txtSyncing).toBe('Mengemas kini...');
    expect(global.window.txtLatest).toBe('Senarai terakhir');
    // Keeps fallback defaults for unmapped dataset entities
    expect(global.window.txtGeolocate).toBe('Track My Location'); 
  });

  it('should hide the feed control wrapper panel completely if branch context is main', () => {
    const mockAppShell = { getAttribute: vi.fn().mockReturnValue('main'), dataset: {} };
    const mockFeedPanel = { style: { display: 'block' } };

    global.document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'app-shell') return mockAppShell;
      if (id === 'feed-control-wrapper') return mockFeedPanel;
      return null;
    });

    executeConfigScript();

    expect(global.window.branchName).toBe('main');
    expect(mockFeedPanel.style.display).toBe('none'); // Muted on production main channel
  });

  it('should deactivate analytics engine and leave control panel visible if branch context is dev', () => {
    const mockAppShell = { getAttribute: vi.fn().mockReturnValue('dev'), dataset: {} };
    const mockFeedPanel = { style: { display: 'block' } };

    global.document.getElementById = vi.fn().mockImplementation((id) => {
      if (id === 'app-shell') return mockAppShell;
      if (id === 'feed-control-wrapper') return mockFeedPanel;
      return null;
    });

    executeConfigScript();

    expect(global.window.branchName).toBe('dev');
    expect(mockFeedPanel.style.display).toBe('block'); // Stays visible for developer overrides
    expect(global.window['ga-disable-G-Q2NRSC79B6']).toBe(true); // Analytics disabled securely
    expect(global.console.log).toHaveBeenCalledWith(
      "Analytics engine muted for non-production workspace branch:", 
      "dev"
    );
  });
});
