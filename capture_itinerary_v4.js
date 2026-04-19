const { navigateUrl } = require('./src/automation/navigation');
const { logTime } = require('./src/utils/debug');
const path = require('path');

async function captureDayScreenshotFixed(reservationId, date) {
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    console.log(`🚀 Navigating to ${targetUrl}...`);
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'text=My Plans', 45000);
    
    try {
        const dateObj = new Date(date);
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        const dayNum = dateObj.getDate();
        const dateString = `${month} ${dayNum}`;
        
        console.log(`🔍 Searching for section header containing: ${dateString}`);

        // Strategy: Scroll slowly until the text is found
        let found = false;
        for (let i = 0; i < 15; i++) {
            const header = page.locator('h1, h2, h3, h4, span, div').filter({ hasText: new RegExp(dateString, 'i') }).first();
            if (await header.isVisible()) {
                console.log(`✅ Found header for ${dateString}. Scrolling into view...`);
                await header.scrollIntoViewIfNeeded();
                found = true;
                break;
            }
            await page.evaluate(() => window.scrollBy(0, 800));
            await page.waitForTimeout(1000);
        }

        if (found) {
            // Find the Add Activities button in THIS specific day block
            const dayBlock = page.locator('.itinerary-day, .day-container, section, .day-block, .daily-itinerary').filter({ hasText: dateString }).first();
            const addBtn = dayBlock.locator('button, a, [role="button"]').filter({ hasText: /Add Activities/i }).first();
            
            if (await addBtn.isVisible()) {
                console.log("🖱️ Found button. Clicking to show menu...");
                await addBtn.click();
                await page.waitForTimeout(3000); // Wait for popup/menu
                
                const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `itinerary_427_menu.png`);
                await page.screenshot({ path: screenshotPath });
                console.log(`📸 Screenshot with menu saved to: ${screenshotPath}`);
            } else {
                console.log("❌ Could not find 'Add Activities' button in the block.");
                const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `itinerary_427_nobutton.png`);
                await page.screenshot({ path: screenshotPath });
            }
        } else {
            console.error(`❌ Still could not find header for ${dateString} after slow scroll.`);
        }
    } finally {
        if (browser) await browser.close();
    }
}

const resId = "44079507";
const targetDate = "2026-04-27";

captureDayScreenshotFixed(resId, targetDate).catch(console.error);
