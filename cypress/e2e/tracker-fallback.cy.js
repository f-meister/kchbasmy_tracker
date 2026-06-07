// --- CENTRALIZED FALLBACK SPECIFICATION MOCK CONFIGURATIONS ---
const FALLBACK_MOCK_BUSES = [
  {
    id: "FALLBACK-SIM-5021",
    vehicleNumber: "KCH-FALLBACK-5021",
    latitude: 1.573043,
    longitude: 110.301689,
    bearing: 90.9,
    tripId: "207_0_WE_1", // Weekend trip ID matching today's calendar data
    timestamp: "1780047059",
    routeCode: "q01",
    shapeId: "SHP_30395_1",
    routeName: "SAUJANA PARKING - SURAU DARUL IBADAH"
  }
];

const FALLBACK_DESTINATION_LOOKUP = {
  "q01": {
    "0": "SURAU DARUL IBADAH",
    "1": "TERMINAL SAUJANA PARKING"
  }
};

function bootstrapFallbackWorkspace() {
  // 1. Intercept real-time telemetry updates to match our sandbox fallback loop
  cy.intercept('GET', '**/api/buses*', {
    statusCode: 200,
    body: FALLBACK_MOCK_BUSES,
    headers: { 'access-control-allow-origin': '*' }
  }).as('getLiveBuses');

  // 2. Intercept OSRM driving paths router hooks to keep network execution stable
  cy.intercept('GET', 'https://router.project-osrm.org/route/v1/driving/*', {
    statusCode: 200,
    body: {
      routes: [{ geometry: { type: "LineString", coordinates: [[110.342201, 1.557926], [110.301689, 1.573043]] } }]
    }
  }).as('getOsrmRoute');

  // 3. ✅ MATCH NATURAL BOOT: Only stub destinationLookup exactly like tracker.cy.js does!
  // Let your flattened fallback dataset load naturally from Hugo's build target.
  cy.visit('/', {
    onBeforeLoad(win) {
      Object.defineProperty(win, 'destinationLookup', {
        get: () => FALLBACK_DESTINATION_LOOKUP,
        set: () => {},
        configurable: true
      });
    }
  });
}

describe('Transit Tracker Fallback Infrastructure Assertions', () => {

  before(() => {
    // 🛠️ Force setup environment into test mode to verify self-healing scripts function
    cy.exec('echo "development:\n  branch: \'test\'\n  gtfs-status: \'test\'" > run_config.yml');
    cy.exec('./.devcontainer/setup.sh');
    cy.exec('hugo'); 
  });

  after(() => {
    // 🧹 Clean up configuration layers to bring back normal operations pipeline
    cy.exec('echo "development:\n  branch: \'main\' \n  gtfs-status: \'normal\'" > run_config.yml');
    cy.exec('./.devcontainer/setup.sh');
    cy.exec('hugo');
  });

  beforeEach(() => {
    bootstrapFallbackWorkspace();
  });

  it('should successfully boot the UI and populate the dropdown menu using fallback data sets', () => {
    cy.get('#app-shell').should('be.visible');
    cy.get('#map', { timeout: 10000 }).should('be.visible').and('have.class', 'leaflet-container');

    // Confirm that options have been cleanly processed from the unzipped fallback archive
    cy.get('#route-selector', { timeout: 10000 })
      .should('be.visible')
      .find('option')
      .should('have.length.greaterThan', 1);

    cy.get('#route-selector').find('option[value="q01"]').should('exist');
  });

  it('should cleanly render fallback transit stop markers onto the Leaflet canvas map grid', () => {
    cy.get('#app-shell').should('be.visible');
    cy.get('#map', { timeout: 10000 }).should('be.visible').and('have.class', 'leaflet-container');

    cy.get('.leaflet-marker-icon', { timeout: 10000 }).should('exist');
  });

});
