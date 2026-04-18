const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');
const { SELECTORS } = require('./src/constants');

async function debugPhotoConfirm() {
    const reservationId = '44079507';
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/ONBOARDFUN/2026-04-23/?ship=DA&port=SIN`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'wdpr-activity-card', 60000);

    try {
        const card = page.locator('wdpr-activity-card').filter({ hasText: /Photo: Unlimited Package/i }).first();
        await card.waitFor({ state: 'visible' });
        
        console.log("1. Clicking Add button...");
        await card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first().click();
        
        console.log("2. Waiting for Guest selection...");
        await page.waitForSelector(SELECTORS.GUEST_CHECKBOX, { timeout: 10000 });
        const guests = page.locator(SELECTORS.GUEST_CHECKBOX);
        await guests.first().click(); // Select first guest
        
        console.log("3. Clicking Check Availability...");
        const checkBtn = page.locator('button').filter({ hasText: /Check Availability/i }).first();
        await checkBtn.click();
        
        console.log("4. Waiting for outcome (5s)...");
        await page.waitForTimeout(5000);
        
        await saveDebug(page, "photo_after_check_availability");
        
        const pageContent = await page.evaluate(() => {
            const cleanText = (t) => t.replace(/\s+/g, ' ').trim();
            const btns = Array.from(document.querySelectorAll('button, [role="button"], a.btn, li[role="option"]'));
            return {
                buttons: btns.map(b => cleanText(b.innerText)).filter(t => t.length > 0),
                allText: cleanText(document.body.innerText).substring(0, 1000)
            };
        });
        
        console.log("Page Content after Check Availability:");
        console.log(JSON.stringify(pageContent, null, 2));

    } catch (e) {
        console.error("Error:", e.message);
        await saveDebug(page, "photo_confirm_error");
    } finally {
        await browser.close();
    }
}

debugPhotoConfirm();
