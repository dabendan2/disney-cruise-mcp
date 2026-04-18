const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '/home/ubuntu';
const BASE_DIR = path.join(HOME, '.disney-cruise');
const LOG_DIR = path.join(BASE_DIR, 'logs');
const DEBUG_DIR = path.join(BASE_DIR, 'debug');

// Ensure directories exist
[LOG_DIR, DEBUG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Create a unique log file for this session
const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(LOG_DIR, `${sessionTimestamp}.log`);

/**
 * Logs a message with timestamp to stderr and a persistent log file.
 * @param {string} msg 
 * @returns {number} Current timestamp in ms
 */
function logTime(msg) {
    const now = new Date();
    const time = now.toISOString().split('T')[1].split('Z')[0];
    const logEntry = `[${time}] ${msg}`;
    
    // 1. Always output to stderr (visible during live runs/MCP debugging)
    console.error(logEntry);
    
    // 2. Append to persistent log file
    try {
        fs.appendFileSync(logFile, logEntry + '\n');
    } catch (e) {
        // Fallback if file writing fails
    }
    
    return now.getTime();
}

/**
 * Saves page state (screenshot and DOM) for debugging.
 */
async function saveDebug(page, name) {
    try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${ts}_${name}`;
        const base = path.join(DEBUG_DIR, filename);
        
        // Save screenshot
        const screenshotPath = `${base}.png`;
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        
        // Save DOM snapshot
        const content = await page.content().catch(() => "Failed to get content");
        fs.writeFileSync(`${base}.DOM.html`, content);
        
        logTime(`[DEBUG] Evidence saved: ${name} at ${base}`);
        return base;
    } catch (e) {
        logTime(`[ERROR] Failed to save debug evidence: ${e.message}`);
        return "debug_save_failed";
    }
}

module.exports = { logTime, saveDebug, logFile, LOG_DIR, DEBUG_DIR };
