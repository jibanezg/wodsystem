/**
 * Utility Functions for World of Darkness System
 * Contains helper functions, Handlebars helpers, and other utilities
 */

/**
 * Handlebars helper for repeating blocks
 * Usage: {{#times 5}}<div>Item {{@index}}</div>{{/times}}
 */
export function registerHandlebarsHelpers() {
    Handlebars.registerHelper('times', function(n, block) {
        let accum = '';
        for(let i = 0; i < n; ++i) {
            block.data.index = i;
            accum += block.fn(i);
        }
        return accum;
    });
}

/**
 * Utility function to format numbers
 */
export function formatNumber(num, decimals = 0) {
    return Number(num).toFixed(decimals);
}

/**
 * Utility function to capitalize first letter
 */
export function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Utility function to generate random ID
 */
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

/**
 * Utility function to deep clone objects
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
} 