const assert = require('assert');
const { checkLoginStatus } = require('../../src/utils/ui_logic');
const fs = require('fs');
const path = require('path');

function runTests() {
    console.log('🚀 Running checkLoginStatus logic tests...');
    const resDir = path.join(__dirname, '../res');

    const testCases = [
        { file: 'LOGIN1.DOM.html', expected: 'LOGIN1' },
        { file: 'LOGIN1_ERR.DOM.html', expected: 'LOGIN1_ERR' },
        { file: 'LOGIN1_PWD.DOM.html', expected: 'LOGIN1_PWD' },
        { file: 'LOGIN2.DOM.html', expected: 'LOGIN2' },
        { file: 'OTP1.DOM.html', expected: 'OTP1' },
        { file: 'OTP2.html', expected: 'OTP2' },
        { file: 'activity_list.html', expected: 'UNKNOWN' },
        { file: 'initial_load.html', expected: 'UNKNOWN' }
    ];

    let passed = 0;
    let failed = 0;

    for (const { file, expected } of testCases) {
        const filePath = path.join(resDir, file);
        if (!fs.existsSync(filePath)) {
            console.warn('⚠️ Skip: ' + file + ' not found.');
            continue;
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
    }

    assert.strictEqual(checkLoginStatus('<html><body>Hello World</body></html>'), 'UNKNOWN');
    console.log('✅ Random page -> UNKNOWN');

    console.log('\nSummary: ' + passed + ' passed, ' + failed + ' failed.');
    if (failed > 0) process.exit(1);
}

runTests();
