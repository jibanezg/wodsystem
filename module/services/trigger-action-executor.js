/**
 * TriggerActionExecutor - Centralized action execution for the trigger system
 * Handles all action types with target resolution and proper error handling
 * 
 * V2 Architecture:
 * - Supports target selection modes: self, triggering, specific, all
 * - Handles action delays and chaining
 * - Provides extensible action type registry
 */

export class TriggerActionExecutor {
    static _instance = null;
    
    constructor() {
        // Default to false during early initialization, will be updated later if needed
        this._debugMode = false;
        this._actionHandlers = new Map();
        this._registerDefaultHandlers();
    }
    
    /**
     * Get or create the singleton instance
     * @returns {TriggerActionExecutor}
     */
    static getInstance() {
        if (!TriggerActionExecutor._instance) {
            TriggerActionExecutor._instance = new TriggerActionExecutor();
        }
        return TriggerActionExecutor._instance;
    }
    
    /**
     * Register default action handlers
     * @private
     */
    _registerDefaultHandlers() {
        // Door action
        this.registerActionHandler('door', this._executeDoorAction.bind(this));
        
        // Effect actions
        this.registerActionHandler('enableCoreEffect', this._executeEffectAction.bind(this));
        this.registerActionHandler('disableCoreEffect', this._executeEffectAction.bind(this));
        this.registerActionHandler('toggleCoreEffect', this._executeEffectAction.bind(this));
        
        // Tile actions
        this.registerActionHandler('changeTileAsset', this._executeTileAssetAction.bind(this));
        
        // Chat/notification actions
        this.registerActionHandler('chatMessage', this._executeChatMessageAction.bind(this));
        this.registerActionHandler('notification', this._executeNotificationAction.bind(this));
        
        // Macro action
        this.registerActionHandler('macro', this._executeMacroAction.bind(this));
        
        // Region behavior actions
        this.registerActionHandler('enableRegionBehavior', this._executeRegionBehaviorAction.bind(this));
        this.registerActionHandler('disableRegionBehavior', this._executeRegionBehaviorAction.bind(this));
        this.registerActionHandler('toggleRegionBehavior', this._executeRegionBehaviorAction.bind(this));
    }
    
    /**
     * Set debug mode
     * @param {boolean} enabled - Whether debug mode should be enabled
     */
    setDebugMode(enabled) {
        this._debugMode = enabled;
    }
    
    /**
     * Register a custom action handler
     * @param {string} actionType - The action type identifier
     * @param {Function} handler - The handler function (action, context) => Promise<void>
     */
    registerActionHandler(actionType, handler) {
        this._actionHandlers.set(actionType, handler);
    }
    
    /**
     * Execute an action with target resolution
     * @param {Object} action - The action object
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     * @returns {Promise<boolean>} Success status
     */
    async executeAction(action, trigger, context) {
        if (!action || !action.type) {
            console.warn('WoD ActionExecutor | Invalid action:', action);
            return false;
        }
        
        try {
            // Handle action delay
            const actionDelay = action.delay || 0;
            if (actionDelay > 0) {
                if (this._debugMode) {
                    console.log(`WoD ActionExecutor | Delaying action "${action.type}" by ${actionDelay}s`);
                }
                await new Promise(resolve => setTimeout(resolve, actionDelay * 1000));
            }
            
            // Resolve target(s) - may return single target or array
            const targets = await this._resolveTarget(action, trigger, context);
            
            // Get handler
            const handler = this._actionHandlers.get(action.type);
            if (!handler) {
                console.warn(`WoD ActionExecutor | No handler for action type: ${action.type}`);
                return false;
            }
            
            // Handle multi-target execution
            if (Array.isArray(targets)) {
                if (this._debugMode) {
                    console.log(`WoD ActionExecutor | Executing action "${action.type}" on ${targets.length} targets`);
                }
                
                let allSuccess = true;
                for (const target of targets) {
                    try {
                        await handler(action, { ...context, resolvedTarget: target });
                    } catch (err) {
                        console.warn(`WoD ActionExecutor | Failed to execute on target ${target?.id}:`, err);
                        allSuccess = false;
                    }
                }
                return allSuccess;
            }
            
            // Single target execution
            if (this._debugMode) {
                console.log(`WoD ActionExecutor | Executing action "${action.type}"`, {
                    target: targets?.id || 'none',
                    action: action
                });
            }
            
            await handler(action, { ...context, resolvedTarget: targets });
            return true;
            
        } catch (error) {
            console.error(`WoD ActionExecutor | Error executing action "${action.type}":`, error);
            return false;
        }
    }
    
