import { TriggerEventRegistry } from './trigger-event-registry.js';

/**
 * TriggerAPI - Centralized service for system-wide trigger access
 * Provides query methods, validation, and integration hooks for other dialogs/systems
 * 
 * v2 Architecture:
 * - Document type is auto-detected (tile, region, wall, actor, scene)
 * - Proximity is a modifier, not a scope type
 * - Events are filtered by document type
 * - Actions have flexible target selection
 */
export class TriggerAPI {
    static instance = null;
    static SCHEMA_VERSION = 2;
    
    constructor() {
        this._hooks = new Map();
        this._registry = TriggerEventRegistry.getInstance();
    }
    
    /**
     * Get the singleton instance of TriggerAPI
     * @returns {TriggerAPI}
     */
    static getInstance() {
        if (!TriggerAPI.instance) {
            TriggerAPI.instance = new TriggerAPI();
        }
        return TriggerAPI.instance;
    }
    
    /**
     * Get the event registry
     * @returns {TriggerEventRegistry}
     */
    getRegistry() {
        return this._registry;
    }
    
    // ==================== Document Type Methods ====================
    
    /**
     * Detect the document type from a Foundry document
     * @param {Document} document
     * @returns {string|null}
     */
    detectDocumentType(document) {
        return this._registry.detectDocumentType(document);
    }
    
    /**
     * Get all available document types
     * @returns {Object}
     */
    getDocumentTypes() {
        return this._registry.getDocumentTypes();
    }
    
    /**
     * Check if a document type supports proximity detection
     * @param {string} documentType
     * @returns {boolean}
     */
    supportsProximity(documentType) {
        return this._registry.supportsProximity(documentType);
    }
    
    // ==================== Event Methods ====================
    
    /**
     * Get events available for a document type
     * @param {string} documentType
     * @returns {Object[]}
     */
    getEventsForDocumentType(documentType) {
        return this._registry.getEventsForDocumentType(documentType);
    }
    
    /**
     * Get the default event for a document type
     * @param {string} documentType
     * @returns {string}
     */
    getDefaultEvent(documentType) {
        return this._registry.getDefaultEvent(documentType);
    }
    
    /**
     * Check if an event is valid for a document type
     * @param {string} eventId
     * @param {string} documentType
     * @returns {boolean}
     */
    isEventValidForDocumentType(eventId, documentType) {
        return this._registry.isEventValidForDocumentType(eventId, documentType);
    }
    
    // ==================== Condition Methods ====================
    
    /**
     * Get all available condition types
     * @returns {Object}
     */
    getConditionTypes() {
        return this._registry.getConditionTypes();
    }
    
    /**
     * Get a specific condition type
     * @param {string} typeId
     * @returns {Object|null}
     */
    getConditionType(typeId) {
        return this._registry.getConditionType(typeId);
    }
    
    // ==================== Target Mode Methods ====================
    
    /**
     * Get all available target modes for actions
     * @returns {Object}
     */
    getTargetModes() {
        return this._registry.getTargetModes();
    }
    
    // ==================== DEPRECATED: Scope Types (for backward compatibility) ====================
    
    /**
     * @deprecated Use getDocumentTypes() instead
     * Get scope types - returns document types for backward compatibility
     */
    getScopeTypes() {
        console.warn('TriggerAPI.getScopeTypes() is deprecated. Use getDocumentTypes() instead.');
        return this._registry.getDocumentTypes();
    }
    
    /**
     * @deprecated Use getDocumentType() instead
     */
    getScopeType(typeId) {
        console.warn('TriggerAPI.getScopeType() is deprecated. Use getDocumentType() instead.');
        return this._registry.getDocumentType(typeId);
    }
    
    // ==================== Query Methods ====================
    
