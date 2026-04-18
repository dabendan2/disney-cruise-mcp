const { addActivity } = require('./src/automation/activities');

async function main() {
    try {
        const reservationId = '44079507';
        console.log(`Attempting booking for Unlimited Photo Package using '8:00 AM' slot...`);
        
        const result = await addActivity(
            reservationId,
            'ONBOARDFUN',
            '2026-04-23',
            'Photo: Unlimited Package',
            '8:00 AM'
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
