/**
 * WodTokenManager - Comprehensive Token Management Service
 * 
 * Phase 1: Visual effects under conditions (opacity, tint, scale)
 * Future: Combat maneuvers, advanced item integration, movement control
 * 
 * Architecture:
 * - Pluggable condition evaluators (isIlluminated, hasEffect, attributeThreshold, ...)
 * - Pluggable property handlers (opacity, tint, scale, ...)
 * - Visual rules engine: condition → property mapping from actor/token flags
 * - Token state registry: tracks per-token computed state
 * - Hooks bridge: emits state change events for trigger system integration
 * - Queries API: find tokens by state, illumination, proximity, etc.
 */
export class WodTokenManager {

    /** @type {WodTokenManager|null} */
    static _instance = null;

    /**
     * @returns {WodTokenManager}
     */
    static getInstance() {
        if (!WodTokenManager._instance) {
            WodTokenManager._instance = new WodTokenManager();
        }
        return WodTokenManager._instance;
    }

    constructor() {
        // Per-token managed state: tokenId → { illuminated: bool, conditionResults: Map, ... }
        this._tokenStates = new Map();

        // Pluggable condition evaluators: conditionType → (tokenPlaceable, params) => bool
        this._conditionEvaluators = new Map();

        // Pluggable property handlers: propertyName → { apply(token, value, transition), reset(token, transition) }
        this._propertyHandlers = new Map();

        // Track in-flight animations to avoid overlapping: tokenId:property → timeoutId
        this._pendingTransitions = new Map();

        this._initialized = false;
        this._debugMode = false;
        this._canvasReady = false; // Set true once canvasReady fires and states are built

        // Throttle lighting refresh evaluations
        this._lightingRefreshThrottle = null;
        this._LIGHTING_REFRESH_DELAY = 150; // ms

        // Suppress lighting-refresh re-evaluations triggered by our own token.document.update()
        // calls inside _evaluateToken (e.g. opacity/tint changes). Without this guard the
        // evaluation fires 2-3 times per genuine lighting change.
        this._postEvalCooldown = false;
        this._postEvalCooldownTimer = null;
    }

    // ==================== Initialization ====================

    /**
     * Initialize the service: register defaults and hooks.
     * Call once during system ready.
     */
    initialize() {
        if (this._initialized) return;

        this._registerDefaultConditions();
        this._registerDefaultPropertyHandlers();
        this._registerHooks();

        this._initialized = true;
        console.log('WoD TokenManager | Initialized');
    }

    /**
     * @param {boolean} enabled
     */
    setDebugMode(enabled) {
        this._debugMode = !!enabled;
    }

    // ==================== Pluggable Condition Evaluators ====================

    /**
     * Register a condition evaluator.
     * @param {string} type - Unique condition type id
     * @param {(token: Token, params: Object) => boolean} evaluator
     */
    registerCondition(type, evaluator) {
        if (typeof evaluator !== 'function') {
            console.error(`WoD TokenManager | Condition evaluator for "${type}" must be a function`);
            return;
        }
        this._conditionEvaluators.set(type, evaluator);
    }

    /** Register built-in conditions */
    _registerDefaultConditions() {
        this.registerCondition('isIlluminated', (token, params) => this._evalIlluminated(token, params));
        this.registerCondition('hasEffect', (token, params) => this._evalHasEffect(token, params));
        this.registerCondition('attributeThreshold', (token, params) => this._evalAttributeThreshold(token, params));
    }

    // ==================== Pluggable Property Handlers ====================

    /**
     * Register a property handler.
     * @param {string} property - Property name (opacity, tint, scale, ...)
     * @param {{ apply: (token: Token, value: any, transition: Object) => Promise<void>,
     *           reset: (token: Token, defaultValue: any, transition: Object) => Promise<void> }} handler
     */
    registerPropertyHandler(property, handler) {
        if (!handler || typeof handler.apply !== 'function') {
            console.error(`WoD TokenManager | Property handler for "${property}" must have an apply() method`);
            return;
        }
        this._propertyHandlers.set(property, handler);
    }

