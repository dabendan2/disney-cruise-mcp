const assert = require('assert');
const cheerio = require('cheerio');

/**
 * Replicating the updated extraction logic from catalog.js
 */
function extractBookableActivitiesEnhanced(html, resId) {
    const $ = cheerio.load(html);
    const results = [];
    
    // Target only the active modal/popover
    const container = $('.add-plans-modal, .popover, .wdpr-popover, body').first();
    const rows = container.find('.add-plans-row, .actTypeItem, li').toArray();
    
    rows.forEach(row => {
        const $row = $(row);
        
        // Check for ANY sign of disability in the row or its children
        const hasDisabledClass = $row.hasClass('row-disabled') || $row.find('.row-disabled').length > 0;
        const hasAriaDisabled = $row.attr('aria-disabled') === 'true' || $row.find('[aria-disabled="true"]').length > 0;
        const isDisabled = hasDisabledClass || hasAriaDisabled;

        const titleEl = $row.find('.add-plans-option-title').length > 0 ? $row.find('.add-plans-option-title') : $row;
        let text = titleEl.text().trim();
        text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
        if (text === "Close" || text.length < 2 || text.includes('Choose an activity')) return;

        const anchor = $row.find('a').length > 0 ? $row.find('a') : ($row.is('a') ? $row : null);
        let slug = "UNKNOWN";
        
        if (anchor) {
            const href = anchor.attr('href') || "";
            const match = href.match(/\/([A-Z]+)\//);
            if (match) slug = match[1];
        }
        
        if (slug === "UNKNOWN") {
            const t = text.toUpperCase();
            if (t.includes('ONBOARD')) slug = 'ONBOARDFUN';
            else if (t.includes('DINING')) slug = 'DINE';
            else if (t.includes('SPA')) slug = 'SPAANDFITNESS';
            else if (t.includes('PORT')) slug = 'PORTADVENTURES';
            else if (t.includes('NURSERY')) slug = 'NURSERY';
        }

        if (slug !== "UNKNOWN") {
            results.push({ 
                type: text, 
                slug, 
                status: isDisabled ? "Unavailable" : "Available" 
            });
        }
    });
    
    return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

function runTests() {
    console.log('🚀 Running getBookableActivityTypes ENHANCED extraction tests...');

    const sampleHtml = `
        <div class="add-plans-modal">
            <div class="add-plans-row">
                <div aria-disabled="true" class="row-disabled">
                    <span class="add-plans-option-title">Onboard Fun</span>
                </div>
            </div>
            <div class="add-plans-row">
                <a class="row-anchor" href="/my-disney-cruise/44079507/DINE/2026-04-23/">
                    <span class="add-plans-option-title">Dining</span>
                </a>
            </div>
            <div class="add-plans-row">
                <div class="actTypeItem">
                    <div class="row-disabled">
                        <span class="add-plans-option-title">Spa & Fitness</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    const results = extractBookableActivitiesEnhanced(sampleHtml, '44079507');
    console.log('Results:', JSON.stringify(results, null, 2));

    assert.strictEqual(results.find(r => r.slug === 'ONBOARDFUN').status, 'Unavailable', 'Onboard Fun should be Unavailable');
    assert.strictEqual(results.find(r => r.slug === 'DINE').status, 'Available', 'Dining should be Available');
    assert.strictEqual(results.find(r => r.slug === 'SPAANDFITNESS').status, 'Unavailable', 'Spa should be Unavailable (nested row-disabled)');

    console.log('✅ getBookableActivityTypes ENHANCED extraction -> PASSED');
}

runTests();
