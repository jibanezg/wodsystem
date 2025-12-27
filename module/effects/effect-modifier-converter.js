import { WodActiveEffect } from './wod-active-effect.js';

/**
 * Converts Active Effects to modifier objects for the roll system
 */
export class EffectModifierConverter {
    /**
     * Convert actor's active effects to modifier objects for roll dialog
     * @param {WodActor} actor - The actor making the roll
     * @param {Object} rollContext - Context for the roll {action: "attack", target: Actor, traits: []}
     * @returns {Array} Array of modifier objects [{name, value, type, mandatory, effectId, source}]
     */
    static getModifiersFromEffects(actor, rollContext = {}) {
        const modifiers = [];
        
        console.log("EffectModifierConverter - Getting modifiers for actor:", actor.name);
        console.log("EffectModifierConverter - Roll context:", rollContext);
        console.log("EffectModifierConverter - Actor effects count:", actor.effects?.size);
        
        if (!actor.effects) return modifiers;
        
        for (const effect of actor.effects) {
            console.log("Checking effect:", effect.name, "Active:", effect.active, "Disabled:", effect.disabled);
            
            // Skip inactive effects
            if (!effect.active) continue;
            
            // Skip disabled effects
            if (effect.disabled) continue;
            
            // Check if effect has expired
            if (this._isExpired(effect)) continue;
            
            // Get WoD-specific flags
            const wodFlags = this._getWodFlags(effect);
            console.log("Effect flags:", wodFlags);
            
            // Filter by conditions
            const conditionsMet = this._conditionsMet(effect, rollContext, wodFlags);
            console.log("Conditions met:", conditionsMet);
            if (!conditionsMet) continue;
            
            // Convert effect changes to modifiers
            for (const change of effect.changes) {
                const modifier = this._convertChangeToModifier(change, effect, wodFlags);
                if (modifier) {
                    console.log("Added modifier:", modifier);
                    modifiers.push(modifier);
                }
            }
        }
        
        console.log("Total modifiers found:", modifiers.length);
        return modifiers;
    }

    /**
     * Get modifiers from target actor's effects that affect rolls against them
     * @param {WodActor} attacker - Actor making the roll
     * @param {WodActor} defender - Actor being targeted
     * @param {Object} rollContext - Roll context
     * @returns {Array} Array of modifier objects
     */
    static getTargetedModifiers(attacker, defender, rollContext = {}) {
        const modifiers = [];
        
        if (!defender || !defender.effects) return modifiers;
        
        for (const effect of defender.effects) {
            if (!effect.active || effect.disabled) continue;
            
            const targetActorFlag = effect.getFlag('wodsystem', 'targetActor');
            
            // Check if this effect affects the attacker
            if (targetActorFlag && (targetActorFlag === attacker.id || targetActorFlag === 'any')) {
                const wodFlags = this._getWodFlags(effect);
                
                // Convert effect changes to modifiers
                for (const change of effect.changes) {
                    const modifier = this._convertChangeToModifier(change, effect, wodFlags);
                    if (modifier) {
                        modifier.name = `${modifier.name} (from ${defender.name})`;
                        modifier.targeted = true;
                        modifiers.push(modifier);
                    }
                }
            }
        }
        
        return modifiers;
    }

    /**
     * Get WoD-specific flags from an effect
     * @param {ActiveEffect} effect
     * @returns {Object}
     * @private
     */
    static _getWodFlags(effect) {
        return {
            severity: effect.getFlag('wodsystem', 'severity') || 1,
            sourceType: effect.getFlag('wodsystem', 'sourceType') || 'storyteller',
            sourceId: effect.getFlag('wodsystem', 'sourceId') || null,
            mandatory: effect.getFlag('wodsystem', 'mandatory') === true,
            targetActor: effect.getFlag('wodsystem', 'targetActor') || null,
            conditionType: effect.getFlag('wodsystem', 'conditionType') || 'always',
            conditionValue: effect.getFlag('wodsystem', 'conditionValue') || null,
            expiresAt: effect.getFlag('wodsystem', 'expiresAt') || null
        };
    }

    /**
     * Check if effect has expired
     * @param {ActiveEffect} effect
     * @returns {boolean}
     * @private
     */
    static _isExpired(effect) {
        const expiresAt = effect.getFlag('wodsystem', 'expiresAt');
        if (!expiresAt) return false;
        return game.time.worldTime >= expiresAt;
    }

