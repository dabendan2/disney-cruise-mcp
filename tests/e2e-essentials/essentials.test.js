require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const assert = require('assert');
const { getMyPlans, getBookableActivityTypes, getActivityDetails, addActivity } = require('../../src/automation/activities');

/**
 * Helper to convert DCL Date String (e.g., "April 23, 2026") to YYYY-MM-DD
 */
function parseDclDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function testPhotoPackage(resId, dates) {
    const photoSlug = "ONBOARDFUN";
    const photoName = "Photo: Unlimited Package";
    console.log(`Checking Day 1 (${dates.day1})...`);
    const photoDay1 = await getActivityDetails(resId, photoSlug, dates.day1, photoName);
    assert(photoDay1.timeSlots.length >= 1, `Day 1 should have at least 1 slot/entry for ${photoName}`);

    console.log(`Checking Day 2 (${dates.day2})...`);
    const photoDay2 = await getActivityDetails(resId, photoSlug, dates.day2, photoName);
    assert.strictEqual(photoDay2.timeSlots.length, 0, `Day 2 should have 0 time slots for ${photoName}`);
}

async function testActivityAvailability(resId, dates) {
    console.log(`Checking Day 1 (${dates.day1})...`);
    const day1Types = await getBookableActivityTypes(resId, dates.day1);
    const hasAvailable = day1Types.activities.some(a => a.status === "Available");
    assert(hasAvailable, "Day 1 should have at least one 'Available' activity type");

    console.log(`Checking Last Day (${dates.lastDay})...`);
    const lastDayTypes = await getBookableActivityTypes(resId, dates.lastDay);
    const allUnavailable = lastDayTypes.activities.every(a => a.status === "Unavailable");
    assert(allUnavailable, "Last day activity types should all be 'Unavailable'");
}

async function testPlansIntegrity(resId, plans) {
    const firstDayPlans = plans[0];
    const finalDayPlans = plans[plans.length - 1];
    const hasEmbarkation = firstDayPlans.activities.some(a => 
        a.title.toLowerCase().includes('embarkation') || a.title.toLowerCase().includes('welcome')
    );
    const isLastDayEmpty = finalDayPlans.activities.length === 0;
    assert(hasEmbarkation, "Day 1 must contain an Embarkation/Welcome event");
    assert(isLastDayEmpty, "Last day activities must be an empty list");
}

async function testFitnessSlots(resId, dates) {
    const fitnessSlug = "SPAANDFITNESS";
    const fitnessName = "60-Minute Fitness Appointment";
    console.log(`Checking Fitness Slots on Second-to-last Day (${dates.secondLastDay})...`);
    const fitnessDetails = await getActivityDetails(resId, fitnessSlug, dates.secondLastDay, fitnessName);
    console.log(`- Fitness Slots Found: ${fitnessDetails.timeSlots.length}`);
    assert(fitnessDetails.timeSlots.length > 0, `Second-to-last day should have fitness slots`);
    return fitnessDetails.timeSlots; // Return for Test 5
}

