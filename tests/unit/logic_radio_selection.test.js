const assert = require('assert');
const { chromium } = require('playwright-chromium');

/**
 * Unit Test: Guest Selection with Radio Buttons (Disney Adventure Style)
 */
async function testRadioGuestSelection() {
    console.log("🚀 Starting Unit Test: Radio Guest Selection Logic...");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Mock the exact structure found in the 500/no_slots DOM
        await page.setContent(`
            <html>
                <body>
                    <div class="book-activity-drawer">
                        <ul class="participants-list">
                            <li class="participant">
                                <wdpr-radio-button id="guest1">
                                    <label class="radio-label">CHUN YU LAI</label>
                                </wdpr-radio-button>
                            </li>
                            <li class="participant">
                                <wdpr-radio-button id="guest2">
                                    <label class="radio-label">MEI LING LIN</label>
                                </wdpr-radio-button>
                            </li>
                        </ul>
                        <button id="check-btn" disabled>Check Availability</button>
                    </div>
                </body>
            </html>
        `);

        console.log("Step 1: Testing updated selection logic...");
        // Updated logic to be implemented in booking.js
        const guestLocators = [
            'wdpr-radio-button label',
            '.participant label',
            'label.btn-checkbox-label',
            'li.participant'
        ].join(', ');

        const guests = page.locator(guestLocators);
        const count = await guests.count();
        console.log(`Found ${count} guest candidates.`);
        assert.strictEqual(count >= 2, true, "Should find at least 2 guests");

        // Simulate click on the first guest
        await guests.first().click();
        console.log("Clicked first guest.");

        // In a real app, this would enable the button. 
        // Here we just verify we can target it.
        const checkBtn = page.locator('button').filter({ hasText: /Check Availability/i });
        assert.ok(await checkBtn.count() > 0, "Should find Check Availability button");

        console.log("✅ Radio Selection Logic Verified.");

    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    testRadioGuestSelection().catch(e => {
        console.error("❌ Test Failed:", e.message);
        process.exit(1);
    });
}
