const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { PATHS } = require('../constants');
const { waitForSpinner, robustClick } = require('./ui_utils');

/**
 * Get all bookable activity types (slugs) from the 'Add Activities' menu for a specific date.
 * Uses verified precision scrolling and block-level targeting.
 */
async function getBookableActivityTypes(reservationId, date) {
    const targetUrl = PATHS.MY_PLANS(reservationId);
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'body');
    
    try {
        logTime(`[CATALOG] Waiting for SPA hydration before scanning...`);
        await waitForSpinner(page, 45000);
        
        const dateObj = new Date(date);
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        const dayNum = dateObj.getDate();
        // DCL usually shows "Month Day" in the header
        const dateString = `${month} ${dayNum}`;
        
        logTime(`[CATALOG] Targeting precision block for: ${dateString} (${date})`);

        // Step 1: Find the specific day-view block by checking its header text
        const dayBlock = page.locator('day-view, .itinerary-day').filter({
            has: page.locator('.day-view-header p, .day-view-header h2, .itinerary-day-header, h2, h3').filter({ hasText: new RegExp(dateString, "i") })
        }).first();

        const exists = await dayBlock.count() > 0;
        if (!exists) {
            logTime(`[CATALOG] Day block for ${dateString} not found.`);
            await saveDebug(page, `day_not_found_${date}`);
            return { date, activities: [], status: "Date Not Found" };
        }

        // Step 2: Precise Scroll to the target day block
        logTime(`[CATALOG] Scrolling to ${dateString}...`);
        await dayBlock.scrollIntoViewIfNeeded({ timeout: 15000 });
        await page.evaluate(() => window.scrollBy(0, -150)); // Clear sticky header

        // Step 3: Locate and click "Add Activities" button WITHIN that specific block
        const addBtn = dayBlock.locator('a, button, [role="button"]').filter({ hasText: /Add Activities/i }).first();
        
        const btnVisible = await addBtn.isVisible();
        if (btnVisible) {
            logTime(`[CATALOG] Clicking 'Add Activities' for ${date} (Strict Scoped).`);
            await robustClick(page, addBtn, `AddBtn_${date}`);
            
            // Wait for activity menu container
            const menuSelector = '.add-plans-modal:not([aria-hidden="true"]), .popover:not([aria-hidden="true"]), .wdpr-popover:not([aria-hidden="true"])';
            let menuVisible = false;
            for (let i = 0; i < 6; i++) {
                menuVisible = await page.locator(menuSelector).isVisible();
                if (menuVisible) {
                    logTime(`[CATALOG] Activity menu visible for ${date}. Capturing evidence.`);
                    await saveDebug(page, `menu_open_${date}`);
                    break;
                }
                await page.waitForTimeout(2000);
                if (i === 3) {
                    logTime(`[WARN] Menu not visible, retrying scoped click...`);
                    await robustClick(page, addBtn, `AddBtn_Retry_${date}`);
                }
            }

            if (!menuVisible) {
                logTime(`[ERROR] Activity menu failed to appear for ${date}.`);
                await saveDebug(page, `menu_fail_${date}`);
                return { date, activities: [], status: "Menu Not Opened" };
            }
        } else {
            logTime(`[CATALOG] 'Add Activities' button not available for ${date}.`);
            return { date, activities: [], status: "No Entry Point" };
        }

        // Step 4: Extract activities from the menu
        const activities = await page.evaluate((targetDate) => {
            const results = [];
            const container = document.querySelector('.add-plans-modal:not([aria-hidden="true"]), .popover:not([aria-hidden="true"]), .wdpr-popover:not([aria-hidden="true"])');
            if (!container) return [];

            const rows = Array.from(container.querySelectorAll('.add-plans-row'));
            
            rows.forEach(row => {
                const titleEl = row.querySelector('.add-plans-option-title');
                if (!titleEl) return;
                
                let text = titleEl.innerText.trim();
                text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
                if (text.length < 2) return;

                const enabledDiv = row.querySelector('.row-enabled');
                const anchor = row.querySelector('a.row-anchor');
                const href = anchor ? anchor.getAttribute('href') : null;
                const dateMatches = href && href.includes(targetDate);
                
                // Final Availability Rule:
                // Must have enabledDiv AND anchor AND the date in the URL must match our target date.
                const isActuallyAvailable = enabledDiv !== null && anchor !== null && dateMatches;

                let slug = "UNKNOWN";
                const t = text.toUpperCase();
                if (t.includes('ONBOARD')) slug = 'ONBOARDFUN';
                else if (t.includes('DINING')) slug = 'DINE';
                else if (t.includes('SPA')) slug = 'SPAANDFITNESS';
                else if (t.includes('PORT')) slug = 'PORTADVENTURES';
                else if (t.includes('NURSERY')) slug = 'NURSERY';

                if (slug !== "UNKNOWN") {
                    results.push({ 
                        type: text, 
                        slug, 
                        status: isActuallyAvailable ? "Available" : "Unavailable",
                        debug: { enabled: enabledDiv !== null, hasAnchor: anchor !== null, dateMatches, href }
                    });
                }
            });
            return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
        }, date);

        logTime(`[CATALOG] Extracted ${activities.length} activity types.`);
        return { date, activities };
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * List all activities within a specific category and date.
 */
async function getActivityList(reservationId, slug, date) {
    const targetUrl = PATHS.ACTIVITY_CATALOG(reservationId, slug, date);
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'wdpr-activity-card', 60000);
    
    try {
        await page.waitForSelector('wdpr-activity-card', { timeout: 30000 }).catch(() => {});

        const activities = await page.evaluate(() => {
            const cleanText = (text) => text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
            const cards = Array.from(document.querySelectorAll('wdpr-activity-card'));
            
            return cards.map(card => {
                const title = cleanText(card.querySelector('h2')?.innerText || "");
                
                const details = {};
                const listItems = Array.from(card.querySelectorAll('.description-lines.m-hide li'));
                listItems.forEach(li => {
                    const cls = li.className || "";
                    const val = cleanText(li.innerText || "");
                    if (cls.includes('experienceType')) details.type = val;
                    if (cls.includes('durationInMinutes')) details.duration = val.replace(/,&nbsp;|,/g, '').trim();
                    if (cls.includes('bookingPrice')) details.price = val;
                    if (cls.includes('locations')) details.location = val;
                });

                const bookBtn = card.querySelector('wdpr-book-activity');
                const metadata = {};
                if (bookBtn) {
                    metadata.productId = bookBtn.getAttribute('product-id');
                    metadata.subType = bookBtn.getAttribute('activity-sub-type');
                    metadata.seawareId = bookBtn.getAttribute('seaware-id');
                }

                return {
                    title,
                    ...details,
                    ...metadata
                };
            });
        });

        return { reservationId, slug, date, activities };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { getBookableActivityTypes, getActivityList };
