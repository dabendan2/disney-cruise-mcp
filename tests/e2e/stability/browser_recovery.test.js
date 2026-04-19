const { ensureCdpPage } = require('../../../src/browser/engine');
const assert = require('assert');
const { execSync } = require('child_process');

/**
 * E2E Test: Browser Recovery & Self-Healing
 * Verifies that ensureCdpPage can start the browser from a dead state.
 */
async function testBrowserRecovery() {
    console.log("🚀 Starting E2E Test: Browser Recovery (Cold Start)...");

    // 1. Force kill any existing chromium to simulate "No Browser" state
    console.log("Step 1: Killing all chromium processes...");
    try {
        execSync("pkill -9 -f chromium || true");
    } catch (e) {
        // pkill might exit with 1 if no processes found, that's fine
    }

    // 2. Call ensureCdpPage
    console.log("Step 2: Calling ensureCdpPage (should trigger restartBrowser)...");
    const start = Date.now();
    const { browser, page } = await ensureCdpPage();
    const duration = (Date.now() - start) / 1000;

    try {
        // 3. Verify browser is alive
        assert.ok(browser, "Browser should be defined");
        assert.ok(page, "Page should be defined");
        
        const version = await browser.version();
        console.log(`✅ Browser started successfully! Version: ${version}`);
        console.log(`⏱️ Recovery took ${duration.toFixed(1)}s`);

        // 4. Verify page is functional
        await page.goto('about:blank');
        const url = page.url();
        assert.strictEqual(url, 'about:blank', "Page should be able to navigate");
        
        console.log("✅ Basic page navigation verified.");
        console.log("\n🎊 Browser Recovery Test Passed!");

    } catch (e) {
        console.error("\n💀 Browser Recovery Test FAILED:", e.message);
        process.exit(1);
    } finally {
        if (browser) {
            console.log("Cleaning up...");
            await browser.close().catch(() => {});
        }
    }
}

if (require.main === module) {
    testBrowserRecovery().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
