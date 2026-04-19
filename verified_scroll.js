const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function verifiedScrollAndClick(reservationId, targetDate) {
    const { browser, page } = await ensureCdpPage();
    try {
        console.log("🚀 Navigating to My Plans...");
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ensureLogin(page);

        const dateObj = new Date(targetDate);
        const dateString = `${dateObj.toLocaleString('en-US', { month: 'long' })} ${dateObj.getDate()}`;
        console.log(`🎯 Target Date: ${dateString}`);

        // Step 1: Precise Scroll and Highlight
        const scrollResult = await page.evaluate(async (dStr) => {
            const findDayBlock = () => {
                const headers = Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'));
                const header = headers.find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
                if (header) {
                    // Go up to the container level (the whole day card)
                    const block = header.closest('day-view, .itinerary-day, .day-container, section');
                    return { header, block };
                }
                return null;
            };

            for (let i = 0; i < 20; i++) {
                const found = findDayBlock();
                if (found) {
                    found.block.scrollIntoView({ block: 'center' });
                    // VISUAL PROOF: Highlight the block
                    found.block.style.border = "10px solid #FF0000";
                    found.block.style.backgroundColor = "#CCFFCC";
                    found.header.style.fontSize = "30px";
                    found.header.style.color = "red";
                    return { status: "FOUND", text: found.header.innerText };
                }
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
            return { status: "NOT_FOUND" };
        }, dateString);

        console.log(`Scroll Result: ${scrollResult.status} (${scrollResult.text})`);

        if (scrollResult.status === "FOUND") {
            // Screenshot A: Proof of correct scroll and highlight
            const proofPathA = path.join(process.env.HOME, '.disney-cruise', 'debug', `proof_A_scroll_${targetDate}.png`);
            await page.screenshot({ path: proofPathA });
            console.log(`📸 Proof A (Scroll/Highlight) saved: ${proofPathA}`);

            // Step 2: Click button ONLY within that highlighted block
            const clickResult = await page.evaluate((dStr) => {
                const block = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container, section'))
                                   .find(el => el.innerText.includes(dStr) && el.style.border.includes('rgb(255, 0, 0)'));
                
                if (block) {
                    const btn = Array.from(block.querySelectorAll('a, button, [role="button"]'))
                                     .find(el => el.innerText.includes('Add Activities'));
                    if (btn) {
                        btn.click();
                        return "CLICKED";
                    }
                    return "BTN_NOT_FOUND_IN_BLOCK";
                }
                return "BLOCK_LOST";
            }, dateString);

            console.log(`Click Action: ${clickResult}`);

            if (clickResult === "CLICKED") {
                await page.waitForTimeout(4000);
                // Screenshot B: The menu
                const proofPathB = path.join(process.env.HOME, '.disney-cruise', 'debug', `proof_B_menu_${targetDate}.png`);
                await page.screenshot({ path: proofPathB });
                console.log(`📸 Proof B (Menu) saved: ${proofPathB}`);
            }
        }

    } catch (err) {
        console.error("Execution error:", err);
    } finally {
        if (browser) await browser.close();
    }
}

verifiedScrollAndClick("44079507", "2026-04-27");
