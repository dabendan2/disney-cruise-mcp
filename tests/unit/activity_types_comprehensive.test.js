const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

/**
 * Replicating the logic from src/automation/catalog.js Step 2 (Finding the button)
 */
function findAddActivitiesButton(html, dateString) {
    const $ = cheerio.load(html);
    const containers = $('.itinerary-day, day-view, .day-container, section').toArray();
    const dayBlock = containers.find(el => $(el).text().includes(dateString));
    
    if (dayBlock) {
        const btn = $(dayBlock).find('a, button, [role="button"]').toArray()
            .find(el => $(el).text().includes('Add Activities'));
        return !!btn;
    }
    return false;
}

/**
 * Replicating the logic from src/automation/catalog.js Step 3 (Extracting activities)
 */
function extractActivities(html, targetDate) {
    const $ = cheerio.load(html);
    const results = [];
    
    // Target the specific popup structure
    const container = $('.add-plans-modal, .popover, .popover-content, .wdpr-popover, body').first();
    const rows = container.find('.add-plans-row').toArray();
    
    rows.forEach(row => {
        const $row = $(row);
        const titleEl = $row.find('.add-plans-option-title');
        if (titleEl.length === 0) return;
        
        let text = titleEl.text().trim();
        text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
        if (text.length < 2) return;

        const enabledDiv = $row.find('.row-enabled');
        const anchor = $row.find('a.row-anchor');
        const href = anchor.attr('href') || "";
        const dateMatches = href.includes(targetDate);
        
        const isActuallyAvailable = enabledDiv.length > 0 && anchor.length > 0 && dateMatches;

        let slug = "UNKNOWN";
        const t = text.toUpperCase();
        if (t.includes('ONBOARD')) slug = 'ONBOARDFUN';
        else if (t.includes('DINING')) slug = 'DINE';
        else if (t.includes('SPA')) slug = 'SPAANDFITNESS';
        else if (t.includes('PORT')) slug = 'PORTADVENTURES';
        else if (t.includes('NURSERY')) slug = 'NURSERY';

        if (slug !== "UNKNOWN") {
            results.push({ 
                type: text, 
                slug, 
                status: isActuallyAvailable ? "Available" : "Unavailable" 
            });
        }
    });
    
    return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

function runComprehensiveTest() {
    console.log('🧪 Starting Comprehensive Activity Types Test (4/22, 4/23, 4/27)...');

    // --- 4/22 SCENARIO (No Entry Point) ---
    console.log('\n[Scenario: 4/22 - Embarkation Day]');
    // Synthetic sample: A day block without the 'Add Activities' button
    const html422 = `
        <div class="itinerary-day">
            <h2 class="day-label">Wednesday, April 22, 2026</h2>
            <div class="plans-list">
                <p>Welcome Aboard!</p>
            </div>
        </div>
    `;
    const hasButton422 = findAddActivitiesButton(html422, 'April 22');
    console.log(`- Button found for 4/22: ${hasButton422}`);
    assert.strictEqual(hasButton422, false, '4/22 should NOT have an Add Activities button');

    // --- 4/23 SCENARIO (Valid Available Items) ---
    console.log('\n[Scenario: 4/23 - Valid Data]');
    const samplePath = path.join(__dirname, '../res/MENU_INSPECTION.html');
    const htmlModal = fs.readFileSync(samplePath, 'utf8');
    
    const results423 = extractActivities(htmlModal, '2026-04-23');
    console.log('Checking against target date: 2026-04-23...');
    results423.forEach(res => {
        console.log(`- ${res.type} (${res.slug}): ${res.status}`);
    });
    
    const onboard423 = results423.find(r => r.slug === 'ONBOARDFUN');
    assert.strictEqual(onboard423.status, 'Available', 'Onboard Fun should be Available for 4/23 in this sample');

    // --- 4/27 SCENARIO (Ghost Links/Mismatched Date) ---
    console.log('\n[Scenario: 4/27 - Debarkation Ghost Menu]');
    const results427 = extractActivities(htmlModal, '2026-04-27');
    console.log('Checking against target date: 2026-04-27...');
    results427.forEach(res => {
        console.log(`- ${res.type} (${res.slug}): ${res.status}`);
        assert.strictEqual(res.status, 'Unavailable', `4/27 items should all be Unavailable due to date mismatch`);
    });

    console.log('\n✅ COMPREHENSIVE TEST PASSED');
}

runComprehensiveTest();
