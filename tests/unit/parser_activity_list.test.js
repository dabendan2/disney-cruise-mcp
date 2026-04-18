const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-chromium');

async function runUnitTests() {
    console.log("🚀 Starting Unit Tests for getActivityList (Category List) with REAL sample...");

    const samplePath = path.join(__dirname, '../res/activity_list.html');
    if (!fs.existsSync(samplePath)) {
        console.error("❌ Error: Real sample file not found at", samplePath);
        process.exit(1);
    }

    const html = fs.readFileSync(samplePath, 'utf8');

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html);

    // Extraction logic (copied from src/automation/activities.js)
    const actual = await page.evaluate(() => {
        const cleanText = (text) => text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
        const cards = Array.from(document.querySelectorAll('wdpr-activity-card'));
        
        return cards.map(card => {
            const title = cleanText(card.querySelector('h2')?.innerText || "");
            
            const details = {};
            const listItems = Array.from(card.querySelectorAll('.description-lines.m-hide li'));
            listItems.forEach(li => {
                const cls = li.className || "";
                const val = cleanText(li.innerText || "");
                if (cls.includes('experienceType')) details.type = val;
                if (cls.includes('durationInMinutes')) details.duration = val.replace(/,&nbsp;|,/g, '').trim();
                if (cls.includes('bookingPrice')) details.price = val;
                if (cls.includes('locations')) details.location = val;
            });

            const bookBtn = card.querySelector('wdpr-book-activity');
            const metadata = {};
            if (bookBtn) {
                metadata.productId = bookBtn.getAttribute('product-id');
                metadata.subType = bookBtn.getAttribute('activity-sub-type');
                metadata.seawareId = bookBtn.getAttribute('seaware-id');
            }

            return {
                title,
                ...details,
                ...metadata
            };
        });
    });

    console.log("📊 Extracted Activity List from real sample:", JSON.stringify(actual, null, 2));

    // Assertions
    try {
        assert.ok(actual.length > 0, "Should extract at least one activity");
        
        const steakhouse = actual.find(a => a.title.includes("Japanese Steakhouse"));
        assert.ok(steakhouse, "Should find Japanese Steakhouse");
        assert.strictEqual(steakhouse.duration, "105 minutes", "Duration should match");
        assert.strictEqual(steakhouse.location, "Deck 10, Aft", "Location should match");
        assert.strictEqual(steakhouse.subType, "JPN_STEAK", "SubType should match");

        const omakase = actual.find(a => a.title.includes("Omakase"));
        assert.ok(omakase, "Should find Omakase");
        assert.strictEqual(omakase.duration, "120 minutes", "Duration should match");
        assert.strictEqual(omakase.price, "$200 (age 4 and up)", "Price should match");

        console.log("✅ Unit Test Passed: getActivityList logic correctly extracts structured category list.");
    } catch (e) {
        console.error("❌ Unit Test Failed:", e.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runUnitTests().catch(console.error);
