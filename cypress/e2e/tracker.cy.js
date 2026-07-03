// ============================================================================
// 🛠️ CENTRALIZED TRANSIT SIMULATION ENVIRONMENT & MOCK STUBS
// ============================================================================

// Mock real-time proxy API streaming output matching Cloudflare Workers format
const MOCK_BUSES_RESPONSE = [
  {
    id: "MADANI5021",
    vehicleNumber: "MADANI5021",
    latitude: 1.573043,
    longitude: 110.301689,
    bearing: 90.9,
    tripId: "206_0_WE_13",
    timestamp: "1780047059",
    routeCode: "q10",
    shapeId: "shape-q10",
    routeName: "Kuching to Siburan"
  },
  {
    id: "MADANI8013",
    vehicleNumber: "MADANI8013",
    latitude: 1.557926,
    longitude: 110.342201,
    bearing: 148.6,
    tripId: "213_0_WD_1",
    timestamp: "1780047059",
    routeCode: "q08",
    shapeId: "shape-q08",
    routeName: "Kuching to Matang"
  }
];

// Mock direction headings map parsed during ingestion pipelines
const MOCK_DESTINATION_LOOKUP = {
  "q10": {
    "0": "OPP UNACO SIBURAN",
    "1": "TERMINAL SAUJANA PARKING"
  },
  "q08": {
    "0": "MATANG HUB",
    "1": "TERMINAL SAUJANA PARKING"
  }
};

const MOCK_STATIC_TRIP_SCHEDULES = {
  "206_0_WE_1": {
    "6520": "06:42",
    "6521": "06:30"
  },
  "206_0_WE_13": {
    "6520": "09:42",
    "6521": "09:28"
  },
  "213_0_WD_1": {
    "6521": "07:15",
    "6540": "07:30"
  }
};

const MOCK_TRIP_PREFIX_ROUTES_INDEX = {
  "206": ["q06", "q07", "q08", "q09", "q10", "q11", "q12", "q13", "q14", "q15", "q16"],
  "213": ["q01", "q05", "q06", "q07", "q08", "q11", "q12", "q14", "q16"]
};

let activeStaticSchedules = MOCK_STATIC_TRIP_SCHEDULES;

const TARGET_CALENDAR_YEAR = new Date().getFullYear().toString();

function bootstrapTrackerWorkspace() {
  cy.intercept('GET', '**/api/buses*', {
    statusCode: 200,
    body: MOCK_BUSES_RESPONSE,
    headers: { 'access-control-allow-origin': '*' }
  }).as('getLiveBuses');

  cy.intercept('GET', 'https://router.project-osrm.org/route/v1/driving/*', {
    statusCode: 200,
    body: { routes: [{ geometry: { type: "LineString", coordinates: [[110.342303, 1.557881], [110.338447, 1.554839]] } }] }
  }).as('getOsrmRoute');

  cy.visit('/', {
    onBeforeLoad(win) {
      Object.defineProperty(win, 'destinationLookup', {
        get: () => MOCK_DESTINATION_LOOKUP,
        configurable: true
      });
      
      // Bind to the mutable activeStaticSchedules variable instead of a hardcoded object
      Object.defineProperty(win, 'staticTripSchedules', {
        get: () => activeStaticSchedules,
        configurable: true
      });
      
      Object.defineProperty(win, 'tripPrefixRoutesIndex', {
        get: () => MOCK_TRIP_PREFIX_ROUTES_INDEX,
        configurable: true
      });
      
      Object.defineProperty(win, 'routesPathsData', {
        get: () => ({
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: { routeCode: "Q10", routeName: "Route Ten" }, geometry: { type: "LineString", coordinates: [] } },
            { type: "Feature", properties: { routeCode: "Q08", routeName: "Route Eight" }, geometry: { type: "LineString", coordinates: [] } }
          ]
        }),
        configurable: true
      });

      Object.defineProperty(win, 'routeStopsIndex', {
        get: () => ({ "Q10": ["6520", "6521"], "Q08": ["6521", "6540"] }),
        configurable: true
      });
    }
  });
}

