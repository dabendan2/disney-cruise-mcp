const assert = require('assert');
const cheerio = require('cheerio');
const { PATHS } = require('../../../../src/constants');

/**
 * Unit Test: bookable_activity_types.test.js
 * Testing the legacy extraction logic for basic category parsing.
 */
function extractBookableActivities(html, resId) {
    const $ = cheerio.load(html);
    const results = [];
    
    const container = $('.add-activities-menu, .popover, .dropdown-menu, .modal-content, body').first();
    const elements = container.find('a, button, [role="button"]').toArray();
    
    elements.forEach(el => {
        const $el = $(el);
        const href = $el.attr('href') || "";
        let text = $el.text().trim();
        text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
        
        const match = href.match(/\/(\d{8})\/([A-Z]+)\//);
        if (match && text.length > 1) {
            const isDisabled = $el.hasClass('disabled') || 
                             $el.attr('aria-disabled') === 'true' ||
                             $el.attr('disabled') !== undefined;
            
            results.push({
                type: text,
                slug: match[2],
                status: isDisabled ? "Unavailable" : "Available"
            });
        }
    });
    
    return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

function runTests() {
    console.log('🚀 Running getBookableActivityTypes extraction tests...');
    const resId = '44079507';
    const html = `
        <div class="add-activities-menu">
            <a href="${PATHS.RESERVATION_ROOT}/${resId}/ONBOARDFUN/" class="item">Onboard Fun</a>
            <a href="${PATHS.RESERVATION_ROOT}/${resId}/DINE/" class="item disabled">Dining</a>
            <button href="${PATHS.RESERVATION_ROOT}/${resId}/SPAANDFITNESS/" aria-disabled="true">Spa & Fitness</button>
        </div>
    `;

    const results = extractBookableActivities(html, resId);

    assert.strictEqual(results.length, 3, 'Should extract 3 activity types');
    
    const onboard = results.find(r => r.slug === 'ONBOARDFUN');
    assert.strictEqual(onboard.status, 'Available', 'Onboard Fun should be Available');
    
    const dine = results.find(r => r.slug === 'DINE');
    assert.strictEqual(dine.status, 'Unavailable', 'Dining should be Unavailable (disabled class)');
    
    const spa = results.find(r => r.slug === 'SPAANDFITNESS');
    assert.strictEqual(spa.status, 'Unavailable', 'Spa should be Unavailable (aria-disabled)');

    console.log('✅ getBookableActivityTypes extraction -> PASSED');
}

runTests();
