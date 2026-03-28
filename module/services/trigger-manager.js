import { TriggerAPI } from './trigger-api.js';
import { TriggerEventRegistry } from './trigger-event-registry.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import { TriggerActionExecutor } from './trigger-action-executor.js';

/**
 * TriggerManager v2 - Core trigger event detection and execution
 * 
 * Architecture:
 * - Detects events from multiple document types (tile, region, wall, actor, scene)
 * - Routes events to appropriate triggers based on document type
 * - Evaluates conditions and executes actions
 * - Supports proximity detection as a modifier
 */
export class TriggerManager {
    constructor() {
        console.log('[TRIGGER] TriggerManager constructor starting...');
        try {
            // Token state tracking for movement detection
            this._tokenState = new Map(); // tokenUuid -> {x,y,width,height, sceneId, tiles:Set, regions:Set}
            this._movementMonitors = new Map(); // tokenUuid -> animationFrame
            
            // Rate limiting
            this._processingQueue = new Set();
            this._lastProcessTime = new Map();
            this._PROCESS_COOLDOWN = 50;
            
            // Active timing intervals
            this._activeIntervals = new Map();
            
            // Execution tracking for one-shot triggers: Map<"triggerId:actorId", count>
            this._executionCounts = new Map();

            // Snapshot of token state captured in preUpdateToken (before position is committed).
            // Used by updateToken / _onTokenMovement to get accurate before/after region diff.
            this._preMoveSnapshot = new Map();

            // Set of trigger IDs currently being reset.
            // setFlag on a Region doc causes Foundry to re-fire tokenEnterRegion for tokens
            // already inside the region. We suppress execution counting during that window
            // so the just-cleared count is not immediately consumed.
            this._resettingTriggers = new Set();

            // Deduplication for region enter/exit events.
            // When _onTokenMovement fires a region event, we record it here so that the
            // tokenEnterRegion / tokenExitRegion hooks (which may also fire in environments
            // without the Levels module) don't double-fire the same trigger.
            this._recentRegionTransitions = new Map(); // `enter/exit:regionId:tokenId` → timestamp

            // Debug mode - default to false during early initialization
            this._debugMode = false;
            
            // Initialize services
            this._triggerAPI = TriggerAPI.getInstance();
            this._registry = TriggerEventRegistry.getInstance();
            this._conditionEvaluator = new ConditionEvaluator();
            this._conditionEvaluator.setDebugMode(this._debugMode);
            this._actionExecutor = TriggerActionExecutor.getInstance();
            
            this.initialize();
            console.log('[TRIGGER] TriggerManager initialized successfully');
        } catch (error) {
            console.error('[TRIGGER] TriggerManager initialization failed:', error);
        }
    }

