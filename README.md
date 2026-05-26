# Kuching BAS.MY Live Transit Tracker

A community-driven, real-time spatial mapping fleet tracker for BAS.MY lines across Kuching, Sarawak. This application relies on a lightweight, vanilla Hugo frontend integrated with Leaflet.js to monitor live vehicle streams and route networks cleanly without overhead framework sandboxing.

---

## 🗺️ Transit Data Architecture & API Mechanics

The application dynamically overlays two distinct layers of the General Transit Feed Specification (GTFS) protocol to render a complete spatial picture of the Kuching transit network.



### 1. GTFS Static (Build-Time Pipeline)
GTFS Static data defines the permanent structural framework of the transit network (the "skeleton"). This includes stops, routes, shapes, and schedules.
* **The Source:** Raw GTFS static tables (`routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt`, and `shapes.txt`) are updated periodically by transit operators.
* **Ingestion Mechanic:** Your local `.devcontainer/setup.sh` triggers the `parse-shapes.js` compiler. This script parses the structural text tables and collapses them into highly optimized, street-accurate GeoJSON arrays.
* **Output Targets:** * `assets/data/routes_paths.json`: Contains the continuous polyline coordinate paths for every active line.
  * `assets/data/stops_locations.json`: Contains point coordinates and station names for all physical bus stops.
  * `assets/data/route_stops_index.json`: A pre-compiled index mapping specific route codes directly to arrays of valid `stop_id` values. This avoids heavy filtering logic in the browser.

### 2. GTFS Realtime (Runtime Telemetry Stream)
GTFS Realtime (GTFS-RT) provides live, dynamic telemetry updates (the "heartbeat"). It feeds data about vehicle positions, arrival delays, and service alerts.
* **The Source:** A binary Protocol Buffers (protobuf) stream updated every 30–60 seconds by vehicle GPS hardware.
* **Ingestion Mechanic:** At runtime, the application frontend polls the Cloudflare Pages serverless edge gateway (`/api/buses`). 
* **The Proxy:** The serverless function (`functions/api/buses.js`) fetches the raw, compressed binary GTFS-RT protobuf feed from the official transit data API, unmarshals the protocol buffer data into standard JSON objects, maps vehicle identifiers, and passes a clean, lightweight array back to your browser.

### 3. How They Relate (The Synchronization Key)
To tie a floating live bus coordinate to a readable name on your map canvas, the application uses **`static/data/trip_lookup.json`** as a cross-referencing dictionary:

1. **The Live Entity:** The GTFS-RT stream reports a live bus with a coordinate `[Lat, Lng]` and a specific `trip_id`. It does *not* natively contain the friendly bus line name (like "Q10").
2. **The Relational Lookup:** The JavaScript engine intercepts the `trip_id` from the live feed and looks it up inside the pre-compiled `trip_lookup.json` static map.
3. **The Mapping:** This dictionary resolves the active `trip_id` back to its structural `route_id` and `route_short_name` ("routeCode"). 
4. **The UI Render:** Once the route code is resolved, the script draws the correct matching polyline from `routes_paths.json`, filters out irrelevant stations using `route_stops_index.json`, and pins the vehicle marker accurately on the map grid.

---


## 📂 Repository Architecture

```text
├── .devcontainer/
│   ├── scripts/
│   │   └── parse-shapes.js      # Compiles raw transit routing vectors
│   └── devcontainer.json        # Standardized runtime & testing toolchains
├── assets/data/                 # Build-time JSON arrays (Hugo Resource Pipe targets)
│   ├── route_stops_index.json
│   ├── routes_paths.json
│   └── stops_locations.json
├── static/data/
│   └── trip_lookup.json         # Backend metadata mapping dictionary
├── functions/api/
│   └── buses.js                 # Cloudflare Pages Serverless Edge API (Live / Mock proxy)
├── data/test/
│   └── dummy_bus_loc.json       # Pure simulation payload database
├── layouts/
│   └── index.html               # High-performance full-bleed single-page app frontend
├── hugo.toml                    # Strict build pipeline configuration rules
├── run_config.yml               # Local runtime environment configuration parameters
├── init_data.sh                 # Data asset synchronization wrapper script
├── run_local.sh                 # Dynamic pipeline build and runtime proxy execution runner
└── run_local_full.sh            # Master entrypoint script for a full stack hot-reload
```
---

## 🐳 Devcontainer Workspace Setup
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

## 🛠️ Automated Quality of Life Run Scripts
To minimize manual terminal inputs and easily swap environment parameters, use these localized workspace management scripts.

1. Configure Your Runtime Target (`run_config.yml`)
Modify the `branch` parameter to toggle environment-specific features instantly at runtime:

```YAML
development:
  branch: "dev"   # Shows 'Data Feed Source' selector (Live API vs Simulation)
                  # Swap to "main" to auto-lock the interface into Production mode
```
2. Full Workspace Initialization & Execution (Recommended)
This script performs a complete clean-slate rebuild. It wipes all build caches, clears old local dataset arrays, fetches fresh spatial data points, and brings up the local proxy server:

```Bash
./run_local_full.sh
```

3. Isolated Component Run Commands
If you need to trigger granular components of the pipeline independently, you can run them directly:

Synchronize Datasets Only: Clears out old target files in `assets/data/` and `static/data/` and forces a clean pull from your shape parsing scripts.

```Bash
./init_data.sh
```
Run Compilation & Server Proxy Only: Overrides `CF_PAGES_BRANCH` with your configured YAML target, cleans out `public/` compilation logs, and maps the app locally to port `8788`.

```Bash
./run_local.sh
```
Note: If your local runtime logs show permission block warnings, apply execution rights via `chmod +x *.sh` inside the terminal container.

---

## 🚀 Production Deployment Pipeline
This repository is optimized for Cloudflare Pages architecture.

- CI/CD Integration: When you push changes to GitHub, Cloudflare Pages intercepts the commit.

- Production Build Execution: Cloudflare ignores local helper scripts and runs the simple build setting:

```Bash
hugo
```

- Branch Isolation Logic: The repository detects branch status automatically. If the deployment is on the `main` branch, the user interface hides all development tools and permanently locks the stream directly to the live server transit feed. Staging or preview branch builds preserve the simulation tools for remote testing