const { navigateUrl } = require('./src/automation/navigation');
const { logTime, saveDebug } = require('./src/utils/debug');

async function finalEvidence() {
    const reservationId = '44079507';
    const targetUrl = `https://disneycruise.disney.go.com/my-disney-cruise/my-reservations/${reservationId}/my-plans`;
    
    console.log("Navigating to My Plans for final confirmation...");
    const { browser, page } = await navigateUrl(targetUrl, reservationId, 'day-view', 60000);

    try {
        // Wait for the daily plans to be fully hydrated
        console.log("Waiting for plans to hydrate (20s)...");
        await page.waitForSelector('activity-card', { timeout: 45000 });
        await page.waitForTimeout(20000); // Give it extra time to render names/times
        
        // Ensure Day 1 is in view (Photo package is on Day 1)
        const day1 = page.locator('day-view').first();
        await day1.scrollIntoViewIfNeeded();
        
        const path = await saveDebug(page, "FINAL_ITINERARY_EVIDENCE");
        
        const planData = await page.evaluate(() => {
            const photoCard = Array.from(document.querySelectorAll('activity-card'))
                .find(c => c.innerText.includes("Photo: Unlimited Package"));
            
            if (!photoCard) return "NOT_FOUND";
            
            return {
                title: photoCard.querySelector('.activity-card-title')?.innerText.trim(),
                time: photoCard.querySelector('.activity-card-time')?.innerText.trim(),
                details: photoCard.innerText.replace(/\s+/g, ' ').trim()
            };
        });

        console.log("VERIFICATION_DATA_START");
        console.log(JSON.stringify(planData, null, 2));
        console.log("VERIFICATION_DATA_END");
        console.log(`EVIDENCE_PATH:${path}`);

    } finally {
        await browser.close();
    }
}

finalEvidence();
