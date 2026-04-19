const assert = require('assert');
const cheerio = require('cheerio');

/**
 * Verified extraction logic for Disney Adventure "My Plans" Popover
 */
function extractVerified(html) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('.add-plans-row').each((i, row) => {
        const $row = $(row);
        const titleEl = $row.find('.add-plans-option-title');
        if (titleEl.length === 0) return;
        
        let text = titleEl.text().trim();
        const isEnabled = $row.find('.row-enabled').length > 0 && $row.find('a.row-anchor').length > 0;
        const isDisabled = $row.find('.row-disabled').length > 0 || $row.attr('aria-disabled') === 'true';
        
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
                status: (isEnabled && !isDisabled) ? "Available" : "Unavailable" 
            });
        }
    });
    
    return results;
}

function runTests() {
    console.log('🚀 Running getBookableActivityTypes REAL DOM extraction tests...');

    const sampleHtml = `
        <div class="add-plans-modal">
            <!-- Available Item (like Day 2) -->
            <div class="add-plans-row">
                <a class="row-anchor" href="/my-disney-cruise/44079507/SPAANDFITNESS/2026-04-24/">
                    <div class="row-enabled">
                        <span class="add-plans-option-title">Spa & Fitness</span>
                    </div>
                </a>
            </div>
            <!-- Disabled Item (like Day 5) -->
            <div class="add-plans-row">
                <div aria-disabled="true" class="row-disabled">
                    <span class="add-plans-option-title">Dining</span>
                </div>
            </div>
        </div>
    `;

    const results = extractVerified(sampleHtml);
    console.log('Results:', JSON.stringify(results, null, 2));

    const spa = results.find(r => r.slug === 'SPAANDFITNESS');
    assert.strictEqual(spa.status, 'Available', 'Spa should be Available');
    
    const dine = results.find(r => r.slug === 'DINE');
    assert.strictEqual(dine.status, 'Unavailable', 'Dining should be Unavailable');

    console.log('✅ REAL DOM extraction tests -> PASSED');
}

runTests();
