const { navigateUrl } = require('./navigation');

/**
 * Get all activity types (slugs) from the 'Add Activities' menu.
 */
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

module.exports = { getAllActivityTypes, getActivityList };