    /**
     * Execute multiple actions in sequence
     * @param {Array} actions - Array of action objects
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     * @returns {Promise<Object>} Results summary
     */
    async executeActions(actions, trigger, context) {
        if (!Array.isArray(actions) || actions.length === 0) {
            return { executed: 0, succeeded: 0, failed: 0 };
        }
        
        const results = { executed: 0, succeeded: 0, failed: 0 };
        
        for (const action of actions) {
            results.executed++;
            const success = await this.executeAction(action, trigger, context);
            if (success) {
                results.succeeded++;
            } else {
                results.failed++;
            }
        }
        
        if (this._debugMode) {
            console.log(`WoD ActionExecutor | Execution complete:`, results);
        }
        
        return results;
    }
    
    /**
     * Resolve the target for an action based on target mode
     * @param {Object} action - The action object
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     * @returns {Document|Document[]|null} The resolved target document(s)
     * @private
     */
    async _resolveTarget(action, trigger, context) {
        const targetConfig = action.target;
        
        // Handle legacy string targets (backward compatibility)
        if (typeof targetConfig === 'string') {
            return this._resolveLegacyTarget(targetConfig, action, context);
        }
        
        // Handle missing target config
        if (!targetConfig) {
            return context.document;
        }
        
        const mode = targetConfig.mode || 'triggering';
        // For specific action types, auto-resolve elementType
        let elementType = targetConfig.elementType;
        if (action.type === 'door') {
            elementType = 'wall'; // Door actions always target walls (doors)
        } else {
            elementType = elementType || 'actor'; // Default for other actions
        }
        const elementId = targetConfig.elementId || '';
        
        switch (mode) {
            case 'self':
            case 'source':
                // Target is the document the trigger is anchored to (the source)
                return context.document;
                
            case 'triggering':
                // Target is the triggering token/actor
                return context.token || context.actor || null;
                
            case 'specific':
                // Target is a specific document by type and ID
                return this._resolveSpecificTarget(elementType, elementId);
                
            case 'all':
                // Return array of all matching elements in scene
                return this._resolveAllTargets(elementType, context);
                
            default:
                return context.document;
        }
    }
    
    /**
     * Handle legacy string-based target (e.g., wall ID for door actions)
     * @param {string} targetString - The legacy target string
     * @param {Object} action - The action object
     * @param {Object} context - The execution context
     * @returns {Document|null} The resolved document
     * @private
     */
    _resolveLegacyTarget(targetString, action, context) {
        // For door actions, legacy target is a wall ID
        if (action.type === 'door') {
            return canvas.scene?.walls?.get(targetString) || null;
        }
        // For tile actions, legacy target is a tile ID
        if (action.type === 'changeTileAsset') {
            return canvas.scene?.tiles?.get(targetString) || null;
        }
        // Default: try to find in context
        return context.document;
    }
    
    /**
     * Resolve a specific target by element type and ID
     * @param {string} elementType - The element type (wall, tile, actor, token)
     * @param {string} elementId - The element ID
     * @returns {Document|null} The resolved document
     * @private
     */
    _resolveSpecificTarget(elementType, elementId) {
        if (!elementId) return null;
        
        try {
            switch (elementType) {
                case 'wall':
                    return canvas.scene?.walls?.get(elementId) || null;
                case 'tile':
                    return canvas.scene?.tiles?.get(elementId) || null;
                case 'token':
                    return canvas.scene?.tokens?.get(elementId) || null;
                case 'region':
                    return canvas.scene?.regions?.get(elementId) || null;
                case 'actor':
                    return game.actors?.get(elementId) || null;
                case 'scene':
                    return game.scenes?.get(elementId) || null;
                default:
                    return null;
            }
        } catch (error) {
            console.warn(`WoD ActionExecutor | Failed to resolve specific target:`, error);
            return null;
        }
    }
    
