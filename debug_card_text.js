const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');
const { SELECTORS } = require('./src/constants');

async function debugCardText() {
    const reservationId = '44079507';
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/ONBOARDFUN/2026-04-23/?ship=DA&port=SIN`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'wdpr-activity-card', 60000);

    try {
        const card = page.locator('wdpr-activity-card').filter({ hasText: /Photo: Unlimited Package/i }).first();
        await card.waitFor({ state: 'visible' });
        
        await card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first().click();
        await page.waitForSelector(SELECTORS.GUEST_CHECKBOX, { timeout: 10000 });
        await page.locator(SELECTORS.GUEST_CHECKBOX).first().click(); 
        await page.locator('button').filter({ hasText: /Check Availability/i }).first().click();
        
        await page.waitForTimeout(5000);
        
        const text = await card.innerText();
        console.log("FULL_CARD_TEXT_START");
        console.log(text);
        console.log("FULL_CARD_TEXT_END");
        
        const hasKeyword = ["already booked", "another reservation", "not available for selection"].some(k => text.toLowerCase().includes(k));
        console.log(`Has conflict keyword: ${hasKeyword}`);

    } finally {
        await browser.close();
    }
}

debugCardText();
