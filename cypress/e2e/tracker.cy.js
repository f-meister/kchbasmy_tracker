describe('Kuching Bus Tracker Pipeline Verification', () => {
  // Stable mock payload matching your buses.js schema
  const mockBusesResponse = [
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

  beforeEach(() => {
    // 1. Force Cypress to catch the request and return the mock stub instantly
    cy.intercept('GET', '**/api/buses*', {
      statusCode: 200,
      body: mockBusesResponse,
      headers: { 'access-control-allow-origin': '*' }
    }).as('getLiveBuses');

    // 2. Visit the absolute baseline origin of the local preview server
    cy.visit('/');
  });

  it('should visually initialize the Leaflet map element canvas', () => {
    cy.get('#map', { timeout: 10000 })
      .should('be.visible')
      .and('have.class', 'leaflet-container');
  });

  it('should load routes_paths.json and populate the dropdown with clean route codes', () => {
    // Verifies that options are short and un-cluttered (e.g. "Q01", not "Q01 - Description")
    cy.get('#route-selector', { timeout: 10000 })
      .should('be.visible')
      .find('option')
      .should('have.length.greaterThan', 1)
      .then(($options) => {
        const text = $options.map((i, el) => el.text.trim()).get();
        expect(text).to.include('Q01');
        // Ensure it doesn't accidentally contain the longer hyphen description inside the option tag
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

  // --- UPDATED UX FEATURE: INLINE ROUTE LONG NAME VERIFICATION ---
  it('should dynamically render the route long name next to the dropdown when a route is active', () => {
    const targetRoute = 'Q12';

    // 1. The inline description should start completely hidden when "All" is active
    cy.get('#route-description-text').should('not.be.visible');

    // 2. Select an active route route code from the selector
    cy.get('#route-selector').select(targetRoute);

    // 3. The label should become visible and dynamically inherit the descriptive route name from geojson properties
    cy.get('#route-description-text')
      .should('be.visible')
      .and('not.have.css', 'opacity', '0')

    // 4. Changing selection back to "all" should trigger a clean fade out lifecycle pass
    cy.get('#route-selector').select('all');
    cy.get('#route-description-text').should('not.be.visible');
  });

  it('should dynamically reveal the correct timetable link when an explicit route is selected', () => {
    const targetRoute = 'Q12';

    cy.get('#timetable-link-container').should('not.be.visible');
    cy.get('#route-selector').select(targetRoute);

    cy.get('#timetable-link-container')
      .should('be.visible')
      .and('not.have.css', 'display', 'none');

    cy.get('#route-timetable-link')
      .should('have.attr', 'target', '_blank')
      .and('have.attr', 'rel', 'noopener noreferrer')
      .and('have.attr', 'href').and('not.eq', '#');

    cy.get('#timetable-link-text')
      .should('have.text', `${targetRoute} Full Timetable`);

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
    cy.get('body').should('not.have.css', 'overflow', 'hidden');

    cy.get('#info-modal-trigger').click();
    cy.get('#info-modal-overlay').should('be.visible');
    
    cy.get('#info-modal-overlay').click('topLeft', { force: true }); 
    cy.get('#info-modal-overlay').should('not.be.visible');
    cy.get('body').should('not.have.css', 'overflow', 'hidden');
  });
});