    /**
     * Resolve all targets of a given type in the current scene
     * @param {string} elementType - The element type (wall, tile, actor, token)
     * @param {Object} context - The execution context
     * @returns {Document[]} Array of matching documents
     * @private
     */
    _resolveAllTargets(elementType, context) {
        try {
            switch (elementType) {
                case 'wall':
                    // Only return doors (walls with door type)
                    return Array.from(canvas.scene?.walls?.values() || [])
                        .filter(w => w.door > 0);
                case 'tile':
                    return Array.from(canvas.scene?.tiles?.values() || []);
                case 'token':
                    return Array.from(canvas.scene?.tokens?.values() || []);
                case 'region':
                    return Array.from(canvas.scene?.regions?.values() || []);
                case 'actor':
                    // Return all actors (global, not scene-specific)
                    return Array.from(game.actors?.values() || []);
                case 'scene':
                    return canvas.scene ? [canvas.scene] : [];
                default:
                    return [];
            }
        } catch (error) {
            console.warn(`WoD ActionExecutor | Failed to resolve all targets:`, error);
            return [];
        }
    }
    
    // ==================== Action Handlers ====================
    
    /**
     * Execute a door state change action
     * Uses resolvedTarget from context (set by _resolveTarget)
     * @private
     */
    async _executeDoorAction(action, context) {
        const state = action.state || action.parameters?.state || 'open';
        
        // Use resolvedTarget as primary source (set by _resolveTarget)
        let wall = context.resolvedTarget;
        
        // Validate that resolvedTarget is a wall
        if (!wall || wall.documentName !== 'Wall') {
            // Fallback: try legacy string target format
            const legacyWallId = typeof action.target === 'string' ? action.target : null;
            if (legacyWallId) {
                wall = canvas.scene?.walls?.get(legacyWallId);
            }
        }
        
        if (!wall) {
            console.warn('WoD ActionExecutor | Door action: No valid wall target');
            return;
        }
        
        // Verify target is actually a door
        if (!wall.door || wall.door === 0) {
            console.warn('WoD ActionExecutor | Door action: Target wall is not a door');
            return;
        }
        
        // Map state string to CONST
        let doorState;
        switch (state) {
            case 'open':
                doorState = CONST.WALL_DOOR_STATES.OPEN;
                break;
            case 'closed':
                doorState = CONST.WALL_DOOR_STATES.CLOSED;
                break;
            case 'locked':
                doorState = CONST.WALL_DOOR_STATES.LOCKED;
                break;
            default:
                doorState = CONST.WALL_DOOR_STATES.OPEN;
        }
        
        await wall.update({ ds: doorState });
        
        if (this._debugMode) {
            console.log(`WoD ActionExecutor | Door "${wall.id}" set to state: ${state}`);
        }
    }
    
    /**
     * Get door state name for debugging
     * @private
     */
    _getDoorStateName(state) {
        switch (state) {
            case CONST.WALL_DOOR_STATES.OPEN: return 'OPEN';
            case CONST.WALL_DOOR_STATES.CLOSED: return 'CLOSED';
            case CONST.WALL_DOOR_STATES.LOCKED: return 'LOCKED';
            default: return 'UNKNOWN';
        }
    }
    
