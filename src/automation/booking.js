const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { SELECTORS, PATHS } = require('../constants');
const { getTargetGuestCount } = require('../utils/ui_logic');
const { 
    scrollToActivityCard, 
    selectGuests, 
    waitForSpinner, 
    extractTimeSlots, 
    isSlotDisabled 
} = require('./ui_utils');

/**
 * Fetch specific activity details (availability and time slots).
 */
async function getActivityDetails(reservationId, slug, date, activityName) {
    const start = logTime(`=== TASK START: Details for ${activityName} on ${date} ===`);
    const targetUrl = PATHS.ACTIVITY_CATALOG(reservationId, slug, date);
    
    const { browser, page } = await navigateUrl(targetUrl, reservationId, null);
    
    try {
        const card = await scrollToActivityCard(page, activityName);
        if (!card) {
            logTime(`[INFO] Returning empty slots for missing activity: ${activityName}`);
            return { activityName, date, status: "Not Present", timeSlots: [], timing: { total_sec: (Date.now() - start)/1000 } };
        }
        const cardText = await card.innerText();
        const btn = card.locator(SELECTORS.SELECT_ADD_BUTTON).filter({ hasText: /Select|Add/i }).first();

        if (!(await btn.isVisible())) {
            const statusText = await card.locator('.activityCardColRight, .activity-card-button-container').innerText().catch(() => "Not Available");
            return { activityName, date, status: statusText.trim(), timing: { total_sec: (Date.now() - start)/1000 } };
        }

        logTime("[ACTION] Clicking Select/Add button...");
        await btn.click({ force: true });
        
        const participantList = page.locator('.participants-list, .book-activity-drawer, wdpr-book-activity >> .drawer-form').filter({ visible: true }).first();
        await participantList.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
            logTime("[WARN] Standard drawer not visible, retrying click...");
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(3000);
        });

        const count = await participantList.locator('li.participant').count();
        const targetCount = getTargetGuestCount(cardText, count);
        await selectGuests(page, participantList, false, null, targetCount);

        const actionBtn = page.locator('button').filter({ hasText: /Check Availability|Save/i }).first();
        const timeDropdown = page.locator('button, [role="button"]').filter({ hasText: /Select (a )?Time/i }).first();

        logTime("Ensuring time selection UI is ready...");
        for (let i = 0; i < 10; i++) {
            const btnText = await actionBtn.innerText().catch(() => "");
            if (await timeDropdown.isVisible()) break;
            
            if (btnText.match(/Check Availability|Save/i)) {
                const isDisabled = await actionBtn.getAttribute('disabled') !== null || await actionBtn.getAttribute('aria-disabled') === 'true';
                if (!isDisabled) {
                    await actionBtn.click({ force: true });
                    await page.waitForTimeout(3000);
                }
            }
            await page.waitForTimeout(1000);
        }

        if (await timeDropdown.isVisible()) {
            await timeDropdown.click({ force: true });
            await page.waitForTimeout(2000);
        }

        logTime("Scanning for time slots...");
        let slots = [];
        for (let i = 0; i < 5; i++) {
            slots = await extractTimeSlots(page);
            if (slots.length > 0) break;
            await page.waitForTimeout(2000);
        }

        if (await timeDropdown.isVisible()) {
            await saveDebug(page, "slots_list_open");
        }

        if (slots.length === 0) {
            const hasCheckMark = await page.locator('.confirmation-check, .success-icon').isVisible().catch(() => false);
            const saveVisible = await page.locator('button').filter({ hasText: /^Save$/i }).isVisible();
            if (saveVisible || hasCheckMark) {
                return { activityName, date, status: "Available", timeSlots: ["Included"], timing: { total_sec: (Date.now() - start)/1000 } };
            }
            await saveDebug(page, "no_slots_found", true);
        }
        
        const availableOnly = slots.filter(s => s.available).map(s => s.time);
        const allSlotsReport = slots.map(s => `${s.time}${s.available ? '' : ' (Disabled)'}`);

        logTime(`[INFO] Found ${slots.length} slots. Available: ${availableOnly.length}`);

        return { 
            activityName, 
            date, 
            status: availableOnly.length > 0 ? "Available" : (slots.length > 0 ? "Fully Booked" : "No Slots"), 
            timeSlots: availableOnly,
            allSlots: allSlotsReport,
            timing: { total_sec: (Date.now() - start)/1000 } 
        };
    } catch (e) {
        const path = await saveDebug(page, "details_error");
        throw new Error(`STRICT FAIL: ${e.message}. Evidence: ${path}`);
    } finally { if (browser) await browser.close(); }
}

