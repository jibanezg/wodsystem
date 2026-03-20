/**
 * Status Effect Manager
 * Manages global status effect templates that can be applied to actors
 * Supports GM-created effects with categories, tags, and bulk assignment
 */

// Register the scene control hook immediately at module load
Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user?.isGM) {
        return;
    }
    
    // Controls is an object with control groups as properties
    // Add to token control group (always visible)
    const tokenControl = controls.tokens;
    if (tokenControl && tokenControl.tools) {
        // Tools is an object with tool names as properties
        if (!tokenControl.tools["effect-library"]) {
            tokenControl.tools["effect-library"] = {
                name: "effect-library",
                title: game.i18n?.localize("WODSYSTEM.StatusEffects.EffectLibrary") || "Effect Library",
                icon: "fas fa-book",
                visible: true,
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
                icon: "fas fa-magic",
                visible: true,
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
            // Settings already registered or error occurred
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
            documentTypes: effectData.documentTypes || [],
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
        
        // Sync to all documents with this effect
        await this._syncEffectToDocuments(id, updatedTemplate);
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
     * Get effect templates applicable to a specific document type
     * @param {string} docType - The document type ('actor', 'wall', 'tile', 'region', 'scene')
     * @returns {Array} Filtered effect templates
     */
    getTemplatesForDocumentType(docType) {
        return this.getAllEffectTemplates().filter(e => {
            // Empty or missing documentTypes = universal (applies to all)
            if (!e.documentTypes || e.documentTypes.length === 0) return true;
            return e.documentTypes.includes(docType);
        });
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

    // ==================== Universal Document Effect Methods ====================

    /**
     * Determine the document type key for routing
     * @param {Document} doc - Any Foundry document
     * @returns {string} The document type key ('actor', 'wall', 'tile', 'region', 'scene')
     * @private
     */
    _getDocumentTypeKey(doc) {
        if (!doc) return null;
        const docName = doc.documentName || doc.constructor?.documentName;
        switch (docName) {
            case 'Actor': return 'actor';
            case 'Item': return 'actor'; // Items use actor-like ActiveEffect path
            case 'Wall': return 'wall';
            case 'Tile': return 'tile';
            case 'Region': return 'region';
            case 'Scene': return 'scene';
            default: return null;
        }
    }

    /**
     * Check if a document supports ActiveEffect embedding (actor/item)
     * @param {Document} doc
     * @returns {boolean}
     * @private
     */
    _supportsActiveEffects(doc) {
        const docName = doc.documentName || doc.constructor?.documentName;
        return docName === 'Actor' || docName === 'Item';
    }

    /**
     * Apply an effect template to any document (universal method)
     * Routes to ActiveEffect for actors/items, flag storage for others
     * @param {string} templateId - The effect template ID
     * @param {Document} doc - Any Foundry document
     * @returns {Object|ActiveEffect|null} The created effect or null if failed
     */
    async applyEffectToDocument(templateId, doc) {
        if (!doc) return null;
        
        if (this._supportsActiveEffects(doc)) {
            return this.applyEffectToActor(templateId, doc);
        }
        return this._applyEffectToFlag(templateId, doc);
    }

    /**
     * Remove an effect template from any document (universal method)
     * @param {string} templateId - The effect template ID
     * @param {Document} doc - Any Foundry document
     * @returns {boolean} True if removed
     */
    async removeEffectFromDocument(templateId, doc) {
        if (!doc) return false;
        
        if (this._supportsActiveEffects(doc)) {
            return this.removeEffectFromActor(templateId, doc);
        }
        return this._removeEffectFromFlag(templateId, doc);
    }

    /**
     * Check if a document has an effect applied
     * @param {Document} doc - Any Foundry document
     * @param {string} templateId - The effect template ID
     * @returns {boolean}
     */
    hasEffect(doc, templateId) {
        if (!doc || !templateId) return false;
        
        if (this._supportsActiveEffects(doc)) {
            return !!doc.effects?.find(e => 
                e.getFlag('wodsystem', 'sourceTemplateId') === templateId
            );
        }
        const appliedEffects = doc.getFlag('wodsystem', 'appliedEffects') || [];
        return appliedEffects.some(e => e.templateId === templateId);
    }

    /**
     * Check if a document has an effect by name
     * @param {Document} doc - Any Foundry document
     * @param {string} effectName - The effect name to search for
     * @returns {boolean}
     */
    hasEffectByName(doc, effectName) {
        if (!doc || !effectName) return false;
        const lowerName = effectName.toLowerCase().trim();
        
        if (this._supportsActiveEffects(doc)) {
            for (const effect of (doc.effects || [])) {
                const name = (effect.name || effect.label || '').toLowerCase().trim();
                if (name === lowerName) return true;
            }
            return false;
        }
        const appliedEffects = doc.getFlag('wodsystem', 'appliedEffects') || [];
        return appliedEffects.some(e => (e.name || '').toLowerCase().trim() === lowerName);
    }

    /**
     * Toggle an effect on a document (apply if missing, remove if present)
     * @param {string} templateId - The effect template ID
     * @param {Document} doc - Any Foundry document
     * @returns {Object} { action: 'applied'|'removed', result }
     */
    async toggleEffect(templateId, doc) {
        if (this.hasEffect(doc, templateId)) {
            const result = await this.removeEffectFromDocument(templateId, doc);
            return { action: 'removed', result };
        } else {
            const result = await this.applyEffectToDocument(templateId, doc);
            return { action: 'applied', result };
        }
    }

    /**
     * Get all effects applied to a document (universal)
     * @param {Document} doc - Any Foundry document
     * @returns {Array} Array of effect data objects
     */
    getDocumentEffects(doc) {
        if (!doc) return [];
        
        if (this._supportsActiveEffects(doc)) {
            return Array.from(doc.effects || []).map(effect => ({
                templateId: effect.getFlag('wodsystem', 'sourceTemplateId') || null,
                name: effect.name,
                icon: effect.img || effect.icon || 'icons/svg/aura.svg',
                changes: effect.changes?.map(c => ({ key: c.key, value: c.value, mode: c.mode })) || [],
                conditionScope: effect.getFlag('wodsystem', 'conditionScope') || 'always',
                conditionTargets: effect.getFlag('wodsystem', 'conditionTargets') || [],
                isActiveEffect: true,
                effectId: effect.id
            }));
        }
        return (doc.getFlag('wodsystem', 'appliedEffects') || []).map(e => ({
            ...e,
            isActiveEffect: false
        }));
    }

    /**
     * Apply effect templates to multiple documents (universal bulk)
     * @param {Array<string>} templateIds - Array of effect template IDs
     * @param {Array<Document>} docs - Array of documents to apply effects to
     * @returns {Object} Results summary { applied, skipped, failed }
     */
    async applyEffectsToDocuments(templateIds, docs) {
        const results = { applied: 0, skipped: 0, failed: 0 };
        for (const doc of docs) {
            for (const templateId of templateIds) {
                const result = await this.applyEffectToDocument(templateId, doc);
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
     * Remove effect templates from multiple documents (universal bulk)
     * @param {Array<string>} templateIds - Array of effect template IDs
     * @param {Array<Document>} docs - Array of documents to remove effects from
     * @returns {Object} Results summary { removed, notFound, failed }
     */
    async removeEffectsFromDocuments(templateIds, docs) {
        const results = { removed: 0, notFound: 0, failed: 0 };
        for (const doc of docs) {
            for (const templateId of templateIds) {
                const removed = await this.removeEffectFromDocument(templateId, doc);
                if (removed) {
                    results.removed++;
                } else {
                    results.notFound++;
                }
            }
        }
        return results;
    }

    // ==================== Flag-Based Effect Storage (Non-Actor) ====================

    /**
     * Apply an effect to a non-actor document via flags
     * @param {string} templateId - The effect template ID
     * @param {Document} doc - The document to apply the effect to
     * @returns {Object|null} The applied effect data or null
     * @private
     */
    async _applyEffectToFlag(templateId, doc) {
        const template = this.effectTemplates.get(templateId);
        if (!template) {
            console.warn(`WoD StatusEffectManager | Effect template not found: ${templateId}`);
            return null;
        }
        
        const appliedEffects = doc.getFlag('wodsystem', 'appliedEffects') || [];
        
        // Check if already applied
        if (appliedEffects.some(e => e.templateId === templateId)) {
            return appliedEffects.find(e => e.templateId === templateId);
        }
        
        const effectEntry = {
            templateId,
            name: template.name,
            icon: template.icon || 'icons/svg/aura.svg',
            changes: template.changes || [],
            conditionScope: template.conditionScope || 'always',
            conditionTargets: template.conditionTargets || [],
            appliedAt: Date.now(),
            appliedBy: game.user?.id || null
        };
        
        try {
            await doc.setFlag('wodsystem', 'appliedEffects', [...appliedEffects, effectEntry]);
            return effectEntry;
        } catch (error) {
            console.error(`WoD StatusEffectManager | Failed to apply effect to document:`, error);
            return null;
        }
    }

    /**
     * Remove an effect from a non-actor document via flags
     * @param {string} templateId - The effect template ID
     * @param {Document} doc - The document to remove the effect from
     * @returns {boolean} True if removed
     * @private
     */
    async _removeEffectFromFlag(templateId, doc) {
        const appliedEffects = doc.getFlag('wodsystem', 'appliedEffects') || [];
        const filtered = appliedEffects.filter(e => e.templateId !== templateId);
        
        if (filtered.length === appliedEffects.length) {
            return false; // Not found
        }
        
        try {
            await doc.setFlag('wodsystem', 'appliedEffects', filtered);
            return true;
        } catch (error) {
            console.error(`WoD StatusEffectManager | Failed to remove effect from document:`, error);
            return false;
        }
    }

    // ==================== Effect Sync ====================

    /**
     * Sync an updated effect template to all documents that have it
     * Handles both ActiveEffect actors and flag-based documents
     * @param {string} templateId - The effect template ID
     * @param {Object} template - The updated template data
     * @private
     */
    async _syncEffectToDocuments(templateId, template) {
        let syncCount = 0;
        
        // Sync to actors (ActiveEffect)
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
        
        // Sync to scene documents (flag-based)
        if (canvas?.scene) {
            const sceneCollections = [
                canvas.scene.walls,
                canvas.scene.tiles,
                canvas.scene.regions
            ].filter(Boolean);
            
            for (const collection of sceneCollections) {
                for (const doc of collection) {
                    const appliedEffects = doc.getFlag('wodsystem', 'appliedEffects') || [];
                    const idx = appliedEffects.findIndex(e => e.templateId === templateId);
                    if (idx >= 0) {
                        const updated = [...appliedEffects];
                        updated[idx] = {
                            ...updated[idx],
                            name: template.name,
                            icon: template.icon,
                            changes: template.changes || [],
                            conditionScope: template.conditionScope || 'always',
                            conditionTargets: template.conditionTargets || []
                        };
                        try {
                            await doc.setFlag('wodsystem', 'appliedEffects', updated);
                            syncCount++;
                        } catch (error) {
                            console.error(`WoD StatusEffectManager | Failed to sync flag effect on document:`, error);
                        }
                    }
                }
            }
            
            // Sync to scene itself
            const sceneEffects = canvas.scene.getFlag('wodsystem', 'appliedEffects') || [];
            const sceneIdx = sceneEffects.findIndex(e => e.templateId === templateId);
            if (sceneIdx >= 0) {
                const updated = [...sceneEffects];
                updated[sceneIdx] = {
                    ...updated[sceneIdx],
                    name: template.name,
                    icon: template.icon,
                    changes: template.changes || [],
                    conditionScope: template.conditionScope || 'always',
                    conditionTargets: template.conditionTargets || []
                };
                try {
                    await canvas.scene.setFlag('wodsystem', 'appliedEffects', updated);
                    syncCount++;
                } catch (error) {
                    console.error(`WoD StatusEffectManager | Failed to sync flag effect on scene:`, error);
                }
            }
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
