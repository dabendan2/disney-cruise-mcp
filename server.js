require('dotenv').config({ path: __dirname + '/.env' });
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { chromium } = require("playwright-chromium");
const fs = require("fs");

const CDP_URL = "http://localhost:9222";

const server = new Server(
  { name: "disney-cruise-automation", version: "1.5.0" },
  { capabilities: { tools: {} } }
);

// --- Concurrency & Time Logging ---
let navigationLock = Promise.resolve();
async function withLock(fn) {
    const result = navigationLock.then(async () => { return await fn(); });
    navigationLock = result.catch(() => {});
    return result;
}

function logTime(msg) {
  const now = new Date();
  const time = now.toISOString().split('T')[1].split('Z')[0];
  console.error(`[${time}] ${msg}`);
  return now.getTime();
}

async function saveDebug(page, name) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `/home/ubuntu/.hermes/debug/${ts}_${name}`;
    await page.screenshot({ path: `${base}.png` }).catch(() => {});
    const content = await page.content().catch(() => "Failed to get content");
    fs.writeFileSync(`${base}.html`, content);
    logTime(`[DEBUG] Evidence saved: ${name} at ${base}`);
    return base;
  } catch (e) {
    return "debug_save_failed";
  }
}

// --- Browser Engine ---
async function getPage() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();
  
  const allPages = context.pages();
  for (const p of allPages) { if (p !== page) { await p.close().catch(() => {}); } }
  
  await page.route('**/*', (route) => {
    const url = route.request().url().toLowerCase();
    const isAsset = url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || 
                    url.endsWith('.gif') || url.endsWith('.webp') || url.endsWith('.svg') || 
                    url.endsWith('.woff') || url.endsWith('.woff2');
    const isJunk = url.includes('analytics') || url.includes('gtm.js') || url.includes('pixel') || 
                   url.includes('doubleclick') || url.includes('facebook') || url.includes('metrics');
    if (isAsset || isJunk) return route.abort();
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  return { browser, page };
}

async function waitForAngular(page, timeout = 45000) {
    logTime("Wait for Angular/SPA stability...");
    try {
        await page.waitForFunction(() => {
            const hasCards = document.querySelector('wdpr-activity-card') !== null;
            const el = document.querySelector('[ng-app], .ng-scope, body');
            if (hasCards) return true;
            if (!el || !window.angular) return false;
            try {
                const injector = window.angular.element(el).injector();
                if (!injector) return false;
                const browser = injector.get('$browser');
                return browser.outstandingRequestsCount === 0;
            } catch (e) { return false; }
        }, { timeout });
    } catch (e) {
        const path = await saveDebug(page, "angular_timeout");
        throw new Error(`STRICT FAIL: Angular stability check timed out (${timeout}ms). Evidence: ${path}`);
    }
    await new Promise(r => setTimeout(r, 5000));
}

// --- Logic Layer ---

async function checkPageStatus(page) {
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

    const errorIndicators = ["Someone Ate the Page!", "The page that you are trying to reach does not exist", "Page Not Found"];
    if (errorIndicators.some(text => content.includes(text)) || title === "404") {
        throw new Error(`STRICT FAIL: DCL 404 Error (Stitch). URL: ${url}`);
    }

    // 已登入 (偵測登入狀態字串或處於預約系統 URL 模式)
    const isLoggedIn = content.includes("Sign Out") || content.includes("My Account") || content.includes("My Plans");
    const isReservationUrl = url.includes("/my-disney-cruise/") && /\/\d{8}\//.test(url);
    if (isLoggedIn || isReservationUrl) {
        return "LOGGED_IN";
    }

    const frameElement = page.locator('#oneid-iframe');
    if (await frameElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const frame = page.frameLocator('#oneid-iframe');
        
        const otpInput = frame.locator('input[type="tel"], #InputOTP, [aria-label*="code"]').first();
        if (await otpInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            return "OTP_SCREEN";
        }

        const errorText = await frame.locator('.error, #error, [role="alert"]').innerText().catch(() => "");
        if (errorText.length > 5) {
            const path = await saveDebug(page, "login_error_detected");
            throw new Error(`STRICT FAIL: Login Error Detected: "${errorText}". Evidence: ${path}`);
        }

        const emailInput = frame.locator('input[type="email"], #InputLoginValue').first();
        if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            return "LOGIN_SCREEN";
        }
    }

    if (url.includes("/login")) return "LOGIN_SCREEN";
    if (url === "about:blank" || url.includes("chrome://")) return "NEED_LOGIN";

    const path = await saveDebug(page, "unknown_status");
    throw new Error(`STRICT FAIL: Unexpected Page State. URL: ${url}, Evidence: ${path}`);
}

