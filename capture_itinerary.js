const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');
const path = require('path');

async function captureDayScreenshot(reservationId, date) {
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    console.log(`Navigating to ${targetUrl}...`);
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'text=Add Activities', 45000);
    
    try {
        const dateObj = new Date(date);
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        const dayNum = dateObj.getDate();
        const dateString = `${month} ${dayNum}`;
        
        console.log(`Searching for section: ${dateString}`);
        const daySection = page.locator('.itinerary-day, .day-container, section, .day-block, .daily-itinerary').filter({ hasText: dateString }).first();
        
        if (await daySection.isVisible()) {
            console.log("Found section. Scrolling into view...");
            await daySection.scrollIntoViewIfNeeded();
            await page.waitForTimeout(2000); // Settle
            
            const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `itinerary_${date}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            console.log(`Screenshot saved to: ${screenshotPath}`);
        } else {
            console.error(`Could not find section for ${dateString}`);
        }
    } finally {
        if (browser) await browser.close();
    }
}

const resId = "44079507";
const targetDate = "2026-04-27";

captureDayScreenshot(resId, targetDate).catch(console.error);
