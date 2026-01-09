import { Trie } from './trie.js';

/**
 * ReferenceDataService - Central service for managing game reference data
 * Handles merits, flaws, abilities, spheres, and other reference content
 * with fast trie-based search capabilities
 */
export class ReferenceDataService {
    constructor() {
        this.data = {
            merits: [],
            flaws: [],
            backgrounds: [],
            abilities: [],
            spheres: [],
            attributes: []
        };
        
        this.trieIndices = {};
        this.initialized = false;
    }

    /**
     * Initialize the service by loading all reference data
     */
    async initialize() {
        console.log("WoD System | Initializing Reference Data Service...");
        
        try {
            await this.loadMeritsFlaws();
            await this.loadBackgrounds();
            this.buildTrieIndices();
            this.initialized = true;
            console.log("WoD System | Reference Data Service initialized successfully");
        } catch (error) {
            console.error("WoD System | Failed to initialize Reference Data Service:", error);
        }
    }

    /**
     * Load merits and flaws from JSON
     */
    async loadMeritsFlaws() {
        try {
            const response = await fetch('systems/wodsystem/datasource/merits_flaws.json');
            if (!response.ok) {
                throw new Error(`Failed to load merits_flaws.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.merits = data.merits || [];
            this.data.flaws = data.flaws || [];
            
            console.log(`WoD System | Loaded ${this.data.merits.length} merits and ${this.data.flaws.length} flaws`);
        } catch (error) {
            console.error("WoD System | Error loading merits/flaws:", error);
            this.data.merits = [];
            this.data.flaws = [];
        }
    }

    /**
     * Load backgrounds from JSON
     */
    async loadBackgrounds() {
        try {
            const response = await fetch('systems/wodsystem/datasource/backgrounds.json');
            if (!response.ok) {
                throw new Error(`Failed to load backgrounds.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.backgrounds = data.backgrounds || [];
            
            console.log(`WoD System | Loaded ${this.data.backgrounds.length} backgrounds`);
        } catch (error) {
            console.error("WoD System | Error loading backgrounds:", error);
            this.data.backgrounds = [];
        }
    }

    /**
     * Build trie indices for fast searching
     */
    buildTrieIndices() {
        this.trieIndices.meritsFlaws = new Trie();
        
        // Index merits
        for (const merit of this.data.merits) {
            // Index by name
            this.trieIndices.meritsFlaws.insert(merit.name, merit);
            
            // Index by search terms
            if (merit.searchTerms && Array.isArray(merit.searchTerms)) {
                merit.searchTerms.forEach(term => {
                    this.trieIndices.meritsFlaws.insert(term, merit);
                });
            }
            
            // Index by keywords
            if (merit.keywords && Array.isArray(merit.keywords)) {
                merit.keywords.forEach(keyword => {
                    this.trieIndices.meritsFlaws.insert(keyword, merit);
                });
            }
        }
        
        // Index flaws
        for (const flaw of this.data.flaws) {
            // Index by name
            this.trieIndices.meritsFlaws.insert(flaw.name, flaw);
            
            // Index by search terms
            if (flaw.searchTerms && Array.isArray(flaw.searchTerms)) {
                flaw.searchTerms.forEach(term => {
                    this.trieIndices.meritsFlaws.insert(term, flaw);
                });
            }
            
            // Index by keywords
            if (flaw.keywords && Array.isArray(flaw.keywords)) {
                flaw.keywords.forEach(keyword => {
                    this.trieIndices.meritsFlaws.insert(keyword, flaw);
                });
            }
        }
        
        console.log(`WoD System | Built trie indices for ${this.data.merits.length + this.data.flaws.length} items`);
    }

    /**
     * Search for merits/flaws using trie-based prefix matching
     * @param {string} query - Search query
     * @param {object} options - Filter options (category, type, cost range)
     * @returns {Array} Matching items
     */
    search(query, options = {}) {
        if (!this.initialized || !query) return [];
        
        const { category, type, minCost, maxCost, actorType } = options;
        
        // Get trie results
        let results = this.trieIndices.meritsFlaws.search(query);
        
        // Remove duplicates (same item may match multiple search terms)
        const uniqueResults = Array.from(new Set(results.map(r => r.id)))
            .map(id => results.find(r => r.id === id));
        
        // Apply filters
        let filtered = uniqueResults;
        
        if (category) {
            filtered = filtered.filter(r => r.category === category);
        }
        
        if (type) {
            filtered = filtered.filter(r => r.type === type);
        }
        
        // Filter by actor type (mage, technocrat, or both)
        if (actorType) {
            const normalizedActorType = actorType.toLowerCase();
            filtered = filtered.filter(r => {
                const availableTo = r.availableTo || 'both';
                return availableTo === 'both' || availableTo === normalizedActorType;
            });
        }
        
        if (minCost !== undefined) {
            filtered = filtered.filter(r => {
                const costs = Array.isArray(r.cost) ? r.cost : [r.cost];
                return Math.min(...costs) >= minCost;
            });
        }
        
        if (maxCost !== undefined) {
            filtered = filtered.filter(r => {
                const costs = Array.isArray(r.cost) ? r.cost : [r.cost];
                return Math.max(...costs) <= maxCost;
            });
        }
        
        return filtered;
    }

    /**
     * Get item by exact name match (case-insensitive)
     * @param {string} name - Exact name to match
     * @param {string} category - Optional category filter ('Merit' or 'Flaw')
     * @returns {object|null} Matching item or null
     */
    getByName(name, category = null) {
        if (!this.initialized || !name) return null;
        
        const normalized = name.trim().toLowerCase();
        
        let items = [...this.data.merits, ...this.data.flaws];
        if (category) {
            items = category === 'Merit' ? this.data.merits : this.data.flaws;
        }
        
        return items.find(item => item.name.toLowerCase() === normalized) || null;
    }

    /**
     * Get merit by ID
     * @param {string} id - Merit ID
     * @returns {object|null} Merit or null
     */
    getMerit(id) {
        return this.data.merits.find(m => m.id === id) || null;
    }

    /**
     * Get flaw by ID
     * @param {string} id - Flaw ID
     * @returns {object|null} Flaw or null
     */
    getFlaw(id) {
        return this.data.flaws.find(f => f.id === id) || null;
    }

    /**
     * Generate HTML for tooltip display
     * @param {object} item - Merit/flaw item
     * @returns {string} HTML string
     */
    generateTooltipHTML(item) {
        if (!item) return '';
        
        const categoryClass = item.category.toLowerCase();
        const description = item.description.length > 200 
            ? item.description.substring(0, 200) + '...' 
            : item.description;
        
        return `
            <div class="reference-tooltip-inner">
                <h4>${item.name} <span class="cost">(${item.costDescription})</span></h4>
                <span class="type-badge ${categoryClass}">${item.type} ${item.category}</span>
                <p class="description">${description}</p>
                ${item.gameEffects ? `<p class="game-effects"><strong>Effects:</strong> ${item.gameEffects}</p>` : ''}
                <p class="tooltip-hint"><em>Click to post full details to chat</em></p>
            </div>
        `;
    }

    /**
     * Get all merits
     * @returns {Array} All merits
     */
    getAllMerits() {
        return [...this.data.merits];
    }

    /**
     * Get all flaws
     * @returns {Array} All flaws
     */
    getAllFlaws() {
        return [...this.data.flaws];
    }

    /**
     * Get merits by type
     * @param {string} type - Type (Physical, Mental, Social, Supernatural)
     * @returns {Array} Matching merits
     */
    getMeritsByType(type) {
        return this.data.merits.filter(m => m.type === type);
    }

    /**
     * Get flaws by type
     * @param {string} type - Type (Physical, Mental, Social, Supernatural)
     * @returns {Array} Matching flaws
     */
    getFlawsByType(type) {
        return this.data.flaws.filter(f => f.type === type);
    }

    /**
     * Get background by name (case-insensitive)
     * @param {string} name - Background name
     * @returns {object|null} Background data or null
     */
    getBackgroundByName(name) {
        if (!this.initialized || !name) return null;
        
        const normalized = name.trim().toLowerCase();
        return this.data.backgrounds.find(bg => bg.name.toLowerCase() === normalized) || null;
    }

    /**
     * Get all backgrounds as a sorted list, optionally filtered by actor type
     * @param {string} actorType - Optional actor type filter (e.g., "Technocrat", "Mage")
     * @returns {Array} Array of background names
     */
    getBackgroundsList(actorType = null) {
        if (!this.initialized) return [];
        
        let backgrounds = this.data.backgrounds;
        
        // Filter by actor type if provided
        if (actorType) {
            const normalizedActorType = actorType.toLowerCase();
            backgrounds = backgrounds.filter(bg => {
                const availableTo = bg.availableTo || 'both';
                return availableTo === 'both' || availableTo === normalizedActorType;
            });
        }
        
        // Return sorted list of names
        return backgrounds
            .map(bg => bg.name)
            .sort((a, b) => a.localeCompare(b));
    }

    /**
     * Check if a background has double cost
     * @param {string} name - Background name
     * @returns {boolean} True if background costs 2 points per dot
     */
    isDoubleCostBackground(name) {
        if (!this.initialized || !name) return false;
        
        const background = this.getBackgroundByName(name);
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
}

