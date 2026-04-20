const fs = require('fs');
const path = require('path');
const { logTime } = require('./debug');

class MailOTP {
    constructor() {
        this.tokenPath = process.env.GOOGLE_TOKEN_PATH || path.join(process.env.HOME, '.hermes', 'google_token.json');
        this.creds = null;
        // Disney OTP query pattern from fetch_otp.py
        this.query = 'from:no-reply@my.disney.com subject:"Your one-time passcode" newer_than:2m';
    }

    /**
     * Ensures we have valid credentials and returns the access token.
     * Throws STRICT FAIL if credentials file is missing or refresh fails.
     */
    async _getAccessToken() {
        if (!fs.existsSync(this.tokenPath)) {
            throw new Error(`STRICT FAIL: Google credentials not found at ${this.tokenPath}. Please run 'hermes setup' or provide google_token.json.`);
        }

        try {
            this.creds = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
        } catch (e) {
            throw new Error(`STRICT FAIL: Failed to parse google_token.json: ${e.message}`);
        }

        const now = new Date();
        const expiry = new Date(this.creds.expiry);

        // If token is valid for at least 2 more minutes, use it
        if (this.creds.token && (expiry.getTime() - now.getTime() > 120000)) {
            return this.creds.token;
        }

        logTime("[OTP] Access token expired, attempting refresh...");
        try {
            const response = await fetch(this.creds.token_uri, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.creds.client_id,
                    client_secret: this.creds.client_secret,
                    refresh_token: this.creds.refresh_token,
                    grant_type: 'refresh_token',
                }),
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Refresh failed (${response.status}): ${errBody}`);
            }

            const data = await response.json();
            this.creds.token = data.access_token;
            if (data.expires_in) {
                this.creds.expiry = new Date(Date.now() + (data.expires_in * 1000)).toISOString();
            }
            
            // Persist the refreshed token
            fs.writeFileSync(this.tokenPath, JSON.stringify(this.creds, null, 2));
            return this.creds.token;
        } catch (e) {
            throw new Error(`STRICT FAIL: Gmail token refresh failed: ${e.message}`);
        }
    }

    /**
     * Fetches the latest message and extracts the 6-digit OTP.
     */
    async _fetchOTP(excludeCode = null) {
        const token = await this._getAccessToken();
        const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(this.query)}`;

        let listResponse;
        try {
            listResponse = await fetch(listUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            throw new Error(`STRICT FAIL: Failed to connect to Gmail API: ${e.message}`);
        }

        if (!listResponse.ok) {
            const err = await listResponse.text();
            throw new Error(`STRICT FAIL: Gmail API Error (${listResponse.status}): ${err}`);
        }

        const listData = await listResponse.json();
        if (!listData.messages || listData.messages.length === 0) {
            return null; // No messages yet
        }

        // Check the most recent message
        const msgId = listData.messages[0].id;
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`;
        
        const msgResponse = await fetch(msgUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!msgResponse.ok) return null;
        const msgData = await msgResponse.json();

        let bodyContent = "";
        // Decode payload (similar to fetch_otp.py logic)
        if (msgData.payload.parts) {
            const htmlPart = msgData.payload.parts.find(p => p.mimeType === 'text/html');
            if (htmlPart && htmlPart.body && htmlPart.body.data) {
                bodyContent = Buffer.from(htmlPart.body.data, 'base64').toString();
            }
        } else if (msgData.payload.body && msgData.payload.body.data) {
            bodyContent = Buffer.from(msgData.payload.body.data, 'base64').toString();
        }

        // 1. Primary Regex (from fetch_otp.py HTML match)
        const htmlMatch = bodyContent.match(/font-size:\s*28px;[^>]*?>[\s\r\n]*(\d{6})[\s\r\n]*</);
        if (htmlMatch) {
            const otp = htmlMatch[1].trim();
            if (otp !== excludeCode) return otp;
        }

        // 2. Fallback Regex (from fetch_otp.py snippet match)
        const snippet = msgData.snippet || "";
        const snippetMatch = snippet.match(/(?<!#)\b\d{6}\b/);
        if (snippetMatch) {
            const otp = snippetMatch[0];
            if (otp !== excludeCode) return otp;
        }

        return null;
    }

    /**
     * Public polling method.
     * Throws STRICT FAIL on timeout or API errors.
     */
    async poll(timeoutMs = 300000, excludeCode = null) {
        logTime(`[OTP] Polling Gmail for Disney OTP (Query: "${this.query}")...`);
        const startTime = Date.now();
        let lastError = null;

        while (Date.now() - startTime < timeoutMs) {
            try {
                const code = await this._fetchOTP(excludeCode);
                if (code) {
                    logTime(`[OTP] Successfully extracted code: ${code}`);
                    return code;
                }
            } catch (e) {
                // If it's a STRICT FAIL from our internal methods, rethrow immediately
                if (e.message.includes("STRICT FAIL")) throw e;
                lastError = e.message;
            }
            await new Promise(r => setTimeout(r, 10000)); // Wait 10s
        }

        throw new Error(`STRICT FAIL: OTP polling timed out after ${timeoutMs/1000}s. Last error: ${lastError || "No mail found"}`);
    }
}

module.exports = { MailOTP };
