const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');

async function inspectDomConflict(reservationId) {
    const { browser, page } = await ensureCdpPage();
    try {
        console.log("🚀 Navigating to My Plans...");
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ensureLogin(page);

        const daysToInspect = ["April 23", "April 27"];
        const finalResults = {};

        for (const dateText of daysToInspect) {
            console.log(`\n--- Inspecting Popover for ${dateText} ---`);
            
            const popoverContent = await page.evaluate(async (dStr) => {
                const findDayBlock = () => Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container'))
                                             .find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
                
                let block = findDayBlock();
                if (!block) {
                    // Scroll to find
                    for (let i = 0; i < 15; i++) {
                        window.scrollBy(0, 1000);
                        await new Promise(r => setTimeout(r, 1000));
                        block = findDayBlock();
                        if (block) break;
                    }
                }

                if (!block) return "BLOCK NOT FOUND";
                block.scrollIntoView({ block: 'center' });
                await new Promise(r => setTimeout(r, 1000));

                const btn = Array.from(block.querySelectorAll('a, button, [role="button"]'))
                                 .find(el => el.innerText.includes('Add Activities'));
                
                if (!btn) return "BTN NOT FOUND";
                
                // Record Button ID to be sure
                const btnId = btn.id;
                btn.click();
                
                // Wait for any popover to appear
                await new Promise(r => setTimeout(r, 3000));
                
                // Inspect ALL popovers in the DOM (even hidden ones)
                const modals = Array.from(document.querySelectorAll('.add-plans-modal, .popover-content'));
                const visibleModal = modals.find(m => m.offsetParent !== null) || modals[modals.length - 1];
                
                if (!visibleModal) return "NO MODAL FOUND IN DOM";

                const rows = Array.from(visibleModal.querySelectorAll('.add-plans-row'));
                const rowData = rows.map(r => {
                    const anchor = r.querySelector('a');
                    return {
                        text: r.innerText.replace(/\n/g, ' ').trim(),
                        href: anchor ? anchor.getAttribute('href') : "NO_HREF",
                        classes: r.className,
                        htmlSnippet: r.outerHTML.substring(0, 150)
                    };
                });

                // Close popover
                const closeBtn = document.querySelector('.popover-close-button, .close-button');
                if (closeBtn) closeBtn.click();
                await new Promise(r => setTimeout(r, 1000));

                return {
                    clickedBtnId: btnId,
                    rowCount: rows.length,
                    rows: rowData
                };
            }, dateText);

            finalResults[dateText] = popoverContent;
        }

        console.log("=== FINAL DOM INSPECTION COMPARISON ===");
        console.log(JSON.stringify(finalResults, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        if (browser) await browser.close();
    }
}

inspectDomConflict("44079507");
