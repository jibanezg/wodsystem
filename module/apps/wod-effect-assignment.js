import { i18n } from '../helpers/i18n.js';

/**
 * Effect Assignment Dialog
 * Allows GMs to apply/remove status effects to multiple actors at once
 */
export class WodEffectAssignment extends FormApplication {
    constructor(manager, preselectedEffects = [], options = {}) {
        super({}, options);
        this.manager = manager;
        this.selectedEffectIds = new Set(preselectedEffects);
        this.selectedTargetIds = new Set();
        this.selectedTargetType = 'actor';
        this.filterActorType = '';
        this.filterInScene = false;
        this.searchQuery = '';
        this.filterEffectCategory = '';
        this.filterEffectTag = '';
        this.effectSearchQuery = '';
        this.currentStep = 1;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'wod-effect-assignment',
            classes: ['wod', 'dialog', 'effect-assignment', 'wizard'],
            template: 'systems/wodsystem/templates/apps/effect-assignment.html',
            width: 550,
            height: 550,
            resizable: true,
            title: game.i18n?.localize('WODSYSTEM.StatusEffects.ApplyEffects') || 'Apply Effects',
            closeOnSubmit: false,
            submitOnChange: false
        });
    }

    async getData() {
        const data = super.getData();
        
        // Get all effect templates
        let effects = this.manager.getAllEffectTemplates();
        
        // Apply effect filters
        if (this.effectSearchQuery) {
            const query = this.effectSearchQuery.toLowerCase();
            effects = effects.filter(e => 
                e.name.toLowerCase().includes(query) || 
                (e.description && e.description.toLowerCase().includes(query))
            );
        }
        if (this.filterEffectCategory) {
            effects = effects.filter(e => e.category === this.filterEffectCategory);
        }
        if (this.filterEffectTag) {
            effects = effects.filter(e => e.tags && e.tags.includes(this.filterEffectTag));
        }
        
        data.effects = effects;
        data.selectedEffectIds = Array.from(this.selectedEffectIds);
        
        // Target type tabs
        data.selectedTargetType = this.selectedTargetType;
        data.targetTypes = [
            { id: 'actor', label: 'Actors', icon: 'fa-user', active: this.selectedTargetType === 'actor' },
            { id: 'wall', label: 'Doors', icon: 'fa-door-open', active: this.selectedTargetType === 'wall' },
            { id: 'tile', label: 'Tiles', icon: 'fa-image', active: this.selectedTargetType === 'tile' },
            { id: 'region', label: 'Regions', icon: 'fa-draw-polygon', active: this.selectedTargetType === 'region' },
            { id: 'scene', label: 'Scene', icon: 'fa-map', active: this.selectedTargetType === 'scene' }
        ];
        
        // Build targets based on selected type
        data.targets = this._getTargetsForType(this.selectedTargetType);
        data.isActorType = this.selectedTargetType === 'actor';
        data.isSceneType = this.selectedTargetType === 'scene';
        data.isPickerType = ['wall', 'tile', 'region'].includes(this.selectedTargetType);
        
        // For picker types, split into available (dropdown) and selected (cards)
        if (data.isPickerType) {
            data.availableTargets = data.targets.filter(t => !this.selectedTargetIds.has(t.id));
            data.selectedTargetCards = data.targets.filter(t => this.selectedTargetIds.has(t.id));
        }
        
        // Get unique actor types for filter (only used when target type is actor)
        data.actorTypes = [...new Set(game.actors.map(a => a.type))].sort();
        
        // Get unique effect categories and tags for filters
        const allEffects = this.manager.getAllEffectTemplates();
        data.effectCategories = [...new Set(allEffects.map(e => e.category).filter(Boolean))].sort();
        data.effectTags = [...new Set(allEffects.flatMap(e => e.tags || []))].sort();
        
        data.filterActorType = this.filterActorType;
        data.filterInScene = this.filterInScene;
        data.searchQuery = this.searchQuery;
        data.filterEffectCategory = this.filterEffectCategory;
        data.filterEffectTag = this.filterEffectTag;
        data.effectSearchQuery = this.effectSearchQuery;
        data.selectedCount = this.selectedTargetIds.size;
        data.effectCount = this.selectedEffectIds.size;
        data.currentStep = this.currentStep;
        
        // Get selected effects for summary display in step 2 (from all effects, not filtered)
        data.selectedEffects = allEffects.filter(e => this.selectedEffectIds.has(e.id));
        
        return data;
    }

    /**
     * Build a target list for the given document type
     * @param {string} targetType - 'actor', 'wall', 'tile', 'region', 'scene'
     * @returns {Array} Array of target objects with id, name, img, selected, hasEffects
     */
    _getTargetsForType(targetType) {
        switch (targetType) {
            case 'actor': return this._getActorTargets();
            case 'wall': return this._getWallTargets();
            case 'tile': return this._getTileTargets();
            case 'region': return this._getRegionTargets();
            case 'scene': return this._getSceneTargets();
            default: return [];
        }
    }

    _getActorTargets() {
        let actors = Array.from(game.actors);
        if (this.filterActorType) {
            actors = actors.filter(a => a.type === this.filterActorType);
        }
        if (this.filterInScene && canvas?.scene) {
            const sceneTokenActorIds = new Set(
                canvas.scene.tokens.map(t => t.actorId).filter(Boolean)
            );
            actors = actors.filter(a => sceneTokenActorIds.has(a.id));
        }
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            actors = actors.filter(a => a.name.toLowerCase().includes(query));
        }
        actors.sort((a, b) => a.name.localeCompare(b.name));
        
        return actors.map(actor => {
            const hasEffects = [];
            for (const effectId of this.selectedEffectIds) {
                if (this.manager.hasEffect(actor, effectId)) {
                    const template = this.manager.getEffectTemplate(effectId);
                    hasEffects.push(template?.name || effectId);
                }
            }
            return {
                id: actor.id,
                name: actor.name,
                subtitle: actor.type,
                img: actor.img || 'icons/svg/mystery-man.svg',
                selected: this.selectedTargetIds.has(actor.id),
                hasEffects: hasEffects.length > 0,
                existingEffects: hasEffects.join(', ')
            };
        });
    }

    _getWallTargets() {
        if (!canvas?.scene) return [];
        const allWalls = canvas.scene.walls?.contents || [];
        let walls = allWalls.filter(w => w.door > 0);
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            walls = walls.filter(w => {
                const label = w.doorLabel || `Door ${w.id.slice(0, 6)}`;
                return label.toLowerCase().includes(query);
            });
        }
        return walls.map(wall => {
            const hasEffects = this._checkDocEffects(wall);
            return {
                id: wall.id,
                name: wall.doorLabel || `Door ${wall.id.slice(0, 6)}`,
                subtitle: `Door (${wall.door === 1 ? 'Standard' : wall.door === 2 ? 'Secret' : 'Other'})`,
                img: 'icons/svg/door-steel.svg',
                selected: this.selectedTargetIds.has(wall.id),
                hasEffects: hasEffects.length > 0,
                existingEffects: hasEffects.join(', ')
            };
        });
    }

    _getTileTargets() {
        if (!canvas?.scene) return [];
        let tiles = canvas.scene.tiles?.contents || [];
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            tiles = tiles.filter(t => {
                const label = t.texture?.src?.split('/').pop() || `Tile ${t.id.slice(0, 6)}`;
                return label.toLowerCase().includes(query);
            });
        }
        return tiles.map(tile => {
            const hasEffects = this._checkDocEffects(tile);
            const textureName = tile.texture?.src?.split('/').pop() || 'Unknown';
            return {
                id: tile.id,
                name: textureName,
                subtitle: `Tile (${Math.round(tile.width)}x${Math.round(tile.height)})`,
                img: tile.texture?.src || 'icons/svg/tile.svg',
                selected: this.selectedTargetIds.has(tile.id),
                hasEffects: hasEffects.length > 0,
                existingEffects: hasEffects.join(', ')
            };
        });
    }

    _getRegionTargets() {
        if (!canvas?.scene) return [];
        let regions = canvas.scene.regions?.contents || [];
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            regions = regions.filter(r => {
                const label = r.name || `Region ${r.id.slice(0, 6)}`;
                return label.toLowerCase().includes(query);
            });
        }
        return regions.map(region => {
            const hasEffects = this._checkDocEffects(region);
            return {
                id: region.id,
                name: region.name || `Region ${region.id.slice(0, 6)}`,
                subtitle: 'Region',
                img: 'icons/svg/polygon.svg',
                selected: this.selectedTargetIds.has(region.id),
                hasEffects: hasEffects.length > 0,
                existingEffects: hasEffects.join(', ')
            };
        });
    }

    _getSceneTargets() {
        if (!canvas?.scene) return [];
        const scene = canvas.scene;
        const hasEffects = this._checkDocEffects(scene);
        return [{
            id: scene.id,
            name: scene.name,
            subtitle: 'Current Scene',
            img: scene.thumbnail || 'icons/svg/village.svg',
            selected: this.selectedTargetIds.has(scene.id),
            hasEffects: hasEffects.length > 0,
            existingEffects: hasEffects.join(', ')
        }];
    }

    /**
     * Check which selected effects a document already has
     * @param {Document} doc
     * @returns {Array<string>} Effect names that are already applied
     */
    _checkDocEffects(doc) {
        const result = [];
        for (const effectId of this.selectedEffectIds) {
            if (this.manager.hasEffect(doc, effectId)) {
                const template = this.manager.getEffectTemplate(effectId);
                result.push(template?.name || effectId);
            }
        }
        return result;
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        // Effect selection
        html.find('.effect-checkbox').on('change', this._onEffectToggle.bind(this));
        html.find('.select-all-effects').on('click', this._onSelectAllEffects.bind(this));
        html.find('.deselect-all-effects').on('click', this._onDeselectAllEffects.bind(this));
        
        // Target selection (checkbox list for actors/scene)
        html.find('.target-checkbox').on('change', this._onTargetToggle.bind(this));
        html.find('.target-item').on('click', this._onTargetClick.bind(this));
        html.find('.select-all-targets').on('click', this._onSelectAllTargets.bind(this));
        html.find('.deselect-all-targets').on('click', this._onDeselectAllTargets.bind(this));
        
        // Target picker (dropdown + canvas picker for doors/tiles/regions)
        html.find('.target-picker-select').on('change', this._onAddTarget.bind(this));
        html.find('.remove-target-card').on('click', this._onRemoveTarget.bind(this));
        html.find('.pick-from-canvas-btn').on('click', this._onPickFromCanvas.bind(this));
        
        // Target type tabs
        html.find('.target-type-tab').on('click', this._onTargetTypeChange.bind(this));
        
        // Filters
        html.find('.filter-actor-type').on('change', this._onFilterActorType.bind(this));
        html.find('.filter-in-scene').on('change', this._onFilterInScene.bind(this));
        html.find('.target-search-input').on('input', this._onTargetSearch.bind(this));
        
        // Effect filters
        html.find('.filter-effect-category').on('change', this._onFilterEffectCategory.bind(this));
        html.find('.filter-effect-tag').on('change', this._onFilterEffectTag.bind(this));
        html.find('.effect-search-input').on('input', this._onEffectSearch.bind(this));
        html.find('.clear-filters-label').on('click', this._onClearEffectFilters.bind(this));
        
        // Actions
        html.find('.apply-effects-btn').on('click', this._onApplyEffects.bind(this));
        html.find('.remove-effects-btn').on('click', this._onRemoveEffects.bind(this));
        html.find('.cancel-btn').on('click', () => this.close());
        
        // Wizard navigation
        html.find('.next-step-btn').on('click', this._onNextStep.bind(this));
        html.find('.prev-step-btn').on('click', this._onPrevStep.bind(this));
        html.find('.wizard-step').on('click', this._onStepClick.bind(this));
    }
    
    _onNextStep(event) {
        event.preventDefault();
        if (this.selectedEffectIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoEffectsSelected'));
            return;
        }
        this.currentStep = 2;
        this.render(false);
    }
    
    _onPrevStep(event) {
        event.preventDefault();
        this.currentStep = 1;
        this.render(false);
    }
    
    _onStepClick(event) {
        event.preventDefault();
        const step = parseInt(event.currentTarget.dataset.step);
        if (step === 2 && this.selectedEffectIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoEffectsSelected'));
            return;
        }
        this.currentStep = step;
        this.render(false);
    }

    _onEffectToggle(event) {
        const effectId = event.currentTarget.dataset.effectId;
        if (event.currentTarget.checked) {
            this.selectedEffectIds.add(effectId);
        } else {
            this.selectedEffectIds.delete(effectId);
        }
        this.render(false);
    }

    _onSelectAllEffects(event) {
        event.preventDefault();
        const effects = this.manager.getAllEffectTemplates();
        effects.forEach(e => this.selectedEffectIds.add(e.id));
        this.render(false);
    }

    _onDeselectAllEffects(event) {
        event.preventDefault();
        this.selectedEffectIds.clear();
        this.render(false);
    }

    _onTargetTypeChange(event) {
        event.preventDefault();
        const newType = event.currentTarget.dataset.targetType;
        if (newType !== this.selectedTargetType) {
            this.selectedTargetType = newType;
            this.selectedTargetIds.clear();
            this.searchQuery = '';
            this.render(false);
        }
    }

    _onTargetToggle(event) {
        event.stopPropagation();
        const targetId = event.currentTarget.dataset.targetId;
        if (event.currentTarget.checked) {
            this.selectedTargetIds.add(targetId);
        } else {
            this.selectedTargetIds.delete(targetId);
        }
        
        const targetsList = this.element.find('.targets-list');
        const scrollTop = targetsList.scrollTop();
        this.render(false);
        setTimeout(() => { targetsList.scrollTop(scrollTop); }, 0);
    }

    _onTargetClick(event) {
        if (event.target.type === 'checkbox') return;
        const targetId = event.currentTarget.dataset.targetId;
        if (this.selectedTargetIds.has(targetId)) {
            this.selectedTargetIds.delete(targetId);
        } else {
            this.selectedTargetIds.add(targetId);
        }
        
        const targetsList = this.element.find('.targets-list');
        const scrollTop = targetsList.scrollTop();
        this.render(false);
        setTimeout(() => { targetsList.scrollTop(scrollTop); }, 0);
    }

    _onSelectAllTargets(event) {
        event.preventDefault();
        this.element.find('.target-item').each((i, el) => {
            this.selectedTargetIds.add(el.dataset.targetId);
        });
        
        const targetsList = this.element.find('.targets-list');
        const scrollTop = targetsList.scrollTop();
        this.render(false);
        setTimeout(() => { targetsList.scrollTop(scrollTop); }, 0);
    }

    _onDeselectAllTargets(event) {
        event.preventDefault();
        this.selectedTargetIds.clear();
        
        const targetsList = this.element.find('.targets-list');
        const scrollTop = targetsList.scrollTop();
        this.render(false);
        setTimeout(() => { targetsList.scrollTop(scrollTop); }, 0);
    }

    _onAddTarget(event) {
        const targetId = event.currentTarget.value;
        if (!targetId) return;
        this.selectedTargetIds.add(targetId);
        this.render(false);
    }

    _onRemoveTarget(event) {
        event.preventDefault();
        event.stopPropagation();
        const targetId = event.currentTarget.dataset.targetId;
        if (targetId) {
            this.selectedTargetIds.delete(targetId);
            this.render(false);
        }
    }

    _onPickFromCanvas(event) {
        event.preventDefault();
        this._startPickFromCanvas(this.selectedTargetType);
    }

    /**
     * Start canvas pick mode — activate the relevant layer, listen for control hook
     * @param {string} targetType - 'wall', 'tile', or 'region'
     */
    _startPickFromCanvas(targetType) {
        if (!canvas?.ready) {
            ui.notifications?.warn('Canvas not ready');
            return;
        }
        this._stopPickMode();
        const previousLayer = canvas.activeLayer?.options?.name;
        this._pickMode = { targetType, previousLayer };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') this._stopPickMode();
        };

        const onPicked = (id) => {
            if (!id) return;
            this.selectedTargetIds.add(id);
            this._stopPickMode();
            this.render(false);
        };

        switch (targetType) {
            case 'wall': {
                ui.notifications?.info('Click a door on the canvas. Press Escape to cancel.');
                try { canvas.walls?.activate(); } catch (e) { /* ignore */ }
                const handler = (wall, controlled) => {
                    if (!controlled || !this._pickMode) return;
                    onPicked(wall?.document?.id);
                };
                this._pickHandlers = { hook: 'controlWall', handler, onKeyDown };
                Hooks.on('controlWall', handler);
                break;
            }
            case 'tile': {
                ui.notifications?.info('Click a tile on the canvas. Press Escape to cancel.');
                try { canvas.tiles?.activate(); } catch (e) { /* ignore */ }
                const handler = (tile, controlled) => {
                    if (!controlled || !this._pickMode) return;
                    onPicked(tile?.document?.id);
                };
                this._pickHandlers = { hook: 'controlTile', handler, onKeyDown };
                Hooks.on('controlTile', handler);
                break;
            }
            case 'region': {
                ui.notifications?.info('Click a region on the canvas. Press Escape to cancel.');
                try { canvas.regions?.activate(); } catch (e) { /* ignore */ }
                const handler = (region, controlled) => {
                    if (!controlled || !this._pickMode) return;
                    onPicked(region?.document?.id || region?.id);
                };
                this._pickHandlers = { hook: 'controlRegion', handler, onKeyDown };
                Hooks.on('controlRegion', handler);
                break;
            }
            default:
                return;
        }
        document.addEventListener('keydown', onKeyDown);
    }

    _stopPickMode() {
        if (this._pickHandlers) {
            if (this._pickHandlers.hook && this._pickHandlers.handler) {
                Hooks.off(this._pickHandlers.hook, this._pickHandlers.handler);
            }
            if (this._pickHandlers.onKeyDown) {
                document.removeEventListener('keydown', this._pickHandlers.onKeyDown);
            }
        }
        const previousLayer = this._pickMode?.previousLayer;
        this._pickMode = null;
        this._pickHandlers = null;
        if (previousLayer && canvas?.[previousLayer]?.activate) {
            try { canvas[previousLayer].activate(); } catch (e) { /* ignore */ }
        }
    }

    async close(options) {
        this._stopPickMode();
        return super.close(options);
    }

    _onFilterActorType(event) {
        this.filterActorType = event.currentTarget.value;
        this.render(false);
    }

    _onFilterInScene(event) {
        this.filterInScene = event.currentTarget.checked;
        this.render(false);
    }

    _onTargetSearch(event) {
        this.searchQuery = event.currentTarget.value;
        this.render(false);
    }

    _onFilterEffectCategory(event) {
        this.filterEffectCategory = event.currentTarget.value;
        this.render(false);
    }

    _onFilterEffectTag(event) {
        this.filterEffectTag = event.currentTarget.value;
        this.render(false);
    }

    _onEffectSearch(event) {
        this.effectSearchQuery = event.currentTarget.value;
        this.render(false);
    }

    _onClearEffectFilters(event) {
        event.preventDefault();
        this.filterEffectCategory = '';
        this.filterEffectTag = '';
        this.effectSearchQuery = '';
        this.render(false);
    }

    /**
     * Resolve selected target IDs to actual Foundry documents
     * @returns {Array<Document>} Array of Foundry documents
     */
    _resolveSelectedTargets() {
        const ids = Array.from(this.selectedTargetIds);
        switch (this.selectedTargetType) {
            case 'actor':
                return ids.map(id => game.actors.get(id)).filter(Boolean);
            case 'wall':
                return ids.map(id => canvas.scene?.walls?.get(id)).filter(Boolean);
            case 'tile':
                return ids.map(id => canvas.scene?.tiles?.get(id)).filter(Boolean);
            case 'region':
                return ids.map(id => canvas.scene?.regions?.get(id)).filter(Boolean);
            case 'scene':
                return ids.map(id => game.scenes?.get(id)).filter(Boolean);
            default:
                return [];
        }
    }

    async _onApplyEffects(event) {
        event.preventDefault();
        
        if (this.selectedEffectIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoEffectsSelected'));
            return;
        }
        
        if (this.selectedTargetIds.size === 0) {
            ui.notifications.warn('No targets selected.');
            return;
        }
        
        const docs = this._resolveSelectedTargets();
        const effectIds = Array.from(this.selectedEffectIds);
        
        const results = await this.manager.applyEffectsToDocuments(effectIds, docs);
        
        ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectsApplied', {
            count: results.applied,
            actors: docs.length
        }));
        
        this.render(false);
    }

    async _onRemoveEffects(event) {
        event.preventDefault();
        
        if (this.selectedEffectIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoEffectsSelected'));
            return;
        }
        
        if (this.selectedTargetIds.size === 0) {
            ui.notifications.warn('No targets selected.');
            return;
        }
        
        const confirmed = await Dialog.confirm({
            title: i18n('WODSYSTEM.StatusEffects.RemoveEffects'),
            content: `<p>${i18n('WODSYSTEM.StatusEffects.ConfirmRemove', {
                effects: this.selectedEffectIds.size,
                actors: this.selectedTargetIds.size
            })}</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        const docs = this._resolveSelectedTargets();
        const effectIds = Array.from(this.selectedEffectIds);
        
        const results = await this.manager.removeEffectsFromDocuments(effectIds, docs);
        
        ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectsRemoved', {
            count: results.removed,
            actors: docs.length
        }));
        
        this.render(false);
    }

    async _updateObject(event, formData) {
        // Form submission handled by buttons
    }
}
