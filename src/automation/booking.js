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
        
        // Wait for card to be visible
        await card.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        
        let found = await card.isVisible().catch(() => false);
        if (!found) {
            for (let i = 0; i < 4; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await new Promise(r => setTimeout(r, 1000));
                if (await card.isVisible().catch(() => false)) {
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

        logTime("[ACTION] Clicking Select/Add button...");
        await btn.click({ force: true });
        
        logTime("Waiting for booking drawer to stabilize...");
        // Instead of waiting for a global class, look for the drawer content inside the specific card's book-activity component
        const bookActivity = card.locator('wdpr-book-activity').first();
        
        // Sometimes DCL uses a global overlay, sometimes it's inline. Let's try to find ANY visible participant list.
        const participantList = page.locator('.participants-list, .book-activity-drawer, wdpr-book-activity >> .drawer-form').filter({ visible: true }).first();
        
        try {
            await participantList.waitFor({ state: 'visible', timeout: 15000 });
        } catch (e) {
            logTime("[WARN] Standard drawer not visible. Checking if it needs another click or different selector...");
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(3000);
        }

        logTime("Handling guest selection...");
        // Use ONLY li.participant to avoid double counting with nested checkboxes
        const participants = participantList.locator('li.participant');
        const count = await participants.count();
        
        if (count > 0) {
            const toSelect = getTargetGuestCount(cardText, count);
            logTime(`Found ${count} guests, selecting ${toSelect}...`);
            
            for (let i = 0; i < toSelect; i++) {
                const p = participants.nth(i);
                // The button[role="checkbox"] is the most reliable target in DCL
                const checkbox = p.locator('button[role="checkbox"], button.btn-checkbox, wdpr-checkbox button').first();
                
                if (await checkbox.count() > 0) {
                    await checkbox.click({ force: true });
                } else {
                    // Fallback to label
                    await p.locator('label').first().click({ force: true }).catch(() => p.click({ force: true }));
                }
                await new Promise(r => setTimeout(r, 800));
            }
        }

        const actionBtn = page.locator('button').filter({ hasText: /Check Availability|Save/i }).first();
        const timeDropdown = page.locator('button, [role="button"]').filter({ hasText: /Select (a )?Time/i }).first();

        logTime("Waiting for action button to be enabled or time dropdown to appear...");
        for (let i = 0; i < 15; i++) {
            if (await timeDropdown.isVisible()) break;
            
            const isDisabled = await actionBtn.getAttribute('disabled');
            const isAriaDisabled = await actionBtn.getAttribute('aria-disabled');
            
            if (!isDisabled && isAriaDisabled !== 'true') {
                logTime("[ACTION] Clicking Check Availability/Save...");
                await actionBtn.click({ force: true });
                await new Promise(r => setTimeout(r, 2000));
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (await timeDropdown.isVisible()) {
            logTime("[ACTION] Opening Select Time dropdown...");
            await timeDropdown.click({ force: true });
            await new Promise(r => setTimeout(r, 2000));
        }

        logTime("Scanning for time slots...");
        let times = [];
        for (let i = 0; i < 10; i++) {
            times = await page.evaluate(() => {
                function findInShadows(root, selector) {
                    let results = Array.from(root.querySelectorAll(selector));
                    const allElements = root.querySelectorAll('*');
                    for (const el of allElements) {
                        if (el.shadowRoot) results = results.concat(findInShadows(el.shadowRoot, selector));
                    }
                    return results;
                }
                const timeRegex = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM)$/i;
                const voyageRegex = /Voyage Length/i;
                const selectors = 'li[role="option"], button, span, .time-slot, .time, .booking-time';
                const elements = findInShadows(document, selectors);
                const found = elements.map(e => (e.innerText || "").trim()).filter(t => timeRegex.test(t) || voyageRegex.test(t));
                return [...new Set(found)];
            });
            if (times.length > 0) break;
            await new Promise(r => setTimeout(r, 2000));
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

async function addActivity(reservationId, slug, date, activityName, timeSlot) {
    // Similar refactoring would apply here, but focusing on details for now
    const { browser, page } = await navigateUrl(PATHS.ACTIVITY_CATALOG(reservationId, slug, date), reservationId, null);
    try {
        const card = page.locator(SELECTORS.ACTIVITY_CARD).filter({ hasText: new RegExp(activityName, "i") }).first();
        await card.waitFor({ state: 'visible', timeout: 15000 });
        const cardText = await card.innerText();
        await card.locator(SELECTORS.SELECT_ADD_BUTTON).filter({ hasText: /Select|Add/i }).first().click();
        
        const participants = page.locator('li.participant');
        const toSelect = getTargetGuestCount(cardText, await participants.count());

        for (let i = 0; i < toSelect; i++) {
            await participants.nth(i).click({ force: true });
            await new Promise(r => setTimeout(r, 800));
        }
        await page.locator('button').filter({ hasText: /Check Availability|Save/i }).first().click();
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
