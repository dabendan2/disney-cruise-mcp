require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { navigateUrl } = require('./src/automation/navigation');
const { saveDebug, logTime } = require('./src/utils/debug');
const { SELECTORS } = require('./src/constants');

async function experimentScroll() {
    const reservationId = "44079507";
    const slug = "SPAANDFITNESS";
    const date = "2026-04-23";
    const activityName = "60-Minute Fitness Appointment";
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/${slug}/${date}/?ship=DA&port=SIN`;

    console.log(`[EXP] Testing optimized scroll for: ${activityName}`);
    
    const navResult = await navigateUrl(targetUrl, reservationId);
    const { page, browser } = navResult;

    try {
        logTime("Starting optimized scan...");
        
        // Strategy: Use locator to find by text and scroll directly
        const card = page.locator(SELECTORS.ACTIVITY_CARD).filter({ hasText: new RegExp(activityName, "i") }).first();
        
        // 1. Quick check if it's already there
        let found = await card.isVisible().catch(() => false);
        
        if (!found) {
            logTime("Not visible. Starting fast binary-style scroll...");
            for (let i = 0; i < 5; i++) {
                console.log(`[EXP] Fast Scroll Attempt ${i+1}`);
                // Scroll more aggressively
                await page.evaluate(() => window.scrollBy(0, 1500));
                // Wait much less (just enough for lazy loading)
                await new Promise(r => setTimeout(r, 1500));
                
                if (await card.count() > 0) {
                    const isVisible = await card.isVisible();
                    if (isVisible) {
                        console.log("[EXP] Card located!");
                        found = true;
                        break;
                    }
                }
            }
        }

        if (found) {
            logTime("Found! Scrolling into view...");
            await card.scrollIntoViewIfNeeded();
            // Wait a tiny bit for the UI to settle after scroll
            await new Promise(r => setTimeout(r, 1000));
            
            const path = await saveDebug(page, "optimized_scroll_success");
            console.log(`[EXP] Success! Screenshot: ${path}`);
            
            const text = await card.innerText();
            console.log(`[EXP] Card Text: ${text.substring(0, 100)}...`);
        } else {
            console.log("[EXP] Still failed to find the card.");
            await saveDebug(page, "optimized_scroll_failed");
        }

        await browser.close();
    } catch (e) {
        console.error(`[EXP] Error: ${e.message}`);
        if (browser) await browser.close();
    }
}

experimentScroll();