    /**
     * Execute an effect toggle action
     * Uses resolvedTarget from context - handles Actor, Token, TokenDocument, or any document
     * Routes through StatusEffectManager for universal document support
     * @private
     */
    async _executeEffectAction(action, context) {
        const target = context.resolvedTarget;
        
        // Get effect name from action - support both effectId and effectName
        const effectName = action.effectId || action.effectName || action.parameters?.effectName;
        if (!effectName) {
            console.warn('WoD ActionExecutor | Effect action: No effect name specified');
            return;
        }
        
        // Try StatusEffectManager first (universal document support)
        const statusEffectManager = game.wod?.statusEffectManager;
        if (statusEffectManager) {
            // Resolve the target document
            let doc = null;
            if (target) {
                const docName = target.documentName || target.constructor?.documentName;
                if (docName === 'Actor') {
                    doc = target;
                } else if (docName === 'Token' || target.actor) {
                    doc = target.actor;
                } else {
                    // Non-actor document (Wall, Tile, Region, Scene)
                    doc = target;
                }
            }
            if (!doc) doc = context.actor || context.document;
            
            if (!doc) {
                console.warn('WoD ActionExecutor | Effect action: No valid target document');
                return;
            }
            
            // Find template by name or ID
            let templateId = effectName;
            const template = statusEffectManager.getEffectTemplate(effectName);
            if (!template) {
                // Try finding by name
                const byName = statusEffectManager.getAllEffectTemplates().find(
                    e => e.name.toLowerCase() === effectName.toLowerCase()
                );
                if (byName) templateId = byName.id;
            }
            
            switch (action.type) {
                case 'enableCoreEffect':
                    await statusEffectManager.applyEffectToDocument(templateId, doc);
                    break;
                case 'disableCoreEffect':
                    await statusEffectManager.removeEffectFromDocument(templateId, doc);
                    break;
                case 'toggleCoreEffect':
                    await statusEffectManager.toggleEffect(templateId, doc);
                    break;
            }
            
            if (this._debugMode) {
                const docLabel = doc.name || doc.id;
                console.log(`WoD ActionExecutor | Effect "${effectName}" ${action.type} on "${docLabel}"`);
            }
            return;
        }
        
        // Fallback: CoreEffectsManager (actor-only, legacy)
        let actor = null;
        if (target) {
            if (target.documentName === 'Actor') actor = target;
            else if (target.documentName === 'Token' || target.actor) actor = target.actor;
        }
        if (!actor) actor = context.actor;
        
        if (!actor) {
            console.warn('WoD ActionExecutor | Effect action: No valid actor target');
            return;
        }
        
        const coreEffectsManager = game.wod?.coreEffectsManager;
        if (!coreEffectsManager) {
            console.warn('WoD ActionExecutor | CoreEffectsManager not available');
            return;
        }
        
        switch (action.type) {
            case 'enableCoreEffect':
                await coreEffectsManager.applyEffect(actor, effectName);
                break;
            case 'disableCoreEffect':
                await coreEffectsManager.removeEffect(actor, effectName);
                break;
            case 'toggleCoreEffect':
                await coreEffectsManager.toggleEffect(actor, effectName);
                break;
        }
        
        if (this._debugMode) {
            console.log(`WoD ActionExecutor | Effect "${effectName}" ${action.type} on actor "${actor.name}"`);
        }
    }
    
    /**
     * Execute a tile asset change action
     * Uses resolvedTarget from context (set by _resolveTarget)
     * @private
     */
    async _executeTileAssetAction(action, context) {
        let tile = null;
        
        // Check useCurrentTile flag first (overrides target resolution)
        if (action.useCurrentTile) {
            if (context.triggerHost?.documentName === 'Tile') {
                tile = context.triggerHost;
            } else if (context.document?.documentName === 'Tile') {
                tile = context.document;
            }
        }
        // Use resolvedTarget as primary source
        else if (context.resolvedTarget?.documentName === 'Tile') {
            tile = context.resolvedTarget;
        }
        // Fallback to triggerHost if it's a tile (cross-document triggers)
        else if (context.triggerHost?.documentName === 'Tile') {
            tile = context.triggerHost;
        }
        // Fallback to context document if it's a tile
        else if (context.document?.documentName === 'Tile') {
            tile = context.document;
        }
        
        if (!tile) {
            console.warn('WoD ActionExecutor | Tile asset action: No valid tile target');
            return;
        }
        
        const newImg = action.tileImg || action.parameters?.tileImg;
        if (!newImg) {
            console.warn('WoD ActionExecutor | Tile asset action: No image path specified');
            return;
        }
        
        await tile.update({ 'texture.src': newImg });
        
        if (this._debugMode) {
            console.log(`WoD ActionExecutor | Tile "${tile.id}" asset changed to: ${newImg}`);
        }
    }
    
