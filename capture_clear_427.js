const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function captureClear427(reservationId) {
    const { browser, page } = await ensureCdpPage();
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    
    try {
        console.log(`🚀 Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("🔑 Handling login...");
        await ensureLogin(page);

        console.log(`🔍 Locating April 27 section...`);
        
        // Scroll and highlight
        const result = await page.evaluate(async () => {
            const findAndScroll = () => {
                const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, .itinerary-day-header, .day-label, div, span'));
                const target = elements.find(el => el.innerText.includes('April 27') && el.offsetParent !== null);
                if (target) {
                    target.scrollIntoView({ block: 'center' });
                    target.style.border = "10px solid red";
                    target.style.backgroundColor = "yellow";
                    return true;
                }
                return false;
            };

            // Slow scroll to trigger lazy loading
            for (let i = 0; i < 15; i++) {
                if (findAndScroll()) return "FOUND";
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
            return "NOT_FOUND";
        });

        console.log(`Result: ${result}`);
        await page.waitForTimeout(3000); // Settle

        const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `clear_view_427.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    } catch (err) {
        console.error("Script error:", err);
    } finally {
        if (browser) await browser.close();
    }
}

captureClear427("44079507").catch(console.error);
