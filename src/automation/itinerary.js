const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { waitForAngular } = require('../browser/stability');
const { PATHS } = require('../constants');
const { waitForSpinner, robustClick } = require('./ui_utils');

/**
 * Fetch all available reservations for the user.
 */
async function getReservations() {
    const targetUrl = PATHS.RESERVATION_ROOT + '/my-reservations/';
    const { browser, page } = await navigateUrl(targetUrl, null, 'app-root', 60000);
    
    try {
        await waitForSpinner(page);
        await page.waitForTimeout(5000); 
        
        return await page.evaluate(() => {
            const clean = (t) => t?.replace(/[^\x20-\x7E\u4e00-\u9fa5\n]/g, '').trim() || "";
            
            const cards = Array.from(document.querySelectorAll('myres-reservation-card, .reservation-card'));
            if (cards.length > 0) {
                return cards.map(card => {
                    const text = card.innerText;
                    const resIdMatch = text.match(/Reservation\s*#?\s*(\d{8})/i);
                    const stateroomMatch = text.match(/Stateroom\s*(\d+)/i);
                    return {
                        reservationId: resIdMatch ? resIdMatch[1] : null,
                        stateroom: stateroomMatch ? stateroomMatch[1] : null,
                        summary: clean(text),
                        type: "LIST_ITEM"
                    };
                });
            }

            const fullText = document.body.innerText;
            const resIdMatch = fullText.match(/Reservation\s*#?\s*(\d{8})/i);
            const stateroomMatch = fullText.match(/Stateroom\s*(\d+)/i);
            const title = document.querySelector('h1, .cruise-title')?.innerText || "";
            
            if (resIdMatch) {
                return [{
                    reservationId: resIdMatch[1],
                    stateroom: stateroomMatch ? stateroomMatch[1] : null,
                    title: clean(title),
                    type: "DIRECT_PAGE"
                }];
            }

            return [];
        });
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Auto-detect the first reservation and fetch its full itinerary.
 */
async function getMyPlans() {
    const dashboardUrl = PATHS.RESERVATION_ROOT + '/my-reservations/';
    
    logTime(`Navigating to dashboard to auto-detect reservation...`);
    const { browser, page } = await navigateUrl(dashboardUrl, null, 'app-root', 60000);
    
    try {
        logTime("Phase: Waiting for Dashboard to load...");
        await waitForSpinner(page);
        await page.waitForTimeout(5000); // Buffer for SPA rendering
        
        const currentUrl = page.url();
        const urlIdMatch = currentUrl.match(/\/(\d{8})/);
        const isDirectPage = /\/\d{8}/.test(currentUrl);
        
        const cardLocator = page.locator('myres-reservation-card, .reservation-card');
        let cardExists = await cardLocator.count() > 0;

        if (isDirectPage) {
            logTime("[INFO] On direct reservation page.");
        }

        let metadata = {};
        
        // RETRY LOOP: Wait for the reservation card/ID to appear
        for (let attempt = 1; attempt <= 3; attempt++) {
            if (isDirectPage) {
                logTime("[INFO] On direct reservation page.");
            }

            const cardLocator = page.locator('myres-reservation-card, .reservation-card');
            let cardExists = await cardLocator.count() > 0;

            if (cardExists) {
                const card = cardLocator.first();
                metadata = await card.evaluate(el => {
                    const text = el.innerText;
                    const clean = (t) => t?.replace(/[^\x20-\x7E\u4e00-\u9fa5\n]/g, '').trim() || "";
                    const resIdMatch = text.match(/Reservation\s*#?\s*(\d{8})/i);
                    const stateroomMatch = text.match(/Stateroom\s*(\d+)/i);
                    const title = el.querySelector('.cruise-title, h3, h2, .reservation-title')?.innerText || "";
                    return {
                        reservationId: resIdMatch ? resIdMatch[1] : null,
                        stateroom: stateroomMatch ? stateroomMatch[1] : null,
                        summary: clean(text),
                        title: clean(title)
                    };
                });
            } else {
                metadata = await page.evaluate((urlId) => {
                    const text = document.body.innerText;
                    const resIdMatch = text.match(/Reservation\s*#?\s*(\d{8})/i);
                    const stateroomMatch = text.match(/Stateroom\s*(\d+)/i);
                    return {
                        reservationId: resIdMatch ? resIdMatch[1] : urlId,
                        stateroom: stateroomMatch ? stateroomMatch[1] : null,
                        summary: "DIRECT_PAGE"
                    };
                }, urlIdMatch ? urlIdMatch[1] : null);
            }

            if (metadata.reservationId) break;
            
            logTime(`[RETRY] Reservation ID not found on attempt ${attempt}. Waiting 5s...`);
            await waitForSpinner(page);
            await page.waitForTimeout(5000);
        }

        const targetId = metadata.reservationId;
        if (!targetId) {
            const path = await saveDebug(page, "no_res_id_found");
            throw new Error(`STRICT FAIL: Could not identify Reservation ID. Evidence: ${path}`);
        }

        logTime(`Reservation ${targetId} identified. Checking for 'My Plans' button...`);

        // GUARD: Wait for the page to be actually ready before looking for the button
        await waitForSpinner(page);
        await page.waitForTimeout(2000);

        // Look for "My Plans" link/button globally or in card
        const myPlansBtn = page.locator('a, button').filter({ hasText: /My Plans/i }).first();
        
        if (await myPlansBtn.isVisible()) {
            logTime("[ACTION] Found 'My Plans' button. Clicking...");
            await robustClick(page, myPlansBtn, "MyPlans_Button");
        } else {
            logTime("[INFO] 'My Plans' button not visible. Navigating via URL fallback...");
            await page.goto(`${dashboardUrl}${targetId}/my-plans`);
        }

        logTime("Waiting for Daily Plans to load...");
        await waitForSpinner(page, 45000);
        await page.waitForSelector('day-view, .itinerary-day', { timeout: 45000 }).catch(async () => {
            logTime("⌛ Warning: 'day-view' not found. Checking for list items anyway.");
        });
        
        await waitForAngular(page, 15000).catch(() => {});

        const plans = await page.evaluate(() => {
            const cleanText = (text) => text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
            const days = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container'));
            
            return days.map(day => {
                // Focus ONLY on the primary header to avoid capturing sub-elements like date and 'Add Activities'
                const header = day.querySelector('.day-view-header, .itinerary-day-header');
                const titleEl = header?.querySelector('h2, h3') || day.querySelector('h2, h3');
                const title = cleanText(titleEl?.innerText || "");
                
                const paragraphs = Array.from(day.querySelectorAll('p'));
                const datePara = paragraphs.find(p => p.innerText.length > 5 && !p.classList.contains('pepIcon'));
                const dateStr = cleanText(datePara?.innerText || "");

                // Attempt to generate a structured ISO date (YYYY-MM-DD)
                let isoDate = null;
                try {
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const dayNum = String(d.getDate()).padStart(2, '0');
                        isoDate = `${y}-${m}-${dayNum}`;
                    }
                } catch (e) { /* ignore */ }
                
                const activities = Array.from(day.querySelectorAll('activity-card, .activity-item')).map(card => {
                    const time = card.querySelector('.activity-card-time, .time')?.innerText.replace(/\s+/g, ' ').trim() || "";
                    const type = card.querySelector('.activity-card-type, .type')?.innerText.trim() || "";
                    const activityTitle = card.querySelector('.activity-card-title, .title, h4')?.innerText.trim() || "";
                    
                    const infoRows = Array.from(card.querySelectorAll('.activity-card-info, .info-row'));
                    const info = {};
                    infoRows.forEach(row => {
                        const label = row.querySelector('.activity-card-label, .label')?.innerText.replace(':', '').trim() || "";
                        let detail = row.querySelector('.activity-card-detail, .detail')?.innerText.trim() || "";
                        detail = cleanText(detail);
                        if (label) info[label.toLowerCase()] = detail;
                    });

                    return {
                        time: cleanText(time),
                        type: cleanText(type),
                        title: cleanText(activityTitle),
                        date: isoDate || dateStr,
                        ...info
                    };
                });

                return { 
                    day: title, 
                    date: dateStr, 
                    isoDate: isoDate,
                    activities 
                };
            });
        });

        // If empty, try one more time with a small wait
        if (plans.length === 0) {
            logTime("[WARN] Plans array is empty. Saving evidence...");
            await saveDebug(page, "empty_plans_list");
        }

        return { reservation: metadata, plans };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { getReservations, getMyPlans };
