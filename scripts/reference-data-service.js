/**
 * Reference Data Service
 * Provides reference data (archetypes, etc.) with abstraction for future microservice integration
 */
export class ReferenceDataService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get archetypes for Nature/Demeanor dropdowns
     * @returns {Promise<Array<string>>} Array of archetype names
     */
    async getArchetypes() {
        // Check cache first
        if (this.cache.has('archetypes')) {
            return this.cache.get('archetypes');
        }

        // Current implementation: Load from local JSON
        const archetypes = await this._loadArchetypesFromLocal();
        
        // Future implementation: Replace with microservice call
        // const archetypes = await this._loadArchetypesFromAPI();
        
        this.cache.set('archetypes', archetypes);
        return archetypes;
    }

    /**
     * Load archetypes from local configuration file
     * @private
     */
    async _loadArchetypesFromLocal() {
        try {
            const response = await fetch("systems/wodsystem/config/archetypes.json");
            if (!response.ok) {
                throw new Error(`Failed to load archetypes: ${response.status}`);
            }
            const data = await response.json();
            return data.archetypes;
        } catch (error) {
            console.error("ReferenceDataService: Error loading archetypes:", error);
            return []; // Return empty array on error
        }
    }

    /**
     * Load archetypes from microservice API (future implementation)
     * @private
     */
    async _loadArchetypesFromAPI() {
        // Future implementation example:
        // const response = await fetch(`${CONFIG.microserviceUrl}/api/reference-data/archetypes`);
        // const data = await response.json();
        // return data.archetypes;
        throw new Error("API integration not yet implemented");
    }

    /**
     * Get backgrounds for Backgrounds dropdown
     * Merges base backgrounds with creature-specific additions
     * @param {string} creatureType - The creature type (e.g., "Mortal", "Technocrat", "Vampire")
     * @returns {Promise<Array<string>>} Array of background names
     */
    async getBackgrounds(creatureType) {
        // Check cache first (per creature type)
        const cacheKey = `backgrounds_${creatureType}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Current implementation: Load from local JSON and merge
        const backgrounds = await this._loadBackgroundsFromLocal(creatureType);
        
        // Future implementation: Replace with microservice call
        // const backgrounds = await this._loadBackgroundsFromAPI(creatureType);
        
        this.cache.set(cacheKey, backgrounds);
        return backgrounds;
    }

    /**
     * Load backgrounds from local configuration file
     * Merges base + creature-specific backgrounds
     * @param {string} creatureType - The creature type
     * @private
     */
    async _loadBackgroundsFromLocal(creatureType) {
        try {
            const response = await fetch("systems/wodsystem/config/backgrounds.json");
            if (!response.ok) {
                throw new Error(`Failed to load backgrounds: ${response.status}`);
            }
            const data = await response.json();
            
            // Merge base + creature-specific
            const baseList = data.base || [];
            const creatureAdditions = data.creatureSpecific[creatureType] || [];
            
            // Combine and ensure "Custom" is at the end
            const combined = [...baseList, ...creatureAdditions];
            const customIndex = combined.indexOf("Custom");
            if (customIndex > -1) {
                combined.splice(customIndex, 1);
                combined.push("Custom");
            }
            
            return combined;
        } catch (error) {
            console.error("ReferenceDataService: Error loading backgrounds:", error);
            return ["Custom"]; // Return at least Custom on error
        }
    }

    /**
     * Load backgrounds from microservice API (future implementation)
     * @param {string} creatureType - The creature type
     * @private
     */
    async _loadBackgroundsFromAPI(creatureType) {
        // Future implementation example:
        // const response = await fetch(`${CONFIG.microserviceUrl}/api/reference-data/backgrounds/${creatureType}`);
        // const data = await response.json();
        // return data.backgrounds;
        throw new Error("API integration not yet implemented");
    }

    /**
     * Clear the cache (useful for testing or when data needs to be refreshed)
     */
    clearCache() {
        this.cache.clear();
    }
}

// Create global singleton instance
window.ReferenceDataService = ReferenceDataService;
window.referenceDataService = new ReferenceDataService();

