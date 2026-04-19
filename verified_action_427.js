const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function verifiedAction427(reservationId, targetDate) {
    const { browser, page } = await ensureCdpPage();
    try {
        console.log("🚀 Navigating to My Plans...");
        await page.goto(`https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await ensureLogin(page);

        const dateObj = new Date(targetDate);
        const dateString = `${dateObj.toLocaleString('en-US', { month: 'long' })} ${dateObj.getDate()}`;
        console.log(`🎯 Targeting Date: ${dateString}`);

        // Precise Location and Highlighting
        const result = await page.evaluate(async (dStr) => {
            const findDayBlock = () => {
                const headers = Array.from(document.querySelectorAll('h2, h3, .itinerary-day-header, .day-label, p'));
                const header = headers.find(el => el.innerText.includes(dStr) && el.offsetParent !== null);
                if (header) {
                    const block = header.closest('day-view, .itinerary-day, .day-container, section');
                    return { header, block };
                }
                return null;
            };

            for (let i = 0; i < 20; i++) {
                const found = findDayBlock();
                if (found) {
                    found.block.scrollIntoView({ block: 'center' });
                    // VISUAL PROOF: Highlight ONLY this block
                    found.block.style.border = "12px solid red";
                    found.block.style.boxShadow = "0 0 50px red";
                    
                    const btn = Array.from(found.block.querySelectorAll('a, button, [role="button"]'))
                                     .find(el => el.innerText.includes('Add Activities'));
                    if (btn) {
                        btn.style.outline = "10px solid blue";
                        btn.style.backgroundColor = "yellow";
                        return { status: "READY", btnHtml: btn.outerHTML, headerText: found.header.innerText };
                    }
                    return { status: "HEADER_FOUND_NO_BTN" };
                }
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 1000));
            }
            return { status: "NOT_FOUND" };
        }, dateString);

        console.log("Locate Result:", result);

        if (result.status === "READY") {
            // Screenshot 1: Proof of targeting the specific button in the specific day
            const proofPathPre = path.join(process.env.HOME, '.disney-cruise', 'debug', `verified_target_427_pre.png`);
            await page.screenshot({ path: proofPathPre });
            console.log(`📸 PRE-CLICK Screenshot (Targeting Verification): ${proofPathPre}`);

            // Perform Click
            await page.evaluate((dStr) => {
                const block = Array.from(document.querySelectorAll('day-view, .itinerary-day, .day-container, section'))
                                   .find(el => el.innerText.includes(dStr) && el.style.border.includes('red'));
                const btn = Array.from(block.querySelectorAll('a, button, [role="button"]'))
                                 .find(el => el.innerText.includes('Add Activities'));
                if (btn) btn.click();
            }, dateString);

            console.log("⏳ Waiting for menu...");
            await page.waitForTimeout(4000);

            // Screenshot 2: Proof of what popped up
            const proofPathPost = path.join(process.env.HOME, '.disney-cruise', 'debug', `verified_target_427_post.png`);
            await page.screenshot({ path: proofPathPost });
            console.log(`📸 POST-CLICK Screenshot (Menu Result): ${proofPathPost}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        if (browser) await browser.close();
    }
}

verifiedAction427("44079507", "2026-04-27");