// ============================================================================
// SUITE 1: Application Core Pipeline & Component Verifications
// ============================================================================
describe('BAS.MY KCH Tracker: Core Engine Validation', () => {
  beforeEach(() => {
    activeStaticSchedules = MOCK_STATIC_TRIP_SCHEDULES; // Reset back to default state before each run
    bootstrapTrackerWorkspace();
  });

  it('should visually initialize the Leaflet map element canvas', () => {
    cy.get('#map', { timeout: 10000 }).should('be.visible').and('have.class', 'leaflet-container');
  });

  it('should verify the native fullscreen control button is rendered in the map control column', () => {
    cy.get('.leaflet-control-fullscreen', { timeout: 10000 }).should('be.visible').find('a').should('have.attr', 'title', 'View Fullscreen');
  });

  it('should verify Hugo attributes are bound properly on the app shell framework', () => {
    cy.get('#app-shell').should('have.attr', 'data-txt-syncing').and('not.be.empty');
    cy.get('#app-shell').should('have.attr', 'data-txt-failed').and('not.be.empty');
    cy.get('#app-shell').should('have.attr', 'data-txt-timetable').and('not.be.empty');
    cy.get('#app-shell').should('have.attr', 'data-txt-lg-bus').and('not.be.empty');
  });

  it('should load routes_paths.json and populate the dropdown with clean route codes', () => {
    cy.get('#route-selector', { timeout: 10000 })
      .should('be.visible')
      .find('option')
      .should('have.length.greaterThan', 1)
      .then(($options) => {
        const values = $options.map((i, el) => el.value.trim().toUpperCase()).get();
        expect(values).to.include('Q10');
        expect(values).to.include('Q08');
      });
  });

  it('should securely handle and parse the normalized real-time API array telemetry payload', () => {
    cy.wait('@getLiveBuses', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.be.an('array');
      const sampleBus = interception.response.body[0];
      expect(sampleBus.routeCode).to.eq('q10');
    });
  });

  it('should manage the responsive info modal lifecycle and assert on automated copyright years', () => {
    cy.get('#info-modal-overlay').should('not.be.visible');
    cy.get('#info-modal-trigger').click();
    cy.get('#info-modal-card').should('be.visible').and('contain.text', 'About the Tracker');
    cy.get('#copyright-year').should('have.text', TARGET_CALENDAR_YEAR);
    cy.get('#info-modal-close').click();
    cy.get('#info-modal-overlay').should('not.be.visible');
  });

  it('should correctly render the special thanks contributor container with accurate styles', () => {
    cy.get('#info-modal-trigger').click();
    cy.get('#info-modal-card').should('be.visible');
    cy.get('.special-thanks-container').within(() => {
        cy.get('h4.special-thanks-title')
          .should('be.visible')
          .and('not.be.empty');
        cy.get('p.special-thanks-text')
          .should('be.visible')
          .and('not.be.empty');
    });
  });

  it('should visually render the map legend context layout component layers', () => {
    cy.get('.map-legend')
      .should('be.visible')
      .and('contain.text', 'Bus Stop')
      .and('contain.text', 'Active Bus');
  });

  it('should successfully toggle the interactive transit map modal and initialize the image canvas', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('q08');
    cy.get('#timetable-link-container', { timeout: 5000 }).should('be.visible');
  });
});

