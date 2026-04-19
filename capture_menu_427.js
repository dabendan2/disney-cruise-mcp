const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function captureMenu427(reservationId) {
    const { browser, page } = await ensureCdpPage();
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    
    try {
        console.log(`🚀 Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("🔑 Handling login...");
        await ensureLogin(page);

        console.log(`🔍 Locating April 27 section and clicking button...`);
        
        const clickResult = await page.evaluate(async () => {
            const findAndScroll = () => {
                const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, .itinerary-day-header, .day-label, div, span'));
                const target = elements.find(el => el.innerText.includes('April 27') && el.offsetParent !== null);
                if (target) {
                    target.scrollIntoView({ block: 'center' });
                    return target;
                }
                return null;
            };

            // Slow scroll to load content
            let header = null;
            for (let i = 0; i < 15; i++) {
                header = findAndScroll();
                if (header) break;
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }

            if (header) {
                // Now find the button specifically in the container following this header
                // We'll look for the next sibling or container that has 'Add Activities'
                let container = header.parentElement;
                // Go up a few levels to find the day block
                for(let j=0; j<5; j++) {
                    if (container.innerText.includes('Add Activities')) break;
                    container = container.parentElement;
                }

                const btn = Array.from(container.querySelectorAll('button, a, [role="button"], span'))
                                 .find(el => el.innerText.includes('Add Activities'));
                
                if (btn) {
                    btn.style.border = "5px solid blue";
                    btn.click();
                    return "CLICKED";
                }
                return "HEADER_FOUND_BUT_NO_BTN";
            }
            return "NOT_FOUND";
        });

        console.log(`Action Result: ${clickResult}`);
        
        if (clickResult === "CLICKED") {
            console.log("⏳ Waiting for menu to hydrate...");
            await page.waitForTimeout(4000); 
            
            const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `menu_open_427.png`);
            await page.screenshot({ path: screenshotPath });
            console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        } else {
            console.error(`Failed: ${clickResult}`);
            await page.screenshot({ path: path.join(process.env.HOME, '.disney-cruise', 'debug', `menu_failed_427.png`) });
        }

    } catch (err) {
        console.error("Script error:", err);
    } finally {
        if (browser) await browser.close();
    }
}

captureMenu427("44079507").catch(console.error);
