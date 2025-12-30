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
            
            data.effect = {
                id: this.effect.id,
                name: this.effect.name,
                icon: this.effect.icon,
                createdBy: this.effect.getFlag('wodsystem', 'createdBy') || createdBy,
                mandatory: this.effect.getFlag('wodsystem', 'mandatory') === true,
                hasSideEffect: this.effect.getFlag('wodsystem', 'hasSideEffect') === true,
                sideEffectAuto: this.effect.getFlag('wodsystem', 'sideEffectAuto') === true,
                conditionScope: effectScope,
                conditionTarget: this.effect.getFlag('wodsystem', 'conditionTarget') || '',
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
                hasSideEffect: false,
                sideEffectAuto: false,
                conditionScope: 'always',
                conditionTarget: '',
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
        
        // Get targets based on current scope
        data.conditionTargets = this._getConditionTargets(data.effect.conditionScope);
        
        return data;
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
                return [
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
        html.find('.delete-effect').click(this._onDeleteEffect.bind(this));
        html.find('.cancel-effect').click(() => this.close());
        
        // Dynamic condition target dropdown
        html.find('.condition-scope-select').change(this._onConditionScopeChange.bind(this));
    }
    
    /**
     * Handle condition scope change to show/hide and populate target dropdown
     */
    async _onConditionScopeChange(event) {
        const scope = event.currentTarget.value;
        const targetGroup = this.element.find('.condition-target-group');
        const targetSelect = this.element.find('.condition-target-select');
        
        if (scope === 'always') {
            // Hide target selection for "Always Active"
            targetGroup.hide();
        } else {
            // Show and populate target selection
            targetGroup.show();
            
            // Get available targets for this scope
            const targets = this._getConditionTargets(scope);
            
            // Clear and repopulate the select
            targetSelect.empty();
            targetSelect.append('<option value="">-- Select --</option>');
            
            targets.forEach(target => {
                targetSelect.append(`<option value="${target.value}">${target.label}</option>`);
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
    }
    
    async _onSaveEffect(event) {
        event.preventDefault();
        
        const form = this.element.find('form')[0];
        const formData = new FormDataExtended(form).object;
        
        // Build changes array from modifiers
        const changes = [];
        if (formData.modifiers) {
            for (const [key, modifier] of Object.entries(formData.modifiers)) {
                if (modifier.key && modifier.value !== undefined) {
                    changes.push({
                        key: modifier.key,
                        mode: 2, // ADD mode
                        value: Number(modifier.value)
                    });
                }
            }
        }
        
        // Prepare effect data
        const effectData = {
            name: formData.name || "New Status",
            icon: formData.icon || "icons/svg/aura.svg",
            changes: changes,
            flags: {
                wodsystem: {
                    createdBy: formData.createdBy || (game.user.isGM ? 'storyteller' : 'player'),
                    mandatory: formData.mandatory === true || formData.mandatory === 'true',
                    hasSideEffect: formData.hasSideEffect === true || formData.hasSideEffect === 'true',
                    sideEffectAuto: formData.sideEffectAuto === true || formData.sideEffectAuto === 'true',
                    conditionScope: formData.conditionScope || 'always',
                    conditionTarget: formData.conditionTarget || null
                }
            }
        };
        
        // Create or update effect
        if (this.effect) {
            await this.effect.update(effectData);
            ui.notifications.info(`Effect "${effectData.name}" updated!`);
        } else {
            await this.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
            ui.notifications.info(`Effect "${effectData.name}" created!`);
        }
        
        this.close();
    }
    
    async _onDeleteEffect(event) {
        event.preventDefault();
        
        if (!this.effect) {
            ui.notifications.warn("No effect to delete.");
            return;
        }
        
        // Confirm deletion
        const confirmed = await Dialog.confirm({
            title: "Delete Status Effect",
            content: `<p>Are you sure you want to delete <strong>${this.effect.name}</strong>?</p><p>This action cannot be undone.</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (confirmed) {
            await this.effect.delete();
            ui.notifications.info(`Effect "${this.effect.name}" deleted.`);
            this.close();
        }
    }
    
    async _updateObject(event, formData) {
        // This is called on form submit, but we're handling it manually with the save button
        // So we can leave this empty
    }
}

