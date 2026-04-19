const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');

async function strictDateInspection(reservationId, targetDate) {
    const { browser, page } = await ensureCdpPage();
    try {
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'networkidle' });
        await ensureLogin(page);

        const dateObj = new Date(targetDate);
        const dateString = `${dateObj.toLocaleString('en-US', { month: 'long' })} ${dateObj.getDate()}`;

        console.log(`🔍 Locating ${dateString} and clicking button...`);
        
        await page.evaluate(async (dStr) => {
            const headers = Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'));
            const header = headers.find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
            if (header) {
                header.scrollIntoView({ block: 'center' });
                await new Promise(r => setTimeout(r, 1000));
                const dayBlock = header.closest('day-view, .itinerary-day, .day-container, section');
                const btn = Array.from(dayBlock.querySelectorAll('a, button, [role="button"]'))
                                 .find(el => el.innerText.includes('Add Activities'));
                if (btn) btn.click();
            }
        }, dateString);

        await page.waitForTimeout(4000);

        const analysis = await page.evaluate((tDate) => {
            const modal = document.querySelector('.add-plans-modal, .popover-content, .wdpr-popover, body');
            const links = Array.from(modal.querySelectorAll('a.row-anchor, a'));
            
            return links.map(a => ({
                text: a.innerText.trim().replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, ''),
                href: a.getAttribute('href'),
                matchesTargetDate: a.getAttribute('href')?.includes(tDate) || false
            })).filter(l => l.text.length > 2 && l.href && l.href.includes('my-disney-cruise'));
        }, targetDate);

        console.log(`=== STRICT ANALYSIS FOR ${targetDate} ===`);
        console.log(JSON.stringify(analysis, null, 2));

    } finally {
        if (browser) await browser.close();
    }
}

strictDateInspection("44079507", "2026-04-27");
