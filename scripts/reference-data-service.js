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
     * @returns {Promise<Array<string>>} Array of background names
     */
    async getBackgrounds() {
        // Check cache first
        if (this.cache.has('backgrounds')) {
            return this.cache.get('backgrounds');
        }

        // Current implementation: Load from local JSON
        const backgrounds = await this._loadBackgroundsFromLocal();
        
        // Future implementation: Replace with microservice call
        // const backgrounds = await this._loadBackgroundsFromAPI();
        
        this.cache.set('backgrounds', backgrounds);
        return backgrounds;
    }

    /**
     * Load backgrounds from local configuration file
     * @private
     */
    async _loadBackgroundsFromLocal() {
        try {
            const response = await fetch("systems/wodsystem/config/backgrounds.json");
            if (!response.ok) {
                throw new Error(`Failed to load backgrounds: ${response.status}`);
            }
            const data = await response.json();
            return data.backgrounds;
        } catch (error) {
            console.error("ReferenceDataService: Error loading backgrounds:", error);
            return []; // Return empty array on error
        }
    }

    /**
     * Load backgrounds from microservice API (future implementation)
     * @private
     */
    async _loadBackgroundsFromAPI() {
        // Future implementation example:
        // const response = await fetch(`${CONFIG.microserviceUrl}/api/reference-data/backgrounds`);
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

