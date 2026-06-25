const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        L: "readonly",
        getDisplayRouteCode: "readonly",
        calculateHaversineDistance: "readonly",
        renderSelectedRouteLine: "readonly",
        renderFilteredBusStops: "readonly",
        startUserLocationTracking: "readonly",
        stopUserLocationTracking: "readonly",
        syncLiveBusTracker: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "vars": "all", "args": "none" }],
      "no-undef": "error",
      "no-console": "off"
    }
  }
];
