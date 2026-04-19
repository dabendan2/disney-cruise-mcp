const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const fs = require('fs');
const path = require('path');

async function inspectMenuStyles(reservationId, date) {
    const { browser, page } = await ensureCdpPage();
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    
    try {
        console.log(`🚀 Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ensureLogin(page);

        const dateObj = new Date(date);
        const month = dateObj.toLocaleString('en-US', { month: 'long' });
        const dateString = `${month} ${dateObj.getDate()}`;
        
        console.log(`🔍 Finding ${dateString}...`);
        await page.evaluate(async (dStr) => {
            const findHeader = () => Array.from(document.querySelectorAll('h1, h2, h3, h4, .itinerary-day-header, .day-label, div, span'))
                                        .find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
            
            for (let i = 0; i < 15; i++) {
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

        // Click Add Activities
        await page.evaluate((dStr) => {
            const dayBlock = Array.from(document.querySelectorAll('.itinerary-day, .day-container, section, .day-block, .daily-itinerary'))
                                  .find(el => el.innerText.includes(dStr));
            if (dayBlock) {
                const btn = Array.from(dayBlock.querySelectorAll('button, a, [role="button"], span'))
                                 .find(el => el.innerText.includes('Add Activities'));
                if (btn) btn.click();
            }
        }, dateString);

        console.log("⏳ Waiting for menu and inspecting...");
        await page.waitForTimeout(5000);

        const menuDetails = await page.evaluate(() => {
            const container = document.querySelector('.add-activities-menu, .popover, .dropdown-menu, .modal-content, .wdpr-popover, body');
            const items = Array.from(container.querySelectorAll('a, button, [role="button"], li'));
            
            return items.map(el => {
                const style = window.getComputedStyle(el);
                const text = el.innerText.trim();
                const isGray = style.color === 'rgb(128, 128, 128)' || style.color === 'rgb(153, 153, 153)' || style.color.includes('rgba(0, 0, 0, 0.4');
                const pointerEvents = style.pointerEvents;
                const opacity = style.opacity;
                
                return {
                    text,
                    tagName: el.tagName,
                    classes: el.className,
                    attributes: {
                        disabled: el.hasAttribute('disabled'),
                        ariaDisabled: el.getAttribute('aria-disabled'),
                        href: el.getAttribute('href')
                    },
                    computedStyle: {
                        color: style.color,
                        pointerEvents,
                        opacity
                    }
                };
            }).filter(i => i.text.length > 2);
        });

        console.log("=== MENU INSPECTION RESULTS ===");
        console.log(JSON.stringify(menuDetails, null, 2));
        
        // Save DOM snippet for unit test reference
        const menuHtml = await page.evaluate(() => {
             const menu = document.querySelector('.add-activities-menu, .popover, .dropdown-menu, .modal-content, .wdpr-popover');
             return menu ? menu.outerHTML : "MENU NOT FOUND";
        });
        fs.writeFileSync(path.join(__dirname, 'tests/res/MENU_INSPECTION.html'), menuHtml);

    } catch (err) {
        console.error(err);
    } finally {
        if (browser) await browser.close();
    }
}

inspectMenuStyles("44079507", "2026-04-27");
