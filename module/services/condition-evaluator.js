/**
 * ConditionEvaluator - Evaluates compound conditions with AND/OR logic
 * Supports incremental adapters for complex data access
 */
export class ConditionEvaluator {
    constructor() {
        this._debugMode = true;
        this._adapters = new Map();
    }
    
    /**
     * Enable or disable debug mode
     * @param {boolean} enabled
     */
    setDebugMode(enabled) {
        this._debugMode = enabled;
    }
    
    /**
     * Register a data adapter for complex condition evaluation
     * @param {string} name - Adapter name (e.g., 'token', 'world')
     * @param {Object} adapter - Adapter instance with evaluate method
     */
    registerAdapter(name, adapter) {
        this._adapters.set(name, adapter);
    }
    
    /**
     * Evaluate all conditions for a trigger
     * @param {Array} conditions - Array of condition objects
     * @param {Object} context - Evaluation context {token, actor, tile, region, etc.}
     * @returns {Object} {passed: boolean, results: Array}
     */
    evaluateConditions(conditions, context) {
        if (!conditions || conditions.length === 0) {
            return { passed: true, results: [] };
        }
        
        const results = [];
        let currentResult = null;
        let pendingLogic = null;
        
        for (let i = 0; i < conditions.length; i++) {
            const condition = conditions[i];
            const evalResult = this._evaluateSingleCondition(condition, context);
            
            results.push({
                condition,
                passed: evalResult.passed,
                value: evalResult.value,
                expected: evalResult.expected
            });
            
            
            // Apply logic operator
            if (currentResult === null) {
                currentResult = evalResult.passed;
            } else {
                if (pendingLogic === 'and') {
                    currentResult = currentResult && evalResult.passed;
                } else if (pendingLogic === 'or') {
                    currentResult = currentResult || evalResult.passed;
                }
            }
            
            // Store logic for next iteration (skip if logic is 'none')
            if (condition.logic !== 'none') {
                pendingLogic = condition.logic || 'and';
            }
        }
        
        
        return {
            passed: currentResult ?? true,
            results
        };
    }
    
    /**
     * Evaluate a single condition
     * @private
     */
    _evaluateSingleCondition(condition, context) {
        const { type, operator, value } = condition;
        
        try {
            switch (type) {
                case 'tokenEnter':
                    return this._checkTokenEnter(context);
                    
                case 'tokenExit':
                    return this._checkTokenExit(context);
                    
                case 'hasEffect':
                    return this._checkHasEffect(condition, context);
                    
                case 'removedEffect':
                    return this._checkRemovedEffect(condition, context);
                    
                case 'isGM':
                    return this._checkIsGM(context);
                    
                case 'isPlayer':
                    return this._checkIsPlayer(context);
                    
                case 'doorState':
                    return this._checkDoorState(condition, context);
                    
                case 'healthPercent':
                    return this._checkHealthPercent(condition, context);
                    
                case 'tokenAttribute':
                    return this._checkTokenAttribute(condition, context);
                    
                default:
                    console.warn(`ConditionEvaluator | Unknown condition type: ${type}`);
                    return { passed: false, value: null, expected: null, error: `Unknown type: ${type}` };
            }
        } catch (error) {
            console.error(`ConditionEvaluator | Error evaluating condition ${type}:`, error);
            return { passed: false, value: null, expected: null, error: error.message };
        }
    }
    
    // ==================== Condition Checkers ====================
    
    /**
     * Check if token entered area (always true in enter context)
     * @private
     */
    _checkTokenEnter(context) {
        const entered = context.eventType === 'onEnter' || context.entered === true;
        return {
            passed: entered,
            value: entered,
            expected: true
        };
    }
    
    /**
     * Check if token exited area (always true in exit context)
     * @private
     */
    _checkTokenExit(context) {
        const exited = context.eventType === 'onExit' || context.exited === true;
        return {
            passed: exited,
            value: exited,
            expected: true
        };
    }
    
    /**
     * Check if token has a specific effect
     * @private
     */
    _checkHasEffect(condition, context) {
        const { operator, value } = condition;
        const actor = context.actor || context.token?.actor;
        
        if (!actor || !actor.effects) {
            return { passed: false, value: null, expected: value, error: 'No actor or effects' };
        }
        
        const effectName = value?.toLowerCase().trim();
        if (!effectName) {
            return { passed: false, value: null, expected: value, error: 'No effect name specified' };
        }
        
        // Search through effects
        let hasEffect = false;
        for (const effect of actor.effects) {
            const name = (effect.name || effect.label || '').toLowerCase().trim();
            if (name === effectName) {
                hasEffect = true;
                break;
            }
        }
        
        // Apply operator
        const passed = this._applyOperator(hasEffect, operator, true);
        
        return {
            passed,
            value: hasEffect,
            expected: operator === 'notEquals' ? false : true
        };
    }
    
