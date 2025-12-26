import { WodActiveEffect } from '../effects/wod-active-effect.js';

/**
 * Helper functions for managing equipment-granted Active Effects
 */
export class EquipmentEffects {
    /**
     * Grant effects to an actor when equipment is equipped
     * @param {Actor} actor - The actor equipping the item
     * @param {Object} equipment - The equipment item
     * @param {string} equipmentType - Type of equipment (weapon, armor, gear)
     * @returns {Promise<Array>} Array of created effects
     */
    static async grantEquipmentEffects(actor, equipment, equipmentType) {
        if (!equipment.grantsEffects || equipment.grantsEffects.length === 0) {
            return [];
        }
        
        const createdEffects = [];
        
        for (const effectData of equipment.grantsEffects) {
            // Create the effect with equipment as source
            const effectConfig = {
                name: effectData.name || `${equipment.name} Effect`,
                icon: effectData.icon || this._getDefaultIcon(equipmentType),
                severity: effectData.severity || 1,
                sourceType: 'equipment',
                sourceId: equipment.id,
                mandatory: effectData.mandatory !== undefined ? effectData.mandatory : false,
                targetActor: effectData.targetActor || null,
                conditionType: effectData.conditionType || 'always',
                conditionValue: effectData.conditionValue || null,
                expiresAt: effectData.expiresAt || null,
                changes: effectData.changes || []
            };
            
            const effect = await WodActiveEffect.createWodEffect(effectConfig, actor);
            if (effect && effect.length > 0) {
                createdEffects.push(effect[0]);
            }
        }
        
        return createdEffects;
    }

    /**
     * Remove all effects granted by a specific equipment item
     * @param {Actor} actor - The actor
     * @param {string} equipmentId - The equipment item ID
     * @returns {Promise<void>}
     */
    static async removeEquipmentEffects(actor, equipmentId) {
        const effectsToRemove = actor.effects.filter(e => 
            e.getFlag('wodsystem', 'sourceId') === equipmentId
        );
        
        for (const effect of effectsToRemove) {
            await effect.delete();
        }
    }

    /**
     * Create a standard equipment effect (helper for quick effect creation)
     * @param {string} name - Effect name
     * @param {string} modifierType - Type of modifier (poolBonus, difficultyMod, etc.)
     * @param {number} value - Modifier value
     * @param {Object} options - Additional options
     * @returns {Object} Effect data object
     */
    static createStandardEffect(name, modifierType, value, options = {}) {
        return {
            name: name,
            icon: options.icon || "icons/svg/aura.svg",
            severity: options.severity || 1,
            mandatory: options.mandatory !== undefined ? options.mandatory : false,
            targetActor: options.targetActor || null,
            conditionType: options.conditionType || 'always',
            conditionValue: options.conditionValue || null,
            changes: [
                {
                    key: modifierType,
                    mode: 2, // ADD mode
                    value: value
                }
            ]
        };
    }

    /**
     * Get default icon based on equipment type
     * @param {string} equipmentType
     * @returns {string}
     * @private
     */
    static _getDefaultIcon(equipmentType) {
        const icons = {
            weapon: "icons/svg/sword.svg",
            armor: "icons/svg/shield.svg",
            gear: "icons/svg/item-bag.svg"
        };
        return icons[equipmentType] || "icons/svg/aura.svg";
    }

    /**
     * Create a weapon damage bonus effect
     * @param {Object} weapon - Weapon data
     * @returns {Object} Effect data
     */
    static createWeaponEffect(weapon) {
        // Weapons typically don't grant ongoing effects, but could grant bonuses to attack rolls
        // For example, a well-balanced weapon might reduce difficulty
        return this.createStandardEffect(
            `${weapon.name} - Well Balanced`,
            'difficultyMod',
            -1,
            {
                conditionType: 'specific_action',
                conditionValue: 'attack',
                icon: "icons/svg/sword.svg"
            }
        );
    }

    /**
     * Create an armor protection effect
     * @param {Object} armor - Armor data
     * @returns {Object} Effect data
     */
    static createArmorEffect(armor) {
        // Armor provides soak bonus and possibly dexterity penalty
        const effects = [];
        
        // Soak bonus (this would integrate with the soak system)
        if (armor.rating > 0) {
            effects.push(this.createStandardEffect(
                `${armor.name} - Protection`,
                'poolBonus',
                armor.rating,
                {
                    conditionType: 'specific_action',
                    conditionValue: 'soak',
                    mandatory: true,
                    icon: "icons/svg/shield.svg"
                }
            ));
        }
        
        // Dexterity penalty
        if (armor.penalty < 0) {
            effects.push(this.createStandardEffect(
                `${armor.name} - Encumbrance`,
                'poolBonus',
                armor.penalty,
                {
                    conditionType: 'trait_roll',
                    conditionValue: 'Dexterity',
                    mandatory: true,
                    icon: "icons/svg/downgrade.svg"
                }
            ));
        }
        
        return effects;
    }
}

