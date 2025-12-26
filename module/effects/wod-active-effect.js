/**
 * Extended Active Effect class for World of Darkness System
 * Adds WoD-specific metadata and modifier types
 */
export class WodActiveEffect extends ActiveEffect {
    // Custom flags for WoD metadata
    static WOD_FLAGS = {
        SEVERITY: "wodsystem.severity",        // 1-5 scale
        SOURCE_TYPE: "wodsystem.sourceType",   // "equipment", "power", "environment", "storyteller"
        SOURCE_ID: "wodsystem.sourceId",       // Reference to granting item/actor
        MANDATORY: "wodsystem.mandatory",      // true = auto-applied, false = toggleable
        TARGET_ACTOR: "wodsystem.targetActor", // For "Flattered" type effects
        CONDITION_TYPE: "wodsystem.conditionType", // "always", "specific_action", "time_based", "trait_roll"
        CONDITION_VALUE: "wodsystem.conditionValue", // Value for condition (e.g., "attack" for specific_action)
        EXPIRES_AT: "wodsystem.expiresAt"      // Timestamp for expiration
    };
    
    // Modifier types for dice pool system
    static MODIFIER_TYPES = {
        POOL_BONUS: "poolBonus",           // Add/subtract dice
        DIFFICULTY_MOD: "difficultyMod",   // Add/subtract to difficulty
        AUTO_SUCCESS: "autoSuccess",       // Automatic successes
        AUTO_FAIL: "autoFail"             // Automatic failures (1s)
    };

    /**
     * Check if this effect is mandatory (auto-applied)
     * @returns {boolean}
     */
    get isMandatory() {
        return this.getFlag('wodsystem', 'mandatory') === true;
    }

    /**
     * Get the severity level of this effect
     * @returns {number} 1-5
     */
    get severity() {
        return this.getFlag('wodsystem', 'severity') || 1;
    }

    /**
     * Get the source type of this effect
     * @returns {string}
     */
    get sourceType() {
        return this.getFlag('wodsystem', 'sourceType') || 'storyteller';
    }

    /**
     * Check if this effect has expired
     * @returns {boolean}
     */
    get isExpired() {
        const expiresAt = this.getFlag('wodsystem', 'expiresAt');
        if (!expiresAt) return false;
        return game.time.worldTime >= expiresAt;
    }

    /**
     * Check expired effects for an actor and remove them
     * @param {WodActor} actor
     */
    static async checkExpiredEffects(actor) {
        const now = game.time.worldTime;
        const expired = actor.effects.filter(e => {
            const expiry = e.getFlag('wodsystem', 'expiresAt');
            return expiry && expiry <= now;
        });
        
        for (const effect of expired) {
            await effect.delete();
            ui.notifications.info(`Status "${effect.name}" has expired for ${actor.name}`);
        }
    }

    /**
     * Create a new WoD Active Effect with standard flags
     * @param {Object} effectData - Effect data
     * @param {Actor} actor - Actor to add effect to
     * @returns {Promise<ActiveEffect>}
     */
    static async createWodEffect(effectData, actor) {
        const defaultData = {
            name: effectData.name || "New Status",
            icon: effectData.icon || "icons/svg/aura.svg",
            flags: {
                wodsystem: {
                    severity: effectData.severity || 1,
                    sourceType: effectData.sourceType || 'storyteller',
                    sourceId: effectData.sourceId || null,
                    mandatory: effectData.mandatory !== undefined ? effectData.mandatory : false,
                    targetActor: effectData.targetActor || null,
                    conditionType: effectData.conditionType || 'always',
                    conditionValue: effectData.conditionValue || null,
                    expiresAt: effectData.expiresAt || null
                }
            },
            changes: effectData.changes || []
        };

        return await actor.createEmbeddedDocuments('ActiveEffect', [defaultData]);
    }
}

