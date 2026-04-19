const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-chromium');

async function runUnitTests() {
    console.log("🚀 Starting Unit Tests for getAllActivityTypes with REAL sample...");

    const samplePath = path.join(__dirname, '../../../fixtures/add_activities_sample.html');
    if (!fs.existsSync(samplePath)) {
        console.error("❌ Error: Real sample file not found at", samplePath);
        process.exit(1);
    }

    const html = fs.readFileSync(samplePath, 'utf8');
    const resId = "44079507";

    // Launch a local browser to process the HTML
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Set the HTML content
    await page.setContent(html);

    // Extraction logic (copied from src/automation/activities.js)
    const actual = await page.evaluate((resId) => {
        const results = [];
        const container = document.querySelector('.add-activities-menu, .popover, .dropdown-menu, body');
        const elements = Array.from(container.querySelectorAll('a, button, [role="button"]'));
        
        elements.forEach(el => {
            const href = el.getAttribute('href') || "";
            let text = el.innerText.trim();
            text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
            
            const match = href.match(/\/(\d{8})\/([A-Z]+)\//);
            if (match && text.length > 1) {
                results.push({
                    type: text,
                    slug: match[2],
                    status: (el.offsetParent !== null && !el.classList.contains('disabled')) ? "Available" : "Disabled"
                });
            }
        });
        return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
    }, resId);

    console.log("📊 Extracted from real sample:", JSON.stringify(actual, null, 2));

    const expected = [
        { type: "Onboard Fun", slug: "ONBOARDFUN", status: "Available" },
        { type: "Dining", slug: "DINE", status: "Available" },
        { type: "Spa & Fitness", slug: "SPAANDFITNESS", status: "Available" }
    ];

    try {
        assert.deepStrictEqual(actual, expected, "Extracted activity types should match captured real sample");
        console.log("✅ Unit Test Passed: Extraction logic correctly processes real DCL HTML.");
    } catch (e) {
        console.error("❌ Unit Test Failed:", e.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runUnitTests().catch(console.error);
