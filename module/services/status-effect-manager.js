/**
 * Status Effect Manager
 * Manages global status effect templates that can be applied to actors
 * Supports GM-created effects with categories, tags, and bulk assignment
 */

// Register the scene control hook immediately at module load
Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user?.isGM) return;
    
    // Controls is an object with control groups as properties
    const tokenControl = controls.tokens;
    if (tokenControl) {
        // Tools is an object with tool names as properties
        if (!tokenControl.tools["effect-library"]) {
            tokenControl.tools["effect-library"] = {
                name: "effect-library",
                title: game.i18n?.localize("WODSYSTEM.StatusEffects.EffectLibrary") || "Effect Library",
                icon: "fas fa-book",
                button: true,
                onClick: () => {
                    const manager = game.wod?.statusEffectManager;
                    if (manager) {
                        manager._openEffectLibrary();
                    }
                }
            };
        }
        
        if (!tokenControl.tools["apply-effects"]) {
            tokenControl.tools["apply-effects"] = {
                name: "apply-effects",
                title: game.i18n?.localize("WODSYSTEM.StatusEffects.ApplyEffects") || "Apply Effects",
                icon: "fas fa-user-plus",
                button: true,
                onClick: () => {
                    const manager = game.wod?.statusEffectManager;
                    if (manager) {
                        manager._openEffectAssignment();
                    }
                }
            };
        }
    }
});

export class StatusEffectManager {
    constructor() {
        this.effectTemplates = new Map();
        this.categories = new Set();
        this.tags = new Set();
        this._dataPath = 'systems/wodsystem/datasource/status-effects.json';
        this._initialized = false;
    }

    /**
     * Initialize the manager and register hooks
     */
    async initialize() {
        if (this._initialized) return;
        
        // Register world setting for storing effect templates
        this._registerSettings();
        
        // Load effect templates from JSON file first (as seed data)
        await this._loadEffectTemplates();
        
        // Then override with world settings if they exist
        await this._loadFromWorldSettings();
        
        // Register hooks for effect sync
        this._registerSyncHooks();
        
        this._initialized = true;
        console.log('WoD StatusEffectManager | Initialized');
    }

    /**
     * Register world settings for storing effect templates
     * @private
     */
    _registerSettings() {
        try {
            game.settings.register('wodsystem', 'statusEffectTemplates', {
                name: 'Status Effect Templates',
                hint: 'Stores GM-created status effect templates',
                scope: 'world',
                config: false,
                type: Object,
                default: {
                    version: "1.0.0",
                    lastModified: null,
                    categories: [],
                    tags: [],
                    effects: []
                }
            });
        } catch (error) {
            // Setting may already be registered
            console.log('WoD StatusEffectManager | Settings already registered or error:', error.message);
        }
    }

    /**
     * Register hooks for syncing effect templates to actor effects
     * @private
     */
    _registerSyncHooks() {
        // When an effect template is updated, sync to all actors with that effect
        // This is handled internally when templates are modified
    }

    /**
     * Load effect templates from JSON file
     * @private
     */
    async _loadEffectTemplates() {
        try {
            const response = await fetch(this._dataPath);
            if (!response.ok) {
                console.warn('WoD StatusEffectManager | Could not load status-effects.json, using empty defaults');
                return;
            }
            
            const data = await response.json();
            
            // Load categories
            if (Array.isArray(data.categories)) {
                data.categories.forEach(cat => this.categories.add(cat));
            }
            
            // Load tags
            if (Array.isArray(data.tags)) {
                data.tags.forEach(tag => this.tags.add(tag));
            }
            
            // Load effect templates
            if (Array.isArray(data.effects)) {
                data.effects.forEach(effect => {
                    this.effectTemplates.set(effect.id, effect);
                });
            }
            
            console.log(`WoD StatusEffectManager | Loaded ${this.effectTemplates.size} effect templates`);
        } catch (error) {
            console.error('WoD StatusEffectManager | Error loading effect templates:', error);
        }
    }

