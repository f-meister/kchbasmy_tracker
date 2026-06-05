// --- CENTRALIZED CONFIGURATION MOCK STUBS (ALIGNED WITH PROXY WORKER ARRAY OUTPUT) ---
const MOCK_BUSES_RESPONSE = [
  {
    id: "MADANI5021",
    vehicleNumber: "MADANI5021",
    latitude: 1.573043,
    longitude: 110.301689,
    bearing: 90.9,
    tripId: "210_1_WD_13",
    timestamp: "1780047059",
    routeCode: "q05",
    shapeId: "shape-q05",
    routeName: "Kuching to Bako"
  },
  {
    id: "MADANI8013",
    vehicleNumber: "MADANI8013",
    latitude: 1.557926,
    longitude: 110.342201,
    bearing: 148.6,
    tripId: "264_0_WD_13",
    timestamp: "1780047059",
    routeCode: "q12",
    shapeId: "shape-q12",
    routeName: "Kuching to Airport"
  }
];

const TARGET_CALENDAR_YEAR = new Date().getFullYear().toString();

function bootstrapTrackerWorkspace() {
  // 1. Intercept proxy endpoint and serve the flat array format returned by the Worker
  cy.intercept('GET', '**/api/buses*', {
    statusCode: 200,
    body: MOCK_BUSES_RESPONSE,
    headers: { 'access-control-allow-origin': '*' }
  }).as('getLiveBuses');

  // 2. Stabilize open network OSRM requests
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

  cy.visit('/');
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

  it('should verify Hugo attributes are bound properly on the app shell framework', () => {
    cy.get('#app-shell')
      .should('have.attr', 'data-txt-syncing')
      .and('not.be.empty');
      
    cy.get('#app-shell')
      .should('have.attr', 'data-txt-failed')
      .and('not.be.empty');

    cy.get('#app-shell')
      .should('have.attr', 'data-txt-timetable')
      .and('not.be.empty');

    cy.get('#app-shell')
      .should('have.attr', 'data-txt-lg-bus')
      .and('not.be.empty');
  });

  it('should load routes_paths.json and populate the dropdown with clean route codes', () => {
    cy.get('#route-selector', { timeout: 10000 })
      .should('be.visible')
      .find('option')
      .should('have.length.greaterThan', 1)
      .then(($options) => {
        const text = $options.map((i, el) => el.text.trim()).get();
        expect(text).to.include('Q01');
      });
  });

  it('should securely handle and parse the normalized real-time API array telemetry payload', () => {
    cy.wait('@getLiveBuses', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.be.an('array');
      expect(interception.response.body).to.have.length(2);
      
      const sampleBus = interception.response.body[0];
      expect(sampleBus.routeCode).to.eq('q05');
      expect(sampleBus.vehicleNumber).to.eq('MADANI5021');
      expect(sampleBus.timestamp).to.eq('1780047059');
    });
  });

  it('should manage the responsive info modal lifecycle and assert on automated copyright years', () => {
    cy.get('#info-modal-overlay').should('not.be.visible');

    cy.get('#info-modal-trigger').click();
    cy.get('#info-modal-overlay').should('be.visible');
    
    cy.get('#info-modal-card')
      .should('be.visible')
      .and('contain.text', 'About the Tracker');

    cy.get('#copyright-year')
      .should('be.visible')
      .and('have.text', TARGET_CALENDAR_YEAR);
    
    cy.get('#info-modal-close').click();
    cy.get('#info-modal-overlay').should('not.be.visible');
  });

  it('should visually render the map legend context layout component layers', () => {
    cy.get('.map-legend')
      .should('be.visible')
      .and('contain.text', 'Bus Stop')
      .and('contain.text', 'Active Bus');
  });

});