    initialize() {
        this._conditionEvaluator.setDebugMode(this._debugMode);
        this._actionExecutor.setDebugMode(this._debugMode);
        
        // ==================== Effect Events (direct to _fireEvent) ====================
        Hooks.on('createActiveEffect', (effect, options, userId) => {
            try {
                const actor = effect.parent;
                if (actor?.documentName === 'Actor') {
                    this._fireEvent('onEffectApplied', actor, {
                        actor,
                        effectId: effect.id,
                        effect,
                        effectName: effect.name
                    });
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error in createActiveEffect:', error);
            }
        });
        
        Hooks.on('deleteActiveEffect', (effect, options, userId) => {
            try {
                const actor = effect.parent;
                if (actor?.documentName === 'Actor') {
                    this._fireEvent('onEffectRemoved', actor, {
                        actor,
                        effectId: effect.id,
                        effect,
                        effectName: effect.name
                    });
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error in deleteActiveEffect:', error);
            }
        });

        // ==================== Actor Attribute Events ====================
        Hooks.on('updateActor', (actor, changes, options, userId) => {
            try {
                if (changes.system !== undefined) {
                    this._fireEvent('onAttributeChanged', actor, {
                        actor,
                        attributes: changes.system
                    });
                    if (changes.system.health !== undefined) {
                        this._fireEvent('onHealthChanged', actor, {
                            actor,
                            health: changes.system.health
                        });
                    }
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error in updateActor:', error);
            }
        });

        // ==================== Wall/Door Events ====================
        Hooks.on('updateWall', (wall, changes, options, userId) => {
            try {
                if (changes.ds !== undefined) {
                    const eventType = this._getDoorEventType(changes.ds);
                    if (eventType) {
                        this._fireEvent(eventType, wall, {
                            wall,
                            newState: changes.ds
                        });
                        // Also fire scene-level door events
                        const sceneEvent = this._getSceneDoorEventType(eventType);
                        if (sceneEvent) {
                            this._processSceneTriggers(sceneEvent, {
                                wall,
                                newState: changes.ds
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error in updateWall:', error);
            }
        });

        // ==================== Ambient Light Events ====================
        Hooks.on('updateAmbientLight', (lightDoc, changes, options, userId) => {
            try {
                if (!canvas.ready) return;
                if (changes.hidden === true) {
                    this._fireEvent('onLightDisabled', lightDoc, { light: lightDoc, changes });
                } else if (changes.hidden === false) {
                    this._fireEvent('onLightEnabled', lightDoc, { light: lightDoc, changes });
                } else if (Object.keys(changes).some(k => k !== '_id')) {
                    this._fireEvent('onLightChanged', lightDoc, { light: lightDoc, changes });
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error in updateAmbientLight:', error);
            }
        });

        // ==================== Combat Events ====================
        Hooks.on('combatStart', (combat) => {
            try {
                this._processSceneTriggers('onCombatStart', { combat, round: combat?.round, turn: combat?.turn });
            } catch (error) {
                console.error('WoD TriggerManager | Error in combatStart:', error);
            }
        });
        
        Hooks.on('deleteCombat', (combat) => {
            try {
                this._processSceneTriggers('onCombatEnd', { combat, round: combat?.round, turn: combat?.turn });
            } catch (error) {
                console.error('WoD TriggerManager | Error in deleteCombat:', error);
            }
        });
        
        Hooks.on('combatRound', (combat) => {
            try {
                this._processSceneTriggers('onRoundStart', { combat, round: combat?.round, turn: combat?.turn });
            } catch (error) {
                console.error('WoD TriggerManager | Error in combatRound:', error);
            }
        });

        // ==================== Region Entry/Exit Events (Foundry v12 native) ====================
        // These are far more reliable than manual bounds-based computation.
        Hooks.on('tokenEnterRegion', (arg0, arg1) => {
            console.log(`[TRIGGER] tokenEnterRegion FIRED — canvas.ready=${canvas.ready}`);
            try {
                if (!canvas.ready) {
                    console.log(`[TRIGGER] tokenEnterRegion blocked (canvas not ready)`);
                    return;
                }
                let tokenRaw = arg0, regionRaw = arg1;
                if (arg0?.documentName === 'Region' || arg0?.document?.documentName === 'Region') {
                    tokenRaw = arg1; regionRaw = arg0;
                }
                const tokenDoc = tokenRaw?.document ?? tokenRaw;
                const regionDoc = regionRaw?.document ?? regionRaw;
                if (!regionDoc) return;
                // Dedup: _onTokenMovement may have already fired this event via regions diff.
                const dedupKey = `enter:${regionDoc.id}:${tokenDoc?.id}`;
                const recent = this._recentRegionTransitions.get(dedupKey);
                if (recent && (Date.now() - recent) < 500) {
                    console.log(`[TRIGGER] tokenEnterRegion dedup — already fired by movement detection`);
                    return;
                }
                this._fireEvent('onEnter', regionDoc, {
                    token: tokenDoc,
                    actor: tokenDoc?.actor,
                    entered: true
                });
            } catch (error) {
                console.error('WoD TriggerManager | Error in tokenEnterRegion:', error);
            }
        });

        Hooks.on('tokenExitRegion', (arg0, arg1) => {
            try {
                if (!canvas.ready) return;
                let tokenRaw = arg0, regionRaw = arg1;
                if (arg0?.documentName === 'Region' || arg0?.document?.documentName === 'Region') {
                    tokenRaw = arg1; regionRaw = arg0;
                }
                const tokenDoc = tokenRaw?.document ?? tokenRaw;
                const regionDoc = regionRaw?.document ?? regionRaw;
                if (!regionDoc) return;
                // Dedup: _onTokenMovement may have already fired this event via regions diff.
                const dedupKey = `exit:${regionDoc.id}:${tokenDoc?.id}`;
                const recent = this._recentRegionTransitions.get(dedupKey);
                if (recent && (Date.now() - recent) < 500) {
                    console.log(`[TRIGGER] tokenExitRegion dedup — already fired by movement detection`);
                    return;
                }
                this._fireEvent('onExit', regionDoc, {
                    token: tokenDoc,
                    actor: tokenDoc?.actor,
                    exited: true
                });
            } catch (error) {
                console.error('WoD TriggerManager | Error in tokenExitRegion:', error);
            }
        });

        // ==================== Token Movement Events ====================
        // preUpdateToken fires BEFORE the position is committed to the document.
        // At this point tokenDoc.x/y and tokenDoc.regions still reflect the OLD state.
        // We snapshot it here so updateToken can compute an accurate before/after diff.
        Hooks.on('preUpdateToken', (tokenDoc, changes, options, userId) => {
            try {
                if (changes.x === undefined && changes.y === undefined) return;
                if (!canvas?.scene) return;
                // canvas.ready is false during Canvas#draw() (before canvasReady fires).
                // Modules like Roofs call tokenDoc.update(x,y) in this window before the
                // RegionLayer has populated tokenDoc.regions, so any snapshot taken here
                // would have empty regions and produce a false onEnter.
                // Skip the snapshot; updateToken will see no pair and do a silent update.
                if (!canvas.ready) return;
                const snap = this._computeTokenState(tokenDoc);
                console.log(`[WOD TRIGGER] preUpdateToken: "${tokenDoc.name}" moving to (${changes.x ?? tokenDoc.x}, ${changes.y ?? tokenDoc.y}) — regions in snapshot: [${Array.from(snap.regions).join(',')}]`);
                this._preMoveSnapshot.set(tokenDoc.uuid, snap);
            } catch (error) {
                console.error('WoD TriggerManager | Error in preUpdateToken:', error);
            }
        });

        Hooks.on('updateToken', (tokenDoc, changes, options, userId) => {
            try {
                if (changes.x !== undefined || changes.y !== undefined) {
                    this._onTokenMovement(tokenDoc, changes);
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error in updateToken:', error);
            }
        });

        // ==================== Canvas/Scene Events ====================
        Hooks.on('canvasReady', () => {
            try {
                console.log(`[TRIGGER] canvasReady fired — canvas.ready=${canvas.ready}`);
                this._primeInitialTokenState();
            }
            catch (error) { console.error('WoD TriggerManager | Error priming token state:', error); }
        });

        Hooks.on('ready', () => {
            try { this._primeInitialTokenState(); }
            catch (error) { console.error('WoD TriggerManager | Error on ready:', error); }
        });
        
    }

    _primeInitialTokenState() {
        if (!canvas?.scene) return;
        for (const tokenDoc of canvas.scene.tokens) {
            const state = this._computeTokenState(tokenDoc);
            this._tokenState.set(tokenDoc.uuid, state);
            console.log(`[TRIGGER] Token "${tokenDoc.name}" at (${tokenDoc.x},${tokenDoc.y}) is in regions: [${Array.from(state.regions).join(', ')}]`);
        }
    }

    // ==================== Universal Event Dispatcher ====================
    
    /**
     * Universal event dispatcher - SINGLE entry point for ALL trigger events.
     * Fires triggers on the source document, then on the scene.
     * @param {string} eventType - Event type (onEffectApplied, onDoorOpened, onEnter, etc.)
     * @param {Document} sourceDoc - The source document (actor, wall, tile, region, scene)
     * @param {Object} context - Event-specific context data
     */
    async _fireEvent(eventType, sourceDoc, context = {}) {
        if (!sourceDoc) return;
        
        const documentType = this._getDocumentType(sourceDoc);
        
        const fullContext = {
            eventType,
            document: sourceDoc,
            documentType,
            triggerHost: sourceDoc,
            ...context
        };
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | _fireEvent: ${eventType} on ${documentType} ${sourceDoc.id || sourceDoc.name || 'unknown'}`);
        }
        
        // 1. Process triggers on the source document itself
        await this._processTriggers(sourceDoc, eventType, fullContext);
        
        // 2. Process scene-level triggers
        await this._processSceneTriggers(eventType, fullContext);
        
        // 3. Scan tiles and regions for cross-document triggers
        //    (e.g. a tile trigger watching for a door event)
        //    Skip spatial events — those are already handled by _onTokenMovement
        const spatialEvents = ['onEnter', 'onExit', 'onProximity', 'onEffect'];
        if (!spatialEvents.includes(eventType) && canvas?.scene) {
            for (const tile of canvas.scene.tiles) {
                if (tile.id === sourceDoc.id) continue; // Already processed as source
                const tileContext = { ...fullContext, triggerHost: tile, hostDocumentType: 'tile' };
                await this._processTriggers(tile, eventType, tileContext);
            }
            if (canvas.scene.regions) {
                for (const region of canvas.scene.regions) {
                    if (region.id === sourceDoc.id) continue;
                    const regionContext = { ...fullContext, triggerHost: region, hostDocumentType: 'region' };
                    await this._processTriggers(region, eventType, regionContext);
                }
            }
        }
    }
    
    /**
     * Process all triggers on a single document for a given event.
     * This is the ONE unified trigger processing pipeline.
     * @param {Document} doc - The document with triggers
     * @param {string} eventType - The event type
     * @param {Object} context - The full execution context
     */
    async _processTriggers(doc, eventType, context) {
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        console.log(`[WOD TRIGGER] _processTriggers: doc="${doc?.name || doc?.id}" (${doc?.documentName}) event=${eventType} triggerCount=${triggers.length}`);
        if (!Array.isArray(triggers) || triggers.length === 0) return;

        for (const trigger of triggers) {
            if (!trigger || trigger.enabled === false) continue;

            // Step 1: Check event match
            const eventMatch = this._matchesEvent(trigger, eventType, context);
            console.log(`[WOD TRIGGER] Trigger "${trigger.name}" eventMatch=${eventMatch} (scopeType=${trigger.trigger?.scope?.type} execEvent=${trigger.trigger?.execution?.event})`);
            if (!eventMatch) continue;

            // Step 2: Check target filter
            const targetMatch = this._matchesTargetFilter(trigger, context);
            console.log(`[WOD TRIGGER] Trigger "${trigger.name}" targetMatch=${targetMatch} (filterType=${trigger.trigger?.targetFilter?.type} actor=${context.actor?.name})`);
            if (!targetMatch) continue;

            // Step 3: Evaluate conditions
            const conditions = trigger.trigger?.conditions || trigger.conditions || [];
            if (conditions.length > 0) {
                const result = this._conditionEvaluator.evaluateConditions(conditions, context);
                console.log(`[WOD TRIGGER] Trigger "${trigger.name}" conditionsPass=${result.passed}`);
                if (!result.passed) continue;
            }

            console.log(`[WOD TRIGGER] Trigger "${trigger.name}" executing...`);
            // Step 4: Execute
            await this._executeTrigger(trigger, context);
        }
    }
    
    /**
     * Check if a trigger matches the given event type.
     * Handles execution mode, scope type, and event field.
     * @param {Object} trigger - The trigger object
     * @param {string} eventType - The incoming event type
     * @param {Object} context - The execution context
     * @returns {boolean}
     */
    _matchesEvent(trigger, eventType, context) {
        const execution = trigger.trigger?.execution || {};
        const mode = execution.mode || 'event';
        const scopeType = trigger.trigger?.scope?.type;
        const hostDocType = context.hostDocumentType || context.documentType;
        
        // Scope-based matching ONLY applies when BOTH host is spatial AND the event is spatial.
        // Non-spatial events (door, combat, effect, attribute) on tile hosts use execution.event.
        const isSpatialHost = (hostDocType === 'tile' || hostDocType === 'region' || hostDocType === 'wall');
        const spatialEvents = ['onEnter', 'onExit', 'onProximity', 'onEffect'];
        const isSpatialEvent = spatialEvents.includes(eventType);
        
        // execution.event is a non-spatial override: if explicitly set to something outside
        // the standard spatial boundary events, always defer to execution.event matching.
        const execEvent = execution.event;
        const spatialBoundaryEvents = ['onEnter', 'onExit', 'onProximity', 'onEffect'];
        const hasNonSpatialExecEvent = execEvent && !spatialBoundaryEvents.includes(execEvent);

        if (mode === 'event') {
            if (isSpatialHost && isSpatialEvent && !hasNonSpatialExecEvent) {
                // Spatial triggers on spatial hosts: use scope boundary
                if (scopeType === 'tile' || scopeType === 'region') {
                    // If boundary not explicitly saved, infer from execEvent so a trigger
                    // configured with execEvent='onEnter' doesn't also fire on onExit.
                    const inferredBoundary = execEvent === 'onEnter' ? 'enter'
                        : execEvent === 'onExit' ? 'exit' : 'both';
                    const boundary = trigger.trigger?.scope?.[scopeType]?.boundary || inferredBoundary;
                    if (boundary === 'enter') return eventType === 'onEnter';
                    if (boundary === 'exit') return eventType === 'onExit';
                    if (boundary === 'both') return eventType === 'onEnter' || eventType === 'onExit';
                }
                if (scopeType === 'proximity') return eventType === 'onProximity';
                // Wall-scoped triggers with distance conditions act as implicit proximity
                if (scopeType === 'wall') {
                    const hasDistCond = (trigger.trigger?.conditions || []).some(c => c.type === 'distance');
                    if (hasDistCond && eventType === 'onProximity') return true;
                }
                if (eventType === 'onEffect') return true;
            }

            // All other cases: use execution.event
            if (scopeType === 'global') return eventType === 'onGlobal';
            const triggerEvent = execEvent || 'onEnter';
            return triggerEvent === eventType;
        }

        // State/continuous modes
        if (isSpatialHost && isSpatialEvent && !hasNonSpatialExecEvent) {
            if (scopeType === 'proximity') return eventType === 'onProximity';
            if (scopeType === 'tile' || scopeType === 'region') {
                const boundary = trigger.trigger?.scope?.[scopeType]?.boundary || 'both';
                if (boundary === 'enter') return eventType === 'onEnter';
                if (boundary === 'exit') return eventType === 'onExit';
                return eventType === 'onEnter' || eventType === 'onExit';
            }
        }
        if (scopeType === 'global') return true;
        
        // State/continuous without spatial scope: always matches
        return true;
    }
    
    /**
     * Check if trigger's target filter matches the context.
     * Extracted from the old _shouldTriggerFire for reuse.
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     * @returns {boolean}
     */
    _matchesTargetFilter(trigger, context) {
        const filterType = trigger.trigger?.targetFilter?.type || '';
        const matchMode = trigger.trigger?.targetFilter?.match || 'any';
        
        if (!filterType) return true; // No filter = match all
        
        // For non-actor document events (door, tile, region), skip actor-based TYPE filtering
        // but still check specific IDs — the user may want to filter by a specific door/wall ID.
        const nonActorEvents = ['onDoorOpened', 'onDoorClosed', 'onDoorLocked', 'onDoorUnlocked'];
        const docType = context.documentType;
        const isNonActorDocEvent = (docType === 'wall' || docType === 'tile' || docType === 'region') 
            && nonActorEvents.includes(context.eventType);
        
        if (!isNonActorDocEvent) {
            // "All must match" mode
            if (matchMode === 'all' && filterType) {
                return this._evaluateAllTargetsMatch(trigger, context);
            }
            
            const category = this._getFilterCategory(filterType);
            
            if (category === 'actor') {
                if (!context.actor?.type) return false;
                if (!this._checkTargetTypeMatch([filterType], context.actor.type, context)) return false;
            } else {
                if (!this._checkTargetTypeMatch([filterType], category, context)) return false;
            }
        }
        
        // Always check specific IDs filter (applies to door events too)
        const targetFilterIds = trigger.trigger?.targetFilter?.ids;
        if (targetFilterIds && typeof targetFilterIds === 'string' && targetFilterIds.trim().length > 0) {
            const allowedIds = targetFilterIds.split(',').map(id => id.trim()).filter(Boolean);
            if (allowedIds.length > 0) {
                // For door events, match against the wall/door ID from context
                const triggeringId = context.wall?.id || context.document?.id || context.token?.id || context.actor?.id || '';
                if (!allowedIds.includes(triggeringId)) {
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | Target filter ID mismatch: triggering="${triggeringId}" not in allowed=[${allowedIds.join(',')}]`);
                    }
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Execute a trigger with timing controls (delay, repeat, duration).
     * This is the ONE unified execution method.
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     */
    async _executeTrigger(trigger, context) {
        try {
            this._triggerAPI.notifyTriggerFired(trigger.id, { passed: true }, context);

            const execution = trigger.trigger?.execution || {};
            const timing = execution.timing || {};
            const delay = timing.delay || 0;
            const repeat = timing.repeat || 0;
            const duration = timing.duration || null;

            // Apply delay
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }

            // Execute actions
            await this._executeTriggerActionsUnified(trigger, context);

            // Handle repeat
            if (repeat > 0) {
                const startTime = Date.now();
                const mode = execution.mode || 'event';

                const repeatInterval = setInterval(async () => {
                    if (duration && (Date.now() - startTime) >= duration * 1000) {
                        clearInterval(repeatInterval);
                        this._activeIntervals.delete(trigger.id);
                        return;
                    }

                    // For continuous mode, re-evaluate conditions
                    if (mode === 'continuous') {
                        const conditions = trigger.trigger?.conditions || [];
                        if (conditions.length > 0) {
                            const result = this._conditionEvaluator.evaluateConditions(conditions, context);
                            if (!result.passed) return;
                        }
                    }

                    await this._executeTriggerActionsUnified(trigger, context);
                }, repeat * 1000);

                this._activeIntervals.set(trigger.id, repeatInterval);
            }
        } catch(err) {
            console.error(`[WOD TRIGGER] _executeTrigger ERROR for "${trigger.name}":`, err);
        }
    }
    
    /**
     * Execute trigger actions: handles roll + always/success/failure action groups.
     * Delegates to TriggerActionExecutor for actual action execution.
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     */
    async _executeTriggerActionsUnified(trigger, context) {
        // When resetTriggerExecutions clears the persistent flag via setFlag, Foundry v13
        // re-evaluates region memberships and fires tokenEnterRegion for any token already
        // inside the region. Since canvas.ready=true during gameplay, that spurious fire
        // would immediately re-consume the count we just reset.
        // The _resettingTriggers set is active for 500ms after setFlag so we can ignore it.
        if (this._resettingTriggers.has(trigger.id)) {
            console.log(`[TRIGGER COUNT] "${trigger.name}" suppressed (reset in progress)`);
            return;
        }

        let rollPassed = true;
        if (trigger.roll?.enabled) {
            // One-shot / max-executions check
            const maxExec = Number(trigger.roll.maxExecutions ?? 1);
            if (maxExec > 0) {
                const actorId = context.actor?.id || context.token?.actor?.id || 'unknown';
                const trackingKey = `${trigger.id}:${actorId}`;
                const persistence = trigger.roll.executionPersistence || 'persistent';
                const currentCount = await this._getExecutionCount(trackingKey, persistence, context);
                console.log(`[TRIGGER COUNT] "${trigger.name}" key=${trackingKey} count=${currentCount}/${maxExec} persistence=${persistence}`);
                if (currentCount >= maxExec) {
                    console.log(`[TRIGGER COUNT] "${trigger.name}" maxExecutions reached (${currentCount}/${maxExec}) — skipping`);
                    return; // Skip entire trigger execution
                }
                await this._incrementExecutionCount(trackingKey, persistence, context, currentCount);
            }

            const rollActor = this._resolveRollActor(trigger.roll, context);
            console.log(`[WOD TRIGGER] rollActor resolved: ${rollActor?.name || 'NULL'} (source=${trigger.roll.source || 'triggeringEntity'})`);
            if (rollActor) {
                rollPassed = await this._executeRoll(rollActor, trigger.roll);
            } else {
                console.warn(`[WOD TRIGGER] Roll skipped: no valid actor for source "${trigger.roll.source || 'triggeringEntity'}"`);
                rollPassed = false;
            }
        }
        
        const actions = trigger.actions || {};
        const actionsToExecute = [];
        
        if (actions.always?.length > 0) actionsToExecute.push(...actions.always);
        
        if (trigger.roll?.enabled) {
            if (rollPassed && actions.success?.length > 0) actionsToExecute.push(...actions.success);
            if (!rollPassed && actions.failure?.length > 0) actionsToExecute.push(...actions.failure);
        }
        
        if (actionsToExecute.length > 0) {
            await this._actionExecutor.executeActions(actionsToExecute, trigger, context);
        }
    }
    
    /**
     * Reset execution counts for a trigger, clearing both runtime cache and persistent flags.
     * @param {string} triggerId - The trigger ID to reset
     * @param {Document} doc - The host document that stores the persistent flags
     * @param {string|null} actorId - If provided, only reset for that actor. If null, reset for all actors.
     */
    async resetTriggerExecutions(triggerId, doc, actorId = null) {
        console.log(`[TRIGGER RESET] Starting reset: triggerId=${triggerId} docId=${doc?.id} actorId=${actorId || 'ALL'}`);
        
        // Set runtime Map entries to 0 (NOT delete).
        // After reset, the runtime Map is the authoritative source for this session.
        // Setting to 0 (rather than deleting) ensures _getExecutionCount returns 0
        // even if a canvas refresh restores a stale count=1 from the server flags.
        let clearedRuntime = [];
        if (actorId) {
            const key = `${triggerId}:${actorId}`;
            this._executionCounts.set(key, 0);
            clearedRuntime.push(key);
        } else {
            // Update any keys already in runtime Map
            for (const key of this._executionCounts.keys()) {
                if (key.startsWith(`${triggerId}:`)) {
                    this._executionCounts.set(key, 0);
                    clearedRuntime.push(key);
                }
            }
            // Also zero-out keys that exist in flags but not yet in runtime Map
            // (e.g. after a page reload, the runtime Map starts empty)
            if (doc) {
                const flagCounts = doc.getFlag('wodsystem', 'triggerExecutions') || {};
                for (const key of Object.keys(flagCounts)) {
                    if (key.startsWith(`${triggerId}:`) && !this._executionCounts.has(key)) {
                        this._executionCounts.set(key, 0);
                        clearedRuntime.push(key);
                    }
                }
            }
        }
        console.log(`[TRIGGER RESET] Runtime set to 0 for: [${clearedRuntime.join(', ')}]`);

        // Clear from persistent flags
        if (doc) {
            const counts = foundry.utils.duplicate(doc.getFlag('wodsystem', 'triggerExecutions') || {});
            console.log(`[TRIGGER RESET] Current flags before reset:`, Object.keys(counts));
            let clearedFlags = [];
            if (actorId) {
                const key = `${triggerId}:${actorId}`;
                if (key in counts) {
                    delete counts[key];
                    clearedFlags.push(key);
                }
            } else {
                for (const key of Object.keys(counts)) {
                    if (key.startsWith(`${triggerId}:`)) {
                        delete counts[key];
                        clearedFlags.push(key);
                    }
                }
            }

            // Suppress execution of this trigger for 500ms after setFlag.
            // setFlag causes Foundry v13 to re-evaluate region memberships and fires
            // tokenEnterRegion for any token currently inside — which would immediately
            // re-consume the count we just cleared. The suppression window prevents that.
            this._resettingTriggers.add(triggerId);
            await doc.setFlag('wodsystem', 'triggerExecutions', counts);
            setTimeout(() => {
                this._resettingTriggers.delete(triggerId);
                console.log(`[TRIGGER RESET] Suppression window ended for trigger ${triggerId}`);
            }, 500);

            console.log(`[TRIGGER RESET] Cleared from flags: [${clearedFlags.join(', ')}]`);
            console.log(`[TRIGGER RESET] Final flags after reset:`, Object.keys(counts));
        } else {
            console.log(`[TRIGGER RESET] WARNING: No document provided to clear persistent flags`);
        }

        console.log(`[TRIGGER RESET] Reset complete for trigger ${triggerId}`);
    }

    /**
     * Get execution count for a trigger+actor key.
     * @param {string} trackingKey - "triggerId:actorId"
     * @param {string} persistence - 'session' or 'persistent'
     * @param {Object} context - Execution context (has triggerHost document)
     * @returns {number}
     */
    async _getExecutionCount(trackingKey, persistence, context) {
        if (persistence === 'session') {
            const count = this._executionCounts.get(trackingKey) || 0;
            console.log(`[TRIGGER COUNT] read key=${trackingKey} count=${count} source=session-memory`);
            return count;
        }

        // Persistent: runtime Map is authoritative for the current session.
        // After a reset, the key is explicitly set to 0 in the runtime Map so it
        // overrides any stale flag value that a canvas refresh might restore from
        // the server (which re-emits the old document state after any setFlag call).
        // On a fresh page load the runtime Map is empty, so we fall through to flags.
        const memCount = this._executionCounts.get(trackingKey);
        if (memCount !== undefined) {
            console.log(`[TRIGGER COUNT] read key=${trackingKey} count=${memCount} source=session-memory`);
            return memCount;
        }

        // First access this session — load from flags
        const doc = context.triggerHost || context.document;
        if (!doc) {
            console.log(`[TRIGGER COUNT] read key=${trackingKey} count=0 source=no-doc`);
            return 0;
        }
        const counts = doc.getFlag('wodsystem', 'triggerExecutions') || {};
        const count = counts[trackingKey] || 0;
        console.log(`[TRIGGER COUNT] read key=${trackingKey} count=${count} source=flags docId=${doc.id}`);
        return count;
    }

    /**
     * Increment execution count for a trigger+actor key.
     * @param {string} trackingKey - "triggerId:actorId"
     * @param {string} persistence - 'session' or 'persistent'
     * @param {Object} context - Execution context (has triggerHost document)
     * @param {number} currentCount - Current count before increment
     */
    async _incrementExecutionCount(trackingKey, persistence, context, currentCount) {
        const newCount = currentCount + 1;
        this._executionCounts.set(trackingKey, newCount);

        if (persistence === 'persistent') {
            const doc = context.triggerHost || context.document;
            if (doc) {
                const counts = foundry.utils.duplicate(doc.getFlag('wodsystem', 'triggerExecutions') || {});
                counts[trackingKey] = newCount;
                await doc.setFlag('wodsystem', 'triggerExecutions', counts);
                console.log(`[TRIGGER COUNT] wrote key=${trackingKey} newCount=${newCount} to flags docId=${doc.id}`);
            }
        } else {
            console.log(`[TRIGGER COUNT] wrote key=${trackingKey} newCount=${newCount} to session-memory`);
        }
    }

    /**
     * Resolve which actor should make the roll based on roll.source configuration.
     * @param {Object} rollConfig - The roll configuration object
     * @param {Object} context - The execution context
     * @returns {Actor|null} The actor to roll, or null if none found
     */
    _resolveRollActor(rollConfig, context) {
        const source = rollConfig.source || 'triggeringEntity';
        
        switch (source) {
            case 'triggeringEntity':
                // The entity that caused the trigger (e.g. player entering a region)
                return context.actor || context.token?.actor || null;
                
            case 'triggerHost': {
                // The document the trigger is attached to
                const host = context.triggerHost || context.document;
                if (host?.documentName === 'Actor') return host;
                // If host is a token, get its actor
                if (host?.actor) return host.actor;
                // If host is not an actor (region, tile, etc.), fall back to triggering entity
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Roll source "triggerHost" is not an actor (${host?.documentName}), falling back to triggering entity`);
                }
                return context.actor || context.token?.actor || null;
            }
                
            case 'specificActor': {
                // A specific actor chosen by the GM
                const actorId = rollConfig.specificActorId;
                if (!actorId) {
                    console.warn('WoD TriggerManager | Roll source "specificActor" but no actor ID configured');
                    return null;
                }
                const actor = game.actors?.get(actorId);
                if (!actor) {
                    console.warn(`WoD TriggerManager | Specific roll actor "${actorId}" not found`);
                    return null;
                }
                return actor;
            }
                
            default:
                return context.actor || context.token?.actor || null;
        }
    }
    
    /**
     * Get document type string from a Foundry document instance.
     * @param {Document} doc
     * @returns {string}
     */
    _getDocumentType(doc) {
        if (!doc) return 'unknown';
        const name = doc.documentName || doc.constructor?.documentName;
        switch (name) {
            case 'Actor': return 'actor';
            case 'Token': return 'token';
            case 'Wall': return 'wall';
            case 'Tile': return 'tile';
            case 'Region': return 'region';
            case 'Scene': return 'scene';
            case 'AmbientLight': return 'light';
            default: return 'unknown';
        }
    }
    
    /**
     * Map a door state constant to the corresponding event type.
     * @param {number} newState - The new door state
     * @returns {string|null}
     */
    _getDoorEventType(newState) {
        switch (newState) {
            case CONST.WALL_DOOR_STATES.OPEN: return 'onDoorOpened';
            case CONST.WALL_DOOR_STATES.CLOSED: return 'onDoorClosed';
            case CONST.WALL_DOOR_STATES.LOCKED: return 'onDoorLocked';
            default: return null;
        }
    }
    
    /**
     * Map a door event to its scene-level equivalent.
     * @param {string} doorEvent
     * @returns {string|null}
     */
    _getSceneDoorEventType(doorEvent) {
        switch (doorEvent) {
            case 'onDoorOpened': return 'onAnyDoorOpened';
            case 'onDoorClosed': return 'onAnyDoorClosed';
            case 'onDoorLocked': return 'onAnyDoorLocked';
            case 'onDoorUnlocked': return 'onAnyDoorUnlocked';
            default: return null;
        }
    }

    // ==================== Token Movement Handler ====================
    
    /**
     * Handle token movement - fires onEnter, onExit, onProximity events
     * @param {TokenDocument} tokenDoc - The token document
     * @param {Object} changes - The changes object
     */
    _onTokenMovement(tokenDoc, changes) {
        if (!canvas?.scene) return;
        if (changes.x === undefined && changes.y === undefined) return;

        if (this._debugMode) {
            console.log(`WoD TriggerManager | Token movement: ${tokenDoc.name}`);
        }

        const tokenUuid = tokenDoc.uuid;

        // Retrieve and immediately clear the pre-move snapshot set by preUpdateToken.
        // If there is no snapshot, this updateToken fired without a paired preUpdateToken
        // (canvas init placement, module cosmetic update, etc.). Treat as a silent
        // baseline update — do NOT fire spatial events.
        const snapshot = this._preMoveSnapshot.get(tokenUuid);
        this._preMoveSnapshot.delete(tokenUuid);

        const nextState = this._computeTokenState(tokenDoc);
        this._tokenState.set(tokenUuid, nextState);

        if (!snapshot) return;

        const now = Date.now();
        const lastProcess = this._lastProcessTime.get(tokenUuid) || 0;
        if (now - lastProcess < this._PROCESS_COOLDOWN) return;
        this._lastProcessTime.set(tokenUuid, now);

        const actualPrevState = snapshot;

        // Check which tiles were crossed during movement (path-based detection)
        const crossedTiles = this._getCrossedTiles(actualPrevState.rect, nextState.rect);
        
        // Determine entry: tiles that were crossed but token wasn't on before
        const enteredTiles = this._setDiff(crossedTiles, actualPrevState.tiles);
        
        // Determine exit: tiles that token was on before but not on after (original onExit logic)
        const exitedTiles = this._setDiff(actualPrevState.tiles, nextState.tiles);
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | MOVEMENT: from (${actualPrevState.rect.x}, ${actualPrevState.rect.y}) to (${nextState.rect.x}, ${nextState.rect.y})`);
            console.log(`WoD TriggerManager | TILES: entered=[${Array.from(enteredTiles).join(', ')}] exited=[${Array.from(exitedTiles).join(', ')}]`);
        }

        for (const tileId of enteredTiles) {
            const tileDoc = canvas.scene.tiles.get(tileId);
            if (tileDoc) {
                this._fireEvent('onEnter', tileDoc, { token: tokenDoc, actor: tokenDoc?.actor, entered: true });
            }
        }

        for (const tileId of exitedTiles) {
            const tileDoc = canvas.scene.tiles.get(tileId);
            if (tileDoc) {
                this._fireEvent('onExit', tileDoc, { token: tokenDoc, actor: tokenDoc?.actor, exited: true });
            }
        }

        // Region entry/exit via tokenDoc.regions diff.
        // We no longer rely exclusively on the tokenEnterRegion / tokenExitRegion hooks because
        // the Levels module suppresses those hooks entirely. tokenDoc.regions is authoritative
        // and is always updated before updateToken fires, so diffing snapshot vs nextState is
        // reliable. The tokenEnterRegion handler still runs as a fallback (e.g. for token
        // creation) but deduplicates against events fired here.
        const enteredRegions = this._setDiff(nextState.regions, snapshot.regions);
        const exitedRegions = this._setDiff(snapshot.regions, nextState.regions);

        console.log(`[WOD TRIGGER] REGIONS: entered=[${Array.from(enteredRegions).join(', ')}] exited=[${Array.from(exitedRegions).join(', ')}] (snapshot=${Array.from(snapshot.regions)} → next=${Array.from(nextState.regions)})`);

        for (const regionId of enteredRegions) {
            const regionDoc = canvas.scene.regions?.get(regionId);
            if (regionDoc) {
                this._recentRegionTransitions.set(`enter:${regionId}:${tokenDoc.id}`, Date.now());
                this._fireEvent('onEnter', regionDoc, { token: tokenDoc, actor: tokenDoc?.actor, entered: true });
            }
        }
        for (const regionId of exitedRegions) {
            const regionDoc = canvas.scene.regions?.get(regionId);
            if (regionDoc) {
                this._recentRegionTransitions.set(`exit:${regionId}:${tokenDoc.id}`, Date.now());
                this._fireEvent('onExit', regionDoc, { token: tokenDoc, actor: tokenDoc?.actor, exited: true });
            }
        }

        // Check for effects on token and trigger onEffect for nearby tiles
        if (tokenDoc.actor && tokenDoc.actor.effects) {
            const effects = tokenDoc.actor.effects;
            if (effects.size > 0) {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Token has ${effects.size} effects, checking nearby tiles`);
                }
                
                // Get all tiles the token is currently on/near
                const currentTiles = this._computeTokenState(tokenDoc).tiles;
                
                for (const effect of effects) {
                    if (!effect) continue;
                    
                    for (const tileId of currentTiles) {
                        const tileDoc = canvas.scene.tiles.get(tileId);
                        if (tileDoc) {
                            if (this._debugMode) {
                                console.log(`WoD TriggerManager | Checking onEffect trigger for tile ${tileId} with effect ${effect.name}`);
                            }
                            this._fireEvent('onEffect', tileDoc, { token: tokenDoc, actor: tokenDoc?.actor, effect });
                        }
                    }
                }
            }
        }
        
        // Check proximity-based triggers
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Checking proximity triggers for token ${tokenDoc.name}`);
        }
        this._checkProximityTriggers(tokenDoc);

        // Update stored state so next movement computes correct enter/exit diffs
        this._tokenState.set(tokenUuid, nextState);
    }
    
    /**
     * Check all proximity-based triggers for the given token
     * @param {TokenDocument} tokenDoc - The token to check
     */
    _checkProximityTriggers(tokenDoc) {
        if (!canvas?.scene) return;
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | _checkProximityTriggers called for token ${tokenDoc.name}`);
        }
        
        const tokenRect = this._getTokenRect(tokenDoc);
        const tokenCenter = {
            x: tokenRect.x + tokenRect.width / 2,
            y: tokenRect.y + tokenRect.height / 2
        };
        
        // Check all tiles for proximity triggers
        let totalTilesChecked = 0;
        let tilesWithTriggers = 0;
        
        for (const tile of canvas.scene.tiles) {
            totalTilesChecked++;
            const triggers = tile.getFlag('wodsystem', 'triggers') || [];
            if (!Array.isArray(triggers) || triggers.length === 0) continue;
            
            tilesWithTriggers++;
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Found ${triggers.length} triggers on tile ${tile.id}`);
            }
            
            for (const trigger of triggers) {
                if (!trigger || trigger.enabled === false) continue;
                
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Checking trigger:`, {
                        id: trigger.id,
                        name: trigger.name,
                        enabled: trigger.enabled,
                        scopeType: trigger.trigger?.scope?.type,
                        executionMode: trigger.trigger?.execution?.mode,
                        conditions: trigger.trigger?.conditions
                    });
                }
                
                // Check if this is a proximity scope trigger
                const scopeType = trigger.trigger?.scope?.type;
                if (scopeType !== 'proximity') continue;
                
                const proximityConfig = trigger.trigger?.scope?.proximity || {};
                const distance = proximityConfig.distance || 5;
                const unit = proximityConfig.unit || 'grid';
                const shape = proximityConfig.shape || 'circle';
                
                // Check if token is within proximity and get actual distance
                const proximityResult = this._isTokenWithinProximity(
                    tokenCenter, tile, distance, unit, shape
                );
                const isWithinProximity = proximityResult.isWithin;
                const actualDistance = proximityResult.distance;
                
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Proximity check:`, {
                        tokenId: trigger.id,
                        triggerName: trigger.name,
                        tokenCenter,
                        tilePosition: { x: tile.x, y: tile.y },
                        distance,
                        unit,
                        shape,
                        actualDistance,
                        isWithinProximity
                    });
                }
                
                if (isWithinProximity) {
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | Token within proximity of tile ${tile.id} at distance ${actualDistance} ${unit}`);
                    }
                    
                    // Get execution mode to determine how to handle the trigger
                    const execution = trigger.trigger?.execution || {};
                    const executionMode = execution.mode || 'event';
                    
                    this._fireEvent('onProximity', tile, {
                        token: tokenDoc,
                        actor: tokenDoc?.actor,
                        distance: actualDistance,
                        distanceUnit: unit
                    });
                }
            }
        }
        
        // Check all walls (doors) for proximity triggers
        for (const wall of canvas.scene.walls) {
            if (wall.door === 0) continue; // Only check doors
            const triggers = wall.getFlag('wodsystem', 'triggers') || [];
            if (!Array.isArray(triggers) || triggers.length === 0) continue;
            
            for (const trigger of triggers) {
                if (!trigger || trigger.enabled === false) continue;
                
                const scopeType = trigger.trigger?.scope?.type;
                
                // Wall-scoped triggers with distance conditions are implicit proximity triggers
                const hasDistanceCondition = (trigger.trigger?.conditions || []).some(c => c.type === 'distance');
                const isProximityScope = scopeType === 'proximity';
                const isImplicitProximity = (scopeType === 'wall') && hasDistanceCondition;
                
                if (!isProximityScope && !isImplicitProximity) continue;
                
                // Use proximity config if explicit, otherwise use distance condition value as range
                let distance, unit;
                if (isProximityScope) {
                    const proximityConfig = trigger.trigger?.scope?.proximity || {};
                    distance = proximityConfig.distance || 5;
                    unit = proximityConfig.unit || 'grid';
                } else {
                    // Implicit proximity: use the distance condition value as the proximity range
                    const distCond = (trigger.trigger?.conditions || []).find(c => c.type === 'distance');
                    distance = parseFloat(distCond?.value) || 5;
                    unit = 'grid';
                }
                
                const proximityResult = this._isTokenWithinProximityOfWall(
                    tokenCenter, wall, distance, unit
                );
                
                if (proximityResult.isWithin) {
                    this._fireEvent('onProximity', wall, {
                        token: tokenDoc,
                        actor: tokenDoc?.actor,
                        distance: proximityResult.distance,
                        distanceUnit: unit
                    });
                }
            }
        }
        
        // Check all regions for proximity triggers
        if (canvas.scene.regions) {
            for (const region of canvas.scene.regions) {
                const triggers = region.getFlag('wodsystem', 'triggers') || [];
                if (!Array.isArray(triggers) || triggers.length === 0) continue;
                
                for (const trigger of triggers) {
                    if (!trigger || trigger.enabled === false) continue;
                    
                    const scopeType = trigger.trigger?.scope?.type;
                    if (scopeType !== 'proximity') continue;
                    
                    const proximityConfig = trigger.trigger?.scope?.proximity || {};
                    const distance = proximityConfig.distance || 5;
                    const unit = proximityConfig.unit || 'grid';
                    const shape = proximityConfig.shape || 'circle';
                    
                    // Check if token is within proximity and get actual distance
                    const proximityResult = this._isTokenWithinProximityOfRegion(
                        tokenCenter, region, distance, unit, shape
                    );
                    const isWithinProximity = proximityResult.isWithin;
                    const actualDistance = proximityResult.distance;
                    
                    if (isWithinProximity) {
                        if (this._debugMode) {
                            console.log(`WoD TriggerManager | Token within proximity of region ${region.id}`);
                        }
                        
                        // Get execution mode to determine how to handle the trigger
                        const execution = trigger.trigger?.execution || {};
                        const executionMode = execution.mode || 'event';
                        
                        this._fireEvent('onProximity', region, {
                            token: tokenDoc,
                            actor: tokenDoc?.actor,
                            distance: actualDistance,
                            distanceUnit: unit
                        });
                    }
                }
            }
        }
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Proximity check complete: ${totalTilesChecked} tiles checked, ${tilesWithTriggers} with triggers`);
        }
    }
    
    /**
     * Get token rectangle from token document
     * @private
     */
    _getTokenRect(tokenDoc) {
        const gridSize = canvas?.grid?.size || 100;
        const widthPx = (tokenDoc.width || 1) * gridSize;
        const heightPx = (tokenDoc.height || 1) * gridSize;
        
        return {
            x: tokenDoc.x ?? 0,
            y: tokenDoc.y ?? 0,
            width: widthPx,
            height: heightPx
        };
    }
    
    /**
     * Check if token center is within proximity of a tile
     * @private
     */
    _isTokenWithinProximity(tokenCenter, tile, distance, unit, shape) {
        const gridSize = canvas?.grid?.size || 100;
        const distancePx = unit === 'grid' ? distance * gridSize : distance;
        
        // Get tile bounds
        const tileRect = {
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: tile.height
        };
        
        // Expand tile bounds by proximity distance
        const expandedRect = {
            x: tileRect.x - distancePx,
            y: tileRect.y - distancePx,
            width: tileRect.width + distancePx * 2,
            height: tileRect.height + distancePx * 2
        };
        
        if (shape === 'square' || shape === 'rectangle') {
            // Simple rectangle check - calculate distance to rectangle
            const dx = Math.max(0, Math.max(tileRect.x - tokenCenter.x, tokenCenter.x - (tileRect.x + tileRect.width)));
            const dy = Math.max(0, Math.max(tileRect.y - tokenCenter.y, tokenCenter.y - (tileRect.y + tileRect.height)));
            const distanceToTile = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToTile <= distancePx,
                distance: unit === 'grid' ? distanceToTile / gridSize : distanceToTile
            };
        } else {
            // Circle check - distance from token center to nearest point on tile
            const tileCenter = {
                x: tileRect.x + tileRect.width / 2,
                y: tileRect.y + tileRect.height / 2
            };
            
            // Find nearest point on tile to token center
            const nearestX = Math.max(tileRect.x, Math.min(tokenCenter.x, tileRect.x + tileRect.width));
            const nearestY = Math.max(tileRect.y, Math.min(tokenCenter.y, tileRect.y + tileRect.height));
            
            // Calculate distance from token center to nearest point
            const dx = tokenCenter.x - nearestX;
            const dy = tokenCenter.y - nearestY;
            const distanceToTile = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToTile <= distancePx,
                distance: unit === 'grid' ? distanceToTile / gridSize : distanceToTile
            };
        }
    }
    
    /**
     * Check if token center is within proximity of a wall (door)
     * Calculates distance from point to line segment [x1,y1,x2,y2]
     * @private
     */
    _isTokenWithinProximityOfWall(tokenCenter, wall, distance, unit) {
        const gridSize = canvas?.grid?.size || 100;
        const distancePx = unit === 'grid' ? distance * gridSize : distance;
        
        const c = wall.c;
        if (!c || c.length < 4) return { isWithin: false, distance: Infinity };
        
        const [x1, y1, x2, y2] = c;
        
        // Calculate nearest point on the wall segment to the token center
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        
        let t = 0;
        if (lengthSq > 0) {
            t = Math.max(0, Math.min(1, ((tokenCenter.x - x1) * dx + (tokenCenter.y - y1) * dy) / lengthSq));
        }
        
        const nearestX = x1 + t * dx;
        const nearestY = y1 + t * dy;
        
        const distX = tokenCenter.x - nearestX;
        const distY = tokenCenter.y - nearestY;
        const distToWall = Math.sqrt(distX * distX + distY * distY);
        
        return {
            isWithin: distToWall <= distancePx,
            distance: unit === 'grid' ? distToWall / gridSize : distToWall
        };
    }
    
    /**
     * Check if token center is within proximity of a region
     * @private
     */
    _isTokenWithinProximityOfRegion(tokenCenter, region, distance, unit, shape) {
        const gridSize = canvas?.grid?.size || 100;
        const distancePx = unit === 'grid' ? distance * gridSize : distance;
        
        // Get region bounds
        const bounds = region.bounds || region.document?.bounds;
        if (!bounds) return false;
        
        const regionRect = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
        };
        
        // Expand region bounds by proximity distance
        const expandedRect = {
            x: regionRect.x - distancePx,
            y: regionRect.y - distancePx,
            width: regionRect.width + distancePx * 2,
            height: regionRect.height + distancePx * 2
        };
        
        if (shape === 'square' || shape === 'rectangle') {
            // Calculate distance to rectangle
            const dx = Math.max(0, Math.max(regionRect.x - tokenCenter.x, tokenCenter.x - (regionRect.x + regionRect.width)));
            const dy = Math.max(0, Math.max(regionRect.y - tokenCenter.y, tokenCenter.y - (regionRect.y + regionRect.height)));
            const distanceToRegion = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToRegion <= distancePx,
                distance: unit === 'grid' ? distanceToRegion / gridSize : distanceToRegion
            };
        } else {
            // Circle check
            const nearestX = Math.max(regionRect.x, Math.min(tokenCenter.x, regionRect.x + regionRect.width));
            const nearestY = Math.max(regionRect.y, Math.min(tokenCenter.y, regionRect.y + regionRect.height));
            
            const dx = tokenCenter.x - nearestX;
            const dy = tokenCenter.y - nearestY;
            const distanceToRegion = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToRegion <= distancePx,
                distance: unit === 'grid' ? distanceToRegion / gridSize : distanceToRegion
            };
        }
    }

    _computeTokenState(tokenDoc) {
        const gridSize = canvas?.grid?.size || 100;
        const widthPx = (tokenDoc.width || 1) * gridSize;
        const heightPx = (tokenDoc.height || 1) * gridSize;

        const tokenRect = {
            x: tokenDoc.x ?? 0,
            y: tokenDoc.y ?? 0,
            width: widthPx,
            height: heightPx
        };

        // Use Foundry's spatial indexing for tiles - much faster than iterating all tiles
        const tiles = new Set();
        const tokenElevation = tokenDoc.elevation ?? 0;
        
        // Get tiles in the token's vicinity using quadtree if available
        let nearbyTiles = [];
        if (canvas.scene.tiles.quadtree) {
            // Use quadtree for spatial lookup
            nearbyTiles = canvas.scene.tiles.quadtree.getObjects(tokenRect);
        } else {
            // Fallback to checking only tiles that could possibly intersect
            nearbyTiles = canvas.scene.tiles.filter(tile => {
                // Quick bounding box check before expensive intersection
                return (tile.x < tokenRect.x + tokenRect.width &&
                        tile.x + tile.width > tokenRect.x &&
                        tile.y < tokenRect.y + tokenRect.height &&
                        tile.y + tile.height > tokenRect.y);
            });
        }
        
        for (const tile of nearbyTiles) {
            const tileElevation = tile.elevation ?? 0;
            if (Math.abs(tokenElevation - tileElevation) < 1) {
                tiles.add(tile.id);
            }
        }

        // Use Foundry's own token.regions Set as the authoritative source for
        // region membership. This is reliable even when modules like Levels alter
        // elevation semantics and break RegionDocument#testPoint.
        const regions = new Set();
        if (tokenDoc.regions instanceof Set) {
            for (const r of tokenDoc.regions) {
                if (r?.id) regions.add(r.id);
            }
        }

        return {
            sceneId: canvas.scene.id,
            rect: tokenRect,
            tiles,
            regions
        };
    }

    _pointInRect(point, tileDoc) {
        const r = {
            x: tileDoc.x ?? 0,
            y: tileDoc.y ?? 0,
            width: tileDoc.width ?? 0,
            height: tileDoc.height ?? 0
        };

        return point.x >= r.x && point.x <= (r.x + r.width) && point.y >= r.y && point.y <= (r.y + r.height);
    }

    _pointInRegion(point, regionDoc) {
        // Best-effort across Foundry versions.
        const obj = regionDoc.object;

        if (obj?.contains) {
            try {
                return obj.contains(point.x, point.y);
            } catch (e) {
                // fallthrough
            }
        }

        if (obj?.shape?.contains) {
            try {
                return obj.shape.contains(point.x, point.y);
            } catch (e) {
                // fallthrough
            }
        }

        if (obj?.bounds?.contains) {
            return obj.bounds.contains(point.x, point.y);
        }

        // Fallback: rectangular region document data
        if (regionDoc.x !== undefined && regionDoc.y !== undefined && regionDoc.width !== undefined && regionDoc.height !== undefined) {
            return point.x >= regionDoc.x && point.x <= (regionDoc.x + regionDoc.width) && point.y >= regionDoc.y && point.y <= (regionDoc.y + regionDoc.height);
        }

        return false;
    }

    _rectIntersects(rect1, rect2) {
        return !(rect1.x + rect1.width <= rect2.x ||
                rect2.x + rect2.width <= rect1.x ||
                rect1.y + rect1.height <= rect2.y ||
                rect2.y + rect2.height <= rect1.y);
    }

    _rectIntersectsRegion(tokenRect, region) {
        // Try to get region bounds from different sources
        const bounds = region.bounds || region.document?.bounds;
        if (bounds) {
            return this._rectIntersects(tokenRect, bounds);
        }

        // Fallback: rectangular region document data
        if (region.x !== undefined && region.y !== undefined && region.width !== undefined && region.height !== undefined) {
            return this._rectIntersects(tokenRect, region);
        }

        // Last resort: use center point
        const center = {
            x: tokenRect.x + tokenRect.width / 2,
            y: tokenRect.y + tokenRect.height / 2
        };
        return this._pointInRegion(center, region);
    }

    _getTilesAlongPath(fromRect, toRect) {
        const pathTiles = new Set();
        const steps = 5; // Reduced from 10 to improve performance
        
        // Create expanded bounds to include the entire path
        const pathBounds = {
            x: Math.min(fromRect.x, toRect.x),
            y: Math.min(fromRect.y, toRect.y),
            width: Math.abs(toRect.x - fromRect.x) + fromRect.width,
            height: Math.abs(toRect.y - fromRect.y) + fromRect.height
        };
        
        // Get tiles that could possibly be in the path using spatial indexing
        let candidateTiles = [];
        if (canvas.scene.tiles.quadtree) {
            candidateTiles = canvas.scene.tiles.quadtree.getObjects(pathBounds);
        } else {
            candidateTiles = canvas.scene.tiles.filter(tile => {
                return (tile.x < pathBounds.x + pathBounds.width &&
                        tile.x + tile.width > pathBounds.x &&
                        tile.y < pathBounds.y + pathBounds.height &&
                        tile.y + tile.height > pathBounds.y);
            });
        }
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: fromRect.x + (toRect.x - fromRect.x) * t + fromRect.width / 2,
                y: fromRect.y + (toRect.y - fromRect.y) * t + fromRect.height / 2
            };
            
            // Only check candidate tiles, not all tiles
            for (const tile of candidateTiles) {
                if (this._pointInRect(point, tile)) {
                    pathTiles.add(tile.id);
                }
            }
        }
        
        return pathTiles;
    }

    _getCrossedTiles(fromRect, toRect) {
        const crossedTiles = new Set();
        const steps = 8; // Reduced from 20 to improve performance
        
        // Create expanded bounds to include the entire path
        const pathBounds = {
            x: Math.min(fromRect.x, toRect.x),
            y: Math.min(fromRect.y, toRect.y),
            width: Math.abs(toRect.x - fromRect.x) + fromRect.width,
            height: Math.abs(toRect.y - fromRect.y) + fromRect.height
        };
        
        // Get tiles that could possibly be crossed using spatial indexing
        let candidateTiles = [];
        if (canvas.scene.tiles.quadtree) {
            candidateTiles = canvas.scene.tiles.quadtree.getObjects(pathBounds);
        } else {
            candidateTiles = canvas.scene.tiles.filter(tile => {
                return (tile.x < pathBounds.x + pathBounds.width &&
                        tile.x + tile.width > pathBounds.x &&
                        tile.y < pathBounds.y + pathBounds.height &&
                        tile.y + tile.height > pathBounds.y);
            });
        }
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            // Calculate token rectangle at this point along the path
            const tokenRectAtPoint = {
                x: fromRect.x + (toRect.x - fromRect.x) * t,
                y: fromRect.y + (toRect.y - fromRect.y) * t,
                width: fromRect.width,
                height: fromRect.height
            };
            
            // Only check candidate tiles, not all tiles
            for (const tile of candidateTiles) {
                if (this._rectIntersects(tokenRectAtPoint, tile)) {
                    crossedTiles.add(tile.id);
                }
            }
        }
        return crossedTiles;
    }


    /**
     * Determine the broad category from a targetFilter.type value
     * @param {string} filterType - The targetFilter.type value
     * @returns {string} Category: 'actor', 'doors', 'tokens', 'walls', 'tiles', 'regions'
     * @private
     */
    _getFilterCategory(filterType) {
        if (!filterType) return 'actor';
        if (filterType.startsWith('hasEffect') || filterType.startsWith('is')) return 'actor';
        if (filterType === 'any') return 'actor';
        if (['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(filterType)) return filterType;
        if (filterType.startsWith('any:')) {
            const types = filterType.substring(4).split(',').map(t => t.trim());
            const elementType = types.find(t => ['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(t));
            if (elementType) return elementType;
            return 'actor';
        }
        return 'actor';
    }

    /**
     * Evaluate "all must match" mode: gather all matching targets from the scene,
     * evaluate conditions for each, return true only if ALL pass.
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The current event context
     * @returns {boolean} Whether all matching targets satisfy the trigger conditions
     * @private
     */
    _evaluateAllTargetsMatch(trigger, context) {
        const filterType = trigger.trigger?.targetFilter?.type || '';
        const filterIds = trigger.trigger?.targetFilter?.ids || '';
        const conditions = trigger.trigger?.conditions || [];
        const category = this._getFilterCategory(filterType);
        
        if (category === 'actor') {
            // Gather all matching actors from the scene
            const matchingActors = this._getMatchingSceneActors(filterType, filterIds);
            
            if (matchingActors.length === 0) {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Trigger "${trigger.name}" match=all: no matching actors in scene, returning false`);
                }
                return false; // Require at least 1 matching target
            }
            
            // Evaluate conditions for each matching actor
            for (const actor of matchingActors) {
                const actorToken = canvas.scene?.tokens.find(t => t.actor?.id === actor.id);
                const actorContext = {
                    ...context,
                    actor: actor,
                    token: actorToken || context.token
                };
                
                if (conditions.length > 0) {
                    const result = this._conditionEvaluator.evaluateConditions(conditions, actorContext);
                    if (!result.passed) {
                        if (this._debugMode) {
                            console.log(`WoD TriggerManager | Trigger "${trigger.name}" match=all: actor "${actor.name}" (${actor.type}) FAILED conditions`);
                        }
                        return false;
                    }
                }
            }
            
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Trigger "${trigger.name}" match=all: ALL ${matchingActors.length} actors passed conditions`);
            }
            return true;
        } else {
            // Element-type group evaluation (doors, tiles, etc.)
            // For now, element-type "all" mode falls back to individual check
            const targetTypes = [filterType];
            return this._checkTargetTypeMatch(targetTypes, category, context);
        }
    }

    /**
     * Get all actors from the current scene that match the target filter
     * @param {string} filterType - The targetFilter.type value
     * @param {string} filterIds - Comma-separated IDs to restrict to (optional)
     * @returns {Actor[]} Array of matching actors
     * @private
     */
    _getMatchingSceneActors(filterType, filterIds) {
        if (!canvas?.scene) return [];
        
        const allowedIds = (filterIds || '').split(',').map(id => id.trim()).filter(Boolean);
        const targetTypes = [filterType];
        const matchingActors = [];
        
        for (const tokenDoc of canvas.scene.tokens) {
            const actor = tokenDoc.actor;
            if (!actor) continue;
            
            // Check ID filter first
            if (allowedIds.length > 0) {
                const actorId = actor.id;
                const tokenId = tokenDoc.id;
                if (!allowedIds.includes(actorId) && !allowedIds.includes(tokenId)) continue;
            }
            
            // Check type match
            const dummyContext = { actor, token: tokenDoc };
            if (this._checkTargetTypeMatch(targetTypes, actor.type, dummyContext)) {
                matchingActors.push(actor);
            }
        }
        
        return matchingActors;
    }

    /**
     * Check if actor type matches the target specification
     * @param {Array} targetTypes - Array of target type specifications
     * @param {string} actorType - The actor's type
     * @param {Object} context - The trigger context
     * @returns {boolean} Whether the actor matches the target specification
     * @private
     */
    _checkTargetTypeMatch(targetTypes, actorType, context) {
        for (const targetType of targetTypes) {
            // Handle "self" - matches only the trigger host itself
            if (targetType === 'self') {
                // Check if the triggering document is the same as the trigger host
                const triggerHostId = context.triggerHost?.id;
                const triggeringId = context.document?.id || context.token?.id || context.actor?.id || '';
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Self target check: host=${triggerHostId}, triggering=${triggeringId}, match=${triggerHostId === triggeringId}`);
                }
                return triggerHostId === triggeringId;
            }
            
            // Handle "any" - matches any actor
            if (targetType === 'any') {
                return true;
            }
            
            // Handle "any:Type1,Type2" - matches any of the specified types
            if (targetType.startsWith('any:')) {
                const allowedTypes = targetType.substring(4).split(',').map(t => t.trim());
                if (allowedTypes.includes(actorType)) {
                    return true;
                }
                continue;
            }
            
            // Handle special conditions like "hasEffect", "isPlayer", "isGM", "isOwner"
            if (targetType.startsWith('hasEffect') || targetType.startsWith('is')) {
                if (this._evaluateSpecialCondition(targetType, context)) {
                    return true;
                }
                continue;
            }
            
            // Handle element types like "tokens", "doors", "walls", "tiles", "regions"
            if (['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(targetType)) {
                if (this._evaluateElementTypeTarget(targetType, context)) {
                    return true;
                }
                continue;
            }
            
            // Handle direct type match
            if (targetType === actorType) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Evaluate special condition targets like "isPlayer", "isGM", "isOwner"
     * @param {string} condition - The special condition
     * @param {Object} context - The trigger context
     * @returns {boolean} Whether the condition is met
     * @private
     */
    _evaluateSpecialCondition(condition, context) {
        const actor = context.actor;
        if (!actor) return false;
        
        switch (condition) {
            case 'isPlayer':
                // Check if actor has any player owner (not GM)
                return Object.entries(actor.ownership || {}).some(([userId, perm]) => {
                    const user = game.users.get(userId);
                    return user && !user.isGM && perm >= 1;
                });
                
            case 'isGM':
                // Check if actor is owned by GM
                return Object.entries(actor.ownership || {}).some(([userId, perm]) => {
                    const user = game.users.get(userId);
                    return user && user.isGM && perm >= 1;
                });
                
            case 'isOwner':
                // Check if current user owns the actor
                const currentUserId = game.user.id;
                return (actor.ownership?.[currentUserId] || 0) >= 1;
                
            case 'hasEffect':
                // Check if actor has any effects
                return actor.effects && actor.effects.size > 0;
                
            default:
                // Handle "hasEffect:EffectName" format
                if (condition.startsWith('hasEffect:')) {
                    const effectName = condition.substring(10);
                    return actor.effects.some(effect => effect.name === effectName);
                }
                return false;
        }
    }

    /**
     * Evaluate element type targets like "tokens", "doors", "walls", "tiles", "regions"
     * @param {string} elementType - The element type
     * @param {Object} context - The trigger context
     * @returns {boolean} Whether the element type matches
     * @private
     */
    _evaluateElementTypeTarget(elementType, context) {
        switch (elementType) {
            case 'tokens':
                return context.token !== undefined;
            case 'doors':
            case 'walls':
                return context.wall !== undefined;
            case 'tiles':
                return context.tile !== undefined;
            case 'regions':
                return context.region !== undefined;
            default:
                return false;
        }
    }

    async _executeRoll(actor, rollConfig) {
        if (!actor) return false;

        console.log(`[WOD TRIGGER] _executeRoll: actor=${actor.name} type=${rollConfig.type} attr=${rollConfig.attribute} ability=${rollConfig.ability} poolName=${rollConfig.poolName}`);

        const difficulty = Number(rollConfig.difficulty ?? 6);
        const successThreshold = Number(rollConfig.successThreshold ?? 1);

        let poolSize = 0;
        let poolName = '';
        let traits = [];

        if (rollConfig.type === 'attribute+ability') {
            const attribute = rollConfig.attribute;
            const ability = rollConfig.ability;

            if (!attribute || !ability) {
                console.warn(`[WOD TRIGGER] _executeRoll: missing attribute="${attribute}" or ability="${ability}"`);
                ui.notifications?.warn('WoD TriggerManager | Roll missing attribute or ability');
                return false;
            }

            poolSize = actor.calculatePool ? actor.calculatePool(attribute, ability) : 0;
            poolName = `${attribute} + ${ability}`;
            traits = [
                { name: attribute, value: actor._findAttributeValue ? actor._findAttributeValue(attribute) : null, type: 'attribute', category: 'attribute' },
                { name: ability, value: actor._findAbilityValue ? actor._findAbilityValue(ability) : null, type: 'ability', category: 'ability' }
            ];
        } else if (rollConfig.type === 'single') {
            const poolNameConfig = rollConfig.poolName || '';
            if (!poolNameConfig) {
                console.warn(`[WOD TRIGGER] _executeRoll: single roll missing poolName`);
                ui.notifications?.warn('WoD TriggerManager | Single roll missing pool name');
                return false;
            }

            poolName = poolNameConfig;
            const poolKey = poolNameConfig.toLowerCase();

            // Try to find the pool value from actor system data
            const systemData = actor.system || actor.data?.system || {};
            
            // Check common locations for single pools
            if (systemData[poolKey] !== undefined) {
                poolSize = Number(systemData[poolKey]) || 0;
            } else if (systemData.pools?.[poolKey] !== undefined) {
                poolSize = Number(systemData.pools[poolKey]) || 0;
            } else if (systemData.advantages?.[poolKey]?.value !== undefined) {
                poolSize = Number(systemData.advantages[poolKey].value) || 0;
            } else if (systemData[poolKey]?.value !== undefined) {
                poolSize = Number(systemData[poolKey].value) || 0;
            } else {
                // Fallback: search through all properties
                const found = this._findPoolValue(systemData, poolKey);
                poolSize = found ?? 0;
            }

            traits = [{ name: poolNameConfig, value: poolSize, type: 'pool', category: 'pool' }];
        } else {
            console.warn(`[WOD TRIGGER] _executeRoll: unknown type="${rollConfig.type}"`);
            ui.notifications?.warn(`WoD TriggerManager | Unknown roll type: ${rollConfig.type}`);
            return false;
        }

        console.log(`[WOD TRIGGER] _executeRoll: poolSize=${poolSize} poolName="${poolName}"`);
        if (poolSize <= 0) {
            console.warn(`[WOD TRIGGER] _executeRoll: poolSize is 0 for "${poolName}", skipping roll`);
            ui.notifications?.warn(`WoD TriggerManager | Pool size is 0 for ${poolName}`);
            return false;
        }

        const gmOnly = rollConfig.gmOnly !== false; // Default to true (GM-only)
        const result = await actor.rollPool(poolName, poolSize, {
            difficulty,
            specialty: false,
            modifiers: [],
            traits,
            gmOnly
        });

        return (result?.successes ?? 0) >= successThreshold && !result?.isBotch;
    }

    _findPoolValue(obj, key, depth = 0) {
        if (depth > 5 || !obj || typeof obj !== 'object') return null;
        
        for (const [k, v] of Object.entries(obj)) {
            if (k.toLowerCase() === key) {
                if (typeof v === 'number') return v;
                if (typeof v === 'object' && v?.value !== undefined) return Number(v.value);
            }
            if (typeof v === 'object' && v !== null) {
                const found = this._findPoolValue(v, key, depth + 1);
                if (found !== null) return found;
            }
        }
        return null;
    }

    // ==================== Door State Handler ====================
    
    /**
     * Get a human-readable name for a door state
     * @param {number} state - The door state constant
     * @returns {string} Human-readable state name
     */
    _getDoorStateName(state) {
        switch (state) {
            case CONST.WALL_DOOR_STATES.CLOSED: return 'closed';
            case CONST.WALL_DOOR_STATES.OPEN: return 'open';
            case CONST.WALL_DOOR_STATES.LOCKED: return 'locked';
            default: return 'unknown';
        }
    }
    
    // ==================== Scene Trigger Processing ====================
    
    /**
     * Process scene-level triggers for a given event.
     * Scene triggers use a separate flag path ('sceneTriggers') but the same pipeline.
     * @param {string} eventType - The event type
     * @param {Object} context - Additional context
     */
    async _processSceneTriggers(eventType, context = {}) {
        if (!canvas?.scene) return;
        
        const sceneTriggers = canvas.scene.getFlag('wodsystem', 'sceneTriggers') || [];
        if (!Array.isArray(sceneTriggers) || sceneTriggers.length === 0) return;
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Checking ${sceneTriggers.length} scene triggers for event: ${eventType}`);
        }
        
        const fullContext = {
            eventType,
            scene: canvas.scene,
            document: canvas.scene,
            documentType: 'scene',
            triggerHost: canvas.scene,
            ...context
        };
        
        for (const trigger of sceneTriggers) {
            if (!trigger || trigger.enabled === false) continue;
            
            // Step 1: Check event match (reuse unified method)
            if (!this._matchesEvent(trigger, eventType, fullContext)) continue;
            
            // Step 2: Check target filter
            // Scene triggers have special target matching (actors from scene tokens)
            const filterType = trigger.trigger?.targetFilter?.type || '';
            const matchMode = trigger.trigger?.targetFilter?.match || 'any';
            
            if (matchMode === 'all' && filterType) {
                if (!this._evaluateAllTargetsMatch(trigger, fullContext)) continue;
            } else if (filterType) {
                if (!this._checkSceneTriggerTargetMatch(trigger, context, eventType)) continue;
                // Check specific IDs
                const targetFilterIds = trigger.trigger?.targetFilter?.ids;
                if (targetFilterIds && typeof targetFilterIds === 'string' && targetFilterIds.trim().length > 0) {
                    const allowedIds = targetFilterIds.split(',').map(id => id.trim()).filter(Boolean);
                    if (allowedIds.length > 0) {
                        const triggeringId = context.document?.id || context.wall?.id || context.token?.id || context.actor?.id || '';
                        if (!allowedIds.includes(triggeringId)) continue;
                    }
                }
            }
            
            // Step 3: Evaluate conditions
            const conditions = trigger.trigger?.conditions || trigger.conditions || [];
            if (conditions.length > 0) {
                const result = this._conditionEvaluator.evaluateConditions(conditions, fullContext);
                if (!result.passed) continue;
            }
            
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Executing scene trigger "${trigger.name}"`);
            }
            
            // Step 4: Execute (reuse unified method)
            await this._executeTrigger(trigger, fullContext);
        }
    }

    /**
     * Check if a scene trigger should fire based on target matching
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The event context
     * @param {string} eventType - The event type
     * @returns {boolean} Whether the trigger should continue processing
     * @private
     */
    _checkSceneTriggerTargetMatch(trigger, context, eventType) {
        const filterType = trigger.trigger?.targetFilter?.type || '';
        if (!filterType) return true; // No target restriction
        
        const category = this._getFilterCategory(filterType);
        const targetTypes = [filterType]; // Wrap for _checkTargetTypeMatch
        
        // "any" matches everything
        if (filterType === 'any' || filterType.startsWith('any:')) {
            // For "any" with actor subtypes, still need to check actor match
            if (filterType === 'any') return true;
            // "any:Type1,Type2" — check if relevant actors match
        }
        
        // Element-type filters (doors, tiles, etc.)
        if (category !== 'actor') {
            const isDoorEvent = ['onAnyDoorOpened', 'onAnyDoorClosed', 'onAnyDoorLocked', 'onAnyDoorUnlocked', 'onAnyDoorStateChanged',
                                 'onDoorOpened', 'onDoorClosed', 'onDoorLocked', 'onDoorUnlocked'].includes(eventType);
            if (category === 'doors' && isDoorEvent) return true;
            
            // For other element types, check via _checkTargetTypeMatch
            return this._checkTargetTypeMatch(targetTypes, category, context);
        }
        
        // Actor-based filters — determine relevant actors based on the event type
        let relevantActors = [];
        
        switch (eventType) {
            case 'onEffectApplied':
            case 'onEffectRemoved':
                if (context.actor) {
                    relevantActors = [context.actor];
                } else {
                    relevantActors = canvas.scene.tokens.map(t => t.actor).filter(a => a);
                }
                break;
                
            case 'onAnyDoorOpened':
            case 'onAnyDoorClosed':
            case 'onAnyDoorLocked':
            case 'onAnyDoorUnlocked':
            case 'onAnyDoorStateChanged':
                // Actor-based filter on door events — no actors involved, skip
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Scene trigger "${trigger.name}" has actor filter "${filterType}" but event "${eventType}" has no actors, skipping`);
                }
                return false;
                
            case 'onCombatStart':
            case 'onCombatEnd':
                if (context.combat?.combatants) {
                    relevantActors = context.combat.combatants.map(c => c.actor).filter(a => a);
                }
                break;
                
            default:
                if (context.actor) {
                    relevantActors = [context.actor];
                } else if (context.token?.actor) {
                    relevantActors = [context.token.actor];
                }
                break;
        }
        
        if (relevantActors.length === 0) {
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Scene trigger "${trigger.name}" has filter "${filterType}" but no relevant actors for event "${eventType}", skipping`);
            }
            return false;
        }
        
        // Check if any relevant actor matches the target filter
        for (const actor of relevantActors) {
            if (this._checkTargetTypeMatch(targetTypes, actor.type, context)) {
                return true;
            }
        }
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Scene trigger "${trigger.name}" filter "${filterType}" does not match any relevant actors for "${eventType}", skipping`);
        }
        return false;
    }

    /**
     * Check effect-based triggers on tiles near a token
     * @param {TokenDocument} token - The token document
     * @param {ActiveEffect} effect - The effect being checked
     */
    _checkEffectTriggers(token, effect) {
        // Get all tiles that might have triggers using spatial indexing
        const tileRect = {
            x: token.x,
            y: token.y,
            width: token.width,
            height: token.height
        };

        let nearbyTiles = [];
        if (canvas.scene.tiles.quadtree) {
            nearbyTiles = canvas.scene.tiles.quadtree.getObjects(tileRect);
        } else {
            nearbyTiles = canvas.scene.tiles.filter(tile => {
                return (tile.x < tokenRect.x + tokenRect.width &&
                        tile.x + tile.width > tokenRect.x &&
                        tile.y < tokenRect.y + tokenRect.height &&
                        tile.y + tile.height > tokenRect.y);
            });
        }

        for (const tile of nearbyTiles) {
            if (this._rectIntersects(tileRect, tile)) {
                // Check if this tile has an onEffect trigger for this effect
                this._fireEvent('onEffect', tile, { token, actor: token?.actor, effect });
            }
        }
    }

    // ==================== Utilities ====================

    _setDiff(a, b) {
        const out = new Set();
        for (const v of a) {
            if (!b.has(v)) out.add(v);
        }
        return out;
    }
    
    /**
     * Clean up active intervals for a trigger
     * @param {string} triggerId - The trigger ID to clean up
     */
    _cleanupTriggerIntervals(triggerId) {
        if (!this._activeIntervals) return;
        
        // Clean up regular interval
        const interval = this._activeIntervals.get(triggerId);
        if (interval) {
            clearInterval(interval);
            this._activeIntervals.delete(triggerId);
        }
        
        // Clean up continuous interval
        const continuousInterval = this._activeIntervals.get(`continuous-${triggerId}`);
        if (continuousInterval) {
            clearInterval(continuousInterval);
            this._activeIntervals.delete(`continuous-${triggerId}`);
        }
    }

    /**
     * Emergency: Clear all active triggers and intervals
     * Call this if triggers are interfering with normal Foundry operations
     */
    emergencyClearAllTriggers() {
        console.warn('WoD TriggerManager | EMERGENCY: Clearing all active triggers');
        
        // Clear all intervals
        if (this._activeIntervals) {
            for (const [id, interval] of this._activeIntervals) {
                clearInterval(interval);
                console.log(`WoD TriggerManager | Cleared interval: ${id}`);
            }
            this._activeIntervals.clear();
        }
        
        // Clear any other active timers
        if (this._activeTimers) {
            for (const [id, timer] of this._activeTimers) {
                clearTimeout(timer);
                console.log(`WoD TriggerManager | Cleared timer: ${id}`);
            }
            this._activeTimers.clear();
        }
        
        console.log('WoD TriggerManager | Emergency clear completed');
    }

    }
