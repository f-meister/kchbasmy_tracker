# Kuching BAS.MY Live Transit Tracker

A community-driven, real-time spatial mapping fleet tracker for BAS.MY lines across Kuching, Sarawak. This webapp/site relies on a lightweight, vanilla Hugo frontend integrated with Leaflet.js to monitor live vehicle streams and route networks cleanly without overhead framework sandboxing.

## Table of Contents
- [Transit Data Architecture & API Mechanics](#transit-data-architecture--api-mechanics)
- [Repository Architecture](#repository-architecture)
- [Prerequisites](#prerequisites)
- [Devcontainer Workspace Setup](#-devcontainer-workspace-setup)
- [Automated Quality of Life Run Scripts](#-automated-quality-of-life-run-scripts)
- [Production Deployment Pipeline](#-production-deployment-pipeline)
---

## Transit Data Architecture & API Mechanics

The application dynamically overlays two distinct layers of the General Transit Feed Specification (GTFS) protocol to render a complete spatial picture of the BAS.MY Kuching transit network.

### 1. GTFS Static (Build-Time Pipeline)
GTFS Static data defines the permanent structural framework of the transit network (the "skeleton"). This includes stops, routes, shapes, and schedules.
* **The Source:** Raw GTFS static tables (`routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt`, and `shapes.txt`) are updated periodically by transit operators.
* **Ingestion Mechanic:** The local `.devcontainer/setup.sh` triggers the parser scripts (`parse-destinations.js`, `parse-shapes.js`, `parse-stop-times.js`, `parse-trip-routes.js`) to prepare the data for the frontend, as well as a data validation script (`validate-gtfs.js`) to validate the data before ingestion happens. .
* **Output Targets:**
  * `assets/data/destinations.json`: Contains start and end points for a particular route
  * `assets/data/route_stops_index.json`: A pre-compiled index mapping specific route codes directly to arrays of valid `stop_id` values. This avoids heavy filtering logic in the browser.
  * `assets/data/routes_paths.json`: Contains the continuous polyline coordinate paths for every active line.
  * `assets/data/stop_times.json`: Contains the scheduled bus stop times for each stop, mapped to each specific route.
  * `assets/data/stops_locations.json`: Contains point coordinates and station names for all physical bus stops.
  * `assets/data/trip_prefix_routes.json`: Contains the mapping for each route to each route_id prefix used for filtering the different bus stop times per route. 
  

### 2. GTFS Realtime (Runtime Telemetry Stream)
GTFS Realtime (GTFS-RT) provides live, dynamic telemetry updates (the "heartbeat"). It feeds data about vehicle positions, arrival delays, and service alerts.
* **The Source:** A binary Protocol Buffers (protobuf) stream updated every 30–60 seconds by vehicle GPS hardware.
* **Ingestion Mechanic:** At runtime, the application frontend polls the Cloudflare Pages serverless edge gateway (`/api/buses`). 
* **The Proxy:** The serverless function (`functions/api/buses.js`) fetches the raw, compressed binary GTFS-RT protobuf feed from the official transit data API, unmarshals the protocol buffer data into standard JSON objects, maps vehicle identifiers, and passes a clean, lightweight array back to your browser.

### 3. How They Relate (The Synchronization Key)
To tie a floating live bus coordinate to a readable name on the map canvas, the application uses **`static/data/trip_lookup.json`** as a cross-referencing dictionary:

1. **The Live Entity:** The GTFS-RT stream reports a live bus with a coordinate `[Lat, Lng]` and a specific `trip_id`. It does *not* natively contain the friendly bus line name (like "Q10").
2. **The Relational Lookup:** The JavaScript engine intercepts the `trip_id` from the live feed and looks it up inside the pre-compiled `trip_lookup.json` static map.
3. **The Mapping:** This dictionary resolves the active `trip_id` back to its structural `route_id` and `route_short_name` ("routeCode"). 
4. **The UI Render:** Once the route code is resolved, the script draws the correct matching polyline from `routes_paths.json`, filters out irrelevant stations using `route_stops_index.json`, and pins the vehicle marker accurately on the map grid. 

There are more details with regards to the other `.json` files but these are more related to the rendering and filtering of bus schedule times per bus stop.

---


## Repository Architecture

```text
├── .devcontainer/
│   ├── scripts/
│   │   └── parse-shapes.js      # Compiles raw transit routing vectors
│   └── devcontainer.json        # Standardized runtime & testing toolchains
├── archetypes/
│   └── default.md               # Hugo content archetype template
├── assets/
│   ├── css/
│   │   └── tracker.css          # Stylesheet for the tracker interface
│   ├── data/                    # Build-time JSON arrays (Hugo Resource Pipe targets)
│   │   ├── destinations.json
│   │   ├── route_stops_index.json
│   │   ├── routes_paths.json
│   │   ├── stop_times.json
│   │   ├── stops_locations.json
│   │   └── trip_prefix_routes.json
│   ├── fallback/
│   └── js/                     # Modular frontend application scripts
│       ├── api.js              # Browser API proxy and feed orchestration
│       ├── config.js           # Runtime configuration, branch detection, and feature toggles
│       ├── gps_utils.js        # GPS coordinate transformations and distance helpers
│       ├── map_utils.js        # Leaflet map rendering, polylines, and marker management
│       ├── tracker.js          # Main tracker app flow, state coordination, and event wiring
│       └── utils.js            # Shared utilities, localization, and platform helpers
├── cypress/                     # End-to-end testing suite
│   └── e2e/
│       ├── tracker-fallback.cy.js
│       ├── tracker-lang.cy.js
│       └── tracker.cy.js
├── data/
│   ├── route_suffix.yml
│   ├── timetable_map.yml
│   └── test/
│       └── dummy_bus_loc.json   # Pure simulation payload database
├── functions/api/
│   └── buses.js                 # Cloudflare Pages Serverless Edge API (Live / Mock proxy)
├── test/                        # Local unit test suites for frontend and data pipeline logic
│   ├── data-pipeline/
│   │   ├── parse-destinations.test.js
│   │   ├── parse-shapes.test.js
│   │   ├── parse-stop-times.test.js
│   │   ├── parse-trip-routes.test.js
│   │   └── validate-gtfs.test.js
│   └── frontend/
│       ├── api.test.js
│       ├── config.test.js
│       ├── gps_utils.test.js
│       ├── map_utils.test.js
│       ├── tracker.test.js
│       └── utils.test.js
├── i18n/                        # Internationalization language files
│   ├── en.yaml
│   └── ms.yaml
├── layouts/
│   ├── index.html               # High-performance full-bleed single-page app frontend
│   └── _default/
│       └── taxonomy.html
├── static/data/
│   └── trip_lookup.json         # Backend metadata mapping dictionary
├── cypress.config.js            # Cypress test framework configuration
├── hugo.toml                    # Strict build pipeline configuration rules
├── package.json                 # Node.js dependencies and scripts
├── run_config.yml               # Local runtime environment configuration parameters
├── wrangler.json                # Cloudflare Workers configuration
├── init_data.sh                 # Data asset synchronization wrapper script
├── run_local.sh                 # Dynamic pipeline build and runtime proxy execution runner
└── run_local_full.sh            # Master entrypoint script for a full stack hot-reload
```
---
## Prerequisites

Before setting up the development environment, ensure you have the following installed and configured:

### Required Software
- **Git:** Version control system for cloning the repository and managing commits.
- **Docker / Docker Desktop:** Container runtime required to build and run the devcontainer environment.
  - [Docker Desktop for macOS](https://www.docker.com/products/docker-desktop)
  - [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
  - [Docker for Linux](https://docs.docker.com/engine/install/)

### VS Code Extensions
- **Dev Containers:** Microsoft's official extension for managing containerized development environments. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) or search `ms-vscode-remote.remote-containers` in VS Code's Extensions panel.

### System Requirements
- **Disk Space:** At least 2GB free space for Docker images and node dependencies.
- **RAM:** Minimum 4GB available (8GB+ recommended for smooth performance).
- **Network Access:** Required for initial setup to download Docker layers and npm packages.

---
## Devcontainer Workspace Setup
This repository includes a pre-configured VS Code Devcontainer environment. This ensures that everyone working on the project uses the exact same software versions, dependencies, and system toolchains automatically without polluting local machines.

### What is included inside the box:
- Runtimes: Node.js LTS and Hugo Extended (pre-installed for handling asset resource compilation).

- Local Servers: Cloudflare Wrangler CLI toolchain ready for running serverless edge functions locally.

- Testing Suites: System packages required to execute headless Cypress browser validation checks smoothly.

- Automation: An automated initialization cycle that automatically triggers `.devcontainer/setup.sh` upon creation to build your transit geometry indexes immediately.

### Quick Start Instructions:
1. Open this repository folder inside VS Code.

2. When prompted in the bottom-right corner with "Reopen in Container", click it. (Alternatively, open the Command Palette via `Cmd/Ctrl + Shift + P` and select `Dev Containers: Reopen in Container`).

3. Wait for the Docker image layer initialization to finish. The terminal will automatically activate, run the data compiler scripts, and leave you on a completely configured, isolated shell environment!

---

## Automated Quality of Life Run Scripts
To minimize manual terminal inputs and easily swap environment parameters, use these localized workspace management scripts.

### 1. Configure Your Runtime Target (`run_config.yml`)
Modify the `branch` parameter to toggle environment-specific features instantly at runtime. There is also a `gtfs-status` parameter to testing the case where gtfs-realtime data is empty.

```YAML
development:
  branch: "dev"   # Shows 'Data Feed Source' selector (Live API vs Simulation)
                  # Swap to "main" to auto-lock the interface into Production mode
  gtfs-status: "normal" # "test" for empty route data simulation (sometimes API returns empty static gtfs data...)
                        # "normal" for live API data
```

### 2. Full Workspace Initialization & Execution (Recommended)
This script performs a complete clean-slate rebuild. It wipes all build caches, clears old local dataset arrays, fetches fresh spatial data points, and brings up the local proxy server:

```Bash
./run_local_full.sh
```

### 3. Isolated Component Run Commands
If you need to trigger granular components of the pipeline independently, you can run them directly:

**Synchronize Datasets Only:** Clears out old target files in `assets/data/` and `static/data/` and forces a clean pull from your shape parsing scripts.

```Bash
./init_data.sh
```

**Run Compilation & Server Proxy Only:** Overrides `CF_PAGES_BRANCH` with your configured YAML target, cleans out `public/` compilation logs, and maps the app locally to port `8788`.

```Bash
./run_local.sh
```

### 4. NPM-Based Development Commands
You can also use npm scripts directly from the `package.json` for more granular control:

**Start Wrangler Development Server Only:** Launches the Cloudflare Pages local development server (useful for quick development without full Hugo rebuild):

```Bash
npm start
```

This runs `wrangler pages dev public` and maps the application to port `8788`.

**Lint JavaScript Files:** Validate the frontend, Cypress, and devcontainer scripts with ESLint:

```Bash
npm run lint
```

### 5. Testing & Quality Assurance
The repository includes an end-to-end test suite powered by Cypress. Tests are located in `cypress/e2e/` and cover tracker functionality, language switching, and fallback behavior.

**Run All Tests (Headless):** Execute the full test suite in headless mode:

```Bash
npx cypress run --headless
```

**Run Tests with GUI:** Launch Cypress Test Runner with an interactive browser for debugging and test inspection:

```Bash
npx cypress open
```

**Run Specific Test File:** Execute a single test file:

```Bash
npx cypress run --spec cypress/e2e/tracker.cy.js
```

The test suite is configured to run against `http://localhost:8788`, so ensure the local development server is running before executing tests.

### Unit Tests
This repository also includes fast local unit tests for frontend utilities and GTFS data-processing logic, powered by Vitest.

- Unit tests are stored in `test/frontend/*.test.js` and `test/data-pipeline/*.test.js`.
- Run all unit tests once:

```Bash
npm run test:unit
```

- Run unit tests in watch mode:

```Bash
npm run test:unit:watch
```

- Run full linting before commits:

```Bash
npm run lint
```

### Notes
- If your local runtime logs show permission block warnings, apply execution rights via `chmod +x *.sh` inside the terminal container.
- Ensure you have run `npm install` or the setup process has completed to make `npx` commands available.

---

## Environment Variables & Secrets Configuration

This application requires **2 environment variables** to fetch GTFS data from the transit API:

### 1. `STATIC_GTFS_URL`
**Purpose:** URL endpoint for fetching static GTFS data (routes, schedules, stops, shapes).  
**Usage:** Referenced by `.devcontainer/scripts/validate-gtfs.js` during the build-time data pipeline initialization. This data is compiled into JSON lookup tables stored in `assets/data/` and `static/data/`.  

### 2. `REALTIME_API_URL`
**Purpose:** URL endpoint for fetching real-time GTFS vehicle position data (live bus locations).  
**Usage:** Accessed by the serverless edge function (`functions/api/buses.js`) at runtime to stream live vehicle telemetry to the frontend.  

### Configuration Locations

#### Local Development (`.env`)
For local development and testing, both environment variables are stored in the [`.env`](.env) file at the project root:

```bash
STATIC_GTFS_URL="some_gtfs-static_api_url"
REALTIME_API_URL="some_gtfs-realtime_api_url"
```

These variables are automatically loaded by Node.js and Wrangler when running local development commands (`run_local.sh`, `run_local_full.sh`, `npm start`).

#### Production Deployment
Environment variables for production deployment are stored in **two places**:

1. **GitHub Repository Secrets:** Used during the CI/CD pipeline (`.github/workflows/deploy.yml`).
   - `STATIC_GTFS_URL` is injected as a secret during the "Execute Automated Static Ingestion Script" step.
   - Other deployment secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are used to authenticate with Cloudflare Pages.

2. **Cloudflare Dashboard:** Environment variables for the deployed edge function are configured via the Cloudflare Pages project dashboard.
   - `REALTIME_API_URL` is bound to the `functions/api/buses.js` serverless function and accessed via `context.env.REALTIME_API_URL`.
   - Production, staging, and preview environments can have different variable bindings.

**To configure secrets for your deployment:**
- **GitHub:** Go to your repository → Settings → Secrets and variables → Actions → New repository secret
- **Cloudflare:** Go to your Pages project → Settings → Environment variables

---

## Production Deployment Pipeline
This repository is optimized for Cloudflare Pages architecture.

- CI/CD Integration: When you push changes to GitHub, Cloudflare Pages intercepts the commit.

- Production Build Execution: Cloudflare ignores local helper scripts and runs the simple build setting:

```Bash
hugo
```

- Branch Isolation Logic: The repository detects branch status automatically. If the deployment is on the `main` branch, the user interface hides all development tools and permanently locks the stream directly to the live server transit feed. Staging or preview branch builds preserve the simulation tools for remote testing