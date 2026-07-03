describe('BAS.MY KCH Tracker - Native Multilingual E2E Verification', () => {

  // --- ENGLISH PATH TESTING ---
  context('English Workspace (Root Path)', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/buses*', {
        delay: 500,
        body: []
      }).as('delayedBuses');

      cy.visit('/');
    });

    it('should boot up with default English strings', () => {
      cy.get('html').should('have.attr', 'lang', 'en');
      cy.title().should('contain', 'BAS.MY KCH Tracker');
      cy.get('#app-shell').should('have.attr', 'data-txt-syncing', 'Syncing positions...');
    });

    it('should display the correct active language flag and link to Malay next', () => {
      cy.get('.header-lang-switcher .lang-btn.current')
        .should('have.attr', 'title', 'English')
        .and('contain', '🇬🇧');
      
      cy.get('.header-lang-switcher .lang-swap-btn')
        .should('have.attr', 'href', '/ms/')
        .find('svg.lang-swap-icon').should('exist');
    });
  });

  // --- BAHASA MELAYU PATH TESTING ---
  context('Bahasa Melayu Workspace (/ms/ Subpath)', () => {
    beforeEach(() => {
      cy.visit('/ms/');
    });

    it('should boot up with compiled Malay strings', () => {
      cy.get('html').should('have.attr', 'lang', 'ms');
      cy.get('#route-selector option[value="all"]').should('have.text', 'Semua');
    });

    it('should display the active Malaysian flag and link to Chinese next', () => {
      cy.get('.header-lang-switcher .lang-btn.current')
        .should('have.attr', 'title', 'Bahasa Melayu')
        .and('contain', '🇲🇾');
      
      cy.get('.header-lang-switcher .lang-swap-btn')
        .should('have.attr', 'href', '/zh/')
        .find('svg.lang-swap-icon').should('exist');
    });
  });

  // --- CHINESE PATH TESTING ---
  context('Chinese Workspace (/zh/ Subpath)', () => {
    beforeEach(() => {
      cy.visit('/zh/');
    });

    it('should display the active Chinese flag and loop back to English root next', () => {
      cy.get('.header-lang-switcher .lang-btn.current')
        .should('have.attr', 'title', '中文')
        .and('contain', '🇨🇳');
      
      cy.get('.header-lang-switcher .lang-swap-btn')
        .should('have.attr', 'href', '/')
        .find('svg.lang-swap-icon').should('exist');
    });
  });

  // --- INTERACTION NAVIGATION DRIVE ---
  context('Cross-Language Flow Navigation Actions', () => {
    it('should cycle through the entire language loop sequentially on click triggers', () => {
      cy.visit('/');
      
      // 1. English -> Malay
      cy.get('.header-lang-switcher .lang-swap-btn').click();
      cy.url().should('include', '/ms/');
      cy.get('html').should('have.attr', 'lang', 'ms');

      // 2. Malay -> Chinese
      cy.get('.header-lang-switcher .lang-swap-btn').click();
      cy.url().should('include', '/zh/');
      cy.get('html').should('have.attr', 'lang', 'zh');

      // 3. Chinese -> Back to English Root
      cy.get('.header-lang-switcher .lang-swap-btn').click();
      cy.url().should('not.include', '/ms/').and('not.include', '/zh/');
      cy.get('html').should('have.attr', 'lang', 'en');
    });
  });
});
