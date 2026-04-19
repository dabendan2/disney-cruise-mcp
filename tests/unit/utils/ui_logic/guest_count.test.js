const assert = require('assert');
// Import actual logic from utility
const { getTargetGuestCount } = require('../../../../src/utils/ui_logic');

/**
 * Unit Test: Guest Selection Logic
 * Verifies that the logic correctly identifies "Book for 1 Guest only" 
 * and limits guest selection accordingly using the ACTUAL shared logic.
 */
async function testGuestSelectionLogic() {
    console.log("🚀 Starting Unit Test: Guest Selection Logic (Using Shared Logic)...");

    // Test 1: Normal activity (no restriction)
    const count1 = getTargetGuestCount("This is a fun activity for everyone.", 4);
    assert.strictEqual(count1, 4);
    console.log("✅ Test 1 Passed: Normal activity selects all guests");

    // Test 2: Restricted activity (Book for 1 Guest only)
    const count2 = getTargetGuestCount("Special session. Book for 1 Guest only. Please arrive early.", 4);
    assert.strictEqual(count2, 1);
    console.log("✅ Test 2 Passed: Restricted activity selects only 1 guest");

    // Test 3: Restricted activity with only 1 guest available anyway
    const count3 = getTargetGuestCount("Book for 1 Guest only", 1);
    assert.strictEqual(count3, 1);
    console.log("✅ Test 3 Passed: Restricted activity with 1 total guest selects 1 guest");

    // Test 4: Case sensitivity check
    const count4 = getTargetGuestCount("book for 1 guest only", 4); 
    assert.strictEqual(count4, 4, "Should be case sensitive by default");
    console.log("✅ Test 4 Passed: Text check follows case sensitivity");

    console.log("\n🏁 Guest Selection Logic Tests Completed.");
}

testGuestSelectionLogic().catch(e => {
    console.error("❌ Test Failed:", e.message);
    process.exit(1);
});
