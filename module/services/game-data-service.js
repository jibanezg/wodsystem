import { Trie } from './trie.js';
import { ARCHETYPES, getArchetypesForActorType } from '../character-creation/wizard-config.js';

/**
 * GameDataService - Central service for managing game data by source and creature type
 * 
 * This service organizes data by source (M20, D20) and provides type-aware access methods.
 * It does NOT enforce validation rules - those are handled by wizard-config and validation.js.
 * 
 * Data Sources:
 * - M20: Mage: The Ascension 20th Anniversary (Mage, Technocrat, Mortal)
 * - D20: Demon: The Fallen 20th Anniversary (Demon, Earthbound)
 * 
 * The service automatically selects the appropriate data source based on actor type.
 */
export class GameDataService {
    constructor() {
        // Organize data by source to avoid conflicts
        this.data = {
            // M20 data (Mage, Technocrat, Mortal)
            m20: {
                merits: [],
                flaws: [],
                backgrounds: [],
                abilities: [],
                spheres: [],
                charms: [],
                sAdvantages: [],
                affinities: null
            },
            // D20 data (Demon, Earthbound)
            d20: {
                merits: [],
                flaws: [],
                backgrounds: [],
                apocalypticForms: [],
                lorePaths: [],
                houses: []
            },
            // Shared/common data
            shared: {
                attributes: []
            }
        };
        
        this.trieIndices = {};
        this.initialized = false;
    }

    /**
     * Initialize the service by loading all reference data
     */
    async initialize() {
        try {
            // Load M20 data
            await this.loadM20MeritsFlaws();
            await this.loadM20Backgrounds();
            await this.loadM20Spheres();
            await this.loadM20Charms();
            await this.loadM20SAdvantages();
            await this.loadM20Affinities();
            
            // Load D20 data (non-critical - won't break initialization if it fails)
            try {
                await this.loadD20MeritsFlaws();
            } catch (d20Error) {
                this.data.d20.merits = [];
                this.data.d20.flaws = [];
            }
            try {
                await this.loadD20Backgrounds();
            } catch (d20Error) {
                this.data.d20.backgrounds = [];
            }
            try {
                await this.loadD20ApocalypticForms();
            } catch (d20Error) {
                this.data.d20.apocalypticForms = [];
            }
            try {
                await this.loadD20LorePaths();
            } catch (loreError) {
                this.data.d20.lorePaths = [];
            }
            try {
                await this.loadD20Houses();
            } catch (housesError) {
                this.data.d20.houses = [];
            }
            
            try {
                this.buildTrieIndices();
            } catch (trieError) {
                this.trieIndices = {
                    m20MeritsFlaws: new Trie(),
                    d20MeritsFlaws: new Trie(),
                    charms: new Trie(),
                    sAdvantages: new Trie()
                };
            }
            this.initialized = true;
        } catch (error) {
            if (!this.trieIndices || Object.keys(this.trieIndices).length === 0) {
                this.trieIndices = {
                    m20MeritsFlaws: new Trie(),
                    d20MeritsFlaws: new Trie(),
                    charms: new Trie(),
                    sAdvantages: new Trie()
                };
            }
            this.initialized = true;
        }
    }

