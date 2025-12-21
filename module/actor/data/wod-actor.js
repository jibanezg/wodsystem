import { TraitFactory } from "../scripts/trait-factory.js";

export class WodActor extends Actor {
    /** @override */
    prepareData() {
        if (game.actors.invalidDocumentIds.has(this.id)) {
            return
        }

        super.prepareData();
        const actorData = this;
        this._prepareCharacterData(actorData);
    }

    _prepareCharacterData(actorData) {
        let listData = [];
        actorData.listData = listData;
        
        // Ensure health levels exist (migration for old actors)
        this._ensureHealthLevels();
        
        // Migrate backgrounds from object to array (for old actors)
        this._migrateBackgrounds();
        
        // Calculate creature-specific derived stats
        if (this.type === "Technocrat") {
            // TODO: Implement Primal Energy auto-calculation from Genius table
            // Awaiting Genius->Primal lookup table from user
            // this._calculatePrimalEnergyMax();
        }
        
        // Calculate derived stats for all creature types
        this._calculateDerivedAttributes();
    }
    
    /**
     * Ensure health levels array exists (for actors created before the health update)
     * This provides migration for old actors with current/maximum format
     */
    _ensureHealthLevels() {
        if (!this.system.miscellaneous?.health) return;
        
        const health = this.system.miscellaneous.health;
        
        // If levels array doesn't exist, create it
        if (!health.levels || !Array.isArray(health.levels) || health.levels.length === 0) {
            health.levels = [
                { index: 0, name: "Bruised", penalty: 0, damageType: null, marked: false },
                { index: 1, name: "Hurt", penalty: -1, damageType: null, marked: false },
                { index: 2, name: "Injured", penalty: -1, damageType: null, marked: false },
                { index: 3, name: "Wounded", penalty: -2, damageType: null, marked: false },
                { index: 4, name: "Mauled", penalty: -2, damageType: null, marked: false },
                { index: 5, name: "Crippled", penalty: -5, damageType: null, marked: false },
                { index: 6, name: "Incapacitated", penalty: 0, damageType: null, marked: false }
            ];
        }
        
        // Ensure derived object exists
        if (!health.derived) {
            health.derived = {
                currentPenalty: 0,
                totalDamage: 0,
                bashingDamage: 0,
                lethalDamage: 0,
                aggravatedDamage: 0,
                isIncapacitated: false
            };
        }
    }
    
    /**
     * Migrate backgrounds from object to array format (for old actors)
     * Converts old format: { "Allies": 3, "Contacts": 2 }
     * To new format: [{ name: "Allies", value: 3 }, { name: "Contacts", value: 2 }]
     */
    _migrateBackgrounds() {
        if (!this.system.miscellaneous) return;
        
        const backgrounds = this.system.miscellaneous.backgrounds;
        
        // If backgrounds is an object (old format), convert to array
        if (backgrounds && typeof backgrounds === 'object' && !Array.isArray(backgrounds)) {
            const bgArray = [];
            for (const [name, value] of Object.entries(backgrounds)) {
                if (value > 0) {
                    bgArray.push({ name, value });
                }
            }
            this.system.miscellaneous.backgrounds = bgArray;
        }
        
        // Ensure it's an array (for brand new actors)
        if (!this.system.miscellaneous.backgrounds) {
            this.system.miscellaneous.backgrounds = [];
        }
    }
    
    /**
     * Calculate Primal Energy maximum from Genius background
     * NOTE: Currently inactive - awaiting Genius->Primal Energy lookup table
     * Will be based on official M:tA table, not simple formula
     * @private
     */
    _calculatePrimalEnergyMax() {
        // TODO: Implement when Genius->Primal Energy table is provided
        // const geniusBg = this.system.miscellaneous.backgrounds.find(bg => bg.name === "Genius");
        // const geniusRating = geniusBg ? geniusBg.value : 0;
        // this.system.advantages.primalEnergy.maximum = GENIUS_PRIMAL_TABLE[geniusRating];
    }
    
    /**
     * Calculate derived attributes (generic for all creatures)
     */
    _calculateDerivedAttributes() {
        // Future: Add derived attribute calculations here
        // Examples: Initiative, Soak, Speed, etc.
    }
    
    /**
     * Generic pool calculation - works for all creatures
     * @param {string} attributeName - e.g., "Dexterity"
     * @param {string} abilityName - e.g., "Firearms"
     * @returns {number} Pool size
     */
    calculatePool(attributeName, abilityName) {
        // Find attribute value (search all categories)
        const attrValue = this._findAttributeValue(attributeName);
        const abilityValue = this._findAbilityValue(abilityName);
        
        // Apply modifiers (health penalty, etc.)
        const penalty = this.system.miscellaneous?.health?.derived?.currentPenalty || 0;
        
        return Math.max(0, attrValue + abilityValue + penalty);
    }
    
    /**
     * Find attribute value across all categories
     * Works generically - doesn't care about creature type
     * @param {string} attributeName - Name of the attribute
     * @returns {number} Attribute value
     */
    _findAttributeValue(attributeName) {
        if (!this.system.attributes) return 0;
        
        for (const category in this.system.attributes) {
            if (this.system.attributes[category][attributeName]) {
                return this.system.attributes[category][attributeName];
            }
        }
        return 0;
    }
    
