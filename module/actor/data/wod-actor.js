import { TraitFactory } from "../scripts/trait-factory.js";
import { WodDicePool } from "../../dice/wod-dice-pool.js";

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

    /** @override */
    async _preUpdate(changed, options, user) {
        await super._preUpdate(changed, options, user);
        
        // Validate willpower: temporary cannot exceed permanent
        if (changed.system?.miscellaneous?.willpower) {
            const willpowerChanges = changed.system.miscellaneous.willpower;
            const currentWillpower = this.system.miscellaneous.willpower;
            
            console.log('_preUpdate hook - willpowerChanges:', willpowerChanges);
            console.log('_preUpdate hook - currentWillpower:', currentWillpower);
            
            // Get the new values (or keep current if not changed)
            // Ensure values are numbers (Foundry sometimes stores as strings)
            const newPermanent = parseInt(willpowerChanges.permanent ?? currentWillpower.permanent);
            const newTemporary = parseInt(willpowerChanges.temporary ?? currentWillpower.temporary);
            
            console.log(`_preUpdate hook - newPermanent: ${newPermanent}, newTemporary: ${newTemporary}`);
            
            // Constrain temporary willpower to not exceed permanent
            if (newTemporary > newPermanent) {
                console.log(`_preUpdate hook - LIMITING temporary from ${newTemporary} to ${newPermanent}`);
                changed.system.miscellaneous.willpower.temporary = newPermanent;
                ui.notifications.warn("Temporary Willpower cannot exceed Permanent Willpower.");
            }
            
            console.log('_preUpdate hook - final changed.system.miscellaneous.willpower:', changed.system.miscellaneous.willpower);
        }
    }

    _prepareCharacterData(actorData) {
        let listData = [];
        actorData.listData = listData;
        
        // Ensure health levels exist (migration for old actors)
        this._ensureHealthLevels();
        
        // Migrate backgrounds from object to array (for old actors)
        this._migrateBackgrounds();
        
        // Ensure secondary abilities are properly initialized (migration for old actors)
        this._ensureSecondaryAbilities();
        
        // Migrate secondary abilities from arrays to objects (one-time fix)
        this._migrateSecondaryAbilitiesToObjects();
        
        // Ensure secondary abilities stay as arrays (fix Foundry form corruption)
        this._ensureSecondaryAbilitiesAreArrays();
        
        // Ensure merits and flaws are arrays (fix Foundry form corruption)
        this._ensureMeritsFlawsAreArrays();
        
        // Ensure combat data exists
        if (!this.system.combat) {
            this.system.combat = { initiativeBonus: 0 };
        }
        
        // Ensure experience data exists
        if (!this.system.experience) {
            this.system.experience = { total: 0, current: 0, log: [] };
        }
        
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
     * Ensure secondary abilities are properly initialized (for old or corrupted actors)
     * Makes sure talents, skills, and knowledges exist as arrays
     */
    _ensureSecondaryAbilities() {
        if (!this.system.secondaryAbilities) {
            this.system.secondaryAbilities = {
                talents: [],
                skills: [],
                knowledges: []
            };
            return;
        }
        
        // Ensure each category exists (as array)
        if (!this.system.secondaryAbilities.talents) {
            this.system.secondaryAbilities.talents = [];
        }
        if (!this.system.secondaryAbilities.skills) {
            this.system.secondaryAbilities.skills = [];
        }
        if (!this.system.secondaryAbilities.knowledges) {
            this.system.secondaryAbilities.knowledges = [];
        }
    }
    
    /**
     * Migrate secondary abilities from object format to array format (to match merits)
     * Old format: { "Custom": 3 }
     * New format: [{ name: "Custom", value: 3 }]
     */
    _migrateSecondaryAbilitiesToObjects() {
        if (!this.system.secondaryAbilities) return;
        
        ['talents', 'skills', 'knowledges'].forEach(category => {
            const abilities = this.system.secondaryAbilities[category];
            
            // If it's already an array, make sure it's properly formatted
            if (Array.isArray(abilities)) {
                return; // Already correct format
            }
            
            // If it's an object, convert it to an array
            if (abilities && typeof abilities === 'object') {
                const newAbilities = [];
                for (const [name, value] of Object.entries(abilities)) {
                    // Handle both simple values and nested objects
                    if (typeof value === 'number') {
                        newAbilities.push({ name: name, value: value });
                    } else if (value && typeof value === 'object' && value.name !== undefined) {
                        // Corrupted format
                        newAbilities.push({ name: name, value: value.value || 0 });
                    }
                }
                this.system.secondaryAbilities[category] = newAbilities;
            }
        });
    }
    
    /**
     * Ensure merits and flaws are arrays (fix Foundry form processing corruption)
     * Foundry's form processing can convert arrays to objects - convert them back
     */
    _ensureMeritsFlawsAreArrays() {
        if (!this.system.miscellaneous) return;
        
        // If merits is not an array (corrupted by form processing), try to convert it back
        if (!Array.isArray(this.system.miscellaneous.merits)) {
            console.warn("Merits was not an array, attempting to recover data");
            const meritsObj = this.system.miscellaneous.merits;
            if (meritsObj && typeof meritsObj === 'object') {
                // Convert object back to array format: {0: {name: "X", value: 1}} -> [{name: "X", value: 1}]
                // Keep entries even if name is empty (they might be new/being edited)
                this.system.miscellaneous.merits = Object.values(meritsObj).filter(m => m && typeof m === 'object');
            } else {
                this.system.miscellaneous.merits = [];
            }
        }
        
        // If flaws is not an array (corrupted by form processing), try to convert it back
        if (!Array.isArray(this.system.miscellaneous.flaws)) {
            console.warn("Flaws was not an array, attempting to recover data");
            const flawsObj = this.system.miscellaneous.flaws;
            if (flawsObj && typeof flawsObj === 'object') {
                // Convert object back to array format: {0: {name: "X", value: 1}} -> [{name: "X", value: 1}]
                // Keep entries even if name is empty (they might be new/being edited)
                this.system.miscellaneous.flaws = Object.values(flawsObj).filter(f => f && typeof f === 'object');
            } else {
                this.system.miscellaneous.flaws = [];
            }
        }
    }
    
    /**
     * Ensure secondary abilities are arrays (fix Foundry form processing corruption)
     */
    _ensureSecondaryAbilitiesAreArrays() {
        if (!this.system.secondaryAbilities) return;
        
        ['talents', 'skills', 'knowledges'].forEach(category => {
            const abilities = this.system.secondaryAbilities[category];
            
            // If not an array (corrupted by form processing), convert it back
            if (!Array.isArray(abilities)) {
                console.warn(`Secondary ${category} was not an array, attempting to recover data`);
                if (abilities && typeof abilities === 'object') {
                    // Convert object back to array format
                    this.system.secondaryAbilities[category] = Object.values(abilities).filter(a => a && a.name);
                } else {
                    this.system.secondaryAbilities[category] = [];
                }
            }
        });
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

    /**
     * ====================
     * COMBAT CALCULATIONS
     * ====================
     */

    /**
     * Get initiative value for this actor
     * Standard WoD: Dexterity + Wits + bonus
     * @returns {number} Initiative value
     */
    getInitiative() {
        const dexterity = Number(this._findAttributeValue("Dexterity")) || 0;
        const wits = Number(this._findAttributeValue("Wits")) || 0;
        const bonus = Number(this.system.combat?.initiativeBonus) || 0;
        return dexterity + wits + bonus;
    }

    /**
     * Roll initiative and update combat tracker if in combat
     * @param {Object} options - Options for the roll
     * @returns {Roll} The initiative roll
     */
    async rollInitiative(options = {}) {
        const initiativeValue = this.getInitiative();
        // Roll 1d10 + initiative value
        const roll = new Roll(`1d10 + ${initiativeValue}`);
        await roll.evaluate();
        
        // Show roll in chat
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: `Initiative Roll (Base: ${initiativeValue})`
        });
        
        // If in combat, update combatant
        const combatant = game.combat?.combatants.find(c => c.actorId === this.id);
        if (combatant) {
            await game.combat.setInitiative(combatant.id, roll.total);
        }
        
        return roll;
    }

    /**
     * Get soak value for this actor
     * Standard WoD: Stamina (+ Fortitude for vampires, armor, etc.)
     * @returns {number} Soak value
     */
    getSoak() {
        const stamina = Number(this._findAttributeValue("Stamina")) || 0;
        // Future: Add Fortitude for vampires, armor, etc.
        return stamina;
    }

    /**
     * Get all speed values for this actor
     * @returns {Object} Speed values in yards
     */
    getSpeed() {
        const dex = Number(this._findAttributeValue("Dexterity")) || 0;
        
        return {
            walking: 7,
            jogging: 12 + dex,
            running: 20 + (3 * dex),
            swimming: {
                unskilled: 8 + dex,
                skilled: 12 + dex
            },
            flying: {
                min: 10,
                max: 20
            },
            climbing: {
                // Returns formula for yards based on successes
                normal: (successes) => 3.3 * successes,
                optimal: (successes) => 5.6 * successes,
                poor: (successes) => 1.6 * successes
            }
        };
    }

    /**
     * Convenience getter for walking speed
     * @returns {number} Walking speed in yards
     */
    getWalkingSpeed() { 
        return 7; 
    }

    /**
     * Convenience getter for jogging speed
     * @returns {number} Jogging speed in yards
     */
    getJoggingSpeed() { 
        return 12 + (Number(this._findAttributeValue("Dexterity")) || 0); 
    }

    /**
     * Convenience getter for running speed
     * @returns {number} Running speed in yards
     */
    getRunningSpeed() { 
        return 20 + (3 * (Number(this._findAttributeValue("Dexterity")) || 0)); 
    }

    /**
     * ====================
     * EXPERIENCE POINTS
     * ====================
     */

    /**
     * Add experience points to this actor
     * @param {number} amount - Amount of XP to add
     * @param {string} reason - Optional reason for the XP award
     * @returns {Promise<void>}
     */
    async addExperience(amount, reason = "") {
        const current = this.system.experience.current || 0;
        const total = this.system.experience.total || 0;
        
        await this.update({
            'system.experience.current': current + amount,
            'system.experience.total': total + amount
        });
        
        // Future: Add to log with timestamp and reason
    }

    /**
     * Spend experience points from this actor
     * @param {number} amount - Amount of XP to spend
     * @param {string} reason - Optional reason for spending
     * @returns {Promise<boolean>} True if successful, false if not enough XP
     */
    async spendExperience(amount, reason = "") {
        const current = this.system.experience.current || 0;
        if (current < amount) {
            ui.notifications.warn("Not enough experience points!");
            return false;
        }
        
        await this.update({
            'system.experience.current': current - amount
        });
        
        // Future: Add to spending log
        return true;
    }

    /**
     * Calculate XP cost for trait advancement
     * @param {string} trait - Type of trait (attribute, ability, background, etc.)
     * @param {number} currentValue - Current value
     * @param {number} targetValue - Target value
     * @returns {number} XP cost
     */
    getExperienceCost(trait, currentValue, targetValue) {
        // Future: Implement WoD XP costs (attributes, abilities, backgrounds, etc.)
        // For now, stub for architecture
        return 0;
    }

    /**
     * Roll a simple trait (willpower, virtue, attribute, ability)
     * @param {string} traitName - Name of the trait being rolled
     * @param {number} traitValue - Value of the trait (dice pool size)
     * @param {Object} options - Roll options (difficulty, specialty, modifiers)
     * @returns {Object} Roll result
     */
    async rollTrait(traitName, traitValue, options = {}) {
        const difficulty = options.difficulty || 6;
        const specialty = options.specialty || false;
        const modifiers = options.modifiers || [];
        
        const dicePool = new WodDicePool(traitValue, difficulty, { specialty, modifiers });
        const result = await dicePool.roll();
        
        // Format and send to chat
        await this._sendRollToChat(traitName, result, {
            rollType: 'Trait Roll',
            specialty
        });
        
        return result;
    }

    /**
     * Roll a dice pool (attribute + ability, or multiple traits)
     * @param {string} poolName - Name of the pool (e.g., "Dexterity + Firearms")
     * @param {number} poolSize - Total dice pool size
     * @param {Object} options - Roll options
     * @returns {Object} Roll result
     */
    async rollPool(poolName, poolSize, options = {}) {
        const difficulty = options.difficulty || 6;
        const specialty = options.specialty || false;
        const modifiers = options.modifiers || [];
        
        const dicePool = new WodDicePool(poolSize, difficulty, { specialty, modifiers });
        const result = await dicePool.roll();
        
        await this._sendRollToChat(poolName, result, {
            rollType: 'Dice Pool',
            traits: options.traits,
            specialty
        });
        
        return result;
    }

    /**
     * Roll soak (Stamina)
     * @param {number} incomingDamage - Amount of incoming damage
     * @param {Object} options - Roll options
     * @returns {Object} Roll result
     */
    async rollSoak(incomingDamage = 0, options = {}) {
        const soakValue = this.getSoak();
        const difficulty = options.difficulty || 6;
        
        const dicePool = new WodDicePool(soakValue, difficulty, { modifiers: options.modifiers || [] });
        const result = await dicePool.roll();
        
        await this._sendRollToChat('Soak', result, {
            rollType: 'Soak Roll',
            incomingDamage,
            soaked: Math.min(result.successes, incomingDamage)
        });
        
        return result;
    }

    /**
     * Roll damage
     * @param {number} baseDamage - Base damage dice pool
     * @param {Object} options - Roll options
     * @returns {Object} Roll result
     */
    async rollDamage(baseDamage, options = {}) {
        const difficulty = options.difficulty || 6;
        
        const dicePool = new WodDicePool(baseDamage, difficulty, { modifiers: options.modifiers || [] });
        const result = await dicePool.roll();
        
        await this._sendRollToChat('Damage', result, {
            rollType: 'Damage Roll',
            damageType: options.damageType || 'bashing'
        });
        
        return result;
    }

    /**
     * Send roll result to chat with formatted template
     * @param {string} rollName - Name of the roll
     * @param {Object} result - Roll result from WodDicePool
     * @param {Object} options - Additional options for chat message
     * @private
     */
    async _sendRollToChat(rollName, result, options = {}) {
        const templateData = {
            rollName,
            ...result,
            ...options,
            actor: this
        };
        
        // Use namespaced renderTemplate for custom roll card
        const html = await foundry.applications.handlebars.renderTemplate(
            'systems/wodsystem/templates/dice/roll-card.html',
            templateData
        );
        
        // Send to chat - toMessage() automatically triggers Dice So Nice! if installed
        await result.roll.toMessage({
            speaker: ChatMessage.getSpeaker({actor: this}),
            flavor: `<div class="wod-roll-flavor">${rollName} - ${options.rollType || 'Roll'}</div>` + html
        });
    }

    /**
     * Save a roll template for quick access
     * @param {Object} template - Template data
     */
    async saveRollTemplate(template) {
        // Ensure rollTemplates is always an array (Foundry sometimes converts empty arrays to objects)
        const rollTemplates = this.system.rollTemplates || [];
        const templates = Array.isArray(rollTemplates) ? rollTemplates : Object.values(rollTemplates);
        templates.push({
            id: foundry.utils.randomID(),
            name: template.name,
            traits: template.traits,
            difficulty: template.difficulty,
            specialty: template.specialty,
            modifiers: template.modifiers
        });
        await this.update({ 'system.rollTemplates': templates });
        ui.notifications.info(`Saved roll template: ${template.name}`);
    }

    /**
     * Execute a saved roll template
     * @param {string} templateId - ID of the template to execute
     */
    async executeTemplate(templateId) {
        // Ensure rollTemplates is always an array (Foundry sometimes converts empty arrays to objects)
        const rollTemplates = this.system.rollTemplates || [];
        const templates = Array.isArray(rollTemplates) ? rollTemplates : Object.values(rollTemplates);
        const template = templates.find(t => t.id === templateId);
        if (!template) return;
        
        // Calculate current pool from saved traits
        let totalPool = 0;
        for (const trait of template.traits) {
            const value = this._findAttributeValue(trait.name) || 
                         this._findAbilityValue(trait.name) || 
                         trait.value;
            totalPool += value;
        }
        
        await this.rollPool(template.name, totalPool, {
            difficulty: template.difficulty,
            specialty: template.specialty,
            modifiers: template.modifiers,
            traits: template.traits
        });
    }

    /**
     * Delete a roll template
     * @param {string} templateId - ID of the template to delete
     */
    async deleteRollTemplate(templateId) {
        // Ensure rollTemplates is always an array (Foundry sometimes converts empty arrays to objects)
        const rollTemplates = this.system.rollTemplates || [];
        const templatesArray = Array.isArray(rollTemplates) ? rollTemplates : Object.values(rollTemplates);
        const templates = templatesArray.filter(t => t.id !== templateId);
        await this.update({ 'system.rollTemplates': templates });
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