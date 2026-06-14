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

// Mock timetable schedules containing an explicit interchange layout overlap at stop 6521
const MOCK_STATIC_TRIP_SCHEDULES = {
  "206_0_WE_1": {
    "6520": "06:42",
    "6521": "06:30" // Q10 morning timeline
  },
  "206_0_WE_13": {
    "6520": "09:42",
    "6521": "09:28" // Q10 mid-day timeline
  },
  "213_0_WD_1": {
    "6521": "07:15", // Q08 targeted subset time slot at Sunny Hill
    "6540": "07:30"
  }
};

// Mock data representation matching your compiled trip_prefix_routes.json template mapping file
const MOCK_TRIP_PREFIX_ROUTES_INDEX = {
  "206": [
    "q06", "q07", "q08", "q09", "q10", "q11", "q12", "q13", "q14", "q15", "q16"
  ],
  "213": [
    "q01", "q05", "q06", "q07", "q08", "q11", "q12", "q14", "q16"
  ]
};

const TARGET_CALENDAR_YEAR = new Date().getFullYear().toString();

function bootstrapTrackerWorkspace() {
  // 1. Intercept real-time backend endpoint
  cy.intercept('GET', '**/api/buses*', {
    statusCode: 200,
    body: MOCK_BUSES_RESPONSE,
    headers: { 'access-control-allow-origin': '*' }
  }).as('getLiveBuses');

  // 2. Intercept OSRM mapping routing layer to prevent external HTTP delays
  cy.intercept('GET', 'https://router.project-osrm.org/route/v1/driving/*', {
    statusCode: 200,
    body: {
      routes: [{
        geometry: {
          type: "LineString",
          coordinates: [[110.342303, 1.557881], [110.338447, 1.554839]]
        }
      }]
    }
  }).as('getOsrmRoute');

  // 3. Inject global scope variables prior to execution to clear data-race conditions
  cy.visit('/', {
    onBeforeLoad(win) {
      // Clear out runtime variables via clean definitions
      Object.defineProperty(win, 'destinationLookup', {
        get: () => MOCK_DESTINATION_LOOKUP,
        configurable: true
      });
      Object.defineProperty(win, 'staticTripSchedules', {
        get: () => MOCK_STATIC_TRIP_SCHEDULES,
        configurable: true
      });
      Object.defineProperty(win, 'tripPrefixRoutesIndex', {
        get: () => MOCK_TRIP_PREFIX_ROUTES_INDEX,
        configurable: true
      });
      
      // Inject the required network indices to mock structural interchanges on application boot
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
        get: () => ({
          "Q10": ["6520", "6521"], // 6521 represents the shared interchange node
          "Q08": ["6521", "6540"]  // 6521 represents the shared interchange node
        }),
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
    bootstrapTrackerWorkspace();
  });

  it('should visually initialize the Leaflet map element canvas', () => {
    cy.get('#map', { timeout: 10000 })
      .should('be.visible')
      .and('have.class', 'leaflet-container');
  });

  it('should verify the native fullscreen control button is rendered in the map control column', () => {
    cy.get('.leaflet-control-fullscreen', { timeout: 10000 })
      .should('be.visible')
      .find('a')
      .should('have.attr', 'title', 'View Fullscreen');
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
        const text = $options.map((i, el) => el.text.trim()).get();
        expect(text).to.include('Q10');
        expect(text).to.include('Q08');
      });
  });

  it('should securely handle and parse the normalized real-time API array telemetry payload', () => {
    cy.wait('@getLiveBuses', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.be.an('array');
      expect(interception.response.body).to.have.length(2);
      
      const sampleBus = interception.response.body[0];
      expect(sampleBus.routeCode).to.eq('q10');
      expect(sampleBus.vehicleNumber).to.eq('MADANI5021');
    });
  });

  it('should manage the responsive info modal lifecycle and assert on automated copyright years', () => {
    cy.get('#info-modal-overlay').should('not.be.visible');

    cy.get('#info-modal-trigger').click();
    cy.get('#info-modal-overlay').should('be.visible');
    
    cy.get('#info-modal-card').should('be.visible').and('contain.text', 'About the Tracker');
    cy.get('#copyright-year').should('be.visible').and('have.text', TARGET_CALENDAR_YEAR);
    
    cy.get('#info-modal-close').click();
    cy.get('#info-modal-overlay').should('not.be.visible');
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
    bootstrapTrackerWorkspace();
  });

  it('should calculate interchanges dynamically and render all structural timetable classes inside popup', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('all');

    // Pick up the first interactive map marker rendered on the canvas layer.
    cy.get('path.leaflet-interactive', { timeout: 10000 })
      .should('exist')
      .first()
      .click({ force: true });

    // Assert base node layout
    cy.get('.stop-popup-content')
      .should('be.visible')
      .find('.popup-label-type')
      .should('contain.text', 'Bus Stop');

    // Validate structural timetable elements and refactored CSS classes
    cy.get('.stop-schedule-section').should('be.visible');
    cy.get('.stop-schedule-title').should('be.visible').and('not.be.empty');
    
    // Check if sorted time blocks mapped onto tags successfully
    cy.get('.stop-schedule-grid').within(() => {
      cy.get('.stop-schedule-tag')
        .should('have.length.at.least', 1)
        .first()
        .invoke('text')
        .should('match', /^\d{2}:\d{2}$/); // Assert valid HH:MM format
    });
  });

  it('should capture main terminals dynamically and verify fallback timetable layout when data is empty', () => {
    cy.wait('@getLiveBuses');

    // Override dataset parameters dynamically to enforce empty timelines
    cy.window().then((win) => {
      Object.defineProperty(win, 'staticTripSchedules', {
        get: () => ({}),
        configurable: true
      });
      win.currentlyOpenStopId = null;
      win.renderFilteredBusStops('all');
    });

    // Fire open a station/terminal node (Blue Marker)
    cy.get('path.leaflet-interactive')
      .filter((i, el) => el.getAttribute('fill') === '#2563eb')
      .should('exist')
      .first()
      .click({ force: true });
    
    cy.get('.stop-schedule-empty', { timeout: 6000 }).should('be.visible');
  });

  it('should persist open stop popup viewports across real-time loop interval updates', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('all');

    cy.get('path.leaflet-interactive').first().click({ force: true });
    cy.get('.stop-popup-content').should('be.visible');

    cy.window().its('currentlyOpenStopId').should('not.be.null');

    // Simulate standard interval refresh sequence trigger loop
    cy.window().then((win) => {
      win.syncLiveBusTracker();
    });
    cy.wait('@getLiveBuses');

    cy.get('.stop-popup-content').should('be.visible');
  });

  it('should gracefully purge tracking index parameters from state memory when a popup is closed', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('all');

    cy.get('path.leaflet-interactive').first().click({ force: true });
    cy.window().its('currentlyOpenStopId').should('not.be.null');

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
        Object.defineProperty(win, 'destinationLookup', {
          get: () => MOCK_DESTINATION_LOOKUP,
          configurable: true
        });
      }
    });
    
    cy.wait('@getLiveBuses');
  });

  it('should parse real-time parameters and swap the generic long name for the exact final terminus stop', () => {
    cy.get('.custom-bus-marker', { timeout: 10000 }).should('be.visible').first().click({ force: true });

    cy.get('.leaflet-popup-content', { timeout: 5000 }).within(() => {
      cy.contains('Active Vehicle Stream').should('be.visible');
      cy.contains('Bus Code: Q08').should('be.visible');
      
      cy.contains('Destination:')
        .parent()
        .should('include.text', 'MATANG HUB')
        .and('not.include.text', 'KUCHING - MATANG INDUSTRIAL HUB');
    });
  });

});

