/**
 * Disney Cruise Line (DCL) Automation Constants
 */

const BASE_URL = "https://disneycruise.disney.go.com";
const RESERVATION_ROOT = `${BASE_URL}/my-disney-cruise`;

module.exports = {
    PATHS: {
        BASE_URL,
        RESERVATION_ROOT,
        LOGIN_URL: `${BASE_URL}/login/?appRedirect=%2Fmy-disney-cruise%2Fmy-reservations%2F`,
        MY_PLANS: (id) => `${RESERVATION_ROOT}/my-reservations/${id}/my-plans`,
        // Standard DCL URL structure for activities
        ACTIVITY_CATALOG: (id, slug, date) => 
            `${RESERVATION_ROOT}/${id}/${slug}/${date}/?ship=${process.env.SHIP || 'DA'}&port=${process.env.PORT || 'SIN'}`
    },
    SELECTORS: {
        ONEID_IFRAME: '#oneid-iframe',
        OTP_INPUTS: [
            'input[type="tel"]', 
            'input#InputOTP', 
            'input[aria-label*="code" i]', 
            'input[aria-label*="passcode" i]'
        ],
        LOGIN_INPUTS: ['input[type="email"]', '#InputLoginValue'],
        PASSWORD_INPUTS: ['input[type="password"]', '#InputPassword'],
        SUBMIT_BUTTON: '#BtnSubmit',
        ERROR_MESSAGES: [
            '#warning-messaging-title',
            '.error-message',
            '[role="alert"]',
            '.warning-messaging-title',
            '.error',
            '#error'
        ].join(', '),
        GUEST_CHECKBOX: 'li.participant, .participant-item, .participant',
        ACTIVITY_CARD: 'wdpr-activity-card',
        SAVE_BUTTON: 'button, .cta-button',
        SELECT_ADD_BUTTON: 'button, a.btn'
    },
    ERROR_INDICATORS: [
        "Someone Ate the Page!",
        "The page that you are trying to reach does not exist",
        "Page Not Found",
        "We're Working on It",
        "system is currently unavailable",
        "technical difficulties"
    ],
    AUTH_MARKERS: ["Sign Out", "My Account", "My Plans"]
};
