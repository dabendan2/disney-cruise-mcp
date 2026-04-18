const assert = require('assert');
const { validateArgs } = require('../../src/utils/validation');

async function testValidation() {
    console.log("🚀 Testing Input Validation...");

    // Test 1: Missing arguments object
    try {
        validateArgs(null, ["a"]);
        assert.fail("Should have thrown error for missing args");
    } catch (e) {
        assert.ok(e.message.includes("Missing arguments object"), "Should detect missing args");
        console.log("✅ Test 1 Passed: Missing arguments object detected");
    }

    // Test 2: Missing mandatory parameter
    try {
        validateArgs({ reservationId: "123" }, ["reservationId", "date"]);
        assert.fail("Should have thrown error for missing mandatory parameter");
    } catch (e) {
        assert.ok(e.message.includes("Mandatory parameter 'date' is missing"), "Should detect missing parameter");
        console.log("✅ Test 2 Passed: Missing parameter detected");
    }

    // Test 3: Null parameter
    try {
        validateArgs({ reservationId: "123", date: null }, ["reservationId", "date"]);
        assert.fail("Should have thrown error for null parameter");
    } catch (e) {
        assert.ok(e.message.includes("Mandatory parameter 'date' is missing or null"), "Should detect null parameter");
        console.log("✅ Test 3 Passed: Null parameter detected");
    }

    // Test 4: "null" string parameter (common in automated calls)
    try {
        validateArgs({ reservationId: "123", date: "null" }, ["reservationId", "date"]);
        assert.fail("Should have thrown error for 'null' string");
    } catch (e) {
        assert.ok(e.message.includes("Mandatory parameter 'date' is missing or null"), "Should detect 'null' string");
        console.log("✅ Test 4 Passed: 'null' string detected");
    }

    // Test 5: Empty string parameter
    try {
        validateArgs({ reservationId: "123", date: "" }, ["reservationId", "date"]);
        assert.fail("Should have thrown error for empty string");
    } catch (e) {
        assert.ok(e.message.includes("Mandatory parameter 'date' is missing or null"), "Should detect empty string");
        console.log("✅ Test 5 Passed: Empty string detected");
    }

    // Test 6: Valid parameters
    try {
        validateArgs({ reservationId: "123", date: "2026-04-23", slug: "test", activityName: "abc" }, ["reservationId", "date", "slug", "activityName"]);
        console.log("✅ Test 6 Passed: Valid parameters accepted");
    } catch (e) {
        assert.fail(`Valid parameters should have passed but failed: ${e.message}`);
    }

    console.log("\n🏁 Validation Tests Completed.");
}

testValidation().catch(console.error);
