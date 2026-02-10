/**
 * Core Effects Manager
 * Handles automatic core effects that are applied/removed based on character conditions
 * Examples: Wounded status, other condition-based effects
 */
export class CoreEffectsManager {
    constructor() {
        this.coreEffects = new Map();
        this._initializeCoreEffects();
    }

    async enableCoreEffect(actor, effectId, sourceId = 'manual', data = null, priority = 50) {
        if (!actor || !effectId) return;
        const sources = this._getCoreEffectSources(actor);
        sources[effectId] = sources[effectId] || {};
        sources[effectId][sourceId] = { mode: 'enable', priority, data };
        await this._setCoreEffectSources(actor, sources);
        await this.checkAndApplyCoreEffects(actor);
    }

    async disableCoreEffect(actor, effectId, sourceId = 'manual', priority = 50) {
        if (!actor || !effectId) return;
        const sources = this._getCoreEffectSources(actor);
        sources[effectId] = sources[effectId] || {};
        sources[effectId][sourceId] = { mode: 'disable', priority };
        await this._setCoreEffectSources(actor, sources);
        await this.checkAndApplyCoreEffects(actor);
    }

    isCoreEffectEnabled(actor, effectId) {
        if (!actor || !effectId) return false;
        const effectConfig = this.coreEffects.get(effectId);
        if (!effectConfig) return false;
        return this._resolveCoreEffectState(actor, effectId, effectConfig).shouldHaveEffect;
    }

    _getCoreEffectSources(actor) {
        return actor.getFlag('wodsystem', 'coreEffectSources') || {};
    }

    async _setCoreEffectSources(actor, sources) {
        await actor.setFlag('wodsystem', 'coreEffectSources', sources || {});
    }

    /**
     * Get all core effects as effect templates
     * @returns {Array} Array of core effect templates
     */
    getAllCoreEffects() {
        // Get core effects from JSON file via StatusEffectManager
        if (game.wod?.statusEffectManager) {
            const allEffects = game.wod.statusEffectManager.getAllEffectTemplates();
            return allEffects.filter(effect => effect.isCore === true || effect.category === 'Core');
        }
        
        // Fallback to hardcoded effects (should be empty now)
        return Array.from(this.coreEffects.values()).map(effect => ({
            ...effect,
            category: 'Core',
            tags: ['System', 'Automatic'],
            isCore: true
        }));
    }

    /**
     * Initialize all core effects
     * @private
     */
    _initializeCoreEffects() {
        // Core effects are now loaded from JSON file via StatusEffectManager
        // This method can be used for future hardcoded core effects if needed
    }

    /**
     * Check if actor is wounded (has any health penalty) and get the current penalty
     * @param {Actor} actor - The actor to check
     * @returns {Object|null} { penalty: number, level: string } or null if not wounded
     * @private
     */
    _isWounded(actor) {
        const health = actor.system.miscellaneous?.health;
        if (!health?.levels || !health?.derived) return null;

        const currentPenalty = health.derived.currentPenalty;
        
        // Only apply if there's an actual negative penalty (not incapacitated)
        if (currentPenalty < 0 && !health.derived.isIncapacitated) {
            // Find the highest marked level (most severe wound)
            let highestMarkedLevel = null;
            let highestIndex = -1;
            
            health.levels.forEach(level => {
                if (level.marked && level.index > highestIndex) {
                    highestIndex = level.index;
                    highestMarkedLevel = level.name;
                }
            });
            
            const levelName = highestMarkedLevel || 'Wounded';
            
            return {
                penalty: currentPenalty,
                level: levelName
            };
        }
        
        return null;
    }

    /**
     * Check all core effects for an actor and apply/remove as needed
     * @param {Actor} actor - The actor to check
     * @returns {Promise<void>}
     */
    async checkAndApplyCoreEffects(actor) {
        if (!actor) return;

        for (const [effectId, effectConfig] of this.coreEffects) {
            await this._checkAndApplyEffect(actor, effectId, effectConfig);
        }
    }

    _resolveCoreEffectState(actor, effectId, effectConfig) {
        const baseConditionResult = effectConfig.condition?.check ? effectConfig.condition.check(actor) : null;
        const baseWants = baseConditionResult !== null;
        const baseEnablePriority = baseWants ? 0 : -Infinity;

        const sources = this._getCoreEffectSources(actor);
        const effectSources = sources?.[effectId] || {};

        let bestEnable = { priority: -Infinity, data: null };
        let bestDisable = { priority: -Infinity };

        for (const entry of Object.values(effectSources)) {
            if (!entry || !entry.mode) continue;
            const p = Number(entry.priority ?? 50);
            if (entry.mode === 'enable') {
                if (p > bestEnable.priority) bestEnable = { priority: p, data: entry.data ?? null };
            }
            if (entry.mode === 'disable') {
                if (p > bestDisable.priority) bestDisable = { priority: p };
            }
        }

        const maxEnablePriority = Math.max(baseEnablePriority, bestEnable.priority);
        if (bestDisable.priority > maxEnablePriority) {
            return { shouldHaveEffect: false, conditionResult: null };
        }

        if (baseWants) {
            return { shouldHaveEffect: true, conditionResult: baseConditionResult };
        }

        if (bestEnable.priority > -Infinity) {
            const fallback = {
                penalty: Number(effectConfig?.changes?.[0]?.value ?? 0),
                level: effectConfig?.name || effectId
            };

            const conditionResult = bestEnable.data && typeof bestEnable.data === 'object'
                ? { ...fallback, ...bestEnable.data }
                : fallback;

            return { shouldHaveEffect: true, conditionResult };
        }

        return { shouldHaveEffect: false, conditionResult: null };
    }

