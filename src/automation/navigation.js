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
            let status = await checkPageStatus(page, reservationId);
            if (status !== "LOGGED_IN") await ensureLogin(page, reservationId);
            
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(async (e) => {
                const path = await saveDebug(page, "nav_goto_error");
                throw new Error(`STRICT FAIL: Navigation error (${e.message}). Evidence: ${path}`);
            });

            status = await checkPageStatus(page, reservationId);
            if (status !== "LOGGED_IN") {
                await ensureLogin(page, reservationId);
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
                status = await checkPageStatus(page, reservationId);
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
