const { navigateUrl } = require('./navigation');
const { logTime } = require('../utils/debug');

/**
 * Get all bookable activity types (slugs) from the 'Add Activities' menu for a specific date.
 * Uses verified precision scrolling and block-level targeting.
 */
async function getBookableActivityTypes(reservationId, date) {
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'body');
    
    try {
        const dateObj = new Date(date);
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        const dayNum = dateObj.getDate();
        const dateString = `${month} ${dayNum}`;
        
        logTime(`[CATALOG] Targeting precision block for: ${dateString} (${date})`);

        // Step 1: Precise Scroll to the Day Block
        const found = await page.evaluate(async (dStr) => {
            const findDayHeader = () => Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'))
                                             .find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
            
            for (let i = 0; i < 20; i++) {
                const header = findDayHeader();
                if (header) {
                    const block = header.closest('day-view, .itinerary-day, .day-container, section');
                    if (block) {
                        block.scrollIntoView({ block: 'center' });
                        return true;
                    }
                }
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
            return false;
        }, dateString);

        if (!found) {
            logTime(`[CATALOG] Day ${dateString} not found in itinerary.`);
            return { date, activities: [], status: "Date Not Found" };
        }

        // Step 2: Click button ONLY within that specific day block
        const clicked = await page.evaluate((dStr) => {
            const containers = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container, section'));
            const dayBlock = containers.find(el => el.innerText.includes(dStr));
            if (dayBlock) {
                const btn = Array.from(dayBlock.querySelectorAll('a, button, [role="button"]'))
                                 .find(el => el.innerText.includes('Add Activities'));
                if (btn) {
                    btn.click();
                    return true;
                }
            }
            return false;
        }, dateString);

        if (clicked) {
            logTime(`[CATALOG] Clicked 'Add Activities' for ${date}. Waiting for menu...`);
            await page.waitForTimeout(4000);
        } else {
            return { date, activities: [], status: "No Entry Point" };
        }

        // Step 3: Extract activities with VERIFIED DCL STRUCTURE
        const activities = await page.evaluate((targetDate) => {
            const results = [];
            // Target the active popover/modal
            const container = document.querySelector('.add-plans-modal:not([aria-hidden="true"]), .popover:not([aria-hidden="true"]), .wdpr-popover:not([aria-hidden="true"])');
            if (!container) return [];

            const rows = Array.from(container.querySelectorAll('.add-plans-row'));
            
            rows.forEach(row => {
                const titleEl = row.querySelector('.add-plans-option-title');
                if (!titleEl) return;
                
                let text = titleEl.innerText.trim();
                text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
                if (text.length < 2) return;

                // CRITICAL FIX: Direct structure check based on Real DOM comparison
                // 1. Is there a row-enabled container?
                const enabledDiv = row.querySelector('.row-enabled');
                // 2. Is there an anchor tag?
                const anchor = row.querySelector('a.row-anchor');
                // 3. Does the anchor contain the CORRECT DATE in its URL?
                const href = anchor ? anchor.getAttribute('href') : null;
                const dateMatches = href && href.includes(targetDate);
                
                // Final Availability Rule:
                // Must have enabledDiv AND anchor AND the date in the URL must match our target date.
                // If it's 4/27 but the URL is 4/23, it's a "ghost link" and should be considered Unavailable.
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
                        status: isActuallyAvailable ? "Available" : "Unavailable" 
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
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/${slug}/${date}/?ship=DA&port=SIN`;
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
