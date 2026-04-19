const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function captureDayScreenshot(reservationId, date) {
    const { browser, page } = await ensureCdpPage();
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    
    try {
        console.log(`🚀 Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("🔑 Clearing login obstacles...");
        await ensureLogin(page);
        
        const dateObj = new Date(date);
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        const dayNum = dateObj.getDate();
        const dateString = `${month} ${dayNum}`;
        
        console.log(`🔍 Searching for date: ${dateString}`);

        // Aggressive scroll to load all lazy-loaded days
        await page.evaluate(async () => {
            for (let i = 0; i < 8; i++) {
                window.scrollBy(0, 2000);
                await new Promise(r => setTimeout(r, 1500));
            }
        });

        // Find the day header
        const dayHeader = page.locator('h1, h2, h3, h4, .itinerary-day-header, .day-label').filter({ hasText: new RegExp(dateString, 'i') }).first();
        
        if (await dayHeader.isVisible()) {
            console.log(`✅ Found ${dateString}. Scrolling into view...`);
            await dayHeader.scrollIntoViewIfNeeded();
            await page.waitForTimeout(3000);
            
            const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `itinerary_final_${date}.png`);
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        } else {
            console.log("❌ Header not found. Capturing bottom of page.");
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
            const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `itinerary_bottom_${date}.png`);
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        }
    } finally {
        if (browser) await browser.close();
    }
}

const resId = "44079507";
const targetDate = "2026-04-27";

captureDayScreenshot(resId, targetDate).catch(console.error);
