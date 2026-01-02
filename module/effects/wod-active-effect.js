/**
 * Extended Active Effect class for World of Darkness System
 * Adds WoD-specific metadata and modifier types
 */
export class WodActiveEffect extends ActiveEffect {
    // Custom flags for WoD metadata
    static WOD_FLAGS = {
        CREATED_BY: "wodsystem.createdBy",        // "player" or "storyteller"
        MANDATORY: "wodsystem.mandatory",         // true for ST effects (auto-applied)
        CONDITION_SCOPE: "wodsystem.conditionScope", // "always", "attribute", "ability", "advantage", etc. (EXTENSIBLE)
        CONDITION_TARGETS: "wodsystem.conditionTargets" // Array of specific targets (e.g., ["Dexterity", "Strength"], ["Firearms", "Melee"])
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
     * Get who created this effect
     * @returns {string} "player" or "storyteller"
     */
    get createdBy() {
        return this.getFlag('wodsystem', 'createdBy') || 'storyteller';
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
            img: effectData.icon || effectData.img || "icons/svg/aura.svg", // Use img (v12+)
            flags: {
                wodsystem: {
                    createdBy: effectData.createdBy || 'storyteller',
                    mandatory: effectData.mandatory !== undefined ? effectData.mandatory : false,
                    conditionScope: effectData.conditionScope || 'always',
                    conditionTargets: effectData.conditionTargets || []
                }
            },
            changes: effectData.changes || []
        };

        return await actor.createEmbeddedDocuments('ActiveEffect', [defaultData]);
    }
}