async function addActivity(reservationId, slug, date, activityName, timeSlot, guestName = null) {
    const start = logTime(`=== TASK START: Booking ${activityName} for ${timeSlot} on ${date} ===`);
    const { browser, page } = await navigateUrl(PATHS.ACTIVITY_CATALOG(reservationId, slug, date), reservationId, null);
    
    try {
        const card = await scrollToActivityCard(page, activityName);
        if (!card) throw new Error(`Activity '${activityName}' not found on page.`);
        const cardText = await card.innerText();
        const btn = card.locator(SELECTORS.SELECT_ADD_BUTTON).filter({ hasText: /Select|Add/i }).first();
        
        logTime("[ACTION] Clicking Select/Add button...");
        await btn.click({ force: true });
        await waitForSpinner(page);
        await page.waitForTimeout(3000);
        
        const participantList = page.locator('.participants-list, .book-activity-drawer, wdpr-book-activity >> .drawer-form').filter({ visible: true }).first();
        await participantList.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

        logTime("Processing guest selection...");
        const isRadio = await participantList.locator('wdpr-radio-button, input[type="radio"]').count() > 0;
        const participants = participantList.locator('li.participant');
        const totalCount = await participants.count();
        
        if (isRadio && !guestName) {
            const guestList = [];
            for (let i = 0; i < totalCount; i++) {
                const nameEl = participants.nth(i).locator('.name.guestSensitive, .guest-name');
                const name = (await nameEl.innerText().catch(() => "")).replace(/\s+/g, ' ').trim();
                if (name) guestList.push(name);
            }
            const path = await saveDebug(page, "missing_guest_name");
            throw new Error(`STRICT FAIL: Radio button UI detected (single selection required), but no guestName was provided. Available guests: [${guestList.join(', ')}]. Evidence: ${path}`);
        }

        const selectedCount = await selectGuests(page, participantList, isRadio, guestName, getTargetGuestCount(cardText, totalCount));
        if (guestName && selectedCount === 0) throw new Error(`STRICT FAIL: Could not find guest matching "${guestName}".`);

        const actionBtn = page.locator('button').filter({ hasText: /Check Availability|Save/i }).first();
        const timeDropdown = page.locator('button, [role="button"]').filter({ hasText: /Select (a )?Time/i }).first();

        logTime("Ensuring Check Availability is clicked...");
        for (let i = 0; i < 15; i++) {
            const btnText = await actionBtn.innerText().catch(() => "");
            const isDisabled = await actionBtn.getAttribute('disabled') !== null || await actionBtn.getAttribute('aria-disabled') === 'true';
            
            if (btnText.includes('Check Availability')) {
                if (!isDisabled) {
                    logTime("[ACTION] Clicking Check Availability...");
                    await actionBtn.click({ force: true });
                    await page.waitForTimeout(5000);
                } else {
                    logTime("Check Availability button is still disabled, waiting...");
                }
            } else if (btnText.includes('Save') || await timeDropdown.isVisible()) {
                logTime("Reached Save state or time dropdown is visible.");
                break;
            }
            await page.waitForTimeout(1500);
        }

        if (await timeDropdown.isVisible()) {
            logTime("[ACTION] Opening Select Time dropdown...");
            await timeDropdown.click({ force: true });
            await page.waitForTimeout(4000);
        }
        
        if (timeSlot && timeSlot.toLowerCase() !== "included") {
            logTime(`Scanning for time slot: ${timeSlot}`);
            
            // Optimization: Get all slots once to check existence and availability
            const slots = await extractTimeSlots(page);
            const targetSlot = slots.find(s => s.time.toLowerCase() === timeSlot.toLowerCase());
            const availableSlots = slots.filter(s => s.available).map(s => s.time);

            if (!targetSlot || !targetSlot.available) {
                const path = await saveDebug(page, "slot_unavailable");
                throw new Error(`STRICT FAIL: Time slot ${timeSlot} is currently unavailable. Available slots: [${availableSlots.join(', ')}]. Evidence: ${path}`);
            }

            const slotEl = page.locator('li[role="option"], .time-slot, button, [role="button"], span, .option-link').filter({ hasText: new RegExp("^" + timeSlot + "$", "i") }).first();
            await slotEl.scrollIntoViewIfNeeded().catch(() => {});
            await slotEl.click({ force: true });
            await page.waitForTimeout(3000);
        }
        
        const saveBtn = card.locator(SELECTORS.SAVE_BUTTON).filter({ hasText: /Save/i }).first();
        const globalSave = page.locator('button').filter({ hasText: /^Save$/i }).filter({ visible: true }).first();
        const finalSave = (await saveBtn.isVisible()) ? saveBtn : globalSave;

        if (await finalSave.isVisible()) {
            if (await finalSave.getAttribute('disabled') !== null || await finalSave.getAttribute('aria-disabled') === 'true') {
                const path = await saveDebug(page, "save_disabled");
                throw new Error(`STRICT FAIL: 'Save' button is disabled. Evidence: ${path}`);
            }

            logTime("Taking pre-save evidence...");
            await saveDebug(page, "pre_save_state");

            logTime("[ACTION] Clicking final Save button...");
            await finalSave.click({ force: true });
            
            logTime("Waiting for booking to complete...");
            await page.locator('wdpr-loading-spinner, .loading-overlay, .spinner').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
            await page.locator('wdpr-loading-spinner, .loading-overlay, .spinner').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});
            await page.waitForTimeout(15000); 
        } else {
            const path = await saveDebug(page, "save_not_found");
            throw new Error(`STRICT FAIL: 'Save' button not found. Evidence: ${path}`);
        }
        
        const errorMsg = await page.locator('.error-message, [role="alert"], .notification-error').filter({ visible: true }).first().innerText().catch(() => "");
        if (errorMsg) throw new Error(`Booking failed with site error: ${errorMsg}. Evidence: ${await saveDebug(page, "booking_failed_error")}`);

        return { activityName, timeSlot, status: "SUCCESS", evidence: await saveDebug(page, "booking_final"), url: page.url(), timing: { total_sec: (Date.now() - start)/1000 } };
    } catch (e) {
        const path = await saveDebug(page, "booking_error");
        throw new Error(`STRICT FAIL: ${e.message}. Evidence: ${path}`);
    } finally { if (browser) await browser.close(); }
}

module.exports = { getActivityDetails, addActivity };
