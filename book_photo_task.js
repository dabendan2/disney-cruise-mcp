const { getMyPlans, addActivity } = require('./src/automation/activities');
const { logTime } = require('./src/utils/debug');

async function main() {
    try {
        console.log("Starting booking process for Unlimited Photo Package...");
        
        // 1. Get plans to auto-detect reservation ID
        const planResult = await getMyPlans();
        const reservationId = planResult.reservation.reservationId;
        console.log(`Detected Reservation ID: ${reservationId}`);
        
        // 2. Perform booking
        // Date: 2026-04-23 (Day 1)
        // Slug: ONBOARDFUN (Usually where photo packages are)
        // Activity: Photo: Unlimited Package
        // Slot: Voyage Length
        const result = await addActivity(
            reservationId,
            'ONBOARDFUN',
            '2026-04-23',
            'Photo: Unlimited Package',
            'Voyage Length'
        );
        
        console.log("RESULT_START");
        console.log(JSON.stringify(result, null, 2));
        console.log("RESULT_END");
        
    } catch (e) {
        console.error("CRITICAL_ERROR:", e.message);
        process.exit(1);
    }
}

main();
