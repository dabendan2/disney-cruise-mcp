const { getActivityList } = require('../../src/index');
const assert = require('assert');

async function testDay1OnboardFunActivities() {
    const reservationId = "44079507";
    const slug = "ONBOARDFUN";
    const date = "2026-04-23";
    
    // The exact list of 8 activities expected based on previous successful extraction
    const expectedActivities = [
        "Photo: Unlimited Package",
        "Champagne Tasting (18+)",
        "Cognac Tasting (18+)",
        "Lumiere Karaoke Room",
        "Prima notte at Palo (18+)",
        "Sebastian Karaoke Room",
        "Signature Private Photo Session",
        "The Muses Karaoke Room"
    ].sort();

    console.log(`🚀 Starting E2E Test: Verifying Day 1 Onboard Fun Activities for ${date}...`);

    try {
        const result = await getActivityList(reservationId, slug, date);
        const actualActivities = result.activities.map(a => a.title).sort();

        console.log("\n📊 Actual Activities Found:");
        actualActivities.forEach((name, i) => console.log(`${i + 1}. ${name}`));

        // 1. Verify Count
        assert.strictEqual(actualActivities.length, 8, `Expected exactly 8 activities, but found ${actualActivities.length}`);
        console.log("\n✅ Count Verification: Found exactly 8 activities.");

        // 2. Verify Names
        assert.deepStrictEqual(actualActivities, expectedActivities, "Activity names do not match the expected list.");
        console.log("✅ Name Verification: All activity names match perfectly.");

        console.log("\n🎊 E2E Test Passed: Day 1 Onboard Fun matches expectations (8 items, correct names).");
    } catch (e) {
        console.error("\n💀 E2E Test FAILED:", e.message);
        process.exit(1);
    }
}

async function testPhotoPackageExclusivity() {
    const reservationId = "44079507";
    const slug = "ONBOARDFUN";
    const dates = ['2026-04-24', '2026-04-25', '2026-04-26'];
    const targetActivity = "Photo: Unlimited Package";

    console.log(`\n🚀 Starting E2E Test: Verifying '${targetActivity}' is NOT present on other days...`);

    for (const date of dates) {
        try {
            const result = await getActivityList(reservationId, slug, date);
            const found = result.activities.some(a => a.title.includes(targetActivity));
            assert.strictEqual(found, false, `Expected '${targetActivity}' NOT to be found on ${date}`);
            console.log(`✅ Verified: '${targetActivity}' is absent on ${date}.`);
        } catch (e) {
            console.error(`⚠️ Error checking ${date}: ${e.message}`);
            process.exit(1);
        }
    }
}

(async () => {
    await testDay1OnboardFunActivities();
    await testPhotoPackageExclusivity();
    console.log("\n✨ ALL E2E VERIFICATIONS COMPLETE.");
})();
