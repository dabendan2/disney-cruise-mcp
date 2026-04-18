const { navigateUrl } = require('./navigation');
const { logTime, saveDebug } = require('../utils/debug');
const { SELECTORS } = require('../constants');
const { waitForAngular } = require('../browser/stability');

async function getActivityDetails(reservationId, slug, date, activityName) {
    const start = logTime(`=== TASK START: ${activityName} on ${date} ===`);
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/${slug}/${date}/?ship=DA&port=SIN`;
    
    const navResult = await navigateUrl(targetUrl, reservationId, SELECTORS.ACTIVITY_CARD);
    const { browser, page } = navResult;
    try {
        logTime("Phase: Scan Activity Card...");
        // Use a more specific locator for the card to avoid cross-talk
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

        // REFACTORED STATUS CHECK: Button-first logic
        const btn = card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first();
        const isBtnVisible = await btn.isVisible();

        if (!isBtnVisible) {
            // If no button, extract the actual reason instead of guessing
            // Often there's a label like "Sold Out" or "Only available on board"
            // We capture the bottom area text where the button usually is
            const statusText = await card.locator('.activityCardColRight, .activity-card-button-container').innerText();
            return { 
                activityName, 
                date, 
                status: statusText.trim() || "Not Available (No Button)", 
                timing: { total_sec: (Date.now() - start)/1000 } 
            };
        }

        // If button is visible, proceed to click
        await btn.click();
        
        // Wait for guest modal or direct slot hydration
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
            for (let i = 0; i < await guests.count(); i++) { 
                await guests.nth(i).scrollIntoViewIfNeeded();
                await guests.nth(i).click(); 
                await new Promise(r => setTimeout(r, 1200)); 
            }
            
            const checkBtn = page.locator('button').filter({ hasText: /Check Availability/i }).first();
            await checkBtn.evaluate(el => el.removeAttribute('disabled'));
            await checkBtn.click();
        }

        // Handle time slot hydration
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

async function getAllActivityTypes(reservationId) {
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'text=Add Activities', 45000);
    
    try {
        const addBtn = page.locator('button, a, [role="button"]').filter({ hasText: /Add Activities/i }).first();
        if (await addBtn.isVisible()) {
            await addBtn.click();
            await page.waitForTimeout(5000);
        }

        return await page.evaluate((resId) => {
            const results = [];
            const container = document.querySelector('.add-activities-menu, .popover, .dropdown-menu, body');
            const elements = Array.from(container.querySelectorAll('a, button, [role="button"]'));
            
            elements.forEach(el => {
                const href = el.getAttribute('href') || "";
                let text = el.innerText.trim();
                text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
                
                const match = href.match(/\/(\d{8})\/([A-Z]+)\//);
                if (match && text.length > 1) {
                    results.push({
                        type: text,
                        slug: match[2],
                        status: (el.offsetParent !== null && !el.classList.contains('disabled')) ? "Available" : "Disabled"
                    });
                }
            });
            return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
        }, reservationId);
    } finally {
        if (browser) await browser.close();
    }
}

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

async function getMyPlans() {
    const dashboardUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/`;
    
    logTime(`Navigating to dashboard to auto-detect reservation...`);
    const { browser, page } = await navigateUrl(dashboardUrl, null, 'app-root', 60000);
    
    try {
        logTime("Phase: Identify Reservation Card...");
        await page.waitForTimeout(8000); 
        
        const cardLocator = page.locator('myres-reservation-card, .reservation-card');
        
        try {
            await cardLocator.first().waitFor({ state: 'visible', timeout: 25000 });
        } catch (e) {
            logTime("No reservation cards visible. Checking for direct subpage...");
        }

        const card = cardLocator.first();
        let metadata = {};
        const cardExists = await card.count() > 0;

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
                const resIdMatch = text.match(/Reservation\s*#?\s*(\d{8})/i);
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

module.exports = { getActivityDetails, getAllActivityTypes, getMyPlans, getActivityList };
