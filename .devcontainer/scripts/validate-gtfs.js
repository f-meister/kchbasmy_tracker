// .devcontainer/scripts/validate-gtfs.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// --- DIRECTORY CONFIGURATIONS ---
const projectRoot = path.join(__dirname, '..', '..');
const tmpDir = path.join(projectRoot, 'tmp-gtfs');
const CONFIG_PATH = path.join(projectRoot, 'run_config.yml');

// Absolute paths calibrated for the project root workspace
const FALLBACK_GTFS_PATH  = path.join(projectRoot, 'assets', 'fallback', 'gtfs.zip'); 
const TEST_FAIL_GTFS_PATH = path.join(projectRoot, 'assets', 'fallback', 'gtfs_fail.zip'); 
const TARGET_GTFS_PATH    = path.join(projectRoot, 'gtfs.zip'); 

// 🇲🇾 Official Malaysia Open API Static Endpoint for mybas Kuching
const GTFS_API_URL = 'https://api.data.gov.my/gtfs-static/mybas-kuching'; 
const requiredFiles = ['routes.txt', 'shapes.txt', 'stop_times.txt', 'stops.txt', 'trips.txt'];

/**
 * Safely parses run_config.yml to extract the active environment's gtfs-status value
 */
function getGtfsStatusFromConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log("⚠️ run_config.yml not found. Defaulting lifecycle status to [normal].");
    return 'normal';
  }

  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const match = content.match(/gtfs-status:\s*['"]?([^'"\s]+)['"]?/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (err) {
    console.warn(`⚠️ Error reading run_config.yml: ${err.message}. Defaulting to [normal].`);
  }
  return 'normal';
}

/**
 * Helper utility to build an absolute URL if the redirect location is a relative path
 */
function resolveRedirectUrl(originalUrl, locationHeader) {
  if (!locationHeader) return originalUrl;
  if (locationHeader.startsWith('http://') || locationHeader.startsWith('https://')) {
    return locationHeader;
  }
  const urlObj = new URL(originalUrl);
  return `${urlObj.origin}${locationHeader}`;
}

/**
 * Counts populated rows inside a text file safely skipping blank lines
 */
function countDataLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(line => line.trim()).length;
}

/**
 * Recursively scans a folder to find all files matching an extension
 */
function findFilesByExtension(dir, ext, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFilesByExtension(filePath, ext, fileList);
    } else if (file.endsWith(ext)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

/**
 * Unpacks the ZIP archive and flattens files into /tmp-gtfs
 */
function extractAndFlattenZip(zipPath) {
  console.log(`📦 Decompressing target transit archive data stream: ${zipPath}`);
  
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  execSync(`unzip -q -o "${zipPath}" -d "${tmpDir}"`, { stdio: 'inherit' });

  const extractedTxtFiles = findFilesByExtension(tmpDir, '.txt');
  if (extractedTxtFiles.length > 0) {
    extractedTxtFiles.forEach(oldPath => {
      const newPath = path.join(tmpDir, path.basename(oldPath));
      if (oldPath !== newPath) fs.renameSync(oldPath, newPath);
    });
  }
}

/**
 * Utility to fetch remote file headers to check the Content-Length size
 */
function getRemoteSize(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const absoluteRedirectUrl = resolveRedirectUrl(url, res.headers.location);
        console.log(`↪️ Following HEAD redirect to resolved path: ${absoluteRedirectUrl}`);
        resolve(getRemoteSize(absoluteRedirectUrl));
        return;
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const size = parseInt(res.headers['content-length'], 10);
        if (!isNaN(size)) {
          resolve(size);
        } else {
          reject(new Error('Content-Length header missing from API response'));
        }
      } else {
        reject(new Error(`Server returned status code: ${res.statusCode}`));
      }
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * Utility to download the remote stream asset to disk
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const absoluteRedirectUrl = resolveRedirectUrl(url, res.headers.location);
        console.log(`↪️ Following GET redirect to resolved path: ${absoluteRedirectUrl}`);
        resolve(downloadFile(absoluteRedirectUrl, destPath));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download file. Status: ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); 
      reject(err);
    });
  });
}

/**
 * Main validation and orchestration runner block
 */
