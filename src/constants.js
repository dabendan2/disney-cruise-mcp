module.exports = {
    URLS: {
        LOGIN: "https://disneycruise.disney.go.com/login/?appRedirect=%2Fmy-disney-cruise%2Fmy-reservations%2F",
        RESERVATION_BASE: "/my-disney-cruise/"
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
        GUEST_CHECKBOX: 'label.btn-checkbox-label',
        ACTIVITY_CARD: 'wdpr-activity-card',
        SAVE_BUTTON: 'button, .cta-button',
        SELECT_ADD_BUTTON: 'button, a.btn'
    },
    ERROR_INDICATORS: [
        "Someone Ate the Page!",
        "The page that you are trying to reach does not exist",
        "Page Not Found"
    ],
    AUTH_MARKERS: ["Sign Out", "My Account", "My Plans"]
};
