const { logTime, saveDebug } = require('../utils/debug');
const { MailOTP } = require('../utils/otp');
const { URLS, SELECTORS, ERROR_INDICATORS, AUTH_MARKERS } = require('../constants');

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

    if (ERROR_INDICATORS.some(text => content.includes(text)) || title === "404") {
        throw new Error(`STRICT FAIL: DCL 404 Error (Stitch). URL: ${url}`);
    }

    const isLoggedIn = AUTH_MARKERS.some(marker => content.includes(marker));
    const isReservationUrl = url.includes(URLS.RESERVATION_BASE) && /\/\d{8}\//.test(url);
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
        if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            return "LOGIN_SCREEN";
        }
    }

    if (url.includes("/login")) return "LOGIN_SCREEN";
    if (url === "about:blank" || url.includes("chrome://")) return "NEED_LOGIN";

    const path = await saveDebug(page, "unknown_status");
    throw new Error(`STRICT FAIL: Unexpected Page State. URL: ${url}, Evidence: ${path}`);
}

async function ensureLogin(page, reservationId) {
    let status = await checkPageStatus(page, reservationId);
    if (status === "LOGGED_IN") return "SUCCESS";

    const frameElement = page.locator(SELECTORS.ONEID_IFRAME);
    const frame = page.frameLocator(SELECTORS.ONEID_IFRAME);

    if (status !== "OTP_SCREEN" && status !== "LOGIN_SCREEN") {
        logTime("Redirecting to login...");
        await page.goto(URLS.LOGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await frameElement.waitFor({ state: 'visible', timeout: 35000 }).catch(async () => {
            const path = await saveDebug(page, "login_iframe_timeout");
            throw new Error(`STRICT FAIL: Login Iframe timeout (35s). Evidence: ${path}`);
        });
        status = await checkPageStatus(page, reservationId);
    }

    if (status === "LOGIN_SCREEN") {
        logTime("Submitting credentials...");
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
            throw new Error(`STRICT FAIL: Password input timeout (invalid email?). Evidence: ${path}`);
        });
        
        await passwordInput.fill(process.env.DISNEY_PASSWORD);
        await submitBtn.click();
        
        await new Promise(r => setTimeout(r, 6000));
        status = await checkPageStatus(page, reservationId);
    }

    if (status === "OTP_SCREEN") {
        const code = await otpService.poll();

        if (code) {
            logTime(`[OTP] Applying code: ${code}`);
            const otpInput = frame.locator(SELECTORS.OTP_INPUTS.join(', ')).first();
            const submitBtn = frame.locator(SELECTORS.SUBMIT_BUTTON).first();
            await otpInput.fill(code);
            await submitBtn.click();
            await frameElement.waitFor({ state: 'hidden', timeout: 40000 }).catch(async () => {
                const path = await saveDebug(page, "otp_submit_hang");
                throw new Error(`STRICT FAIL: Page hung after OTP submission. Evidence: ${path}`);
            });
        } else {
            const path = await saveDebug(page, "otp_timeout");
            throw new Error(`STRICT FAIL: OTP polling timeout via internal Gmail API. Evidence: ${path}`);
        }
    }

    await new Promise(r => setTimeout(r, 5000));
    const finalStatus = await checkPageStatus(page, reservationId);
    if (finalStatus === "LOGGED_IN") return "SUCCESS";
    
    const path = await saveDebug(page, "login_final_fail");
    throw new Error(`STRICT FAIL: Login final check failed. Status: ${finalStatus}, Evidence: ${path}`);
}

module.exports = { checkPageStatus, ensureLogin };
