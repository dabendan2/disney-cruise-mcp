
/**
 * Advanced Slot Parser for Disney Cruise Line Activities
 * Handles Shadow DOM and various time formats.
 */

/**
 * Traverses all shadow roots to find elements matching the criteria.
 */
function findInShadows(root, selector) {
    let results = Array.from(root.querySelectorAll(selector));
    const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walkers.nextNode();
    while (node) {
        if (node.shadowRoot) {
            results = results.concat(findInShadows(node.shadowRoot, selector));
        }
        node = walkers.nextNode();
    }
    return results;
}

/**
 * Pure logic for extracting time slots from an HTML string or DOM context.
 * In a browser context, this can be injected.
 */
function extractTimesFromElements(elements) {
    const timeRegex = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM)$/i;
    const voyageRegex = /Voyage Length/i;
    
    const found = elements
        .map(e => (typeof e === 'string' ? e : e.innerText || e.textContent || "").trim())
        .filter(t => timeRegex.test(t) || voyageRegex.test(t));
        
    return [...new Set(found)];
}

module.exports = {
    extractTimesFromElements,
    // This string can be used inside page.evaluate
    browserInjectedParser: `
        function findInShadows(root, selector) {
            let results = Array.from(root.querySelectorAll(selector));
            const allElements = root.querySelectorAll('*');
            for (const el of allElements) {
                if (el.shadowRoot) {
                    results = results.concat(findInShadows(el.shadowRoot, selector));
                }
            }
            return results;
        }
        
        const timeRegex = /^(1[0-2]|[1-9]):[0-5][0-9]\\s?(AM|PM)$/i;
        const voyageRegex = /Voyage Length/i;
        const selectors = 'li[role="option"], button, span, .time-slot, .time, .slot-time';
        
        const elements = findInShadows(document, selectors);
        const times = elements
            .map(e => e.innerText.trim())
            .filter(t => timeRegex.test(t) || voyageRegex.test(t));
        [...new Set(times)];
    `
};
