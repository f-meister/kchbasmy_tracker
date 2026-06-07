// .devcontainer/scripts/validate-gtfs.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const tmpDir = path.join(__dirname, '..', '..', 'tmp-gtfs');
const fallbackBaseDir = path.join(__dirname, '..', '..', 'assets', 'fallback');
const configPath = path.join(__dirname, '..', '..', 'run_config.yml');
const requiredFiles = ['routes.txt', 'shapes.txt', 'stop_times.txt', 'stops.txt', 'trips.txt'];

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
 * Unpacks a ZIP archive, searches for any extracted .txt files inside nested 
 * sub-folders, and flattens them directly up into the root of tmp-gtfs/
 */
function extractAndFlattenZip(zipName) {
  const zipPath = path.join(fallbackBaseDir, zipName);
  if (!fs.existsSync(zipPath)) {
    console.error(`❌ Critical Error: Fallback zip target missing at: ${zipPath}`);
    process.exit(1);
  }

  // Clear or prepare target folder cleanly
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`📂 Unpacking [${zipName}] straight into tmp-gtfs/ workspace...`);
  execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`);

  // Search for text sheets nested deep inside the zip extract structures
  const extractedTxtFiles = findFilesByExtension(tmpDir, '.txt');
  
  extractedTxtFiles.forEach(oldPath => {
    const baseName = path.basename(oldPath);
    const newPath = path.join(tmpDir, baseName);
    
    // If the file isn't already directly inside the root folder, move it up
    if (oldPath !== newPath) {
      fs.renameSync(oldPath, newPath);
    }
  });
}

function runPipeline() {
  let gtfsStatus = 'normal';

  // 1. Check for non-mutating Environment Variable Override first, then fall back to run_config.yaml
  if (process.env.GTFS_STATUS_OVERRIDE) {
    gtfsStatus = process.env.GTFS_STATUS_OVERRIDE.toLowerCase().trim();
    console.log(`📡 Initialization via Environment Variable [GTFS_STATUS_OVERRIDE: "${gtfsStatus}"]`);
  } else if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const statusMatch = configContent.match(/gtfs-status:\s*["']?([^"'\s]+)/);
    if (statusMatch && statusMatch[1]) {
      gtfsStatus = statusMatch[1].toLowerCase().trim();
    }
    console.log(`📡 Initialization via Configuration Disk [gtfs-status: "${gtfsStatus}"]`);
  } else {
    console.log(`📡 Initialization default context profile loaded [gtfs-status: "${gtfsStatus}"]`);
  }

  // 2. Conditional Branching for Status Verification Testing
  if (gtfsStatus === 'test') {
    console.log("🚨 Simulation Active: Forcing download bypass to evaluate failure tracking loops.");
    extractAndFlattenZip('gtfs_fail.zip');
  } else {
    console.log("📥 Pulling live static transit package from API channels...");
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    
    const targetZip = path.join(tmpDir, 'kuching-static.zip');
    execSync(`curl -L https://api.data.gov.my/gtfs-static/mybas-kuching -o "${targetZip}"`);
    execSync(`cd "${tmpDir}" && unzip -o kuching-static.zip`);
    
    // Fallback flatten pattern in case live API zip changes its directory structures
    const extractedTxtFiles = findFilesByExtension(tmpDir, '.txt');
    extractedTxtFiles.forEach(oldPath => {
      const newPath = path.join(tmpDir, path.basename(oldPath));
      if (oldPath !== newPath) fs.renameSync(oldPath, newPath);
    });
  }

  // 3. Evaluate row metrics across mandatory sheets
  let needsFallback = false;
  for (const file of requiredFiles) {
    const filePath = path.join(tmpDir, file);
    const totalLines = countDataLines(filePath);
    console.log(`📊 ${file}: ${totalLines} rows detected.`);

    if (totalLines <= 2) {
      console.warn(`⚠️ Warning: ${file} failed validation metrics (Rows: ${totalLines}).`);
      needsFallback = true;
    }
  }

  if (!needsFallback) {
    console.log("✅ GTFS dataset verification passed. Resuming build compile steps...");
    process.exit(0);
  }

  // 4. Intercept Failure Pathway: Determine Weekend vs Weekday
  console.log("🚨 Corrupted or truncated data schema detected! Executing self-healing matrix...");
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
  const fallbackMode = isWeekend ? 'weekend' : 'weekday';

  console.log(`📅 Internal Clock: ${today.toDateString()} -> Selecting [${fallbackMode.toUpperCase()}] reference archive.`);
  
  extractAndFlattenZip(`gtfs_${fallbackMode}.zip`);
  console.log("⚡ Self-healing recovery cycle executed successfully.");
}

try {
  runPipeline();
} catch (err) {
  console.error("❌ Fatal validation crash:", err.message);
  process.exit(1);
}
