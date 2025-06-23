/**
 * Template Loader - Utility for loading and rendering HTML templates
 * Handles template loading, variable replacement, and conditional rendering
 */

class TemplateLoader {
    constructor() {
        this.templateCache = new Map();
    }

    /**
     * Load a template from file
     * @param {string} templatePath - Path to the template file
     * @returns {Promise<string>} Template content
     */
    async loadTemplate(templatePath) {
        // Check cache first
        if (this.templateCache.has(templatePath)) {
            return this.templateCache.get(templatePath);
        }

        try {
            const response = await fetch(templatePath);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.status}`);
            }
            const template = await response.text();
            
            // Cache the template
            this.templateCache.set(templatePath, template);
            
            return template;
        } catch (error) {
            console.error(`TemplateLoader: Error loading template ${templatePath}:`, error);
            throw error;
        }
    }

    /**
     * Render a template with variables
     * @param {string} templatePath - Path to the template file
     * @param {Object} variables - Variables to replace in template
     * @returns {Promise<string>} Rendered HTML
     */
    async renderTemplate(templatePath, variables = {}) {
        const template = await this.loadTemplate(templatePath);
        return this.renderString(template, variables);
    }

    /**
     * Render a template string with variables
     * @param {string} template - Template string
     * @param {Object} variables - Variables to replace in template
     * @returns {string} Rendered HTML
     */
    renderString(template, variables = {}) {
        let result = template;

        // Replace simple variables {{variableName}}
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, variables[key] || '');
        });

        // Handle conditional rendering {{#if condition}}content{{/if}}
        result = this.renderConditionals(result, variables);

        return result;
    }

    /**
     * Render conditional blocks in template
     * @param {string} template - Template string
     * @param {Object} variables - Variables for condition evaluation
     * @returns {string} Template with conditionals rendered
     */
    renderConditionals(template, variables) {
        // Simple conditional rendering: {{#if condition}}content{{/if}}
        const conditionalRegex = /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs;
        
        return template.replace(conditionalRegex, (match, condition, content) => {
            // Check if the condition is true
            const isTrue = this.evaluateCondition(condition, variables);
            return isTrue ? content : '';
        });
    }

    /**
     * Evaluate a condition against variables
     * @param {string} condition - Condition to evaluate
     * @param {Object} variables - Variables to check against
     * @returns {boolean} True if condition is met
     */
    evaluateCondition(condition, variables) {
        // Handle simple conditions like "textSelected", "numberSelected", etc.
        if (condition.endsWith('Selected')) {
            const baseCondition = condition.replace('Selected', '');
            return variables[baseCondition] === true || variables[baseCondition] === 'true';
        }
        
        // Handle direct variable checks
        return variables[condition] === true || variables[condition] === 'true';
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.templateCache.clear();
    }

    /**
     * Remove a specific template from cache
     * @param {string} templatePath - Path to the template to remove
     */
    removeFromCache(templatePath) {
        this.templateCache.delete(templatePath);
    }
}

// Create global instance
window.templateLoader = new TemplateLoader(); 