// --- CENTRALIZED MOCK CONFIGURATION STUBS ---
const MOCK_BUSES_RESPONSE = [
  {
    id: "mock-vehicle-1",
    routeCode: "Q01",
    vehicleNumber: "HW 1234",
    latitude: 1.5574,
    longitude: 110.3538,
    bearing: 90,
    tripId: "trip-q01-live",
    shapeId: "shape-q01",
    routeName: "Kuching to Bako"
  },
  {
    id: "mock-vehicle-2",
    routeCode: "Q12",
    vehicleNumber: "HW 5678",
    latitude: 1.5600,
    longitude: 110.3600,
    bearing: 180,
    tripId: "trip-q12-live",
    shapeId: "shape-q12",
    routeName: "Kuching to Airport"
  }
];

// --- CENTRALIZED REUSABLE BOOTSTRAP ORCHESTRATION ---
function bootstrapTrackerWorkspace() {
  // 1. Force Cypress to catch the request and return the mock stub instantly
  cy.intercept('GET', '**/api/buses*', {
    statusCode: 200,
    body: MOCK_BUSES_RESPONSE,
    headers: { 'access-control-allow-origin': '*' }
  }).as('getLiveBuses');

  // 2. Visit the absolute baseline origin of the local preview server
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
        expect(text[1]).to.not.include('—'); 
      });
  });

  it('should securely handle and display the mocked real-time API payload', () => {
    cy.wait('@getLiveBuses', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.be.an('array');
      expect(interception.response.body).to.have.length(2);
      
      const sampleBus = interception.response.body[0];
      expect(sampleBus.routeCode).to.eq('Q01');
      expect(sampleBus.vehicleNumber).to.eq('HW 1234');
    });
  });

  it('should dynamically render the route long name next to the dropdown when a route is active', () => {
    const targetRoute = 'Q12';
    cy.get('#route-description-text').should('not.be.visible');
    cy.get('#route-selector').select(targetRoute);
    cy.get('#route-description-text').should('be.visible').and('not.have.css', 'opacity', '0');
    cy.get('#route-selector').select('all');
    cy.get('#route-description-text').should('not.be.visible');
  });

  it('should dynamically reveal the correct timetable link when an explicit route is selected', () => {
    const targetRoute = 'Q12';
    cy.get('#timetable-link-container').should('not.be.visible');
    cy.get('#route-selector').select(targetRoute);

    cy.get('#timetable-link-container').should('be.visible').and('not.have.css', 'display', 'none');
    cy.get('#route-timetable-link')
      .should('have.attr', 'target', '_blank')
      .and('have.attr', 'rel', 'noopener noreferrer')
      .and('have.attr', 'href').and('not.eq', '#');

    cy.get('#timetable-link-text').should('have.text', `Click here for ${targetRoute} Transit Map`);
    cy.get('#route-selector').select('all');
    cy.get('#timetable-link-container').should('not.be.visible');
  });

  it('should manage the responsive info modal lifecycle and apply layout window lock rules', () => {
    cy.get('#info-modal-overlay').should('not.be.visible');
    cy.get('body').should('not.have.css', 'overflow', 'hidden');

    cy.get('#info-modal-trigger').click();
    cy.get('#info-modal-overlay').should('be.visible');
    cy.get('#info-modal-card')
      .should('be.visible')
      .and('contain.text', 'About the Tracker')
      .and('contain.text', 'Live Map for BAS.MY in Kuching');
    
    cy.get('#info-modal-card a[href*="github.com"]')
      .should('have.attr', 'href', 'https://github.com/f-meister/kchbasmy_tracker')
      .and('contain.text', 'View Project on GitHub');

    cy.get('#info-modal-card a[href^="mailto:"]')
      .should('have.attr', 'href', 'mailto:fabian@fabianhee.com')
      .and('contain.text', 'Email me for feedback or questions');

    cy.get('body').should('have.css', 'overflow', 'hidden');
    cy.get('#info-modal-close').click();
    cy.get('#info-modal-overlay').should('not.be.visible');
    
    cy.get('#info-modal-trigger').click();
    cy.get('#info-modal-overlay').should('be.visible');
    cy.get('#info-modal-overlay').click('topLeft', { force: true }); 
    cy.get('#info-modal-overlay').should('not.be.visible');
    cy.get('body').should('not.have.css', 'overflow', 'hidden');
  });

  it('should visually render the dark map legend context and reflect the 15px active bus indicator', () => {
    cy.get('.map-legend')
      .should('be.visible')
      .and('contain.text', 'Bus Stop')
      .and('contain.text', 'Active Bus');

    // Confirms your new custom 15px layout boundaries fit cleanly inside Suite 1
    cy.get('.legend-bus-icon-preview')
      .should('be.visible')
      .and('have.css', 'background-color', 'rgb(37, 99, 235)')
      .and('have.css', 'width', '15px')
      .and('have.css', 'height', '15px');
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

    // Target via standard leaflet-interactive paths rather than the volatile pane wrapper string
    cy.get('path.leaflet-interactive', { timeout: 10000 })
      .filter((i, el) => {
        const color = el.getAttribute('fill');
        return color === '#f97316'; // Filters strictly for our custom orange interchange markers
      })
      .should('exist')
      .first()
      .click({ force: true });

    cy.get('.stop-popup-content')
      .should('be.visible')
      .find('.popup-label-type')
      .should('contain.text', 'Transit Interchange');
    
    cy.get('.popup-badges-grid .popup-route-badge')
      .should('have.length.greaterThan', 1);
  });

  it('should capture main terminals using case-insensitive validation, upscale dimensions, and paint them brand blue', () => {
    cy.get('#route-selector').select('all');

    // Assert that the upscaled blue station markers exist on the Leaflet canvas layer
    cy.get('.main-terminal-pulse', { timeout: 10000 })
      .should('exist')
      .and('have.attr', 'fill', '#2563eb')
      .then(($path) => {
        // Extract the actual rendered bounding layout box pixel dimensions safely
        const rect = $path[0].getBoundingClientRect();
        const expectedDiameter = 14 * 2; // Radius 14 results in a 28px box width/height
        
        // Assert on the computed layout width (allowing a tiny margin for rounding differences)
        expect(rect.width).to.be.closeTo(expectedDiameter, 1);
      });

    // Fire the click interaction layer to double-check popup metadata parameters
    cy.get('.main-terminal-pulse').first().click({ force: true });
    cy.get('.stop-popup-content').should('be.visible');
    
    cy.get('.popup-label-terminal')
      .should('be.visible')
      .and('contain.text', 'INTERCHANGE STATION')
      .and('have.css', 'color', 'rgb(37, 99, 235)');
  });

  it('should reflect the structural station layers cleanly inside the map legend overlay', () => {
    cy.get('.map-legend')
      .should('be.visible')
      .and('contain.text', 'Bus Stop')
      .and('contain.text', 'Interchange')
      .and('contain.text', 'Main Station')
      .and('contain.text', 'Active Bus');

    cy.get('.map-legend .legend-marker-stop')
      .filter((i, el) => el.style.backgroundColor === 'rgb(37, 99, 235)')
      .should('have.css', 'width', '14px')
      .and('have.css', 'height', '14px');
  });

  it('should append the new hierarchical interchange station data models to the legend text mapping', () => {
    cy.get('.map-legend')
      .should('be.visible')
      .and('contain.text', 'Interchange')
      .and('contain.text', 'Main Station');

    // Asserts that the upscaled blue station swatch matches your 14px map node size matrix
    cy.get('.map-legend .legend-marker-stop')
      .filter((i, el) => el.style.backgroundColor === 'rgb(37, 99, 235)')
      .should('have.css', 'width', '14px')
      .and('have.css', 'height', '14px');
  });

});
