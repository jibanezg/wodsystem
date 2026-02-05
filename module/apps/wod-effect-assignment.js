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
        this.selectedActorIds = new Set();
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
        
        // Get all actors
        let actors = Array.from(game.actors);
        
        // Apply filters
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
        
        // Sort by name
        actors.sort((a, b) => a.name.localeCompare(b.name));
        
        // Map actors with selection state and effect status
        data.actors = actors.map(actor => {
            // Check which selected effects this actor already has
            const hasEffects = [];
            for (const effectId of this.selectedEffectIds) {
                const hasEffect = actor.effects.some(e => 
                    e.getFlag('wodsystem', 'sourceTemplateId') === effectId
                );
                if (hasEffect) {
                    const template = this.manager.getEffectTemplate(effectId);
                    hasEffects.push(template?.name || effectId);
                }
            }
            
            return {
                id: actor.id,
                name: actor.name,
                type: actor.type,
                img: actor.img || 'icons/svg/mystery-man.svg',
                selected: this.selectedActorIds.has(actor.id),
                hasEffects: hasEffects.length > 0,
                existingEffects: hasEffects.join(', ')
            };
        });
        
        // Get unique actor types for filter
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
        data.selectedCount = this.selectedActorIds.size;
        data.effectCount = this.selectedEffectIds.size;
        data.currentStep = this.currentStep;
        
        // Get selected effects for summary display in step 2 (from all effects, not filtered)
        data.selectedEffects = allEffects.filter(e => this.selectedEffectIds.has(e.id));
        
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        // Effect selection
        html.find('.effect-checkbox').on('change', this._onEffectToggle.bind(this));
        html.find('.select-all-effects').on('click', this._onSelectAllEffects.bind(this));
        html.find('.deselect-all-effects').on('click', this._onDeselectAllEffects.bind(this));
        
        // Actor selection
        html.find('.actor-checkbox').on('change', this._onActorToggle.bind(this));
        html.find('.actor-item').on('click', this._onActorClick.bind(this));
        html.find('.select-all-actors').on('click', this._onSelectAllActors.bind(this));
        html.find('.deselect-all-actors').on('click', this._onDeselectAllActors.bind(this));
        
        // Filters
        html.find('.filter-actor-type').on('change', this._onFilterActorType.bind(this));
        html.find('.filter-in-scene').on('change', this._onFilterInScene.bind(this));
        html.find('.actor-search-input').on('input', this._onActorSearch.bind(this));
        
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

    _onActorToggle(event) {
        event.stopPropagation();
        const actorId = event.currentTarget.dataset.actorId;
        if (event.currentTarget.checked) {
            this.selectedActorIds.add(actorId);
        } else {
            this.selectedActorIds.delete(actorId);
        }
        this.render(false);
    }

    _onActorClick(event) {
        // Don't toggle if clicking on checkbox
        if (event.target.type === 'checkbox') return;
        
        const actorId = event.currentTarget.dataset.actorId;
        if (this.selectedActorIds.has(actorId)) {
            this.selectedActorIds.delete(actorId);
        } else {
            this.selectedActorIds.add(actorId);
        }
        this.render(false);
    }

    _onSelectAllActors(event) {
        event.preventDefault();
        const html = this.element;
        html.find('.actor-item').each((i, el) => {
            this.selectedActorIds.add(el.dataset.actorId);
        });
        this.render(false);
    }

    _onDeselectAllActors(event) {
        event.preventDefault();
        this.selectedActorIds.clear();
        this.render(false);
    }

    _onFilterActorType(event) {
        this.filterActorType = event.currentTarget.value;
        this.render(false);
    }

    _onFilterInScene(event) {
        this.filterInScene = event.currentTarget.checked;
        this.render(false);
    }

    _onActorSearch(event) {
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

    async _onApplyEffects(event) {
        event.preventDefault();
        
        if (this.selectedEffectIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoEffectsSelected'));
            return;
        }
        
        if (this.selectedActorIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoActorsSelected'));
            return;
        }
        
        const actors = Array.from(this.selectedActorIds).map(id => game.actors.get(id)).filter(Boolean);
        const effectIds = Array.from(this.selectedEffectIds);
        
        const results = await this.manager.applyEffectsToActors(effectIds, actors);
        
        ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectsApplied', {
            count: results.applied,
            actors: actors.length
        }));
        
        this.render(false);
    }

    async _onRemoveEffects(event) {
        event.preventDefault();
        
        if (this.selectedEffectIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoEffectsSelected'));
            return;
        }
        
        if (this.selectedActorIds.size === 0) {
            ui.notifications.warn(i18n('WODSYSTEM.StatusEffects.NoActorsSelected'));
            return;
        }
        
        const confirmed = await Dialog.confirm({
            title: i18n('WODSYSTEM.StatusEffects.RemoveEffects'),
            content: `<p>${i18n('WODSYSTEM.StatusEffects.ConfirmRemove', {
                effects: this.selectedEffectIds.size,
                actors: this.selectedActorIds.size
            })}</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        const actors = Array.from(this.selectedActorIds).map(id => game.actors.get(id)).filter(Boolean);
        const effectIds = Array.from(this.selectedEffectIds);
        
        const results = await this.manager.removeEffectsFromActors(effectIds, actors);
        
        ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectsRemoved', {
            count: results.removed,
            actors: actors.length
        }));
        
        this.render(false);
    }

    async _updateObject(event, formData) {
        // Form submission handled by buttons
    }
}
