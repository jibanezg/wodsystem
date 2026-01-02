import { WodActiveEffect } from '../effects/wod-active-effect.js';

/**
 * Effect Manager Dialog for World of Darkness System
 * Allows creation and editing of status effects
 */
export class WodEffectManager extends FormApplication {
    constructor(actor, effectId = null, options = {}) {
        super({}, options);
        this.actor = actor;
        this.effectId = effectId;
        this.effect = effectId ? actor.effects.get(effectId) : null;
        
        // Prevent players from editing ST-created effects
        if (this.effect && !game.user.isGM) {
            const createdBy = this.effect.getFlag('wodsystem', 'createdBy');
            if (createdBy === 'storyteller') {
                ui.notifications.warn("You cannot edit effects created by the Storyteller.");
                this.effect = null; // Nullify so it won't render
                setTimeout(() => this.close(), 100);
                return;
            }
        }
    }
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "dialog", "effect-manager"],
            template: "systems/wodsystem/templates/apps/effect-manager.html",
            width: 600,
            height: "auto",
            resizable: true,
            title: "Manage Status Effect",
            closeOnSubmit: false,
            submitOnChange: false
        });
    }
    
    async getData() {
        const data = super.getData();
        
        // Auto-detect who's creating the effect
        const createdBy = game.user.isGM ? 'storyteller' : 'player';
        
        // If editing, get effect data
        if (this.effect) {
            const effectScope = this.effect.getFlag('wodsystem', 'conditionScope') || 'always';
            let conditionTargets = this.effect.getFlag('wodsystem', 'conditionTargets') || [];
            
            // Backwards compatibility: convert old single conditionTarget to array
            if (!Array.isArray(conditionTargets) && conditionTargets) {
                conditionTargets = [conditionTargets];
            }
            
            data.effect = {
                id: this.effect.id,
                name: this.effect.name,
                icon: this.effect.img || this.effect.icon || "icons/svg/aura.svg", // Use img (v12+) with fallback
                createdBy: this.effect.getFlag('wodsystem', 'createdBy') || createdBy,
                mandatory: this.effect.getFlag('wodsystem', 'mandatory') === true,
                conditionScope: effectScope,
                conditionTargets: conditionTargets, // Now an array
                hideConditionTarget: effectScope === 'always',
                changes: this.effect.changes.map(c => ({
                    key: c.key,
                    value: c.value,
                    mode: c.mode
                }))
            };
        } else {
            // New effect defaults
            data.effect = {
                name: "New Status",
                icon: "icons/svg/aura.svg",
                createdBy: createdBy,
                mandatory: createdBy === 'storyteller', // Default to true for ST effects
                conditionScope: 'always',
                conditionTargets: [], // Now an array
                hideConditionTarget: true,
                changes: []
            };
        }
        
        // Check if this is a player effect
        data.isPlayerEffect = data.effect.createdBy === 'player';
        data.isGM = game.user.isGM;
        
        // Condition scope options (EXTENSIBLE - add new scopes here in the future)
        data.conditionScopes = [
            { value: 'always', label: 'Always Active' },
            { value: 'attribute', label: 'Specific Attribute' },
            { value: 'ability', label: 'Specific Ability' },
            { value: 'advantage', label: 'Specific Advantage' }
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
                    { value: 'Strength', label: 'Strength' },
                    { value: 'Dexterity', label: 'Dexterity' },
                    { value: 'Stamina', label: 'Stamina' },
                    { value: 'Charisma', label: 'Charisma' },
                    { value: 'Manipulation', label: 'Manipulation' },
                    { value: 'Appearance', label: 'Appearance' },
                    { value: 'Perception', label: 'Perception' },
                    { value: 'Intelligence', label: 'Intelligence' },
                    { value: 'Wits', label: 'Wits' }
                ];
            
            case 'ability':
                // Start with primary abilities
                const abilities = [
                    // Talents
                    { value: 'Alertness', label: 'Alertness (Talent)' },
                    { value: 'Athletics', label: 'Athletics (Talent)' },
                    { value: 'Awareness', label: 'Awareness (Talent)' },
                    { value: 'Brawl', label: 'Brawl (Talent)' },
                    { value: 'Empathy', label: 'Empathy (Talent)' },
                    { value: 'Expression', label: 'Expression (Talent)' },
                    { value: 'Intimidation', label: 'Intimidation (Talent)' },
                    { value: 'Leadership', label: 'Leadership (Talent)' },
                    { value: 'Streetwise', label: 'Streetwise (Talent)' },
                    { value: 'Subterfuge', label: 'Subterfuge (Talent)' },
                    // Skills
                    { value: 'Animal Ken', label: 'Animal Ken (Skill)' },
                    { value: 'Crafts', label: 'Crafts (Skill)' },
                    { value: 'Drive', label: 'Drive (Skill)' },
                    { value: 'Etiquette', label: 'Etiquette (Skill)' },
                    { value: 'Firearms', label: 'Firearms (Skill)' },
                    { value: 'Larceny', label: 'Larceny (Skill)' },
                    { value: 'Melee', label: 'Melee (Skill)' },
                    { value: 'Performance', label: 'Performance (Skill)' },
                    { value: 'Stealth', label: 'Stealth (Skill)' },
                    { value: 'Survival', label: 'Survival (Skill)' },
                    // Knowledges
                    { value: 'Academics', label: 'Academics (Knowledge)' },
                    { value: 'Computer', label: 'Computer (Knowledge)' },
                    { value: 'Finance', label: 'Finance (Knowledge)' },
                    { value: 'Investigation', label: 'Investigation (Knowledge)' },
                    { value: 'Law', label: 'Law (Knowledge)' },
                    { value: 'Medicine', label: 'Medicine (Knowledge)' },
                    { value: 'Occult', label: 'Occult (Knowledge)' },
                    { value: 'Politics', label: 'Politics (Knowledge)' },
                    { value: 'Science', label: 'Science (Knowledge)' },
                    { value: 'Technology', label: 'Technology (Knowledge)' }
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
                                    label: `${talent.name} (Secondary Talent)`
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
                                    label: `${skill.name} (Secondary Skill)`
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
                                    label: `${knowledge.name} (Secondary Knowledge)`
                                });
                            }
                        });
                    }
                }
                
                return abilities;
            
            case 'advantage':
                return [
                    { value: 'Willpower', label: 'Willpower' },
                    { value: 'Enlightenment', label: 'Enlightenment (Arete)' },
                    { value: 'Background', label: 'Background (Any)' }
                ];
            
            // FUTURE: Add cases for 'soak', 'damage', etc.
            
            default:
                return [];
        }
    }
    
    activateListeners(html) {
        super.activateListeners(html);
        
        html.find('.add-modifier-row').click(this._onAddModifier.bind(this));
        html.find('.remove-modifier-row').click(this._onRemoveModifier.bind(this));
        html.find('.save-effect').click(this._onSaveEffect.bind(this));
        html.find('.cancel-effect').click(() => this.close());
        
        // Dynamic condition target dropdown
        html.find('.condition-scope-select').change(this._onConditionScopeChange.bind(this));
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
        
        const modifierList = this.element.find('.effect-modifiers .modifiers-list');
        const index = modifierList.find('.modifier-row').length;
        
        const newRow = $(`
            <div class="modifier-row">
                <select class="modifier-type" name="modifiers.${index}.key">
                    <option value="pool">Pool Dice</option>
                    <option value="difficulty">Difficulty</option>
                    <option value="autoSuccess">Auto Success</option>
                    <option value="autoFail">Auto Fail</option>
                </select>
                <input type="number" class="modifier-value" name="modifiers.${index}.value" value="0" placeholder="+2 or -2" />
                <button type="button" class="remove-modifier-row"><i class="fas fa-times"></i></button>
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
    
    async _onSaveEffect(event) {
        event.preventDefault();
        
        const form = this.element.find('form')[0];
        
        // Use the correct FormDataExtended based on Foundry version
        const FormDataClass = foundry.applications?.ux?.FormDataExtended || FormDataExtended;
        const formData = new FormDataClass(form).object;
        
        console.log('WodEffectManager - Raw formData:', formData);
        
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
        
        console.log('WodEffectManager - Processed changes:', changes);
        
        // Get selected targets from checkboxes - Filter out nulls and ensure it's an array
        let conditionTargets = formData.conditionTargets || [];
        if (typeof conditionTargets === 'string') {
            conditionTargets = [conditionTargets];
        }
        // Filter out null/undefined values
        conditionTargets = conditionTargets.filter(target => target !== null && target !== undefined && target !== '');
        
        console.log('WodEffectManager - Condition targets (filtered):', conditionTargets);
        
        // Prepare effect data
        const effectData = {
            name: formData.name || "New Status",
            img: formData.icon || "icons/svg/aura.svg", // Use img instead of icon (Foundry v12+)
            changes: changes,
            flags: {
                wodsystem: {
                    createdBy: formData.createdBy || (game.user.isGM ? 'storyteller' : 'player'),
                    mandatory: formData.mandatory === true || formData.mandatory === 'true',
                    conditionScope: formData.conditionScope || 'always',
                    conditionTargets: conditionTargets // Now an array
                }
            }
        };
        
        console.log('WodEffectManager - Final effectData:', effectData);
        
        // Create or update effect
        if (this.effect) {
            console.log('WodEffectManager - Updating existing effect:', this.effect.id);
            await this.effect.update(effectData);
            ui.notifications.info(`Effect "${effectData.name}" updated!`);
        } else {
            console.log('WodEffectManager - Creating new effect');
            await this.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
            ui.notifications.info(`Effect "${effectData.name}" created!`);
        }
        
        // Force actor sheet to re-render
        if (this.actor.sheet.rendered) {
            this.actor.sheet.render(false);
        }
        
        this.close();
    }
    
    async _updateObject(event, formData) {
        // This is called on form submit, but we're handling it manually with the save button
        // So we can leave this empty
    }
}

