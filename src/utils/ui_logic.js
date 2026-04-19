const cheerio = require('cheerio');

/**
 * Determines the current login status based ONLY on the provided HTML content.
 */
function checkLoginStatus(html) {
    if (!html) return 'UNKNOWN';

    const $ = cheerio.load(html);
    
    // Check for PAGE_ERROR_500 before removing script/style
    const fullTextLower = $('body').text().toLowerCase();
    if (fullTextLower.includes('someone ate the page') || 
        fullTextLower.includes('the page that you are trying to reach does not exist') ||
        $('meta[name="prerender-status-code"][content="404"]').length > 0) {
        return 'PAGE_ERROR_404';
    }
    if (fullTextLower.includes('unable to retrieve any reservation information') || 
        fullTextLower.includes('system is currently unavailable') ||
        fullTextLower.includes('technical difficulties') ||
        fullTextLower.includes("we're working on it") ||
        $('wdpr-system-error[error-code="500"]').length > 0 ||
        $('meta[name="prerender-status-code"][content="500"]').length > 0) {
        return 'PAGE_ERROR_500';
    }

    $('script, style, template').remove();
    $('.hidden, [style*="display: none"], [style*="display:none"]').remove();

    const visibleText = $('body').text();
    const hasEmail = $('input[type="email"], input#InputIdentityFlowValue, input#InputEmail').length > 0;
    const hasPassword = $('input[type="password"], input#InputPassword').length > 0;
    const hasOtpInput = $('#InputRedeemOTP, input[name="otp"], .otp-input').length > 0;

    if (hasOtpInput) {
        if (visibleText.includes('Enter Code')) return 'OTP2';
        return 'OTP1';
    }

    if (visibleText.includes('Choose a new MyDisney password') || 
        visibleText.includes('Choose a new password') ||
        visibleText.includes('Your password must be changed')) {
        return 'PASSWORD_CHANGE_NEEDED';
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

    if (visibleText.includes('6-digit code') || visibleText.includes('Check your email')) {
        if (visibleText.includes('Enter Code')) return 'OTP2';
        return 'OTP1';
    }

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
    /**
     * Cleans guest names by removing age indicators and excess whitespace.
     */
    cleanGuestName: (rawName) => {
        if (!rawName) return "";
        return rawName.replace(/Age\s*\d+\+?|Infant/gi, '').replace(/\s+/g, ' ').trim();
    }
};
