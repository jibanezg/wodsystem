/**
 * @deprecated v1.1.0
 * Health logic moved to WodActor domain methods
 * 
 * Architectural Reason:
 * Health calculations affect actor state and must respond to actor effects/statuses.
 * This is actor domain logic, not external service logic.
 * 
 * Migration: Use actor.applyDamage(), actor.healDamage(), actor.resetHealth(), etc.
 * 
 * Will be removed in v2.0.0
 */

/**
 * Health Service
 * Manages health tracking with damage types (bashing, lethal, aggravated)
 * Designed for current local calculation with future microservice integration support
 */
export class HealthService {
    /**
     * Add damage to the character (public method)
     * @param {Actor} actor - The actor to update
     * @param {string} damageType - "bashing" | "lethal" | "aggravated"
     * @returns {Promise<Object>} Updated health object
     */
    async addDamage(actor, damageType) {
        const health = foundry.utils.duplicate(actor.system.miscellaneous.health);
        
        if (!health.levels || !Array.isArray(health.levels)) {
            console.error("Health levels not properly initialized");
            return health;
        }
        
        // Add damage using cascade mechanics
        this._addDamage(health, damageType);
        health.derived = this._calculateDerivedHealth(health);
        
        await actor.update({ "system.miscellaneous.health": health }, { render: false });
        return health;
    }
    
    /**
     * Mark damage on a health level (deprecated - kept for compatibility)
     * @param {Actor} actor - The actor to update
     * @param {number} levelIndex - Health level index (0-6)
     * @param {string} damageType - "bashing" | "lethal" | "aggravated" | null
     * @returns {Promise<Object>} Updated health object
     */
    async markDamage(actor, levelIndex, damageType) {
        // Now just calls addDamage
        return this.addDamage(actor, damageType);
    }


    /**
     * Add damage using WoD cascade mechanics
     * Priority: More serious damage ALWAYS displaces less serious damage first
     * @private
     */
    _addDamage(health, damageType) {
        const newPriority = this._getDamagePriority(damageType);
        
        // Step 1: Check if there's lower-priority damage to displace
        let displaceIndex = -1;
        for (let i = 0; i < health.levels.length; i++) {
            const currentPriority = this._getDamagePriority(health.levels[i].damageType);
            if (health.levels[i].marked && currentPriority < newPriority) {
                displaceIndex = i;
                break;
            }
        }
        
        if (displaceIndex !== -1) {
            // Displace lower-priority damage
            const displacedDamage = health.levels[displaceIndex].damageType;
            health.levels[displaceIndex].damageType = damageType;
            
            // Cascade the displaced damage down
            this._cascadeDamage(health, displaceIndex + 1, displacedDamage);
            return;
        }
        
        // Step 2: No displacement needed, find first empty box
        let emptyIndex = health.levels.findIndex(level => !level.marked);
        
        if (emptyIndex !== -1) {
            // Mark empty box
            health.levels[emptyIndex].marked = true;
            health.levels[emptyIndex].damageType = damageType;
            return;
        }
        
        // Step 3: All boxes full, check for same type to upgrade
        let sameTypeIndex = health.levels.findIndex(level => level.marked && level.damageType === damageType);
        
        if (sameTypeIndex !== -1) {
            // Upgrade the first box with same damage type
            health.levels[sameTypeIndex].damageType = this._upgradeDamageType(damageType);
            return;
        }
        
        // Step 4: Everything is full with higher priority damage - upgrade first same/lower priority box
        const firstSameOrLower = health.levels.findIndex(level => 
            this._getDamagePriority(level.damageType) <= newPriority
        );
        if (firstSameOrLower !== -1) {
            health.levels[firstSameOrLower].damageType = this._upgradeDamageType(
                health.levels[firstSameOrLower].damageType
            );
        }
    }

    /**
     * Cascade displaced damage down the health track
     * When damage is displaced, it moves to the next box
     * If that box has same damage type, both upgrade to next level
     * @private
     */
    _cascadeDamage(health, startIndex, displacedDamage) {
        if (startIndex >= health.levels.length) {
            // Fell off the end - damage is lost (character is worse off)
            return;
        }
        
        const targetBox = health.levels[startIndex];
        
        if (targetBox.damageType === displacedDamage) {
            // Same damage type - upgrade both
            targetBox.damageType = this._upgradeDamageType(displacedDamage);
        } else {
            // Different damage type - check priority
            const displacedPriority = this._getDamagePriority(displacedDamage);
            const targetPriority = this._getDamagePriority(targetBox.damageType);
            
            if (displacedPriority > targetPriority) {
                // Displaced damage takes this spot, push current down
                const furtherDisplaced = targetBox.damageType;
                targetBox.damageType = displacedDamage;
                this._cascadeDamage(health, startIndex + 1, furtherDisplaced);
            } else {
                // Target is more serious, displaced damage is lost
                // (Character is in bad shape)
            }
        }
    }