    /**
     * Save effect templates to world settings (JSON file is read-only at runtime)
     * We use world settings for runtime storage, JSON is the initial seed
     * @private
     */
    async _saveEffectTemplates() {
        const data = {
            version: "1.0.0",
            lastModified: new Date().toISOString(),
            categories: Array.from(this.categories),
            tags: Array.from(this.tags),
            effects: Array.from(this.effectTemplates.values())
        };
        
        // Save to world settings (persists across sessions)
        await game.settings.set('wodsystem', 'statusEffectTemplates', data);
        console.log('WoD StatusEffectManager | Saved effect templates to world settings');
    }

    /**
     * Load from world settings (overrides JSON if exists)
     * @private
     */
    async _loadFromWorldSettings() {
        try {
            const data = game.settings.get('wodsystem', 'statusEffectTemplates');
            if (data && data.effects && data.effects.length > 0) {
                // Clear and reload from world settings
                this.effectTemplates.clear();
                this.categories.clear();
                this.tags.clear();
                
                if (Array.isArray(data.categories)) {
                    data.categories.forEach(cat => this.categories.add(cat));
                }
                if (Array.isArray(data.tags)) {
                    data.tags.forEach(tag => this.tags.add(tag));
                }
                if (Array.isArray(data.effects)) {
                    data.effects.forEach(effect => {
                        this.effectTemplates.set(effect.id, effect);
                    });
                }
                
                console.log(`WoD StatusEffectManager | Loaded ${this.effectTemplates.size} effect templates from world settings`);
                return true;
            }
        } catch (error) {
            // Setting doesn't exist yet, that's fine
        }
        return false;
    }

    // ==================== CRUD Operations ====================

