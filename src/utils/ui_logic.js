/**
 * Pure logic functions for DCL UI interaction and state detection.
 * Separated from Playwright/MCP code to allow clean unit testing.
 */

/**
 * Checks if the provided text indicates a booking conflict (e.g. already booked).
 */
function isBookingConflict(cardText) {
    if (!cardText) return false;
    const conflictKeywords = ["already booked", "another reservation", "not available for selection"];
    return conflictKeywords.some(k => cardText.toLowerCase().includes(k));
}

/**
 * Robustly determines activity status based on button visibility and card text.
 */
function determineActivityStatus(cardText, isBtnVisible) {
    if (isBtnVisible) return "Available";
    if (!cardText) return "Not Available";
    
    if (cardText.includes("Sold Out")) return "Sold Out";
    if (cardText.includes("available on board")) return "Onboard Only";
    return "Not Available";
}

/**
 * Determines how many guests to select based on card description.
 */
function getTargetGuestCount(cardText, totalGuests) {
    if (!cardText) return totalGuests;
    const onlyOneGuest = cardText.includes("Book for 1 Guest only");
    return onlyOneGuest ? Math.min(1, totalGuests) : totalGuests;
}

/**
 * Common selectors for Disney Cruise Line UI
 */
const SELECTORS = {
    ERROR_MESSAGES: '#warning-messaging-title, .error-message, [role="alert"], .warning-messaging-title',
    SAVE_BUTTON: 'button, .cta-button',
    SELECT_ADD_BUTTON: 'button, a.btn',
    GUEST_LABEL: 'label.btn-checkbox-label'
};

module.exports = {
    isBookingConflict,
    determineActivityStatus,
    getTargetGuestCount,
    SELECTORS
};
