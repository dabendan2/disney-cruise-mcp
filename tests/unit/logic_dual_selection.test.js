const assert = require('assert');
const { chromium } = require('playwright-chromium');

/**
 * Unit Test: Dual Evidence-Based Guest Selection
 * Verifies support for both the proven Legacy and New Disney structures.
 */
async function testEvidenceBasedSelection() {
    console.log("🚀 Starting Unit Test: Evidence-Based Dual Selection...");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // --- Case 1: New Disney Adventure Structure (Evidence: 00-35-10 DOM) ---
        console.log("Scenario 1: New Radio Structure (li.participant > wdpr-radio-button > label)");
        await page.setContent(`
            <li class="participant">
                <wdpr-radio-button><label>GUEST NEW</label></wdpr-radio-button>
            </li>
        `);
        const p1 = page.locator('li.participant, label.btn-checkbox-label').first();
        const tagName1 = await p1.evaluate(el => el.tagName.toLowerCase());
        const target1 = (tagName1 === 'label') ? p1 : p1.locator('label, wdpr-radio-button').first();
        
        assert.strictEqual(await target1.innerText(), "GUEST NEW");
        console.log("✅ New structure target identified.");

        // --- Case 2: Legacy Checkbox Structure (Evidence: previous versions) ---
        console.log("Scenario 2: Legacy Checkbox Structure (label.btn-checkbox-label)");
        await page.setContent(`
            <label class="btn-checkbox-label">GUEST LEGACY</label>
        `);
        const p2 = page.locator('li.participant, label.btn-checkbox-label').first();
        const tagName2 = await p2.evaluate(el => el.tagName.toLowerCase());
        const target2 = (tagName2 === 'label') ? p2 : p2.locator('label, wdpr-radio-button').first();

        assert.strictEqual(await target2.innerText(), "GUEST LEGACY");
        console.log("✅ Legacy structure target identified.");

    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    testEvidenceBasedSelection().catch(e => {
        console.error("❌ Test Failed:", e.message);
        process.exit(1);
    });
}
