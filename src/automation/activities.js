const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { SELECTORS } = require('../constants');

async function getActivityDetails(reservationId, slug, date, activityName) {
    const start = logTime(`=== TASK START: ${activityName} on ${date} ===`);
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/${slug}/${date}/?ship=DA&port=SIN`;
    
    const navResult = await navigateUrl(targetUrl, reservationId, SELECTORS.ACTIVITY_CARD);
    const { browser, page } = navResult;
    try {
        logTime("Phase: Scan Activity Card...");
        const card = page.locator(SELECTORS.ACTIVITY_CARD).filter({ hasText: new RegExp(activityName, "i") }).first();
        
        if (!(await card.count())) {
            for (let i = 0; i < 8; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await new Promise(r => setTimeout(r, 4500));
                if (await card.isVisible().catch(() => false)) break;
            }
        }

        if (!(await card.count())) {
            const path = await saveDebug(page, "activity_not_found");
            throw new Error(`STRICT FAIL: Activity '${activityName}' not found after 8 scrolls. Evidence: ${path}`);
        }

        await card.scrollIntoViewIfNeeded();
        const cardText = await card.innerText();
        
        if (cardText.includes("Onboard") || cardText.includes("Sold Out")) {
            return { activityName, date, status: cardText.includes("Sold Out") ? "Sold Out" : "Onboard Only", timing: { total_sec: (Date.now() - start)/1000 } };
        }

        const btn = card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first();
        if (!(await btn.isVisible())) {
            const path = await saveDebug(page, "button_invisible");
            throw new Error(`STRICT FAIL: Found card but Select/Add button is invisible. Evidence: ${path}`);
        }

        await btn.click();
        await page.waitForSelector(SELECTORS.GUEST_CHECKBOX, { timeout: 35000 }).catch(async () => {
            const path = await saveDebug(page, "guest_modal_timeout");
            throw new Error(`STRICT FAIL: Guest selection modal timeout (35s). Evidence: ${path}`);
        });

        const guests = page.locator(SELECTORS.GUEST_CHECKBOX);
        for (let i = 0; i < await guests.count(); i++) { 
            await guests.nth(i).scrollIntoViewIfNeeded();
            await guests.nth(i).click(); 
            await new Promise(r => setTimeout(r, 1200)); 
        }
        
        const checkedCount = await page.locator('input:checked, .active').count();
        if (checkedCount === 0) {
            const path = await saveDebug(page, "selection_sync_fail");
            throw new Error(`STRICT FAIL: Guest selection state sync failed (0 checked). Evidence: ${path}`);
        }

        const checkBtn = page.locator('button').filter({ hasText: /Check Availability/i }).first();
        await checkBtn.evaluate(el => el.removeAttribute('disabled'));
        await checkBtn.click();

        const timeDropdown = page.locator('button, [role="button"]').filter({ hasText: /Select (a )?Time/i }).first();
        if (await timeDropdown.isVisible().catch(() => false)) {
            logTime("Hydrating dining times...");
            await timeDropdown.click();
            await new Promise(r => setTimeout(r, 4000));
        }

        let times = [];
        for (let i = 0; i < 15; i++) {
            times = await page.evaluate(() => {
                const p = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM)$/i;
                return [...new Set(Array.from(document.querySelectorAll('li[role="option"], button, span')).map(e => e.innerText.trim()).filter(t => p.test(t)))];
            });
            if (times.length > 0) break;
            await new Promise(r => setTimeout(r, 4500));
        }

        const end = logTime(`=== TASK COMPLETE. Found ${times.length} slots ===`);
        return { activityName, date, status: times.length > 0 ? "Available" : "No Slots", times, timing: { total_sec: (end - start)/1000 } };
    } catch (e) {
        if (!e.message.includes("STRICT FAIL")) {
            const path = await saveDebug(page, "unhandled_task_error");
            throw new Error(`STRICT FAIL: Unhandled error in getActivityDetails: ${e.message}. Evidence: ${path}`);
        }
        throw e;
    } finally { if (browser) await browser.close(); }
}

module.exports = { getActivityDetails };
