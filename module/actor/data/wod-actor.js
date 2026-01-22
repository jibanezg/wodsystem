import { TraitFactory } from "../scripts/trait-factory.js";
import { WodDicePool } from "../../dice/wod-dice-pool.js";
import { i18n } from "../../helpers/i18n.js";

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
            
            // Get the new values (or keep current if not changed)
            // Ensure values are numbers (Foundry sometimes stores as strings)
            const newPermanent = parseInt(willpowerChanges.permanent ?? currentWillpower.permanent);
            const newTemporary = parseInt(willpowerChanges.temporary ?? currentWillpower.temporary);
            
            // Constrain temporary willpower to not exceed permanent
            if (newTemporary > newPermanent) {
                changed.system.miscellaneous.willpower.temporary = newPermanent;
                ui.notifications.warn(i18n('WODSYSTEM.Actor.TemporaryWillpowerExceed'));
            }
        }
        
        // CRITICAL: Protect backgrounds from being accidentally deleted or set to invalid values
        if (changed.system?.miscellaneous?.backgrounds !== undefined) {
            const newBackgrounds = changed.system.miscellaneous.backgrounds;
            const currentBackgrounds = this.system.miscellaneous?.backgrounds || [];
            
            // If the update is trying to set backgrounds to null, undefined, or non-array, preserve current
            if (!Array.isArray(newBackgrounds)) {
                // Check if this might be from an external module (like Active Token Effects) that sends full objects
                // Only log warning if it's not a plain object (which external modules often send)
                const isPlainObject = newBackgrounds !== null && 
                                     typeof newBackgrounds === 'object' && 
                                     newBackgrounds.constructor === Object &&
                                     Object.keys(newBackgrounds).length > 0;
                
                if (!isPlainObject) {
                    console.warn(`Actor ${this.name} (${this.id}): Attempted to update backgrounds to invalid type (${typeof newBackgrounds}), preserving current backgrounds`);
                }
                // Silently fix it regardless of source
                changed.system.miscellaneous.backgrounds = currentBackgrounds;
            }
            // If the update is trying to clear all backgrounds without explicit intent, log it
            else if (newBackgrounds.length === 0 && currentBackgrounds.length > 0) {
                console.warn(`Actor ${this.name} (${this.id}): Backgrounds being cleared (had ${currentBackgrounds.length} entries). If this was unintentional, check for pagination or form submission issues.`);
            }
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
        
        // Migrate abilities between categories if needed (preserves values)
        this._migrateAbilitiesBetweenCategories();
        
        // Ensure secondary abilities stay as arrays (fix Foundry form corruption)
        this._ensureSecondaryAbilitiesAreArrays();
        
        // Ensure merits and flaws are arrays (fix Foundry form corruption)
        this._ensureMeritsFlawsAreArrays();
        
        // Ensure biography data is properly structured (fix corrupted data)
        this._ensureBiographyData();
        
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
        // CRITICAL: Never allow backgrounds to be null or undefined - always default to empty array
        if (!Array.isArray(this.system.miscellaneous.backgrounds)) {
            console.warn(`Actor ${this.name} (${this.id}): backgrounds was not an array (was ${typeof this.system.miscellaneous.backgrounds}), resetting to empty array`);
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
     * Migrate abilities to match the current template structure
     * - Moves abilities between categories (preserves values)
     * - Removes obsolete abilities (no longer in template)
     * - Adds missing abilities (from template, with value 0)
     */
    _migrateAbilitiesBetweenCategories() {
        if (!this.system.abilities) return;
        
        // Get the template abilities structure from M20/abilities.md
        // Order matters - this matches the exact order in datasource/M20/abilities.md
        // Format: { category: [ordered list of ability names] }
        const templateOrder = {
            skills: ["Crafts", "Drive", "Etiquette", "Firearms", "Martial Arts", "Meditation", "Melee", "Research", "Stealth", "Survival", "Technology"],
            talents: ["Alertness", "Art", "Athletics", "Awareness", "Brawl", "Empathy", "Expression", "Intimidation", "Leadership", "Streetwise", "Subterfuge"],
            knowledges: ["Academics", "Computer", "Cosmology", "Enigmas", "Esoterica", "Investigation", "Law", "Medicine", "Occult", "Politics", "Science"]
        };
        
        // Create template object from ordered list (for compatibility)
        const template = {};
        for (const [category, abilityList] of Object.entries(templateOrder)) {
            template[category] = {};
            for (const abilityName of abilityList) {
                template[category][abilityName] = 0;
            }
        }
        
        // Define ability migrations (abilities that moved between categories)
        const abilityMigrations = {
            "Technology": { from: "knowledges", to: "skills" },
        };
        
        // Define obsolete abilities (to be removed - no longer in template)
        const obsoleteAbilities = {
            "skills": ["Animal Ken", "Larceny", "Performance"],
            "knowledges": ["Finance"]
        };
        
        let hasChanges = false;
        const updates = {};
        
        // Step 1: Move abilities between categories
        for (const [abilityName, migration] of Object.entries(abilityMigrations)) {
            const { from, to } = migration;
            
            if (this.system.abilities[from] && 
                this.system.abilities[from][abilityName] !== undefined) {
                
                const value = this.system.abilities[from][abilityName];
                
                if (!this.system.abilities[to]) {
                    this.system.abilities[to] = {};
                }
                
                if (this.system.abilities[to][abilityName] === undefined) {
                    this.system.abilities[to][abilityName] = value;
                    
                    if (!updates[from]) {
                        updates[from] = {};
                    }
                    updates[from][abilityName] = null; // null means delete
                    
                    hasChanges = true;
                    console.log(`WoD System | Migrated ability "${abilityName}" from ${from} to ${to} (value: ${value})`);
                } else {
                    if (!updates[from]) {
                        updates[from] = {};
                    }
                    updates[from][abilityName] = null;
                    hasChanges = true;
                    console.log(`WoD System | Removed ability "${abilityName}" from ${from} (already exists in ${to})`);
                }
            }
        }
        
        // Step 2: Remove obsolete abilities
        for (const [category, obsoleteList] of Object.entries(obsoleteAbilities)) {
            if (this.system.abilities[category]) {
                for (const abilityName of obsoleteList) {
                    if (this.system.abilities[category][abilityName] !== undefined) {
                        if (!updates[category]) {
                            updates[category] = {};
                        }
                        updates[category][abilityName] = null;
                        hasChanges = true;
                        console.log(`WoD System | Removed obsolete ability "${abilityName}" from ${category}`);
                    }
                }
            }
        }
        
        // Step 3: Add missing abilities from template (with value 0)
        // This ensures all template abilities exist, even if they were accidentally removed
        for (const [category, templateAbilities] of Object.entries(template)) {
            if (!this.system.abilities[category]) {
                this.system.abilities[category] = {};
            }
            
            for (const abilityName in templateAbilities) {
                // Always ensure template abilities exist - add if missing
                if (this.system.abilities[category][abilityName] === undefined) {
                    this.system.abilities[category][abilityName] = 0;
                    hasChanges = true;
                    console.log(`WoD System | Added missing ability "${abilityName}" to ${category}`);
                }
            }
        }
        
        // Apply updates if any changes were made
        if (hasChanges) {
            for (const [category, abilities] of Object.entries(updates)) {
                for (const [abilityName, value] of Object.entries(abilities)) {
                    if (value === null && this.system.abilities[category]) {
                        delete this.system.abilities[category][abilityName];
                    }
                }
            }
        }
        
        // Always ensure all template abilities exist (even if no changes were made)
        // This is a safety net in case abilities were removed elsewhere
        for (const [category, templateAbilities] of Object.entries(template)) {
            if (!this.system.abilities[category]) {
                this.system.abilities[category] = {};
            }
            for (const abilityName in templateAbilities) {
                if (this.system.abilities[category][abilityName] === undefined) {
                    this.system.abilities[category][abilityName] = 0;
                }
            }
        }
        
        // Step 4: Reorder abilities to match M20/abilities.md order
        // This preserves existing values but ensures correct order
        for (const [category, orderedAbilities] of Object.entries(templateOrder)) {
            if (this.system.abilities[category]) {
                const currentAbilities = this.system.abilities[category];
                const reordered = {};
                
                // First, add abilities in the correct order (preserving existing values)
                for (const abilityName of orderedAbilities) {
                    if (currentAbilities[abilityName] !== undefined) {
                        reordered[abilityName] = currentAbilities[abilityName];
                    } else {
                        reordered[abilityName] = 0;
                    }
                }
                
                // Then, add any remaining abilities that aren't in the template (secondary/custom abilities)
                for (const abilityName in currentAbilities) {
                    if (!reordered[abilityName] && !template[category][abilityName]) {
                        reordered[abilityName] = currentAbilities[abilityName];
                    }
                }
                
                // Only update if order changed
                const currentKeys = Object.keys(currentAbilities);
                const reorderedKeys = Object.keys(reordered);
                if (JSON.stringify(currentKeys) !== JSON.stringify(reorderedKeys)) {
                    this.system.abilities[category] = reordered;
                    hasChanges = true;
                    console.log(`WoD System | Reordered abilities in ${category} to match M20/abilities.md`);
                }
            }
        }
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
     * Ensure biography data is properly structured (fix corrupted or missing data)
     * Prevents [object Object] errors when rendering biography image
     */
    _ensureBiographyData() {
        if (!this.system.biography) {
            this.system.biography = {
                age: "",
                sex: "",
                height: "",
                weight: "",
                eyes: "",
                hair: "",
                nationality: "",
                backstory: "",
                notes: "",
                image: ""
            };
        }
        
        // Ensure image is always a string (prevents [object Object] error in templates)
        if (this.system.biography.image && typeof this.system.biography.image !== 'string') {
            console.warn(`Biography image was not a string (was ${typeof this.system.biography.image}), clearing it`);
            this.system.biography.image = "";
        }
        
        // Ensure all biography fields exist (for actors upgraded from older versions)
        const bioFields = ['age', 'sex', 'height', 'weight', 'eyes', 'hair', 'nationality', 'backstory', 'notes', 'image'];
        for (const field of bioFields) {
            if (this.system.biography[field] === undefined) {
                this.system.biography[field] = "";
            }
        }
        
        // For Technocrats, ensure focus structure exists
        if (this.type === "Technocrat") {
            if (!this.system.biography.focus) {
                this.system.biography.focus = {
                    paradigm: "",
                    instruments: ["", "", "", "", "", "", ""],
                    practices: ""
                };
            }
            // Ensure instruments is an array
            if (!Array.isArray(this.system.biography.focus.instruments)) {
                this.system.biography.focus.instruments = ["", "", "", "", "", "", ""];
            }
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
                return parseInt(this.system.attributes[category][attributeName]) || 0;
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
                return parseInt(this.system.abilities[category][abilityName]) || 0;
            }
        }
        
        // Check secondary abilities
        if (this.system.secondaryAbilities) {
            for (const category in this.system.secondaryAbilities) {
                const abilities = this.system.secondaryAbilities[category];
                if (Array.isArray(abilities)) {
                    const found = abilities.find(a => a.name === abilityName);
                    if (found) return parseInt(found.value) || 0;
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
     * Healing logic: bottom-to-top, heals last marked level first (prevents gaps)
     * Example: If Bruised, Hurt, Injured are marked → heals Injured first
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
            ui.notifications.warn(i18n('WODSYSTEM.Actor.CannotRemoveLastHealthLevel'));
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
     * CORRECT LOGIC: Fill empty boxes first, maintain hierarchy (most serious on top)
     * When full: ANY new damage pushes lowest priority off, which upgrades another of its type
     * Example: 4 Agg + 3 Lethal (full), +1 Bashing = 5 Agg + 2 Lethal
     * @private
     */
    _addDamage(health, damageType) {
        const newPriority = this._getDamagePriority(damageType);
        
        // Step 1: Check if there are empty boxes
        let emptyIndex = health.levels.findIndex(level => !level.marked);
        
        if (emptyIndex !== -1) {
            // Add the new damage to the first empty box
            health.levels[emptyIndex].marked = true;
            health.levels[emptyIndex].damageType = damageType;
            
            // Re-sort to maintain damage hierarchy (most serious first)
            this._sortDamageByPriority(health.levels);
            return;
        }
        
        // Step 2: All boxes are full - OVERFLOW occurs
        // Strategy: Find an instance of the SAME type being added, upgrade it
        // If no same type exists, find the NEXT MORE SERIOUS type and upgrade it
        // Special case: if same type is already max (aggravated), find less serious type to upgrade
        
        // First, try to find an instance of the SAME damage type
        let sameTypeIndex = health.levels.findIndex(level => 
            level.marked && level.damageType === damageType
        );
        
        if (sameTypeIndex !== -1) {
            // Found same type - but check if it can be upgraded
            const upgraded = this._upgradeDamageType(damageType);
            
            if (upgraded !== damageType) {
                // Can be upgraded (bashing → lethal, lethal → aggravated)
                health.levels[sameTypeIndex].damageType = upgraded;
            } else {
                // Already at max (aggravated → aggravated, no change)
                // Find a less serious type to upgrade instead
                const lessSeriousType = this._getLessSeriousType(damageType);
                
                if (lessSeriousType) {
                    const lessSeriousIndex = health.levels.findIndex(level => 
                        level.marked && level.damageType === lessSeriousType
                    );
                    
                    if (lessSeriousIndex !== -1) {
                        health.levels[lessSeriousIndex].damageType = this._upgradeDamageType(lessSeriousType);
                    } else {
                        // Check even less serious type
                        const evenLessSeriousType = this._getLessSeriousType(lessSeriousType);
                        if (evenLessSeriousType) {
                            const evenLessIndex = health.levels.findIndex(level => 
                                level.marked && level.damageType === evenLessSeriousType
                            );
                            if (evenLessIndex !== -1) {
                                health.levels[evenLessIndex].damageType = this._upgradeDamageType(evenLessSeriousType);
                            } else {
                                ui.notifications.warn(i18n('WODSYSTEM.Actor.CannotApplyMoreDamage'));
                                return;
                            }
                        } else {
                            ui.notifications.warn("Cannot apply more damage - all health levels at maximum");
                            return;
                        }
                    }
                } else {
                    ui.notifications.warn(i18n('WODSYSTEM.Actor.CannotApplyMoreAggravated'));
                    return;
                }
            }
        } else {
            // No same type found - find the next more serious type and upgrade it
            // For bashing (1): look for lethal (2)
            // For lethal (2): look for aggravated (3)
            // For aggravated (3): can't upgrade further, all maxed out
            
            const nextSeriousType = this._getNextMoreSeriousType(damageType);
            
            if (nextSeriousType) {
                // Find an instance of the next more serious type
                const nextTypeIndex = health.levels.findIndex(level => 
                    level.marked && level.damageType === nextSeriousType
                );
                
                if (nextTypeIndex !== -1) {
                    // Upgrade the next more serious type
                    health.levels[nextTypeIndex].damageType = this._upgradeDamageType(nextSeriousType);
                } else {
                    // Next serious type not found either - check even more serious
                    // This handles: 4 Agg + 3 Lethal, +1 Bashing (no Bashing or Lethal to upgrade, so check Agg)
                    const evenMoreSeriousType = this._getNextMoreSeriousType(nextSeriousType);
                    if (evenMoreSeriousType) {
                        const evenMoreIndex = health.levels.findIndex(level => 
                            level.marked && level.damageType === evenMoreSeriousType
                        );
                        if (evenMoreIndex !== -1) {
                            health.levels[evenMoreIndex].damageType = this._upgradeDamageType(evenMoreSeriousType);
                        } else {
                            ui.notifications.warn("Cannot apply more damage - all health levels at maximum");
                            return;
                        }
                    } else {
                        ui.notifications.warn("Cannot apply more damage - all health levels at maximum");
                        return;
                    }
                }
            } else {
                // Trying to add aggravated when all is already aggravated
                ui.notifications.warn("Cannot apply more damage - all health levels at maximum aggravated damage");
                return;
            }
        }
        
        // Re-sort after push and upgrade
        this._sortDamageByPriority(health.levels);
        return;
    }
    
    /**
     * Get the lowest priority damage type currently in the health track
     * @private
     */
    _getLowestPriorityDamage(levels) {
        let lowestPriority = 999;
        let lowestType = null;
        
        for (const level of levels) {
            if (level.marked) {
                const priority = this._getDamagePriority(level.damageType);
                if (priority < lowestPriority) {
                    lowestPriority = priority;
                    lowestType = level.damageType;
                }
            }
        }
        
        return lowestType;
    }
    
    /**
     * Sort health levels by damage priority (most serious first)
     * Preserves the original index, name, penalty - only reorders damageType and marked status
     * @private
     */
    _sortDamageByPriority(levels) {
        // Extract damage info (damageType, marked) from each level
        const damageData = levels.map(level => ({
            damageType: level.damageType,
            marked: level.marked
        }));
        
        // Sort by priority (aggravated → lethal → bashing → empty)
        damageData.sort((a, b) => {
            const priorityA = a.marked ? this._getDamagePriority(a.damageType) : -1;
            const priorityB = b.marked ? this._getDamagePriority(b.damageType) : -1;
            return priorityB - priorityA; // Descending (highest priority first)
        });
        
        // Apply sorted damage back to levels (preserving index, name, penalty)
        levels.forEach((level, i) => {
            level.damageType = damageData[i].damageType;
            level.marked = damageData[i].marked;
        });
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
     * Get the next more serious damage type
     * @private
     */
    _getNextMoreSeriousType(currentType) {
        if (currentType === "bashing") return "lethal";
        if (currentType === "lethal") return "aggravated";
        return null; // aggravated is already max
    }

    /**
     * Get the next less serious damage type
     * @private
     */
    _getLessSeriousType(currentType) {
        if (currentType === "aggravated") return "lethal";
        if (currentType === "lethal") return "bashing";
        return null; // bashing is already minimum
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
     * Heal one damage from bottom to top (prevents gaps)
     * @private
     */
    _healOneDamage(health) {
        // Direction: bottom to top (Incapacitated → ... → Injured → Hurt → Bruised)
        // Always heal the last marked level to avoid gaps
        // Example: If Bruised, Hurt, Injured are marked, heal Injured first
        
        // Find last marked level from bottom
        for (let i = health.levels.length - 1; i >= 0; i--) {
            if (health.levels[i].marked) {
                // Found the last marked level, clear it
                health.levels[i].marked = false;
                health.levels[i].damageType = null;
                return;
            }
        }
    }

    /**
     * Heal specific damage type from bottom to top (prevents gaps)
     * @private
     */
    _healSpecificType(health, damageType) {
        // Heal from bottom to top, finding the last instance of the specified type
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
            ui.notifications.warn(i18n('WODSYSTEM.Actor.NotEnoughExperience'));
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
        ui.notifications.info(i18n('WODSYSTEM.Actor.SavedRollTemplate', {name: template.name}));
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
            // Ensure value is parsed as integer to prevent string concatenation
            totalPool += parseInt(value) || 0;
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
        console.log("🔵 WOD | _onCreate called for:", this.name, "| isCreated:", this.system.isCreated);
        // Create a duplicate of the actor data
        const actorData = foundry.utils.duplicate(this);
        
        // Check if traits need to be created
        if (!actorData.system.isCreated) {
            const factory = new TraitFactory();
            await factory.createAllTraits(this);
            // Note: isCreated flag is now managed by the Character Creation Wizard
            // Don't auto-set it to true here - let the wizard do it when character is finalized
            // await this.update({ "system.isCreated": true });
            console.log("🟢 WOD | Traits created, isCreated NOT changed");
        } else {
            console.log("🟡 WOD | Actor already created, skipping trait creation");
        }
        
        await super._onCreate(data, options, user);
        console.log("✅ WOD | _onCreate complete | Final isCreated:", this.system.isCreated);
    }
} 