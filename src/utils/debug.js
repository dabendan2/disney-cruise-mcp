const fs = require('fs');
const path = require('path');

// Ensure log directory exists
const LOG_DIR = '/home/ubuntu/.disney-cruise/logs';
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

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
 * Saves page state (screenshot and HTML) for debugging.
 */
async function saveDebug(page, name) {
    try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const base = `/home/ubuntu/.hermes/debug/${ts}_${name}`;
        
        await page.screenshot({ path: `${base}.png` }).catch(() => {});
        const content = await page.content().catch(() => "Failed to get content");
        fs.writeFileSync(`${base}.html`, content);
        
        logTime(`[DEBUG] Evidence saved: ${name} at ${base}`);
        return base;
    } catch (e) {
        logTime(`[ERROR] Failed to save debug evidence: ${e.message}`);
        return "debug_save_failed";
    }
}

module.exports = { logTime, saveDebug, logFile };
