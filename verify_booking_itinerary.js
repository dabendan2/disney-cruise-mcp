const { getMyPlans } = require('./src/automation/activities');
const { saveDebug } = require('./src/utils/debug');

async function verifyBooking() {
    try {
        console.log("Fetching My Plans to verify booking...");
        const result = await getMyPlans();
        
        // Find the Photo Unlimited Package in the plans
        const photoPlan = result.plans.flatMap(d => d.activities).find(a => a.title.includes("Photo: Unlimited Package"));
        
        console.log("VERIFICATION_RESULT:");
        console.log(JSON.stringify(photoPlan || { error: "Photo Package not found in plans" }, null, 2));
        
    } catch (e) {
        console.error("Verification failed:", e.message);
    }
}

verifyBooking();
