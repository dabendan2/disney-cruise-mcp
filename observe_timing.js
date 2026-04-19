const { getActivityDetails } = require('./src/automation/activities');
const { logTime, logFile } = require('./src/utils/debug');
const fs = require('fs');

async function run() {
    const start = logTime("Starting Manual Observation Run");
    try {
        const result = await getActivityDetails(
            "44079507", 
            "SPA", 
            "2026-04-23", 
            "60-Minute Fitness Appointment"
        );
        console.log("RESULT:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("ERROR:", e.message);
    }
    const end = logTime("Run Finished");
    
    console.log("\n--- TIMING LOG ---");
    try {
       const logs = fs.readFileSync(logFile, 'utf8');
       console.log(logs);
    } catch(err) {}
}

run();
