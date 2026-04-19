const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkLoginStatus } = require('../../../../src/utils/ui_logic');

function runTests() {
    console.log('🚀 Running PAGE_ERROR_404 logic tests...');
    
    const resDir = path.join(__dirname, '../../../fixtures');
    
    // Test Case 1: Real 404 Sample (Someone Ate the Page!)
    const sample404 = path.join(resDir, 'PAGE_ERROR_404.html');
    if (fs.existsSync(sample404)) {
        const html = fs.readFileSync(sample404, 'utf8');
        const status = checkLoginStatus(html);
        assert.strictEqual(status, 'PAGE_ERROR_404', 'Should detect \"Someone Ate the Page!\" from real sample');
        console.log('✅ Real 404 Sample -> PAGE_ERROR_404');
    }

    // Test Case 2: Meta Status 404
    const htmlMeta = '<html><head><meta name="prerender-status-code" content="404"></head><body>Something</body></html>';
    assert.strictEqual(checkLoginStatus(htmlMeta), 'PAGE_ERROR_404');
    console.log('✅ Meta 404 -> PAGE_ERROR_404');

    // Test Case 3: Error Description Text
    const htmlText = '<body><p>The page that you are trying to reach does not exist. Just in case, please check the URL.</p></body>';
    assert.strictEqual(checkLoginStatus(htmlText), 'PAGE_ERROR_404');
    console.log('✅ 404 Text -> PAGE_ERROR_404');
    
    console.log('🏁 PAGE_ERROR_404 Logic Tests Completed.');
}

runTests();
