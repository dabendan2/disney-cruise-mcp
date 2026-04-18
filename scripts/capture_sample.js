const { navigateUrl } = require('../../src/automation/navigation');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function captureRealSample(reservationId) {
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    console.log(`📸 Capturing real sample from: ${targetUrl}`);
    
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'text=Add Activities', 45000);
    
    try {
        const addBtn = page.locator('button, a, [role="button"]').filter({ hasText: /Add Activities/i }).first();
        if (await addBtn.isVisible()) {
            console.log("Clicking Add Activities...");
            await addBtn.click();
            await page.waitForTimeout(5000);
            
            const content = await page.content();
            const samplePath = path.join(__dirname, '../res/add_activities_sample.html');
            fs.writeFileSync(samplePath, content);
            console.log(`✅ Real sample saved to: ${samplePath}`);
        } else {
            throw new Error("Add Activities button not found during capture.");
        }
    } finally {
        if (browser) await browser.close();
    }
}

captureRealSample("44079507").catch(console.error);
