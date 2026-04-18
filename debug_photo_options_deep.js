const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');
const { SELECTORS } = require('./src/constants');

async function debugPhotoOptionsDeep() {
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
        
        await page.waitForTimeout(3000);
        
        console.log("Opening dropdown...");
        const dropdown = page.locator('button, [role="button"], .dropdown-toggle').filter({ hasText: /Select Time/i }).first();
        await dropdown.click();
        
        await page.waitForTimeout(3000);
        
        const deepOptions = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('*'));
            return allElements
                .filter(el => el.innerText && el.innerText.length > 0 && el.innerText.length < 100)
                .map(el => ({
                    tag: el.tagName,
                    text: el.innerText.trim(),
                    className: el.className,
                    role: el.getAttribute('role')
                }))
                .filter(item => item.text.includes('Voyage') || item.text.includes('Length') || item.role === 'option');
        });
        
        console.log("Deep Options matching 'Voyage' or 'Length' or role='option':");
        console.log(JSON.stringify(deepOptions, null, 2));
        
        await saveDebug(page, "photo_deep_options");

    } finally {
        await browser.close();
    }
}

debugPhotoOptionsDeep();
