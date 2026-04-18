const assert = require('assert');
const { checkPageStatus } = require('../../src/index.js');
const fs = require('fs');
const path = require('path');

/**
 * Mock Page Object Factory
 */
function createMockPage({ url, content, title, iframeVisible, otpVisible, loginVisible, passwordVisible, errorText }) {
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
                    if (selector.includes('password') || selector.includes('Password')) return !!passwordVisible;
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
                        if (s.includes('password') || s.includes('Password')) return !!passwordVisible;
                        return false;
                    }
                })
            })
        }),
        screenshot: async () => Buffer.from(""),
    };
}

/**
 * Unit Test: Page Status Determination
 * Verifies that the system correctly identifies where it is in the Disney flow.
 */
async function runStatusLogicTests() {
    console.log("🚀 Starting Unit Tests: logic_status_determination...");

    // 1. Logged In Detection (Markers)
    console.log("Step: Testing Logged In Detection (Markers)");
    const loggedInPage = createMockPage({ content: "Sign Out" });
    assert.strictEqual(await checkPageStatus(loggedInPage), "LOGGED_IN");

    // 2. URL Pattern Detection
    console.log("Step: Testing URL Pattern Detection");
    const urlResPage = createMockPage({ url: "https://disneycruise.disney.go.com/my-disney-cruise/12345678/summary/" });
    assert.strictEqual(await checkPageStatus(urlResPage), "LOGGED_IN");

    // 3. OTP Screen Detection
    console.log("Step: Testing OTP Screen Detection");
    const otpPage = createMockPage({ iframeVisible: true, otpVisible: true });
    assert.strictEqual(await checkPageStatus(otpPage), "OTP_SCREEN");

    // 4. Combined Login Detection
    console.log("Step: Testing Combined Login Screen");
    const combinedPage = createMockPage({ iframeVisible: true, loginVisible: true, passwordVisible: true });
    assert.strictEqual(await checkPageStatus(combinedPage), "LOGIN_SCREEN_BOTH");

    // 5. 404 Detection
    console.log("Step: Testing 404/Page Not Found Detection");
    const errorPage = createMockPage({ content: "Someone Ate the Page!" });
    assert.strictEqual(await checkPageStatus(errorPage), "PAGE_NOT_FOUND_ERROR");

    // 6. Login Error Detection
    console.log("Step: Testing Login Error Catching");
    const loginErrorPage = createMockPage({ iframeVisible: true, errorText: "Invalid password" });
    try {
        await checkPageStatus(loginErrorPage);
    } catch (e) {
        assert.ok(e.message.includes("Invalid password"));
        console.log("✅ Caught login error correctly.");
    }

    // --- Reality Check with Snapshots ---
    console.log("\nStep: Snapshot Reality Checks");
    
    const resDir = path.join(__dirname, '../res');
    
    // Test: Activity List Snapshot
    const activityHtmlPath = path.join(resDir, 'activity_list.html');
    if (fs.existsSync(activityHtmlPath)) {
        const html = fs.readFileSync(activityHtmlPath, 'utf8');
        const snapPage = createMockPage({ 
            url: "https://disneycruise.disney.go.com/my-disney-cruise/44079507/DINE/2026-04-25/",
            content: html 
        });
        assert.strictEqual(await checkPageStatus(snapPage), "LOGGED_IN");
        console.log("✅ Activity List Snapshot detected as LOGGED_IN.");
    }

    // Test: Initial Load Snapshot
    const loadHtmlPath = path.join(resDir, 'initial_load.html');
    if (fs.existsSync(loadHtmlPath)) {
        const html = fs.readFileSync(loadHtmlPath, 'utf8');
        const snapPage = createMockPage({ url: "chrome://new-tab-page/", content: html });
        assert.strictEqual(await checkPageStatus(snapPage), "NEED_LOGIN");
        console.log("✅ Initial Load Snapshot detected as NEED_LOGIN.");
    }

    console.log("\n🏁 logic_status_determination tests completed.");
}

if (require.main === module) {
    runStatusLogicTests().catch(e => {
        console.error(e);
        process.exit(1);
    });
}