async function testFitnessBookingFailure(resId, dates, expectedAvailableSlots) {
    const fitnessSlug = "SPAANDFITNESS";
    const fitnessName = "60-Minute Fitness Appointment";
    const invalidTime = "11:00 PM";
    let firstGuestName = null;

    // STEP 1: Expect failure due to missing guestName (Radio UI)
    console.log(`Step 1: Attempting book without guestName (Expect STRICT FAIL)...`);
    try {
        await addActivity(resId, fitnessSlug, dates.secondLastDay, fitnessName, invalidTime);
        throw new Error("Should have failed due to missing guestName");
    } catch (err) {
        console.log(`- Caught Expected Error: ${err.message}`);
        assert(err.message.includes("Radio button UI detected"), "Error should mention Radio UI");
        
        const guestMatch = err.message.match(/Available guests: \[(.*?)\]/);
        assert(guestMatch, "Error should list available guests");
        const guests = guestMatch[1].split(',').map(s => s.trim());
        firstGuestName = guests[0];
        console.log(`- Extracted first available guest: ${firstGuestName}`);
    }

    // STEP 2: Use the first guest name and expect failure due to unavailable time
    console.log(`Step 2: Attempting book with guest ${firstGuestName} at ${invalidTime}...`);
    try {
        await addActivity(resId, fitnessSlug, dates.secondLastDay, fitnessName, invalidTime, firstGuestName);
        throw new Error("Should have failed due to invalid time");
    } catch (err) {
        console.log(`- Caught Expected Error: ${err.message}`);
        assert(err.message.includes("is currently unavailable"), "Error should indicate slot unavailable");
        
        const slotMatch = err.message.match(/Available slots: \[(.*?)\]/);
        assert(slotMatch, "Error should suggest available slots");
        const suggestedSlots = slotMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        console.log(`- Suggested: [${suggestedSlots.join(', ')}]`);
        console.log(`- Expected from Test 4: [${expectedAvailableSlots.join(', ')}]`);
        
        assert.deepStrictEqual(suggestedSlots.sort(), expectedAvailableSlots.sort(), "Suggested slots must match Test 4 results");
        console.log("✅ Multi-step booking failure logic verified.");
    }
}

async function runEssentials() {
    console.log("==================================================");
    console.log("🚀 Starting E2E Essentials Tests (Dynamic Mode)");
    console.log("⏱️  Estimated Total Duration: 300-360 seconds");
    console.log("==================================================");
    
    const results = [];
    let sharedData = null;
    let detectedFitnessSlots = [];

    try {
        console.log("\n[PHASE 0] Fetching Reservation & Itinerary...");
        const plansResult = await getMyPlans();
        const resId = plansResult.reservation?.reservationId;
        const plans = plansResult.plans;
        assert(resId && plans.length > 3);
        sharedData = {
            resId, plans,
            dates: {
                day1: parseDclDate(plans[0].date),
                day2: parseDclDate(plans[1].date),
                secondLastDay: parseDclDate(plans[plans.length - 2].date),
                lastDay: parseDclDate(plans[plans.length - 1].date)
            }
        };
        results.push({ name: "PHASE 0: Data Fetch", status: "PASSED" });
    } catch (err) {
        results.push({ name: "PHASE 0: Data Fetch", status: "FAILED", error: err.message });
    }

    const testSuites = [
        { name: "TEST 1: Photo Check", fn: () => testPhotoPackage(sharedData.resId, sharedData.dates) },
        { name: "TEST 2: Activity Availability", fn: () => testActivityAvailability(sharedData.resId, sharedData.dates) },
        { name: "TEST 3: Plans Integrity", fn: () => testPlansIntegrity(sharedData.resId, sharedData.plans) },
        { name: "TEST 4: Fitness Slots (2nd Last)", fn: async () => { detectedFitnessSlots = await testFitnessSlots(sharedData.resId, sharedData.dates); } },
        { name: "TEST 5: Fitness Booking Error Flow", fn: () => testFitnessBookingFailure(sharedData.resId, sharedData.dates, detectedFitnessSlots) }
    ];

    for (const suite of testSuites) {
        console.log(`\n[${suite.name}] Starting...`);
        if (!sharedData) { results.push({ name: suite.name, status: "SKIPPED" }); continue; }
        try {
            await suite.fn();
            results.push({ name: suite.name, status: "PASSED" });
        } catch (err) {
            results.push({ name: suite.name, status: "FAILED", error: err.message });
        }
    }

    console.log("\n==================================================");
    console.log("📊 E2E ESSENTIALS SUMMARY");
    console.log("==================================================");
    let allPassed = true;
    results.forEach(r => {
        console.log(`${r.status === "PASSED" ? "✅" : "❌"} ${r.name}: ${r.status}`);
        if (r.status === "FAILED") { allPassed = false; console.log(`   └ Error: ${r.error}`); }
    });
    console.log("==================================================");
    if (!allPassed) process.exit(1);
}

if (require.main === module) runEssentials();
