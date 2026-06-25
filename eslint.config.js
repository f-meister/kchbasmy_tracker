const js = require("@eslint/js");
const globals = require("globals");
const cypressPlugin = require("eslint-plugin-cypress");
const vitestPlugin = require("eslint-plugin-vitest");

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
  },

  // 4. Vitest Unit Testing Target Block
  {
    files: ["test/**/*.test.js", "test/**/*.js"],
    plugins: {
      vitest: vitestPlugin
    },
    languageOptions: {
      globals: {
        ...vitestPlugin.environments.env.globals, // Automatically whitelist vitest's globals if needed
        ...globals.node
      }
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules, // Pull down recommended unit testing rules
      "vitest/no-identical-title": "error",     // Prevents copy-pasting tests without changing titles
      "vitest/no-commented-out-tests": "warn",   // Warns if you leave a test dead and commented out
      "no-undef": "error"
    }
  }
];
