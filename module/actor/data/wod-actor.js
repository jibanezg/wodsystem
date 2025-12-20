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