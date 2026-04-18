const { logTime, saveDebug } = require('../utils/debug');
const { MailOTP } = require('../utils/otp');
const { URLS, SELECTORS, ERROR_INDICATORS, AUTH_MARKERS } = require('../constants');
const fs = require('fs');

const { ensureCdpPage } = require('../browser/engine');

const otpService = new MailOTP();

async function checkPageStatus(page, reservationId) {
    const url = page.url();
    let content = "";
    let title = "";
    try {
        content = await page.content();
        title = await page.title();
    } catch (e) {
        const path = await saveDebug(page, "page_access_error");
        throw new Error(`STRICT FAIL: Page inaccessible: ${e.message}. Evidence: ${path}`);
    }

    logTime(`[CHECK] URL: ${url}`);

    if (ERROR_INDICATORS.some(text => content.includes(text)) || title === "404" || url.includes("null/null/null")) {
        return "PAGE_NOT_FOUND_ERROR";
    }

    const isLoggedIn = AUTH_MARKERS.some(marker => content.includes(marker));
    const isReservationUrl = url.includes(URLS.RESERVATION_BASE) && (/\/\d{8}\//.test(url) || url.includes('/my-reservations'));
    if (isLoggedIn || isReservationUrl) {
        return "LOGGED_IN";
    }

    const frameElement = page.locator(SELECTORS.ONEID_IFRAME);
    if (await frameElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const frame = page.frameLocator(SELECTORS.ONEID_IFRAME);
        
        const otpInput = frame.locator(SELECTORS.OTP_INPUTS.join(', ')).first();
        if (await otpInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            return "OTP_SCREEN";
        }

        const errorText = await frame.locator(SELECTORS.ERROR_MESSAGES.join(', ')).innerText().catch(() => "");
        if (errorText.length > 5) {
            const path = await saveDebug(page, "login_error_detected");
            throw new Error(`STRICT FAIL: Login Error Detected: "${errorText}". Evidence: ${path}`);
        }

        const emailInput = frame.locator(SELECTORS.LOGIN_INPUTS.join(', ')).first();
        const passwordInput = frame.locator(SELECTORS.PASSWORD_INPUTS.join(', ')).first();
        
        const emailVisible = await emailInput.isVisible({ timeout: 1000 }).catch(() => false);
        const passwordVisible = await passwordInput.isVisible({ timeout: 1000 }).catch(() => false);

        if (emailVisible && passwordVisible) {
            return "LOGIN_SCREEN_BOTH";
        }
        if (emailVisible) {
            return "LOGIN_SCREEN";
        }
    }

    if (url.includes("/login")) return "LOGIN_SCREEN";
    if (url === "about:blank" || url.includes("chrome://")) return "NEED_LOGIN";

    return "UNKNOWN";
}

/**
 * Capture full session state (Cookies + Storage)
 * Uses CDP for cookies as standard Playwright cookies() often fails on existing browser connections
 */
async function getStorageState(page) {
    // Extract cookies via CDP Session for higher reliability on CDP connections
    let cookies = [];
    try {
        const client = await page.context().newCDPSession(page);
        const { cookies: cdpCookies } = await client.send('Network.getAllCookies');
        // Sanitize cookies for Playwright compatibility (especially partitionKey)
        cookies = cdpCookies.map(c => {
            const sanitized = { ...c };
            if (sanitized.partitionKey && typeof sanitized.partitionKey === 'object') {
                // Playwright expects partitionKey to be a string or omitted
                delete sanitized.partitionKey;
            }
            return sanitized;
        });
        await client.detach();
    } catch (e) {
        logTime(`[WARN] CDP cookie extraction failed: ${e.message}. Falling back to standard.`);
        cookies = await page.context().cookies();
    }
    
    // Playwright standard storageState for origins
    const storage = await page.context().storageState();
    
    // Captured multiple essential origins for DCL/Disney
    const origins = await page.evaluate(() => {
        const results = [];
        const baseStorage = {
            localStorage: { ...localStorage },
            sessionStorage: { ...sessionStorage }
        };
        results.push({ origin: window.location.origin, ...baseStorage });
        return results;
    });
    
    return { ...storage, cookies, webStorage: origins };
}

async function ensureLogin(page, reservationId) {
    let status = await checkPageStatus(page, reservationId);
    if (status === "LOGGED_IN") {
        const state = await getStorageState(page);
        return { status: "SUCCESS", state };
    }

    const frameElement = page.locator(SELECTORS.ONEID_IFRAME);
    const frame = page.frameLocator(SELECTORS.ONEID_IFRAME);

    if (status === "PAGE_NOT_FOUND_ERROR" || (status !== "OTP_SCREEN" && status !== "LOGIN_SCREEN" && status !== "LOGIN_SCREEN_BOTH")) {
        logTime("Redirecting to login (due to Page Not Found error or session loss)...");
        await page.goto(URLS.LOGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await frameElement.waitFor({ state: 'visible', timeout: 35000 }).catch(async () => {
            const path = await saveDebug(page, "login_iframe_timeout");
            throw new Error(`STRICT FAIL: Login Iframe timeout (35s). Evidence: ${path}`);
        });
        status = await checkPageStatus(page, reservationId);
    }

    if (status === "LOGIN_SCREEN_BOTH") {
        logTime("Submitting credentials (Combined Screen)...");
        const emailInput = frame.locator(SELECTORS.LOGIN_INPUTS.join(', ')).first();
        const passwordInput = frame.locator(SELECTORS.PASSWORD_INPUTS.join(', ')).first();
        const submitBtn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();

        await emailInput.fill(process.env.DISNEY_EMAIL);
        await passwordInput.fill(process.env.DISNEY_PASSWORD);
        await submitBtn.click();
        
        await new Promise(r => setTimeout(r, 6000));
        status = await checkPageStatus(page, reservationId);
    } else if (status === "LOGIN_SCREEN") {
        logTime("Submitting credentials (Step-by-Step)...");
        const emailInput = frame.locator(SELECTORS.LOGIN_INPUTS.join(', ')).first();
        const passwordInput = frame.locator(SELECTORS.PASSWORD_INPUTS.join(', ')).first();
        const submitBtn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();

        await emailInput.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
            const path = await saveDebug(page, "email_input_timeout");
            throw new Error(`STRICT FAIL: Email input not found. Evidence: ${path}`);
        });
        await emailInput.fill(process.env.DISNEY_EMAIL);
        await submitBtn.click();
        
        await passwordInput.waitFor({ state: 'visible', timeout: 25000 }).catch(async () => {
            const path = await saveDebug(page, "password_input_timeout");
            throw new Error(`STRICT FAIL: Password input timeout. Evidence: ${path}`);
        });
        
        await passwordInput.fill(process.env.DISNEY_PASSWORD);
        await submitBtn.click();
        
        await new Promise(r => setTimeout(r, 6000));
        status = await checkPageStatus(page, reservationId);
    }

    if (status === "OTP_SCREEN") {
        logTime("[OTP] MFA Screen detected. Polling via MailOTP...");
        const otpInput = frame.locator(SELECTORS.OTP_INPUTS.join(', ')).first();
        const submitBtn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();
        
        try {
            const code = await otpService.poll(300000); // 5 min poll
            logTime(`[OTP] Applying code: ${code}`);
            await otpInput.fill(code);
            await submitBtn.click();
            await frameElement.waitFor({ state: 'hidden', timeout: 40000 }).catch(async () => {
                const path = await saveDebug(page, "otp_submit_hang");
                throw new Error(`STRICT FAIL: Page hung after OTP submission. Evidence: ${path}`);
            });
        } catch (e) {
            const path = await saveDebug(page, "otp_failure");
            throw new Error(`STRICT FAIL: OTP process failed: ${e.message}. Evidence: ${path}`);
        }
    }

    await new Promise(r => setTimeout(r, 5000));
    const finalStatus = await checkPageStatus(page, reservationId);
    if (finalStatus === "LOGGED_IN") {
        const state = await getStorageState(page);
        return { status: "SUCCESS", state };
    }
    
    const path = await saveDebug(page, "login_final_fail");
    throw new Error(`STRICT FAIL: Login final check failed. Status: ${finalStatus}, Evidence: ${path}`);
}

async function verifySession(reservationId) {
    const { browser, page } = await ensureCdpPage();
    try {
        const result = await ensureLogin(page, reservationId);
        return result;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

module.exports = { checkPageStatus, ensureLogin, verifySession };
