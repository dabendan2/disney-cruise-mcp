const assert = require('assert');
const cheerio = require('cheerio');
const { SELECTORS } = require('../../../src/constants');

/**
 * Unit Test: Spinner Detection Logic
 * Verifies that the LOADING_SPINNER selector covers various Disney spinner implementations.
 */
function testSpinnerDetection() {
    console.log("🚀 Starting Unit Test: Spinner Detection Logic...");

    const parkSpinnerHtml = `
        <html>
            <body>
                <wdpr-loading-spinner class="active">
                    <div class="spinner-container"></div>
                </wdpr-loading-spinner>
            </body>
        </html>
    `;

    const cruiseSpinnerHtml = `
        <html>
            <body>
                <myres-loading-spinner _ngcontent-ng-c2880452747="" _nghost-ng-c932484063="" class="ng-star-inserted">
                    <div class="loading-spinner"></div>
                </myres-loading-spinner>
            </body>
        </html>
    `;

    const legacySpinnerHtml = `
        <div class="loading-overlay">
            <div class="spinner"></div>
        </div>
    `;

    const noSpinnerHtml = `
        <div class="content">
            <h1>Welcome to Disney</h1>
        </div>
    `;

    const selector = SELECTORS.LOADING_SPINNER;
    console.log(`Using Selector: ${selector}`);

    // Helper to simulate Playwright's locator behavior in static HTML
    const hasMatch = (html) => {
        const $ = cheerio.load(html);
        return $(selector).length > 0;
    };

    // Test Cases
    assert.ok(hasMatch(parkSpinnerHtml), "Should detect Park-style (wdpr-loading-spinner)");
    console.log("✅ Park-style detected.");

    assert.ok(hasMatch(cruiseSpinnerHtml), "Should detect Cruise-style (myres-loading-spinner)");
    console.log("✅ Cruise-style detected.");

    assert.ok(hasMatch(legacySpinnerHtml), "Should detect legacy classes (.loading-overlay, .spinner)");
    console.log("✅ Legacy styles detected.");

    assert.strictEqual(hasMatch(noSpinnerHtml), false, "Should NOT detect spinner when absent");
    console.log("✅ Clean page correctly identified.");

    console.log("\n🏁 Spinner Detection Unit Test PASSED.");
}

if (require.main === module) {
    try {
        testSpinnerDetection();
    } catch (e) {
        console.error("❌ Test Failed:", e.message);
        process.exit(1);
    }
}
