const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');

async function debugCheckBooking() {
    const reservationId = '44079507';
    // Navigate directly to My Plans to see what is already there
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'day-view', 60000);

    try {
        console.log("Waiting for Daily Plans to load...");
        await page.waitForSelector('day-view', { timeout: 45000 });
        
        // Wait for potential content to render
        await page.waitForTimeout(10000);
        
        // Take a screenshot of the first day
        const screenshotPath = await saveDebug(page, "VERIFY_ITINERARY_D1");
        console.log(`SCREENSHOT_PATH:${screenshotPath}`);
        
        const plans = await page.evaluate(() => {
            const days = Array.from(document.querySelectorAll('day-view'));
            return days.map(day => {
                const date = day.querySelector('.day-view-header p:not(.pepIcon)')?.innerText.trim();
                const activities = Array.from(day.querySelectorAll('activity-card')).map(card => ({
                    time: card.querySelector('.activity-card-time')?.innerText.trim(),
                    title: card.querySelector('.activity-card-title')?.innerText.trim()
                }));
                return { date, activities };
            });
        });
        
        console.log("PLANS_DATA_START");
        console.log(JSON.stringify(plans, null, 2));
        console.log("PLANS_DATA_END");

    } finally {
        await browser.close();
    }
}

debugCheckBooking();
