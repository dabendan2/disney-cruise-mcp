const { chromium } = require("playwright-chromium");
const { execSync, spawn } = require("child_process");

const CDP_PORT = process.env.CDP_PORT || "9222";
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

/**
 * Attempts to restart the browser by killing stuck processes and relaunching.
 */
async function restartBrowser() {
  console.log("[BROWSER] Restarting browser (pkill + relaunch)...");
  try {
    // 1. 先恢復所有暫停的進程，確保能接收殺除訊號
    try { execSync("pkill -CONT -f chromium || true"); } catch (e) {}
    
    // 2. 徹底殺掉所有相關進程
    try { execSync("pkill -9 -f chromium || true"); } catch (e) {}

    // 3. 啟動新的 Chromium
    const chromeProcess = spawn('chromium', [
      '--headless',
      '--remote-debugging-port=9222',
      '--disable-gpu',
      '--no-sandbox',
      '--noerrdialogs',
      '--no-first-run',
      '--user-data-dir=/tmp/chrome-mcp-disney',
      '--disk-cache-size=1',
      '--media-cache-size=1',
      '--ozone-platform=headless'
    ], {
      detached: true,
      stdio: 'ignore'
    });
    chromeProcess.unref();

    // Wait for browser to initialize
    await new Promise(r => setTimeout(r, 5000));
    return true;
  } catch (e) {
    console.error(`[ERROR] Browser restart failed: ${e.message}`);
    return false;
  }
}

async function ensureCdpPage() {
  let browser;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      browser = await chromium.connectOverCDP(CDP_URL, { timeout: 10000 });
      
      // 使用 Promise.race 確保 heartbeat 測試本身不會永遠卡死
      await Promise.race([
        browser.version(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Heartbeat timeout")), 5000))
      ]);
      
      break;
    } catch (e) {
      if (browser) await browser.close().catch(() => {});
      if (attempt === 1) {
        console.warn(`[BROWSER] CDP Attempt 1 failed: ${e.message}. Restarting browser...`);
        if (!(await restartBrowser())) throw new Error(`STRICT FAIL: Browser relaunch failed.`);
      } else {
        throw new Error(`STRICT FAIL: CDP connection failed after restart: ${e.message}`);
      }
    }
  }

  const context = browser.contexts()[0];
  let page = context.pages()[0] || await context.newPage();
  
  const allPages = context.pages();
  for (const p of allPages) { if (p !== page) { await p.close().catch(() => {}); } }
  
  await page.route('**/*', (route) => {
    const url = route.request().url().toLowerCase();
    // Block heavy media
    const isAsset = url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || 
                    url.endsWith('.gif') || url.endsWith('.webp') || url.endsWith('.svg') || 
                    url.endsWith('.woff') || url.endsWith('.woff2') || url.endsWith('.mp4');
    
    // Block tracking and analytics
    const isJunk = url.includes('analytics') || url.includes('gtm.js') || url.includes('pixel') || 
                   url.includes('doubleclick') || url.includes('facebook') || url.includes('metrics') ||
                   url.includes('demdex.net') || url.includes('tealium') || url.includes('adobetm') ||
                   url.includes('clicktale') || url.includes('newrelic') || url.includes('googletagmanager');

    if (isAsset || isJunk) return route.abort();
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  return { browser, page };
}

module.exports = { ensureCdpPage, restartBrowser };
