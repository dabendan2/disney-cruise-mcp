const { chromium } = require('playwright-chromium');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { extractTimeSlots, isSlotDisabled } = require('../../../src/automation/ui_utils');
const { cleanGuestName } = require('../../../src/utils/ui_logic');

async function testUiUtils() {
    console.log("🚀 Starting Unit Test: UI Utils & Logic...");

    const fixturePath = path.join(__dirname, '../../res/spa_fitness_slots.html');
    if (!fs.existsSync(fixturePath)) {
        throw new Error(`Fixture not found at ${fixturePath}`);
    }

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Load the local HTML file
    await page.goto(`file://${fixturePath}`);

    console.log("\nStep 1: Testing extractTimeSlots (New Structured Version)...");
    const slots = await extractTimeSlots(page);
    console.log("Extracted slots (Raw):", JSON.stringify(slots, null, 2));
    
    assert(slots.length > 0, "Should extract at least one time slot");
    
    const times = slots.map(s => s.time);
    assert(times.includes('3:30 PM'), "Should include 3:30 PM");
    assert(times.includes('4:30 PM'), "Should include 4:30 PM");

    // Based on spa_fitness_slots.html fixture:
    // 4:30 PM is usually disabled in this sample
    const slot430 = slots.find(s => s.time === '4:30 PM');
    const slot330 = slots.find(s => s.time === '3:30 PM');

    console.log(`- 3:30 PM Available: ${slot330.available}`);
    console.log(`- 4:30 PM Available: ${slot430.available}`);

    assert.strictEqual(slot330.available, true, "3:30 PM should be identified as available");
    assert.strictEqual(slot430.available, false, "4:30 PM should be identified as unavailable (grayed out)");
    
    console.log("✅ extractTimeSlots PASSED.");

    console.log("\nStep 2: Testing isSlotDisabled (Individual Locator)...");
    // 4:30 PM is known to be grayed out in this fixture
    const unavailableSlot = page.locator('li[role="option"], .option-link').filter({ hasText: /^4:30 PM$/i }).first();
    const is430Disabled = await isSlotDisabled(unavailableSlot);
    assert.strictEqual(is430Disabled, true, "isSlotDisabled should identify 4:30 PM as disabled");

    // 3:30 PM is known to be available
    const availableSlot = page.locator('li[role="option"], .option-link').filter({ hasText: /^3:30 PM$/i }).first();
    const is330Disabled = await isSlotDisabled(availableSlot);
    assert.strictEqual(is330Disabled, false, "isSlotDisabled should identify 3:30 PM as enabled");
    console.log("✅ isSlotDisabled PASSED.");

    console.log("\nStep 3: Testing cleanGuestName...");
    assert.strictEqual(cleanGuestName("CHUN YU LAI Age 18+"), "CHUN YU LAI");
    assert.strictEqual(cleanGuestName("MEI LING LIN Infant"), "MEI LING LIN");
    assert.strictEqual(cleanGuestName("  Mickey   Mouse  Age 5  "), "Mickey Mouse");
    console.log("✅ cleanGuestName PASSED.");

    await browser.close();
    console.log("\n🏁 ALL Unit Tests PASSED.");
}

if (require.main === module) {
    testUiUtils().catch(err => {
        console.error("❌ Test Failed:", err);
        process.exit(1);
    });
}
