const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { SELECTORS, PATHS } = require('../constants');
const { 
    isBookingConflict, 
    getTargetGuestCount 
} = require('../utils/ui_logic');

/**
 * Fetch specific activity details (availability and time slots).
 */
async function getActivityDetails(reservationId, slug, date, activityName) {
    const start = logTime(`=== TASK START: ${activityName} on ${date} ===`);
    const targetUrl = PATHS.ACTIVITY_CATALOG(reservationId, slug, date);
    
    const navResult = await navigateUrl(targetUrl, reservationId, null);
    const { browser, page } = navResult;
    
    try {
        logTime("Phase: Optimized Scan for Activity Card...");
        const card = page.locator(SELECTORS.ACTIVITY_CARD).filter({ hasText: new RegExp(activityName, "i") }).first();
        
        let found = await card.isVisible().catch(() => false);
        if (!found) {
            for (let i = 0; i < 6; i++) {
                await page.evaluate(() => window.scrollBy(0, 1500));
                await new Promise(r => setTimeout(r, 1500));
                if (await card.count() > 0 && await card.isVisible().catch(() => false)) {
                    found = true;
                    break;
                }
            }
        }

        if (!found) throw new Error(`STRICT FAIL: Activity '${activityName}' not found.`);

        await card.scrollIntoViewIfNeeded();
        const cardText = await card.innerText();
        const btn = card.locator(SELECTORS.SELECT_ADD_BUTTON).filter({ hasText: /Select|Add/i }).first();

        if (!(await btn.isVisible())) {
            const statusText = await card.locator('.activityCardColRight, .activity-card-button-container').innerText().catch(() => "Not Available");
            return { activityName, date, status: statusText.trim(), timing: { total_sec: (Date.now() - start)/1000 } };
        }

        await btn.click();
        
        const modalOrSlot = await Promise.race([
            page.waitForSelector('.book-activity-drawer, .participants-list', { timeout: 35000 }).then(() => 'modal'),
            page.waitForSelector('button:has-text("Check Availability")', { timeout: 35000 }).then(() => 'check'),
            page.waitForSelector('li[role="option"]', { timeout: 35000 }).then(() => 'slots')
        ]).catch(() => 'timeout');

        if (modalOrSlot === 'timeout') throw new Error("Interaction timeout after clicking Select.");

        if (modalOrSlot === 'modal' || modalOrSlot === 'check') {
            logTime("Handling guest selection...");
            const participants = page.locator('li.participant, label.btn-checkbox-label');
            const count = await participants.count();
            const toSelect = getTargetGuestCount(cardText, count);

            for (let i = 0; i < toSelect; i++) { 
                const p = participants.nth(i);
                await p.scrollIntoViewIfNeeded();
                const tagName = await p.evaluate(el => el.tagName.toLowerCase());
                const clickTarget = (tagName === 'label') ? p : p.locator('label, wdpr-radio-button').first();
                await clickTarget.click({ force: true }); 
                await new Promise(r => setTimeout(r, 1000)); 
            }
            
            const checkBtn = page.locator('button').filter({ hasText: /Check Availability/i }).first();
            await checkBtn.click({ force: true });
        }

        const timeDropdown = page.locator('button, [role="button"]').filter({ hasText: /Select (a )?Time/i }).first();
        if (await timeDropdown.isVisible().catch(() => false)) {
            await timeDropdown.click();
            await new Promise(r => setTimeout(r, 3000));
        }

        let times = [];
        for (let i = 0; i < 10; i++) {
            times = await page.evaluate(() => {
                const p = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM)$/i;
                const voyageRegex = /Voyage Length/i;
                const elements = Array.from(document.querySelectorAll('li[role="option"], button, span, .time-slot'));
                const found = elements.map(e => e.innerText.trim()).filter(t => p.test(t) || voyageRegex.test(t));
                return [...new Set(found)];
            });
            if (times.length > 0) break;
            await new Promise(r => setTimeout(r, 3000));
        }

        if (times.length === 0) await saveDebug(page, "no_slots_found", true);
        
        return { 
            activityName, 
            date, 
            status: times.length > 0 ? "Available" : "No Slots", 
            times, 
            timing: { total_sec: (Date.now() - start)/1000 } 
        };

    } catch (e) {
        const path = await saveDebug(page, "task_error");
        throw new Error(`STRICT FAIL: ${e.message}. Evidence: ${path}`);
    } finally { 
        if (browser) await browser.close(); 
    }
}

/**
 * Add an activity to the itinerary (booking flow).
 */
async function addActivity(reservationId, slug, date, activityName, timeSlot) {
    const { browser, page } = await navigateUrl(PATHS.ACTIVITY_CATALOG(reservationId, slug, date), reservationId, null);
    try {
        const card = page.locator(SELECTORS.ACTIVITY_CARD).filter({ hasText: new RegExp(activityName, "i") }).first();
        await card.waitFor({ state: 'visible', timeout: 15000 });
        const cardText = await card.innerText();
        await card.locator(SELECTORS.SELECT_ADD_BUTTON).filter({ hasText: /Select|Add/i }).first().click();
        
        const participants = page.locator('li.participant, label.btn-checkbox-label');
        const toSelect = getTargetGuestCount(cardText, await participants.count());

        for (let i = 0; i < toSelect; i++) {
            const p = participants.nth(i);
            const tagName = await p.evaluate(el => el.tagName.toLowerCase());
            const clickTarget = (tagName === 'label') ? p : p.locator('label, wdpr-radio-button').first();
            await clickTarget.click({ force: true });
        }
        await page.locator('button').filter({ hasText: /Check Availability/i }).first().click();
        await page.waitForTimeout(4000);
        
        const dropdown = page.locator('button, [role="button"]').filter({ hasText: /Select Time/i }).first();
        if (await dropdown.isVisible().catch(() => false)) await dropdown.click();
        
        const slot = page.locator('li[role="option"], .time-slot').filter({ hasText: new RegExp("^" + timeSlot + "$", "i") }).first();
        await slot.click({ force: true });
        
        const saveBtn = card.locator(SELECTORS.SAVE_BUTTON).filter({ hasText: /Save/i }).first();
        await saveBtn.click({ force: true });
        
        await page.waitForTimeout(6000);
        return { activityName, timeSlot, status: "SUCCESS", evidence: await saveDebug(page, "booking_done") };
    } finally { if (browser) await browser.close(); }
}

module.exports = { getActivityDetails, addActivity };
