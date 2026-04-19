const assert = require('assert');
const cheerio = require('cheerio');

/**
 * Replicating the updated extraction logic from catalog.js
 */
function extractBookableActivitiesFixed(html, resId) {
    const $ = cheerio.load(html);
    const results = [];
    
    // Target the specific popup structure
    const container = $('.add-plans-modal, .add-activities-menu, .popover, .dropdown-menu, .wdpr-popover, body').first();
    const rows = container.find('.add-plans-row, .actTypeItem, li').toArray();
    
    rows.forEach(row => {
        const $row = $(row);
        const anchor = $row.find('a.row-anchor').length > 0 ? $row.find('a.row-anchor') : ($row.is('a') ? $row : null);
        const disabledDiv = $row.find('.row-disabled').length > 0 ? $row.find('.row-disabled') : ($row.hasClass('row-disabled') ? $row : null);
        
        const titleEl = $row.find('.add-plans-option-title').length > 0 ? $row.find('.add-plans-option-title') : $row;
        let text = titleEl.text().trim();
        text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
        if (text === "Close" || text.length < 2) return;

        let slug = "UNKNOWN";
        let status = "Unavailable";

        if (anchor) {
            const href = anchor.attr('href') || "";
            const match = href.match(/\/([A-Z]+)\//);
            if (match) slug = match[1];
            status = "Available";
        } else if (disabledDiv) {
            const t = text.toUpperCase();
            if (t.includes('ONBOARD')) slug = 'ONBOARDFUN';
            if (t.includes('DINING')) slug = 'DINE';
            if (t.includes('SPA')) slug = 'SPAANDFITNESS';
            if (t.includes('PORT')) slug = 'PORTADVENTURES';
            if (t.includes('NURSERY')) slug = 'NURSERY';
            status = "Unavailable";
        }

        if (slug !== "UNKNOWN") {
            results.push({ type: text, slug, status });
        }
    });
    
    return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

function runTests() {
    console.log('🚀 Running getBookableActivityTypes FIXED extraction tests...');

    // Sample based on real 4/27 dump
    const realSample427 = `
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
                <div aria-disabled="true" class="row-disabled">
                    <span class="add-plans-option-title">Spa & Fitness</span>
                </div>
            </div>
        </div>
    `;

    const results = extractBookableActivitiesFixed(realSample427, '44079507');

    console.log('Extracted:', JSON.stringify(results, null, 2));

    assert.strictEqual(results.length, 3, 'Should extract 3 activity types');
    
    const onboard = results.find(r => r.slug === 'ONBOARDFUN');
    assert.strictEqual(onboard.status, 'Unavailable', 'Onboard Fun should be Unavailable');
    
    const dine = results.find(r => r.slug === 'DINE');
    assert.strictEqual(dine.status, 'Available', 'Dining should be Available (anchor present)');
    
    const spa = results.find(r => r.slug === 'SPAANDFITNESS');
    assert.strictEqual(spa.status, 'Unavailable', 'Spa should be Unavailable (row-disabled)');

    console.log('✅ getBookableActivityTypes FIXED extraction -> PASSED');
}

runTests();
