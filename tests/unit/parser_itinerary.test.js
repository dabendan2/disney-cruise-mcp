const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-chromium');

/**
 * Unit Test: Itinerary Parser
 * Verifies extraction of the daily itinerary from the dashboard.
 */
async function runParserItineraryTests() {
    console.log("🚀 Starting Unit Tests: parser_itinerary (Real Samples & Edge Cases)...");

    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        // --- Test 1: Real Sample Extraction ---
        console.log("Step 1: Real Sample Extraction");
        const samplePath = path.join(__dirname, '../res/add_activities_sample.html');
        if (fs.existsSync(samplePath)) {
            const html = fs.readFileSync(samplePath, 'utf8');
            await page.setContent(html);

            const actual = await page.evaluate(() => {
                const cleanText = (text) => text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
                const days = Array.from(document.querySelectorAll('day-view'));
                return days.map(day => {
                    const header = day.querySelector('.day-view-header');
                    const title = cleanText(header?.querySelector('h2')?.innerText || "");
                    const paragraphs = Array.from(header?.querySelectorAll('p') || []);
                    const datePara = paragraphs.find(p => p.innerText.length > 2 && !p.classList.contains('pepIcon'));
                    const date = cleanText(datePara?.innerText || "");
                    const activities = Array.from(day.querySelectorAll('activity-card')).map(card => {
                        const time = card.querySelector('.activity-card-time')?.innerText.replace(/\s+/g, ' ').trim() || "";
                        const type = card.querySelector('.activity-card-type')?.innerText.trim() || "";
                        const activityTitle = card.querySelector('.activity-card-title')?.innerText.trim() || "";
                        const infoRows = Array.from(card.querySelectorAll('.activity-card-info'));
                        const info = {};
                        infoRows.forEach(row => {
                            const label = row.querySelector('.activity-card-label')?.innerText.replace(':', '').trim() || "";
                            let detail = row.querySelector('.activity-card-detail')?.innerText.trim() || "";
                            detail = cleanText(detail);
                            if (label) info[label.toLowerCase()] = detail;
                        });
                        return { time: cleanText(time), type: cleanText(type), title: cleanText(activityTitle), ...info };
                    });
                    return { day: title, date, activities };
                });
            });

            const day5 = actual.find(d => d.day.includes("Day 5"));
            assert.ok(day5, "Should find Day 5");
            assert.strictEqual(day5.date, "Monday, April 27, 2026", "Day 5 date should match");
            console.log("✅ Real sample parsed correctly.");
        }

        // --- Test 2: Edge Case - Empty Day ---
        console.log("Step 2: Empty Day Handling");
        await page.setContent(`
            <day-view>
                <div class="day-view-header"><h2>Day 5 - Singapore</h2><p>Monday, April 27, 2026</p></div>
                <div class="plans-container"></div>
            </day-view>
        `);
        const emptyResult = await page.evaluate(() => {
            const days = Array.from(document.querySelectorAll('day-view'));
            return days.map(day => ({ activities: Array.from(day.querySelectorAll('activity-card')).length }));
        });
        assert.strictEqual(emptyResult[0].activities, 0);
        console.log("✅ Empty day handled.");

        // --- Test 3: Edge Case - Complex Guest/Price Meta ---
        console.log("Step 3: Complex Activity Meta");
        await page.setContent(`
            <activity-card>
                <div class="activity-card-info">
                    <span class="activity-card-label">Guests:</span>
                    <span class="activity-card-detail">Guest A ($100), Guest B ($0)</span>
                </div>
            </activity-card>
        `);
        const metaResult = await page.evaluate(() => {
            const card = document.querySelector('activity-card');
            const infoRows = Array.from(card.querySelectorAll('.activity-card-info'));
            const info = {};
            infoRows.forEach(row => {
                const label = row.querySelector('.activity-card-label')?.innerText.replace(':', '').trim().toLowerCase();
                const detail = row.querySelector('.activity-card-detail')?.innerText.trim();
                if (label) info[label] = detail;
            });
            return info;
        });
        assert.ok(metaResult.guests.includes("Guest B"));
        console.log("✅ Complex meta handled.");

    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    runParserItineraryTests().catch(e => {
        console.error(e);
        process.exit(1);
    });
}
