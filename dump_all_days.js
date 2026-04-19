const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');

async function dumpAllDays(reservationId) {
    const { browser, page } = await ensureCdpPage();
    try {
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ensureLogin(page);

        console.log("Scrolling and dumping all day headers...");
        const days = await page.evaluate(async () => {
            const results = [];
            for (let i = 0; i < 20; i++) {
                const headers = Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'));
                headers.forEach(h => {
                    const txt = h.innerText.trim();
                    if (txt.includes('April') && !results.includes(txt)) {
                        results.push(txt);
                    }
                });
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
            return results;
        });

        console.log("Found Day Headers:", days);
        
        // Find 4/27 block specifically and dump its innerHTML
        const blockHTML = await page.evaluate(() => {
            const dayBlock = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container, section'))
                                  .find(el => el.innerText.includes('April 27'));
            return dayBlock ? dayBlock.outerHTML : "NOT FOUND";
        });
        
        console.log("=== 4/27 BLOCK HTML ===");
        console.log(blockHTML);

    } finally {
        if (browser) await browser.close();
    }
}

dumpAllDays("44079507");
