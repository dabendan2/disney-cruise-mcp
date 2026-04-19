const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkLoginStatus } = require('../../../../src/utils/ui_logic');
const resDir = path.join(__dirname, '../../../fixtures');

async function testPageError() {
    console.log('🚀 Running PAGE_ERROR_500 logic tests...');
    
    // Case 1: Real 500 Sample
    try {
        const sample500 = path.join(resDir, 'PAGE_ERROR_500.html');
        if (fs.existsSync(sample500)) {
            const html500 = fs.readFileSync(sample500, 'utf8');
            const status = checkLoginStatus(html500);
            assert.strictEqual(status, 'PAGE_ERROR_500', 'Should detect 500 error from meta/wdpr tag');
            console.log('✅ Real 500 Sample -> PAGE_ERROR_500');
        } else {
            console.warn('⚠️ Skipping Real 500 Sample (file not found)');
        }
    } catch (e) {
        console.error('❌ Real 500 Sample Failed:', e.message);
        throw e;
    }

    // Case 2: System Unavailable Text
    const htmlText = '<html><body><h1>System is currently unavailable</h1></body></html>';
    assert.strictEqual(checkLoginStatus(htmlText), 'PAGE_ERROR_500');
    console.log('✅ Unavailable Text -> PAGE_ERROR_500');

    // Case 3: "Working on It" Text
    const htmlWorking = "<html><body><div>We're Working on It</div></body></html>";
    assert.strictEqual(checkLoginStatus(htmlWorking), 'PAGE_ERROR_500');
    console.log('✅ "Working on It" Text -> PAGE_ERROR_500');

    console.log('🏁 PAGE_ERROR_500 Logic Tests Completed.');
}

testPageError().catch(err => {
    console.error('Tests failed:', err);
    process.exit(1);
});
