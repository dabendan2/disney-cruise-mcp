const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');
const { SELECTORS } = require('./src/constants');

async function debugFinalConfirmation() {
    const reservationId = '44079507';
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/ONBOARDFUN/2026-04-23/?ship=DA&port=SIN`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'wdpr-activity-card', 60000);

    try {
        const card = page.locator('wdpr-activity-card').filter({ hasText: /Photo: Unlimited Package/i }).first();
        await card.waitFor({ state: 'visible' });
        
        console.log("1. Add Activity...");
        await card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first().click();
        
        console.log("2. Selecting Guest...");
        await page.waitForSelector(SELECTORS.GUEST_CHECKBOX, { timeout: 10000 });
        await page.locator(SELECTORS.GUEST_CHECKBOX).first().click(); 
        
        console.log("3. Check Availability...");
        await page.locator('button').filter({ hasText: /Check Availability/i }).first().click();
        
        console.log("4. Opening Time Dropdown...");
        const dropdown = page.locator('button, [role="button"], .dropdown-toggle').filter({ hasText: /Select Time/i }).first();
        await dropdown.waitFor({ state: 'visible', timeout: 10000 });
        await dropdown.click();
        
        console.log("5. Selecting 8:00 AM...");
        const slot = page.locator('li[role="option"], .option-link').filter({ hasText: /^8:00 AM$/i }).first();
        await slot.waitFor({ state: 'visible', timeout: 5000 });
        await slot.click();
        
        console.log("6. Clicking SAVE...");
        const saveBtn = page.locator('button, .cta-button').filter({ hasText: /^Save$/i }).first();
        await saveBtn.click();
        
        console.log("7. Waiting 10s for rendering...");
        await page.waitForTimeout(10000);
        
        const screenshotPath = await saveDebug(page, "FINAL_BOOKING_SCREENSHOT");
        console.log(`SCREENSHOT_PATH:${screenshotPath}`);

    } finally {
        await browser.close();
    }
}

debugFinalConfirmation();
