const assert = require('assert');
const { chromium } = require('playwright-chromium');
const fs = require('fs');
const path = require('path');
// Now importing the actual logic from the utility
const { isBookingConflict } = require('../../../../src/utils/ui_logic');

/**
 * Unit Test: Already Booked / Conflict Detection
 * Uses the real HTML sample captured from the site
 * AND tests the actual exported logic from activities.js.
 */
async function testAlreadyBookedDetection() {
    console.log("🚀 Starting Unit Test: Already Booked Detection (Using Source Logic)...");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        const samplePath = path.join(__dirname, '../../../fixtures/booking_conflict_sample.html');
        if (!fs.existsSync(samplePath)) {
            throw new Error(`Sample file not found at ${samplePath}`);
        }
        const sampleHtml = fs.readFileSync(samplePath, 'utf8');
        
        // Load the real sample
        await page.setContent(`<html><body>${sampleHtml}</body></html>`);

        // Extract text from the real DOM
        const cardText = await page.evaluate(() => {
            return document.querySelector('wdpr-activity-card').innerText;
        });

        // Test the ACTUAL logic function with the ACTUAL text from the sample
        const isConflict = isBookingConflict(cardText);

        assert.ok(cardText.length > 0, "Should extract text from the sample card");
        assert.ok(isConflict, "Source logic should detect conflict in the real sample");
        
        console.log(`✅ Success: Actual source logic detected conflict in real sample.`);
        console.log(`📊 Sample text used: "${cardText.substring(0, 100).replace(/\s+/g, ' ')}..."`);

    } finally {
        await browser.close();
    }
}

testAlreadyBookedDetection().catch(e => {
    console.error("❌ Test Failed:", e.message);
    process.exit(1);
});