// ============================================================================
// SUITE 2: Transit Node Network Hierarchy & Failsafe Rules
// ============================================================================
describe('BAS.MY KCH Tracker: Transit Node Tier Verification', () => {

  beforeEach(() => {
    bootstrapTrackerWorkspace();
  });

  it('should calculate interchanges dynamically and apply standard orange formatting', () => {
    cy.get('#route-selector', { timeout: 10000 }).select('all');

    cy.get('path.leaflet-interactive', { timeout: 10000 })
      .filter((i, el) => {
        const color = el.getAttribute('fill');
        return color === '#f97316'; 
      })
      .should('exist')
      .first()
      .click({ force: true });

    cy.get('.stop-popup-content')
      .should('be.visible')
      .find('.popup-label-type')
      .should('contain.text', 'Interchange');
  });

  it('should capture main terminals and verify blue vector circle rendering layers', () => {
    cy.get('#route-selector').select('all');

    cy.get('.main-terminal-pulse', { timeout: 10000 })
      .should('exist')
      .and('have.attr', 'fill', '#2563eb');

    cy.get('.main-terminal-pulse').first().click({ force: true });
    cy.get('.stop-popup-content').should('be.visible');

    cy.get('.popup-label-type')
      .should('be.visible')
      .and('contain.text', 'Main Station');
  });

});

// ============================================================================
// SUITE 3: Dynamic Terminal Destination Mapping & Edge Case Resilience
// ============================================================================
describe('BAS.MY Kuching Tracker - Dynamic Terminal Destinations', () => {
  beforeEach(() => {
    // 1. Intercept the real-time API telemetry endpoint to return a predictable, mock bus payload
    cy.intercept('GET', '/api/buses*', [
      {
        id: "vehicle-kch-test-01",
        vehicleNumber: "KCH-BUS-9999",
        latitude: 1.5574,
        longitude: 110.3538,
        routeCode: "Q01",
        // The tripId matching our pattern: route_direction_service_sequence
        tripId: "207_0_WE_1", 
        directionId: 0,
        routeName: "SAUJANA PARKING - SURAU DARUL IBADAH" // Old generic fallback name
      }
    ]).as('getLiveBuses');

    // 2. Visit the homepage application view
    cy.visit('/');
    
    // 3. Wait for the mocked API request to resolve and populate the map layer canvas
    cy.wait('@getLiveBuses');
  });

  it('should parse the real-time stream parameters and look up the exact terminal destination', () => {
    // Verify that global context index is mounted securely onto the window space
    cy.window().should('have.property', 'destinationLookup');

    // Assert that the active bus icon is fully initialized and painted onto the Leaflet pane
    cy.get('.custom-bus-marker', { timeout: 10000 })
      .should('be.visible')
      .first()
      .click({ force: true }); // Force click to override any SVG element layout overlays

    // Verify the popup overlay context mounts seamlessly and pulls the looked-up terminal name
    cy.get('.leaflet-popup-content', { timeout: 5000 }).within(() => {
      // 1. Confirm that the localized header title layout elements are visible
      cy.contains('Active Vehicle Stream').should('be.visible');
      cy.contains('Bus Code: Q01').should('be.visible');
      
      // 2. THE CORE ASSERTION: Ensure it skips the generic fallback "SAUJANA PARKING - SURAU DARUL IBADAH" 
      // and renders the precise looked-up final stop sequence name for Q01 Direction 0 instead!
      cy.contains('Destination:')
        .parent()
        .should('include.text', 'SURAU DARUL IBADAH')
        .and('not.include.text', 'SAUJANA PARKING - SURAU DARUL IBADAH');

      cy.contains('Vehicle ID: KCH-BUS-9999').should('be.visible');
    });
  });

  it('should remain completely crash-proof if a vehicle transmits an unindexed route code or direction flag', () => {
    // Overwrite intercept to simulate an anomalous telemetry edge case packet
    cy.intercept('GET', '/api/buses*', [
      {
        id: "vehicle-kch-anomaly",
        vehicleNumber: "KCH-BUS-ERR",
        latitude: 1.5574,
        longitude: 110.3538,
        routeCode: "QX99", // Non-existent route code pattern
        tripId: "UNKNOWN_TRIP",
        directionId: 9, // Out of bounds direction flag
        routeName: "Emergency Relief Shuttle Service"
      }
    ]).as('getAnomalousBus');

    cy.reload();
    cy.wait('@getAnomalousBus');

    // Click on the anomalous vehicle marker icon
    cy.get('.custom-bus-marker').first().click({ force: true });

    // Assert that the pipeline falls back gracefully to the standard API routeName instead of crashing the thread
    cy.get('.leaflet-popup-content').within(() => {
      cy.contains('Bus Code: QX99').should('be.visible');
      cy.contains('Destination:')
        .parent()
        .should('include.text', 'Emergency Relief Shuttle Service');
    });
  });
});
