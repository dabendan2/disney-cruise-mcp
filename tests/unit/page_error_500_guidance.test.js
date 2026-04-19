const assert = require('assert');
const { checkLoginStatus } = require('../../src/utils/ui_logic');

/**
 * Mocking the logic that would exist in navigation.js
 */
function validateNavigation(html, url) {
    const status = checkLoginStatus(html);
    
    if (status === 'PAGE_ERROR_500') {
        throw new Error(`STRICT FAIL: 500 Error ("We're Working on It") detected at URL: ${url}. This specific date/activity is currently unavailable in the backend. Please use 'get_bookable_activity_types' to confirm if this date is actually open for booking.`);
    }
    
    return status;
}

function testPageError500Guidance() {
    console.log('🧪 Testing Page Error 500 Guidance Message...');

    const html500 = `
        <html>
            <body>
                <h1>We're Working on It</h1>
                <p>System is currently unavailable</p>
                <wdpr-system-error error-code="500"></wdpr-system-error>
            </body>
        </html>
    `;
    const url = 'https://disneycruise.disney.go.com/my-disney-cruise/44079507/SPAANDFITNESS/2026-04-27/';

    try {
        validateNavigation(html500, url);
        assert.fail('Should have thrown an error for 500');
    } catch (e) {
        console.log('Caught Expected Error:', e.message);
        assert.ok(e.message.includes("We're Working on It"), 'Should mention the 500 error text');
        assert.ok(e.message.includes("get_bookable_activity_types"), 'Should guide to use get_bookable_activity_types');
        assert.ok(e.message.includes("2026-04-27"), 'Should include the URL/Date context');
    }

    console.log('✅ Page Error 500 Guidance Test PASSED');
}

testPageError500Guidance();