    /**
     * Load M20 merits and flaws from JSON
     */
    async loadM20MeritsFlaws() {
        try {
            const response = await fetch('systems/wodsystem/datasource/M20/merits_flaws.json');
            if (!response.ok) {
                throw new Error(`Failed to load M20 merits_flaws.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.m20.merits = data.merits || [];
            this.data.m20.flaws = data.flaws || [];
            
        } catch (error) {
            this.data.m20.merits = [];
            this.data.m20.flaws = [];
        }
    }

    /**
     * Load D20 merits and flaws from JSON
     */
    async loadD20MeritsFlaws() {
        try {
            const response = await fetch('systems/wodsystem/datasource/D20/merits_flaws.json');
            if (!response.ok) {
                throw new Error(`Failed to load D20 merits_flaws.json: ${response.statusText}`);
            }
            const data = await response.json();
            
            if (data.merits && Array.isArray(data.merits)) {
                this.data.d20.merits = data.merits;
            } else {
                this.data.d20.merits = [];
            }
            
            if (data.flaws && Array.isArray(data.flaws)) {
                this.data.d20.flaws = data.flaws;
            } else {
                this.data.d20.flaws = [];
            }
            
        } catch (error) {
            this.data.d20.merits = [];
            this.data.d20.flaws = [];
            throw error;
        }
    }

    /**
     * Load M20 backgrounds from JSON
     */
    async loadM20Backgrounds() {
        try {
            const response = await fetch('systems/wodsystem/datasource/M20/backgrounds.json');
            if (!response.ok) {
                throw new Error(`Failed to load M20 backgrounds.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.m20.backgrounds = Array.isArray(data?.backgrounds) ? data.backgrounds : [];
            
        } catch (error) {
            this.data.m20.backgrounds = [];
        }
    }

    /**
     * Load D20 backgrounds from JSON
     */
    async loadD20Backgrounds() {
        try {
            const response = await fetch('systems/wodsystem/datasource/D20/backgrounds.json');
            if (!response.ok) {
                throw new Error(`Failed to load D20 backgrounds.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.d20.backgrounds = Array.isArray(data?.backgrounds) ? data.backgrounds : [];
            
        } catch (error) {
            this.data.d20.backgrounds = [];
            throw error;
        }
    }

    /**
     * Load D20 apocalyptic forms from JSON
     */
    async loadD20ApocalypticForms() {
        try {
            const response = await fetch('systems/wodsystem/datasource/D20/apocalyptic_forms.json');
            if (!response.ok) {
                throw new Error(`Failed to load D20 apocalyptic_forms.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.d20.apocalypticForms = Array.isArray(data && data.apocalypticForms) ? data.apocalypticForms : [];
            
        } catch (error) {
            this.data.d20.apocalypticForms = [];
            throw error;
        }
    }

    /**
     * Load M20 spheres from JSON
     */
    async loadM20Spheres() {
        try {
            const response = await fetch('systems/wodsystem/datasource/M20/spheres.json');
            if (!response.ok) {
                throw new Error(`Failed to load M20 spheres.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.m20.spheres = Array.isArray(data?.spheres) ? data.spheres : [];
            
        } catch (error) {
            this.data.m20.spheres = [];
        }
    }

    /**
     * Load M20 charms from JSON
     */
    async loadM20Charms() {
        try {
            const response = await fetch('systems/wodsystem/datasource/M20/charms.json');
            if (!response.ok) {
                throw new Error(`Failed to load M20 charms.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.m20.charms = Array.isArray(data?.charms) ? data.charms : [];
            
        } catch (error) {
            this.data.m20.charms = [];
        }
    }

    /**
     * Load M20 s-advantages from JSON
     */
    async loadM20SAdvantages() {
        try {
            const response = await fetch('systems/wodsystem/datasource/M20/s-advantages.json');
            if (!response.ok) {
                throw new Error(`Failed to load M20 s-advantages.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.m20.sAdvantages = Array.isArray(data?.advantages) ? data.advantages : [];
            
        } catch (error) {
            this.data.m20.sAdvantages = [];
        }
    }

    /**
     * Load M20 affinities from JSON
     */
    async loadM20Affinities() {
        try {
            const response = await fetch('systems/wodsystem/datasource/M20/affinities.json');
            if (!response.ok) {
                throw new Error(`Failed to load M20 affinities.json: ${response.statusText}`);
            }
            
            this.data.m20.affinities = await response.json();
            
        } catch (error) {
            this.data.m20.affinities = null;
        }
    }

    /**
     * Determine which data source to use based on actor type
     * @param {string} actorType - Actor type (e.g., "Demon", "Mage", "Technocrat")
     * @returns {string} Data source key: "d20" for Demon/Earthbound, "m20" for others
     */
    _getDataSourceForActorType(actorType) {
        if (!actorType) return 'm20'; // Default to M20
        
        const normalized = actorType.toLowerCase();
        // D20 sources: Demon, Earthbound
        if (normalized === 'demon' || normalized === 'earthbound' || normalized.startsWith('demon')) {
            return 'd20';
        }
        // M20 sources: Mage, Technocrat, Mortal, Spirit, etc.
        return 'm20';
    }

    /**
     * Get affinity spheres for a tradition or convention
     * @param {string} name - Tradition or convention name
     * @param {string} type - "tradition", "convention", or "disparateCraft"
     * @returns {Array<string>} Array of affinity sphere keys
     */
    getAffinitySpheres(name, type = "tradition") {
        if (!this.data.m20.affinities) return [];
        
        const category = type === "convention" ? "conventions" : 
                        type === "disparateCraft" ? "disparateCrafts" : 
                        "traditions";
        
        const entry = this.data.m20.affinities[category]?.[name];
        if (!entry) return [];
        
        // Handle "any" case - return all standard sphere keys
        if (entry.affinitySpheres.includes("any")) {
            // Return all standard sphere keys (consistent with wizard config)
            return ["correspondence", "entropy", "forces", "life", "matter", "mind", "prime", "spirit", "time"];
        }
        
        return entry.affinitySpheres || [];
    }

    /**
     * Get all apocalyptic forms (D20)
     * @returns {Array} All apocalyptic forms
     */
    getApocalypticForms() {
        try {
            if (!this.initialized || !this.data || !this.data.d20) return [];
            return Array.isArray(this.data.d20.apocalypticForms) ? [...this.data.d20.apocalypticForms] : [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Get apocalyptic form by ID (D20)
     * @param {string} id - Apocalyptic form ID
     * @returns {object|null} Apocalyptic form or null
     */
    getApocalypticFormById(id) {
        if (!this.initialized || !id) return null;
        return Array.isArray(this.data.d20.apocalypticForms)
            ? this.data.d20.apocalypticForms.find(form => form && form.id === id) || null
            : null;
    }

    /**
     * Get visage options for dropdown selection (D20)
     * @returns {Array} Array of {id, name} objects
     */
    getVisageOptions() {
        if (!this.initialized || !this.data.d20.apocalypticForms) {
            return [];
        }
        
        return this.data.d20.apocalypticForms
            .filter(form => form && form.id && form.name)
            .map(form => ({
                id: form.id,
                name: form.name
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get apocalyptic form by name (case-insensitive) (D20)
     * @param {string} name - Apocalyptic form name
     * @returns {object|null} Apocalyptic form or null
     */
    getApocalypticFormByName(name) {
        if (!this.initialized || !name) return null;
        // Ensure name is a string
        if (typeof name !== 'string') {
            name = String(name);
        }
        const normalized = name.trim().toLowerCase();
        return Array.isArray(this.data.d20.apocalypticForms)
            ? this.data.d20.apocalypticForms.find(form => form && form.name && form.name.toLowerCase() === normalized) || null
            : null;
    }

    /**
     * Get all apocalyptic forms as a sorted list of names (D20)
     * @param {string} house - Optional house name to filter by
     * @returns {Array} Array of apocalyptic form names
     */
    getApocalypticFormsList(house = null) {
        if (!this.initialized || !this.data || !this.data.d20) return [];
        
        const forms = Array.isArray(this.data.d20.apocalypticForms) ? this.data.d20.apocalypticForms : [];
        
        // Filter by house if provided
        if (house && typeof house === 'string') {
            const houseLower = house.toLowerCase();
            return forms
                .filter(form => form && form.house && typeof form.house === 'string' && form.house.toLowerCase() === houseLower)
                .map(form => (form && form.name) ? form.name : '')
                .filter(name => name && name.length > 0)
                .sort((a, b) => a.localeCompare(b));
        }
        
        return forms
            .map(form => (form && form.name) ? form.name : '')
            .filter(name => name && name.length > 0)
            .sort((a, b) => a.localeCompare(b));
    }
    
    /**
     * Load D20 lore paths from JSON
     */
    async loadD20LorePaths() {
        try {
            const response = await fetch('systems/wodsystem/datasource/D20/lore.json');
            if (!response.ok) {
                throw new Error(`Failed to load D20 lore.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.d20.lorePaths = Array.isArray(data && data.lorePaths) ? data.lorePaths : [];
            
        } catch (error) {
            this.data.d20.lorePaths = [];
        }
    }
    
    /**
     * Get all lore paths
     * @returns {Array} Array of lore path objects
     */
    getLorePaths() {
        if (!this.initialized) return [];
        return Array.isArray(this.data.d20.lorePaths) ? [...this.data.d20.lorePaths] : [];
    }
    
    /**
     * Get lore path by ID (D20)
     * @param {string} id - Lore path ID
     * @returns {Object|null} Lore path object or null if not found
     */
    getLorePathById(id) {
        if (!this.initialized || !id) return null;
        return Array.isArray(this.data.d20.lorePaths)
            ? this.data.d20.lorePaths.find(lore => lore && lore.id === id) || null
            : null;
    }

    /**
     * Build trie indices for fast searching
     */
    buildTrieIndices() {
        // Build separate tries for M20 and D20 merits/flaws
        this.trieIndices.m20MeritsFlaws = new Trie();
        this.trieIndices.d20MeritsFlaws = new Trie();
        
        let m20Indexed = 0;
        let d20Indexed = 0;
        
        // Index M20 merits
        for (const merit of this.data.m20.merits) {
            // Index by name
            this.trieIndices.m20MeritsFlaws.insert(merit.name, merit);
            m20Indexed++;
            
            // Index by search terms
            if (merit.searchTerms && Array.isArray(merit.searchTerms)) {
                merit.searchTerms.forEach(term => {
                    this.trieIndices.m20MeritsFlaws.insert(term, merit);
                });
            }
            
            // Index by keywords
            if (merit.keywords && Array.isArray(merit.keywords)) {
                merit.keywords.forEach(keyword => {
                    this.trieIndices.m20MeritsFlaws.insert(keyword, merit);
                });
            }
        }
        
        // Index M20 flaws
        for (const flaw of this.data.m20.flaws) {
            if (!flaw || !flaw.name) {
                continue;
            }
            // Index by name
            this.trieIndices.m20MeritsFlaws.insert(flaw.name, flaw);
            m20Indexed++;
            
            // Index by search terms
            if (flaw.searchTerms && Array.isArray(flaw.searchTerms)) {
                flaw.searchTerms.forEach(term => {
                    this.trieIndices.m20MeritsFlaws.insert(term, flaw);
                });
            }
            
            // Index by keywords
            if (flaw.keywords && Array.isArray(flaw.keywords)) {
                flaw.keywords.forEach(keyword => {
                    this.trieIndices.m20MeritsFlaws.insert(keyword, flaw);
                });
            }
        }
        
        // Index D20 merits
        for (const merit of this.data.d20.merits) {
            if (!merit || !merit.name) {
                continue;
            }
            // Index by name
            this.trieIndices.d20MeritsFlaws.insert(merit.name, merit);
            d20Indexed++;
            
            // Index by search terms
            if (merit.searchTerms && Array.isArray(merit.searchTerms)) {
                merit.searchTerms.forEach(term => {
                    this.trieIndices.d20MeritsFlaws.insert(term, merit);
                });
            }
            
            // Index by keywords
            if (merit.keywords && Array.isArray(merit.keywords)) {
                merit.keywords.forEach(keyword => {
                    this.trieIndices.d20MeritsFlaws.insert(keyword, merit);
                });
            }
        }
        
        // Index D20 flaws
        for (const flaw of this.data.d20.flaws) {
            if (!flaw || !flaw.name) {
                continue;
            }
            // Index by name
            this.trieIndices.d20MeritsFlaws.insert(flaw.name, flaw);
            d20Indexed++;
            
            // Index by search terms
            if (flaw.searchTerms && Array.isArray(flaw.searchTerms)) {
                flaw.searchTerms.forEach(term => {
                    this.trieIndices.d20MeritsFlaws.insert(term, flaw);
                });
            }
            
            // Index by keywords
            if (flaw.keywords && Array.isArray(flaw.keywords)) {
                flaw.keywords.forEach(keyword => {
                    this.trieIndices.d20MeritsFlaws.insert(keyword, flaw);
                });
            }
        }
        
        // Build trie for charms
        this.trieIndices.charms = new Trie();
        for (const charm of this.data.m20.charms) {
            if (!charm || !charm.name) {
                continue;
            }
            this.trieIndices.charms.insert(charm.name, charm);
            if (charm.searchTerms && Array.isArray(charm.searchTerms)) {
                charm.searchTerms.forEach(term => {
                    this.trieIndices.charms.insert(term, charm);
                });
            }
            if (charm.keywords && Array.isArray(charm.keywords)) {
                charm.keywords.forEach(keyword => {
                    this.trieIndices.charms.insert(keyword, charm);
                });
            }
        }
        
        // Build trie for s-advantages
        this.trieIndices.sAdvantages = new Trie();
        for (const advantage of this.data.m20.sAdvantages) {
            if (!advantage || !advantage.name) {
                continue;
            }
            this.trieIndices.sAdvantages.insert(advantage.name, advantage);
            if (advantage.searchTerms && Array.isArray(advantage.searchTerms)) {
                advantage.searchTerms.forEach(term => {
                    this.trieIndices.sAdvantages.insert(term, advantage);
                });
            }
            if (advantage.keywords && Array.isArray(advantage.keywords)) {
                advantage.keywords.forEach(keyword => {
                    this.trieIndices.sAdvantages.insert(keyword, advantage);
                });
            }
        }
        
        const totalItems = this.data.m20.merits.length + this.data.m20.flaws.length + 
                          this.data.d20.merits.length + this.data.d20.flaws.length +
                          this.data.m20.charms.length + this.data.m20.sAdvantages.length;
    }

    /**
     * Search for merits/flaws using trie-based prefix matching
     * @param {string} query - Search query
     * @param {object} options - Filter options (category, type, cost range, actorType)
     * @returns {Array} Matching items
     */
    search(query, options = {}) {
        try {
            if (!this.initialized || !query) {
                // Silently return empty array if not initialized or no query
                return [];
            }
            
            const { category, type, minCost, maxCost, actorType } = options;
            
            // Determine which trie to use based on actor type
            const dataSource = this._getDataSourceForActorType(actorType);
            const trieKey = dataSource === 'd20' ? 'd20MeritsFlaws' : 'm20MeritsFlaws';
            const trie = this.trieIndices[trieKey];
            
            if (!trie) {
                return [];
            }
            
            // Get trie results
            let results = trie.search(query);
        
        // Remove duplicates (same item may match multiple search terms)
        const uniqueResults = Array.from(new Set(results.map(r => r?.id).filter(Boolean)))
            .map(id => results.find(r => r?.id === id))
            .filter(Boolean);
        
        // Apply filters
        let filtered = uniqueResults;
        
        if (category) {
            filtered = filtered.filter(r => r && r.category === category);
        }
        
        if (type) {
            filtered = filtered.filter(r => r && r.type === type);
        }
        
        // Filter by actor type (mage, technocrat, demon, earthbound, or both)
        if (actorType) {
            const normalizedActorType = actorType.toLowerCase();
            filtered = filtered.filter(r => {
                if (!r) return false;
                const availableTo = r.availableTo || 'both';
                if (availableTo === 'both') return true;
                // Handle D20 actor types
                if (normalizedActorType === 'demon' || normalizedActorType === 'earthbound') {
                    return availableTo === 'demon' || availableTo === 'earthbound' || availableTo === 'both';
                }
                // Handle M20 actor types
                return availableTo === normalizedActorType || availableTo === 'both';
            });
        }
        
        if (minCost !== undefined) {
            filtered = filtered.filter(r => {
                if (!r || r.cost === undefined || r.cost === null) return false;
                const costs = Array.isArray(r.cost) ? r.cost : [r.cost];
                return costs.length > 0 && Math.min(...costs) >= minCost;
            });
        }
        
        if (maxCost !== undefined) {
            filtered = filtered.filter(r => {
                if (!r || r.cost === undefined || r.cost === null) return false;
                const costs = Array.isArray(r.cost) ? r.cost : [r.cost];
                return costs.length > 0 && Math.max(...costs) <= maxCost;
            });
        }
        return filtered;
        } catch (error) {
            return [];
        }
    }

    /**
     * Get item by exact name match (case-insensitive)
     * @param {string} name - Exact name to match
     * @param {string} category - Optional category filter ('Merit' or 'Flaw')
     * @param {string} actorType - Optional actor type to determine data source
     * @returns {object|null} Matching item or null
     */
    getByName(name, category = null, actorType = null) {
        try {
            if (!this.initialized || !name) {
                return null;
            }
            
            const normalized = name.trim().toLowerCase();
            const dataSource = this._getDataSourceForActorType(actorType);
            
            let items = [];
            if (dataSource === 'd20') {
                items = [...this.data.d20.merits, ...this.data.d20.flaws];
                if (category) {
                    items = category === 'Merit' ? this.data.d20.merits : this.data.d20.flaws;
                }
            } else {
                items = [...this.data.m20.merits, ...this.data.m20.flaws];
                if (category) {
                    items = category === 'Merit' ? this.data.m20.merits : this.data.m20.flaws;
                }
            }
            
            return items.find(item => item && item.name && item.name.toLowerCase() === normalized) || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get merit by ID
     * @param {string} id - Merit ID
     * @param {string} actorType - Optional actor type to determine data source
     * @returns {object|null} Merit or null
     */
    getMerit(id, actorType = null) {
        const dataSource = this._getDataSourceForActorType(actorType);
        if (dataSource === 'd20') {
            return Array.isArray(this.data.d20.merits) ? this.data.d20.merits.find(m => m && m.id === id) || null : null;
        }
        return Array.isArray(this.data.m20.merits) ? this.data.m20.merits.find(m => m && m.id === id) || null : null;
    }

    /**
     * Get flaw by ID
     * @param {string} id - Flaw ID
     * @param {string} actorType - Optional actor type to determine data source
     * @returns {object|null} Flaw or null
     */
    getFlaw(id, actorType = null) {
        const dataSource = this._getDataSourceForActorType(actorType);
        if (dataSource === 'd20') {
            return Array.isArray(this.data.d20.flaws) ? this.data.d20.flaws.find(f => f && f.id === id) || null : null;
        }
        return Array.isArray(this.data.m20.flaws) ? this.data.m20.flaws.find(f => f && f.id === id) || null : null;
    }

    /**
     * Search for charms using trie-based prefix matching
     * @param {string} query - Search query
     * @returns {Array} Matching charms
     */
    searchCharms(query) {
        if (!this.initialized || !query || !this.trieIndices.charms) return [];
        
        let results = this.trieIndices.charms.search(query);
        const uniqueResults = Array.from(new Set(results.map(r => r.id)))
            .map(id => results.find(r => r.id === id));
        
        return uniqueResults;
    }

    /**
     * Get charm by ID
     * @param {string} id - Charm ID
     * @returns {object|null} Charm or null
     */
    getCharm(id) {
        return Array.isArray(this.data.m20.charms) ? this.data.m20.charms.find(c => c && c.id === id) || null : null;
    }

    /**
     * Get charm by name (case-insensitive)
     * @param {string} name - Charm name
     * @returns {object|null} Charm or null
     */
    getCharmByName(name) {
        if (!this.initialized || !name) return null;
        const normalized = name.trim().toLowerCase();
        return Array.isArray(this.data.m20.charms)
            ? this.data.m20.charms.find(c => c && c.name && c.name.toLowerCase() === normalized) || null
            : null;
    }

    /**
     * Get all charms as a sorted list
     * @returns {Array} Array of charm names
     */
    getCharmsList() {
        if (!this.initialized) return [];
        return Array.isArray(this.data.m20.charms)
            ? this.data.m20.charms
                .map(c => c && c.name ? c.name : '')
                .filter(name => name && name.length > 0)
                .sort((a, b) => a.localeCompare(b))
            : [];
    }

    /**
     * Search for s-advantages using trie-based prefix matching
     * @param {string} query - Search query
     * @returns {Array} Matching s-advantages
     */
    searchSAdvantages(query) {
        if (!this.initialized || !query || !this.trieIndices.sAdvantages) return [];
        
        let results = this.trieIndices.sAdvantages.search(query);
        const uniqueResults = Array.from(new Set(results.map(r => r.id)))
            .map(id => results.find(r => r.id === id));
        
        return uniqueResults;
    }

    /**
     * Get s-advantage by ID
     * @param {string} id - S-Advantage ID
     * @returns {object|null} S-Advantage or null
     */
    getSAdvantage(id) {
        return Array.isArray(this.data.m20.sAdvantages) ? this.data.m20.sAdvantages.find(a => a && a.id === id) || null : null;
    }

    /**
     * Get s-advantage by name (case-insensitive)
     * @param {string} name - S-Advantage name
     * @returns {object|null} S-Advantage or null
     */
    getSAdvantageByName(name) {
        if (!this.initialized || !name) return null;
        const normalized = name.trim().toLowerCase();
        return Array.isArray(this.data.m20.sAdvantages)
            ? this.data.m20.sAdvantages.find(a => a && a.name && a.name.toLowerCase() === normalized) || null
            : null;
    }

    /**
     * Get all s-advantages as a sorted list
     * @returns {Array} Array of s-advantage names
     */
    getSAdvantagesList() {
        if (!this.initialized) return [];
        return Array.isArray(this.data.m20.sAdvantages)
            ? this.data.m20.sAdvantages
                .map(a => a && a.name ? a.name : '')
                .filter(name => name && name.length > 0)
                .sort((a, b) => a.localeCompare(b))
            : [];
    }

    /**
     * Generate HTML for tooltip display
     * @param {object} item - Merit/flaw item
     * @returns {string} HTML string
     */
    generateTooltipHTML(item) {
        if (!item) return '';
        
        const categoryClass = item.category.toLowerCase();
        // Show full description in tooltip
        const description = item.description;
        
        return `
            <div class="reference-tooltip-inner">
                <h4>${item.name} <span class="cost">(${item.costDescription})</span></h4>
                <span class="type-badge ${categoryClass}">${item.type} ${item.category}</span>
                <p class="description">${description}</p>
                ${item.gameEffects ? `<p class="game-effects"><strong>Effects:</strong> ${item.gameEffects}</p>` : ''}
                <div class="tooltip-footer">
                    <button class="post-to-chat-btn" data-action="post-to-chat">
                        <i class="fas fa-comment"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get all merits
     * @returns {Array} All merits
     */
    getAllMerits() {
        return Array.isArray(this.data.m20.merits) ? [...this.data.m20.merits] : [];
    }

    /**
     * Get all flaws
     * @returns {Array} All flaws
     */
    getAllFlaws() {
        return Array.isArray(this.data.m20.flaws) ? [...this.data.m20.flaws] : [];
    }

    /**
     * Get merits by type
     * @param {string} type - Type (Physical, Mental, Social, Supernatural)
     * @returns {Array} Matching merits
     */
    getMeritsByType(type) {
        return Array.isArray(this.data.m20.merits) ? this.data.m20.merits.filter(m => m && m.type === type) : [];
    }

    /**
     * Get flaws by type
     * @param {string} type - Type (Physical, Mental, Social, Supernatural)
     * @returns {Array} Matching flaws
     */
    getFlawsByType(type) {
        return Array.isArray(this.data.m20.flaws) ? this.data.m20.flaws.filter(f => f && f.type === type) : [];
    }

    /**
     * Get background by name (case-insensitive)
     * @param {string} name - Background name
     * @returns {object|null} Background data or null
     */
    getBackgroundByName(name, actorType = null) {
        if (!this.initialized || !name) return null;
        
        const normalized = name.trim().toLowerCase();
        const dataSource = this._getDataSourceForActorType(actorType);
        
        // Check the appropriate data source first
        if (dataSource === 'd20') {
            const d20Bg = Array.isArray(this.data.d20.backgrounds) 
                ? this.data.d20.backgrounds.find(bg => bg && bg.name && bg.name.toLowerCase() === normalized) 
                : null;
            if (d20Bg) return d20Bg;
            // Fallback to M20 if not found in D20
        }
        
        // Check M20 backgrounds
        return Array.isArray(this.data.m20.backgrounds)
            ? this.data.m20.backgrounds.find(bg => bg && bg.name && bg.name.toLowerCase() === normalized) || null
            : null;
    }

    /**
     * Get all backgrounds as a sorted list, optionally filtered by actor type
     * @param {string} actorType - Optional actor type filter (e.g., "Technocrat", "Mage")
     * @returns {Array} Array of background names
     */
    getBackgroundsList(actorType = null) {
        try {
            if (!this.initialized || !this.data) return [];
            
            // Determine which data source to use based on actor type
            const dataSource = this._getDataSourceForActorType(actorType);
            let backgrounds = [];
            
            if (dataSource === 'd20') {
                backgrounds = Array.isArray(this.data.d20 && this.data.d20.backgrounds) ? this.data.d20.backgrounds : [];
            } else {
                backgrounds = Array.isArray(this.data.m20 && this.data.m20.backgrounds) ? this.data.m20.backgrounds : [];
            }
            
            // Filter by actor type if provided (validation happens here, but rules are in wizard-config)
            if (actorType) {
                const normalizedActorType = actorType.toLowerCase();
                backgrounds = backgrounds.filter(bg => {
                    try {
                        if (!bg || typeof bg !== 'object') return false;
                        const availableTo = bg.availableTo || 'both';
                        
                        // Handle string values
                        if (typeof availableTo === 'string') {
                            return availableTo === 'both' || availableTo === normalizedActorType;
                        }
                        
                        // Handle array values (e.g., ["demon", "earthbound"])
                        if (Array.isArray(availableTo)) {
                            return availableTo.includes(normalizedActorType) || availableTo.includes('both');
                        }
                        
                        // Default to 'both' if unknown format
                        return true;
                    } catch (e) {
                        return false;
                    }
                });
            }
            
            // Return sorted list of ORIGINAL names (not translated)
            // Translation happens in templates using translateRef helper
            // This ensures matching works correctly (value="original" but display="translated")
            return backgrounds
                .map(bg => {
                    try {
                        // Ensure we always return a string, not an object
                        const name = bg && typeof bg === 'object' ? bg.name : bg;
                        return typeof name === 'string' ? name : String(name || '');
                    } catch (e) {
                        return '';
                    }
                })
                .filter(name => name && name.length > 0) // Filter out empty strings
                .sort((a, b) => {
                    try {
                        return a.localeCompare(b);
                    } catch (e) {
                        return 0;
                    }
                });
        } catch (error) {
            return [];
        }
    }

    /**
     * Check if a background has double cost
     * @param {string} name - Background name
     * @param {string} actorType - Actor type for data source selection
     * @returns {boolean} True if background costs 2 points per dot
     */
    isDoubleCostBackground(name, actorType = null) {
        if (!this.initialized || !name) return false;
        
        const background = this.getBackgroundByName(name, actorType);
        return background ? (background.doubleCost === true) : false;
    }

    /**
     * Generate HTML for background tooltip display
     * @param {object} background - Background item
     * @returns {string} HTML string
     */
    generateBackgroundTooltipHTML(background) {
        if (!background) return '';
        
        // Show full description (no truncation)
        const description = background.description;
        
        const maxRating = background.maxRating || 5;
        const doubleCostNote = background.doubleCost ? ' (2 pts/dot)' : '';
        const canExceedNote = background.canExceedFive ? ` (max ${maxRating})` : '';
        
        return `
            <div class="reference-tooltip-inner">
                <h4>${background.name} <span class="cost">Background${doubleCostNote}${canExceedNote}</span></h4>
                <span class="type-badge background">Background</span>
                <p class="description">${description}</p>
                ${background.costLevels && background.costLevels.length > 0 ? `
                    <div class="cost-levels-preview">
                        <strong>Levels:</strong>
                        <ul>
                            ${background.costLevels.map(level => 
                                `<li><strong>${level.label}</strong> ${level.description}</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
                <div class="tooltip-footer">
                    <button class="post-to-chat-btn" type="button" title="Post full details to chat">
                        <i class="fas fa-comment-dots"></i>
                    </button>
                    <span class="tooltip-hint-text">Post to chat</span>
                </div>
            </div>
        `;
    }

    /**
     * Get sphere by name (case-insensitive)
     * @param {string} name - Sphere name
     * @returns {object|null} Sphere data or null
     */
    getSphereByName(name) {
        if (!this.initialized || !name) return null;
        
        const normalized = name.trim().toLowerCase();
        return Array.isArray(this.data.m20.spheres)
            ? this.data.m20.spheres.find(sphere => sphere && sphere.name && sphere.name.toLowerCase() === normalized) || null
            : null;
    }

    /**
     * Get sphere by ID
     * @param {string} id - Sphere ID
     * @returns {object|null} Sphere data or null
     */
    getSphereById(id) {
        if (!this.initialized || !id) return null;
        
        const normalized = id.trim().toLowerCase();
        return Array.isArray(this.data.m20.spheres)
            ? this.data.m20.spheres.find(sphere => sphere && sphere.id && sphere.id.toLowerCase() === normalized) || null
            : null;
    }

    /**
     * Get all spheres
     * @returns {Array} All spheres
     */
    getAllSpheres() {
        return Array.isArray(this.data.m20.spheres) ? [...this.data.m20.spheres] : [];
    }

    /**
     * Generate HTML for sphere tooltip display (shows all 5 levels)
     * @param {object} sphere - Sphere data
     * @returns {string} HTML string
     */
    generateSphereTooltipHTML(sphere) {
        if (!sphere) return '';
        
        const subtitle = sphere.subtitle ? `<p class="sphere-subtitle">${sphere.subtitle}</p>` : '';
        
        // Generate levels HTML with individual post buttons
        const levelsHTML = sphere.levels.map(level => `
            <div class="sphere-level-entry">
                <div class="level-header">
                    <strong class="level-dots">${level.label}</strong>
                    <strong class="level-title">${level.title}</strong>
                    <button class="post-level-btn" type="button" 
                            data-action="post-level" 
                            data-level="${level.dots}" 
                            title="Post this level to chat">
                        <i class="fas fa-comment"></i>
                    </button>
                </div>
                <div class="level-description">${level.description}</div>
            </div>
        `).join('');
        
        return `
            <div class="reference-tooltip-inner wod-sphere-tooltip">
                <h4>${sphere.name}</h4>
                ${subtitle}
                <div class="sphere-description">${sphere.description}</div>
                <div class="sphere-levels">
                    <h5>Sphere Levels</h5>
                    ${levelsHTML}
                </div>
                <div class="tooltip-footer">
                    <button class="post-description-btn" type="button" 
                            data-action="post-description" 
                            title="Post full description to chat">
                        <i class="fas fa-comment-dots"></i> Post Description
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Generate HTML for sphere special table tooltip
     * @param {object} sphere - Sphere data
     * @returns {string} HTML string
     */
    generateSphereTableTooltipHTML(sphere) {
        if (!sphere || !sphere.specialTable) return '';
        
        const table = sphere.specialTable;
        
        // Generate table HTML
        let tableHTML = `<table class="sphere-special-table">`;
        
        // Add header if available
        if (table.headers && table.headers.length > 0) {
            tableHTML += '<thead><tr>';
            table.headers.forEach(header => {
                tableHTML += `<th>${header}</th>`;
            });
            tableHTML += '</tr></thead>';
        }
        
        // Add rows
        tableHTML += '<tbody>';
        if (table.rows && table.rows.length > 0) {
            table.rows.forEach(row => {
                tableHTML += '<tr>';
                // Handle rows that might be objects with column keys
                if (typeof row === 'object') {
                    Object.values(row).forEach(cell => {
                        tableHTML += `<td>${cell}</td>`;
                    });
                } else {
                    tableHTML += `<td>${row}</td>`;
                }
                tableHTML += '</tr>';
            });
        }
        tableHTML += '</tbody></table>';
        
        // Add footnotes if available
        let footnotesHTML = '';
        if (table.footnotes && table.footnotes.length > 0) {
            footnotesHTML = `<div class="table-footnotes">
                ${table.footnotes.map(note => `<p class="footnote">${note}</p>`).join('')}
            </div>`;
        }
        
        return `
            <div class="reference-tooltip-inner wod-sphere-table-tooltip">
                <h4>${table.title || sphere.name + ' Table'}</h4>
                <div class="table-container">
                    ${tableHTML}
                </div>
                ${footnotesHTML}
            </div>
        `;
    }

    /**
     * Generate HTML for sphere chat card
     * @param {object} sphere - Sphere data
     * @param {object} options - Options { type: 'description'|'level'|'table', levelNumber: number }
     * @returns {string} HTML string
     */
    generateSphereChatHTML(sphere, options = {}) {
        if (!sphere) return '';
        
        const { type = 'description', levelNumber = null } = options;
        
        if (type === 'level' && levelNumber) {
            // Post specific level
            const level = sphere.levels.find(l => l.dots === levelNumber);
            if (!level) return '';
            
            return `
                <div class="wod-sphere-reference-card sphere-level-card">
                    <div class="sphere-header">
                        <h3>${sphere.name}</h3>
                        ${sphere.subtitle ? `<p class="sphere-subtitle">${sphere.subtitle}</p>` : ''}
                    </div>
                    <div class="sphere-level-detail">
                        <div class="level-rank">Rank ${level.dots}</div>
                        <h4>${level.title}</h4>
                        <p>${level.description}</p>
                    </div>
                </div>
            `;
        } else if (type === 'table' && sphere.specialTable) {
            // Post special table
            const table = sphere.specialTable;
            
            let tableHTML = `<table class="sphere-special-table">`;
            
            if (table.headers && table.headers.length > 0) {
                tableHTML += '<thead><tr>';
                table.headers.forEach(header => {
                    tableHTML += `<th>${header}</th>`;
                });
                tableHTML += '</tr></thead>';
            }
            
            tableHTML += '<tbody>';
            if (table.rows && table.rows.length > 0) {
                table.rows.forEach(row => {
                    tableHTML += '<tr>';
                    if (typeof row === 'object') {
                        Object.values(row).forEach(cell => {
                            tableHTML += `<td>${cell}</td>`;
                        });
                    } else {
                        tableHTML += `<td>${row}</td>`;
                    }
                    tableHTML += '</tr>';
                });
            }
            tableHTML += '</tbody></table>';
            
            let footnotesHTML = '';
            if (table.footnotes && table.footnotes.length > 0) {
                footnotesHTML = `<div class="table-footnotes">
                    ${table.footnotes.map(note => `<p class="footnote">${note}</p>`).join('')}
                </div>`;
            }
            
            return `
                <div class="wod-sphere-reference-card sphere-table-card">
                    <div class="sphere-header">
                        <h3>${sphere.name}</h3>
                        <h4>${table.title || sphere.name + ' Table'}</h4>
                    </div>
                    <div class="table-container">
                        ${tableHTML}
                    </div>
                    ${footnotesHTML}
                </div>
            `;
        } else {
            // Post only the main description (no levels)
            return `
                <div class="wod-sphere-reference-card sphere-description-card">
                    <div class="sphere-header">
                        <h3>${sphere.name}</h3>
                        ${sphere.subtitle ? `<p class="sphere-subtitle">${sphere.subtitle}</p>` : ''}
                    </div>
                    <div class="sphere-description">
                        ${sphere.description}
                    </div>
                </div>
            `;
        }
    }

    /**
     * Get all available archetypes (Nature/Demeanor)
     * Returns the complete list including Book of Secrets archetypes
     * Filters out banned archetypes for Earthbound
     * @param {string} actorType - Optional actor type to filter archetypes
     * @returns {Array} Array of archetype names
     */
    getArchetypes(actorType = null) {
        try {
            // Use the helper function from wizard-config to ensure consistency
            if (typeof getArchetypesForActorType === 'function') {
                return getArchetypesForActorType(actorType || "") || [];
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Load D20 houses from JSON
     */
    async loadD20Houses() {
        try {
            const response = await fetch('systems/wodsystem/datasource/D20/houses.json');
            if (!response.ok) {
                throw new Error(`Failed to load D20 houses.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.d20.houses = Array.isArray(data?.houses) ? data.houses : [];
            
        } catch (error) {
            this.data.d20.houses = [];
            throw error;
        }
    }

    /**
     * Get initial torment for a house
     * @param {string} houseName - Name of the house
     * @returns {number} Initial torment value, or 0 if house not found
     */
    getInitialTormentForHouse(houseName) {
        if (!houseName || !this.data.d20.houses || this.data.d20.houses.length === 0) {
            return 0;
        }
        
        const house = this.data.d20.houses.find(h => 
            h.name && h.name.toLowerCase() === houseName.toLowerCase()
        );
        
        return house?.initialTorment || 0;
    }

    /**
     * Generate HTML for lore tooltip display
     * @param {object} lore - Lore path item
     * @returns {string} HTML string
     */
    generateLoreTooltipHTML(lore) {
        if (!lore) return '';
        
        const houseInfo = lore.house ? `<span class="type-badge lore-house">${lore.house}</span>` : '';
        
        // Helper function to generate dots like spheres
        const generateDots = (level) => {
            const dots = '●';
            const empty = '○';
            return dots.repeat(level) + empty.repeat(5 - level);
        };
        
        // Show system information if available
        const systemInfo = lore.system ? `
            <div class="lore-system">
                <strong>System:</strong> ${lore.system}
            </div>
        ` : '';
        
        // Show evocations as a simple list like background levels, but with dots like spheres
        const evocationsHTML = lore.evocations && lore.evocations.length > 0 ? `
            <div class="lore-evocations">
                <strong>Evocations:</strong>
                <ul>
                    ${lore.evocations.map(evocation => `
                        <li>
                            <strong>${generateDots(evocation.level || 1)} ${evocation.name}</strong>
                            ${evocation.system ? `: ${evocation.system}` : ''}
                            ${evocation.torment ? `<br><strong>Torment:</strong> ${evocation.torment}` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';
        
        return `
            <div class="reference-tooltip-inner">
                <h4>${lore.name}</h4>
                ${houseInfo}
                ${lore.description ? `<p class="description">${lore.description}</p>` : ''}
                ${systemInfo}
                ${evocationsHTML}
                <div class="tooltip-footer">
                    <button class="post-to-chat-btn" data-action="post-to-chat" title="Post full details to chat">
                        <i class="fas fa-comment-dots"></i>
                    </button>
                    <span class="tooltip-hint-text">Post to chat</span>
                </div>
            </div>
        `;
    }

    /**
     * Generate HTML for lore chat message
     * @param {object} lore - Lore path item
     * @param {object} options - Options for generation (type, evocationNumber)
     * @returns {string} HTML string for chat message
     */
    generateLoreChatHTML(lore, options = {}) {
        if (!lore) return '';
        
        const { type = 'full', evocationNumber = null } = options;
        const houseInfo = lore.house ? `<span class="type-badge lore-house">${lore.house}</span>` : '';
        
        let content = `
            <div class="wod-chat-lore">
                <h3>${lore.name} ${houseInfo}</h3>
        `;
        
        if (type === 'description' || type === 'full') {
            if (lore.description) {
                content += `<p><strong>Description:</strong> ${lore.description}</p>`;
            }
            if (lore.system) {
                content += `<div class="lore-system-chat">
                    <strong>System:</strong> ${lore.system}
                </div>`;
            }
        }
        
        if (type === 'evocation' && evocationNumber !== null) {
            const evocation = lore.evocations?.[evocationNumber];
            if (evocation) {
                content += `
                    <div class="evocation-chat">
                        <h4>${evocation.name} (Level ${evocation.level})</h4>
                        ${evocation.system ? `<p><strong>System:</strong> ${evocation.system}</p>` : ''}
                        ${evocation.torment ? `<p><strong>Torment:</strong> ${evocation.torment}</p>` : ''}
                    </div>
                `;
            }
        } else if (type === 'full' && lore.evocations) {
            content += `<h4>Evocations:</h4>`;
            lore.evocations.forEach(evocation => {
                content += `
                    <div class="evocation-chat">
                        <h5>${evocation.name} (Level ${evocation.level})</h5>
                        ${evocation.system ? `<p><strong>System:</strong> ${evocation.system}</p>` : ''}
                        ${evocation.torment ? `<p><strong>Torment:</strong> ${evocation.torment}</p>` : ''}
                    </div>
                `;
            });
        }
        
        content += `</div>`;
        return content;
    }
}

// Export alias for backward compatibility
// Old code using ReferenceDataService will still work
export const ReferenceDataService = GameDataService;