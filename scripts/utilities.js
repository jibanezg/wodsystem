/**
 * Utility Functions for World of Darkness System
 * Contains helper functions, Handlebars helpers, and other utilities
 */

/**
 * Handlebars helper for repeating blocks
 * Usage: {{#times 5}}<div>Item {{@index}}</div>{{/times}}
 */
export function registerHandlebarsHelpers() {
    /**
     * Repeat a block n times
     * Usage: {{#times 5}}<div>Item {{@index}}</div>{{/times}}
     */
    Handlebars.registerHelper('times', function(n, block) {
        let accum = '';
        for(let i = 0; i < n; ++i) {
            block.data.index = i;
            accum += block.fn(i);
        }
        return accum;
    });

    /**
     * Equality comparison
     * Usage: {{#if (eq value "test")}}...{{/if}}
     */
    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });

    /**
     * Not equal comparison
     * Usage: {{#if (neq value "test")}}...{{/if}}
     */
    Handlebars.registerHelper('neq', function(a, b) {
        return a !== b;
    });

    /**
     * Greater than comparison
     * Usage: {{#if (gt value 5)}}...{{/if}}
     */
    Handlebars.registerHelper('gt', function(a, b) {
        return a > b;
    });

    /**
     * Greater than or equal comparison
     * Usage: {{#if (gte value 5)}}...{{/if}}
     */
    Handlebars.registerHelper('gte', function(a, b) {
        return a >= b;
    });

    /**
     * Less than comparison
     * Usage: {{#if (lt value 5)}}...{{/if}}
     */
    Handlebars.registerHelper('lt', function(a, b) {
        return a < b;
    });

    /**
     * Less than or equal comparison
     * Usage: {{#if (lte value 5)}}...{{/if}}
     */
    Handlebars.registerHelper('lte', function(a, b) {
        return a <= b;
    });

    /**
     * Logical AND
     * Usage: {{#if (and condition1 condition2)}}...{{/if}}
     */
    Handlebars.registerHelper('and', function() {
        return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
    });

    /**
     * Logical OR
     * Usage: {{#if (or condition1 condition2)}}...{{/if}}
     */
    Handlebars.registerHelper('or', function() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    });

    /**
     * Logical NOT
     * Usage: {{#if (not condition)}}...{{/if}}
     */
    Handlebars.registerHelper('not', function(value) {
        return !value;
    });

    /**
     * Add numbers
     * Usage: {{add value 1}}
     */
    Handlebars.registerHelper('add', function(a, b) {
        return a + b;
    });

    /**
     * Subtract numbers
     * Usage: {{subtract value 1}}
     */
    Handlebars.registerHelper('subtract', function(a, b) {
        return a - b;
    });

    /**
     * Capitalize first letter
     * Usage: {{capitalize string}}
     */
    Handlebars.registerHelper('capitalize', function(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    });

    /**
     * Convert to lowercase
     * Usage: {{lowercase string}}
     */
    Handlebars.registerHelper('lowercase', function(str) {
        if (!str) return '';
        return str.toLowerCase();
    });

    /**
     * Convert to uppercase
     * Usage: {{uppercase string}}
     */
    Handlebars.registerHelper('uppercase', function(str) {
        if (!str) return '';
        return str.toUpperCase();
    });

    console.log("WoD | Handlebars helpers registered");
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