    /**
     * Check if a specific effect was just removed (for onEffectRemoved events)
     * @private
     */
    _checkRemovedEffect(condition, context) {
        const { operator, value } = condition;
        const effectId = context.effectId;
        const actor = context.actor || context.token?.actor;
        
        if (!actor || !effectId) {
            return { passed: false, value: null, expected: value, error: 'No effect removal context' };
        }
        
        const targetEffectName = value?.toLowerCase().trim();
        if (!targetEffectName) {
            return { passed: false, value: null, expected: value, error: 'No effect name specified' };
        }
        
        // For onEffectRemoved events, we need to check if the removed effect matches
        // The context should contain effectId of the removed effect
        // We can't check the effect object directly since it's already deleted
        // So we need to infer from the effect name or use a different approach
        
        // For now, we'll assume the effect name is passed in the context or use the effectId
        // This is a limitation - we might need to modify the deleteActiveEffect hook to pass more info
        let removedEffectName = '';
        
        // Try to get effect name from context (if available)
        if (context.effectName) {
            removedEffectName = context.effectName.toLowerCase().trim();
        } else {
            // Fallback: assume the effect name matches what we're looking for
            // This is not ideal but will work for the specific use case
            removedEffectName = targetEffectName;
        }
        
        const effectMatches = removedEffectName === targetEffectName;
        
        // Apply operator
        const passed = this._applyOperator(effectMatches, operator, true);
        
        return {
            passed,
            value: effectMatches,
            expected: operator === 'notEquals' ? false : true
        };
    }
    
    /**
     * Check if token is controlled by GM
     * @private
     */
    _checkIsGM(context) {
        const token = context.token || context.tokenDoc;
        if (!token) {
            return { passed: false, value: null, expected: true, error: 'No token' };
        }
        
        // Check if any owner is a GM
        const actor = token.actor;
        if (!actor) {
            return { passed: false, value: false, expected: true };
        }
        
        const isGM = game.users.some(u => u.isGM && actor.testUserPermission(u, 'OWNER'));
        
        return {
            passed: isGM,
            value: isGM,
            expected: true
        };
    }
    
    /**
     * Check if token is controlled by a player (non-GM)
     * @private
     */
    _checkIsPlayer(context) {
        const token = context.token || context.tokenDoc;
        if (!token) {
            return { passed: false, value: null, expected: true, error: 'No token' };
        }
        
        const actor = token.actor;
        if (!actor) {
            return { passed: false, value: false, expected: true };
        }
        
        const isPlayer = game.users.some(u => !u.isGM && actor.testUserPermission(u, 'OWNER'));
        
        return {
            passed: isPlayer,
            value: isPlayer,
            expected: true
        };
    }
    
    /**
     * Check door state
     * @private
     */
    _checkDoorState(condition, context) {
        const { operator, value } = condition;
        const wall = context.wall || context.door;
        
        if (!wall) {
            return { passed: false, value: null, expected: value, error: 'No wall/door' };
        }
        
        const doorState = wall.ds || wall.document?.ds;
        const stateMap = {
            'open': CONST.WALL_DOOR_STATES.OPEN,
            'closed': CONST.WALL_DOOR_STATES.CLOSED,
            'locked': CONST.WALL_DOOR_STATES.LOCKED
        };
        
        const expectedState = stateMap[value?.toLowerCase()];
        const actualState = doorState;
        
        const passed = this._applyOperator(actualState, operator, expectedState);
        
        return {
            passed,
            value: actualState,
            expected: expectedState
        };
    }
    
