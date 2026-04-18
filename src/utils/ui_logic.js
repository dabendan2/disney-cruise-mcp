const cheerio = require('cheerio');

/**
 * Determines the current login status based ONLY on the provided HTML content.
 * Returns a status string corresponding to the uppercase names of real DOM samples in tests/res.
 */
function checkLoginStatus(html) {
    if (!html) return 'UNKNOWN';

    const $ = cheerio.load(html);
    
    // Step 0: Detect System/Page Errors (e.g. Disney API failure)
    const bodyText = $('body').text();
    if (bodyText.includes('unable to retrieve any reservation information') || 
        bodyText.includes('system is currently unavailable') ||
        bodyText.includes('technical difficulties')) {
        return 'PAGE_ERROR';
    }

    // Step 1: Clean-up
    $('script, style, template').remove();
    $('.hidden, [style*="display: none"], [style*="display:none"]').remove();

    const visibleText = $('body').text();
    const hasEmail = $('input[type="email"], input#InputIdentityFlowValue, input#InputEmail').length > 0;
    const hasPassword = $('input[type="password"], input#InputPassword').length > 0;
    const hasOtpInput = $('#InputRedeemOTP, input[name="otp"], .otp-input').length > 0;

    // Step 2: Specific Input-based Detection (High Precision)
    if (hasOtpInput) {
        if (visibleText.includes('Enter Code')) return 'OTP2';
        return 'OTP1';
    }

    if (hasEmail && hasPassword) return 'LOGIN2';
    if (hasPassword) return 'LOGIN1_PWD';
    
    if (hasEmail) {
        const hasError = $('.is-invalid, .input-error, .error-message, .invalid-feedback, .form-error').length > 0 ||
                        $('[role="alert"]:not(.global-overlay)').length > 0 ||
                        visibleText.includes('Please check your spelling') ||
                        visibleText.includes('Doesn’t look quite right');
        
        return hasError ? 'LOGIN1_ERR' : 'LOGIN1';
    }

    // Step 3: Text-based Fallback (Medium Precision)
    if (visibleText.includes('6-digit code') || visibleText.includes('Check your email')) {
        if (visibleText.includes('Enter Code')) return 'OTP2';
        return 'OTP1';
    }

    // Step 4: Wrapper-based Detection (Low Precision - Generic Login)
    const wrapper = $('#oneid-wrapper');
    if (wrapper.length > 0) {
        const isActive = wrapper.hasClass('state-active') || 
                        (wrapper.attr('style') && wrapper.attr('style').includes('display: block'));
        
        if (isActive) return 'LOGIN2';
    }

    return 'UNKNOWN';
}

module.exports = {
    checkLoginStatus,
    isBookingConflict: (cardText) => {
        if (!cardText) return false;
        const conflictKeywords = ['already booked', 'another reservation', 'not available for selection'];
        return conflictKeywords.some(k => cardText.toLowerCase().includes(k));
    },
    determineActivityStatus: (cardText, isBtnVisible) => {
        if (isBtnVisible) return 'Available';
        if (!cardText) return 'Not Available';
        if (cardText.includes('Sold Out')) return 'Sold Out';
        if (cardText.includes('available on board')) return 'Onboard Only';
        return 'Not Available';
    },
    getTargetGuestCount: (cardText, totalGuests) => {
        if (!cardText) return totalGuests;
        const onlyOneGuest = cardText.includes('Book for 1 Guest only');
        return onlyOneGuest ? Math.min(1, totalGuests) : totalGuests;
    },
    SELECTORS: {
        ERROR_MESSAGES: '#warning-messaging-title, .error-message, [role="alert"], .warning-messaging-title',
        SAVE_BUTTON: 'button, .cta-button',
        SELECT_ADD_BUTTON: 'button, a.btn',
        GUEST_LABEL: 'label.btn-checkbox-label'
    }
};