    /**
     * Execute a chat message action
     * @private
     */
    async _executeChatMessageAction(action, context) {
        const content = action.content || action.parameters?.content || '';
        const whisperTo = action.whisperTo || action.parameters?.whisperTo;
        
        const messageData = {
            content: content,
            speaker: ChatMessage.getSpeaker({ actor: context.actor })
        };
        
        if (whisperTo) {
            if (whisperTo === 'gm') {
                messageData.whisper = game.users.filter(u => u.isGM).map(u => u.id);
            } else if (whisperTo === 'self') {
                messageData.whisper = [game.user.id];
            }
        }
        
        await ChatMessage.create(messageData);
        
        if (this._debugMode) {
            console.log(`WoD ActionExecutor | Chat message sent`);
        }
    }
    
    /**
     * Execute a notification action
     * @private
     */
    async _executeNotificationAction(action, context) {
        const message = action.message || action.parameters?.message || '';
        const type = action.notificationType || action.parameters?.notificationType || 'info';
        
        ui.notifications[type]?.(message);
        
        if (this._debugMode) {
            console.log(`WoD ActionExecutor | Notification (${type}): ${message}`);
        }
    }
    
    /**
     * Execute a region behavior enable/disable/toggle action.
     * Supports target modes: source (trigger host), specific region, all regions.
     * @private
     */
    async _executeRegionBehaviorAction(action, context) {
        const behaviorId = action.behaviorId;
        if (!behaviorId) {
            console.warn('WoD ActionExecutor | Region behavior action: No behavior ID specified');
            return;
        }
        
        // Collect target regions based on target mode
        const targetMode = action.target?.mode || 'source';
        let regions = [];
        
        if (targetMode === 'all') {
            // All regions in the scene
            if (canvas.scene?.regions) {
                regions = Array.from(canvas.scene.regions);
            }
        } else if (targetMode === 'specific') {
            // Specific region by ID
            const regionId = action.target?.elementId;
            if (regionId) {
                const region = canvas.scene?.regions?.get(regionId);
                if (region) regions.push(region);
            }
        } else {
            // Source — the trigger host region
            const resolved = context.resolvedTarget;
            if (resolved?.documentName === 'Region') {
                regions.push(resolved);
            } else if (context.triggerHost?.documentName === 'Region') {
                regions.push(context.triggerHost);
            } else if (context.document?.documentName === 'Region') {
                regions.push(context.document);
            }
        }
        
        if (regions.length === 0) {
            console.warn('WoD ActionExecutor | Region behavior action: No valid region(s) found');
            return;
        }
        
        for (const region of regions) {
            const behavior = region.behaviors?.get(behaviorId);
            if (!behavior) {
                if (this._debugMode) {
                    console.log(`WoD ActionExecutor | Behavior "${behaviorId}" not found on region "${region.name || region.id}", skipping`);
                }
                continue;
            }
            
            let newDisabled;
            switch (action.type) {
                case 'enableRegionBehavior':
                    newDisabled = false;
                    break;
                case 'disableRegionBehavior':
                    newDisabled = true;
                    break;
                case 'toggleRegionBehavior':
                    newDisabled = !behavior.disabled;
                    break;
                default:
                    continue;
            }
            
            await behavior.update({ disabled: newDisabled });
            
            if (this._debugMode) {
                console.log(`WoD ActionExecutor | Region behavior "${behavior.name}" on region "${region.name || region.id}" set to ${newDisabled ? 'disabled' : 'enabled'}`);
            }
        }
    }
    
    /**
     * Execute a macro action
     * @private
     */
    async _executeMacroAction(action, context) {
        const macroId = action.macroId || action.parameters?.macroId;
        const macroName = action.macroName || action.parameters?.macroName;
        
        let macro;
        if (macroId) {
            macro = game.macros.get(macroId);
        } else if (macroName) {
            macro = game.macros.getName(macroName);
        }
        
        if (!macro) {
            console.warn('WoD ActionExecutor | Macro action: Macro not found');
            return;
        }
        
        // Pass context to macro via global
        const oldContext = globalThis.wodTriggerContext;
        globalThis.wodTriggerContext = context;
        
        try {
            await macro.execute();
        } finally {
            globalThis.wodTriggerContext = oldContext;
        }
        
        if (this._debugMode) {
            console.log(`WoD ActionExecutor | Macro "${macro.name}" executed`);
        }
    }
}
