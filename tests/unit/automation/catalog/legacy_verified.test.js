const assert = require('assert');
const cheerio = require('cheerio');

/**
 * Extraction logic based on the REAL HTML DUMP from DCL site
 */
function extractFromVerifiedStructure(html) {
    const $ = cheerio.load(html);
    const results = [];
    
    $('.add-plans-row').each((i, row) => {
        const $row = $(row);
        const anchor = $row.find('a.row-anchor');
        const disabledDiv = $row.find('.row-disabled');
        const titleEl = $row.find('.add-plans-option-title');
        
        if (titleEl.length === 0) return;
        
        let text = titleEl.text().trim();
        let slug = "UNKNOWN";
        let status = "Unavailable";

        if (anchor.length > 0 && disabledDiv.length === 0) {
            const href = anchor.attr('href') || "";
            const match = href.match(/\/([A-Z]+)\//);
            if (match) slug = match[1];
            status = "Available";
        } else if (disabledDiv.length > 0) {
            const t = text.toUpperCase();
            if (t.includes('ONBOARD')) slug = 'ONBOARDFUN';
            else if (t.includes('DINING')) slug = 'DINE';
            else if (t.includes('SPA')) slug = 'SPAANDFITNESS';
            else if (t.includes('PORT')) slug = 'PORTADVENTURES';
            else if (t.includes('NURSERY')) slug = 'NURSERY';
            status = "Unavailable";
        }

        if (slug !== "UNKNOWN") {
            results.push({ type: text, slug, status });
        }
    });
    
    return results;
}

function runTests() {
    console.log('🚀 Running getBookableActivityTypes VERIFIED extraction tests...');

    // This HTML is directly based on the dump result
    const dumpHtml = `
        <div class="add-plans-modal">
            <div class="add-plans-row">
                <a class="row-anchor" href="/my-disney-cruise/44079507/ONBOARDFUN/2026-04-23/">
                    <div class="row-enabled">
                        <span class="add-plans-option-title">Onboard Fun</span>
                    </div>
                </a>
            </div>
            <div class="add-plans-row">
                <div aria-disabled="true" class="row-disabled">
                    <span class="add-plans-option-title">Port Adventures</span>
                </div>
            </div>
            <div class="add-plans-row">
                <a class="row-anchor" href="/my-disney-cruise/44079507/DINE/2026-04-23/">
                    <div class="row-enabled">
                        <span class="add-plans-option-title">Dining</span>
                    </div>
                </a>
            </div>
        </div>
    `;

    const results = extractFromVerifiedStructure(dumpHtml);

    assert.strictEqual(results.length, 3);
    assert.strictEqual(results.find(r => r.slug === 'ONBOARDFUN').status, 'Available');
    assert.strictEqual(results.find(r => r.slug === 'PORTADVENTURES').status, 'Unavailable');
    assert.strictEqual(results.find(r => r.slug === 'DINE').status, 'Available');

    console.log('✅ Verified extraction tests -> PASSED');
}

runTests();
