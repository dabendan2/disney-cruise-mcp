
const { getActivityDetails } = require('./src/automation/activities');

async function main() {
    const reservationId = "44079507";
    const slug = "DINE";
    const dates = ["2026-04-23", "2026-04-24", "2026-04-25", "2026-04-26"];
    
    console.log("Searching for Japanese Steakhouse slots...");
    
    for (const date of dates) {
        process.stdout.write(`Checking ${date}... `);
        try {
            const result = await getActivityDetails(reservationId, slug, date, "Japanese Steakhouse");
            if (result.status === "Available" && result.times) {
                console.log(`✅ ${result.times.join(", ")}`);
            } else {
                console.log(`❌ ${result.status}`);
            }
        } catch (e) {
            console.log(`🔥 Error: ${e.message}`);
        }
    }
}

main().catch(console.error);
