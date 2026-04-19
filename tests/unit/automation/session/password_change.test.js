const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkLoginStatus } = require('../../../../src/utils/ui_logic');

async function testPasswordChangeRequired() {
    console.log("🚀 Starting Unit Test: Password Change Required Detection...");

    const fixturePath = path.join(__dirname, '../../../fixtures/PASSWORD_CHANGE_REQUIRED.html');
    const html = fs.readFileSync(fixturePath, 'utf8');

    console.log("Step 1: Testing checkLoginStatus for PASSWORD_CHANGE_NEEDED...");
    const status = checkLoginStatus(html);
    console.log(`Detected Status: ${status}`);
    
    assert.strictEqual(status, 'PASSWORD_CHANGE_NEEDED', "Should detect PASSWORD_CHANGE_NEEDED state");
    console.log("✅ Detection PASSED.");

    console.log("\n🏁 Password Change Unit Test PASSED.");
}

if (require.main === module) {
    testPasswordChangeRequired().catch(err => {
        console.error("❌ Test Failed:", err);
        process.exit(1);
    });
}
