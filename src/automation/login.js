const { logTime, saveDebug } = require('../utils/debug');
const { MailOTP } = require('../utils/otp');
const { SELECTORS } = require('../constants');
const { checkLoginStatus } = require('../utils/ui_logic');
const { ensureCdpPage } = require('../browser/engine');
const { getCpuLoad } = require('../utils/system');

const otpService = new MailOTP();

/**
 * Capture full session state (Cookies + Storage)
 */
async function getStorageState(page) {
    let cookies = [];
    try {
        const client = await page.context().newCDPSession(page);
        const { cookies: cdpCookies } = await client.send('Network.getAllCookies');
        cookies = cdpCookies.map(c => {
            const sanitized = { ...c };
            if (sanitized.partitionKey && typeof sanitized.partitionKey === 'object') {
                delete sanitized.partitionKey;
            }
            return sanitized;
        });
        await client.detach();
    } catch (e) {
        logTime(`[WARN] CDP cookie extraction failed: ${e.message}. Falling back to standard.`);
        cookies = await page.context().cookies();
    }
    
    const storage = await page.context().storageState();
    const origins = await page.evaluate(() => {
        const results = [];
        try {
            results.push({ 
                origin: window.location.origin, 
                localStorage: { ...localStorage }, 
                sessionStorage: { ...sessionStorage }
            });
        } catch (e) {}
        return results;
    });
    
    return { ...storage, cookies, webStorage: origins };
}

/**
 * Universal State Machine based login process.
 */
