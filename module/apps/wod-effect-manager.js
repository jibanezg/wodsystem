import { WodActiveEffect } from '../effects/wod-active-effect.js';
import { i18n } from '../helpers/i18n.js';

/**
 * WoD Effect Editor Dialog
 * Generic effect editor that works for both templates and actor effects
 */
export class WodEffectEditor extends FormApplication {
    constructor(target = null, effectId = null, options = {}) {
        // Determine mode from options
        const mode = options.mode || 'actor'; // 'template' or 'actor'
        const effectData = options.effectData || null; // For template mode
        
        // Set title in options if not provided, using i18n if available
        if (!options.title) {
            const titleKey = mode === 'template' 
                ? "WODSYSTEM.StatusEffects.CreateEffect" 
                : "WODSYSTEM.EffectManager.ManageStatusEffect";
            if (game?.i18n) {
                const localized = game.i18n.localize(titleKey);
                options.title = (localized !== titleKey) ? localized : "Effect Editor";
            } else {
                options.title = "Effect Editor";
            }
        }
        
        super({}, options);
        
        // Now we can safely set instance properties
        this.mode = mode;
        this.effectData = effectData;
        
        // Set up based on mode
        if (this.mode === 'template') {
            this.actor = null; // Templates don't need actors
            this.effect = this.effectData;
        } else {
            this.actor = target; // Actor effects need actors
            this.effect = effectId ? target.effects.get(effectId) : null;
        }
        
        this.effectId = effectId;
        
        // Prevent players from editing ST-created effects
        if (this.effect && !game.user.isGM) {
            const createdBy = this.effect.getFlag('wodsystem', 'createdBy');
            if (createdBy === 'storyteller') {
                const message = game?.i18n?.localize("WODSYSTEM.EffectManager.CannotEditSTEffects") || "You cannot edit effects created by the Storyteller.";
                ui.notifications.warn(message);
                this.effect = null; // Nullify so it won't render
                setTimeout(() => this.close(), 100);
                return;
            }
        }
    }
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod-effect-manager", "wod-effect-editor"],
            template: "systems/wodsystem/templates/apps/effect-manager.html",
            width: 600,
            height: 800,
            resizable: true,
            title: "Effect Editor",
            closeOnSubmit: false,
            submitOnChange: false
        });
    }
    
    async getData() {
                const data = super.getData();
        
        // Auto-detect who's creating the effect
        const createdBy = game.user.isGM ? 'storyteller' : 'player';
        
        // Handle effect data based on mode
        if (this.effect) {
            // Editing existing effect
            let effectScope, conditionTargets, createdBy, mandatory, description, category, tags;
            
            if (this.mode === 'template') {
                // Template mode - effect is already template data
                effectScope = this.effect.conditionScope || 'always';
                conditionTargets = this.effect.conditionTargets || [];
                createdBy = this.effect.createdBy || 'storyteller';
                mandatory = this.effect.mandatory || false;
                description = this.effect.description || '';
                category = this.effect.category || '';
                tags = this.effect.tags || [];
            } else {
                // Actor mode - get from actor effect flags
                effectScope = this.effect.getFlag('wodsystem', 'conditionScope') || 'always';
                conditionTargets = this.effect.getFlag('wodsystem', 'conditionTargets') || [];
                createdBy = this.effect.getFlag('wodsystem', 'createdBy') || createdBy;
                mandatory = this.effect.getFlag('wodsystem', 'mandatory') === true;
                description = this.effect.description || '';
                category = this.effect.getFlag('wodsystem', 'category') || '';
                tags = this.effect.getFlag('wodsystem', 'tags') || [];
            }
            
            // Backwards compatibility: convert old single conditionTarget to array
            if (!Array.isArray(conditionTargets) && conditionTargets) {
                conditionTargets = [conditionTargets];
            }
            
            const documentTypes = (this.mode === 'template') 
                ? (this.effect.documentTypes || []) 
                : (this.effect.getFlag?.('wodsystem', 'documentTypes') || []);
            
            data.effect = {
                id: this.effect.id,
                name: this.effect.name,
                icon: this.effect.img || this.effect.icon || "icons/svg/aura.svg",
                createdBy: createdBy,
                mandatory: mandatory,
                conditionScope: effectScope,
                conditionTargets: conditionTargets,
                hideConditionTarget: effectScope === 'always',
                description: description,
                category: category,
                tags: tags,
                tagSystem: tags.includes('System'),
                tagAutomatic: tags.includes('Automatic'),
                tagPlayer: tags.includes('Player'),
                tagStoryteller: tags.includes('Storyteller'),
                documentTypes: documentTypes,
                docTypeActor: documentTypes.includes('actor'),
                docTypeWall: documentTypes.includes('wall'),
                docTypeTile: documentTypes.includes('tile'),
                docTypeRegion: documentTypes.includes('region'),
                docTypeScene: documentTypes.includes('scene'),
                changes: this.effect.changes?.map(c => ({
                    key: c.key,
                    value: c.value,
                    mode: c.mode
                })) || [],
                tokenEffects: (() => {
                    const te = (this.mode === 'template')
                        ? (this.effect.tokenEffects || null)
                        : (this.effect.getFlag?.('wodsystem', 'tokenEffects') || null);
                    return te || { light: null, vision: null };
                })()
            };
        } else {
            // New effect defaults
            data.effect = {
                name: i18n('WODSYSTEM.EffectManager.NewStatus'),
                icon: "icons/svg/aura.svg",
                createdBy: createdBy,
                mandatory: createdBy === 'storyteller',
                conditionScope: 'always',
                conditionTargets: [],
                hideConditionTarget: true,
                description: '',
                category: '',
                tags: [],
                tagSystem: false,
                tagAutomatic: false,
                tagPlayer: false,
                tagStoryteller: false,
                documentTypes: [],
                docTypeActor: false,
                docTypeWall: false,
                docTypeTile: false,
                docTypeRegion: false,
                docTypeScene: false,
                changes: [],
                tokenEffects: { light: null, vision: null }
            };
        }
        
        // Check if this is a player effect
        data.isPlayerEffect = data.effect.createdBy === 'player';
        data.isGM = game.user.isGM;
        
        // Pass mode flag to template
        data.templateMode = this.mode === 'template';
        
        // Condition scope options (EXTENSIBLE - add new scopes here in the future)
        data.conditionScopes = [
            { value: 'always', label: i18n('WODSYSTEM.EffectManager.AlwaysActive') },
            { value: 'attribute', label: i18n('WODSYSTEM.EffectManager.SpecificAttribute') },
            { value: 'ability', label: i18n('WODSYSTEM.EffectManager.SpecificAbility') },
            { value: 'advantage', label: i18n('WODSYSTEM.EffectManager.SpecificAdvantage') },
            { value: 'exclude', label: 'Exclude Specific Traits' }
            // FUTURE: Add { value: 'soak', label: 'Soak Rolls' },
            // FUTURE: Add { value: 'damage', label: 'Damage Rolls' },
        ];
        
                
        // Get targets based on current scope with checked flags
        data.conditionTargets = this._getConditionTargetsWithChecked(data.effect.conditionScope, data.effect.conditionTargets);
        
        return data;
    }
    
    /**
     * Get available targets based on condition scope with checked flags
     * @param {string} scope - The condition scope
     * @param {Array} selectedTargets - Array of selected target values
     * @returns {Array} Targets with checked flags
     */
    _getConditionTargetsWithChecked(scope, selectedTargets = []) {
        const targets = this._getConditionTargets(scope);
        return targets.map(target => ({
            ...target,
            checked: selectedTargets.includes(target.value)
        }));
    }
    
    /**
     * Get available targets based on condition scope
     * EXTENSIBLE: Add new cases here when adding new scope types
     */
    _getConditionTargets(scope) {
        switch(scope) {
            case 'attribute':
                return [
                    { value: 'Strength', label: game.i18n.localize('WODSYSTEM.Attributes.Strength') },
                    { value: 'Dexterity', label: game.i18n.localize('WODSYSTEM.Attributes.Dexterity') },
                    { value: 'Stamina', label: game.i18n.localize('WODSYSTEM.Attributes.Stamina') },
                    { value: 'Charisma', label: game.i18n.localize('WODSYSTEM.Attributes.Charisma') },
                    { value: 'Manipulation', label: game.i18n.localize('WODSYSTEM.Attributes.Manipulation') },
                    { value: 'Appearance', label: game.i18n.localize('WODSYSTEM.Attributes.Appearance') },
                    { value: 'Perception', label: game.i18n.localize('WODSYSTEM.Attributes.Perception') },
                    { value: 'Intelligence', label: game.i18n.localize('WODSYSTEM.Attributes.Intelligence') },
                    { value: 'Wits', label: game.i18n.localize('WODSYSTEM.Attributes.Wits') }
                ];
            
            case 'ability':
                // Start with primary abilities
                const talentSuffix = game.i18n.localize('WODSYSTEM.Abilities.TalentSuffix');
                const skillSuffix = game.i18n.localize('WODSYSTEM.Abilities.SkillSuffix');
                const knowledgeSuffix = game.i18n.localize('WODSYSTEM.Abilities.KnowledgeSuffix');
                const abilities = [
                    // Talents
                    { value: 'Alertness', label: `${game.i18n.localize('WODSYSTEM.Abilities.Alertness')} ${talentSuffix}` },
                    { value: 'Athletics', label: `${game.i18n.localize('WODSYSTEM.Abilities.Athletics')} ${talentSuffix}` },
                    { value: 'Awareness', label: `${game.i18n.localize('WODSYSTEM.Abilities.Awareness')} ${talentSuffix}` },
                    { value: 'Brawl', label: `${game.i18n.localize('WODSYSTEM.Abilities.Brawl')} ${talentSuffix}` },
                    { value: 'Empathy', label: `${game.i18n.localize('WODSYSTEM.Abilities.Empathy')} ${talentSuffix}` },
                    { value: 'Expression', label: `${game.i18n.localize('WODSYSTEM.Abilities.Expression')} ${talentSuffix}` },
                    { value: 'Intimidation', label: `${game.i18n.localize('WODSYSTEM.Abilities.Intimidation')} ${talentSuffix}` },
                    { value: 'Leadership', label: `${game.i18n.localize('WODSYSTEM.Abilities.Leadership')} ${talentSuffix}` },
                    { value: 'Streetwise', label: `${game.i18n.localize('WODSYSTEM.Abilities.Streetwise')} ${talentSuffix}` },
                    { value: 'Subterfuge', label: `${game.i18n.localize('WODSYSTEM.Abilities.Subterfuge')} ${talentSuffix}` },
                    // Skills
                    { value: 'Animal Ken', label: `${game.i18n.localize('WODSYSTEM.Abilities.AnimalKen')} ${skillSuffix}` },
                    { value: 'Crafts', label: `${game.i18n.localize('WODSYSTEM.Abilities.Crafts')} ${skillSuffix}` },
                    { value: 'Drive', label: `${game.i18n.localize('WODSYSTEM.Abilities.Drive')} ${skillSuffix}` },
                    { value: 'Etiquette', label: `${game.i18n.localize('WODSYSTEM.Abilities.Etiquette')} ${skillSuffix}` },
                    { value: 'Firearms', label: `${game.i18n.localize('WODSYSTEM.Abilities.Firearms')} ${skillSuffix}` },
                    { value: 'Larceny', label: `${game.i18n.localize('WODSYSTEM.Abilities.Larceny')} ${skillSuffix}` },
                    { value: 'Melee', label: `${game.i18n.localize('WODSYSTEM.Abilities.Melee')} ${skillSuffix}` },
                    { value: 'Performance', label: `${game.i18n.localize('WODSYSTEM.Abilities.Performance')} ${skillSuffix}` },
                    { value: 'Stealth', label: `${game.i18n.localize('WODSYSTEM.Abilities.Stealth')} ${skillSuffix}` },
                    { value: 'Survival', label: `${game.i18n.localize('WODSYSTEM.Abilities.Survival')} ${skillSuffix}` },
                    // Knowledges
                    { value: 'Academics', label: `${game.i18n.localize('WODSYSTEM.Abilities.Academics')} ${knowledgeSuffix}` },
                    { value: 'Computer', label: `${game.i18n.localize('WODSYSTEM.Abilities.Computer')} ${knowledgeSuffix}` },
                    { value: 'Finance', label: `${game.i18n.localize('WODSYSTEM.Abilities.Finance')} ${knowledgeSuffix}` },
                    { value: 'Investigation', label: `${game.i18n.localize('WODSYSTEM.Abilities.Investigation')} ${knowledgeSuffix}` },
                    { value: 'Law', label: `${game.i18n.localize('WODSYSTEM.Abilities.Law')} ${knowledgeSuffix}` },
                    { value: 'Medicine', label: `${game.i18n.localize('WODSYSTEM.Abilities.Medicine')} ${knowledgeSuffix}` },
                    { value: 'Occult', label: `${game.i18n.localize('WODSYSTEM.Abilities.Occult')} ${knowledgeSuffix}` },
                    { value: 'Politics', label: `${game.i18n.localize('WODSYSTEM.Abilities.Politics')} ${knowledgeSuffix}` },
                    { value: 'Science', label: `${game.i18n.localize('WODSYSTEM.Abilities.Science')} ${knowledgeSuffix}` },
                    { value: 'Technology', label: `${game.i18n.localize('WODSYSTEM.Abilities.Technology')} ${knowledgeSuffix}` }
                ];
                
                // Add secondary abilities if actor is available
                if (this.actor) {
                    const secondaryAbilities = this.actor.system.secondaryAbilities || {};
                    
                    // Process talents
                    if (secondaryAbilities.talents) {
                        const talents = Array.isArray(secondaryAbilities.talents) 
                            ? secondaryAbilities.talents 
                            : Object.values(secondaryAbilities.talents);
                        
                        talents.forEach(talent => {
                            if (talent.name) {
                                abilities.push({
                                    value: talent.name,
                                    label: `${talent.name} (${i18n('WODSYSTEM.EffectManager.SecondaryTalent')})`
                                });
                            }
                        });
                    }
                    
                    // Process skills
                    if (secondaryAbilities.skills) {
                        const skills = Array.isArray(secondaryAbilities.skills) 
                            ? secondaryAbilities.skills 
                            : Object.values(secondaryAbilities.skills);
                        
                        skills.forEach(skill => {
                            if (skill.name) {
                                abilities.push({
                                    value: skill.name,
                                    label: `${skill.name} (${i18n('WODSYSTEM.EffectManager.SecondarySkill')})`
                                });
                            }
                        });
                    }
                    
                    // Process knowledges
                    if (secondaryAbilities.knowledges) {
                        const knowledges = Array.isArray(secondaryAbilities.knowledges) 
                            ? secondaryAbilities.knowledges 
                            : Object.values(secondaryAbilities.knowledges);
                        
                        knowledges.forEach(knowledge => {
                            if (knowledge.name) {
                                abilities.push({
                                    value: knowledge.name,
                                    label: `${knowledge.name} (${i18n('WODSYSTEM.EffectManager.SecondaryKnowledge')})`
                                });
                            }
                        });
                    }
                }
                
                return abilities;
            
            case 'advantage':
                return [
                    { value: 'Willpower', label: game.i18n.localize('WODSYSTEM.Advantages.Willpower') },
                    { value: 'Enlightenment', label: `${game.i18n.localize('WODSYSTEM.Advantages.Enlightenment')} (Arete)` },
                    { value: 'Background', label: `${game.i18n.localize('WODSYSTEM.Advantages.Backgrounds')} (Any)` }
                ];
            
            case 'exclude':
                // For exclude scope, show all possible traits that can be excluded
                return [
                    // Attributes
                    { value: 'Strength', label: game.i18n.localize('WODSYSTEM.Attributes.Strength') },
                    { value: 'Dexterity', label: game.i18n.localize('WODSYSTEM.Attributes.Dexterity') },
                    { value: 'Stamina', label: game.i18n.localize('WODSYSTEM.Attributes.Stamina') },
                    { value: 'Charisma', label: game.i18n.localize('WODSYSTEM.Attributes.Charisma') },
                    { value: 'Manipulation', label: game.i18n.localize('WODSYSTEM.Attributes.Manipulation') },
                    { value: 'Appearance', label: game.i18n.localize('WODSYSTEM.Attributes.Appearance') },
                    { value: 'Perception', label: game.i18n.localize('WODSYSTEM.Attributes.Perception') },
                    { value: 'Intelligence', label: game.i18n.localize('WODSYSTEM.Attributes.Intelligence') },
                    { value: 'Wits', label: game.i18n.localize('WODSYSTEM.Attributes.Wits') },
                    // Advantages
                    { value: 'Willpower', label: game.i18n.localize('WODSYSTEM.Advantages.Willpower') },
                    { value: 'Enlightenment', label: `${game.i18n.localize('WODSYSTEM.Advantages.Enlightenment')} (Arete)` },
                    { value: 'Background', label: `${game.i18n.localize('WODSYSTEM.Advantages.Backgrounds')} (Any)` }
                ];
            
            // FUTURE: Add cases for 'soak', 'damage', etc.
            
            default:
                return [];
        }
    }
    
    activateListeners(html) {
        super.activateListeners(html);
        
        // Apply theme class to dialog window (not just form)
        const actorTypeLower = (this.actor && this.actor.type) ? this.actor.type.toLowerCase() : "mortal";
        
        // Apply theme to form
        html[0].classList.add(actorTypeLower);
        
        // Apply theme to dialog window element
        const dialogElement = html[0].closest('.window-app');
        if (dialogElement) {
            dialogElement.classList.add(actorTypeLower);
        }
        
        // Use only the working event listener
        html.find('.add-modifier-row').on('click', this._onAddModifier.bind(this));
        
                html.find('.remove-modifier-row').click(this._onRemoveModifier.bind(this));
        html.find('.save-effect').click(this._onSaveEffect.bind(this));
        html.find('.cancel-effect').click(() => this.close());
        
        // Token effects toggle listeners
        html.find('.toggle-light-section').on('change', (ev) => {
            html.find('.light-config-fields').toggle(ev.currentTarget.checked);
        });
        html.find('.toggle-vision-section').on('change', (ev) => {
            html.find('.vision-config-fields').toggle(ev.currentTarget.checked);
            if (ev.currentTarget.checked) {
                this._updateVisionAngleVisibility(html);
            }
        });
        html.find('select[name="tokenEffects.vision.visionMode"]').on('change', () => {
            this._updateVisionAngleVisibility(html);
        });
        
        // File picker for icons - simplified to avoid offsetWidth errors
        html.find('.file-picker').on('click', (ev) => {
            const target = ev.currentTarget.dataset.target;
            const input = html.find(`input[name="${target}"]`);
            
            // Simple prompt fallback if FilePicker fails
            const fallbackPrompt = () => {
                const path = prompt("Enter icon path (e.g., icons/svg/aura.svg):", input.val() || "icons/svg/aura.svg");
                if (path !== null) {
                    input.val(path);
                }
            };
            
            try {
                const filePicker = new FilePicker({
                    type: 'image',
                    callback: (path) => {
                        input.val(path);
                    },
                    // Minimal configuration to avoid positioning issues
                    forceLoad: true
                });
                
                // Override the problematic method if it exists
                if (filePicker._updatePosition) {
                    const originalUpdatePosition = filePicker._updatePosition;
                    filePicker._updatePosition = function(...args) {
                        try {
                            return originalUpdatePosition.apply(this, args);
                        } catch (error) {
                            console.warn('FilePicker _updatePosition error, using fallback:', error);
                            return;
                        }
                    };
                }
                
                filePicker.render(true);
            } catch (error) {
                console.warn('FilePicker failed, using prompt fallback:', error);
                fallbackPrompt();
            }
        });
        
        // Dynamic condition target dropdown
        html.find('.condition-scope-select').change(this._onConditionScopeChange.bind(this));
        
        // Set initial visibility state based on current scope selection
        const initialScope = html.find('.condition-scope-select').val();
        const targetGroup = html.find('.condition-target-group');
        const targetCheckboxesContainer = html.find('.condition-targets-checkboxes');
        
        if (initialScope === 'always') {
            targetGroup.hide();
        } else {
            // Show and populate target checkboxes for initial state
            targetGroup.show();
            
            // Get available targets for this scope
            const targets = this._getConditionTargets(initialScope);
            
            // Clear and populate the checkboxes
            targetCheckboxesContainer.empty();
            
            targets.forEach(target => {
                const checkbox = $(`
                    <label class="condition-target-checkbox">
                        <input type="checkbox" name="conditionTargets" value="${target.value}" />
                        <span>${target.label}</span>
                    </label>
                `);
                targetCheckboxesContainer.append(checkbox);
            });
        }
    }
    
    /**
     * Handle condition scope change to show/hide and populate target checkboxes
     */
    async _onConditionScopeChange(event) {
        const scope = event.currentTarget.value;
        const targetGroup = this.element.find('.condition-target-group');
        const targetCheckboxesContainer = this.element.find('.condition-targets-checkboxes');
        
        if (scope === 'always') {
            // Hide target selection for "Always Active"
            targetGroup.hide();
        } else {
            // Show and populate target checkboxes
            targetGroup.show();
            
            // Get available targets for this scope (includes secondary abilities if scope is 'ability')
            const targets = this._getConditionTargets(scope);
            
            // Clear and repopulate the checkboxes
            targetCheckboxesContainer.empty();
            
            targets.forEach(target => {
                const checkbox = $(`
                    <label class="condition-target-checkbox">
                        <input type="checkbox" name="conditionTargets" value="${target.value}" />
                        <span>${target.label}</span>
                    </label>
                `);
                targetCheckboxesContainer.append(checkbox);
            });
        }
    }
    
    async _onAddModifier(event) {
        event.preventDefault();
        
        const modifierList = this.element.find('.modifiers-list');
        const index = modifierList.find('.modifier-row').length;
        
        const newRow = $(`
            <div class="modifier-row">
                <select class="modifier-type" name="modifiers.${index}.key">
                    <option value="pool">${i18n('WODSYSTEM.EffectManager.PoolDice')}</option>
                    <option value="difficulty">${i18n('WODSYSTEM.RollDialog.Difficulty')}</option>
                    <option value="autoSuccess">${i18n('WODSYSTEM.EffectManager.AutoSuccess')}</option>
                    <option value="autoFail">${i18n('WODSYSTEM.EffectManager.AutoFail')}</option>
                </select>
                <input type="number" class="modifier-value" name="modifiers.${index}.value" value="0" placeholder="+2 or -2" />
                <i class="fas fa-trash remove-modifier-row" title="${i18n('WODSYSTEM.Common.Delete')}" style="cursor: pointer; color: #dc3545;"></i>
            </div>
        `);
        
        modifierList.append(newRow);
        newRow.find('.remove-modifier-row').click(this._onRemoveModifier.bind(this));
    }
    
    _onRemoveModifier(event) {
        event.preventDefault();
        $(event.currentTarget).closest('.modifier-row').remove();
        
        // Reindex all remaining modifier rows to avoid gaps in indices
        this._reindexModifiers();
    }
    
    /**
     * Reindex all modifier rows to ensure consecutive indices (0, 1, 2, ...)
     * This is necessary after deleting a modifier to avoid gaps
     */
    _reindexModifiers() {
        const modifierRows = this.element.find('.modifier-row');
        modifierRows.each((index, row) => {
            const $row = $(row);
            
            // Update select name
            const select = $row.find('.modifier-type');
            select.attr('name', `modifiers.${index}.key`);
            
            // Update input name
            const input = $row.find('.modifier-value');
            input.attr('name', `modifiers.${index}.value`);
        });
    }
    
    /**
     * Parse tokenEffects (light & vision) from form data
     * @param {Object} formData - The form data object
     * @returns {Object|null} tokenEffects object or null if nothing configured
     * @private
     */
    _parseTokenEffects(formData) {
        const $form = this.element.find('form');
        const lightEnabled = $form.find('.toggle-light-section').prop('checked');
        const visionEnabled = $form.find('.toggle-vision-section').prop('checked');

        if (!lightEnabled && !visionEnabled) return null;

        const tokenEffects = {};

        if (lightEnabled) {
            const dim = parseFloat($form.find('input[name="tokenEffects.light.dim"]').val()) || 0;
            const bright = parseFloat($form.find('input[name="tokenEffects.light.bright"]').val()) || 0;
            if (dim > 0 || bright > 0) {
                tokenEffects.light = {
                    dim: dim,
                    bright: bright,
                    angle: parseFloat($form.find('input[name="tokenEffects.light.angle"]').val()) || 360,
                    color: $form.find('input[name="tokenEffects.light.color"]').val() || "#ffffff",
                    alpha: parseFloat($form.find('input[name="tokenEffects.light.alpha"]').val()) || 0.5,
                    darkness: { min: 0, max: 1 }
                };
            }
        }

        if (visionEnabled) {
            const dimSight = parseFloat($form.find('input[name="tokenEffects.vision.dimSight"]').val()) || 0;
            const brightSight = parseFloat($form.find('input[name="tokenEffects.vision.brightSight"]').val()) || 0;
            const visionMode = $form.find('select[name="tokenEffects.vision.visionMode"]').val() || 'basic';
            if (dimSight > 0 || brightSight > 0 || visionMode !== 'basic') {
                tokenEffects.vision = {
                    dimSight: dimSight,
                    brightSight: brightSight,
                    visionMode: visionMode,
                    angle: parseFloat($form.find('input[name="tokenEffects.vision.angle"]').val()) || 360
                };
            }
        }

        // Return null if neither section produced data
        if (!tokenEffects.light && !tokenEffects.vision) return null;
        return tokenEffects;
    }

    /**
     * Update visibility of vision angle field based on vision mode
     * @private
     */
    _updateVisionAngleVisibility(html) {
        const visionMode = html.find('select[name="tokenEffects.vision.visionMode"]').val() || 'basic';
        const directionalModes = ['basic', 'lowlight'];
        html.find('.vision-angle-group').toggle(directionalModes.includes(visionMode));
    }

    async _onSaveEffect(event) {
        event.preventDefault();
        
        const form = this.element.find('form')[0];
        
        // Use the correct FormDataExtended based on Foundry version
        const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
        const formData = new FormDataClass(form).object;
        
        // Build changes array from modifiers - Handle flat structure from FormDataExtended
        const changes = [];
        
        // FormDataExtended creates flat properties like "modifiers.0.key" and "modifiers.0.value"
        // We need to extract and group them
        const modifierKeys = Object.keys(formData).filter(key => key.startsWith('modifiers.') && key.endsWith('.key'));
        
        for (const keyPath of modifierKeys) {
            const index = keyPath.match(/modifiers\.(\d+)\.key/)[1];
            const valueKey = `modifiers.${index}.value`;
            
            const modifierType = formData[keyPath];
            const modifierValue = formData[valueKey];
            
            if (modifierType && modifierValue !== undefined && modifierValue !== null && modifierValue !== '') {
                changes.push({
                    key: modifierType,
                    mode: 2, // ADD mode
                    value: Number(modifierValue)
                });
            }
        }
        
        // Get selected targets from checkboxes - Filter out nulls and ensure it's an array
        let conditionTargets = formData.conditionTargets || [];
        if (typeof conditionTargets === 'string') {
            conditionTargets = [conditionTargets];
        }
        // Filter out null/undefined values
        conditionTargets = conditionTargets.filter(target => target !== null && target !== undefined && target !== '');
        
        // Parse tags from checkboxes
        let selectedTags = formData.tags || [];
        if (typeof selectedTags === 'string') {
            selectedTags = [selectedTags];
        }
        
        // Parse documentTypes from checkboxes
        let documentTypes = formData.documentTypes || [];
        if (typeof documentTypes === 'string') {
            documentTypes = [documentTypes];
        }
        documentTypes = documentTypes.filter(dt => dt !== null && dt !== undefined && dt !== '');
        
        // Build tokenEffects from form data
        const tokenEffects = this._parseTokenEffects(formData);

        if (this.mode === 'template') {
            // Template mode - return template data
            const templateData = {
                name: formData.name || "New Status",
                icon: formData.icon || "icons/svg/aura.svg",
                description: formData.description || '',
                category: formData.category || '',
                tags: selectedTags,
                documentTypes: documentTypes,
                mandatory: formData.mandatory === true || formData.mandatory === 'true',
                conditionScope: formData.conditionScope || 'always',
                conditionTargets: conditionTargets,
                changes: changes,
                tokenEffects: tokenEffects
            };
            
            // Call the template save callback if provided
            if (this.options.onSave) {
                await this.options.onSave(templateData);
            }
            
            ui.notifications.info(i18n('WODSYSTEM.StatusEffects.EffectCreated', {name: templateData.name}));
        } else {
            // Actor mode - create/update actor effect
            const effectData = {
                name: formData.name || "New Status",
                img: formData.icon || "icons/svg/aura.svg",
                description: formData.description || '',
                changes: changes,
                flags: {
                    wodsystem: {
                        createdBy: formData.createdBy || (game.user.isGM ? 'storyteller' : 'player'),
                        mandatory: formData.mandatory === true || formData.mandatory === 'true',
                        conditionScope: formData.conditionScope || 'always',
                        conditionTargets: conditionTargets,
                        category: formData.category || '',
                        tags: selectedTags,
                        documentTypes: documentTypes,
                        tokenEffects: tokenEffects
                    }
                }
            };
            
            // Create or update effect
            if (this.effect) {
                await this.effect.update(effectData);
                ui.notifications.info(i18n('WODSYSTEM.EffectManager.EffectUpdated', {name: effectData.name}));
            } else {
                await this.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
                ui.notifications.info(i18n('WODSYSTEM.EffectManager.EffectCreated', {name: effectData.name}));
            }
        }
        
        // Force actor sheet to re-render
        if (this.actor?.sheet?.rendered) {
            this.actor.sheet.render(false);
        }
        
        this.close();
    }
    
    async _updateObject(event, formData) {
        // This is called on form submit, but we're handling it manually with the save button
        // So we can leave this empty
    }
}

