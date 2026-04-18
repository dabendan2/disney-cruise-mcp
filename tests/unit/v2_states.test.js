const assert = require('assert');
const { checkLoginStatus } = require('../../src/utils/ui_logic');
const fs = require('fs');
const path = require('path');

/**
 * Unit Test: v2_states.test.js
 * Comprehensive sample-driven verification of login status determination.
 */
function runV2StateTests() {
    console.log('🚀 Starting V2 State Determination Tests...');
    const resDir = path.join(__dirname, '../res');

    const expectations = [
        { file: 'LOGIN1.DOM.html', expected: 'LOGIN1' },
        { file: 'LOGIN1_ERR.DOM.html', expected: 'LOGIN1_ERR' },
        { file: 'LOGIN1_PWD.DOM.html', expected: 'LOGIN1_PWD' },
        { file: 'LOGIN2.DOM.html', expected: 'LOGIN2' },
        { file: 'OTP1.DOM.html', expected: 'OTP1' },
        { file: 'OTP2.html', expected: 'OTP2' },
        { file: 'PAGE_ERROR.DOM.html', expected: 'PAGE_ERROR' },
        { file: 'activity_list.html', expected: 'UNKNOWN' },
        { file: 'initial_load.html', expected: 'UNKNOWN' }
    ];

    expectations.forEach(({ file, expected }) => {
        const fullPath = path.join(resDir, file);
        if (!fs.existsSync(fullPath)) return;
        const html = fs.readFileSync(fullPath, 'utf8');
        const actual = checkLoginStatus(html);
        assert.strictEqual(actual, expected, `Mismatch for ${file}`);
        console.log(`✅ [PASS] ${file.padEnd(25)} -> ${actual}`);
    });

    // Special Case: Active wrapper but NO inputs found in this specific HTML string.
    // Based on requirements to match uppercase samples (LOGIN2.DOM.html), 
    // an active wrapper alone is sufficient to identify the LOGIN2 state group
    // when looking at the host page. session.js handles refinement via iframe.
    const activeWrapperOnly = `
        <html><body>
            <div id="oneid-wrapper" class="state-active" style="display: block;">
                <iframe id="oneid-iframe"></iframe>
            </div>
        </body></html>
    `;
    assert.strictEqual(checkLoginStatus(activeWrapperOnly), 'LOGIN2');
    console.log('✅ [PASS] Active wrapper (host page)     -> LOGIN2');

    console.log('\n🏁 V2 State tests completed successfully.');
}

runV2StateTests();
