/**
 * EffectAutocomplete - Autocomplete component for effect names using Trie
 * Provides fast, efficient search through all available effects
 */
import { Trie } from '../services/trie.js';

export class EffectAutocomplete {
    constructor(inputElement, options = {}) {
        // Safety check - ensure input element exists
        if (!inputElement) {
            console.error('EffectAutocomplete | Input element is required');
            throw new Error('EffectAutocomplete requires a valid input element');
        }
        
        this.input = inputElement;
        this.options = {
            maxResults: options.maxResults || 10,
            minQueryLength: options.minQueryLength || 1,
            placeholder: options.placeholder || 'Search effects...',
            ...options
        };
        
        this.trie = new Trie();
        this.results = [];
        this.selectedIndex = -1;
        this.isOpen = false;
        this.currentEffects = new Set();
        
        this._initialize();
    }
    
    /**
     * Initialize the autocomplete component
     * @private
     */
    _initialize() {
        this._buildTrie();
        this._createDropdown();
        this._bindEvents();
    }
    
    /**
     * Build trie from all available effects in the system
     * @private
     */
    _buildTrie() {
        // Get effects from core foundry
        const coreEffects = game.effects?.contents || [];
        
        // Get effects from active actors
        const actorEffects = [];
        for (const actor of game.actors?.contents || []) {
            for (const effect of actor.effects?.contents || []) {
                actorEffects.push(effect);
            }
        }
        
        // Get effects from tokens on current scene
        const tokenEffects = [];
        if (canvas?.scene?.tokens) {
            for (const token of canvas.scene.tokens.contents) {
                for (const effect of token.actor?.effects?.contents || []) {
                    tokenEffects.push(effect);
                }
            }
        }
        
        // Get all status effect templates from WoD StatusEffectManager
        const statusEffectTemplates = [];
        if (game.wod?.statusEffectManager) {
            const templates = game.wod.statusEffectManager.getAllEffectTemplates();
            for (const template of templates) {
                statusEffectTemplates.push({
                    name: template.name,
                    id: template.id,
                    source: 'template',
                    icon: template.icon,
                    description: template.description
                });
            }
        }
        
        // Combine all effects and deduplicate
        const allEffects = new Map();
        
        // Add core effects
        for (const effect of coreEffects) {
            const name = effect.name || effect.label || '';
            if (name) {
                allEffects.set(name.toLowerCase(), {
                    name: name,
                    id: effect.id,
                    source: 'core',
                    icon: effect.icon,
                    description: effect.description
                });
            }
        }
        
        // Add actor effects
        for (const effect of actorEffects) {
            const name = effect.name || effect.label || '';
            if (name) {
                allEffects.set(name.toLowerCase(), {
                    name: name,
                    id: effect.id,
                    source: 'actor',
                    icon: effect.icon,
                    description: effect.description
                });
            }
        }
        
        // Add token effects
        for (const effect of tokenEffects) {
            const name = effect.name || effect.label || '';
            if (name) {
                allEffects.set(name.toLowerCase(), {
                    name: name,
                    id: effect.id,
                    source: 'token',
                    icon: effect.icon,
                    description: effect.description
                });
            }
        }
        
        // Add status effect templates
        for (const effect of statusEffectTemplates) {
            const name = effect.name || '';
            if (name) {
                allEffects.set(name.toLowerCase(), {
                    name: name,
                    id: effect.id,
                    source: 'template',
                    icon: effect.icon,
                    description: effect.description
                });
            }
        }
        
        // Add flag-based effects from scene documents (walls, tiles, regions, scene)
        if (canvas?.scene) {
            const sceneCollections = [
                canvas.scene.walls,
                canvas.scene.tiles,
                canvas.scene.regions
            ].filter(Boolean);
            
            for (const collection of sceneCollections) {
                for (const doc of collection) {
                    const appliedEffects = doc.getFlag?.('wodsystem', 'appliedEffects') || [];
                    for (const effect of appliedEffects) {
                        const name = effect.name || '';
                        if (name && !allEffects.has(name.toLowerCase())) {
                            allEffects.set(name.toLowerCase(), {
                                name: name,
                                id: effect.templateId,
                                source: 'document',
                                icon: effect.icon,
                                description: ''
                            });
                        }
                    }
                }
            }
            
            // Scene itself
            const sceneEffects = canvas.scene.getFlag?.('wodsystem', 'appliedEffects') || [];
            for (const effect of sceneEffects) {
                const name = effect.name || '';
                if (name && !allEffects.has(name.toLowerCase())) {
                    allEffects.set(name.toLowerCase(), {
                        name: name,
                        id: effect.templateId,
                        source: 'document',
                        icon: effect.icon,
                        description: ''
                    });
                }
            }
        }
        
        // Insert all effects into trie
        for (const [key, effectData] of allEffects) {
            this.trie.insert(effectData.name, effectData);
            this.currentEffects.add(effectData.name.toLowerCase());
        }
        
        console.log(`WoD EffectAutocomplete | Loaded ${allEffects.size} effects into trie:`, Array.from(allEffects.keys()));
    }
    
