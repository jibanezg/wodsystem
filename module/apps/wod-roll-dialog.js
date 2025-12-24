/**
 * Roll Dialog for World of Darkness System
 * Allows configuration of difficulty, modifiers, and specialty before rolling
 */
export class WodRollDialog extends Application {
    constructor(actor, poolData, options = {}) {
        super(options);
        this.actor = actor;
        this.poolData = poolData;
        this.modifiers = [];
    }
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "dialog", "roll-dialog"],
            template: "systems/wodsystem/templates/apps/roll-dialog.html",
            width: 450,
            height: "auto",
            resizable: false,
            title: "Configure Roll"
        });
    }
    
    async getData() {
        return {
            ...this.poolData,
            difficulty: 6,
            modifiers: this.modifiers
        };
    }
    
    activateListeners(html) {
        super.activateListeners(html);
        
        html.find('.roll-button').click(this._onRoll.bind(this));
        html.find('.cancel-button').click(() => this.close());
        html.find('.add-modifier').click(this._onAddModifier.bind(this));
        html.find('#save-template-check').change(this._onToggleSaveTemplate.bind(this));
        html.find('.remove-modifier').click(this._onRemoveModifier.bind(this));
    }
    
    async _onRoll(event) {
        event.preventDefault();
        
        const form = this.element.find('form')[0];
        const difficulty = parseInt(form.difficulty.value);
        const specialty = form.specialty.checked;
        const saveTemplate = form.saveTemplate.checked;
        const templateName = form.templateName.value;
        
        // Execute roll
        await this.actor.rollPool(
            this.poolData.poolName,
            this.poolData.totalPool,
            {
                difficulty,
                specialty,
                modifiers: this.modifiers,
                traits: this.poolData.traits
            }
        );
        
        // Save template if requested
        if (saveTemplate && templateName) {
            await this.actor.saveRollTemplate({
                name: templateName,
                traits: this.poolData.traits,
                difficulty,
                specialty,
                modifiers: this.modifiers
            });
        }
        
        this.close();
    }
    
    _onAddModifier(event) {
        event.preventDefault();
        
        const name = prompt("Modifier name:");
        if (!name) return;
        
        const value = parseInt(prompt("Modifier value (+ or -):", "0"));
        if (isNaN(value)) return;
        
        this.modifiers.push({ name, value });
        this.render();
    }
    
    _onRemoveModifier(event) {
        const index = parseInt(event.currentTarget.dataset.index);
        this.modifiers.splice(index, 1);
        this.render();
    }
    
    _onToggleSaveTemplate(event) {
        const checked = event.currentTarget.checked;
        this.element.find('#template-name').toggle(checked);
    }
}

