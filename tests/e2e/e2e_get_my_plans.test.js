const assert = require('assert');
const { getMyPlans } = require('../../src/index');
const { logTime } = require('../../src/utils/debug');

/**
 * E2E Test: get_my_plans_flow
 * Verifies the simplified "Auto-detect only" flow:
 * 1. Start at Reservations Dashboard.
 * 2. Auto-detect first available reservation card.
 * 3. Extract metadata (Stateroom, Title).
 * 4. Enter 'My Plans' via UI interaction.
 */
async function testGetMyPlansFlow() {
    console.log("🚀 Starting E2E Test: get_my_plans_flow (Simplified Auto-detect)...");
    
    // Call without parameters as simplified
    const result = await getMyPlans();
    
    console.log("\n--- Verification ---");
    
    // 1. Check Reservation Metadata
    assert.ok(result.reservation, "Result must contain reservation metadata");
    assert.ok(result.reservation.reservationId, "Must have reservationId");
    assert.ok(result.reservation.stateroom, "Must have stateroom number");
    console.log(`✅ Identified Reservation: ${result.reservation.reservationId}`);
    console.log(`✅ Identified Stateroom: ${result.reservation.stateroom}`);

    // 2. Check Plans
    assert.ok(Array.isArray(result.plans), "Result must contain an array of plans");
    assert.ok(result.plans.length > 0, "Should have at least one day in the plan");
    
    const day1 = result.plans[0];
    console.log(`✅ Found ${result.plans.length} days of itinerary.`);
    console.log(`✅ Day 1 Plan: ${day1.day} (${day1.date})`);

    // 3. Check Activities (if any booked)
    if (day1.activities.length > 0) {
        const act = day1.activities[0];
        assert.ok(act.title, "Activity must have a title");
        console.log(`✅ First Activity: ${act.title} at ${act.time}`);
    }

    console.log("\n🎊 E2E Test Passed: get_my_plans_flow");
}

if (require.main === module) {
    testGetMyPlansFlow().catch(err => {
        console.error("\n❌ E2E Test FAILED:", err.message);
        process.exit(1);
    });
}
