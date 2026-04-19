const { ensureCdpPage } = require('./src/browser/engine');
const { ensureLogin } = require('./src/automation/session');
const path = require('path');

async function robustCapture427(reservationId) {
    const { browser, page } = await ensureCdpPage();
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    
    try {
        console.log(`🚀 Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("🔑 Handling login/overlays...");
        await ensureLogin(page);
        
        console.log("🔍 Scrolling to find April 27...");
        // Scroll step by step and check for text
        let found = false;
        for (let i = 0; i < 20; i++) {
            const hasText = await page.evaluate(() => document.body.innerText.includes('April 27'));
            if (hasText) {
                console.log("✅ Found April 27 text in DOM.");
                found = true;
                break;
            }
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(1000);
        }

        if (found) {
            // Find the Add Activities link specifically after the April 27 text
            // We use a locator that filters by proximity or structure
            const addBtn = page.locator('div, section, li').filter({ hasText: /April 27/ }).locator('text=Add Activities').first();
            
            if (await addBtn.isVisible()) {
                console.log("🖱️ Clicking Add Activities for April 27...");
                await addBtn.scrollIntoViewIfNeeded();
                await page.waitForTimeout(1000);
                await addBtn.click({ force: true });
                console.log("⏳ Waiting for menu to pop up...");
                await page.waitForTimeout(4000);
                
                const screenshotPath = path.join(process.env.HOME, '.disney-cruise', 'debug', `final_427_menu_success.png`);
                await page.screenshot({ path: screenshotPath });
                console.log(`📸 SUCCESS! Screenshot saved to: ${screenshotPath}`);
            } else {
                console.log("❌ Could not find the button link even though date text exists.");
                await page.screenshot({ path: path.join(process.env.HOME, '.disney-cruise', 'debug', `final_427_failed_btn.png`) });
            }
        } else {
            console.log("❌ Could not find April 27 text after scrolling.");
        }
    } finally {
        if (browser) await browser.close();
    }
}

robustCapture427("44079507").catch(console.error);