async function ensureLogin(page) {
    let status = await checkPageStatus(page);
    if (status === "LOGGED_IN") return "SUCCESS";

    const frameElement = page.locator('#oneid-iframe');
    const frame = page.frameLocator('#oneid-iframe');

    if (status !== "OTP_SCREEN" && status !== "LOGIN_SCREEN") {
        logTime("Redirecting to login...");
        await page.goto("https://disneycruise.disney.go.com/login/?appRedirect=%2Fmy-disney-cruise%2Fmy-reservations%2F", { waitUntil: 'domcontentloaded', timeout: 60000 });
        await frameElement.waitFor({ state: 'visible', timeout: 35000 }).catch(async () => {
            const path = await saveDebug(page, "login_iframe_timeout");
            throw new Error(`STRICT FAIL: Login Iframe timeout (35s). Evidence: ${path}`);
        });
        status = await checkPageStatus(page);
    }

    if (status === "LOGIN_SCREEN") {
        logTime("Submitting credentials...");
        const emailInput = frame.locator('input[type="email"], #InputLoginValue').first();
        const passwordInput = frame.locator('input[type="password"], #InputPassword').first();
        const submitBtn = frame.locator('#BtnSubmit').first();

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
        status = await checkPageStatus(page);
    }

    if (status === "OTP_SCREEN") {
        logTime("[OTP] MFA Screen detected. Polling otp.txt...");
        const otpInput = frame.locator('input[type="tel"], #InputOTP, [aria-label*="code"]').first();
        const submitBtn = frame.locator('#BtnSubmit').first();
        const OTP_FILE = "/home/ubuntu/.hermes/debug/otp.txt";
        
        if (fs.existsSync(OTP_FILE)) fs.unlinkSync(OTP_FILE);

        let code = "";
        for (let i = 0; i < 60; i++) {
            if (fs.existsSync(OTP_FILE)) {
                code = fs.readFileSync(OTP_FILE, 'utf8').trim();
                if (code.length === 6) break;
            }
            await new Promise(r => setTimeout(r, 5000));
        }

        if (code.length === 6) {
            logTime(`[OTP] Applying code: ${code}`);
            await otpInput.fill(code);
            await submitBtn.click();
            await frameElement.waitFor({ state: 'hidden', timeout: 40000 }).catch(async () => {
                const path = await saveDebug(page, "otp_submit_hang");
                throw new Error(`STRICT FAIL: Page hung after OTP submission. Evidence: ${path}`);
            });
        } else {
            const path = await saveDebug(page, "otp_timeout");
            throw new Error(`STRICT FAIL: OTP polling timeout. Check email or otp_daemon.py. Evidence: ${path}`);
        }
    }

    await new Promise(r => setTimeout(r, 5000));
    const finalStatus = await checkPageStatus(page);
    if (finalStatus === "LOGGED_IN") return "SUCCESS";
    
    const path = await saveDebug(page, "login_final_fail");
    throw new Error(`STRICT FAIL: Login final check failed. Status: ${finalStatus}, Evidence: ${path}`);
}