    /** Register built-in property handlers */
    _registerDefaultPropertyHandlers() {
        // Opacity handler
        this.registerPropertyHandler('opacity', {
            apply: async (token, value, transition) => {
                await this._animateTokenProperty(token, 'alpha', value, transition);
            },
            reset: async (token, defaultValue, transition) => {
                const val = defaultValue ?? 1.0;
                await this._animateTokenProperty(token, 'alpha', val, transition);
            }
        });

        // Tint handler
        this.registerPropertyHandler('tint', {
            apply: async (token, value, transition) => {
                if (value && token.document) {
                    await token.document.update({ 'texture.tint': value }, { animate: false });
                }
            },
            reset: async (token, defaultValue, transition) => {
                if (token.document) {
                    await token.document.update({ 'texture.tint': defaultValue || '#ffffff' }, { animate: false });
                }
            }
        });

        // Scale handler
        this.registerPropertyHandler('scale', {
            apply: async (token, value, transition) => {
                if (token.document && typeof value === 'number') {
                    await token.document.update({
                        'texture.scaleX': value,
                        'texture.scaleY': value
                    }, { animate: false });
                }
            },
            reset: async (token, defaultValue, transition) => {
                const val = defaultValue ?? 1.0;
                if (token.document) {
                    await token.document.update({
                        'texture.scaleX': val,
                        'texture.scaleY': val
                    }, { animate: false });
                }
            }
        });
    }

    // ==================== Hooks ====================

    _registerHooks() {
        // Lighting/vision hooks — register ALL known variants for cross-version compat
        const lightingHookNames = [
            'lightingRefresh',
            'refreshLighting',
            'initializeLightSources',
            'sightRefresh',
            'refreshVisionSources',
            'perceptionRefresh'
        ];
        for (const hookName of lightingHookNames) {
            Hooks.on(hookName, () => {
                if (this._debugMode) {
                    console.log(`WoD TokenManager | Hook fired: ${hookName}`);
                }
                this._onLightingRefresh();
            });
        }

        // Scene ready → build initial state for all tokens
        Hooks.on('canvasReady', () => this._onCanvasReady());

        // Token lifecycle
        Hooks.on('createToken', (tokenDoc) => this._onTokenCreated(tokenDoc));
        Hooks.on('deleteToken', (tokenDoc) => this._onTokenDeleted(tokenDoc));
        Hooks.on('updateToken', (tokenDoc, changes) => this._onTokenUpdated(tokenDoc, changes));

        // Light source lifecycle — re-evaluate when lights are created/moved/deleted
        Hooks.on('createAmbientLight', () => {
            if (this._debugMode) console.log('WoD TokenManager | Hook fired: createAmbientLight');
            this._onLightingRefresh();
        });
        Hooks.on('updateAmbientLight', () => {
            if (this._debugMode) console.log('WoD TokenManager | Hook fired: updateAmbientLight');
            this._onLightingRefresh();
        });
        Hooks.on('deleteAmbientLight', () => {
            if (this._debugMode) console.log('WoD TokenManager | Hook fired: deleteAmbientLight');
            this._onLightingRefresh();
        });

        // Actor changes → re-evaluate effect/attribute conditions
        Hooks.on('updateActor', (actor, changes) => this._onActorUpdated(actor, changes));
        Hooks.on('createActiveEffect', (effect) => this._onEffectChanged(effect));
        Hooks.on('deleteActiveEffect', (effect) => this._onEffectChanged(effect));

        console.log('WoD TokenManager | Hooks registered');
    }

    // ==================== Hook Handlers ====================

    _onCanvasReady() {
        this._canvasReady = false; // Block lighting evals until we're set up
        this._tokenStates.clear();
        this._pendingTransitions.clear();

        // Cancel any pending lighting throttle from pre-canvasReady hooks
        if (this._lightingRefreshThrottle) {
            clearTimeout(this._lightingRefreshThrottle);
            this._lightingRefreshThrottle = null;
        }

        if (!canvas?.scene) return;

        // Build initial state for all tokens
        const placeables = canvas.tokens?.placeables || [];
        for (const token of placeables) {
            this._initTokenState(token);
        }

        console.log(`WoD TokenManager | Canvas ready — scene "${canvas.scene.name}", tracking ${placeables.length} tokens`);

        // Log which tokens have visual rules
        for (const token of placeables) {
            const rules = this._getVisualRules(token);
            if (rules.length > 0) {
                console.log(`WoD TokenManager |   Token "${token.name}" has ${rules.length} visual rule(s)`);
            }
        }

        // Mark canvas ready and run initial evaluation after lighting settles
        this._canvasReady = true;
        setTimeout(() => {
            console.log('WoD TokenManager | Running initial evaluation...');
            this._evaluateAllTokens();
        }, 500);
    }

