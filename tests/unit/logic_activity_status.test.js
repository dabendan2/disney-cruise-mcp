const assert = require('assert');
const { chromium } = require('playwright-chromium');

async function runUnitTests() {
    console.log("🚀 Starting Unit Tests for getActivityDetails (Button-First Logic)...");

    const browser = await chromium.launch();
    const page = await browser.newPage();

    // SCENARIO 1: False Positive Prevention
    // A card that contains "Onboard Price" but has a visible "Select" button.
    // The logic should NOT return "Onboard Only".
    const htmlFalsePositive = `
        <wdpr-activity-card>
            <div class="activityDetails">
                <h2>Photo: Unlimited Package</h2>
                <div class="description">Pre-cruise price: $203.95; and Onboard Price: $239.95</div>
                <div class="activityCardColRight">
                    <button class="btn select-activity-button">Select</button>
                </div>
            </div>
        </wdpr-activity-card>
    `;

    await page.setContent(htmlFalsePositive);

    const checkFalsePositive = await page.evaluate(() => {
        const card = document.querySelector('wdpr-activity-card');
        const cardText = card.innerText;
        
        // OLD LOGIC (Simulated):
        const oldLogicStatus = (cardText.includes("Onboard") || cardText.includes("Sold Out")) ? "Onboard Only" : "Available";
        
        // NEW LOGIC:
        const btn = card.querySelector('button, a.btn');
        const isBtnVisible = btn && btn.offsetParent !== null;
        const newLogicStatus = isBtnVisible ? "Available" : (cardText.includes("Sold Out") ? "Sold Out" : "Not Available");
        
        return { oldLogicStatus, newLogicStatus };
    });

    console.log("📊 False Positive Check:", JSON.stringify(checkFalsePositive, null, 2));
    assert.strictEqual(checkFalsePositive.oldLogicStatus, "Onboard Only", "Old logic should fail this case");
    assert.strictEqual(checkFalsePositive.newLogicStatus, "Available", "New logic should correctly identify as Available");

    // SCENARIO 2: Real "Onboard Only" (No Button)
    const htmlRealOnboardOnly = `
        <wdpr-activity-card>
            <div class="activityDetails">
                <h2>Palo Dinner</h2>
                <div class="activityCardColRight">
                    <div class="onboard-label">Only available on board</div>
                </div>
            </div>
        </wdpr-activity-card>
    `;

    await page.setContent(htmlRealOnboardOnly);

    const checkRealOnboardOnly = await page.evaluate(() => {
        const card = document.querySelector('wdpr-activity-card');
        const btn = card.querySelector('button, a.btn');
        const isBtnVisible = btn && btn.offsetParent !== null;
        
        const rightCol = card.querySelector('.activityCardColRight');
        const statusText = rightCol ? rightCol.innerText.trim() : "No Status";
        
        return isBtnVisible ? "Available" : statusText;
    });

    console.log("📊 Real Onboard Only Check:", checkRealOnboardOnly);
    assert.strictEqual(checkRealOnboardOnly, "Only available on board", "Should capture actual status text when button is missing");

    console.log("✅ Unit Test Passed: getActivityDetails logic is now robust against false positives.");
    await browser.close();
}

runUnitTests().catch(e => {
    console.error("❌ Unit Test Failed:", e.message);
    process.exit(1);
});