    /**
     * Get damage type priority (higher number = more serious)
     * @private
     */
    _getDamagePriority(damageType) {
        if (damageType === "aggravated") return 3;
        if (damageType === "lethal") return 2;
        if (damageType === "bashing") return 1;
        return 0; // null/empty
    }

    /**
     * Upgrade damage type to next level
     * @private
     */
    _upgradeDamageType(currentType) {
        if (currentType === "bashing") return "lethal";
        if (currentType === "lethal") return "aggravated";
        return "aggravated"; // Already max
    }

    /**
     * Calculate derived health stats
     * @private
     * @param {Object} health - Health object with levels
     * @returns {Object} Derived health stats
     */
    _calculateDerivedHealth(health) {
        let bashingCount = 0;
        let lethalCount = 0;
        let aggravatedCount = 0;
        let highestMarkedIndex = -1;
        
        health.levels.forEach((level, index) => {
            if (level.marked) {
                highestMarkedIndex = index;
                if (level.damageType === "bashing") bashingCount++;
                else if (level.damageType === "lethal") lethalCount++;
                else if (level.damageType === "aggravated") aggravatedCount++;
            }
        });
        
        const currentPenalty = highestMarkedIndex >= 0 ? health.levels[highestMarkedIndex].penalty : 0;
        const isIncapacitated = highestMarkedIndex === 6;
        
        return {
            currentPenalty: currentPenalty,
            totalDamage: bashingCount + lethalCount + aggravatedCount,
            bashingDamage: bashingCount,
            lethalDamage: lethalCount,
            aggravatedDamage: aggravatedCount,
            isIncapacitated: isIncapacitated
        };
    }

    /**
     * Heal one damage from bottom to top, most serious first
     * @private
     */
    _healOneDamage(health) {
        // Priority: aggravated > lethal > bashing
        // Direction: bottom to top
        
        // Find highest priority damage from bottom
        for (const damageType of ["aggravated", "lethal", "bashing"]) {
            for (let i = health.levels.length - 1; i >= 0; i--) {
                if (health.levels[i].marked && health.levels[i].damageType === damageType) {
                    // Clear this box
                    health.levels[i].marked = false;
                    health.levels[i].damageType = null;
                    return;
                }
            }
        }
    }

    /**
     * Heal specific damage type from bottom to top
     * @private
     */
    _healSpecificType(health, damageType) {
        for (let i = health.levels.length - 1; i >= 0; i--) {
            if (health.levels[i].marked && health.levels[i].damageType === damageType) {
                health.levels[i].marked = false;
                health.levels[i].damageType = null;
                return;
            }
        }
    }

    /**
     * Heal a specific amount of damage
     * @param {Actor} actor - The actor to update
     * @param {number} amount - Amount of damage to heal
     * @param {string} damageType - Optional: specific type to heal ("bashing"|"lethal"|"aggravated")
     * @returns {Promise<Object>} Updated health object
     */
    async healDamage(actor, amount = 1, damageType = null) {
        const health = foundry.utils.duplicate(actor.system.miscellaneous.health);
        
        if (!health.levels || !Array.isArray(health.levels)) {
            console.error("Health levels not properly initialized");
            return health;
        }
        
        for (let i = 0; i < amount; i++) {
            if (damageType) {
                this._healSpecificType(health, damageType);
            } else {
                this._healOneDamage(health);
            }
        }
        
        health.derived = this._calculateDerivedHealth(health);
        await actor.update({ "system.miscellaneous.health": health }, { render: false });
        return health;
    }

    /**
     * Load health state from microservice API (future implementation)
     * @private
     * @param {string} actorId - Actor ID
     * @param {number} levelIndex - Health level index
     * @param {string} damageType - Damage type
     * @returns {Promise<Object>} Updated health object
     */
    async _updateHealthViaAPI(actorId, levelIndex, damageType) {
        // Future implementation example:
        // const response = await fetch(`${CONFIG.microserviceUrl}/api/actors/${actorId}/health`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ levelIndex, damageType })
        // });
        // if (!response.ok) {
        //     throw new Error(`Health API error: ${response.status}`);
        // }
        // return await response.json();
        throw new Error("Microservice API integration not yet implemented");
    }

