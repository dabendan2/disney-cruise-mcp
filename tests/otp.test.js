const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { MailOTP } = require('../src/utils/otp');

// Mock setup
const tokenPath = path.join(__dirname, 'res', 'mock_google_token.json');

function setupMockToken(content) {
    if (!fs.existsSync(path.dirname(tokenPath))) fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, JSON.stringify(content));
}

async function runOTPTests() {
    console.log("🚀 Starting Unit Tests for MailOTP (Mocked API)...");

    const otpService = new MailOTP();
    otpService.tokenPath = tokenPath;
    
    const originalFetch = global.fetch;

    // Test 1: Token Refresh Logic
    try {
        setupMockToken({
            token: "old_token",
            expiry: new Date(Date.now() - 10000).toISOString(),
            token_uri: "https://mock.auth/token",
            client_id: "id",
            client_secret: "secret",
            refresh_token: "refresh"
        });

        global.fetch = async (url) => {
            if (url === "https://mock.auth/token") {
                return {
                    ok: true,
                    json: async () => ({ access_token: "new_token", expires_in: 3600 })
                };
            }
            return { ok: false };
        };

        const token = await otpService._getAccessToken();
        assert.strictEqual(token, "new_token");
        console.log("✅ Test 1 Passed: Token Refresh Logic");
    } catch (e) { console.error("❌ Test 1 Failed:", e.message); }

    // Test 2: OTP Extraction from HTML
    try {
        global.fetch = async (url) => {
            if (url.includes('/messages?')) {
                return { ok: true, json: async () => ({ messages: [{ id: "msg123" }] }) };
            }
            if (url.includes('/messages/msg123')) {
                return {
                    ok: true,
                    json: async () => ({
                        payload: {
                            parts: [{
                                mimeType: 'text/html',
                                body: { data: Buffer.from('<html><body><div style="font-size: 28px;"> 123456 </div></body></html>').toString('base64') }
                            }]
                        }
                    })
                };
            }
        };
        const code = await otpService._fetchOTP();
        assert.strictEqual(code, "123456");
        console.log("✅ Test 2 Passed: OTP Extraction (HTML)");
    } catch (e) { console.error("❌ Test 2 Failed:", e.message); }

    // Test 3: OTP Extraction from Snippet
    try {
        global.fetch = async (url) => {
            if (url.includes('/messages?')) return { ok: true, json: async () => ({ messages: [{ id: "msg456" }] }) };
            if (url.includes('/messages/msg456')) return { ok: true, json: async () => ({ snippet: "Code 654321", payload: { body: { data: "" } } }) };
        };
        const code = await otpService._fetchOTP();
        assert.strictEqual(code, "654321");
        console.log("✅ Test 3 Passed: OTP Extraction (Snippet)");
    } catch (e) { console.error("❌ Test 3 Failed:", e.message); }

    // Test 4: Real Sample
    try {
        const sample = fs.readFileSync(path.join(__dirname, 'res', 'dcl_otp_email.html'), 'utf8');
        global.fetch = async (url) => {
            if (url.includes('/messages?')) return { ok: true, json: async () => ({ messages: [{ id: "real" }] }) };
            if (url.includes('/messages/real')) return { ok: true, json: async () => ({ payload: { parts: [{ mimeType: 'text/html', body: { data: Buffer.from(sample).toString('base64') } }] } }) };
        };
        const code = await otpService._fetchOTP();
        assert.strictEqual(code, "264778");
        console.log("✅ Test 4 Passed: OTP Extraction (Real Sample)");
    } catch (e) { console.error("❌ Test 4 Failed:", e.message); }

    // Test 5: Timeout
    try {
        global.fetch = async () => ({ ok: true, json: async () => ({ messages: [] }) });
        await otpService.poll(500); // Small timeout
        console.error("❌ Test 5 Failed: Should have timed out");
    } catch (e) {
        if (e.message.includes("STRICT FAIL") && e.message.includes("timed out")) {
            console.log("✅ Test 5 Passed: Polling Timeout");
        } else {
            console.error("❌ Test 5 Failed with wrong message:", e.message);
        }
    }

    global.fetch = originalFetch;
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
}

runOTPTests().catch(console.error);