async function ensureLogin(page) {
    const startTime = Date.now();
    const totalTimeout = 120000;
    const actionTimeout = 30000;
    let unknownCount = 0;

    logTime("🚀 Starting ensureLogin state machine...");

    try {
        await page.waitForSelector('main, header, footer, #oneid-wrapper, input', { state: 'attached', timeout: 15000 });
    } catch (e) {
        logTime("[WARN] Initial content check timed out. Proceeding anyway...");
    }

    while (Date.now() - startTime < totalTimeout) {
        let mainHtml = "";
        let iframeHtml = "";

        try {
            mainHtml = await page.content();
            const frameHandle = await page.$(SELECTORS.ONEID_IFRAME);
            if (frameHandle) {
                const frame = await frameHandle.contentFrame();
                if (frame) iframeHtml = await frame.content().catch(() => "");
            }
        } catch (e) {
            logTime(`[WARN] Content fetch failed (likely navigating): ${e.message}`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
        }

        let status = checkLoginStatus(mainHtml);
        if (iframeHtml) {
            const iframeStatus = checkLoginStatus(iframeHtml);
            if (iframeStatus !== "UNKNOWN") status = iframeStatus;
        }

        logTime(`[STATE] Current status: ${status}`);

        if (status === "PAGE_ERROR_500") {
            const path = await saveDebug(page, "system_page_error_500");
            throw new Error(`STRICT FAIL: Disney system error detected (PAGE_ERROR_500). Evidence: ${path}`);
        }

        if (status === "PAGE_ERROR_404") {
            const path = await saveDebug(page, "nav_error_404");
            throw new Error(`STRICT FAIL: 404 Error (Someone Ate the Page!) detected at URL: ${page.url()}. Please check correctness of your URL, and do not retry again with the same URL. Evidence: ${path}`);
        }

        if (status === "UNKNOWN") {
            if (unknownCount === 0) {
                logTime("[STATE] UNKNOWN (Initial Detect). Starting hydration settle sequence...");
                unknownCount = 1;

                await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
                await new Promise(r => setTimeout(r, 2000));

                const cpuStart = Date.now();
                while (Date.now() - cpuStart < 30000) {
                    const load = getCpuLoad();
                    if (load < 2.5) break;
                    await new Promise(r => setTimeout(r, 1000));
                }

                logTime("[SETTLE] Waiting for DOM silence (2s window)...");
                await page.evaluate(() => {
                    window.__hermes_dom_ts = Date.now();
                    const obs = new MutationObserver(() => { window.__hermes_dom_ts = Date.now(); });
                    obs.observe(document, { attributes: true, childList: true, subtree: true });
                }).catch(() => {});

                const domStart = Date.now();
                while (Date.now() - domStart < 30000) {
                    const idleTime = await page.evaluate(() => Date.now() - window.__hermes_dom_ts).catch(() => 9999);
                    if (idleTime > 2000) break;
                    await new Promise(r => setTimeout(r, 500));
                }

                logTime("[SETTLE] Sequence complete. Waiting for loading spinner to hide...");
                await page.waitForSelector('wdpr-loading-spinner', { state: 'hidden', timeout: 30000 }).catch(() => {});
                
                logTime("[SETTLE] Final verification...");
                continue; // Re-evaluate status after spinner and settle
            } else {
                logTime("✅ UNKNOWN confirmed. Finalizing session.");
                const state = await getStorageState(page);
                return { status: "SUCCESS", state };
            }
        }

        unknownCount = 0; 

        if (status === "LOGIN1_ERR") {
            const path = await saveDebug(page, "login_err_state");
            throw new Error(`STRICT FAIL: Login error state detected (LOGIN1_ERR). Evidence: ${path}`);
        }

        const frame = page.frameLocator(SELECTORS.ONEID_IFRAME);
        try {
            switch (status) {
                case "LOGIN1": {
                    logTime("[ACTION] LOGIN1: Submitting Email...");
                    const input = frame.locator(SELECTORS.LOGIN_INPUTS.join(', ')).first();
                    const btn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();
                    await input.waitFor({ state: 'visible', timeout: actionTimeout });
                    await input.fill(process.env.DISNEY_EMAIL);
                    await btn.click();
                    break;
                }
                case "LOGIN1_PWD": {
                    logTime("[ACTION] LOGIN1_PWD: Submitting Password...");
                    const input = frame.locator(SELECTORS.PASSWORD_INPUTS.join(', ')).first();
                    const btn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();
                    await input.waitFor({ state: 'visible', timeout: actionTimeout });
                    await input.fill(process.env.DISNEY_PASSWORD);
                    await btn.click();
                    break;
                }
                case "LOGIN2": {
                    logTime("[ACTION] LOGIN2: Submitting Credentials...");
                    const email = frame.locator(SELECTORS.LOGIN_INPUTS.join(', ')).first();
                    const pwd = frame.locator(SELECTORS.PASSWORD_INPUTS.join(', ')).first();
                    const btn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();
                    if (await email.isVisible({ timeout: 2000 }).catch(() => false)) {
                        await email.fill(process.env.DISNEY_EMAIL);
                    }
                    await pwd.waitFor({ state: 'visible', timeout: actionTimeout });
                    await pwd.fill(process.env.DISNEY_PASSWORD);
                    await btn.click();
                    break;
                }
                case "OTP1":
                case "OTP2": {
                    logTime(`[ACTION] ${status}: Polling Gmail for OTP...`);
                    const code = await otpService.poll(actionTimeout * 2); 
                    const input = frame.locator(SELECTORS.OTP_INPUTS.join(', ')).first();
                    const btn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();
                    await input.waitFor({ state: 'visible', timeout: actionTimeout });
                    await input.fill(code);
                    await btn.click();
                    break;
                }
            }
        } catch (e) {
            const path = await saveDebug(page, `action_fail_${status}`);
            throw new Error(`STRICT FAIL: Action failed for ${status}: ${e.message}. Evidence: ${path}`);
        }
        await new Promise(r => setTimeout(r, 5000));
    }
    const path = await saveDebug(page, "ensure_login_timeout");
    throw new Error(`STRICT FAIL: ensureLogin timed out. Evidence: ${path}`);
}

async function verifySession(reservationId) {
    const { browser, page } = await ensureCdpPage();
    try {
        return await ensureLogin(page);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

module.exports = { ensureLogin, verifySession };
