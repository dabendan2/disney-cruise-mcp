const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function debugCdpScroll(reservationId, targetDateText) {
    const { browser, page } = await ensureCdpPage();
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    
    try {
        console.log(`🚀 Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("🔑 Handling login...");
        await ensureLogin(page);

        console.log(`🔍 Searching for element containing "${targetDateText}"...`);
        
        let found = false;
        let rect = null;

        for (let i = 0; i < 25; i++) {
            rect = await page.evaluate((text) => {
                const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, .itinerary-day-header, .day-label, div, span'));
                const target = elements.find(el => el.innerText.includes(text) && el.offsetParent !== null);
                if (target) {
                    target.style.border = "5px solid red";
                    const r = target.getBoundingClientRect();
                    return { y: r.top + window.scrollY, text: target.innerText };
                }
                return null;
            }, targetDateText);

            if (rect) {
                console.log(`✅ Found "${targetDateText}" at Y: ${rect.y}.`);
                await page.evaluate((y) => window.scrollTo(0, y - 100), rect.y);
                await page.waitForTimeout(2000);
                found = true;
                break;
            }
            await page.evaluate(() => window.scrollBy(0, 1200));
            await page.waitForTimeout(1500);
        }

        if (found) {
            const buttonInfo = await page.evaluate((targetY) => {
                const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], span'));
                const addBtn = buttons.find(b => {
                    const r = b.getBoundingClientRect();
                    const absoluteY = r.top + window.scrollY;
                    return b.innerText.includes('Add Activities') && absoluteY >= targetY && absoluteY < targetY + 1000;
                });
                if (addBtn) {
                    addBtn.style.border = "5px solid blue";
                    addBtn.click(); // Direct JS click
                    const r = addBtn.getBoundingClientRect();
                    return { found: true, y: r.top + window.scrollY, text: addBtn.innerText };
                }
                return { found: false };
            }, rect.y);

            if (buttonInfo.found) {
                console.log(`🖱️ Clicked 'Add Activities' at Y: ${buttonInfo.y}`);
                console.log("⏳ Waiting for menu...");
                await page.waitForTimeout(5000);
                
                const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `cdp_scroll_success_427_final.png`);
                await page.screenshot({ path: screenshotPath });
                console.log(`📸 SUCCESS! Screenshot saved to: ${screenshotPath}`);
            } else {
                console.log("❌ Could not find button near header.");
            }
        }
    } catch (err) {
        console.error("Script error:", err);
    } finally {
        if (browser) await browser.close();
    }
}

debugCdpScroll("44079507", "April 27").catch(console.error);