    _onLightingRefresh() {
        // Don't evaluate before canvas is fully ready (avoids race with canvasReady)
        if (!this._canvasReady) return;

        // Suppress refreshes triggered by our own token.document.update() calls
        // (e.g. opacity/tint changes applied during a previous evaluation cycle).
        if (this._postEvalCooldown) return;

        // Throttle: lighting refreshes can fire very rapidly
        if (this._lightingRefreshThrottle) return;
        this._lightingRefreshThrottle = setTimeout(() => {
            this._lightingRefreshThrottle = null;
            this._runEvaluation('isIlluminated');
        }, this._LIGHTING_REFRESH_DELAY);
    }

    /**
     * Run a full token evaluation and suppress re-entry from the lighting refreshes
     * that our own token.document.update() calls will trigger.
     * @param {string} conditionFilter
     */
    async _runEvaluation(conditionFilter) {
        // Set cooldown immediately so any lighting fires during evaluation are ignored
        this._postEvalCooldown = true;

        const promises = canvas.tokens?.placeables?.map(t => this._evaluateToken(t, conditionFilter)) ?? [];
        await Promise.allSettled(promises);

        // Keep suppression for one more throttle cycle to absorb the lighting refreshes
        // that the document.update() calls above have queued in Foundry's event loop.
        clearTimeout(this._postEvalCooldownTimer);
        this._postEvalCooldownTimer = setTimeout(() => {
            this._postEvalCooldown = false;
            this._postEvalCooldownTimer = null;
        }, this._LIGHTING_REFRESH_DELAY * 2);
    }

    _onTokenCreated(tokenDoc) {
        const token = tokenDoc.object;
        if (!token) return;
        // Delay briefly to allow the token to fully render
        setTimeout(() => {
            this._initTokenState(token);
            this._evaluateToken(token);
        }, 200);
    }

    _onTokenDeleted(tokenDoc) {
        this._tokenStates.delete(tokenDoc.id);
        // Clean up any pending transitions
        for (const [key, timeoutId] of this._pendingTransitions) {
            if (key.startsWith(tokenDoc.id + ':')) {
                clearTimeout(timeoutId);
                this._pendingTransitions.delete(key);
            }
        }
    }

    _onTokenUpdated(tokenDoc, changes) {
        // If position changed, re-evaluate illumination
        if (changes.x !== undefined || changes.y !== undefined) {
            const token = tokenDoc.object;
            if (token) {
                setTimeout(() => this._evaluateToken(token, 'isIlluminated'), 100);
            }
        }
    }

    _onActorUpdated(actor, changes) {
        // Re-evaluate tokens linked to this actor for attribute-based rules
        if (!canvas?.tokens) return;
        for (const token of canvas.tokens.placeables) {
            if (token.actor?.id === actor.id) {
                this._evaluateToken(token, 'attributeThreshold');
            }
        }
    }

    _onEffectChanged(effect) {
        // Re-evaluate tokens linked to the effect's parent actor for hasEffect rules
        const actor = effect.parent;
        if (!actor || actor.documentName !== 'Actor') return;
        if (!canvas?.tokens) return;
        for (const token of canvas.tokens.placeables) {
            if (token.actor?.id === actor.id) {
                this._evaluateToken(token, 'hasEffect');
            }
        }
    }

    // ==================== Token State Registry ====================

    /**
     * Initialize tracked state for a token.
     * @param {Token} token - The Token placeable
     */
    _initTokenState(token) {
        if (!token?.document?.id) return;
        this._tokenStates.set(token.document.id, {
            conditionResults: new Map(), // conditionType:ruleId → boolean
            lastEvalTime: 0
        });
    }

    /**
     * Get or create state for a token.
     * @param {Token} token
     * @returns {Object}
     */
    _getTokenState(token) {
        const id = token?.document?.id;
        if (!id) return null;
        if (!this._tokenStates.has(id)) {
            this._initTokenState(token);
        }
        return this._tokenStates.get(id);
    }