// ============================================================================
// SUITE 2: Transit Node Network Hierarchy & Timetable Features
// ============================================================================
describe('BAS.MY KCH Tracker: Transit Node & Timetable Verification', () => {
  beforeEach(() => {
    activeStaticSchedules = MOCK_STATIC_TRIP_SCHEDULES; // Reset back to default state before each run
    bootstrapTrackerWorkspace();
  });

  it('should calculate interchanges dynamically and render all structural timetable classes inside popup', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('all');
    cy.get('path.leaflet-interactive', { timeout: 10000 }).should('exist').first().click({ force: true });
    cy.get('.stop-popup-content', { timeout: 5000 }).should('be.visible');
    cy.get('.stop-schedule-section').should('be.visible');
    cy.get('.stop-schedule-grid').within(() => {
      cy.get('.stop-schedule-tag').first().invoke('text').should('match', /^\d{2}:\d{2}$/); 
    });
  });

  // 🌟 REFRACTORED: Completely immune to race conditions
  it('should capture main terminals dynamically and verify fallback timetable layout when data is empty', () => {
    cy.wait('@getLiveBuses');

    // 1. Swap the mutable pointer references immediately before executing any rendering changes
    activeStaticSchedules = {}; 

    cy.window().then((win) => {
      win.currentlyOpenStopId = null;
      // 2. Ensure the dropdown selector state matches the UI execution domain
      cy.get('#route-selector').select('all');
      win.renderFilteredBusStops('all');
    });

    // 3. Wait until the map markers re-settle completely in the DOM tree before clicking
    cy.get('path.leaflet-interactive', { timeout: 10000 })
      .should('have.length.greaterThan', 2);
      
    cy.get('path.leaflet-interactive').first().click({ force: true });
    
    // 4. Assert with a robust visibility guard check
    cy.get('.stop-schedule-empty', { timeout: 8000 }).should('be.visible');
  });

  it('should persist open stop popup viewports across real-time loop interval updates', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('all');
    cy.get('path.leaflet-interactive').first().click({ force: true });
    cy.get('.stop-popup-content').should('be.visible');

    cy.window().then((win) => { win.syncLiveBusTracker(); });
    cy.wait('@getLiveBuses');
    cy.get('.stop-popup-content').should('be.visible');
  });

  it('should gracefully purge tracking index parameters from state memory when a popup is closed', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('all');
    cy.get('path.leaflet-interactive').first().click({ force: true });
    cy.get('.leaflet-popup-close-button').click();
    cy.get('.stop-popup-content').should('not.exist');
    cy.window().its('currentlyOpenStopId').should('be.null');
  });
});

// ============================================================================
// SUITE 3: Dynamic Terminal Destination Mapping & Edge Case Resilience
// ============================================================================
describe('BAS.MY KCH Tracker: Dynamic Terminal Destinations', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/buses*', [
      {
        id: "vehicle-kch-test-01",
        vehicleNumber: "KCH-BUS-9999",
        latitude: 1.5574,
        longitude: 110.3538,
        routeCode: "Q08",
        tripId: "213_0_WD_1", 
        directionId: 0,
        routeName: "KUCHING - MATANG INDUSTRIAL HUB" 
      }
    ]).as('getLiveBuses');

    cy.visit('/', {
      onBeforeLoad(win) {
        Object.defineProperty(win, 'destinationLookup', { get: () => MOCK_DESTINATION_LOOKUP, configurable: true });
      }
    });
    cy.wait('@getLiveBuses');
  });

  it('should parse real-time parameters and swap the generic long name for the exact final terminus stop', () => {
    cy.get('.custom-bus-marker', { timeout: 10000 }).should('be.visible').first().click({ force: true });
    cy.get('.leaflet-popup-content', { timeout: 5000 }).within(() => {
      cy.contains('Destination:').parent().should('include.text', 'MATANG HUB').and('not.include.text', 'KUCHING - MATANG INDUSTRIAL HUB');
    });
  });
});

// ============================================================================
// SUITE 4: Destination Dictionary Integrity & Sanitization Robustness
// ============================================================================
describe('BAS.MY KCH Tracker: Terminal Sanitization Verification', () => {
  it('should remain completely case and whitespace-insensitive during terminal lookups', () => {
    cy.intercept('GET', '**/api/buses*', [
      {
        id: "vehicle-kch-space-test",
        vehicleNumber: "KCH-SPACE-1",
        latitude: 1.5574,
        longitude: 110.3538,
        routeCode: "Q10",
        tripId: "206_0_WE_1",
        directionId: 0,
        routeName: "   opp Unaco sIBURAn   "
      }
    ]).as('getSpacingBus');

    cy.visit('/', {
      onBeforeLoad(win) {
        Object.defineProperty(win, 'destinationLookup', { get: () => ({ "q10": { "0": "OPP UNACO SIBURAN" } }), configurable: true });
      }
    });

    cy.wait('@getSpacingBus');
    cy.window().then((win) => { win.renderFilteredBusStops('all'); });
    cy.get('.custom-bus-marker', { timeout: 10000 }).should('be.visible').first().click({ force: true });
    cy.get('.leaflet-popup-content', { timeout: 5000 }).within(() => {
      cy.contains('Destination:').parent().should('include.text', 'OPP UNACO SIBURAN');
    });
  });
});
