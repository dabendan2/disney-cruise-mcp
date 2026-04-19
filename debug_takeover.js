require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { ensureCdpPage } = require('./src/browser/engine');
const { saveDebug } = require('./src/utils/debug');

async function debugRawFlow() {
    const reservationId = "44079507";
    const slug = "SPAANDFITNESS";
    const date = "2026-04-23";
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/${reservationId}/${slug}/${date}/?ship=DA&port=SIN`;

    console.log(`[DEBUG] Target URL: ${targetUrl}`);
    
    try {
        const { browser, page } = await ensureCdpPage();
        
        console.log("[DEBUG] Navigating to URL...");
        // Just a basic goto, no automation logic yet
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log("[DEBUG] Basic navigation done. Waiting 30s for 'original problem' to manifest...");
        await new Promise(r => setTimeout(r, 30000));

        console.log("[DEBUG] 30s wait finished. Capturing raw page state...");
        const screenshotPath = await saveDebug(page, "raw_problem_manifest");
        console.log(`[DEBUG] Screenshot: ${screenshotPath}`);
        
        const htmlPath = await saveDebug(page, "raw_problem_manifest", true);
        console.log(`[DEBUG] HTML: ${htmlPath}`);

        await browser.close();
    } catch (e) {
        console.error(`[DEBUG] Error: ${e.message}`);
        process.exit(1);
    }
}

debugRawFlow();
