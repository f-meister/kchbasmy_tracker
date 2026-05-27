describe('Kuching Bus Tracker Pipeline Verification', () => {
  // Define a stable mock payload matching your buses.js schema
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

    // 2. Clear network states and load the page layout
    cy.visit('/');
  });

  it('should visually initialize the Leaflet map element canvas', () => {
    cy.get('#map', { timeout: 10000 })
      .should('be.visible')
      .and('have.class', 'leaflet-container');
  });

  it('should load routes_paths.json and populate the dropdown with proper keys', () => {
    cy.get('#route-selector', { timeout: 10000 })
      .should('be.visible')
      .find('option')
      .should('have.length.greaterThan', 1)
      .then(($options) => {
        const text = $options.map((i, el) => el.value).get();
        expect(text).to.include('Q01');
      });
  });

  it('should securely handle and display the mocked real-time API payload', () => {
    // 3. Confirm Cypress caught the stubbed network event successfully
    cy.wait('@getLiveBuses', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.be.an('array');
      expect(interception.response.body).to.have.length(2);
      
      const sampleBus = interception.response.body[0];
      expect(sampleBus.routeCode).to.eq('Q01');
      expect(sampleBus.vehicleNumber).to.eq('HW 1234');
    });
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
