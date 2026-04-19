const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');

async function compareDays(reservationId) {
    const { browser, page } = await ensureCdpPage();
    try {
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'networkidle' });
        await ensureLogin(page);

        const data = await page.evaluate(async () => {
            const results = {};
            const days = ["April 23", "April 27"];
            
            for (const d of days) {
                // Scroll to find day
                let block = null;
                for(let i=0; i<15; i++) {
                    block = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container'))
                                 .find(el => el.innerText.includes(d) && el.offsetParent !== null);
                    if (block) break;
                    window.scrollBy(0, 1000);
                    await new Promise(r => setTimeout(r, 1000));
                }

                if (block) {
                    block.scrollIntoView();
                    const btn = Array.from(block.querySelectorAll('button, a, [role="button"], span'))
                                     .find(el => el.innerText.includes('Add Activities'));
                    if (btn) {
                        btn.click();
                        await new Promise(r => setTimeout(r, 3000));
                        const modal = document.querySelector('.add-plans-modal:not([aria-hidden="true"]), .popover:not([aria-hidden="true"])');
                        results[d] = modal ? modal.outerHTML : "MODAL NOT FOUND";
                        // Close modal to avoid overlap
                        const closeBtn = document.querySelector('.popover-close-button, .close-button');
                        if (closeBtn) closeBtn.click();
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        results[d] = "BTN NOT FOUND";
                    }
                } else {
                    results[d] = "DAY NOT FOUND";
                }
            }
            return results;
        });

        console.log(JSON.stringify(data, null, 2));
    } finally {
        if (browser) await browser.close();
    }
}

compareDays("44079507");