    /**
     * Create dropdown element for results
     * @private
     */
    _createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'effect-autocomplete-dropdown';
        this.dropdown.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            border-top: none;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            min-width: 300px;
            width: auto;
        `;
        
        // Position dropdown below input
        this._updateDropdownPosition();
        
        document.body.appendChild(this.dropdown);
    }
    
    /**
     * Update dropdown position relative to input
     * @private
     */
    _updateDropdownPosition() {
        const rect = this.input.getBoundingClientRect();
        this.dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        this.dropdown.style.left = `${rect.left + window.scrollX}px`;
        // Use max of input width and minimum width
        const width = Math.max(rect.width, 300);
        this.dropdown.style.width = `${width}px`;
    }
    
    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Input events
        this.input.addEventListener('input', this._onInput.bind(this));
        this.input.addEventListener('focus', this._onFocus.bind(this));
        this.input.addEventListener('blur', this._onBlur.bind(this));
        this.input.addEventListener('keydown', this._onKeydown.bind(this));
        
        // Window events
        window.addEventListener('resize', this._updateDropdownPosition.bind(this));
        window.addEventListener('scroll', this._updateDropdownPosition.bind(this));
        
        // Dropdown events
        this.dropdown.addEventListener('mousedown', this._onDropdownClick.bind(this));
    }
    
    /**
     * Handle input changes
     * @private
     */
    _onInput(event) {
        const query = event.target.value.trim();
        
        if (query.length < this.options.minQueryLength) {
            this._hideDropdown();
            return;
        }
        
        this.results = this.trie.search(query);
        this.selectedIndex = -1;
        this._renderResults();
        this._showDropdown();
    }
    
    /**
     * Handle input focus
     * @private
     */
    _onFocus() {
        if (this.input.value.trim().length >= this.options.minQueryLength) {
            this._showDropdown();
        }
    }
    
    /**
     * Handle input blur
     * @private
     */
    _onBlur() {
        // Delay hiding to allow dropdown clicks
        setTimeout(() => this._hideDropdown(), 150);
    }
    
    /**
     * Handle keyboard navigation
     * @private
     */
    _onKeydown(event) {
        if (!this.isOpen) return;
        
        // Add defensive check to prevent focus errors
        try {
            if (event.target && typeof event.target.focus === 'function') {
                // Focus method exists, continue
            }
        } catch (error) {
            // Ignore focus-related errors
            console.warn('WoD EffectAutocomplete | Focus error in keydown handler:', error);
            return;
        }
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
                this._renderResults();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this._renderResults();
                break;
            case 'Enter':
                event.preventDefault();
                if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
                    this._selectResult(this.results[this.selectedIndex]);
                }
                break;
            case 'Escape':
                this._hideDropdown();
                break;
        }
    }
    
    /**
     * Handle dropdown clicks
     * @private
     */
    _onDropdownClick(event) {
        const resultElement = event.target.closest('.effect-autocomplete-result');
        if (resultElement) {
            const index = parseInt(resultElement.dataset.index);
            if (this.results[index]) {
                this._selectResult(this.results[index]);
            }
        }
    }
    
    /**
     * Render search results
     * @private
     */
    _renderResults() {
        const limitedResults = this.results.slice(0, this.options.maxResults);
        
        this.dropdown.innerHTML = limitedResults.map((result, index) => {
            const isSelected = index === this.selectedIndex;
            const icon = result.icon ? `<img src="${result.icon}" style="width: 16px; height: 16px; margin-right: 4px;">` : '';
            const source = result.source ? `<span class="effect-source" style="color: #666; font-size: 10px;">[${result.source}]</span>` : '';
            
            return `
                <div class="effect-autocomplete-result ${isSelected ? 'selected' : ''}" 
                     data-index="${index}"
                     style="padding: 4px 8px; cursor: pointer; ${isSelected ? 'background: #e3f2fd;' : ''}">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center;">
                            ${icon}
                            <span>${result.name}</span>
                        </div>
                        ${source}
                    </div>
                </div>
            `;
        }).join('');
        
        if (limitedResults.length === 0) {
            this.dropdown.innerHTML = `
                <div class="effect-autocomplete-no-results" style="padding: 8px; color: #666; font-style: italic;">
                    No effects found
                </div>
            `;
        }
    }
    
    /**
     * Select a result
     * @private
     */
    _selectResult(result) {
        this.input.value = result.name;
        this._hideDropdown();
        
        // Trigger change event
        this.input.dispatchEvent(new Event('change', { bubbles: true }));
        this.input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    /**
     * Show dropdown
     * @private
     */
    _showDropdown() {
        this.isOpen = true;
        this.dropdown.style.display = 'block';
        this._updateDropdownPosition();
    }
    
    /**
     * Hide dropdown
     * @private
     */
    _hideDropdown() {
        this.isOpen = false;
        this.dropdown.style.display = 'none';
    }
    
    /**
     * Destroy the autocomplete component
     */
    destroy() {
        this.dropdown.remove();
        
        // Remove event listeners
        this.input.removeEventListener('input', this._onInput);
        this.input.removeEventListener('focus', this._onFocus);
        this.input.removeEventListener('blur', this._onBlur);
        this.input.removeEventListener('keydown', this._onKeydown);
        
        window.removeEventListener('resize', this._updateDropdownPosition);
        window.removeEventListener('scroll', this._updateDropdownPosition);
    }
    
    /**
     * Refresh the trie with current effects
     */
    refresh() {
        this.trie = new Trie();
        this.currentEffects.clear();
        this._buildTrie();
    }
}
