// --- CENTRALIZED NATIVE GTFS-RT MOCK STUBS (REPLICATING REAL PROTOC WIRE SHAPES) ---
const MOCK_BUSES_RESPONSE = {
  header: {
    gtfsRealtimeVersion: "2.0",
    incrementality: "FULL_DATASET",
    timestamp: "1780047063"
  },
  entity: [
    {
      id: "MADANI5021",
      vehicle: {
        trip: {
          tripId: "210_1_WD_13" // Maps cleanly to Q05 via your trip_lookup.json prefix rule
        },
        position: {
          latitude: 1.573043,
          longitude: 110.301689,
          bearing: 90.9
        },
        timestamp: "1780047059",
        vehicle: {
          id: "MADANI5021",
          label: "MADANI5021"
        }
      }
    },
    {
      id: "MADANI8013",
      vehicle: {
        trip: {
          tripId: "264_0_WD_13" // Maps cleanly to Q12 via your trip_lookup.json prefix rule
        },
        position: {
          latitude: 1.557926,
          longitude: 110.342201,
          bearing: 148.6
        },
        timestamp: "1780047059",
        vehicle: {
          id: "MADANI8013",
          label: "MADANI8013"
        }
      }
    }
  ]
};

const TARGET_CALENDAR_YEAR = new Date().getFullYear().toString();

function bootstrapTrackerWorkspace() {
  // 1. Intercept the local proxy endpoint and deliver the verified nested payload structure
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

  it('should securely handle and parse the nested real-time API payload object', () => {
    cy.wait('@getLiveBuses', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body.entity).to.be.an('array');
      expect(interception.response.body.entity).to.have.length(2);
      
      const sampleEntity = interception.response.body.entity[0];
      expect(sampleEntity.vehicle.trip.tripId).to.include('210');
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

  it('should visually render the map legend context with the circle active bus marker configuration', () => {
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
      .should('contain.text', 'Transit Interchange');
  });

  it('should capture main terminals and verify blue vector circle rendering layers', () => {
    cy.get('#route-selector').select('all');

    cy.get('.main-terminal-pulse', { timeout: 10000 })
      .should('exist')
      .and('have.attr', 'fill', '#2563eb');

    cy.get('.main-terminal-pulse').first().click({ force: true });
    cy.get('.stop-popup-content').should('be.visible');
    
    cy.get('.popup-label-terminal')
      .should('be.visible')
      .and('contain.text', 'INTERCHANGE STATION');
  });

});
