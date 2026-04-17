const assert = require('assert');
const { checkPageStatus } = require('../src/index.js');

/**
 * Mock Page Object
 */
function createMockPage({ url, content, title, iframeVisible, otpVisible, loginVisible, errorText }) {
    return {
        url: () => url || "https://example.com",
        content: async () => content || "<html></html>",
        title: async () => title || "Disney Cruise Line",
        locator: (selector) => ({
            isVisible: async () => {
                if (selector === '#oneid-iframe') return !!iframeVisible;
                return false;
            },
            innerText: async () => errorText || "",
            first: () => ({
                isVisible: async () => {
                    if (selector.includes('tel') || selector.includes('OTP')) return !!otpVisible;
                    if (selector.includes('email') || selector.includes('LoginValue')) return !!loginVisible;
                    return false;
                }
            })
        }),
        frameLocator: (selector) => ({
            locator: (s) => ({
                innerText: async () => errorText || "",
                first: () => ({
                    isVisible: async () => {
                        if (s.includes('tel') || s.includes('OTP')) return !!otpVisible;
                        if (s.includes('email') || s.includes('LoginValue')) return !!loginVisible;
                        return false;
                    }
                })
            })
        }),
        screenshot: async () => Buffer.from(""),
    };
}

async function runTests() {
    console.log("🚀 Starting Unit Tests for checkPageStatus...");

    // Test 1: Logged In Detection
    try {
        const page = createMockPage({ content: "Sign Out" });
        const status = await checkPageStatus(page);
        assert.strictEqual(status, "LOGGED_IN", "Should detect LOGGED_IN via 'Sign Out'");
        console.log("✅ Test 1 Passed: Logged In Detection");
    } catch (e) { console.error("❌ Test 1 Failed:", e.message); }

    // Test 2: URL Pattern Detection (Universal Session)
    try {
        const page = createMockPage({ url: "https://disneycruise.disney.go.com/my-disney-cruise/12345678/summary/" });
        const status = await checkPageStatus(page);
        assert.strictEqual(status, "LOGGED_IN", "Should detect LOGGED_IN via URL pattern");
        console.log("✅ Test 2 Passed: Universal Session Verification");
    } catch (e) { console.error("❌ Test 2 Failed:", e.message); }

    // Test 3: OTP Screen Detection
    try {
        const page = createMockPage({ iframeVisible: true, otpVisible: true });
        const status = await checkPageStatus(page);
        assert.strictEqual(status, "OTP_SCREEN", "Should detect OTP_SCREEN");
        console.log("✅ Test 3 Passed: OTP Screen Detection");
    } catch (e) { console.error("❌ Test 3 Failed:", e.message); }

    // Test 4: Stitch 404 Detection
    try {
        const page = createMockPage({ content: "Someone Ate the Page!" });
        await checkPageStatus(page);
        console.error("❌ Test 4 Failed: Should have thrown 404 error");
    } catch (e) {
        assert.ok(e.message.includes("404"), "Error message should mention 404");
        console.log("✅ Test 4 Passed: 404/Stitch Detection");
    }

    // Test 5: Login Error Detection
    try {
        const page = createMockPage({ iframeVisible: true, errorText: "Invalid password" });
        await checkPageStatus(page);
        console.error("❌ Test 5 Failed: Should have thrown login error");
    } catch (e) {
        assert.ok(e.message.includes("Invalid password"), "Error message should contain site error text");
        console.log("✅ Test 5 Passed: Login Error Detection");
    }

    // Test 6: Unknown Status Strict Fail
    try {
        const page = createMockPage({ url: "https://random.site" });
        await checkPageStatus(page);
        console.error("❌ Test 6 Failed: Should have thrown Unknown Status error");
    } catch (e) {
        assert.ok(e.message.includes("Unexpected Page State"), "Should throw STRICT FAIL for unknown states");
        console.log("✅ Test 6 Passed: Unknown Status Strict Fail");
    }

    // Test 7: New Tab / Blank Page detection (NEED_LOGIN)
    try {
        const page = createMockPage({ url: "chrome://new-tab-page/" });
        const status = await checkPageStatus(page);
        assert.strictEqual(status, "NEED_LOGIN", "Should detect NEED_LOGIN for chrome:// URLs");
        console.log("✅ Test 7 Passed: New Tab Detection");
    } catch (e) { console.error("❌ Test 7 Failed:", e.message); }

    console.log("\n🏁 All Status Logic Tests Completed.");
}

runTests().catch(e => {
    console.error("Fatal test error:", e);
    process.exit(1);
});
