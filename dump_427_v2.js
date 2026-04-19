const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');

async function dump427Detailed(reservationId, targetDateText) {
    const { browser, page } = await ensureCdpPage();
    try {
        console.log(`🚀 Navigating to My Plans for res ${reservationId}...`);
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ensureLogin(page);

        console.log(`🔍 Scrolling to find "${targetDateText}"...`);
        const blockData = await page.evaluate(async (dStr) => {
            const findDayBlock = () => {
                const headers = Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'));
                const header = headers.find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
                if (header) {
                    const block = header.closest('day-view, .itinerary-day, .day-container, section');
                    return block;
                }
                return null;
            };

            for (let i = 0; i < 20; i++) {
                const block = findDayBlock();
                if (block) {
                    block.scrollIntoView({ block: 'center' });
                    return { html: block.outerHTML, text: block.innerText };
                }
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
            return null;
        }, targetDateText);

        if (!blockData) {
            console.log("❌ 4/27 Block not found.");
            return;
        }

        console.log("=== 4/27 DAY BLOCK HTML (Snippet) ===");
        console.log(blockData.html.substring(0, 1000) + "...");

        console.log("🖱️ Clicking Add Activities in 4/27 block...");
        await page.evaluate((dStr) => {
            const block = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container, section'))
                               .find(el => el.innerText.includes(dStr));
            const btn = Array.from(block.querySelectorAll('a, button, [role="button"]'))
                             .find(el => el.innerText.includes('Add Activities'));
            if (btn) btn.click();
        }, targetDateText);

        await page.waitForTimeout(4000);

        const modalData = await page.evaluate(() => {
            const modal = document.querySelector('.add-plans-modal:not([aria-hidden="true"]), .popover:not([aria-hidden="true"]), .wdpr-popover:not([aria-hidden="true"])');
            if (!modal) return "MODAL NOT FOUND";
            
            // Map rows and their styles
            const rows = Array.from(modal.querySelectorAll('.add-plans-row'));
            const rowInfo = rows.map(row => {
                const title = row.querySelector('.add-plans-option-title')?.innerText || row.innerText;
                const style = window.getComputedStyle(row.querySelector('.row-disabled, .row-enabled') || row);
                return {
                    text: title.trim(),
                    html: row.outerHTML,
                    color: style.color,
                    classes: row.className + " " + (row.firstChild?.className || "")
                };
            });
            
            return {
                outerHTML: modal.outerHTML,
                rows: rowInfo
            };
        });

        console.log("=== MODAL CONTENT ANALYSIS ===");
        console.log(JSON.stringify(modalData.rows, null, 2));
        
        console.log("=== FULL MODAL HTML ===");
        console.log(modalData.outerHTML);

    } catch (err) {
        console.error(err);
    } finally {
        if (browser) await browser.close();
    }
}

dump427Detailed("44079507", "April 27");
