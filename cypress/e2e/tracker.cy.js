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
    
    // Verifies that data/strings.yaml values are serving your DOM contents perfectly
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
      .and('contain.text', 'INTERCHANGE STATION');
  });

});
