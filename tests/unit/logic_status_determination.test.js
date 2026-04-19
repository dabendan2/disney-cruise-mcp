const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkLoginStatus, isBookingConflict, getTargetGuestCount, determineActivityStatus } = require('../../src/utils/ui_logic');

function runTests() {
    console.log('🚀 Running checkLoginStatus logic tests...');
    
    // Synthetic tests for code coverage edge cases
    assert.strictEqual(isBookingConflict(null), false);
    assert.strictEqual(getTargetGuestCount(null, 4), 4);
    assert.strictEqual(determineActivityStatus(null, false), 'Not Available');
    console.log('✅ Basic utils edge cases -> PASSED');

    const resDir = path.join(__dirname, '../res');
    let passed = 0;
    let failed = 0;

    const testCases = [
        { file: 'LOGIN1.DOM.html', expected: 'LOGIN1' },
        { file: 'LOGIN1_ERR.DOM.html', expected: 'LOGIN1_ERR' },
        { file: 'LOGIN1_PWD.DOM.html', expected: 'LOGIN1_PWD' },
        { file: 'LOGIN2.DOM.html', expected: 'LOGIN2' },
        { file: 'OTP1.DOM.html', expected: 'OTP1' },
        { file: 'OTP2.DOM.html', expected: 'OTP2' },
        { file: 'PAGE_ERROR_404.html', expected: 'PAGE_ERROR_404' },
        { file: 'PAGE_ERROR.DOM.html', expected: 'PAGE_ERROR_500' },
        { file: 'PAGE_ERROR_500.html', expected: 'PAGE_ERROR_500' },
        { file: 'NAV_SUCCESS_UNKNOWN.DOM.html', expected: 'UNKNOWN' }
    ];

    testCases.forEach(({ file, expected }) => {
        const filePath = path.join(resDir, file);
        if (!fs.existsSync(filePath)) {
            console.warn('⚠️ Skip: ' + file + ' not found.');
            return;
        }

        const html = fs.readFileSync(filePath, 'utf8');
        const actual = checkLoginStatus(html);

        try {
            assert.strictEqual(actual, expected, 'Mismatch for ' + file);
            console.log('✅ [PASS] ' + file + ' -> ' + actual);
            passed++;
        } catch (e) {
            console.error('❌ [FAIL] ' + file + ': Expected ' + expected + ', got ' + actual);
            failed++;
        }
    });

    // Synthetic tests for text-based fallback
    assert.strictEqual(checkLoginStatus('<html><body>Check your email for code</body></html>'), 'OTP1');
    assert.strictEqual(checkLoginStatus('<html><body>Check your email Enter Code</body></html>'), 'OTP2');
    console.log('✅ Synthetic OTP fallbacks -> PASSED');

    assert.strictEqual(checkLoginStatus('<html><body>Hello World</body></html>'), 'UNKNOWN');
    console.log('✅ Random page -> UNKNOWN');

    console.log('\nSummary: ' + passed + ' passed, ' + failed + ' failed.');
    if (failed > 0) process.exit(1);
}

runTests();
