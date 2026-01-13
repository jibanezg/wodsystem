import { i18n } from "../helpers/i18n.js";

/**
 * Equipment Effects Configuration Dialog
 * Allows users to configure light, visibility, and sound effects for equipment
 */
export class WodEquipmentEffectsDialog extends FormApplication {
    constructor(item, options = {}) {
        // Set title in options if not provided, using i18n if available
        if (!options.title) {
            if (game?.i18n) {
                options.title = game.i18n.localize("WODSYSTEM.EquipmentEffects.DialogTitle");
            } else {
                options.title = "Equipment Effects Configuration";
            }
        }
        
        super(item, options);
        this.item = item;
    }
    
    /** @override */
    get title() {
        if (game?.i18n) {
            return game.i18n.localize("WODSYSTEM.EquipmentEffects.DialogTitle");
        }
        return "Equipment Effects Configuration";
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "wod-equipment-effects",
            classes: ["wod", "equipment-effects-dialog"],
            template: "systems/wodsystem/templates/apps/equipment-effects-dialog.html",
            width: 550,
            height: 650,
            resizable: true
        });
    }

    /** @override */
    getData() {
        const effects = this.item.system?.equipmentEffects || {
            light: null,
            visibility: null,
            sound: null
        };

        // Get actor type for theme
        const actor = this.item.actor;
        const actorType = actor ? actor.type.toLowerCase() : "mortal";

        return {
            item: this.item,
            actorType: actorType,
            effects: effects,
            hasLight: !!effects.light,
            hasVisibility: !!effects.visibility,
            hasSound: !!effects.sound,
            light: effects.light || {
                dim: 0,
                bright: 0,
                angle: 360,
                color: "#ffffff",
                alpha: 0.5,
                animation: null,
                darkness: { min: 0, max: 1 }
            },
            visibility: effects.visibility || {
                dimSight: 0,
                brightSight: 0,
                visionMode: "basic"
            },
            sound: effects.sound || {
                file: "",
                volume: 0.5,
                loop: false
            }
        };
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Apply theme class based on actor type
        const actor = this.item.actor;
        if (actor) {
            const actorTypeLower = actor.type.toLowerCase();
            html[0].classList.add(actorTypeLower);
        } else {
            html[0].classList.add("mortal");
        }

        // Toggle effect sections
        html.find('.effect-toggle').change(this._onToggleEffect.bind(this));
        
        // File picker for sound
        html.find('.sound-file-picker').click(this._onSoundFilePicker.bind(this));
        
        // Color picker for light
        html.find('.light-color-picker').change(this._onLightColorChange.bind(this));
        
        // Cancel button
        html.find('.cancel-effect').click(() => this.close());
    }

    /**
     * Toggle an effect section on/off
     */
    _onToggleEffect(event) {
        const effectType = event.currentTarget.dataset.effectType;
        const enabled = event.currentTarget.checked;
        const section = $(event.currentTarget).closest('.effect-section');
        const content = section.find('.effect-content');
        const inputs = content.find('input, select').not('.effect-toggle');
        
        if (enabled) {
            content.slideDown(200);
            inputs.prop('disabled', false);
        } else {
            content.slideUp(200);
            inputs.prop('disabled', true);
            // Clear the effect when disabled
            this._updateEffectData(effectType, null);
        }
    }

    /**
     * Open file picker for sound file
     */
    _onSoundFilePicker(event) {
        event.preventDefault();
        const currentFile = this.item.system?.equipmentEffects?.sound?.file || "";
        
        const fp = new foundry.applications.apps.FilePicker.implementation({
            type: "audio",
            current: currentFile,
            callback: (path) => {
                const sound = this.item.system?.equipmentEffects?.sound || { file: "", volume: 0.5, loop: false };
                sound.file = path;
                this._updateEffectData("sound", sound);
                $(event.currentTarget).siblings('input').val(path);
            }
        });
        fp.render(true);
    }

    /**
     * Handle light color change
     */
    _onLightColorChange(event) {
        const color = event.currentTarget.value;
        const light = this.item.system?.equipmentEffects?.light || {
            dim: 0,
            bright: 0,
            angle: 360,
            color: "#ffffff",
            alpha: 0.5
        };
        light.color = color;
        this._updateEffectData("light", light);
    }

    /**
     * Update effect data in item (called during form interaction)
     */
    async _updateEffectData(effectType, effectData) {
        const currentEffects = foundry.utils.duplicate(this.item.system?.equipmentEffects || {
            light: null,
            visibility: null,
            sound: null
        });
        
        currentEffects[effectType] = effectData;
        
        await this.item.update({ "system.equipmentEffects": currentEffects });
    }

    /** @override */
    async _updateObject(event, formData) {
        const effects = {
            light: null,
            visibility: null,
            sound: null
        };

        // Process light effects
        if (formData["light.enabled"]) {
            effects.light = {
                dim: parseFloat(formData["light.dim"]) || 0,
                bright: parseFloat(formData["light.bright"]) || 0,
                angle: parseFloat(formData["light.angle"]) || 360,
                color: formData["light.color"] || "#ffffff",
                alpha: parseFloat(formData["light.alpha"]) || 0.5,
                animation: formData["light.animation"] || null,
                darkness: {
                    min: parseFloat(formData["light.darknessMin"]) || 0,
                    max: parseFloat(formData["light.darknessMax"]) || 1
                }
            };
        }

        // Process visibility effects
        if (formData["visibility.enabled"]) {
            effects.visibility = {
                dimSight: parseFloat(formData["visibility.dimSight"]) || 0,
                brightSight: parseFloat(formData["visibility.brightSight"]) || 0,
                visionMode: formData["visibility.visionMode"] || "basic"
            };
        }

        // Process sound effects
        if (formData["sound.enabled"] && formData["sound.file"]) {
            effects.sound = {
                file: formData["sound.file"],
                volume: parseFloat(formData["sound.volume"]) || 0.5,
                loop: formData["sound.loop"] === true || formData["sound.loop"] === "true"
            };
        }

        // Update the item
        await this.item.update({ "system.equipmentEffects": effects });
        
        // If item is equipped, apply effects immediately
        if (this.item.system?.equipped && game.wod?.equipmentEffectsManager) {
            const manager = game.wod.equipmentEffectsManager;
            const hasEffects = effects.light !== null || effects.visibility !== null || effects.sound !== null;
            
            if (hasEffects) {
                console.log("WoD Equipment Effects Dialog: Item is equipped, applying effects immediately");
                await manager._applyItemEffects(this.item.actor, this.item, effects);
            } else {
                console.log("WoD Equipment Effects Dialog: No effects configured, removing any existing effects");
                await manager._removeItemEffects(this.item.actor, this.item.id);
            }
        } else {
            console.log("WoD Equipment Effects Dialog: Item is not equipped, effects will apply when equipped");
        }
    }
}
