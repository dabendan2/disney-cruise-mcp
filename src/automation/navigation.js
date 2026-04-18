const { ensureCdpPage } = require('../browser/engine');
const { waitForAngular } = require('../browser/stability');
const { checkPageStatus, ensureLogin } = require('./session');
const { logTime, saveDebug } = require('../utils/debug');

async function navigateUrl(url, reservationId, waitForSelector = null, timeout = 30000) {
    const { browser, page } = await ensureCdpPage();
    try {
        for (let attempt = 1; attempt <= 2; attempt++) {
            logTime(`Nav Attempt ${attempt}: ${url}`);
            let status = await checkPageStatus(page, reservationId);
            if (status === "PAGE_NOT_FOUND_ERROR" || status !== "LOGGED_IN") {
                logTime("Pre-nav session check failed. Logging in...");
                await ensureLogin(page, reservationId);
            }
            
            logTime(`Navigating to ${url} (Timeout: ${timeout}ms)...`);
            // Use provided timeout for navigation, but enforce a minimum for DCL stability
            const navTimeout = Math.max(timeout, 45000); 
            
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: navTimeout }).catch(async (e) => {
                const path = await saveDebug(page, "nav_goto_error");
                throw new Error(`STRICT FAIL: Navigation error (${e.message}). Evidence: ${path}`);
            });

            status = await checkPageStatus(page, reservationId);
            
            if (status === "PAGE_NOT_FOUND_ERROR") {
                const path = await saveDebug(page, "post_nav_page_not_found");
                throw new Error(`STRICT FAIL: DCL 404 Error (Page Not Found) at target URL. Evidence: ${path}`);
            }

            if (status !== "LOGGED_IN") {
                logTime("Session lost. Retrying login...");
                await ensureLogin(page, reservationId);
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: navTimeout });
                status = await checkPageStatus(page, reservationId);
            }

            if (status === "LOGGED_IN") {
                logTime("Logged in successfully. Attempting SPA stabilization...");
                // Non-strict Angular wait to avoid blocking on slow background calls
                await waitForAngular(page, 20000).catch(() => {
                    logTime("⌛ SPA stability check exceeded 20s, proceeding to content check...");
                });
                
                if (waitForSelector) {
                    logTime(`Checking for user-specified selector: '${waitForSelector}'...`);
                    try {
                        await page.waitForSelector(waitForSelector, { timeout: timeout });
                        logTime(`✅ Found selector: '${waitForSelector}'`);
                    } catch (e) {
                        const path = await saveDebug(page, "selector_not_found");
                        throw new Error(`STRICT FAIL: User-specified selector '${waitForSelector}' not found within ${timeout}ms. Evidence: ${path}`);
                    }
                } else {
                    logTime("No specific selector provided. Waiting for general content...");
                    await page.waitForSelector('app-root, .plans-container, [ng-app]', { timeout: 20000 }).catch(() => {
                        logTime("⌛ General content selectors not found, assuming page ready.");
                    });
                }
                
                return { browser, page, status: "SUCCESS", url: page.url() };
            }
        }
        throw new Error("Navigation retry exhausted.");
    } catch (e) {
        if (browser) await browser.close().catch(() => {});
        throw e;
    }
}

module.exports = { navigateUrl };
