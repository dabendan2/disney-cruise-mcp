const { getPage } = require('../browser/engine');
const { waitForAngular } = require('../browser/stability');
const { checkPageStatus, ensureLogin } = require('./session');
const { logTime, saveDebug } = require('../utils/debug');
const { SELECTORS } = require('../constants');

async function navigateUrl(url, reservationId, waitForSelector) {
    const { browser, page } = await getPage();
    try {
        for (let attempt = 1; attempt <= 2; attempt++) {
            logTime(`Nav Attempt ${attempt}: ${url}`);
            
            // PHASE 1: Pre-navigation check
            let status = await checkPageStatus(page, reservationId);
            
            // If current page is a Stitch error, try to recover by logging in
            if (status === "STITCH_ERROR" || status !== "LOGGED_IN") {
                logTime("Pre-nav check: Session invalid or Stitch error. Attempting recovery/login...");
                await ensureLogin(page, reservationId);
            }
            
            // PHASE 2: Actual Navigation
            logTime(`Executing page.goto to target URL...`);
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(async (e) => {
                const path = await saveDebug(page, "nav_goto_error");
                throw new Error(`STRICT FAIL: Navigation error (${e.message}). Evidence: ${path}`);
            });

            // PHASE 3: Post-navigation validation
            status = await checkPageStatus(page, reservationId);
            
            // If we get a Stitch error AFTER navigating to the correct URL, this is a real problem (ID/Date error)
            if (status === "STITCH_ERROR") {
                const path = await saveDebug(page, "post_nav_stitch_error");
                throw new Error(`STRICT FAIL: DCL 404 Error (Stitch) at target URL. This reservation or date may be invalid. URL: ${page.url()}, Evidence: ${path}`);
            }

            if (status !== "LOGGED_IN") {
                logTime("Post-nav check: Session lost during navigation. Retrying login...");
                await ensureLogin(page, reservationId);
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
                status = await checkPageStatus(page, reservationId);
                
                if (status === "STITCH_ERROR") {
                    const path = await saveDebug(page, "post_retry_stitch_error");
                    throw new Error(`STRICT FAIL: DCL 404 Error (Stitch) after login retry. URL: ${page.url()}, Evidence: ${path}`);
                }
            }

            if (status === "LOGGED_IN") {
                await waitForAngular(page);
                if (waitForSelector) {
                    await page.waitForSelector(waitForSelector, { timeout: 40000 }).catch(async () => {
                        const path = await saveDebug(page, "selector_not_found");
                        throw new Error(`STRICT FAIL: Required element '${waitForSelector}' not found. Evidence: ${path}`);
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
