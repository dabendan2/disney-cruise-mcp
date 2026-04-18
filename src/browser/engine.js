const { chromium } = require("playwright-chromium");

const CDP_URL = "http://127.0.0.1:9222";

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

module.exports = { getPage };
