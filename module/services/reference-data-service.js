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
            await this.loadSpheres();
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
     * Load spheres from JSON
     */
    async loadSpheres() {
        try {
            const response = await fetch('systems/wodsystem/datasource/spheres.json');
            if (!response.ok) {
                throw new Error(`Failed to load spheres.json: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.data.spheres = data.spheres || [];
            
            console.log(`WoD System | Loaded ${this.data.spheres.length} spheres`);
        } catch (error) {
            console.error("WoD System | Error loading spheres:", error);
            this.data.spheres = [];
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
        
        // Return sorted list of ORIGINAL names (not translated)
        // Translation happens in templates using translateRef helper
        // This ensures matching works correctly (value="original" but display="translated")
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

    /**
     * Get sphere by name (case-insensitive)
     * @param {string} name - Sphere name
     * @returns {object|null} Sphere data or null
     */
    getSphereByName(name) {
        if (!this.initialized || !name) return null;
        
        const normalized = name.trim().toLowerCase();
        return this.data.spheres.find(sphere => sphere.name.toLowerCase() === normalized) || null;
    }

    /**
     * Get sphere by ID
     * @param {string} id - Sphere ID
     * @returns {object|null} Sphere data or null
     */
    getSphereById(id) {
        if (!this.initialized || !id) return null;
        
        const normalized = id.trim().toLowerCase();
        return this.data.spheres.find(sphere => sphere.id === normalized) || null;
    }

    /**
     * Get all spheres
     * @returns {Array} All spheres
     */
    getAllSpheres() {
        return [...this.data.spheres];
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
}

