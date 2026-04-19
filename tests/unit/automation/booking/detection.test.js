const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-chromium');
const { SELECTORS: UI_SELECTORS } = require('../../../../src/constants');

/**
 * Unit Test: Booking Result Detection Logic
 * Verifies that the system can correctly identify success/failure states and extract verbatim error messages
 * using real HTML samples captured during previous debugging sessions.
 */
async function runBookingLogicTests() {
    console.log("🚀 Starting Unit Tests: logic_booking_detection (using real debug samples and shared selectors)...");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // --- Test 1: System Error Detection (Verbatim) ---
        console.log("Step 1: Testing Verbatim Error Detection ('unable to complete request')...");
        const errorSamplePath = path.join(__dirname, '../../../fixtures/booking_error_system_unable.html');
        const errorHtml = fs.readFileSync(errorSamplePath, 'utf8');
        await page.setContent(errorHtml);

        const errorResult = await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            return el ? el.innerText.trim() : null;
        }, UI_SELECTORS.ERROR_MESSAGES);

        const expectedError = "We are currently unable to complete your request. Please check availability once on board or try again later.";
        assert.strictEqual(errorResult, expectedError, `Should extract the exact error message. Got: ${errorResult}`);
        console.log("✅ Successfully extracted verbatim system error.");

        // --- Test 2: Booking State Detection (Ready to Save) ---
        console.log("Step 2: Testing 'Ready to Save' state detection...");
        const readySamplePath = path.join(__dirname, '../../../fixtures/booking_ready_to_save.html');
        const readyHtml = fs.readFileSync(readySamplePath, 'utf8');
        await page.setContent(readyHtml);

        const readyResult = await page.evaluate((selector) => {
            const btns = Array.from(document.querySelectorAll(selector));
            const saveBtn = btns.find(b => b.innerText.trim() === 'Save');
            const timeSelected = document.querySelector('.option-text')?.innerText.trim();
            return {
                saveVisible: !!saveBtn,
                selectedTime: timeSelected
            };
        }, UI_SELECTORS.SAVE_BUTTON);

        assert.strictEqual(readyResult.saveVisible, true, "Save button should be visible in the DOM");
        assert.strictEqual(readyResult.selectedTime, "8:00 AM", `8:00 AM slot should be selected. Got: ${readyResult.selectedTime}`);
        console.log("✅ Successfully verified 'Ready to Save' state (Slot: 8:00 AM).");

        console.log("\n🏁 All booking logic unit tests PASSED.");

    } catch (e) {
        console.error("\n❌ Unit Test FAILED:", e.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    runBookingLogicTests().catch(console.error);
}