    /**
     * Get all triggers for a specific document (tile, region, etc.)
     * @param {Document} document - The document to get triggers for
     * @returns {Array} Array of triggers
     */
    getTriggersForDocument(document) {
        if (!document) return [];
        const triggers = document.getFlag('wodsystem', 'triggers') || [];
        return Array.isArray(triggers) ? triggers : [];
    }
    
    /**
     * Get all triggers on the current scene (from all document types)
     * @returns {Array} Array of {document, documentType, triggers} objects
     */
    getAllSceneTriggers() {
        const results = [];
        
        if (!canvas?.scene) return results;
        
        // Get triggers from tiles
        for (const tile of canvas.scene.tiles) {
            const triggers = this.getTriggersForDocument(tile);
            if (triggers.length > 0) {
                results.push({ document: tile, documentType: 'tile', triggers });
            }
        }
        
        // Get triggers from regions
        if (canvas.scene.regions) {
            for (const region of canvas.scene.regions) {
                const triggers = this.getTriggersForDocument(region);
                if (triggers.length > 0) {
                    results.push({ document: region, documentType: 'region', triggers });
                }
            }
        }
        
        // Get triggers from walls/doors
        for (const wall of canvas.scene.walls) {
            const triggers = this.getTriggersForDocument(wall);
            if (triggers.length > 0) {
                results.push({ document: wall, documentType: 'wall', triggers });
            }
        }
        
        // Get scene-level triggers
        const sceneTriggers = canvas.scene.getFlag('wodsystem', 'sceneTriggers') || [];
        if (Array.isArray(sceneTriggers) && sceneTriggers.length > 0) {
            results.push({ document: canvas.scene, documentType: 'scene', triggers: sceneTriggers });
        }
        
        return results;
    }
    
