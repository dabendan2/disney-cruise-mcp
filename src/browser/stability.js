const { logTime, saveDebug } = require('../utils/debug');

/**
 * Wait for Angular/SPA stability.
 * Reverted to original logic (outstandingRequestsCount === 0) but with diagnostic output on timeout.
 */
async function waitForAngular(page, timeout = 45000) {
    logTime("Wait for Angular/SPA stability (Standard Check)...");
    
    try {
        await page.waitForFunction(() => {
            const el = document.querySelector('[ng-app], .ng-scope, body');
            if (!window.angular || !el) return true;
            try {
                const injector = window.angular.element(el).injector();
                if (!injector) return true;
                const browser = injector.get('$browser');
                return browser.outstandingRequestsCount === 0;
            } catch (e) { return true; }
        }, { timeout });
        logTime("✅ SPA Stability confirmed.");
    } catch (e) {
        // Diagnostic extraction on timeout
        const diagnostic = await page.evaluate(() => {
            try {
                const el = document.querySelector('[ng-app], .ng-scope, body');
                if (!window.angular || !el) return "Angular/Element not found";
                const injector = window.angular.element(el).injector();
                const $http = injector.get('$http');
                const $browser = injector.get('$browser');
                return {
                    outstandingCount: $browser.outstandingRequestsCount,
                    pendingUrls: ($http.pendingRequests || []).map(r => r.url)
                };
            } catch (err) { return "Diag error: " + err.message; }
        }).catch(() => "Eval error");

        logTime(`[WARN] Angular Stability Timeout. Pending state: ${JSON.stringify(diagnostic)}`);
        
        const path = await saveDebug(page, "angular_timeout_diag");
        logTime(`[DEBUG] Diagnostic evidence saved at ${path}`);
    }
    
    await new Promise(r => setTimeout(r, 2000));
}

module.exports = { waitForAngular };