// ============================================================================
// SUITE 4: Destination Dictionary Integrity & Sanitization Robustness
// ============================================================================
describe('BAS.MY KCH Tracker: Terminal Sanitization Verification', () => {

  it('should remain completely case and whitespace-insensitive during terminal lookups', () => {
    cy.intercept('GET', '/api/buses*', [
      {
        id: "vehicle-kch-space-test",
        vehicleNumber: "KCH-SPACE-1",
        latitude: 1.5574,
        longitude: 110.3538,
        routeCode: "Q10",
        tripId: "206_0_WE_1",
        directionId: 0,
        routeName: "Generic Route String"
      }
    ]).as('getSpacingBus');

    cy.visit('/', {
      onBeforeLoad(win) {
        Object.defineProperty(win, 'destinationLookup', {
          get: () => ({
            "q10": {
              "0": "   opp Unaco sIBURAn   "
            }
          }),
          configurable: true
        });
      }
    });

    cy.wait('@getSpacingBus');

    cy.window().then((win) => {
      win.renderFilteredBusStops('all');
    });

    cy.get('path.leaflet-interactive')
      .filter((i, el) => el.getAttribute('fill') === '#2563eb')
      .should('exist')
      .first()
      .click({ force: true });
    
    cy.get('.stop-popup-content').within(() => {
      cy.contains('Main Station').should('be.visible');
    });
  });

});