    /**
     * Find ability value across all categories
     * Works generically - doesn't care about creature type
     * @param {string} abilityName - Name of the ability
     * @returns {number} Ability value
     */
    _findAbilityValue(abilityName) {
        if (!this.system.abilities) return 0;
        
        for (const category in this.system.abilities) {
            if (this.system.abilities[category][abilityName]) {
                return this.system.abilities[category][abilityName];
            }
        }
        
        // Check secondary abilities
        if (this.system.secondaryAbilities) {
            for (const category in this.system.secondaryAbilities) {
                const abilities = this.system.secondaryAbilities[category];
                if (Array.isArray(abilities)) {
                    const found = abilities.find(a => a.name === abilityName);
                    if (found) return found.value || 0;
                }
            }
        }
        
        return 0;
    }
    
    /**
     * Find background value
     * @param {string} backgroundName - Name of the background
     * @returns {number} Background value
     */
    _findBackgroundValue(backgroundName) {
        if (!this.system.advantages?.backgrounds) return 0;
        return this.system.advantages.backgrounds[backgroundName] || 0;
    }

    /** @override */
    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);
    }

    /**
     * ====================
     * ACTOR DOMAIN METHODS - Health Management
     * Actor owns health calculation logic and responds to its own state
     * ====================
     */

    /**
     * Apply damage to this actor
     * WoD cascade mechanics: fill empty → displace lower priority → upgrade same type
     * @param {string} damageType - "bashing", "lethal", or "aggravated"
     * @param {number} amount - Amount of damage (default 1)
     * @returns {Object} Updated health data
     */
    async applyDamage(damageType, amount = 1) {
        const health = foundry.utils.duplicate(this.system.miscellaneous.health);
        
        if (!health.levels || !Array.isArray(health.levels)) {
            console.error("Health levels not properly initialized");
            return health;
        }
        
        // Add damage using cascade mechanics
        for (let i = 0; i < amount; i++) {
            this._addDamage(health, damageType);
        }
        health.derived = this._calculateDerivedHealth(health);
        
        await this.update({ "system.miscellaneous.health": health }, { render: false });
        return health;
    }

    /**
     * Heal damage from this actor
     * WoD healing: bottom-to-top, most serious first (aggravated → lethal → bashing)
     * @param {number} amount - Amount to heal (default 1)
     * @param {string} damageType - Optional: specific type to heal
     * @returns {Object} Updated health data
     */
    async healDamage(amount = 1, damageType = null) {
        const health = foundry.utils.duplicate(this.system.miscellaneous.health);
        
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
        await this.update({ "system.miscellaneous.health": health }, { render: false });
        return health;
    }

    /**
     * Reset all damage on this actor
     * @returns {Object} Updated health data
     */
    async resetHealth() {
        const health = foundry.utils.duplicate(this.system.miscellaneous.health);
        
        health.levels.forEach(level => {
            level.marked = false;
            level.damageType = null;
        });
        
        health.derived = this._calculateDerivedHealth(health);
        
        await this.update({ "system.miscellaneous.health": health }, { render: false });
        return health;
    }

    /**
     * Add a new health level to this actor
     * @param {string} name - Level name (e.g., "Bruised")
     * @param {number} penalty - Wound penalty (e.g., 0, -1, -2)
     * @returns {Object} Updated health data
     */
    async addHealthLevel(name = "New Level", penalty = 0) {
        const health = foundry.utils.duplicate(this.system.miscellaneous.health);
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
        
        await this.update({ "system.miscellaneous.health": health });
        return health;
    }

    /**
     * Remove a health level from this actor
     * @param {number} index - Index of level to remove
     * @returns {Object} Updated health data
     */
    async removeHealthLevel(index) {
        const health = foundry.utils.duplicate(this.system.miscellaneous.health);
        
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
        
        await this.update({ "system.miscellaneous.health": health });
        return health;
    }

    /**
     * Update a health level's properties
     * @param {number} index - Index of level to update
     * @param {Object} updates - Properties to update (name, penalty, etc.)
     * @returns {Object} Updated health data
     */
    async updateHealthLevel(index, updates) {
        const health = foundry.utils.duplicate(this.system.miscellaneous.health);
        
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
        
        await this.update({ "system.miscellaneous.health": health });
        return health;
    }

    /**
     * ====================
     * PRIVATE HEALTH HELPER METHODS
     * ====================
     */

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
            this._cascadeDamage(health.levels, displaceIndex + 1, displacedDamage);
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
    _cascadeDamage(levels, startIndex, displacedDamage) {
        if (startIndex >= levels.length) {
            // Fell off the end - damage is lost (character is worse off)
            return;
        }
        
        const targetBox = levels[startIndex];
        
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
                this._cascadeDamage(levels, startIndex + 1, furtherDisplaced);
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
        const isIncapacitated = highestMarkedIndex === health.levels.length - 1;
        
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

    /** @override */
    async _onCreate(data, options, user) {
        // Create a duplicate of the actor data
        const actorData = foundry.utils.duplicate(this);
        
        // Check if traits need to be created
        if (!actorData.system.isCreated) {
            const factory = new TraitFactory();
            await factory.createAllTraits(this);
            // Update isCreated flag
            await this.update({ "system.isCreated": true });
        }
        
        await super._onCreate(data, options, user);
    }
} 