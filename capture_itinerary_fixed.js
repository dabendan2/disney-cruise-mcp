const { navigateUrl } = require('./src/automation/navigation');
const { logTime } = require('./src/utils/debug');
const path = require('path');

async function captureDayScreenshot(reservationId, date) {
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    console.log(`🚀 Navigating to ${targetUrl}...`);
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'text=My Plans', 45000);
    
    try {
        const dateObj = new Date(date);
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        const dayNum = dateObj.getDate();
        const dateString = `${month} ${dayNum}`;
        
        console.log(`🔍 Searching for date: ${dateString}`);

        // Aggressive scroll to load all lazy-loaded days
        await page.evaluate(async () => {
            for (let i = 0; i < 5; i++) {
                window.scrollBy(0, 2000);
                await new Promise(r => setTimeout(r, 1000));
            }
        });

        // Specific selector for the date header in DCL "My Plans"
        const dayHeader = page.locator('.itinerary-day-header, .day-label, h3, h2').filter({ hasText: new RegExp(dateString, 'i') }).first();
        
        if (await dayHeader.isVisible()) {
            console.log(`✅ Found ${dateString}. Scrolling into view...`);
            await dayHeader.scrollIntoViewIfNeeded();
            
            // Wait for buttons to hydrate
            await page.waitForTimeout(3000);
            
            const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `itinerary_fixed_${date}.png`);
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        } else {
            console.error(`❌ Could not find header for ${dateString}. Taking full page fallback.`);
            const fallbackPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `itinerary_failed_scroll_${date}.png`);
            await page.screenshot({ path: fallbackPath, fullPage: true });
        }
    } finally {
        if (browser) await browser.close();
    }
}

const resId = "44079507";
const targetDate = "2026-04-27";

captureDayScreenshot(resId, targetDate).catch(console.error);
