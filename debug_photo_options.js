const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');

async function debugPhotoDropdown() {
    const reservationId = '44079507';
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/ONBOARDFUN/2026-04-23/?ship=DA&port=SIN`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'wdpr-activity-card', 60000);

    try {
        const card = page.locator('wdpr-activity-card').filter({ hasText: /Photo: Unlimited Package/i }).first();
        await card.waitFor({ state: 'visible' });
        
        console.log("Clicking Add button...");
        await card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first().click();
        
        console.log("Waiting for Guest selection...");
        await page.waitForSelector('label.btn-checkbox-label', { timeout: 10000 });
        
        console.log("Clicking dropdown...");
        const dropdown = page.locator('button, [role="button"], .dropdown-toggle').filter({ hasText: /Select Time/i }).first();
        await dropdown.click();
        await page.waitForTimeout(5000);
        
        const options = await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('li[role="option"], .option-link, button, .time-slot, span'));
            return items.map(el => el.innerText.trim()).filter(t => t.length > 0);
        });
        
        console.log("Available Options in Dropdown:");
        console.log(JSON.stringify(options, null, 2));
        
        await saveDebug(page, "photo_dropdown_options");

    } catch (e) {
        console.error("Error:", e.message);
        await saveDebug(page, "photo_dropdown_error");
    } finally {
        await browser.close();
    }
}

debugPhotoDropdown();