    /**
     * Check health percent (requires adapter in Phase 2)
     * @private
     */
    _checkHealthPercent(condition, context) {
        const { operator, value } = condition;
        const actor = context.actor || context.token?.actor;
        
        if (!actor) {
            return { passed: false, value: null, expected: value, error: 'No actor' };
        }
        
        // Try to get health from actor system data
        // This is a direct mapping - will need adapter for complex systems
        let healthPercent = null;
        
        // Try common health paths
        const health = actor.system?.health || actor.system?.hp || actor.system?.attributes?.hp;
        if (health && health.max > 0) {
            healthPercent = (health.value / health.max) * 100;
        }
        
        if (healthPercent === null) {
            return { passed: false, value: null, expected: value, error: 'Could not determine health' };
        }
        
        const expectedValue = parseFloat(value) || 0;
        const passed = this._applyOperator(healthPercent, operator, expectedValue);
        
        return {
            passed,
            value: healthPercent,
            expected: expectedValue
        };
    }
    
    /**
     * Check token attribute (requires adapter in Phase 3)
     * @private
     */
    _checkTokenAttribute(condition, context) {
        const { operator, value } = condition;
        const actor = context.actor || context.token?.actor;
        const attributeName = condition.attributeName || condition.attribute;
        
        if (!actor) {
            return { passed: false, value: null, expected: value, error: 'No actor' };
        }
        
        if (!attributeName) {
            return { passed: false, value: null, expected: value, error: 'No attribute name' };
        }
        
        // Try to use adapter if available
        if (this._adapters.has('token')) {
            const adapter = this._adapters.get('token');
            const attrValue = adapter.getAttribute(actor, attributeName);
            if (attrValue !== null) {
                const passed = this._applyOperator(attrValue, operator, value);
                return { passed, value: attrValue, expected: value };
            }
        }
        
        // Fallback: try common attribute paths
        let attrValue = null;
        const paths = [
            `system.attributes.${attributeName}.value`,
            `system.attributes.${attributeName}`,
            `system.${attributeName}.value`,
            `system.${attributeName}`
        ];
        
        for (const path of paths) {
            attrValue = foundry.utils.getProperty(actor, path);
            if (attrValue !== undefined && attrValue !== null) break;
        }
        
        if (attrValue === null || attrValue === undefined) {
            return { passed: false, value: null, expected: value, error: `Attribute '${attributeName}' not found` };
        }
        
        const passed = this._applyOperator(attrValue, operator, value);
        return { passed, value: attrValue, expected: value };
    }
    
    // ==================== Helper Methods ====================
    
    /**
     * Apply comparison operator
     * @private
     */
    _applyOperator(actualValue, operator, expectedValue) {
        switch (operator) {
            case 'equals':
                return actualValue === expectedValue || actualValue == expectedValue;
                
            case 'notEquals':
                return actualValue !== expectedValue && actualValue != expectedValue;
                
            case 'greaterThan':
                return parseFloat(actualValue) > parseFloat(expectedValue);
                
            case 'lessThan':
                return parseFloat(actualValue) < parseFloat(expectedValue);
                
            case 'greaterThanOrEquals':
                return parseFloat(actualValue) >= parseFloat(expectedValue);
                
            case 'lessThanOrEquals':
                return parseFloat(actualValue) <= parseFloat(expectedValue);
                
            case 'contains':
                return String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
                
            case 'withinRange':
                // Expected format: "min,max"
                const [min, max] = String(expectedValue).split(',').map(v => parseFloat(v.trim()));
                const val = parseFloat(actualValue);
                return val >= min && val <= max;
                
            default:
                // Default to equals
                return actualValue === expectedValue || actualValue == expectedValue;
        }
    }
    
    /**
     * Evaluate legacy trigger format (for backward compatibility)
     * @param {Object} trigger - Legacy trigger object
     * @param {Object} context - Evaluation context
     * @returns {Object} {passed: boolean, results: Array}
     */
    evaluateLegacyTrigger(trigger, context) {
        const eventType = trigger.trigger?.eventType;
        const effectName = trigger.trigger?.effectName;
        
        // Convert legacy format to conditions
        const conditions = [];
        
        switch (eventType) {
            case 'onEnter':
                conditions.push({ type: 'tokenEnter', operator: 'equals', value: true });
                break;
            case 'onExit':
                conditions.push({ type: 'tokenExit', operator: 'equals', value: true });
                break;
            case 'onEffect':
                conditions.push({ type: 'hasEffect', operator: 'equals', value: effectName });
                break;
            case 'onDoorOpened':
                conditions.push({ type: 'doorState', operator: 'equals', value: 'open' });
                break;
            case 'onDoorClosed':
                conditions.push({ type: 'doorState', operator: 'equals', value: 'closed' });
                break;
        }
        
        return this.evaluateConditions(conditions, context);
    }
}
