const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

/**
 * Replicating the logic from src/automation/catalog.js Step 3
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

        // The logic from catalog.js
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
    
    // Deduplicate by slug
    return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

function runRealSampleTest() {
    console.log('🚀 Running 4/27 REAL SAMPLE validation test...');

    const samplePath = path.join(__dirname, '../res/MENU_INSPECTION.html');
    if (!fs.existsSync(samplePath)) {
        console.error('❌ Sample file not found at:', samplePath);
        process.exit(1);
    }

    const html = fs.readFileSync(samplePath, 'utf8');

    // Scenario 1: We are looking at this menu on 4/27
    // Even though it has row-enabled for "Onboard Fun", the href is for 4/23.
    // It SHOULD be Unavailable for 4/27.
    console.log('Checking against target date: 2026-04-27...');
    const results427 = extractActivities(html, '2026-04-27');
    
    results427.forEach(res => {
        console.log(`- ${res.type} (${res.slug}): ${res.status}`);
        assert.strictEqual(res.status, 'Unavailable', `Expected ${res.type} to be Unavailable for 4/27 due to date mismatch or disabled state`);
    });

    // Scenario 2: We are looking at this menu on 4/23
    // It SHOULD be Available for "Onboard Fun", "Dining", and "Spa & Fitness"
    console.log('\nChecking against target date: 2026-04-23...');
    const results423 = extractActivities(html, '2026-04-23');
    
    const onboard = results423.find(r => r.slug === 'ONBOARDFUN');
    const port = results423.find(r => r.slug === 'PORTADVENTURES');
    
    assert.strictEqual(onboard.status, 'Available', 'Onboard Fun should be Available for 4/23');
    assert.strictEqual(port.status, 'Unavailable', 'Port Adventures should be Unavailable (row-disabled)');

    console.log('\n✅ REAL SAMPLE validation test -> PASSED');
}

runRealSampleTest();
