require('dotenv').config();
const { getActivityDetails } = require('./src/automation/activities');
const fs = require('fs');
const path = require('path');

async function scrapeExpectedResults() {
    const reservationId = "44079507";
    const activityName = "Japanese steakhouse";
    const slug = "DINE";
    const dates = ["2026-04-24", "2026-04-25", "2026-04-26", "2026-04-27"];
    
    console.log(`🚀 Starting E2E Scrape for ${activityName} (${dates[0]} to ${dates[dates.length-1]})...`);
    
    const results = {};

    for (const date of dates) {
        try {
            console.log(`\n📅 Checking Date: ${date}...`);
            const data = await getActivityDetails(reservationId, slug, date, activityName);
            results[date] = data;
            console.log(`✅ Success for ${date}:`, JSON.stringify(data));
        } catch (e) {
            console.error(`❌ Error for ${date}:`, e.message);
            results[date] = { error: e.message };
        }
    }

    const outputPath = path.join(__dirname, 'tests', 'res', 'expected_japanese_steakhouse.json');
    if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to ${outputPath}`);
}

scrapeExpectedResults().catch(console.error);
