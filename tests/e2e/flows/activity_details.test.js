const assert = require('assert');
const { getActivityDetails } = require('../../../src/automation/activities');

/**
 * E2E Test: getActivityDetails (Japanese Steakhouse Regression)
 * Verifies that the tool correctly identifies slots for a known activity across 4 days.
 * Baseline captured on April 18, 2026.
 */
async function testActivityDetailsSteakhouse() {
    console.log("🚀 Starting E2E Test: getActivityDetails (Japanese Steakhouse)...");
    
    const reservationId = "44079507";
    const slug = "DINE";
    const testCases = [
        { date: "2026-04-23", expectedStatus: "Available", minSlots: 1 },
        { date: "2026-04-24", expectedStatus: "Available", minSlots: 1 },
        { date: "2026-04-25", expectedStatus: "Available", minSlots: 1 },
        { date: "2026-04-26", expectedStatus: "View More\nCheck Availability Onboard", minSlots: 0 }
    ];

    for (const tc of testCases) {
        console.log(`\n--- Testing Date: ${tc.date} ---`);
        try {
            const result = await getActivityDetails(reservationId, slug, tc.date, "Japanese Steakhouse");
            
            console.log(`Status: ${result.status}`);
            console.log(`Slots Found: ${result.times?.length || 0}`);

            // Validation
            if (tc.expectedStatus === "Available") {
                assert.ok(result.status === "Available" || result.status === "No Slots", `Date ${tc.date} should be Available or No Slots. Got: ${result.status}`);
                if (result.status === "Available") {
                    assert.ok(result.times.length >= tc.minSlots, `Date ${tc.date} should have at least ${tc.minSlots} slots`);
                }
                console.log(`✅ Date ${tc.date} verified status: ${result.status}`);
            } else {
                // For 04-26, it's restricted/onboard
                assert.ok(result.status.includes("Onboard") || result.status.includes("View More"), 
                    `Date ${tc.date} should indicate onboard availability. Got: ${result.status}`);
                console.log(`✅ Date ${tc.date} correctly identified as Onboard/Restricted.`);
            }
        } catch (e) {
            console.error(`❌ Date ${tc.date} FAILED:`, e.message);
            throw e;
        }
    }

    console.log("\n🎊 E2E Test Passed: getActivityDetails (Japanese Steakhouse Regression)");
}

if (require.main === module) {
    testActivityDetailsSteakhouse().catch(err => {
        console.error("\n❌ E2E Test FAILED:", err.message);
        process.exit(1);
    });
}
