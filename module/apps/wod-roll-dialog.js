import { EffectModifierConverter } from '../effects/effect-modifier-converter.js';
import { WodStApprovalDialog } from './wod-st-approval-dialog.js';

/**
 * Roll Dialog for World of Darkness System
 * Allows configuration of difficulty, modifiers, and specialty before rolling
 */
export class WodRollDialog extends Application {
    constructor(actor, poolData, options = {}) {
        // Add creature type class before calling super
        const creatureType = actor?.type || 'mortal';
        if (!options.classes) {
            options.classes = [];
        }
        if (!options.classes.includes("wod")) {
            options.classes.push("wod");
        }
        if (!options.classes.includes("dialog")) {
            options.classes.push("dialog");
        }
        if (!options.classes.includes("roll-dialog")) {
            options.classes.push("roll-dialog");
        }
        if (!options.classes.includes(creatureType)) {
            options.classes.push(creatureType);
        }
        
        super(options);
        this.actor = actor;
        this.poolData = poolData;
        
        // Get effect modifiers from actor's active effects
        this.effectModifiers = EffectModifierConverter.getModifiersFromEffects(
            actor, 
            poolData.rollContext || {}
        );
        
        // Track which optional effects are enabled (default: all optional effects enabled)
        this.enabledOptionalEffects = new Set(
            this.effectModifiers
                .filter(m => !m.mandatory)
                .map(m => m.effectId)
        );
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
        // Separate mandatory vs optional effects
        const mandatoryEffects = this.effectModifiers
            .filter(m => m.mandatory)
            .map(m => ({
                id: m.effectId,
                name: m.name,
                displayValue: this._formatModifierDisplay(m),
                modifierClass: m.value > 0 ? 'positive' : 'negative'
            }));
        
        const optionalEffects = this.effectModifiers
            .filter(m => !m.mandatory)
            .map(m => ({
                id: m.effectId,
                name: m.name,
                enabled: this.enabledOptionalEffects.has(m.effectId),
                displayValue: this._formatModifierDisplay(m),
                modifierClass: m.value > 0 ? 'positive' : 'negative'
            }));
        
        return {
            ...this.poolData,
            difficulty: 6,
            mandatoryEffects,
            optionalEffects
        };
    }
    
    activateListeners(html) {
        super.activateListeners(html);
        
        html.find('.roll-button').click(this._onRoll.bind(this));
        html.find('.cancel-button').click(() => this.close());
        html.find('#save-template-check').change(this._onToggleSaveTemplate.bind(this));
        html.find('.effect-toggle').change(this._onToggleEffect.bind(this));
    }
    
    async _onRoll(event) {
        event.preventDefault();
        
        const form = this.element.find('form')[0];
        const difficulty = parseInt(form.difficulty.value);
        const specialty = form.specialty.checked;
        const saveTemplate = form.saveTemplate.checked;
        const templateName = form.templateName.value.trim();
        
        // Validate template name if saving
        if (saveTemplate && !templateName) {
            ui.notifications.error("Please enter a name for the roll template.");
            return;
        }
        
        // Check for player-created optional effects that need ST approval
        const playerEffectIds = Array.from(this.enabledOptionalEffects).filter(id => {
            const effect = this.actor.effects.get(id);
            return effect && effect.getFlag('wodsystem', 'createdBy') === 'player';
        });
        
        // Request ST approval if needed (only if player is not the GM)
        if (playerEffectIds.length > 0 && !game.user.isGM) {
            ui.notifications.info("Requesting Storyteller approval for effects...");
            const approved = await WodStApprovalDialog.requestApproval(this.actor, playerEffectIds);
            
            if (!approved) {
                ui.notifications.warn("Roll cancelled - Storyteller denied effect application");
                this.close();
                return;
            }
        }
        
        // Collect all active modifiers (enabled effect modifiers only)
        const allModifiers = this._getActiveEffectModifiers();
        
        // Execute roll
        await this.actor.rollPool(
            this.poolData.poolName,
            this.poolData.totalPool,
            {
                difficulty,
                specialty,
                modifiers: allModifiers,
                traits: this.poolData.traits
            }
        );
        
        // Save template if requested
        if (saveTemplate && templateName) {
            await this.actor.saveRollTemplate({
                name: templateName,
                traits: this.poolData.traits,
                difficulty,
                specialty
            });
            ui.notifications.info(`Roll template "${templateName}" saved! Access it via the Quick Rolls panel.`);
        }
        
        this.close();
    }
    
    _onToggleSaveTemplate(event) {
        const checked = event.currentTarget.checked;
        const nameInput = this.element.find('#template-name');
        if (checked) {
            nameInput.show().focus();
        } else {
            nameInput.hide().val('');
        }
    }
    
    _onToggleEffect(event) {
        const effectId = event.currentTarget.dataset.effectId;
        const enabled = event.currentTarget.checked;
        
        if (enabled) {
            this.enabledOptionalEffects.add(effectId);
        } else {
            this.enabledOptionalEffects.delete(effectId);
        }
        
        // No need to re-render, just track the state
    }
    
    /**
     * Get active effect modifiers (mandatory + enabled optional)
     * @returns {Array}
     * @private
     */
    _getActiveEffectModifiers() {
        return this.effectModifiers.filter(m => 
            m.mandatory || this.enabledOptionalEffects.has(m.effectId)
        );
    }
    
    /**
     * Format modifier for display
     * @param {Object} modifier
     * @returns {string}
     * @private
     */
    _formatModifierDisplay(modifier) {
        return EffectModifierConverter.formatModifierDisplay(modifier);
    }
}