    /**
     * Heal damage (remove from lowest severity first)
     * @param {Actor} actor - The actor to heal
     * @param {number} amount - Amount of damage to heal
     * @param {string} damageType - Type of damage to heal (optional, heals all if not specified)
     * @returns {Promise<Object>} Updated health object
     */
    async healDamage(actor, amount, damageType = null) {
        const health = foundry.utils.duplicate(actor.system.miscellaneous.health);
        let healed = 0;
        
        // Heal from highest index to lowest (bottom up)
        for (let i = health.levels.length - 1; i >= 0 && healed < amount; i--) {
            const level = health.levels[i];
            
            if (level.marked) {
                // If specific damage type requested, only heal that type
                if (damageType === null || level.damageType === damageType) {
                    level.marked = false;
                    level.damageType = null;
                    healed++;
                }
            }
        }
        
        // Recalculate derived stats
        health.derived = this._calculateDerivedHealth(health);
        
        await actor.update({ "system.miscellaneous.health": health }, { render: false });
        return health;
    }

    /**
     * Reset all health (clear all damage)
     * @param {Actor} actor - The actor to reset
     * @returns {Promise<Object>} Updated health object
     */
    async resetHealth(actor) {
        const health = foundry.utils.duplicate(actor.system.miscellaneous.health);
        
        health.levels.forEach(level => {
            level.marked = false;
            level.damageType = null;
        });
        
        health.derived = this._calculateDerivedHealth(health);
        
        await actor.update({ "system.miscellaneous.health": health }, { render: false });
        return health;
    }

    /**
     * Add a new health level to the actor's health track
     * @param {Actor} actor - The actor to update
     * @param {string} name - Name of the new health level (default: "New Level")
     * @param {number} penalty - Wound penalty for this level (default: 0)
     * @returns {Promise<Object>} Updated health object
     */
    async addHealthLevel(actor, name = "New Level", penalty = 0) {
        const health = foundry.utils.duplicate(actor.system.miscellaneous.health);
        const newIndex = health.levels.length;
        
        health.levels.push({
            index: newIndex,
            name: name,
            penalty: penalty,
            damageType: null,
            marked: false
        });
        
        health.maximum = health.levels.length;
        health.derived = this._calculateDerivedHealth(health);
        
        await actor.update({ "system.miscellaneous.health": health });
        return health;
    }

    /**
     * Remove a health level from the actor's health track
     * @param {Actor} actor - The actor to update
     * @param {number} index - Index of the health level to remove
     * @returns {Promise<Object>} Updated health object
     */
    async removeHealthLevel(actor, index) {
        const health = foundry.utils.duplicate(actor.system.miscellaneous.health);
        
        if (health.levels.length <= 1) {
            ui.notifications.warn("Cannot remove the last health level");
            return health;
        }
        
        // Remove the level at the specified index
        health.levels.splice(index, 1);
        
        // Reindex remaining levels
        health.levels.forEach((level, i) => {
            level.index = i;
        });
        
        health.maximum = health.levels.length;
        health.derived = this._calculateDerivedHealth(health);
        
        await actor.update({ "system.miscellaneous.health": health });
        return health;
    }

    /**
     * Update a health level's properties (name and/or penalty)
     * @param {Actor} actor - The actor to update
     * @param {number} index - Index of the health level to update
     * @param {Object} updates - Object containing name and/or penalty to update
     * @returns {Promise<Object>} Updated health object
     */
    async updateHealthLevel(actor, index, updates) {
        const health = foundry.utils.duplicate(actor.system.miscellaneous.health);
        
        if (index < 0 || index >= health.levels.length) {
            console.error(`Invalid health level index: ${index}`);
            return health;
        }
        
        if (updates.name !== undefined) {
            health.levels[index].name = updates.name;
        }
        
        if (updates.penalty !== undefined) {
            health.levels[index].penalty = parseInt(updates.penalty);
        }
        
        await actor.update({ "system.miscellaneous.health": health });
        return health;
    }
}

// Create global singleton instance
window.HealthService = HealthService;
window.healthService = new HealthService();

console.log("HealthService initialized");

