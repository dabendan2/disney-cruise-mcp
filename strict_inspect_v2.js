const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');

async function strictDateInspection(reservationId, targetDate) {
    const { browser, page } = await ensureCdpPage();
    try {
        console.log("Navigating...");
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ensureLogin(page);

        const dateObj = new Date(targetDate);
        const dateString = `${dateObj.toLocaleString('en-US', { month: 'long' })} ${dateObj.getDate()}`;
        console.log(`Searching for ${dateString}...`);

        const result = await page.evaluate(async (dStr, tDate) => {
            const findHeader = () => Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'))
                                         .find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
            
            let header = null;
            for(let i=0; i<15; i++) {
                header = findHeader();
                if (header) break;
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }

            if (!header) return "HEADER NOT FOUND";

            header.scrollIntoView({ block: 'center' });
            await new Promise(r => setTimeout(r, 1000));

            const dayBlock = header.closest('day-view, .itinerary-day, .day-container, section');
            const btn = Array.from(dayBlock.querySelectorAll('a, button, [role="button"]'))
                             .find(el => el.innerText.includes('Add Activities'));
            
            if (!btn) return "BTN NOT FOUND";
            btn.click();
            await new Promise(r => setTimeout(r, 4000));

            const modal = document.querySelector('.add-plans-modal, .popover-content, .wdpr-popover, body');
            const links = Array.from(modal.querySelectorAll('a.row-anchor, a'));
            
            return links.map(a => ({
                text: a.innerText.trim().replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, ''),
                href: a.getAttribute('href'),
                matchesTargetDate: a.getAttribute('href')?.includes(tDate) || false
            })).filter(l => l.text.length > 2 && l.href && l.href.includes('my-disney-cruise'));
        }, dateString, targetDate);

        console.log(`=== RESULTS FOR ${targetDate} ===`);
        console.log(JSON.stringify(result, null, 2));

    } finally {
        if (browser) await browser.close();
    }
}

strictDateInspection("44079507", "2026-04-27");
