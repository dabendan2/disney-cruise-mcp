/**
 * E2E Test: Fetch Japanese Steakhouse availability and validate against baseline.
 * This test uses real browser automation via CDP and compares results with tests/res/e2e_results_japanese_steakhouse.json.
 */
const { getActivityDetails } = require('../../src/automation/activities');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function checkCDPConnection() {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:9222/json/version', (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Deep comparison helper that ignores the 'timing' field.
 */
function isEqualIgnoringTiming(actual, expected) {
    const a = { ...actual };
    const b = { ...expected };
    delete a.timing;
    delete b.timing;
    try {
        assert.deepStrictEqual(a, b);
        return true;
    } catch (e) {
        return false;
    }
}

async function runE2EJapaneseSteakhouse() {
    console.log("🔍 Checking environment: Chrome CDP (9222)...");
    const isCDPActive = await checkCDPConnection();
    if (!isCDPActive) {
        throw new Error("STRICT FAIL: Chrome CDP is not active on port 9222. Please ensure Chrome is running with --remote-debugging-port=9222.");
    }
    console.log("✅ CDP connection verified.");

    const expectedPath = path.join(__dirname, '../res', 'e2e_results_japanese_steakhouse.json');
    if (!fs.existsSync(expectedPath)) {
        throw new Error(`STRICT FAIL: Expected results file not found at ${expectedPath}`);
    }
    const expectedResults = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

    console.log("🚀 Starting E2E: Japanese Steakhouse availability scan & validation (with 3x Performance Guard)...");
    
    const reservationId = "44079507";
    const slug = "DINE";
    const activityName = "Japanese Steakhouse";
    const dates = ["2026-04-23", "2026-04-24", "2026-04-25", "2026-04-26"];

    let hasMismatch = false;
    const mismatches = [];

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const expected = expectedResults.find(r => r.date === date);
        const expectedTime = expected?.timing?.total_sec || 45; // Default 45s if no baseline
        const timeoutMs = expectedTime * 3 * 1000;
        
        console.log(`\n📅 Checking Date: ${date} (Timeout Guard: ${expectedTime * 3}s)...`);
        try {
            // Task with integrated Timeout Guard
            const actual = await Promise.race([
                getActivityDetails(reservationId, slug, date, activityName),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`STRICT FAIL: Execution exceeded 3x baseline (${expectedTime * 3}s). Task terminated.`)), timeoutMs)
                )
            ]);

            const actualTime = actual.timing?.total_sec || 0;
            console.log(`✅ Result for ${date}: ${actual.status} (${actualTime}s)`);

            if (!expected) {
                console.warn(`⚠️ No expected baseline data for ${date}. Skipping data validation.`);
                continue;
            }

            // Data Integrity Check (Ignoring Timing)
            if (!isEqualIgnoringTiming(actual, expected)) {
                const msg = `Mismatched data for ${date}.\nExpected: ${JSON.stringify(expected, null, 2)}\nActual: ${JSON.stringify(actual, null, 2)}`;
                console.error(`❌ ${msg}`);
                mismatches.push(msg);
                hasMismatch = true;
            } else {
                console.log(`✨ Validation Passed for ${date} (Data & Performance OK).`);
            }
        } catch (e) {
            console.error(`❌ Error for ${date}:`, e.message);
            // If it's a timeout or navigation error, we fail the entire E2E run
            throw e;
        }
    }

    if (hasMismatch) {
        throw new Error(`STRICT FAIL: E2E Validation failed with ${mismatches.length} issues.\n${mismatches.join('\n')}`);
    }

    console.log("\n==================================================");
    console.log("🏁 E2E Scan & Validation Completed Successfully.");
    console.log("==================================================\n");
}

if (require.main === module) {
    runE2EJapaneseSteakhouse().catch(err => {
        console.error("\n💥 E2E Fatal Error:", err.message);
        process.exit(1);
    });
}
