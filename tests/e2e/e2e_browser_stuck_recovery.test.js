const { ensureCdpPage } = require('../../src/browser/engine');
const assert = require('assert');
const { execSync, spawn } = require('child_process');

/**
 * E2E Test: Stuck Browser Recovery
 * Verifies that ensureCdpPage can recover if the browser process exists but is unresponsive (stuck).
 */
async function testStuckBrowserRecovery() {
    console.log("🚀 Starting E2E Test: Stuck Browser Recovery...");

    // 1. Setup a "Stuck" browser
    console.log("Step 1: Launching a browser and freezing it (SIGSTOP)...");
    
    // Kill existing first
    try { execSync("pkill -9 -f chromium || true"); } catch (e) {}

    const chromeProcess = spawn('chromium', [
      '--headless',
      '--remote-debugging-port=9222',
      '--disable-gpu',
      '--no-sandbox',
      '--user-data-dir=/tmp/chrome-mcp-disney',
      '--ozone-platform=headless'
    ], { detached: true, stdio: 'ignore' });
    
    const pid = chromeProcess.pid;
    console.log(`Spawned Chromium with PID: ${pid}`);
    chromeProcess.unref();

    // Wait for it to actually start
    await new Promise(r => setTimeout(r, 3000));

    // Freeze it using SIGSTOP
    console.log(`Freezing process ${pid}...`);
    try {
        process.kill(pid, 'SIGSTOP');
        console.log("SIGSTOP sent.");
    } catch (e) {
        throw new Error(`Failed to freeze process ${pid}: ${e.message}`);
    }

    // 2. Call ensureCdpPage
    console.log("Step 2: Calling ensureCdpPage (should detect stuck browser)...");
    const start = Date.now();
    
    // Set a local timeout for the test
    const recoveryTask = ensureCdpPage();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Test Timeout Limit Reached (45s)")), 45000));

    try {
        const { browser, page } = await Promise.race([recoveryTask, timeoutPromise]);
        const duration = (Date.now() - start) / 1000;

        // 3. Verify browser is alive and responsive now
        assert.ok(browser, "Browser should be defined");
        const version = await browser.version();
        console.log(`✅ Recovery Successful! New Browser Version: ${version}`);
        console.log(`⏱️ Total process took ${duration.toFixed(1)}s`);

        // 4. Verification
        await page.goto('about:blank');
        assert.strictEqual(page.url(), 'about:blank');
        console.log("✅ New browser is fully functional.");
        console.log("\n🎊 Stuck Browser Recovery Test Passed!");

        if (browser) await browser.close().catch(() => {});
    } catch (e) {
        console.error("\n💀 Stuck Browser Recovery Test FAILED:", e.message);
        // Ensure we don't leave zombie processes
        try { execSync("pkill -9 -f chromium || true"); } catch (err) {}
        process.exit(1);
    }
}

if (require.main === module) {
    testStuckBrowserRecovery().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
