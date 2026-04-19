const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const fs = require('fs');

async function dump427Block(reservationId) {
    const { browser, page } = await ensureCdpPage();
    try {
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'networkidle' });
        await ensureLogin(page);

        // Scroll to end to ensure all days load
        await page.evaluate(async () => {
            for(let i=0; i<10; i++) {
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
        });

        const data = await page.evaluate(() => {
            const days = Array.from(document.querySelectorAll('.itinerary-day, .day-container, section, .day-block, .daily-itinerary'));
            const day427 = days.find(d => d.innerText.includes('April 27'));
            if (!day427) return "427 NOT FOUND";

            const btn = Array.from(day427.querySelectorAll('button, a, [role="button"], span')).find(el => el.innerText.includes('Add Activities'));
            
            let btnStatus = "NOT FOUND";
            let styles = {};
            if (btn) {
                const s = window.getComputedStyle(btn);
                btnStatus = "FOUND";
                styles = {
                    color: s.color,
                    opacity: s.opacity,
                    pointerEvents: s.pointerEvents,
                    cursor: s.cursor,
                    display: s.display,
                    visibility: s.visibility
                };
                // Also check parent/children
                const parentStyle = window.getComputedStyle(btn.parentElement);
                styles.parentColor = parentStyle.color;
            }

            return {
                html: day427.outerHTML,
                btnStatus,
                styles
            };
        });

        console.log(JSON.stringify(data, null, 2));
    } finally {
        if (browser) await browser.close();
    }
}

dump427Block("44079507");
