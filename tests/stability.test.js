const assert = require('assert');
const { waitForAngular } = require('../src/index.js');

/**
 * Mock Page for Stability Tests
 */
function createMockStabilityPage({ angularReady, requestsCount, timeoutTrigger }) {
    return {
        waitForFunction: async (fn, { timeout }) => {
            if (timeoutTrigger) throw new Error("Timeout");
            // Simulate the internal function evaluation
            const result = await fn();
            if (!result) throw new Error("Stability check failed in mock");
            return true;
        },
        screenshot: async () => Buffer.from(""),
        content: async () => "<html></html>",
        // Global variables inside page context
        evaluate: async (fn) => {
            global.window = { angular: { element: () => ({ injector: () => ({ get: () => ({ outstandingRequestsCount: requestsCount }) }) }) } };
            return fn();
        }
    };
}

async function runStabilityTests() {
    console.log("🚀 Starting Stability & Hydration Tests...");

    // Test: Angular Success
    try {
        // Since waitForAngular uses a complex browser-side function, 
        // we test the wrapper's error handling.
        const page = {
            waitForFunction: async () => true, // Success
        };
        await waitForAngular(page);
        console.log("✅ Test: waitForAngular Success Case");
    } catch (e) { console.error("❌ Test failed:", e.message); }

    // Test: Angular Timeout (Strict Fail)
    try {
        const page = {
            waitForFunction: async () => { throw new Error("timeout"); },
            screenshot: async () => Buffer.from(""),
            content: async () => "<html></html>",
        };
        await waitForAngular(page);
        console.error("❌ Test failed: Should have thrown STRICT FAIL on timeout");
    } catch (e) {
        assert.ok(e.message.includes("STRICT FAIL"), "Should map timeout to STRICT FAIL");
        console.log("✅ Test: waitForAngular Timeout Mapping");
    }

    console.log("\n🏁 Stability Tests Completed.");
}

runStabilityTests().catch(e => {
    console.error(e);
    process.exit(1);
});
