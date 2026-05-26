describe('Kuching Bus Tracker Pipeline Verification', () => {
  beforeEach(() => {
    // Navigate straight to your Hugo tracking subpage route
    cy.visit('/tracker/');
  });

  it('should visually initialize the Leaflet map element canvas', () => {
    cy.get('#map', { timeout: 10000 })
      .should('be.visible')
      .and('hasClass', 'leaflet-container');
  });

  it('should load routes_paths.json and populate the dropdown with proper keys', () => {
    // Verifies that parse-shapes.js successfully mapped trip_headsign to routeCode
    cy.get('#route-selector')
      .should('be.visible')
      .find('option')
      .should('have.length.greaterThan', 1) // Confirms options exist beyond "Show All"
      .then(($options) => {
        const text = $options.map((i, el) => el.value).get();
        // Check that actual operational routes like Q01 are bound to selection values
        expect(text).to.include('Q01');
      });
  });

  it('should securely fetch and display the 10-minute real-time edge API payload', () => {
    // Setup a spy listener on the serverless endpoint
    cy.intercept('GET', '/api/buses').as('getLiveBuses');
    
    cy.wait('@getLiveBuses', { timeout: 15000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200);
      expect(interception.response.body).to.be.an('array');
      
      // If buses are currently active on the grid, verify our lookup mapping properties
      if (interception.response.body.length > 0) {
        const sampleBus = interception.response.body[0];
        expect(sampleBus).to.have.property('routeCode');
        expect(sampleBus).to.have.property('vehicleNumber');
        expect(sampleBus).to.have.property('latitude');
      }
    });
  });
});