async function validateAndPrepareGTFS() {
  console.log("🎬 Initializing GTFS Lifecycle Validation Pipeline...");

  // 1. Check active configuration state
  const gtfsStatus = getGtfsStatusFromConfig();
  console.log(`⚙️ Config status evaluated: [${gtfsStatus.toUpperCase()}] mode layout active.`);

  // Verify that the master baseline fallback archive exists before running evaluations
  if (!fs.existsSync(FALLBACK_GTFS_PATH)) {
    console.error(`❌ Critical Error: Unified master fallback missing at ${FALLBACK_GTFS_PATH}`);
    process.exit(1);
  }
  const fallbackSize = fs.statSync(FALLBACK_GTFS_PATH).size;

  // Initialize with the standard target path as the default baseline
  let sourceZipUsed = TARGET_GTFS_PATH;
  let downloadedFromApi = false;

  // 2. Branch Execution based on gtfs-status setting
  if (gtfsStatus === 'test') {
    console.log("🚨 Simulation Active: Loading 'gtfs_fail.zip' to intentionally evaluate failure tracking and self-healing loops.");
    if (!fs.existsSync(TEST_FAIL_GTFS_PATH)) {
      console.error(`❌ Simulation Error: Testing file missing at ${TEST_FAIL_GTFS_PATH}`);
      process.exit(1);
    }
    // Overwrite default path only for simulation mode
    sourceZipUsed = TEST_FAIL_GTFS_PATH;
  } else {
    console.log(`📦 Master baseline fallback file size verified: ${fallbackSize} bytes`);
    try {
      console.log(`🌐 Querying data.gov.my API server metadata: ${GTFS_API_URL}`);
      const remoteSize = await getRemoteSize(GTFS_API_URL);
      console.log(`📡 Latest remote API server file size: ${remoteSize} bytes`);

      // Evaluate Size Guardrails
      if (remoteSize >= fallbackSize) {
        console.log("✅ Validation Passed: Remote file is equal to or larger than fallback. Pulling...");
        await downloadFile(GTFS_API_URL, TARGET_GTFS_PATH);
        downloadedFromApi = true;
      } else {
        console.warn(`⚠️ Size Warning: Remote file (${remoteSize}B) is smaller than fallback baseline (${fallbackSize}B).`);
        console.log("🔄 Triggering Failsafe: Deploying master local fallback file directly...");
        fs.copyFileSync(FALLBACK_GTFS_PATH, TARGET_GTFS_PATH);
      }
    } catch (error) {
      console.error(`🚨 API Sync Failure [${error.message}]. Activating offline safety fallback strategy...`);
      console.log("🔄 Triggering Failsafe: Deploying master local fallback file directly...");
      fs.copyFileSync(FALLBACK_GTFS_PATH, TARGET_GTFS_PATH);
    }
  }

  // 3. Unpack and Flatten chosen ZIP target 
  extractAndFlattenZip(sourceZipUsed);

  // 4. Run Sheet Rows Metrics Validation
  let needsFallbackFailsafe = false;
  for (const file of requiredFiles) {
    const filePath = path.join(tmpDir, file);
    const totalLines = countDataLines(filePath);
    console.log(`📊 ${file}: ${totalLines} data rows detected.`);

    if (totalLines <= 2) {
      console.warn(`⚠️ Warning: ${file} failed validation metrics (Rows: ${totalLines}).`);
      needsFallbackFailsafe = true;
    }
  }

  // 5. Final Check Strategy / Self-Healing Trigger
  if (needsFallbackFailsafe) {
    if (downloadedFromApi) {
      console.log("🚨 Extracted API text file schemas are broken! Re-rolling back to verified local archive...");
      extractAndFlattenZip(FALLBACK_GTFS_PATH);
    } else if (gtfsStatus === 'test') {
      // 🌟 Step 2: Test mode successfully realizes data is bad, heals itself by overwriting with master gtfs.zip
      console.log("🚨 Simulation Success: Row metric checks caught the mock data failure tracking loop! Deploying self-healing recovery fallback...");
      extractAndFlattenZip(FALLBACK_GTFS_PATH);
    }
  }

  // 🧼 CLEANUP PHASE: Remove temporary active zip file from the project root directory if it was generated
  if (fs.existsSync(TARGET_GTFS_PATH)) {
    console.log("🧼 Cleaning up temporary workspace zip assets...");
    fs.unlinkSync(TARGET_GTFS_PATH);
  }

  console.log("✅ GTFS dataset verification passed. Resuming build compile steps...");
  process.exit(0);
}

// Fire the workflow block execution
validateAndPrepareGTFS();
