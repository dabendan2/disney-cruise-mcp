/**
 * E2E Test: Fetch Japanese Steakhouse availability for 4 days.
 * This test uses real browser automation via CDP.
 */
const { getActivityDetails } = require('../src/automation/activities');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runE2EJapaneseSteakhouse() {
    console.log("🚀 Starting E2E: Japanese Steakhouse availability scan (4 Days)...");
    
    const reservationId = "44079507";
    const slug = "DINE";
    const activityName = "Japanese Steakhouse";
    const dates = [
        "2026-04-23", // Day 1
        "2026-04-24", // Day 2
        "2026-04-25", // Day 3
        "2026-04-26"  // Day 4
    ];

    const allResults = [];

    for (const date of dates) {
        console.log(`\n📅 Checking Date: ${date}...`);
        try {
            const result = await getActivityDetails(reservationId, slug, date, activityName);
            console.log(`✅ Result for ${date}:`, JSON.stringify(result, null, 2));
            allResults.push(result);
        } catch (e) {
            console.error(`❌ Error for ${date}:`, e.message);
            allResults.push({
                date,
                status: "ERROR",
                error: e.message
            });
        }
    }

    const reportPath = path.join(__dirname, 'res', 'e2e_results_japanese_steakhouse.json');
    fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2));
    
    console.log("\n==================================================");
    console.log(`🏁 E2E Scan Completed. Results saved to: ${reportPath}`);
    console.log("==================================================\n");
}

// Note: Ensure Chrome is running with --remote-debugging-port=9222 before running
if (require.main === module) {
    runE2EJapaneseSteakhouse().catch(err => {
        console.error("💥 E2E Fatal Error:", err);
        process.exit(1);
    });
}
