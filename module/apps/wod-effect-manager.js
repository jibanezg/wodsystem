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
            data.effect = {
                id: this.effect.id,
                name: this.effect.name,
                icon: this.effect.icon,
                createdBy: this.effect.getFlag('wodsystem', 'createdBy') || createdBy,
                mandatory: this.effect.getFlag('wodsystem', 'mandatory') === true,
                hasSideEffect: this.effect.getFlag('wodsystem', 'hasSideEffect') === true,
                sideEffectAuto: this.effect.getFlag('wodsystem', 'sideEffectAuto') === true,
                conditionType: this.effect.getFlag('wodsystem', 'conditionType') || 'always',
                conditionValue: this.effect.getFlag('wodsystem', 'conditionValue') || '',
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
                conditionType: 'always',
                conditionValue: '',
                changes: []
            };
        }
        
        // Check if this is a player effect
        data.isPlayerEffect = data.effect.createdBy === 'player';
        data.isGM = game.user.isGM;
        
        // Condition type options
        data.conditionTypes = [
            { value: 'always', label: 'Always Active' },
            { value: 'attack', label: 'Attack Rolls' },
            { value: 'soak', label: 'Soak Rolls' },
            { value: 'trait_roll', label: 'Specific Trait Roll' }
        ];
        
        return data;
    }
    
    activateListeners(html) {
        super.activateListeners(html);
        
        html.find('.add-modifier-row').click(this._onAddModifier.bind(this));
        html.find('.remove-modifier-row').click(this._onRemoveModifier.bind(this));
        html.find('.save-effect').click(this._onSaveEffect.bind(this));
        html.find('.delete-effect').click(this._onDeleteEffect.bind(this));
        html.find('.cancel-effect').click(() => this.close());
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
                <input type="number" class="modifier-value" name="modifiers.${index}.value" value="0" />
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
                    conditionType: formData.conditionType || 'always',
                    conditionValue: formData.conditionValue || null
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

