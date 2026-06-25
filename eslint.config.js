const js = require("@eslint/js");
const globals = require("globals");
const cypressPlugin = require("eslint-plugin-cypress");

module.exports = [
  js.configs.recommended,
  
  // 1. Core Frontend Tracker Scripts Rule Sandbox
  {
    files: ["assets/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: {
        ...globals.browser,
        L: "readonly",
        getDisplayRouteCode: "readonly",
        calculateHaversineDistance: "readonly",
        renderSelectedRouteLine: "readonly",
        renderFilteredBusStops: "readonly",
        startUserLocationTracking: "readonly",
        stopUserLocationTracking: "readonly",
        syncLiveBusTracker: "readonly",
        injectDynamicCopyrightYear: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "vars": "all", "args": "none" }],
      "no-undef": "error",
      "no-console": "off"
    }
  },

  // 2. Devcontainer Orchestration & Data Parsing Node Rules 
  {
    files: [".devcontainer/scripts/*.js", ".devcontainer/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs", // Permissive toward native require() / module.exports syntax
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "vars": "all", "args": "none" }],
      "no-undef": "error",
      "no-console": "off"
    }
  },

  // 3. Cypress End-to-End Test Suite Target Block
  {
    files: ["cypress/e2e/**/*.cy.js", "cypress/**/*.js"],
    plugins: {
      cypress: cypressPlugin
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...cypressPlugin.configs.recommended.languageOptions.globals
      }
    },
    rules: {
      ...cypressPlugin.configs.recommended.rules,
      "cypress/no-unnecessary-waiting": "warn",
      "no-undef": "error",
      "no-unused-vars": "off"
    }
  }
];
