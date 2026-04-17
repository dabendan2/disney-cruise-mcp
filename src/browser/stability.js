const { logTime, saveDebug } = require('../utils/debug');

async function waitForAngular(page, timeout = 45000) {
    logTime("Wait for Angular/SPA stability...");
    try {
        await page.waitForFunction(() => {
            const hasCards = document.querySelector('wdpr-activity-card') !== null;
            const el = document.querySelector('[ng-app], .ng-scope, body');
            if (hasCards) return true;
            if (!el || !window.angular) return false;
            try {
                const injector = window.angular.element(el).injector();
                if (!injector) return false;
                const browser = injector.get('$browser');
                return browser.outstandingRequestsCount === 0;
            } catch (e) { return false; }
        }, { timeout });
    } catch (e) {
        const path = await saveDebug(page, "angular_timeout");
        throw new Error(`STRICT FAIL: Angular stability check timed out (${timeout}ms). Evidence: ${path}`);
    }
    await new Promise(r => setTimeout(r, 5000));
}

module.exports = { waitForAngular };
