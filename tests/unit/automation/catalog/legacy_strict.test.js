const assert = require('assert');
const cheerio = require('cheerio');

/**
 * Enhanced extraction logic with Strict Date Matching
 */
function extractStrict(html, targetDate) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('.add-plans-row').each((i, row) => {
        const $row = $(row);
        const titleEl = $row.find('.add-plans-option-title');
        if (titleEl.length === 0) return;
        
        let text = titleEl.text().trim();
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
    
    return results;
}

function runTests() {
    console.log('🚀 Running getBookableActivityTypes STRICT extraction tests...');

    const sampleHtml = `
        <div class="add-plans-modal">
            <!-- Ghost Link Scenario (Day 5 popup with Day 1 links) -->
            <div class="add-plans-row">
                <a class="row-anchor" href="/my-disney-cruise/44079507/SPAANDFITNESS/2026-04-23/">
                    <div class="row-enabled">
                        <span class="add-plans-option-title">Spa & Fitness</span>
                    </div>
                </a>
            </div>
            <!-- Disabled Item Scenario -->
            <div class="add-plans-row">
                <div aria-disabled="true" class="row-disabled">
                    <span class="add-plans-option-title">Dining</span>
                </div>
            </div>
            <!-- Valid Link Scenario (Targeting 4/23) -->
            <div class="add-plans-row">
                <a class="row-anchor" href="/my-disney-cruise/44079507/ONBOARDFUN/2026-04-23/">
                    <div class="row-enabled">
                        <span class="add-plans-option-title">Onboard Fun</span>
                    </div>
                </a>
            </div>
        </div>
    `;

    // Case 1: Checking for 4/27
    console.log("Checking for date: 2026-04-27...");
    const results427 = extractStrict(sampleHtml, '2026-04-27');
    assert.strictEqual(results427.find(r => r.slug === 'SPAANDFITNESS').status, 'Unavailable', 'Spa should be Unavailable because date mismatch (4/23 vs 4/27)');
    assert.strictEqual(results427.find(r => r.slug === 'ONBOARDFUN').status, 'Unavailable', 'Onboard Fun should be Unavailable because date mismatch');

    // Case 2: Checking for 4/23
    console.log("Checking for date: 2026-04-23...");
    const results423 = extractStrict(sampleHtml, '2026-04-23');
    assert.strictEqual(results423.find(r => r.slug === 'SPAANDFITNESS').status, 'Available', 'Spa should be Available for 4/23');
    assert.strictEqual(results423.find(r => r.slug === 'ONBOARDFUN').status, 'Available', 'Onboard Fun should be Available for 4/23');
    assert.strictEqual(results423.find(r => r.slug === 'DINE').status, 'Unavailable', 'Dining should be Unavailable (disabled row)');

    console.log('✅ STRICT extraction tests -> PASSED');
}

runTests();
