const { ensureCdpPage, restartBrowser } = require('../../../src/browser/engine');
const assert = require('assert');
const { chromium } = require('playwright-chromium');

/**
 * E2E Test: Browser Page Cleanup
 * Verifies that ensureCdpPage cleans up all extra tabs/pages, leaving only one active page.
 */
async function testPageCleanup() {
    console.log("🚀 Starting E2E Test: Browser Page Cleanup...");

    // 1. Ensure browser is running and has multiple pages
    console.log("Step 1: Preparing browser with multiple tabs...");
    await restartBrowser();
    
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    
    // Open 5 extra pages
    for (let i = 0; i < 5; i++) {
        await context.newPage();
    }
    
    let pageCount = context.pages().length;
    console.log(`Current page count: ${pageCount}`);
    assert.ok(pageCount >= 5, "Should have at least 5 pages before cleanup");
    
    // Close the direct connection to let ensureCdpPage manage it
    await browser.close();

    // 2. Call ensureCdpPage
    console.log("Step 2: Calling ensureCdpPage (should trigger cleanup)...");
    const { browser: managedBrowser, page: managedPage } = await ensureCdpPage();

    try {
        // 3. Verify final page count
        const finalContext = managedBrowser.contexts()[0];
        const finalPages = finalContext.pages();
        console.log(`Final page count: ${finalPages.length}`);
        
        assert.strictEqual(finalPages.length, 1, "Should have exactly 1 page after cleanup");
        assert.strictEqual(finalPages[0], managedPage, "The remaining page should be the managed page");

        // 4. Verify functionality
        await managedPage.goto('about:blank');
        console.log("✅ Final page is functional.");
        
        console.log("\n🎊 Browser Page Cleanup Test Passed!");

    } catch (e) {
        console.error("\n💀 Browser Page Cleanup Test FAILED:", e.message);
        process.exit(1);
    } finally {
        if (managedBrowser) await managedBrowser.close().catch(() => {});
    }
}

if (require.main === module) {
    testPageCleanup().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
