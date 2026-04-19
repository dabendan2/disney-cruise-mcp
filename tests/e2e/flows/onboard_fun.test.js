const assert = require('assert');
const { getActivityList } = require('../../../src/automation/activities');

/**
 * E2E Test: Day 1 Onboard Fun Activities
 * Verifies that the tool can pull the list for Day 1.
 */
async function testDay1OnboardFunActivities() {
    console.log("🚀 Starting E2E Test: Verifying Day 1 Onboard Fun Activities for 2026-04-23...");
    
    const reservationId = "44079507";
    const slug = "ONBOARDFUN";
    const date = "2026-04-23";

    try {
        const result = await getActivityList(reservationId, slug, date);
        
        console.log(`Status: ${result.activities ? "Success" : "Failed"}`);
        console.log(`Activities Found: ${result.activities?.length || 0}`);

        assert.ok(result.activities.length > 0, "Should have found at least one activity on Day 1");
        
        // Check for specific known items
        const hasPhoto = result.activities.some(a => a.title.toLowerCase().includes("photo"));
        console.log(`✅ Found Photo Packages: ${hasPhoto}`);
        
    } catch (e) {
        console.error("💀 E2E Test FAILED:", e.message);
        throw e;
    }
}

if (require.main === module) {
    testDay1OnboardFunActivities().catch(err => {
        console.error("❌ Test Script Error:", err.message);
        process.exit(1);
    });
}
