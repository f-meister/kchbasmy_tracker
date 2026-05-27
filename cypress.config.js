const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8788', // Points to Wrangler's local Pages dev server
    supportFile: false,
    viewportWidth: 1280,
    viewportHeight: 720
  },
});
