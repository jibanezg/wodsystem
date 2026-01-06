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
     * Debug helper - logs values
     */
    Handlebars.registerHelper('debug', function(label, value) {
        console.log(`🐛 HANDLEBARS DEBUG [${label}]:`, value);
        return '';
    });
    
    /**
     * Concat helper - concatenates strings
     */
    Handlebars.registerHelper('concat', function(...args) {
        // Remove the options object (last arg)
        args.pop();
        return args.join('');
    });
    
    /**
     * Range helper - generates array of numbers from start to end (exclusive)
     * Usage: {{#each (range 1 6)}} generates [1, 2, 3, 4, 5]
     */
    Handlebars.registerHelper('range', function(start, end) {
        const result = [];
        for (let i = start; i < end; i++) {
            result.push(i);
        }
        return result;
    });
    
    /**
     * Render dots helper - generates filled/empty dots based on value
     * Usage: {{renderDots value maxDots}}
     */
    Handlebars.registerHelper('renderDots', function(value, maxDots) {
        const currentValue = value || 0;
        let html = '';
        for (let i = 1; i <= maxDots; i++) {
            const filled = i <= currentValue ? 'filled' : '';
            html += `<span class="dot ${filled}"></span>`;
        }
        return new Handlebars.SafeString(html);
    });

    /**
     * Default value helper - returns first value if truthy, otherwise returns default
     * Usage: {{default value 0}}
     */
    Handlebars.registerHelper('default', function(value, defaultValue) {
        return (value !== undefined && value !== null) ? value : defaultValue;
    });

    /**
     * Logical OR helper
     * Usage: {{#if (or condition1 condition2)}}
     */
    Handlebars.registerHelper('or', function() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    });

    /**
     * Logical AND helper
     * Usage: {{#if (and condition1 condition2)}}
     */
    Handlebars.registerHelper('and', function() {
        return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
    });

    /**
     * Greater than or equal helper
     * Usage: {{#if (gte value1 value2)}}
     */
    Handlebars.registerHelper('gte', function(a, b) {
        return a >= b;
    });

    /**
     * Subtract helper
     * Usage: {{subtract value1 value2}} or {{sub value1 value2}}
     */
    Handlebars.registerHelper('subtract', function(a, b) {
        return (a || 0) - (b || 0);
    });
    
    // Alias for subtract
    Handlebars.registerHelper('sub', function(a, b) {
        return (a || 0) - (b || 0);
    });

    /**
     * Min helper
     * Usage: {{min value1 value2}}
     */
    Handlebars.registerHelper('min', function(a, b) {
        return Math.min(a || 0, b || 0);
    });

    /**
     * Find background value by name
     * Usage: {{findBackgroundValue backgrounds "Allies"}}
     */
    Handlebars.registerHelper('findBackgroundValue', function(backgrounds, bgName) {
        if (!backgrounds || !Array.isArray(backgrounds)) return 0;
        const found = backgrounds.find(bg => bg.name === bgName);
        return found ? found.value : 0;
    });

    /**
     * Find background index by name
     * Usage: {{findBackgroundIndex backgrounds "Allies"}}
     */
    Handlebars.registerHelper('findBackgroundIndex', function(backgrounds, bgName) {
        if (!backgrounds || !Array.isArray(backgrounds)) return -1;
        return backgrounds.findIndex(bg => bg.name === bgName);
    });

    /**
     * Check if an abilities category has any rated abilities (value > 0)
     * Usage: {{#if (hasRatedAbilities this)}}
     */
    Handlebars.registerHelper('hasRatedAbilities', function(abilityCategory) {
        if (!abilityCategory || typeof abilityCategory !== 'object') return false;
        return Object.values(abilityCategory).some(value => value > 0);
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