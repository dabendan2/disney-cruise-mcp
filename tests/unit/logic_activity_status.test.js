const assert = require('assert');
const { chromium } = require('playwright-chromium');
const { determineActivityStatus } = require('../../src/utils/ui_logic');

/**
 * Unit Test: Activity Status Logic
 * Verifies that the status detection logic correctly handles false positives
 * and captures real onboard status using the ACTUAL source logic.
 */
async function runUnitTests() {
    console.log("🚀 Starting Unit Tests: Activity Status (Using Source Logic)...");

    const browser = await chromium.launch();
    const page = await browser.newPage();

    // SCENARIO 1: False Positive Prevention
    // A card that contains "Onboard Price" but has a visible "Select" button.
    const htmlFalsePositive = `
        <wdpr-activity-card>
            <div class="activityDetails">
                <h2>Photo: Unlimited Package</h2>
                <div class="description">Pre-cruise price: $203.95; and Onboard Price: $239.95</div>
                <div class="activityCardColRight">
                    <button class="btn select-activity-button">Select</button>
                </div>
            </div>
        </wdpr-activity-card>
    `;

    await page.setContent(htmlFalsePositive);

    const result1 = await page.evaluate(() => {
        const card = document.querySelector('wdpr-activity-card');
        const btn = card.querySelector('button, a.btn');
        return {
            text: card.innerText,
            isBtnVisible: btn && btn.offsetParent !== null
        };
    });

    const status1 = determineActivityStatus(result1.text, result1.isBtnVisible);
    assert.strictEqual(status1, "Available", "Should correctly identify as Available even with 'Onboard' in text");
    console.log("✅ Test 1 Passed: False positive prevented");

    // SCENARIO 2: Real "Onboard Only" (No Button)
    const htmlRealOnboardOnly = `
        <wdpr-activity-card>
            <div class="activityDetails">
                <h2>Palo Dinner</h2>
                <div class="activityCardColRight">
                    <div class="onboard-label">Only available on board</div>
                </div>
            </div>
        </wdpr-activity-card>
    `;

    await page.setContent(htmlRealOnboardOnly);

    const result2 = await page.evaluate(() => {
        const card = document.querySelector('wdpr-activity-card');
        const btn = card.querySelector('button, a.btn');
        return {
            text: card.innerText,
            isBtnVisible: btn && btn.offsetParent !== null
        };
    });

    const status2 = determineActivityStatus(result2.text, result2.isBtnVisible);
    assert.strictEqual(status2, "Onboard Only", "Should capture Onboard Only status when button is missing");
    console.log("✅ Test 2 Passed: Real onboard status detected");

    // SCENARIO 3: Generic Not Available (No Button, No specific text)
    const status3 = determineActivityStatus("Coming Soon", false);
    assert.strictEqual(status3, "Not Available", "Should fallback to Not Available for unrecognized text without button");
    console.log("✅ Test 3 Passed: Fallback to Not Available");

    console.log("\n🏁 Activity Status Logic Tests Completed.");
    await browser.close();
}

runUnitTests().catch(e => {
    console.error("❌ Unit Test Failed:", e.message);
    process.exit(1);
});
