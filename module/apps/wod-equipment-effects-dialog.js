import { i18n } from "../helpers/i18n.js";

/**
 * Equipment Effects Configuration Dialog
 * Allows users to configure light, visibility, and sound effects for equipment
 */
export class WodEquipmentEffectsDialog extends FormApplication {
    constructor(item, options = {}) {
        // Set title in options if not provided, using i18n if available
        // This must be done BEFORE calling super() - exactly like WodRollDialog
        if (!options.title) {
            if (game?.i18n) {
                const localized = game.i18n.localize("WODSYSTEM.EquipmentEffects.DialogTitle");
                // Only use localized if it's not the same as the key (meaning translation was found)
                options.title = (localized !== "WODSYSTEM.EquipmentEffects.DialogTitle") 
                    ? localized 
                    : "Equipment Effects Configuration";
            } else {
                options.title = "Equipment Effects Configuration";
            }
        }
        
        super({}, options);
        this.item = item;
        this.activeTab = "light"; // Default to light tab
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "wod-equipment-effects",
            classes: ["wod", "dialog", "equipment-effects-dialog"],
            template: "systems/wodsystem/templates/apps/equipment-effects-dialog.html",
            width: 600,
            height: 650,
            resizable: true,
            title: "Equipment Effects Configuration" // Static title, will be overridden in constructor if i18n is available
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
            activeTab: this.activeTab,
            hasLight: !!effects.light,
            hasVisibility: !!effects.visibility,
            hasSound: !!effects.sound,
            light: (() => {
                const light = effects.light || {
                    dim: 0,
                    bright: 0,
                    intensity: 0,
                    angle: 360,
                    color: "#ffffff",
                    alpha: 0.5,
                    animation: null,
                    darkness: { min: 0, max: 1 }
                };
                // Calculate intensity from dim/bright if not set
                if (!light.intensity && (light.dim > 0 || light.bright > 0)) {
                    light.intensity = Math.max(light.dim, Math.ceil(light.bright / 0.8));
                }
                return light;
            })(),
            visibility: effects.visibility || {
                dimSight: 0,
                brightSight: 0,
                angle: 360,
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

        // Apply theme class to dialog window (not just form)
        const actor = this.item.actor;
        const actorTypeLower = actor ? actor.type.toLowerCase() : "mortal";
        
        // Apply theme to form
        html[0].classList.add(actorTypeLower);
        
        // Apply theme to dialog window element
        const dialogElement = html[0].closest('.window-app');
        if (dialogElement) {
            dialogElement.classList.add(actorTypeLower);
        }

        // Tab navigation
        html.find('.effect-tab').click(this._onTabClick.bind(this));
        
        // File picker for sound
        html.find('.sound-file-picker').click(this._onSoundFilePicker.bind(this));
        
        // Color picker for light
        html.find('.light-color-picker').change(this._onLightColorChange.bind(this));
        
        // Intensity slider for light - updates dim and bright proportionally
        html.find('.light-intensity-slider').on('input', this._onLightIntensityChange.bind(this));
        
        // Individual dim/bright inputs - update intensity when changed manually
        html.find('.light-dim-input, .light-bright-input').on('input', this._onLightDimBrightChange.bind(this));
        
        // Vision mode change handler - show/hide angle field based on vision mode
        html.find('#visibility-vision-mode').change(this._onVisionModeChange.bind(this));
        
        // Cancel button
        html.find('.cancel-effect').click(() => this.close());
        
        // Initialize tab display
        this._showTab(this.activeTab, html);
        
        // Initialize vision mode angle visibility
        this._updateVisionModeAngleVisibility(html);
    }

    /**
     * Handle tab click - switch between Light, Visibility, Sound tabs
     */
    _onTabClick(event) {
        event.preventDefault();
        const tabName = event.currentTarget.dataset.tab;
        this.activeTab = tabName;
        this._showTab(tabName, $(event.currentTarget).closest('form'));
    }
    
    /**
     * Show the specified tab and hide others
     */
    _showTab(tabName, html) {
        // Update tab buttons
        html.find('.effect-tab').removeClass('active');
        html.find(`.effect-tab[data-tab="${tabName}"]`).addClass('active');
        
        // Update tab content
        html.find('.effect-tab-content').hide();
        html.find(`.effect-tab-content[data-tab="${tabName}"]`).show();
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
        // Update the text display field
        $(event.currentTarget).siblings('.color-value-display').val(color);
        
        const light = this.item.system?.equipmentEffects?.light || {
            dim: 0,
            bright: 0,
            intensity: 0,
            angle: 360,
            color: "#ffffff",
            alpha: 0.5
        };
        light.color = color;
        this._updateEffectData("light", light);
    }

    /**
     * Handle light intensity slider change - updates dim and bright proportionally
     * Intensity 0-20: dim = intensity, bright = Math.floor(intensity * 0.8)
     * 
     * NOTE: This is a convenience feature - the intensity slider provides a quick way
     * to adjust overall light strength. Users can still manually adjust dim and bright
     * independently, which will recalculate the intensity value.
     */
    _onLightIntensityChange(event) {
        const intensity = parseFloat(event.currentTarget.value) || 0;
        const html = $(event.currentTarget).closest('form');
        
        // Update display value
        html.find('.intensity-value-display').text(intensity);
        
        // Calculate dim and bright based on intensity
        // Dim is the full intensity, bright is 80% of intensity (rounded down)
        // This provides a realistic light falloff pattern
        const dim = intensity;
        const bright = Math.floor(intensity * 0.8);
        
        // Update input fields
        html.find('.light-dim-input').val(dim);
        html.find('.light-bright-input').val(bright);
        
        // Get existing light effect to preserve other properties
        const existingLight = this.item.system?.equipmentEffects?.light || {
            dim: 0,
            bright: 0,
            intensity: 0,
            angle: 360,
            color: "#ffffff",
            alpha: 0.5,
            animation: null,
            darkness: { min: 0, max: 1 }
        };
        
        // Update effect data
        const light = {
            ...existingLight,
            intensity: intensity,
            dim: dim,
            bright: bright
        };
        this._updateEffectData("light", light);
    }

    /**
     * Handle individual dim/bright input change - recalculate intensity
     */
    _onLightDimBrightChange(event) {
        const html = $(event.currentTarget).closest('form');
        const dim = parseFloat(html.find('.light-dim-input').val()) || 0;
        const bright = parseFloat(html.find('.light-bright-input').val()) || 0;
        
        // Intensity is the maximum of dim and bright (or dim if they're proportional)
        // Use dim as the primary intensity value
        const intensity = Math.max(dim, Math.ceil(bright / 0.8));
        
        // Update intensity slider and display
        html.find('.light-intensity-slider').val(intensity);
        html.find('.intensity-value-display').text(intensity);
        
        // Update effect data
        const light = this.item.system?.equipmentEffects?.light || {
            dim: 0,
            bright: 0,
            intensity: 0,
            angle: 360,
            color: "#ffffff",
            alpha: 0.5
        };
        light.intensity = intensity;
        light.dim = dim;
        light.bright = bright;
        this._updateEffectData("light", light);
    }

    /**
     * Handle vision mode change - show/hide angle field based on mode
     */
    _onVisionModeChange(event) {
        const visionMode = event.currentTarget.value;
        const html = $(event.currentTarget).closest('form');
        this._updateVisionModeAngleVisibility(html, visionMode);
    }

    /**
     * Update visibility of angle field based on vision mode
     * Angle only makes sense for directional vision modes (basic, lowlight)
     * Not for omnidirectional modes (darkvision, tremorsense, blindsight, truesight, xray)
     */
    _updateVisionModeAngleVisibility(html, visionMode = null) {
        if (!visionMode) {
            visionMode = html.find('#visibility-vision-mode').val() || "basic";
        }
        
        const angleGroup = html.find('#visibility-angle-group');
        // Only show angle for modes that support directional vision
        const directionalModes = ["basic", "lowlight"];
        if (directionalModes.includes(visionMode)) {
            angleGroup.show();
        } else {
            angleGroup.hide();
        }
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

        // Get existing light effect to preserve all properties
        const existingLight = this.item.system?.equipmentEffects?.light;
        
        // Process light effects (always process if any light field exists)
        if (formData["light.dim"] !== undefined || formData["light.bright"] !== undefined || 
            formData["light.intensity"] !== undefined || formData["light.angle"] !== undefined || 
            formData["light.color"] !== undefined || formData["light.alpha"] !== undefined) {
            // If intensity is provided, use it to calculate dim and bright
            let dim, bright, intensity;
            if (formData["light.intensity"] !== undefined && formData["light.intensity"] !== "") {
                intensity = parseFloat(formData["light.intensity"]) || 0;
                dim = intensity;
                bright = Math.floor(intensity * 0.8);
            } else {
                dim = parseFloat(formData["light.dim"]) || 0;
                bright = parseFloat(formData["light.bright"]) || 0;
                intensity = Math.max(dim, Math.ceil(bright / 0.8));
            }
            
            // Parse angle - CRITICAL: Always parse angle from form if present, even if it's 0 or 360
            // These are valid values and must be preserved
            let angle = existingLight?.angle ?? 360;
            if (formData["light.angle"] !== undefined) {
                // Check if it's an empty string or null - if so, use existing or default
                if (formData["light.angle"] === "" || formData["light.angle"] === null) {
                    // Keep existing angle or use default
                    angle = existingLight?.angle ?? 360;
                } else {
                    // Parse the angle value - 0 is a valid value, so we need to check for NaN specifically
                    const parsedAngle = parseFloat(formData["light.angle"]);
                    if (!isNaN(parsedAngle)) {
                        angle = parsedAngle;
                    }
                }
            }
            
            const alpha = formData["light.alpha"] !== undefined && formData["light.alpha"] !== "" 
                ? (parseFloat(formData["light.alpha"]) || 0.5) 
                : (existingLight?.alpha ?? 0.5);
            
            // Save light effect - CRITICAL: Always save if we have any light-related form data
            // This ensures that all values (including angle=360 or angle=0) are preserved
            effects.light = {
                dim: dim,
                bright: bright,
                intensity: intensity,
                angle: angle,
                color: formData["light.color"] !== undefined && formData["light.color"] !== "" 
                    ? formData["light.color"] 
                    : (existingLight?.color || "#ffffff"),
                alpha: alpha,
                animation: formData["light.animation"] !== undefined && formData["light.animation"] !== "" 
                    ? formData["light.animation"] 
                    : (existingLight?.animation || null),
                darkness: {
                    min: formData["light.darknessMin"] !== undefined && formData["light.darknessMin"] !== "" 
                        ? (parseFloat(formData["light.darknessMin"]) || 0) 
                        : (existingLight?.darkness?.min ?? 0),
                    max: formData["light.darknessMax"] !== undefined && formData["light.darknessMax"] !== "" 
                        ? (parseFloat(formData["light.darknessMax"]) || 1) 
                        : (existingLight?.darkness?.max ?? 1)
                }
            };
        }

        // Process visibility effects (always process if values exist)
        if (formData["visibility.dimSight"] !== undefined || formData["visibility.brightSight"] !== undefined || formData["visibility.visionMode"] !== undefined) {
            const dimSight = parseFloat(formData["visibility.dimSight"]) || 0;
            const brightSight = parseFloat(formData["visibility.brightSight"]) || 0;
            const angle = parseFloat(formData["visibility.angle"]) || 360;
            const visionMode = formData["visibility.visionMode"] || "basic";
            
            // Save visibility effect if any value is set or if vision mode is not basic
            if (dimSight > 0 || brightSight > 0 || visionMode !== "basic" || angle !== 360) {
                effects.visibility = {
                    dimSight: dimSight,
                    brightSight: brightSight,
                    angle: angle,
                    visionMode: visionMode
                };
            }
        }

        // Process sound effects (always process if file exists)
        if (formData["sound.file"] && formData["sound.file"].trim() !== "") {
            effects.sound = {
                file: formData["sound.file"],
                volume: parseFloat(formData["sound.volume"]) || 0.5,
                loop: formData["sound.loop"] === true || formData["sound.loop"] === "true"
            };
        }

        // Update the item
        await this.item.update({ "system.equipmentEffects": effects });
        
        // CRITICAL: Get fresh item data after update to ensure we have the latest values
        const updatedItem = this.item.actor.items.get(this.item.id) || this.item;
        
        // If item is equipped, apply effects immediately
        if (updatedItem.system?.equipped && game.wod?.equipmentEffectsManager) {
            const manager = game.wod.equipmentEffectsManager;
            const hasEffects = effects.light !== null || effects.visibility !== null || effects.sound !== null;
            
            console.log("WoD Equipment Effects Dialog: Applying effects after save", {
                itemId: updatedItem.id,
                itemName: updatedItem.name,
                isEquipped: updatedItem.system?.equipped,
                hasEffects: hasEffects,
                effects: effects,
                lightEffect: effects.light
            });
            
            if (hasEffects) {
                // Use the effects object we just created, which has the latest values
                await manager._applyItemEffects(updatedItem.actor, updatedItem, effects);
            } else {
                await manager._removeItemEffects(updatedItem.actor, updatedItem.id);
            }
        } else {
            console.log("WoD Equipment Effects Dialog: Item not equipped, effects will apply when equipped", {
                itemId: updatedItem.id,
                itemName: updatedItem.name,
                isEquipped: updatedItem.system?.equipped,
                hasManager: !!game.wod?.equipmentEffectsManager,
                effects: effects
            });
        }
    }
}
