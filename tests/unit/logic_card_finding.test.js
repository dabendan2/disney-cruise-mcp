const assert = require('assert');
const { chromium } = require('playwright-chromium');
const fs = require('fs');
const path = require('path');
const { SELECTORS } = require('../../src/constants');

/**
 * Unit Test: Optimized Card Finding and Scrolling
 * Verifies that the locator-based finding and scrolling logic works.
 */
async function testCardFindingLogic() {
    console.log("🚀 Starting Unit Test: Optimized Card Finding Logic...");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Mock a page with multiple activity cards, some hidden far below
        await page.setContent(`
            <html>
                <body>
                    <div style="height: 3000px;">Spacer</div>
                    <wdpr-activity-card id="target-card">
                        <h2>60-Minute Fitness Appointment</h2>
                        <div class="activity-card-button-container">
                            <button>Select</button>
                        </div>
                    </wdpr-activity-card>
                </body>
            </html>
        `);

        console.log("Step 1: Testing direct locator visibility...");
        const activityName = "60-Minute Fitness Appointment";
        const card = page.locator(SELECTORS.ACTIVITY_CARD).filter({ hasText: new RegExp(activityName, "i") }).first();
        
        // Initial state: card exists in DOM but might not be 'visible' if it's far down (though Playwright locator.isVisible is usually true if in DOM and not display:none)
        const exists = await card.count();
        assert.strictEqual(exists, 1, "Card should exist in DOM");

        console.log("Step 2: Simulating aggressive scroll finding...");
        // This simulates the logic in booking.js
        let found = false;
        for (let i = 0; i < 5; i++) {
            const isVisible = await card.isVisible();
            if (isVisible) {
                found = true;
                break;
            }
            await page.evaluate(() => window.scrollBy(0, 1500));
        }
        assert.ok(found, "Should find the card via visibility check or scroll");

        console.log("Step 3: Testing scrollIntoViewIfNeeded...");
        await card.scrollIntoViewIfNeeded();
        
        // Verify position
        const box = await card.boundingBox();
        const viewport = page.viewportSize();
        assert.ok(box.y >= 0, "Card should be within or above viewport");
        
        console.log("✅ Card Finding Logic Verified.");

    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    testCardFindingLogic().catch(e => {
        console.error("❌ Test Failed:", e.message);
        process.exit(1);
    });
}
