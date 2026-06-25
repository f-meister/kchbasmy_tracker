describe('BAS.MY KCH Tracker - Native Multilingual E2E Verification', () => {

  // --- ENGLISH PATH TESTING ---
  context('English Workspace (Root Path)', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/buses*', {
        delay: 500,
        body: []
      }).as('delayedBuses');

      // Visit the default absolute root path
      cy.visit('/');
    });

    it('should boot up with default English strings', () => {
      // 1. Check top-level document properties
      cy.get('html').should('have.attr', 'lang', 'en');
      cy.title().should('contain', 'BAS.MY KCH Tracker');

      // 2. Assert core DOM elements match en.yaml values
      cy.get('#app-shell').should('have.attr', 'data-txt-syncing', 'Syncing positions...');
      cy.get('#route-selector option[value="all"]').should('have.text', 'All');
      cy.get('#refresh-indicator').should('contain', 'Syncing positions...');
    });

    it('should display the correct active language flag context capsule', () => {
      // Container should show the active UK Flag status element
      cy.get('.header-lang-switcher .flag-emoji')
        .should('have.attr', 'title', 'English Active')
        .and('have.text', '🇬🇧');
      
      // The swap link should exist and point explicitly to the Malay subpath
      cy.get('.header-lang-switcher .lang-swap-btn')
        .should('have.attr', 'href', '/ms/')
        .and('have.attr', 'aria-label', 'Tukar ke Bahasa Melayu');
    });

    it('should check if Leaflet controls initialized with English tooltips', () => {
      // Confirm the custom localized zoom options exist on the nodes
      cy.get('.leaflet-control-zoom-in').should('have.attr', 'title', 'Zoom in');
      cy.get('.leaflet-control-zoom-out').should('have.attr', 'title', 'Zoom out');
      cy.get('.leaflet-control-fullscreen-button').should('have.attr', 'title', 'View Fullscreen');
    });
  });

  // --- BAHASA MELAYU PATH TESTING ---
  context('Bahasa Melayu Workspace (/ms/ Subpath)', () => {
    beforeEach(() => {
      // Visit the compiled static subpath directory explicitly
      cy.visit('/ms/');
    });

    it('should boot up with compiled Malay strings', () => {
      // 1. Check top-level document properties
      cy.get('html').should('have.attr', 'lang', 'ms');
      cy.title().should('contain', 'Penjejak BAS.MY KCH');

      // 2. Assert core DOM elements match ms.yaml values
      cy.get('#app-shell').should('have.attr', 'data-txt-syncing', 'Menyemak kedudukan...');
      cy.get('#route-selector option[value="all"]').should('have.text', 'Semua');
    });

    it('should display the active Malaysian flag and swap trigger link back to root', () => {
      // Container should display active Malaysian Flag status element
      cy.get('.header-lang-switcher .flag-emoji')
        .should('have.attr', 'title', 'Bahasa Melayu Aktif')
        .and('have.text', '🇲🇾');
      
      // The link anchor button must safely target the fallback English root directory
      cy.get('.header-lang-switcher .lang-swap-btn')
        .should('have.attr', 'href', '/')
        .and('have.attr', 'aria-label', 'Switch to English');
    });

    it('should check if Leaflet controls successfully initialized with Malay tooltips', () => {
      cy.get('.leaflet-control-zoom-in').should('have.attr', 'title', 'Besarkan Peta');
      cy.get('.leaflet-control-zoom-out').should('have.attr', 'title', 'Kecilkan Peta');
      cy.get('.leaflet-control-fullscreen-button').should('have.attr', 'title', 'Lihat Skrin Penuh');
    });
  });

  // --- INTERACTION NAVIGATION DRIVE ---
  context('Cross-Language Flow Navigation Actions', () => {
    it('should switch between contexts seamlessly when clicking the icon', () => {
      cy.visit('/');
      
      // Click the 🔄 capsule swap action button
      cy.get('.header-lang-switcher .lang-swap-btn').click();

      // The browser URL location must automatically shift into the /ms/ static index route
      cy.url().should('include', '/ms/');
      cy.get('html').should('have.attr', 'lang', 'ms');

      // Click the button on the Malay layout path to bounce back
      cy.get('.header-lang-switcher .lang-swap-btn').click();
      cy.url().should('not.include', '/ms/');
      cy.get('html').should('have.attr', 'lang', 'en');
    });
  });
});
