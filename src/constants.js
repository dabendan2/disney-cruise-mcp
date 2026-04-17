module.exports = {
    URLS: {
        LOGIN: "https://disneycruise.disney.go.com/login/?appRedirect=%2Fmy-disney-cruise%2Fmy-reservations%2F",
        RESERVATION_BASE: "/my-disney-cruise/"
    },
    SELECTORS: {
        ONEID_IFRAME: '#oneid-iframe',
        OTP_INPUTS: ['input[type="tel"]', '#InputOTP', '[aria-label*="code"]'],
        LOGIN_INPUTS: ['input[type="email"]', '#InputLoginValue'],
        PASSWORD_INPUTS: ['input[type="password"]', '#InputPassword'],
        SUBMIT_BUTTON: '#BtnSubmit',
        ERROR_MESSAGES: ['.error', '#error', '[role="alert"]'],
        GUEST_CHECKBOX: 'label.btn-checkbox-label',
        ACTIVITY_CARD: 'wdpr-activity-card'
    },
    ERROR_INDICATORS: [
        "Someone Ate the Page!",
        "The page that you are trying to reach does not exist",
        "Page Not Found"
    ],
    AUTH_MARKERS: ["Sign Out", "My Account", "My Plans"]
};
