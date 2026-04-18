const { logTime, saveDebug } = require('../utils/debug');
const { MailOTP } = require('../utils/otp');
const { SELECTORS } = require('../constants');
const { checkLoginStatus } = require('../utils/ui_logic');
const { ensureCdpPage } = require('../browser/engine');
const os = require('os');

const otpService = new MailOTP();

/**
 * Returns the current CPU load average (1 minute)
 */
function getCpuLoad() {
    return os.loadavg()[0];
}

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
            const baseStorage = {
                localStorage: { ...localStorage },
                sessionStorage: { ...sessionStorage }
            };
            results.push({ origin: window.location.origin, ...baseStorage });
        } catch (e) {}
        return results;
    });
    
    return { ...storage, cookies, webStorage: origins };
}

/**
 * Universal State Machine based login process.
 * Removes obstacles until "login_not_needed" is confirmed after hydration.
 */
async function ensureLogin(page) {
    const startTime = Date.now();
    const totalTimeout = 120000; // 2 minutes total
    const actionTimeout = 30000; // 30 seconds per action
    let unknownCount = 0;

    logTime("🚀 Starting ensureLogin state machine...");

    // PRE-CHECK: Wait for page to have some content (avoid blank shell issues)
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

        // Determine status: Iframe takes priority if it contains login forms
        let status = checkLoginStatus(mainHtml);
        if (iframeHtml) {
            const iframeStatus = checkLoginStatus(iframeHtml);
            // If the iframe has a specific state, it ALWAYS overrides the generic main page state.
            if (iframeStatus !== "UNKNOWN") {
                status = iframeStatus;
            }
        }

        logTime(`[STATE] Current status: ${status}`);

        if (status === "PAGE_ERROR") {
            const path = await saveDebug(page, "system_page_error");
            throw new Error(`STRICT FAIL: Disney system error detected (PAGE_ERROR). Evidence: ${path}`);
        }

        // Handle "No Login Required" (UNKNOWN) with Settle Sequence
        if (status === "UNKNOWN") {
            if (unknownCount === 0) {
                logTime("[STATE] UNKNOWN (Initial Detect). Starting hydration settle sequence...");
                unknownCount = 1;

                // 1. Wait for document load
                await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});

                // 2. Unconditional 2s wait
                await new Promise(r => setTimeout(r, 2000));

                // 3. Wait for CPU < 2.5 (Max 30s)
                const cpuStart = Date.now();
                while (Date.now() - cpuStart < 30000) {
                    const load = getCpuLoad();
                    if (load < 2.5) {
                        logTime(`[SETTLE] CPU Load stabilized: ${load.toFixed(2)}`);
                        break;
                    }
                    await new Promise(r => setTimeout(r, 1000));
                }

                // 4. Wait for DOM Silence (Hydration Events)
                logTime("[SETTLE] Waiting for DOM silence (2s window)...");
                await page.evaluate(() => {
                    window.__hermes_dom_ts = Date.now();
                    const obs = new MutationObserver(() => { window.__hermes_dom_ts = Date.now(); });
                    obs.observe(document, { attributes: true, childList: true, subtree: true });
                }).catch(() => {});

                const domStart = Date.now();
                while (Date.now() - domStart < 30000) {
                    const idleTime = await page.evaluate(() => Date.now() - window.__hermes_dom_ts).catch(() => 9999);
                    if (idleTime > 2000) {
                        logTime("✅ [SETTLE] DOM Silence achieved.");
                        break;
                    }
                    await new Promise(r => setTimeout(r, 500));
                }

                logTime("[SETTLE] Sequence complete. Verifying final state...");
                continue; // Back to top of loop for second check
            } else {
                logTime("✅ UNKNOWN confirmed. Finalizing session.");
                const state = await getStorageState(page);
                return { status: "SUCCESS", state };
            }
        }

        // We hit an obstacle (Login/OTP), reset settle counter
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
                default:
                    logTime(`[WARN] Unhandled status: ${status}. Waiting...`);
                    break;
            }
        } catch (e) {
            const path = await saveDebug(page, `action_fail_${status}`);
            throw new Error(`STRICT FAIL: Action failed for ${status}: ${e.message}. Evidence: ${path}`);
        }
        await new Promise(r => setTimeout(r, 5000));
    }
    const path = await saveDebug(page, "ensure_login_timeout");
    throw new Error(`STRICT FAIL: ensureLogin timed out after ${totalTimeout/1000}s. Evidence: ${path}`);
}

async function verifySession(reservationId) {
    const { browser, page } = await ensureCdpPage();
    try {
        const result = await ensureLogin(page);
        return result;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

module.exports = { checkLoginStatus, ensureLogin, verifySession, getCpuLoad };
