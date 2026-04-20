const { logTime, saveDebug } = require('../utils/debug');
const { SELECTORS } = require('../constants');
const { cleanGuestName } = require('../utils/ui_logic');

/**
 * Ensures the activity card is visible by scrolling if necessary.
 */
async function scrollToActivityCard(page, activityName) {
    const card = page.locator(SELECTORS.ACTIVITY_CARD).filter({ hasText: new RegExp(activityName, "i") }).first();
    
    await card.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    
    let found = await card.isVisible().catch(() => false);
    if (!found) {
        logTime(`Card for "${activityName}" not immediately visible, scrolling...`);
        for (let i = 0; i < 6; i++) {
            await page.evaluate(() => window.scrollBy(0, 1000));
            await new Promise(r => setTimeout(r, 1500));
            if (await card.isVisible().catch(() => false)) {
                found = true;
                break;
            }
        }
    }

    if (!found) {
        logTime(`[INFO] Activity '${activityName}' not found on page.`);
        return null;
    }
    await card.scrollIntoViewIfNeeded();
    return card;
}

/**
 * Checks if a guest row is selected.
 */
async function isGuestSelected(participantLocator) {
    return await participantLocator.evaluate(el => {
        const input = el.querySelector('input');
        if (input && (input.checked || input.getAttribute('aria-checked') === 'true')) return true;
        
        const button = el.querySelector('button[role="checkbox"], button[role="radio"]');
        if (button && button.getAttribute('aria-checked') === 'true') return true;
        
        const label = el.querySelector('label');
        if (label && (label.classList.contains('checked') || label.classList.contains('active'))) return true;
        
        const custom = el.querySelector('wdpr-radio-button, wdpr-checkbox');
        if (custom && (custom.getAttribute('checked') === 'true' || custom.getAttribute('aria-checked') === 'true')) return true;
        
        if (el.querySelector('.radio-icon-checked, .checkbox-icon-checked')) return true;
        
        const icon = el.querySelector('wdpr-icon');
        if (icon && !icon.classList.contains('invisible')) return true;

        return false;
    }).catch(() => false);
}

/**
 * Handles guest selection logic.
 */
async function selectGuests(page, participantList, isRadio, guestName, targetCount) {
    const participants = participantList.locator('li.participant, .participant-row, .guest-row');
    const count = await participants.count();
    if (count === 0) return 0;

    logTime(`Selecting guests (Total: ${count}, Target: ${targetCount || 'All'}, isRadio: ${isRadio}, guestName: ${guestName || 'None'})`);
    let selectedCount = 0;

    for (let i = 0; i < count; i++) {
        const p = participants.nth(i);
        const nameEl = p.locator('.name.guestSensitive, .guest-name, .participant-name');
        const rawText = await nameEl.innerText().catch(() => "");
        const pText = cleanGuestName(rawText);

        if (guestName && !pText.toLowerCase().includes(guestName.toLowerCase())) {
            continue;
        }

        logTime(`[ACTION] Selecting guest: ${pText}...`);
        
        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (await isGuestSelected(p)) {
                logTime(`✅ Guest ${pText} is already selected.`);
                success = true;
                break;
            }

            logTime(`Selection attempt ${attempt + 1} for ${pText}...`);
            const interactive = p.locator('button[role="checkbox"], button[role="radio"], .radio-icon, .checkbox-icon, wdpr-checkbox, wdpr-radio-button').filter({ visible: true }).first();
            
            if (await interactive.count() > 0) {
                await interactive.click({ force: true, timeout: 3000 }).catch(() => {});
            } else {
                const label = p.locator('label').first();
                await label.click({ force: true, timeout: 3000 }).catch(() => {});
            }
            
            await page.waitForTimeout(2000);
            if (await isGuestSelected(p)) {
                success = true;
                break;
            }
            
            await p.evaluate(el => {
                const targets = el.querySelectorAll('button, label, input, [role="checkbox"], [role="radio"]');
                targets.forEach(t => t.click());
            });
            await page.waitForTimeout(2000);
            if (await isGuestSelected(p)) {
                success = true;
                break;
            }
        }

        if (success) {
            logTime(`✅ Guest selection confirmed for ${pText}`);
            selectedCount++;
        } else {
            logTime(`❌ Failed to select guest ${pText}`);
        }

        if (isRadio || (targetCount && selectedCount >= targetCount)) break;
    }

    return selectedCount;
}

/**
 * Waits for DCL loading spinners to disappear.
 */
async function waitForSpinner(page, timeout = 45000) {
    const selector = SELECTORS.LOADING_SPINNER;
    // Use first() to avoid ambiguity if multiple spinners exist
    const spinner = page.locator(selector).first();
    
    try {
        // Step 1: Wait for it to potentially appear (short burst)
        await spinner.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        
        // Step 2: If it's visible, wait for it to be hidden
        if (await spinner.isVisible()) {
            await spinner.waitFor({ state: 'hidden', timeout });
        }
    } catch (e) {
        logTime(`[WARN] Spinner wait interrupted: ${e.message}`);
    }
}

/**
 * Checks if a specific time slot element is disabled or grayed out.
 */
async function isSlotDisabled(slotLocator) {
    return await slotLocator.evaluate(el => {
        const style = window.getComputedStyle(el);
        const isGray = style.color.includes('153') || parseFloat(style.opacity) < 0.6; 
        const isDisabledAttr = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
        const parentLi = el.closest('li');
        const isParentDisabled = parentLi && (parentLi.classList.contains('disabled') || parentLi.getAttribute('aria-disabled') === 'true' || parentLi.classList.contains('is-disabled'));
        return isGray || isDisabledAttr || isParentDisabled || el.classList.contains('disabled') || el.classList.contains('is-disabled');
    }).catch(() => false);
}

/**
 * Extracts all time slots with their availability status.
 */
async function extractTimeSlots(page) {
    return await page.evaluate(() => {
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
        const selectors = 'li[role="option"], .time-slot, button, .option-link, .booking-time, .option-text';
        
        const elements = findInShadows(document, selectors);
        const results = elements
            .filter(e => {
                const txt = (e.innerText || "").trim();
                return timeRegex.test(txt) || voyageRegex.test(txt);
            })
            .map(e => {
                const style = window.getComputedStyle(e);
                const isGray = style.color.includes('153') || parseFloat(style.opacity) < 0.6;
                const isDisabledAttr = e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true';
                const parentLi = e.closest('li');
                const isParentDisabled = parentLi && (parentLi.classList.contains('disabled') || parentLi.getAttribute('aria-disabled') === 'true' || parentLi.classList.contains('is-disabled'));
                
                return {
                    time: (e.innerText || "").trim(),
                    available: !(isGray || isDisabledAttr || isParentDisabled || e.classList.contains('disabled') || e.classList.contains('is-disabled'))
                };
            });

        // Deduplicate and prioritize 'available'
        const map = new Map();
        results.forEach(s => {
            if (!map.has(s.time) || s.available) {
                map.set(s.time, s);
            }
        });
        return Array.from(map.values());
    });
}

/**
 * A robust click helper.
 */
async function robustClick(page, locator, name = "element") {
    await locator.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -150));
    
    logTime(`[ACTION] Robust clicking: ${name}...`);
    try {
        await locator.click({ force: true, timeout: 5000 });
    } catch (e) {
        logTime(`[WARN] Standard click failed for ${name}, using JS dispatch.`);
        await locator.evaluate(el => el.click());
    }
}

module.exports = {
    scrollToActivityCard,
    isGuestSelected,
    selectGuests,
    waitForSpinner,
    extractTimeSlots,
    isSlotDisabled,
    robustClick
};
