const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkPageStatus } = require('../src/automation/session');

/**
 * These tests use real HTML snapshots saved during actual browser runs
 * to verify that our status detection logic works against real-world DOM structures.
 */

async function runSnapshotTests() {
    console.log("🚀 Starting Reality-Check Tests (Saved HTML Snapshots)...");

    const resDir = path.join(__dirname, 'res');

    // Test 1: Activity List Page (Logged In)
    try {
        const html = fs.readFileSync(path.join(resDir, 'activity_list.html'), 'utf8');
        const mockPage = {
            url: () => "https://disneycruise.disney.go.com/my-disney-cruise/44079507/DINE/2026-04-25/",
            content: async () => html,
            title: async () => "Premium Dining | Disney Cruise Line",
            locator: () => ({ isVisible: async () => false }), // No iframe in this snapshot
        };

        const status = await checkPageStatus(mockPage, "44079507");
        assert.strictEqual(status, "LOGGED_IN", "Should detect LOGGED_IN from real activity list HTML");
        console.log("✅ Test 1 Passed: Activity List Snapshot Detection");
    } catch (e) { console.error("❌ Test 1 Failed:", e.message); }

    // Test 2: Initial Load / Empty State
    try {
        const html = fs.readFileSync(path.join(resDir, 'initial_load.html'), 'utf8');
        const mockPage = {
            url: () => "chrome://new-tab-page/",
            content: async () => html,
            title: async () => "New Tab",
            locator: () => ({ isVisible: async () => false }),
        };

        const status = await checkPageStatus(mockPage);
        assert.strictEqual(status, "NEED_LOGIN", "Should detect NEED_LOGIN from initial load snapshot");
        console.log("✅ Test 2 Passed: Initial Load Snapshot Detection");
    } catch (e) { console.error("❌ Test 2 Failed:", e.message); }

    console.log("\n🏁 Snapshot Logic Tests Completed.");
}

runSnapshotTests().catch(console.error);
