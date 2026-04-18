const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');
const { SELECTORS } = require('./src/constants');
const fs = require('fs');
const path = require('path');

async function captureConflictSample() {
    const reservationId = '44079507';
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/ONBOARDFUN/2026-04-23/?ship=DA&port=SIN`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'wdpr-activity-card', 60000);

    try {
        const card = page.locator('wdpr-activity-card').filter({ hasText: /Photo: Unlimited Package/i }).first();
        await card.waitFor({ state: 'visible' });
        
        console.log("1. Opening selection area...");
        await card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first().click();
        
        console.log("2. Selecting Guest to trigger availability check...");
        await page.waitForSelector(SELECTORS.GUEST_CHECKBOX, { timeout: 10000 });
        await page.locator(SELECTORS.GUEST_CHECKBOX).first().click(); 
        
        console.log("3. Checking Availability...");
        await page.locator('button').filter({ hasText: /Check Availability/i }).first().click();
        
        console.log("4. Waiting for dropdown and warnings...");
        const dropdown = page.locator('button, [role="button"], .dropdown-toggle').filter({ hasText: /Select Time/i }).first();
        await dropdown.waitFor({ state: 'visible', timeout: 15000 });
        
        // Capture the card HTML which should contain the warning message
        const cardHtml = await card.evaluate(el => el.outerHTML);
        const resPath = path.join(__dirname, 'tests/res/booking_conflict_sample.html');
        fs.writeFileSync(resPath, cardHtml);
        console.log(`Saved sample to: ${resPath}`);
        
        // Also capture the warning text specifically
        const warningText = await page.evaluate(() => {
            const warningEl = document.querySelector('.warning-message, .error-message, [role="alert"], .warning-messaging-title, .activity-card-info');
            return warningEl ? warningEl.innerText.trim() : "NO_WARNING_FOUND";
        });
        console.log(`Detected Warning Text: "${warningText}"`);
        
        // Click dropdown to see if slot has specific title/attribute
        await dropdown.click();
        await page.waitForTimeout(2000);
        const slotHtml = await page.evaluate(() => {
            const slot = Array.from(document.querySelectorAll('li[role="option"], .option-link')).find(el => el.innerText.includes('8:00 AM'));
            return slot ? slot.outerHTML : "SLOT_NOT_FOUND";
        });
        console.log(`Slot HTML: ${slotHtml}`);

        await saveDebug(page, "conflict_analysis");

    } finally {
        await browser.close();
    }
}

captureConflictSample();
