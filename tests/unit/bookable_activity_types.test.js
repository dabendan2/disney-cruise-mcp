const assert = require('assert');
const cheerio = require('cheerio');

/**
 * Mocking the extraction logic from catalog.js page.evaluate
 */
function extractBookableActivities(html, resId) {
    const $ = cheerio.load(html);
    const results = [];
    
    // Simulating the container selection logic
    const container = $('.add-activities-menu, .popover, .dropdown-menu, .modal-content, body').first();
    const elements = container.find('a, button, [role="button"]').toArray();
    
    elements.forEach(el => {
        const $el = $(el);
        const href = $el.attr('href') || "";
        let text = $el.text().trim();
        text = text.replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '').trim();
        
        const match = href.match(/\/\d{8}\/([A-Z]+)\//);
        if (match && text.length > 1) {
            const isDisabled = $el.hasClass('disabled') || 
                             $el.attr('aria-disabled') === 'true' ||
                             $el.attr('disabled') !== undefined;
            
            results.push({
                type: text,
                slug: match[1],
                status: isDisabled ? "Unavailable" : "Available"
            });
        }
    });
    
    return results.filter((v, i, a) => a.findIndex(t => t.slug === v.slug) === i);
}

function runTests() {
    console.log('🚀 Running getBookableActivityTypes extraction tests...');

    const sampleHtml = `
        <div class="add-activities-menu">
            <a href="/my-disney-cruise/44079507/ONBOARDFUN/" class="item">Onboard Fun</a>
            <a href="/my-disney-cruise/44079507/DINE/" class="item disabled">Dining</a>
            <button href="/my-disney-cruise/44079507/SPAANDFITNESS/" aria-disabled="true">Spa & Fitness</button>
            <a href="/other-link">Ignore me</a>
        </div>
    `;

    const results = extractBookableActivities(sampleHtml, '44079507');

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