async function navigateUrl(url, waitForSelector) {
    const { browser, page } = await getPage();
    try {
        for (let attempt = 1; attempt <= 2; attempt++) {
            logTime(`Nav Attempt ${attempt}: ${url}`);
            let status = await checkPageStatus(page);
            if (status !== "LOGGED_IN") await ensureLogin(page);
            
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(async (e) => {
                const path = await saveDebug(page, "nav_goto_error");
                throw new Error(`STRICT FAIL: Navigation error (${e.message}). Evidence: ${path}`);
            });

            status = await checkPageStatus(page);
            if (status !== "LOGGED_IN") {
                await ensureLogin(page);
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
                status = await checkPageStatus(page);
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

async function getActivityDetails(reservationId, slug, date, activityName) {
    const start = logTime(`=== TASK START: ${activityName} on ${date} ===`);
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/${slug}/${date}/?ship=DA&port=SIN`;
    
    const navResult = await navigateUrl(targetUrl, 'wdpr-activity-card');
    const { browser, page } = navResult;
    try {
        logTime("Phase: Scan Activity Card...");
        const card = page.locator('wdpr-activity-card').filter({ hasText: new RegExp(activityName, "i") }).first();
        
        if (!(await card.count())) {
            for (let i = 0; i < 8; i++) {
                await page.evaluate(() => window.scrollBy(0, 1000));
                await new Promise(r => setTimeout(r, 4500));
                if (await card.isVisible().catch(() => false)) break;
            }
        }

        if (!(await card.count())) {
            const path = await saveDebug(page, "activity_not_found");
            throw new Error(`STRICT FAIL: Activity '${activityName}' not found after 8 scrolls. Evidence: ${path}`);
        }

        await card.scrollIntoViewIfNeeded();
        const cardText = await card.innerText();
        
        if (cardText.includes("Onboard") || cardText.includes("Sold Out")) {
            return { activityName, date, status: cardText.includes("Sold Out") ? "Sold Out" : "Onboard Only", timing: { total_sec: (Date.now() - start)/1000 } };
        }

        const btn = card.locator('button, a.btn').filter({ hasText: /Select|Add/i }).first();
        if (!(await btn.isVisible())) {
            const path = await saveDebug(page, "button_invisible");
            throw new Error(`STRICT FAIL: Found card but Select/Add button is invisible. Evidence: ${path}`);
        }

        await btn.click();
        await page.waitForSelector('label.btn-checkbox-label', { timeout: 35000 }).catch(async () => {
            const path = await saveDebug(page, "guest_modal_timeout");
            throw new Error(`STRICT FAIL: Guest selection modal timeout (35s). Evidence: ${path}`);
        });

        const guests = page.locator('label.btn-checkbox-label');
        for (let i = 0; i < await guests.count(); i++) { 
            await guests.nth(i).scrollIntoViewIfNeeded();
            await guests.nth(i).click(); 
            await new Promise(r => setTimeout(r, 1200)); 
        }
        
        const checkedCount = await page.locator('input:checked, .active').count();
        if (checkedCount === 0) {
            const path = await saveDebug(page, "selection_sync_fail");
            throw new Error(`STRICT FAIL: Guest selection state sync failed (0 checked). Evidence: ${path}`);
        }

        const checkBtn = page.locator('button').filter({ hasText: /Check Availability/i }).first();
        await checkBtn.evaluate(el => el.removeAttribute('disabled'));
        await checkBtn.click();

        const timeDropdown = page.locator('button, [role="button"]').filter({ hasText: /Select (a )?Time/i }).first();
        if (await timeDropdown.isVisible().catch(() => false)) {
            logTime("Hydrating dining times...");
            await timeDropdown.click();
            await new Promise(r => setTimeout(r, 4000));
        }

        let times = [];
        for (let i = 0; i < 15; i++) {
            times = await page.evaluate(() => {
                const p = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM)$/i;
                return [...new Set(Array.from(document.querySelectorAll('li[role="option"], button, span')).map(e => e.innerText.trim()).filter(t => p.test(t)))];
            });
            if (times.length > 0) break;
            await new Promise(r => setTimeout(r, 4500));
        }

        const end = logTime(`=== TASK COMPLETE. Found ${times.length} slots ===`);
        return { activityName, date, status: times.length > 0 ? "Available" : "No Slots", times, timing: { total_sec: (end - start)/1000 } };
    } catch (e) {
        if (!e.message.includes("STRICT FAIL")) {
            const path = await saveDebug(page, "unhandled_task_error");
            throw new Error(`STRICT FAIL: Unhandled error in getActivityDetails: ${e.message}. Evidence: ${path}`);
        }
        throw e;
    } finally { if (browser) await browser.close(); }
}

module.exports = { 
  checkPageStatus, 
  ensureLogin, 
  navigateUrl, 
  getActivityDetails,
  waitForAngular 
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: "get_activity_details", description: "Fetch activity availability and times.", inputSchema: { type: "object", properties: { reservationId: { type: "string" }, slug: { type: "string" }, date: { type: "string" }, activityName: { type: "string" } }, required: ["reservationId", "slug", "date", "activityName"] } }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await withLock(async () => {
    try {
      if (name === "get_activity_details") return { content: [{ type: "text", text: JSON.stringify(await getActivityDetails(args.reservationId, args.slug, args.date, args.activityName)) }] };
      throw new Error("Tool not found");
    } catch (e) { return { isError: true, content: [{ type: "text", text: e.message }] }; }
  });
});

(async () => {
  if (require.main === module) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
})();
