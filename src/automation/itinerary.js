const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { waitForAngular } = require('../browser/stability');

/**
 * Fetch all available reservations for the user.
 */
async function getReservations() {
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/`;
    const { browser, page } = await navigateUrl(targetUrl, null, 'app-root', 60000);
    
    try {
        await page.waitForTimeout(10000); // Wait for SPA to settle
        
        return await page.evaluate(() => {
            const clean = (t) => t?.replace(/[^\x20-\x7E\u4e00-\u9fa5\n]/g, '').trim() || "";
            
            // Case 1: Multiple reservations (listing page)
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

            // Case 2: Redirected to a specific reservation
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
    const dashboardUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/`;
    
    logTime(`Navigating to dashboard to auto-detect reservation...`);
    const { browser, page } = await navigateUrl(dashboardUrl, null, 'app-root', 60000);
    
    try {
        logTime("Phase: Identify Reservation Card...");
        
        const currentUrl = page.url();
        const isDirectPage = /\/\d{8}/.test(currentUrl);
        
        const cardLocator = page.locator('myres-reservation-card, .reservation-card');
        let cardExists = false;

        if (isDirectPage) {
            logTime("[INFO] Redirected to direct reservation page. Skipping card search.");
        } else {
            try {
                await cardLocator.first().waitFor({ state: 'visible', timeout: 15000 });
                cardExists = await cardLocator.count() > 0;
            } catch (e) {
                logTime("No reservation cards visible. Checking for direct subpage...");
            }
        }

        const card = cardLocator.first();
        let metadata = {};

        if (cardExists) {
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
            metadata = await page.evaluate(() => {
                const text = document.body.innerText;
                const resIdMatch = text.match(/Reservation\s*#?\\s*(\d{8})/i);
                const stateroomMatch = text.match(/Stateroom\s*(\d+)/i);
                return {
                    reservationId: resIdMatch ? resIdMatch[1] : null,
                    stateroom: stateroomMatch ? stateroomMatch[1] : null,
                    summary: "DIRECT_OR_HIDDEN_CARD"
                };
            });
        }

        const targetId = metadata.reservationId;
        if (!targetId) {
            const path = await saveDebug(page, "no_res_id_found");
            throw new Error(`STRICT FAIL: Could not identify Reservation ID. Evidence: ${path}`);
        }

        logTime(`Reservation ${targetId} identified. Clicking 'My Plans'...`);

        if (cardExists) {
            const myPlansBtn = card.locator('a, button').filter({ hasText: /My Plans/i }).first();
            if (await myPlansBtn.isVisible()) {
                await myPlansBtn.click();
            } else {
                logTime("My Plans button not visible in card, using URL fallback...");
                await page.goto(`${dashboardUrl}${targetId}/my-plans`);
            }
        } else {
            await page.goto(`${dashboardUrl}${targetId}/my-plans`);
        }

        logTime("Waiting for Daily Plans to load...");
        await page.waitForSelector('day-view', { timeout: 45000 }).catch(async () => {
            logTime("⌛ Warning: 'day-view' not found. Checking anyway.");
        });
        
        await waitForAngular(page, 15000).catch(() => {});

        const plans = await page.evaluate(() => {
            const cleanText = (text) => text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
            const days = Array.from(document.querySelectorAll('day-view'));
            
            return days.map(day => {
                const header = day.querySelector('.day-view-header');
                const title = cleanText(header?.querySelector('h2')?.innerText || "");
                const paragraphs = Array.from(header?.querySelectorAll('p') || []);
                const datePara = paragraphs.find(p => p.innerText.length > 2 && !p.classList.contains('pepIcon'));
                const date = cleanText(datePara?.innerText || "");
                
                const activities = Array.from(day.querySelectorAll('activity-card')).map(card => {
                    const time = card.querySelector('.activity-card-time')?.innerText.replace(/\s+/g, ' ').trim() || "";
                    const type = card.querySelector('.activity-card-type')?.innerText.trim() || "";
                    const activityTitle = card.querySelector('.activity-card-title')?.innerText.trim() || "";
                    
                    const infoRows = Array.from(card.querySelectorAll('.activity-card-info'));
                    const info = {};
                    infoRows.forEach(row => {
                        const label = row.querySelector('.activity-card-label')?.innerText.replace(':', '').trim() || "";
                        let detail = row.querySelector('.activity-card-detail')?.innerText.trim() || "";
                        detail = cleanText(detail);
                        if (label) info[label.toLowerCase()] = detail;
                    });

                    return {
                        time: cleanText(time),
                        type: cleanText(type),
                        title: cleanText(activityTitle),
                        ...info
                    };
                });

                return { day: title, date, activities };
            });
        });

        return { reservation: metadata, plans };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { getReservations, getMyPlans };