    /**
     * Get triggers by document type
     * @param {string} documentType - The document type (tile, region, wall, actor, scene)
     * @returns {Array} Array of {document, documentType, trigger} objects
     */
    getTriggersByDocumentType(documentType) {
        const allTriggers = this.getAllSceneTriggers();
        const results = [];
        
        for (const { document, documentType: docType, triggers } of allTriggers) {
            if (docType === documentType) {
                for (const trigger of triggers) {
                    results.push({ document, documentType: docType, trigger });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Get triggers that have proximity enabled
     * @returns {Array} Array of {document, documentType, trigger} objects
     */
    getProximityTriggers() {
        const allTriggers = this.getAllSceneTriggers();
        const results = [];
        
        for (const { document, documentType, triggers } of allTriggers) {
            for (const trigger of triggers) {
                if (trigger.proximity?.enabled) {
                    results.push({ document, documentType, trigger });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Get all currently active triggers (enabled triggers)
     * @returns {Array} Array of active triggers
     */
    getActiveTriggers() {
        const allTriggers = this.getAllSceneTriggers();
        const activeTriggers = [];
        
        for (const { document, documentType, triggers } of allTriggers) {
            for (const trigger of triggers) {
                if (trigger.enabled !== false) {
                    activeTriggers.push({
                        document,
                        documentType,
                        trigger
                    });
                }
            }
        }
        
        return activeTriggers;
    }
    
    /**
     * Get triggers by scope type
     * @param {string} scopeType - The scope type (tile, region, proximity, global)
     * @returns {Array} Array of matching triggers
     */
    getTriggersByScope(scopeType) {
        const allTriggers = this.getAllSceneTriggers();
        const results = [];
        
        for (const { document, documentType, triggers } of allTriggers) {
            for (const trigger of triggers) {
                const triggerScope = trigger.trigger?.scope?.type || this._inferScopeType(trigger, documentType);
                if (triggerScope === scopeType) {
                    results.push({ document, documentType, trigger });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Get triggers that have a specific condition type
     * @param {string} conditionType - The condition type (hasEffect, tokenEnter, etc.)
     * @returns {Array} Array of matching triggers
     */
    getTriggersByCondition(conditionType) {
        const allTriggers = this.getAllSceneTriggers();
        const results = [];
        
        for (const { document, documentType, triggers } of allTriggers) {
            for (const trigger of triggers) {
                if (this._triggerHasCondition(trigger, conditionType)) {
                    results.push({ document, documentType, trigger });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Check if a trigger has a specific condition type
     * @private
     */
    _triggerHasCondition(trigger, conditionType) {
        // New format with conditions array
        if (trigger.trigger?.conditions && Array.isArray(trigger.trigger.conditions)) {
            return trigger.trigger.conditions.some(c => c.type === conditionType);
        }
        
        // Legacy format - map eventType to condition type
        const eventType = trigger.trigger?.eventType;
        const legacyMapping = {
            'onEnter': 'tokenEnter',
            'onExit': 'tokenExit',
            'onEffect': 'hasEffect',
            'onDoorOpened': 'doorState',
            'onDoorClosed': 'doorState'
        };
        
        return legacyMapping[eventType] === conditionType;
    }
    
    /**
     * Infer scope type from document type (for legacy triggers)
     * @private
     */
    _inferScopeType(trigger, documentType) {
        // If trigger has new scope format
        if (trigger.trigger?.scope?.type) {
            return trigger.trigger.scope.type;
        }
        
        // Legacy: infer from document type
        return documentType || 'tile';
    }
    
    // ==================== Validation Methods ====================
    
    /**
     * Validate a trigger structure (v2 schema)
     * @param {Object} trigger - The trigger to validate
     * @returns {Object} Validation result {valid: boolean, errors: string[]}
     */
    validateTrigger(trigger) {
        const errors = [];
        
        if (!trigger) {
            errors.push('Trigger is null or undefined');
            return { valid: false, errors };
        }
        
        // Check for anchor (document type)
        if (!trigger.anchor?.documentType) {
            errors.push('Missing anchor.documentType');
        } else {
            const docType = this._registry.getDocumentType(trigger.anchor.documentType);
            if (!docType) {
                errors.push(`Invalid document type: ${trigger.anchor.documentType}`);
            }
        }
        
        // Check for execution configuration
        if (!trigger.execution) {
            errors.push('Missing execution configuration');
        } else {
            if (!['event', 'state', 'continuous'].includes(trigger.execution.mode)) {
                errors.push(`Invalid execution mode: ${trigger.execution.mode}`);
            }
            
            // Event mode requires an event
            if (trigger.execution.mode === 'event' && !trigger.execution.event) {
                errors.push('Event mode requires an event');
            }
            
            // Validate event is valid for document type
            if (trigger.execution.event && trigger.anchor?.documentType) {
                if (!this._registry.isEventValidForDocumentType(trigger.execution.event, trigger.anchor.documentType)) {
                    errors.push(`Event '${trigger.execution.event}' is not valid for document type '${trigger.anchor.documentType}'`);
                }
            }
        }
        
        // Check for actions
        if (!trigger.actions) {
            errors.push('Missing actions configuration');
        } else {
            const hasActions = (trigger.actions.always?.length > 0) || 
                              (trigger.actions.success?.length > 0) || 
                              (trigger.actions.failure?.length > 0);
            if (!hasActions) {
                errors.push('No actions defined');
            }
        }
        
        // Validate proximity (if enabled)
        if (trigger.proximity?.enabled) {
            if (!this._registry.supportsProximity(trigger.anchor?.documentType)) {
                errors.push(`Document type '${trigger.anchor?.documentType}' does not support proximity`);
            }
        }
        
        // Validate conditions
        if (trigger.conditions && Array.isArray(trigger.conditions)) {
            for (let i = 0; i < trigger.conditions.length; i++) {
                const condition = trigger.conditions[i];
                if (!condition.type) {
                    errors.push(`Condition ${i + 1} is missing type`);
                } else {
                    const conditionInfo = this._registry.getConditionType(condition.type);
                    if (!conditionInfo) {
                        errors.push(`Condition ${i + 1} has invalid type: ${condition.type}`);
                    } else if (conditionInfo.requiresValue && !condition.value) {
                        errors.push(`Condition ${i + 1} (${condition.type}) requires a value`);
                    }
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    // ==================== Factory Methods ====================
    
    /**
     * Create a new trigger with v2 schema
     * @param {string} documentType - The document type (tile, region, wall, actor, scene)
     * @param {string} documentId - The document ID
     * @returns {Object} New trigger object with v2 schema
     */
    createTrigger(documentType = 'tile', documentId = null) {
        const defaultEvent = this._registry.getDefaultEvent(documentType);
        const supportsProximity = this._registry.supportsProximity(documentType);
        
        return {
            id: foundry.utils.randomID(),
            name: '',
            enabled: true,
            version: TriggerAPI.SCHEMA_VERSION,
            
            // Auto-detected anchor
            anchor: {
                documentType: documentType,
                documentId: documentId
            },
            
            // Proximity modifier (only for tile/region)
            proximity: {
                enabled: false,
                distance: 5,
                unit: 'grid',
                shape: 'circle'
            },
            
            // Execution configuration
            execution: {
                mode: 'event',
                event: defaultEvent,
                timing: {
                    delay: 0,
                    repeat: 0,
                    duration: null
                }
            },
            
            // Conditions
            conditions: [],
            
            // Roll configuration
            roll: {
                enabled: false,
                type: 'attribute+ability',
                attribute: '',
                ability: '',
                difficulty: 6,
                successThreshold: 1
            },
            
            // Actions with target selection
            actions: {
                always: [],
                success: [],
                failure: []
            }
        };
    }
    
    /**
     * Add a condition to a trigger (v2 schema)
     * @param {Object} trigger - The trigger object
     * @param {string} conditionType - The condition type
     * @param {Object} options - Additional options (operator, value, logic)
     * @returns {Object} Updated trigger
     */
    addCondition(trigger, conditionType, options = {}) {
        if (!trigger.conditions) {
            trigger.conditions = [];
        }
        
        const condition = {
            type: conditionType,
            operator: options.operator || 'equals',
            value: options.value || null,
            logic: options.logic || 'none'
        };
        
        trigger.conditions.push(condition);
        return trigger;
    }
    
    /**
     * Create a default action with target selection
     * @param {string} actionType - The action type (door, effect, tileAsset, etc.)
     * @param {Object} options - Action options
     * @returns {Object} Action object
     */
    createAction(actionType, options = {}) {
        return {
            type: actionType,
            target: {
                mode: options.targetMode || 'self',
                documentType: options.targetDocumentType || null,
                documentId: options.targetDocumentId || null,
                filter: options.targetFilter || null
            },
            parameters: options.parameters || {},
            delay: options.delay || 0
        };
    }
    
    // ==================== Integration Methods ====================
    
    /**
     * Register a hook callback for trigger events
     * @param {string} hookName - The hook name (triggerFired, triggerCreated, etc.)
     * @param {Function} callback - The callback function
     * @returns {string} Hook ID for unregistering
     */
    registerHook(hookName, callback) {
        if (!this._hooks.has(hookName)) {
            this._hooks.set(hookName, new Map());
        }
        
        const hookId = foundry.utils.randomID();
        this._hooks.get(hookName).set(hookId, callback);
        return hookId;
    }
    
    /**
     * Unregister a hook callback
     * @param {string} hookName - The hook name
     * @param {string} hookId - The hook ID returned by registerHook
     */
    unregisterHook(hookName, hookId) {
        if (this._hooks.has(hookName)) {
            this._hooks.get(hookName).delete(hookId);
        }
    }
    
    /**
     * Notify all registered hooks of an event
     * @param {string} hookName - The hook name
     * @param {...any} args - Arguments to pass to callbacks
     */
    notifyHooks(hookName, ...args) {
        if (this._hooks.has(hookName)) {
            for (const callback of this._hooks.get(hookName).values()) {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`TriggerAPI | Error in hook '${hookName}':`, error);
                }
            }
        }
    }
    
    /**
     * Notify that a trigger was fired
     * @param {string} triggerId - The trigger ID
     * @param {Object} result - The result of the trigger evaluation
     * @param {Object} context - Context about what triggered it
     */
    notifyTriggerFired(triggerId, result, context = {}) {
        this.notifyHooks('triggerFired', triggerId, result, context);
    }
    
    /**
     * Notify that a trigger was created
     * @param {Object} trigger - The trigger that was created
     * @param {Document} document - The document it was created on
     */
    notifyTriggerCreated(trigger, document) {
        this.notifyHooks('triggerCreated', trigger, document);
    }
    
    /**
     * Notify that a trigger was updated
     * @param {Object} trigger - The trigger that was updated
     * @param {Document} document - The document it belongs to
     */
    notifyTriggerUpdated(trigger, document) {
        this.notifyHooks('triggerUpdated', trigger, document);
    }
    
    /**
     * Notify that a trigger was deleted
     * @param {string} triggerId - The trigger ID that was deleted
     * @param {Document} document - The document it was deleted from
     */
    notifyTriggerDeleted(triggerId, document) {
        this.notifyHooks('triggerDeleted', triggerId, document);
    }
    
    // ==================== Cleanup Methods ====================
    
    /**
     * Clear all triggers from a document
     * @param {Document} document - The document to clear triggers from
     * @returns {Promise<void>}
     */
    async clearTriggersFromDocument(document) {
        if (!document) return;
        await document.unsetFlag('wodsystem', 'triggers');
    }
    
    /**
     * Clear all triggers from the current scene
     * @returns {Promise<number>} Number of documents cleared
     */
    async clearAllSceneTriggers() {
        if (!canvas?.scene) return 0;
        
        let clearedCount = 0;
        
        // Clear tile triggers
        for (const tile of canvas.scene.tiles) {
            if (tile.getFlag('wodsystem', 'triggers')) {
                await tile.unsetFlag('wodsystem', 'triggers');
                clearedCount++;
            }
        }
        
        // Clear region triggers
        if (canvas.scene.regions) {
            for (const region of canvas.scene.regions) {
                if (region.getFlag('wodsystem', 'triggers')) {
                    await region.unsetFlag('wodsystem', 'triggers');
                    clearedCount++;
                }
            }
        }
        
        // Clear wall triggers
        for (const wall of canvas.scene.walls) {
            if (wall.getFlag('wodsystem', 'triggers')) {
                await wall.unsetFlag('wodsystem', 'triggers');
                clearedCount++;
            }
        }
        
        // Clear scene-level triggers
        if (canvas.scene.getFlag('wodsystem', 'sceneTriggers')) {
            await canvas.scene.unsetFlag('wodsystem', 'sceneTriggers');
            clearedCount++;
        }
        
        // Clear old global triggers flag
        if (canvas.scene.getFlag('wodsystem', 'globalTriggers')) {
            await canvas.scene.unsetFlag('wodsystem', 'globalTriggers');
            clearedCount++;
        }
        
        if (clearedCount > 0) {
            ui.notifications?.info(`Cleared triggers from ${clearedCount} documents`);
        }
        
        return clearedCount;
    }
    
    /**
     * Check if a trigger uses the v2 schema
     * @param {Object} trigger - The trigger to check
     * @returns {boolean} True if v2 schema
     */
    isV2Schema(trigger) {
        return trigger.version === 2 || trigger.anchor?.documentType;
    }
    
    /**
     * Check if a trigger is in legacy (v1) format
     * @param {Object} trigger - The trigger to check
     * @returns {boolean} True if legacy format
     */
    isLegacyFormat(trigger) {
        return !this.isV2Schema(trigger);
    }
}
