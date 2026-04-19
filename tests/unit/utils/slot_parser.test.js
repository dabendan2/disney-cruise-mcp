
const assert = require('assert');
const { extractTimesFromElements } = require('../../../src/utils/slot_parser');

async function testSlotParser() {
    console.log("🚀 Starting Unit Test: Slot Parser Logic...");

    // Test 1: Basic Extraction
    console.log("Step 1: Testing basic time extraction...");
    const input1 = [
        "  5:30 PM  ",
        "Not a time",
        "7:00 AM",
        "12:45 PM",
        "Voyage Length",
        "99:99 AM"
    ];
    const expected1 = ["5:30 PM", "7:00 AM", "12:45 PM", "Voyage Length"];
    const actual1 = extractTimesFromElements(input1);
    assert.deepStrictEqual(actual1, expected1);
    console.log("✅ Basic extraction verified.");

    // Test 2: Duplicates and Whitespace
    console.log("Step 2: Testing duplicates and whitespace...");
    const input2 = ["6:00 PM", "  6:00 PM  ", "6:00 PM"];
    const actual2 = extractTimesFromElements(input2);
    assert.strictEqual(actual2.length, 1);
    assert.strictEqual(actual2[0], "6:00 PM");
    console.log("✅ Duplicates and whitespace handled.");

    // Test 3: Empty input
    console.log("Step 3: Testing empty input...");
    assert.deepStrictEqual(extractTimesFromElements([]), []);
    console.log("✅ Empty input handled.");

    console.log("\n🏁 Slot Parser Unit Tests PASSED.");
}

if (require.main === module) {
    testSlotParser().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