    /**
     * Check if effect conditions are met for this roll
     * @param {ActiveEffect} effect
     * @param {Object} rollContext
     * @param {Object} wodFlags
     * @returns {boolean}
     * @private
     */
    static _conditionsMet(effect, rollContext, wodFlags) {
        const conditionType = wodFlags.conditionType;
        const conditionValue = wodFlags.conditionValue;
        
        switch(conditionType) {
            case 'always':
                return true;
                
            case 'specific_action':
                // Check if roll action matches
                return rollContext.action === conditionValue;
                
            case 'time_based':
                // Check time conditions (e.g., "day", "night", "combat")
                return this._checkTimeCondition(conditionValue);
                
            case 'trait_roll':
                // Check if specific trait is being rolled
                return rollContext.traits?.some(t => 
                    t.name.toLowerCase() === conditionValue?.toLowerCase()
                );
                
            default:
                return true;
        }
    }

    /**
     * Check time-based condition
     * @param {string} conditionValue
     * @returns {boolean}
     * @private
     */
    static _checkTimeCondition(conditionValue) {
        // Placeholder for time-based conditions
        // Could check game.time or combat state
        if (conditionValue === 'combat') {
            return game.combat?.active || false;
        }
        return true;
    }

    /**
     * Convert an ActiveEffect change to a modifier object
     * @param {Object} change - ActiveEffect change object
     * @param {ActiveEffect} effect - Parent effect
     * @param {Object} wodFlags - WoD-specific flags
     * @returns {Object|null} Modifier object or null
     * @private
     */
    static _convertChangeToModifier(change, effect, wodFlags) {
        // Parse the change key to determine modifier type
        const modifierType = this._parseChangeKey(change.key);
        
        if (!modifierType) return null;
        
        // Parse the value (could be formula or number)
        let value = this._parseChangeValue(change.value, change.mode);
        
        return {
            name: effect.name,
            value: value,
            type: modifierType,
            mandatory: wodFlags.mandatory,
            effectId: effect.id,
            source: wodFlags.sourceType,
            severity: wodFlags.severity,
            icon: effect.icon
        };
    }

    /**
     * Parse change key to determine modifier type
     * @param {string} key
     * @returns {string|null}
     * @private
     */
    static _parseChangeKey(key) {
        // Map Foundry change keys to our modifier types
        const keyMap = {
            'system.modifiers.pool': WodActiveEffect.MODIFIER_TYPES.POOL_BONUS,
            'system.modifiers.difficulty': WodActiveEffect.MODIFIER_TYPES.DIFFICULTY_MOD,
            'system.modifiers.autoSuccess': WodActiveEffect.MODIFIER_TYPES.AUTO_SUCCESS,
            'system.modifiers.autoFail': WodActiveEffect.MODIFIER_TYPES.AUTO_FAIL,
            
            // Shorthand keys
            'pool': WodActiveEffect.MODIFIER_TYPES.POOL_BONUS,
            'difficulty': WodActiveEffect.MODIFIER_TYPES.DIFFICULTY_MOD,
            'autoSuccess': WodActiveEffect.MODIFIER_TYPES.AUTO_SUCCESS,
            'autoFail': WodActiveEffect.MODIFIER_TYPES.AUTO_FAIL
        };
        
        return keyMap[key] || null;
    }

    /**
     * Parse change value based on mode
     * @param {string|number} value
     * @param {number} mode - CONST.ACTIVE_EFFECT_MODES
     * @returns {number}
     * @private
     */
    static _parseChangeValue(value, mode) {
        // Convert to number
        let numValue = Number(value);
        
        if (isNaN(numValue)) {
            console.warn(`WoD | Invalid modifier value: ${value}`);
            return 0;
        }
        
        // Mode 2 is ADD (most common for our use case)
        // Mode 5 is OVERRIDE
        // For our purposes, we'll mostly use ADD
        
        return numValue;
    }

    /**
     * Format modifier for display in UI
     * @param {Object} modifier
     * @returns {string}
     */
    static formatModifierDisplay(modifier) {
        const sign = modifier.value >= 0 ? '+' : '';
        
        switch(modifier.type) {
            case WodActiveEffect.MODIFIER_TYPES.POOL_BONUS:
                return `${sign}${modifier.value} dice`;
                
            case WodActiveEffect.MODIFIER_TYPES.DIFFICULTY_MOD:
                return `${sign}${modifier.value} difficulty`;
                
            case WodActiveEffect.MODIFIER_TYPES.AUTO_SUCCESS:
                return `+${Math.abs(modifier.value)} auto success${Math.abs(modifier.value) !== 1 ? 'es' : ''}`;
                
            case WodActiveEffect.MODIFIER_TYPES.AUTO_FAIL:
                return `+${Math.abs(modifier.value)} auto 1${Math.abs(modifier.value) !== 1 ? 's' : ''}`;
                
            default:
                return `${sign}${modifier.value}`;
        }
    }
}