    /**
     * Check and apply a specific core effect
     * @param {Actor} actor - The actor to check
     * @param {string} effectId - The effect ID
     * @param {Object} effectConfig - The effect configuration
     * @returns {Promise<void>}
     * @private
     */
    async _checkAndApplyEffect(actor, effectId, effectConfig) {
        const resolved = this._resolveCoreEffectState(actor, effectId, effectConfig);
        const conditionResult = resolved.conditionResult;
        const shouldHaveEffect = resolved.shouldHaveEffect;
        const existingEffects = actor.effects.filter(e => e.getFlag('wodsystem', 'coreEffectId') === effectId);
        const hasEffect = existingEffects.length > 0;

        if (shouldHaveEffect && !hasEffect) {
            // Apply the effect with dynamic penalty
            await this._applyCoreEffect(actor, effectConfig, conditionResult);
        } else if (!shouldHaveEffect && hasEffect) {
            // Remove the effect
            await this._removeCoreEffect(actor, effectId);
        } else if (shouldHaveEffect && hasEffect) {
            // Update existing effect if penalty changed, but ensure only one exists
            if (existingEffects.length > 1) {
                // Remove duplicates first
                await this._removeCoreEffect(actor, effectId);
                await this._applyCoreEffect(actor, effectConfig, conditionResult);
            } else {
                await this._updateCoreEffect(actor, effectId, effectConfig, conditionResult);
            }
        }
    }

    /**
     * Apply a core effect to an actor
     * @param {Actor} actor - The actor to apply effect to
     * @param {Object} effectConfig - The effect configuration
     * @param {Object} conditionResult - Result from condition check { penalty, level }
     * @returns {Promise<void>}
     * @private
     */
    async _applyCoreEffect(actor, effectConfig, conditionResult) {
        // First, remove any existing instances of this core effect to prevent duplicates
        await this._removeCoreEffect(actor, effectConfig.id);
        
        // Create dynamic changes based on condition result
        const dynamicChanges = effectConfig.changes.map(change => ({
            ...change,
            value: conditionResult.penalty // Use the actual penalty from health
        }));

        const effectData = {
            name: `${effectConfig.name} (${conditionResult.level})`,
            img: effectConfig.icon,
            changes: dynamicChanges,
            flags: {
                ...effectConfig.flags,
                wodsystem: {
                    ...effectConfig.flags.wodsystem,
                    coreEffectId: effectConfig.id,
                    currentPenalty: conditionResult.penalty,
                    currentLevel: conditionResult.level
                }
            },
            origin: actor.uuid,
            disabled: false
        };

        try {
            await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
        } catch (error) {
            console.error(`Core Effects Manager: Failed to apply effect "${effectConfig.name}" to ${actor.name}:`, error);
        }
    }

    /**
     * Update an existing core effect when penalty changes
     * @param {Actor} actor - The actor to update effect on
     * @param {string} effectId - The effect ID
     * @param {Object} effectConfig - The effect configuration
     * @param {Object} conditionResult - Result from condition check { penalty, level }
     * @returns {Promise<void>}
     * @private
     */
    async _updateCoreEffect(actor, effectId, effectConfig, conditionResult) {
        const existingEffect = actor.effects.find(e => e.getFlag('wodsystem', 'coreEffectId') === effectId);
        
        if (!existingEffect) return;
        
        // Check if the penalty or level actually changed
        const currentPenalty = existingEffect.getFlag('wodsystem', 'currentPenalty');
        const currentLevel = existingEffect.getFlag('wodsystem', 'currentLevel');
        
        if (currentPenalty === conditionResult.penalty && currentLevel === conditionResult.level) {
            return; // No change needed
        }
        
        // Create dynamic changes based on condition result
        const dynamicChanges = effectConfig.changes.map(change => ({
            ...change,
            value: conditionResult.penalty // Use the actual penalty from health
        }));

        const updateData = {
            name: `${effectConfig.name} (${conditionResult.level})`,
            changes: dynamicChanges,
            flags: {
                ...existingEffect.flags,
                wodsystem: {
                    ...existingEffect.flags.wodsystem,
                    currentPenalty: conditionResult.penalty,
                    currentLevel: conditionResult.level
                }
            }
        };

        try {
            await existingEffect.update(updateData);
        } catch (error) {
            console.error(`Core Effects Manager: Failed to update effect "${effectConfig.name}" on ${actor.name}:`, error);
        }
    }

    /**
     * Remove a core effect from an actor
     * @param {Actor} actor - The actor to remove effect from
     * @param {string} effectId - The effect ID to remove
     * @returns {Promise<void>}
     * @private
     */
    async _removeCoreEffect(actor, effectId) {
        const effectsToRemove = actor.effects.filter(e => 
            e.getFlag('wodsystem', 'coreEffectId') === effectId
        );

        if (effectsToRemove.length > 0) {
            const effectIds = effectsToRemove.map(e => e.id);
            try {
                await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
            } catch (error) {
                console.error(`Core Effects Manager: Failed to remove effect "${effectId}" from ${actor.name}:`, error);
            }
        }
    }

    /**
     * Get all core effect configurations
     * @returns {Object} Map of core effects
     */
    getCoreEffects() {
        return this.coreEffects;
    }

    /**
     * Get a specific core effect configuration
     * @param {string} effectId - The effect ID
     * @returns {Object|null} The effect configuration or null if not found
     */
    getCoreEffect(effectId) {
        return this.coreEffects.get(effectId) || null;
    }
}

// Singleton instance
export const coreEffectsManager = new CoreEffectsManager();
