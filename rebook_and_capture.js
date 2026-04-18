const { addActivity } = require('./src/automation/activities');
const { saveDebug } = require('./src/utils/debug');

async function retryAndCapture() {
    const reservationId = '44079507';
    console.log(`Re-running booking for Photo: Unlimited Package to get proper screenshot...`);
    
    // Explicitly using addActivity which handles the entire flow
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
}

retryAndCapture();
