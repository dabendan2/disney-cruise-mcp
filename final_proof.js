const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function finalMenuScreenshot(reservationId, date) {
    const { browser, page } = await ensureCdpPage();
    try {
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'networkidle' });
        await ensureLogin(page);

        const dateObj = new Date(date);
        const dateString = `${dateObj.toLocaleString('en-US', { month: 'long' })} ${dateObj.getDate()}`;
        
        await page.evaluate(async (dStr) => {
            const findHeader = () => Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'))
                                        .find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
            for (let i = 0; i < 20; i++) {
                const header = findHeader();
                if (header) {
                    header.scrollIntoView({ block: 'center' });
                    return true;
                }
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
            return false;
        }, dateString);

        await page.evaluate((dStr) => {
            const containers = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container, section'));
            const dayBlock = containers.find(el => el.innerText.includes(dStr));
            if (dayBlock) {
                const btn = Array.from(dayBlock.querySelectorAll('a, button, [role="button"]'))
                                 .find(el => el.innerText.includes('Add Activities'));
                if (btn) btn.click();
            }
        }, dateString);

        await page.waitForTimeout(4000);
        
        const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `final_menu_427_proof.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    } catch (err) {
        console.error(err);
    } finally {
        if (browser) await browser.close();
    }
}

finalMenuScreenshot("44079507", "2026-04-27");
