
const assert = require('assert');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { determineActivityStatus, getTargetGuestCount } = require('../../../src/utils/ui_logic');

async function testUiLogic() {
    console.log("🚀 Starting Unit Test: UI Logic & Parser (STEAKHOUSE_AVAILABLE)...");

    const fixturePath = path.join(__dirname, '../../fixtures/STEAKHOUSE_AVAILABLE.html');
    if (!fs.existsSync(fixturePath)) {
        console.warn("⚠️ Fixture not found, skipping fixture-based test.");
        return;
    }

    const availableHtml = fs.readFileSync(fixturePath, 'utf8');
    const $ = cheerio.load(availableHtml);

    // Test 1: Japanese Steakhouse Detection
    console.log("Step 1: Testing Japanese Steakhouse Detection...");
    const card = $('wdpr-activity-card').filter((i, el) => $(el).text().includes('Japanese Steakhouse')).first();
    const btn = card.find('button.select-activity-button, button:contains("Select")');
    const isBtnVisible = btn.length > 0;
    
    const status = determineActivityStatus(card.text(), isBtnVisible);
    assert.strictEqual(status, 'Available', 'Should be Available when Select button is present');
    console.log("✅ Japanese Steakhouse correctly identified as Available.");

    // Test 2: Sold Out
    console.log("Step 2: Testing Sold Out detection...");
    assert.strictEqual(determineActivityStatus('This activity is Sold Out', false), 'Sold Out');
    console.log("✅ Sold Out detected.");

    // Test 3: Guest Count logic
    console.log("Step 3: Testing Restricted Guest Count...");
    const restrictedText = "Japanese Steakhouse ... Book for 1 Guest only ...";
    assert.strictEqual(getTargetGuestCount(restrictedText, 4), 1);
    console.log("✅ Restriction 'Book for 1 Guest only' enforced.");

    console.log("\n🏁 UI Logic Unit Tests PASSED.");
}

if (require.main === module) {
    testUiLogic().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
