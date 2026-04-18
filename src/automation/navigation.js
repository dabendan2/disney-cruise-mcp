const { ensureCdpPage } = require('../browser/engine');
const { checkLoginStatus, ensureLogin } = require('./session');
const { logTime, saveDebug } = require('../utils/debug');

/**
 * Universal Navigation with automatic login obstacle clearing.
 * Follows a loop: goto -> ensureLogin -> validate result.
 * 
 * @param {string} url Target URL
 * @param {string} reservationId Optional reservation ID (passed only for context in logs)
 * @param {string} waitForSelector Optional selector to wait for after navigation
 */
async function navigateUrl(url, reservationId, waitForSelector = null) {
    const { browser, page } = await ensureCdpPage();
    const actionTimeout = 30000;

    try {
        for (let attempt = 1; attempt <= 2; attempt++) {
            logTime(`[NAV] Attempt ${attempt}: Navigating to ${url}`);

            // 1. Perform Goto
            try {
                // Using domcontentloaded as a base signal
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: actionTimeout });
            } catch (e) {
                if (attempt === 2) {
                    const path = await saveDebug(page, "nav_goto_fail");
                    throw new Error(`STRICT FAIL: Navigation to ${url} timed out (30s) on attempt 2. Evidence: ${path}`);
                }
                logTime(`[NAV] Goto failed on attempt 1: ${e.message}. Retrying...`);
                continue;
            }

            // 2. Clear Obstacles (Login/OTP/CPU Stabilization)
            logTime("[NAV] Running ensureLogin to clear obstacles...");
            try {
                // ensureLogin now supports any page and removes obstacles until "login_not_needed"
                await ensureLogin(page);
            } catch (e) {
                if (attempt === 2) throw e;
                logTime(`[NAV] ensureLogin failed on attempt 1: ${e.message}. Retrying whole flow...`);
                continue;
            }

            // 3. Final Validation
            const currentUrl = page.url();
            const html = await page.content();
            const status = checkLoginStatus(html);
            
            logTime(`[NAV] Validation - URL: ${currentUrl}, Status: ${status}`);

            // Logic: URL should match base target AND status must be login_not_needed
            const baseTarget = url.split('?')[0].replace(/\/$/, '');
            const baseCurrent = currentUrl.split('?')[0].replace(/\/$/, '');
            const isUrlMatch = baseCurrent.includes(baseTarget) || baseTarget.includes(baseCurrent);
            const isReady = status === "UNKNOWN";

            if (isUrlMatch && isReady) {
                logTime(`✅ Navigation Successful (Ready State: ${status})`);
                
                if (waitForSelector) {
                    logTime(`[NAV] Waiting for specific selector: '${waitForSelector}'...`);
                    await page.waitForSelector(waitForSelector, { timeout: actionTimeout }).catch(async (e) => {
                        const path = await saveDebug(page, "selector_not_found");
                        throw new Error(`STRICT FAIL: Selector '${waitForSelector}' not found within 30s. Evidence: ${path}`);
                    });
                }
                
                return { browser, page, status: "SUCCESS", url: currentUrl };
            }

            // If we reached here, validation failed
            if (attempt === 2) {
                const path = await saveDebug(page, "nav_validation_failed");
                throw new Error(`STRICT FAIL: Navigation validation failed after 2 attempts. URL Match: ${isUrlMatch}, Status: ${status}. Evidence: ${path}`);
            }

            logTime("[NAV] Validation failed on attempt 1. Retrying...");
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        if (browser) await browser.close().catch(() => {});
        throw e;
    }
}

module.exports = { navigateUrl };
