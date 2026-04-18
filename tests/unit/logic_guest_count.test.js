const assert = require('assert');

/**
 * Unit Test: Guest Selection Logic
 * Verifies that the logic correctly identifies "Book for 1 Guest only" 
 * and limits guest selection accordingly.
 */
async function testGuestSelectionLogic() {
    console.log("🚀 Starting Unit Test: Guest Selection Logic...");

    // Mock implementation of the logic from activities.js
    async function simulateGuestSelection(cardText, guestCount) {
        const onlyOneGuest = cardText.includes("Book for 1 Guest only");
        
        const count = guestCount;
        const toSelect = onlyOneGuest ? Math.min(1, count) : count;
        
        let selectedCount = 0;
        for (let i = 0; i < toSelect; i++) {
            selectedCount++;
        }
        return { onlyOneGuest, toSelect, selectedCount };
    }

    // Test 1: Normal activity (no restriction)
    const result1 = await simulateGuestSelection("This is a fun activity for everyone.", 4);
    assert.strictEqual(result1.onlyOneGuest, false);
    assert.strictEqual(result1.selectedCount, 4);
    console.log("✅ Test 1 Passed: Normal activity selects all guests");

    // Test 2: Restricted activity (Book for 1 Guest only)
    const result2 = await simulateGuestSelection("Special session. Book for 1 Guest only. Please arrive early.", 4);
    assert.strictEqual(result2.onlyOneGuest, true);
    assert.strictEqual(result2.selectedCount, 1);
    console.log("✅ Test 2 Passed: Restricted activity selects only 1 guest");

    // Test 3: Restricted activity with only 1 guest available anyway
    const result3 = await simulateGuestSelection("Book for 1 Guest only", 1);
    assert.strictEqual(result3.onlyOneGuest, true);
    assert.strictEqual(result3.selectedCount, 1);
    console.log("✅ Test 3 Passed: Restricted activity with 1 total guest selects 1 guest");

    // Test 4: Case sensitivity check (assuming we want it exact as seen in DCL)
    const result4 = await simulateGuestSelection("book for 1 guest only", 4); // Case sensitive check
    assert.strictEqual(result4.onlyOneGuest, false, "Should be case sensitive by default");
    console.log("✅ Test 4 Passed: Text check is case sensitive");

    console.log("\n🏁 Guest Selection Logic Tests Completed.");
}

testGuestSelectionLogic().catch(e => {
    console.error("❌ Test Failed:", e.message);
    process.exit(1);
});