    // ==================== Visual Rules Engine ====================

    /**
     * Get visual rules for a token (from token flags, then actor flags).
     * @param {Token} token
     * @returns {Array}
     */
    _getVisualRules(token) {
        const tokenRules = token.document?.getFlag('wodsystem', 'visualRules');
        if (Array.isArray(tokenRules) && tokenRules.length > 0) return tokenRules;

        const actorRules = token.actor?.getFlag('wodsystem', 'visualRules');
        if (Array.isArray(actorRules) && actorRules.length > 0) return actorRules;

        return [];
    }

    /**
     * Evaluate all visual rules on all tracked tokens.
     * @param {string} [conditionFilter] - If set, only evaluate rules with this condition type
     */
    _evaluateAllTokens(conditionFilter) {
        if (!canvas?.tokens) return;
        if (this._debugMode) {
            console.log(`WoD TokenManager | Evaluating all tokens${conditionFilter ? ` (filter: ${conditionFilter})` : ''}`);
        }
        for (const token of canvas.tokens.placeables) {
            this._evaluateToken(token, conditionFilter);
        }
    }

    /**
     * Evaluate visual rules on a single token.
     * @param {Token} token
     * @param {string} [conditionFilter] - If set, only evaluate rules with this condition type
     */
    async _evaluateToken(token, conditionFilter) {
        const rules = this._getVisualRules(token);
        if (rules.length === 0) return;

        const state = this._getTokenState(token);
        if (!state) return;

        for (const rule of rules) {
            if (!rule || !rule.enabled) continue;
            if (conditionFilter && rule.condition?.type !== conditionFilter) continue;

            const condType = rule.condition?.type;
            const evaluator = this._conditionEvaluators.get(condType);
            if (!evaluator) {
                if (this._debugMode) {
                    console.warn(`WoD TokenManager | Unknown condition type: ${condType}`);
                }
                continue;
            }

            const handler = this._propertyHandlers.get(rule.property);
            if (!handler) {
                if (this._debugMode) {
                    console.warn(`WoD TokenManager | Unknown property handler: ${rule.property}`);
                }
                continue;
            }

            // Evaluate condition
            let conditionMet;
            try {
                conditionMet = evaluator(token, rule.condition.params || {});
            } catch (err) {
                console.error(`WoD TokenManager | Error evaluating condition "${condType}" on "${token.name}":`, err);
                continue;
            }
            const stateKey = `${condType}:${rule.id}`;
            const prevResult = state.conditionResults.get(stateKey);

            if (this._debugMode) {
                console.log(`WoD TokenManager | Token "${token.name}" rule "${rule.id}": ${condType} = ${conditionMet} (prev: ${prevResult}, changed: ${prevResult !== conditionMet})`);
            }

            // Only act on state changes
            if (prevResult === conditionMet) continue;
            state.conditionResults.set(stateKey, conditionMet);

            console.log(`WoD TokenManager | STATE CHANGE: Token "${token.name}" — ${condType} changed to ${conditionMet} → setting ${rule.property} to ${conditionMet ? rule.activeValue : rule.inactiveValue}`);

            // Apply or reset property
            const transition = rule.transition || { duration: 500, easing: 'linear' };
            try {
                if (conditionMet) {
                    await handler.apply(token, rule.activeValue, transition);
                } else {
                    await handler.reset(token, rule.inactiveValue, transition);
                }
            } catch (err) {
                console.error(`WoD TokenManager | Error applying property "${rule.property}" on "${token.name}":`, err);
            }

            // Emit state change hook
            Hooks.callAll('wodTokenStateChanged', token, {
                ruleId: rule.id,
                conditionType: condType,
                conditionMet,
                property: rule.property,
                value: conditionMet ? rule.activeValue : rule.inactiveValue
            });
        }

        state.lastEvalTime = Date.now();
    }

    // ==================== Condition Evaluators ====================

    /**
     * Check if a light source is a darkness source (v11-v13 compatible).
     * Avoids the deprecated source.isDarkness getter in v13+.
     */
    _isDarknessSource(source) {
        // v13: separate DarknessSource class
        if (source.constructor?.sourceType === 'darkness') return true;
        if (source.constructor?.name?.includes('Darkness')) return true;
        // v12 and below: data.negative flag
        if (source.data?.negative === true) return true;
        return false;
    }

