const assert = require('assert');
const { getMyPlans } = require('../../../src/automation/activities');
const { logTime } = require('../../../src/utils/debug');

/**
 * E2E Test: get_my_plans_flow
 * This test simulates the basic auto-detection and itinerary fetching.
 */
async function testGetMyPlansFlow() {
    console.log("🚀 Starting E2E Test: get_my_plans_flow (Simplified Auto-detect)...");

    try {
        const result = await getMyPlans();
        
        console.log("=== AUTO-DETECT RESULT ===");
        console.log("Reservation ID:", result.reservation?.reservationId);
        console.log("Stateroom:", result.reservation?.stateroom);
        console.log("Days Found:", result.plans?.length || 0);

        assert.ok(result.reservation?.reservationId, "Should have detected a reservation ID");
        assert.ok(result.plans?.length >= 5, "Should have found a full itinerary (at least 5 days)");

        // Check if Day 1 is 4/23 (based on reservation 44079507 baseline)
        if (result.reservation.reservationId === "44079507") {
            const day1 = result.plans[0];
            console.log(`Day 1 Date Check: ${day1.date}`);
            assert.ok(day1.date.includes("April 23"), "Day 1 should be April 23 for this test case");
        }

    } catch (e) {
        console.error("\n❌ E2E Test FAILED:", e.message);
        throw e;
    }
}

if (require.main === module) {
    testGetMyPlansFlow().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