    /**
     * Create a new effect template
     * @param {Object} effectData - The effect template data
     * @returns {Object} The created effect template
     */
    async createEffectTemplate(effectData) {
        const id = effectData.id || foundry.utils.randomID();
        
        const template = {
            id,
            name: effectData.name || 'New Effect',
            icon: effectData.icon || 'icons/svg/aura.svg',
            description: effectData.description || '',
            category: effectData.category || '',
            tags: effectData.tags || [],
            createdBy: 'storyteller',
            mandatory: effectData.mandatory !== undefined ? effectData.mandatory : true,
            conditionScope: effectData.conditionScope || 'always',
            conditionTargets: effectData.conditionTargets || [],
            changes: effectData.changes || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.effectTemplates.set(id, template);
        
        // Add any new category/tags
        if (template.category) this.categories.add(template.category);
        template.tags.forEach(tag => this.tags.add(tag));
        
        await this._saveEffectTemplates();
        
        console.log(`WoD StatusEffectManager | Created effect template: ${template.name}`);
        return template;
    }

    /**
     * Update an existing effect template
     * @param {string} id - The effect template ID
     * @param {Object} updates - The updates to apply
     * @returns {Object|null} The updated effect template or null if not found
     */
    async updateEffectTemplate(id, updates) {
        const template = this.effectTemplates.get(id);
        if (!template) {
            console.warn(`WoD StatusEffectManager | Effect template not found: ${id}`);
            return null;
        }
        
        // Apply updates
        const updatedTemplate = {
            ...template,
            ...updates,
            id, // Preserve ID
            updatedAt: new Date().toISOString()
        };
        
        this.effectTemplates.set(id, updatedTemplate);
        
        // Add any new category/tags
        if (updatedTemplate.category) this.categories.add(updatedTemplate.category);
        if (updatedTemplate.tags) {
            updatedTemplate.tags.forEach(tag => this.tags.add(tag));
        }
        
        await this._saveEffectTemplates();
        
        // Sync to all actors with this effect
        await this._syncEffectToActors(id, updatedTemplate);
        
        console.log(`WoD StatusEffectManager | Updated effect template: ${updatedTemplate.name}`);
        return updatedTemplate;
    }

    /**
     * Delete an effect template
     * @param {string} id - The effect template ID
     * @returns {boolean} True if deleted, false if not found
     */
    async deleteEffectTemplate(id) {
        if (!this.effectTemplates.has(id)) {
            console.warn(`WoD StatusEffectManager | Effect template not found: ${id}`);
            return false;
        }
        
        const template = this.effectTemplates.get(id);
        this.effectTemplates.delete(id);
        
        await this._saveEffectTemplates();
        
        console.log(`WoD StatusEffectManager | Deleted effect template: ${template.name}`);
        return true;
    }

    /**
     * Get an effect template by ID (including core effects)
     * @param {string} id - The effect template ID
     * @returns {Object|null} The effect template or null if not found
     */
    getEffectTemplate(id) {
        // Check regular templates first
        let template = this.effectTemplates.get(id);
        
        // Check core effects if not found
        if (!template && game.wod?.coreEffectsManager) {
            const coreEffects = game.wod.coreEffectsManager.getAllCoreEffects();
            template = coreEffects.find(e => e.id === id);
        }
        
        return template || null;
    }

    /**
     * Get all effect templates
     * @returns {Array} Array of effect template objects
     */
    getAllEffectTemplates() {
        return Array.from(this.effectTemplates.values());
    }

    /**
     * Get effect templates filtered by category
     * @param {string} category - The category to filter by
     * @returns {Array} Filtered effect templates
     */
    getEffectsByCategory(category) {
        return this.getAllEffectTemplates().filter(e => e.category === category);
    }

    /**
     * Get effect templates filtered by tag
     * @param {string} tag - The tag to filter by
     * @returns {Array} Filtered effect templates
     */
    getEffectsByTag(tag) {
        return this.getAllEffectTemplates().filter(e => e.tags && e.tags.includes(tag));
    }

    // ==================== Effect Application ====================

    /**
     * Apply an effect template to an actor
     * @param {string} templateId - The effect template ID
     * @param {Actor} actor - The actor to apply the effect to
     * @returns {ActiveEffect|null} The created effect or null if failed
     */
    async applyEffectToActor(templateId, actor) {
        const template = this.effectTemplates.get(templateId);
        if (!template) {
            console.warn(`WoD StatusEffectManager | Effect template not found: ${templateId}`);
            return null;
        }
        
        // Check if actor already has this effect
        const existingEffect = actor.effects.find(e => 
            e.getFlag('wodsystem', 'sourceTemplateId') === templateId
        );
        
        if (existingEffect) {
            console.log(`WoD StatusEffectManager | Actor ${actor.name} already has effect: ${template.name}`);
            return existingEffect;
        }
        
        // Create the effect on the actor
        const effectData = {
            name: template.name,
            img: template.icon,
            changes: template.changes || [],
            flags: {
                wodsystem: {
                    createdBy: 'storyteller',
                    mandatory: template.mandatory,
                    sourceTemplateId: templateId,
                    conditionScope: template.conditionScope,
                    conditionTargets: template.conditionTargets
                }
            },
            origin: `StatusEffectManager.${templateId}`,
            disabled: false
        };
        
        try {
            const [effect] = await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
            console.log(`WoD StatusEffectManager | Applied effect "${template.name}" to ${actor.name}`);
            return effect;
        } catch (error) {
            console.error(`WoD StatusEffectManager | Failed to apply effect to ${actor.name}:`, error);
            return null;
        }
    }

    /**
     * Remove an effect template from an actor
     * @param {string} templateId - The effect template ID
     * @param {Actor} actor - The actor to remove the effect from
     * @returns {boolean} True if removed, false if not found
     */
    async removeEffectFromActor(templateId, actor) {
        const effect = actor.effects.find(e => 
            e.getFlag('wodsystem', 'sourceTemplateId') === templateId
        );
        
        if (!effect) {
            return false;
        }
        
        try {
            await actor.deleteEmbeddedDocuments('ActiveEffect', [effect.id]);
            console.log(`WoD StatusEffectManager | Removed effect from ${actor.name}`);
            return true;
        } catch (error) {
            console.error(`WoD StatusEffectManager | Failed to remove effect from ${actor.name}:`, error);
            return false;
        }
    }

    /**
     * Apply effect templates to multiple actors
     * @param {Array<string>} templateIds - Array of effect template IDs
     * @param {Array<Actor>} actors - Array of actors to apply effects to
     * @returns {Object} Results summary { applied: number, skipped: number, failed: number }
     */
    async applyEffectsToActors(templateIds, actors) {
        const results = { applied: 0, skipped: 0, failed: 0 };
        
        for (const actor of actors) {
            for (const templateId of templateIds) {
                const result = await this.applyEffectToActor(templateId, actor);
                if (result) {
                    results.applied++;
                } else {
                    results.failed++;
                }
            }
        }
        
        return results;
    }

    /**
     * Remove effect templates from multiple actors
     * @param {Array<string>} templateIds - Array of effect template IDs
     * @param {Array<Actor>} actors - Array of actors to remove effects from
     * @returns {Object} Results summary { removed: number, notFound: number, failed: number }
     */
    async removeEffectsFromActors(templateIds, actors) {
        const results = { removed: 0, notFound: 0, failed: 0 };
        
        for (const actor of actors) {
            for (const templateId of templateIds) {
                const removed = await this.removeEffectFromActor(templateId, actor);
                if (removed) {
                    results.removed++;
                } else {
                    results.notFound++;
                }
            }
        }
        
        return results;
    }

    // ==================== Effect Sync ====================

    /**
     * Sync an updated effect template to all actors that have it
     * @param {string} templateId - The effect template ID
     * @param {Object} template - The updated template data
     * @private
     */
    async _syncEffectToActors(templateId, template) {
        let syncCount = 0;
        
        for (const actor of game.actors) {
            const effect = actor.effects.find(e => 
                e.getFlag('wodsystem', 'sourceTemplateId') === templateId
            );
            
            if (effect) {
                try {
                    await effect.update({
                        name: template.name,
                        img: template.icon,
                        changes: template.changes || [],
                        'flags.wodsystem.mandatory': template.mandatory,
                        'flags.wodsystem.conditionScope': template.conditionScope,
                        'flags.wodsystem.conditionTargets': template.conditionTargets
                    });
                    syncCount++;
                } catch (error) {
                    console.error(`WoD StatusEffectManager | Failed to sync effect on ${actor.name}:`, error);
                }
            }
        }
        
        if (syncCount > 0) {
            console.log(`WoD StatusEffectManager | Synced effect "${template.name}" to ${syncCount} actors`);
        }
    }

    // ==================== UI Methods ====================

    /**
     * Open the Effect Library dialog
     * @private
     */
    _openEffectLibrary() {
        // Import and open the library dialog
        import('../apps/wod-status-effect-library.js').then(module => {
            const dialog = new module.WodStatusEffectLibrary(this);
            dialog.render(true);
        }).catch(error => {
            console.error('WoD StatusEffectManager | Failed to open Effect Library:', error);
            ui.notifications.error('Failed to open Effect Library');
        });
    }

    /**
     * Open the Effect Assignment dialog
     * @private
     */
    _openEffectAssignment() {
        // Import and open the assignment dialog
        import('../apps/wod-effect-assignment.js').then(module => {
            const dialog = new module.WodEffectAssignment(this);
            dialog.render(true);
        }).catch(error => {
            console.error('WoD StatusEffectManager | Failed to open Effect Assignment:', error);
            ui.notifications.error('Failed to open Effect Assignment');
        });
    }

    // ==================== Category/Tag Management ====================

    /**
     * Add a new category
     * @param {string} category - The category name
     */
    async addCategory(category) {
        if (!category || this.categories.has(category)) return;
        this.categories.add(category);
        await this._saveEffectTemplates();
    }

    /**
     * Remove a category
     * @param {string} category - The category name
     */
    async removeCategory(category) {
        if (!this.categories.has(category)) return;
        this.categories.delete(category);
        
        // Remove category from all effects
        for (const [id, effect] of this.effectTemplates) {
            if (effect.category === category) {
                effect.category = '';
            }
        }
        
        await this._saveEffectTemplates();
    }

    /**
     * Add a new tag
     * @param {string} tag - The tag name
     */
    async addTag(tag) {
        if (!tag || this.tags.has(tag)) return;
        this.tags.add(tag);
        await this._saveEffectTemplates();
    }

    /**
     * Remove a tag
     * @param {string} tag - The tag name
     */
    async removeTag(tag) {
        if (!this.tags.has(tag)) return;
        this.tags.delete(tag);
        
        // Remove tag from all effects
        for (const [id, effect] of this.effectTemplates) {
            if (effect.tags && effect.tags.includes(tag)) {
                effect.tags = effect.tags.filter(t => t !== tag);
            }
        }
        
        await this._saveEffectTemplates();
    }

    /**
     * Get all categories
     * @returns {Array} Array of category names
     */
    getAllCategories() {
        return Array.from(this.categories);
    }

    /**
     * Get all tags
     * @returns {Array} Array of tag names
     */
    getAllTags() {
        return Array.from(this.tags);
    }
}
