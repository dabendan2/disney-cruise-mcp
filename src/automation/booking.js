const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { SELECTORS } = require('../constants');
const { 
    isBookingConflict, 
    getTargetGuestCount 
} = require('../utils/ui_logic');

/**
 * Fetch specific activity details (availability and time slots).
 */
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

        const btn = card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first();
        const isBtnVisible = await btn.isVisible();

        if (!isBtnVisible) {
            const statusText = await card.locator('.activityCardColRight, .activity-card-button-container').innerText();
            return { 
                activityName, 
                date, 
                status: statusText.trim() || "Not Available (No Button)", 
                timing: { total_sec: (Date.now() - start)/1000 } 
            };
        }

        await btn.click();
        
        const modalOrSlot = await Promise.race([
            page.waitForSelector(SELECTORS.GUEST_CHECKBOX, { timeout: 35000 }).then(() => 'modal'),
            page.waitForSelector('button:has-text("Check Availability")', { timeout: 35000 }).then(() => 'check'),
            page.waitForSelector('li[role="option"]', { timeout: 10000 }).then(() => 'slots')
        ]).catch(() => 'timeout');

        if (modalOrSlot === 'timeout') {
            const path = await saveDebug(page, "interaction_timeout");
            throw new Error(`STRICT FAIL: Interaction timeout after clicking button. Evidence: ${path}`);
        }

        if (modalOrSlot === 'modal') {
            const guests = page.locator(SELECTORS.GUEST_CHECKBOX);
            const count = await guests.count();
            const toSelect = getTargetGuestCount(cardText, count);

            for (let i = 0; i < toSelect; i++) { 
                await guests.nth(i).scrollIntoViewIfNeeded();
                await guests.nth(i).click(); 
                await new Promise(r => setTimeout(r, 1200)); 
            }
            
            const checkBtn = page.locator('button').filter({ hasText: /Check Availability/i }).first();
            await checkBtn.evaluate(el => el.removeAttribute('disabled'));
            await checkBtn.click();
        }

        const timeDropdown = page.locator('button, [role="button"]').filter({ hasText: /Select (a )?Time/i }).first();
        if (await timeDropdown.isVisible().catch(() => false)) {
            logTime("Hydrating slots via dropdown...");
            await timeDropdown.click();
            await new Promise(r => setTimeout(r, 4000));
        }

        let times = [];
        for (let i = 0; i < 15; i++) {
            times = await page.evaluate(() => {
                const p = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM)$/i;
                const voyageRegex = /Voyage Length/i;
                const elements = Array.from(document.querySelectorAll('li[role="option"], button, span, .time-slot'));
                const found = elements.map(e => e.innerText.trim()).filter(t => p.test(t) || voyageRegex.test(t));
                return [...new Set(found)];
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

/**
 * Add an activity to the itinerary (booking flow).
 */
async function addActivity(reservationId, slug, date, activityName, timeSlot) {
    const start = Date.now();
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/${slug}/${date}/?ship=DA&port=SIN`;
    
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'wdpr-activity-card', 45000);
    
    try {
        logTime(`[ADD_ACTIVITY] Starting for: ${activityName} at ${timeSlot}`);

        const card = page.locator('wdpr-activity-card').filter({ hasText: new RegExp(activityName, "i") }).first();
        await card.waitFor({ state: 'visible', timeout: 15000 });
        
        const cardText = await card.innerText();
        
        const selectBtn = card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first();
        await selectBtn.click();
        
        await page.waitForSelector('label.btn-checkbox-label', { timeout: 10000 });
        const guests = page.locator('label.btn-checkbox-label');
        const count = await guests.count();
        const toSelect = getTargetGuestCount(cardText, count);

        for (let i = 0; i < toSelect; i++) {
            await guests.nth(i).click();
        }
        await page.locator('button').filter({ hasText: /Check Availability/i }).first().click();
        
        await page.waitForTimeout(6000);
        const postCheckText = await card.innerText();
        if (isBookingConflict(postCheckText)) {
            return {
                activityName,
                timeSlot,
                status: "ALREADY_BOOKED",
                message: "Activity is already booked or has a conflict.",
                evidence: await saveDebug(page, "already_booked_immediate"),
                timing: { total_sec: (Date.now() - start)/1000 }
            };
        }
        
        const dropdown = page.locator('button, [role="button"], .dropdown-toggle').filter({ hasText: /Select Time/i }).first();
        if (await dropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
            await dropdown.click().catch(async () => {
                await dropdown.evaluate(el => el.click());
            });
            await page.waitForTimeout(3000); 
        }
        
        const slot = page.locator('li[role="option"], .option-link, button, .time-slot').filter({ hasText: new RegExp("^" + timeSlot + "$", "i") }).first();
        try {
            await slot.waitFor({ state: 'visible', timeout: 8000 });
            
            const isDisabled = await slot.evaluate(el => 
                el.getAttribute('aria-disabled') === 'true' || 
                el.hasAttribute('disabled') || 
                el.classList.contains('disabled')
            );
            
            if (isDisabled) {
                const cardText = await card.innerText();
                if (isBookingConflict(cardText)) {
                    return {
                        activityName,
                        timeSlot,
                        status: "ALREADY_BOOKED",
                        message: "Slot is disabled. Page indicates a conflict or existing reservation.",
                        evidence: await saveDebug(page, "already_booked_conflict"),
                        timing: { total_sec: (Date.now() - start)/1000 }
                    };
                }
            }
            
            await slot.click().catch(async () => {
                await slot.evaluate(el => el.click());
            });
            await page.waitForTimeout(2000);
        } catch (e) {
            await page.evaluate((ts) => {
                const elements = Array.from(document.querySelectorAll('li[role="option"], .option-link, button, span'));
                const found = elements.find(el => el.innerText.trim().toLowerCase() === ts.toLowerCase());
                if (found) found.click();
            }, timeSlot);
            await page.waitForTimeout(2000);
        }
        
        logTime("Attempting to click SAVE...");
        await card.scrollIntoViewIfNeeded();
        const saveBtn = card.locator('button, .cta-button, a.btn').filter({ hasText: /Save/i }).first();
        
        try {
            await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
            for (let i = 0; i < 5; i++) {
                const isEnabled = await saveBtn.evaluate(el => !el.hasAttribute('disabled') && !el.classList.contains('disabled'));
                if (isEnabled) break;
                await page.waitForTimeout(2000);
            }
            await saveBtn.click({ timeout: 5000 });
        } catch (e) {
            await page.evaluate((activityName) => {
                const card = Array.from(document.querySelectorAll('wdpr-activity-card')).find(c => c.innerText.toLowerCase().includes(activityName.toLowerCase()));
                if (card) {
                    const save = Array.from(card.querySelectorAll('button, .cta-button, a.btn')).find(b => b.innerText.toLowerCase().includes('save'));
                    if (save) save.click();
                }
            }, activityName);
        }

        await page.waitForTimeout(8000);
        const finalPath = await saveDebug(page, "booking_final_check");
        return { activityName, timeSlot, status: "SUCCESS", evidence: finalPath, timing: { total_sec: (Date.now() - start)/1000 } };

    } finally { if (browser) await browser.close(); }
}

module.exports = { getActivityDetails, addActivity };