    _evalIlluminated(token, params = {}) {
        if (!canvas?.ready) return false;

        const scene = canvas.scene;
        if (!scene) return false;

        // Check scene global illumination first (v13: scene.environment, v12: scene.globalLight)
        const globalLightEnabled = scene.environment?.globalLight?.enabled ?? scene.globalLight ?? false;
        if (globalLightEnabled) {
            const darkness = scene.environment?.darknessLevel ?? scene.darkness ?? 0;
            const threshold = scene.environment?.globalLight?.darkness?.max ?? 1;
            if (darkness <= threshold) {
                if (this._debugMode) console.log(`WoD TokenManager | "${token.name}" illuminated by global light (darkness ${darkness} <= threshold ${threshold})`);
                return true;
            }
        }

        // Get token center point
        const center = token.center;
        if (!center) return false;

        // Resolve light sources collection (v13: canvas.effects.lightSources, fallback paths)
        const lightSources = canvas.effects?.lightSources
            || canvas.lighting?.sources
            || null;
        if (!lightSources) return false;

        const ignoreSelf = params.ignoreSelf ?? true;
        const tokenDocId = token.document?.id;

        for (const source of lightSources) {
            // Skip disabled/inactive sources
            if (source.disabled) continue;

            // Skip GlobalLightSource — global illumination is handled above via scene settings
            if (source.constructor?.name === 'GlobalLightSource'
                || source.constructor?.sourceType === 'GlobalLight') continue;

            // Skip darkness sources (v13-safe)
            if (this._isDarknessSource(source)) continue;

            // Skip the token's own light if configured
            // source.object can be a Token placeable whose document.id matches
            const sourceObjId = source.object?.document?.id || source.object?.id;
            if (ignoreSelf && sourceObjId === tokenDocId) continue;

            // Check if the light source shape contains the token center
            if (source.shape && typeof source.shape.contains === 'function') {
                if (source.shape.contains(center.x, center.y)) {
                    if (this._debugMode) {
                        console.log(`WoD TokenManager | "${token.name}" illuminated by light source (objectId: ${sourceObjId || 'ambient'}, type: ${source.constructor?.name})`);
                    }
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a token's actor has a specific active effect.
     * @param {Token} token
     * @param {Object} params - { effectName: string, effectId: string }
     * @returns {boolean}
     */
    _evalHasEffect(token, params = {}) {
        const actor = token.actor;
        if (!actor) return false;

        const effects = actor.effects;
        if (!effects || effects.size === 0) return false;

        if (params.effectId) {
            return effects.some(e => e.id === params.effectId && !e.disabled);
        }
        if (params.effectName) {
            const name = params.effectName.toLowerCase();
            return effects.some(e => e.name?.toLowerCase() === name && !e.disabled);
        }
        return false;
    }

    /**
     * Check if a token's actor attribute meets a threshold.
     * @param {Token} token
     * @param {Object} params - { path: string, operator: string, value: number }
     * @returns {boolean}
     */
    _evalAttributeThreshold(token, params = {}) {
        const actor = token.actor;
        if (!actor) return false;

        const path = params.path;
        if (!path) return false;

        const current = foundry.utils.getProperty(actor, path);
        if (current === undefined || current === null) return false;

        const target = Number(params.value);
        if (isNaN(target)) return false;

        const op = params.operator || '<';
        switch (op) {
            case '<': return current < target;
            case '<=': return current <= target;
            case '>': return current > target;
            case '>=': return current >= target;
            case '==': return current == target;
            case '!=': return current != target;
            default: return false;
        }
    }

    // ==================== Property Animation ====================

    /**
     * Animate a token document property with optional transition.
     * Uses Foundry's document update for persistence, with PIXI-level animation for smooth visuals.
     * @param {Token} token
     * @param {string} docProperty - Document property (e.g. 'alpha')
     * @param {number} targetValue
     * @param {Object} transition - { duration: ms, easing: string }
     */
    async _animateTokenProperty(token, docProperty, targetValue, transition = {}) {
        if (!token?.document) return;

        const tokenId = token.document.id;
        const transKey = `${tokenId}:${docProperty}`;
        const duration = transition.duration ?? 500;
        const pixiTarget = token.mesh || token.icon || token;
        const currentValue = pixiTarget?.[docProperty] ?? token.document[docProperty] ?? 1;

        if (this._debugMode) {
            console.log(`WoD TokenManager | Animating "${token.name}" ${docProperty}: ${currentValue} → ${targetValue} over ${duration}ms`);
        }

        // Cancel any in-flight animation for this token:property
        const existingAnim = this._pendingTransitions.get(transKey);
        if (existingAnim) {
            if (typeof existingAnim === 'number') clearTimeout(existingAnim);
            // Cancel named CanvasAnimation if available
            if (typeof CanvasAnimation !== 'undefined') {
                CanvasAnimation.terminateAnimation?.(transKey);
            }
            this._pendingTransitions.delete(transKey);
        }

        // Persist final value to the document immediately (no visual change yet)
        try {
            await token.document.update({ [docProperty]: targetValue }, { animate: false });
        } catch (err) {
            console.error(`WoD TokenManager | Failed to update document ${docProperty}:`, err);
            return;
        }

        // Smooth PIXI-level animation
        if (pixiTarget && docProperty === 'alpha' && duration > 0) {
            // Hold the old visual value while we animate
            pixiTarget.alpha = currentValue;

            try {
                // Use Foundry's CanvasAnimation for smooth interpolation
                if (typeof CanvasAnimation !== 'undefined' && CanvasAnimation.animate) {
                    this._pendingTransitions.set(transKey, true);
                    await CanvasAnimation.animate(
                        [{ parent: pixiTarget, attribute: 'alpha', to: targetValue }],
                        { duration, name: transKey }
                    );
                    this._pendingTransitions.delete(transKey);
                } else {
                    // Fallback: manual requestAnimationFrame lerp
                    await this._manualAnimate(pixiTarget, 'alpha', currentValue, targetValue, duration, transKey);
                }
            } catch (err) {
                // Animation cancelled or failed — snap to final value
                pixiTarget.alpha = targetValue;
                this._pendingTransitions.delete(transKey);
            }
        } else if (pixiTarget && docProperty === 'alpha') {
            // duration 0 → instant
            pixiTarget.alpha = targetValue;
        }

        if (this._debugMode) {
            console.log(`WoD TokenManager | Animation complete: "${token.name}" ${docProperty}=${targetValue}`);
        }
    }

    /**
     * Fallback manual animation when CanvasAnimation is unavailable.
     */
    _manualAnimate(target, attr, from, to, duration, transKey) {
        return new Promise((resolve) => {
            const startTime = performance.now();
            const tick = (now) => {
                const elapsed = now - startTime;
                const t = Math.min(elapsed / duration, 1);
                // Ease in-out
                const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                target[attr] = from + (to - from) * eased;
                if (t < 1 && this._pendingTransitions.has(transKey)) {
                    requestAnimationFrame(tick);
                } else {
                    target[attr] = to;
                    this._pendingTransitions.delete(transKey);
                    resolve();
                }
            };
            this._pendingTransitions.set(transKey, true);
            requestAnimationFrame(tick);
        });
    }

    // ==================== Queries API ====================

    /**
     * Get all tokens that currently match a condition state.
     * @param {string} conditionType
     * @param {boolean} [value=true]
     * @returns {Token[]}
     */
    getTokensByCondition(conditionType, value = true) {
        const results = [];
        if (!canvas?.tokens) return results;

        for (const token of canvas.tokens.placeables) {
            const state = this._tokenStates.get(token.document?.id);
            if (!state) continue;
            for (const [key, result] of state.conditionResults) {
                if (key.startsWith(conditionType + ':') && result === value) {
                    results.push(token);
                    break;
                }
            }
        }
        return results;
    }

    /**
     * Get all currently illuminated tokens.
     * @returns {Token[]}
     */
    getIlluminatedTokens() {
        return this.getTokensByCondition('isIlluminated', true);
    }

    /**
     * Get all tokens within a radius of a point.
     * @param {{ x: number, y: number }} point
     * @param {number} distance - In pixels
     * @returns {Token[]}
     */
    getTokensInRadius(point, distance) {
        const results = [];
        if (!canvas?.tokens) return results;

        const d2 = distance * distance;
        for (const token of canvas.tokens.placeables) {
            const center = token.center;
            if (!center) continue;
            const dx = center.x - point.x;
            const dy = center.y - point.y;
            if (dx * dx + dy * dy <= d2) {
                results.push(token);
            }
        }
        return results;
    }

    /**
     * Get all tokens whose actor has a specific effect.
     * @param {string} effectName
     * @returns {Token[]}
     */
    getTokensWithEffect(effectName) {
        const results = [];
        if (!canvas?.tokens) return results;
        const name = effectName.toLowerCase();

        for (const token of canvas.tokens.placeables) {
            const effects = token.actor?.effects;
            if (effects?.some(e => e.name?.toLowerCase() === name && !e.disabled)) {
                results.push(token);
            }
        }
        return results;
    }

    /**
     * Check if a specific token is currently illuminated (on-demand query, not cached).
     * @param {Token|string} tokenOrId
     * @returns {boolean}
     */
    isTokenIlluminated(tokenOrId) {
        let token = tokenOrId;
        if (typeof tokenOrId === 'string') {
            token = canvas?.tokens?.get(tokenOrId);
        }
        if (!token) return false;
        return this._evalIlluminated(token, {});
    }

    // ==================== Public API: Evaluation & Diagnostics ====================

    /**
     * Manually trigger evaluation of all tokens. Call from console:
     * game.wod.tokenManager.evaluateAll()
     */
    evaluateAll() {
        console.log('WoD TokenManager | Manual evaluateAll() called');
        this._evaluateAllTokens();
    }

    /**
     * Force-evaluate a single token by name. Call from console:
     * game.wod.tokenManager.forceEvaluate("TokenName")
     * @param {string} tokenName
     */
    forceEvaluate(tokenName) {
        if (!canvas?.tokens) return;
        const token = canvas.tokens.placeables.find(t => t.name === tokenName);
        if (!token) {
            console.warn(`WoD TokenManager | Token "${tokenName}" not found`);
            return;
        }
        // Clear cached state so it re-evaluates fresh
        const state = this._getTokenState(token);
        if (state) state.conditionResults.clear();
        this._evaluateToken(token);
    }

    /**
     * Dump diagnostic info to console. Call from console:
     * game.wod.tokenManager.diagnose()
     */
    diagnose() {
        console.group('WoD TokenManager — Diagnostics');
        console.log('Initialized:', this._initialized);
        console.log('Debug mode:', this._debugMode);
        console.log('Condition evaluators:', [...this._conditionEvaluators.keys()]);
        console.log('Property handlers:', [...this._propertyHandlers.keys()]);
        console.log('Token states:', this._tokenStates.size);

        // Scene info first
        const scene = canvas?.scene;
        if (scene) {
            console.log('Scene:', {
                name: scene.name,
                globalLight: scene.environment?.globalLight?.enabled ?? scene.globalLight,
                darkness: scene.environment?.darknessLevel ?? scene.darkness,
                globalLightDarknessMax: scene.environment?.globalLight?.darkness?.max
            });
        }

        // Log lighting sources
        const lightSources = canvas?.effects?.lightSources || canvas?.lighting?.sources;
        console.log('Light sources available:', lightSources ? 'yes' : 'NO');
        if (lightSources) {
            let count = 0;
            for (const source of lightSources) {
                count++;
                if (count <= 10) {
                    console.log(`  Light #${count}:`, {
                        disabled: source.disabled,
                        negative: source.data?.negative,
                        isDarkness: this._isDarknessSource(source),
                        className: source.constructor?.name,
                        sourceType: source.constructor?.sourceType,
                        hasShape: !!source.shape,
                        objectId: source.object?.document?.id || source.object?.id,
                        x: source.data?.x,
                        y: source.data?.y
                    });
                }
            }
            console.log(`  Total light sources: ${count}`);
        }

        // Per-token detailed diagnostics
        if (canvas?.tokens) {
            for (const token of canvas.tokens.placeables) {
                const rules = this._getVisualRules(token);
                const state = this._tokenStates.get(token.document?.id);
                const isLit = this._evalIlluminated(token, { ignoreSelf: true });
                const center = token.center;
                console.group(`Token "${token.name}" (id: ${token.document?.id})`);
                console.log('Position:', { center, docAlpha: token.document?.alpha, pixiAlpha: (token.mesh || token.icon || token)?.alpha });
                console.log('Illuminated:', isLit);
                console.log('State:', state ? Object.fromEntries(state.conditionResults) : 'no state');

                // Show rules with their config
                if (rules.length > 0) {
                    for (const rule of rules) {
                        console.log(`  Rule "${rule.id}":`, {
                            enabled: rule.enabled,
                            condition: rule.condition?.type,
                            property: rule.property,
                            activeValue: rule.activeValue,
                            inactiveValue: rule.inactiveValue,
                            currentResult: state?.conditionResults?.get(`${rule.condition?.type}:${rule.id}`)
                        });
                    }
                } else {
                    console.log('  No visual rules configured');
                }

                // Detailed illumination breakdown for tokens with rules
                if (rules.length > 0 && lightSources && center) {
                    console.group('Illumination breakdown:');
                    const tokenDocId = token.document?.id;
                    let idx = 0;
                    for (const source of lightSources) {
                        idx++;
                        const sourceObjId = source.object?.document?.id || source.object?.id;
                        const isGlobal = source.constructor?.name === 'GlobalLightSource'
                            || source.constructor?.sourceType === 'GlobalLight';
                        const isDark = this._isDarknessSource(source);
                        const isSelf = sourceObjId === tokenDocId;
                        const contains = source.shape && typeof source.shape.contains === 'function'
                            ? source.shape.contains(center.x, center.y) : null;
                        const skip = source.disabled ? 'DISABLED' : isGlobal ? 'GLOBAL_LIGHT' : isDark ? 'DARKNESS' : isSelf ? 'SELF' : null;
                        console.log(`  Light #${idx} (${source.constructor?.name}):`, {
                            skip: skip || 'NOT SKIPPED',
                            containsToken: contains,
                            objectId: sourceObjId || 'ambient'
                        });
                    }
                    console.groupEnd();
                }
                console.groupEnd();
            }
        }

        console.groupEnd();
    }

    // ==================== Public API: Rule Management ====================

    /**
     * Add a visual rule to a token document.
     * @param {TokenDocument|Actor} doc - The token document or actor
     * @param {Object} rule - { condition: {type, params}, property, activeValue, inactiveValue, transition }
     * @returns {Object} The created rule with generated id
     */
    async addVisualRule(doc, rule) {
        if (!doc) return null;
        const rules = doc.getFlag('wodsystem', 'visualRules') || [];
        const newRule = {
            id: foundry.utils.randomID(),
            enabled: true,
            ...rule
        };
        rules.push(newRule);
        await doc.setFlag('wodsystem', 'visualRules', rules);
        return newRule;
    }

    /**
     * Remove a visual rule by id.
     * @param {TokenDocument|Actor} doc
     * @param {string} ruleId
     */
    async removeVisualRule(doc, ruleId) {
        if (!doc) return;
        const rules = doc.getFlag('wodsystem', 'visualRules') || [];
        const filtered = rules.filter(r => r.id !== ruleId);
        await doc.unsetFlag('wodsystem', 'visualRules');
        if (filtered.length > 0) {
            await doc.setFlag('wodsystem', 'visualRules', filtered);
        }
    }

    /**
     * Update a visual rule by id.
     * @param {TokenDocument|Actor} doc
     * @param {string} ruleId
     * @param {Object} updates - Partial rule updates
     */
    async updateVisualRule(doc, ruleId, updates) {
        if (!doc) return;
        const rules = doc.getFlag('wodsystem', 'visualRules') || [];
        const idx = rules.findIndex(r => r.id === ruleId);
        if (idx === -1) return;
        rules[idx] = foundry.utils.mergeObject(rules[idx], updates);
        await doc.unsetFlag('wodsystem', 'visualRules');
        await doc.setFlag('wodsystem', 'visualRules', rules);
    }

    /**
     * Get all visual rules for a document.
     * @param {TokenDocument|Actor} doc
     * @returns {Array}
     */
    getVisualRules(doc) {
        if (!doc) return [];
        return doc.getFlag('wodsystem', 'visualRules') || [];
    }
}
