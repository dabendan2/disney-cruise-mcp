const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkLoginStatus } = require('../../src/utils/ui_logic');

function runTests() {
    console.log('🚀 Running PAGE_ERROR logic tests...');
    
    const resDir = path.join(__dirname, '../res');
    
    // Test Case 1: Real 500 Error Sample
    const sample500 = path.join(resDir, 'PAGE_ERROR_500.html');
    if (fs.existsSync(sample500)) {
        const html = fs.readFileSync(sample500, 'utf8');
        const status = checkLoginStatus(html);
        assert.strictEqual(status, 'PAGE_ERROR', 'Should detect 500 error from meta/wdpr tag');
        console.log('✅ Real 500 Sample -> PAGE_ERROR');
    }

    // Test Case 2: System Unavailable Text
    const htmlText = '<body><h1>System is currently unavailable</h1></body>';
    assert.strictEqual(checkLoginStatus(htmlText), 'PAGE_ERROR');
    console.log('✅ Unavailable Text -> PAGE_ERROR');

    // Test Case 3: "We\'re Working on It" Text
    const htmlWorking = '<body><h2>We\'re Working on It</h2><p>This page is temporarily unavailable.</p></body>';
    assert.strictEqual(checkLoginStatus(htmlWorking), 'PAGE_ERROR');
    console.log('✅ "Working on It" Text -> PAGE_ERROR');
    
    console.log('🏁 PAGE_ERROR Logic Tests Completed.');
}

runTests();
