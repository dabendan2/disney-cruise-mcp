const assert = require('assert');
const { waitForAngular } = require('../../../src/browser/stability');

/**
 * Unit Test: service_stability
 * Validates waitForAngular behavior.
 */
async function runStabilityTests() {
    console.log("🚀 Starting Stability & Hydration Tests...");

    // Test: Angular Success
    try {
        const page = {
            waitForFunction: async () => true, // Success
        };
        await waitForAngular(page);
        console.log("✅ Test: waitForAngular Success Case");
    } catch (e) { 
        console.error("❌ Test failed:", e.message); 
        process.exit(1);
    }

    // Test: Angular Timeout (Non-fatal)
    // As per V2 strategy, Angular timeouts are warnings, not fatal errors.
    try {
        const page = {
            waitForFunction: async () => { throw new Error("timeout"); },
            evaluate: async () => ({ outstandingCount: 1, pendingUrls: [] }),
            screenshot: async () => Buffer.from(""),
            content: async () => "<html></html>",
        };
        await waitForAngular(page, 100); // Short timeout for test
        console.log("✅ Test: waitForAngular Timeout (Verified Non-fatal)");
    } catch (e) {
        console.error("❌ Test failed: waitForAngular should be non-fatal on timeout. Error:", e.message);
        process.exit(1);
    }

    console.log("\n🏁 Stability Tests Completed.");
}

runStabilityTests().catch(e => {
    console.error(e);
    process.exit(1);
});
