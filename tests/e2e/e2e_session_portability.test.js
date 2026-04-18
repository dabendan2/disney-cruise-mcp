const { verifySession } = require('../../src/index');
const { ensureCdpPage } = require('../../src/browser/engine');
const { chromium } = require('playwright-chromium');
const assert = require('assert');

/**
 * E2E Test: Session Portability & Fresh Login
 * This test verifies:
 * 1. Forcing a fresh login by clearing state.
 * 2. Extracting valid Cookies and WebStorage.
 * 3. Porting that state to a non-CDP browser to see the reservation.
 */
async function testSessionPortability() {
    const reservationId = "44079507";
    console.log(`🚀 Starting E2E Test: Verifying Session Portability (FRESH START) for ${reservationId}...`);

    // Step 0: Ensure we are NOT logged in initially to test the full flow
    console.log("Step 0: Resetting CDP browser state (about:blank + clear cookies)...");
    const { browser: cdpBrowser, page: cdpPage } = await ensureCdpPage();
    await cdpPage.goto('about:blank');
    await cdpPage.context().clearCookies();
    await cdpBrowser.close();

    // 1. Extract session state using the MCP tool
    console.log("\nStep 1: Extracting session state via verifySession (triggers login)...");
    const loginResult = await verifySession(reservationId);
    assert.strictEqual(loginResult.status, "SUCCESS", "Initial login/session extraction failed");
    
    const state = loginResult.state;
    console.log(`✅ Extracted ${state.cookies.length} cookies.`);

    // 1.5. Validate Cookies
    assert.ok(state.cookies.length > 5, "Should have a reasonable number of cookies");
    const hasAuthMarker = state.cookies.some(c => 
        c.name.includes('SWID') || 
        c.name.includes('DSV') || 
        c.name.includes('PHPSESSID') || 
        c.name.includes('_abck')
    );
    assert.ok(hasAuthMarker, "Cookies should contain at least one Disney auth/security marker");

    // 2. Launch a completely fresh, isolated browser instance (Standard Playwright, NO CDP)
    console.log("\nStep 2: Launching a fresh, non-CDP browser instance...");
    const browser = await chromium.launch({ headless: true });
    
    // Create context with extracted state
    const context = await browser.newContext({
        storageState: {
            cookies: state.cookies,
            origins: state.origins
        },
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    try {
        const page = await context.newPage();
        
        // 3. Manual Injection of WebStorage
        console.log("Step 3: Injecting extended WebStorage...");
        for (const item of state.webStorage) {
            await page.goto(item.origin, { waitUntil: 'commit' });
            await page.evaluate((data) => {
                for (const [k, v] of Object.entries(data.localStorage)) { localStorage.setItem(k, v); }
                for (const [k, v] of Object.entries(data.sessionStorage)) { sessionStorage.setItem(k, v); }
            }, item);
        }

        // 4. Verification
        const targetUrl = "https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/";
        console.log(`Step 4: Accessing ${targetUrl} with ported session...`);
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        
        console.log("Waiting for page content to hydrate (15s)...");
        await page.waitForTimeout(15000);
        
        const content = await page.content();
        const finalUrl = page.url();
        const found = content.includes(reservationId);
        
        console.log(`Final URL: ${finalUrl}`);
        
        if (found) {
            console.log(`✅ SUCCESS: Reservation ID ${reservationId} found in ported session!`);
        } else {
            console.log("❌ FAIL: Reservation ID not found.");
            const debugPath = `/home/ubuntu/.disney-cruise/debug/portability_fresh_fail_${Date.now()}.png`;
            await page.screenshot({ path: debugPath, fullPage: true });
            console.log(`📸 Screenshot: ${debugPath}`);
        }

        assert.ok(found, "The session should be portable enough to show the reservation ID.");
        console.log("\n🎊 E2E Test Passed!");

    } catch (e) {
        console.error("\n💀 E2E Test FAILED:", e.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    testSessionPortability().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
