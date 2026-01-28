/**
 * Technocrat Actor Sheet
 * Extends WodActorSheet to reuse all logic, only sets template and CSS class
 * For Mage: The Ascension - Technocracy
 */

import { WodActorSheet } from "./wod-actor-sheet.js";

export class TechnocratSheet extends WodActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "technocrat"],
            template: "systems/wodsystem/templates/actor/technocrat-sheet.html",
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Technocrat-specific data processing
        // Calculate Avatar rating (for permanent Quintessence)
        const allBackgrounds = context.backgrounds || [];
        const avatarBg = allBackgrounds.find(bg => bg.name === 'Avatar' || bg.name === 'Avatar/ Genius' || bg.name === 'Genius');
        context.avatarRating = avatarBg ? (avatarBg.value || 0) : 0;
        
        // Calculate Enhancement Paradox (permanent Paradox from Enhancement expanded backgrounds)
        const backgroundsExpanded = Array.isArray(this.actor.system.backgroundsExpanded) 
            ? this.actor.system.backgroundsExpanded 
            : [];
        const enhancementExpanded = backgroundsExpanded.filter(bg => 
            bg && (bg.backgroundName === 'Enhancement' || bg.backgroundName === 'Enhancement/ Wonder')
        );
        let totalPermanentParadox = 0;
        for (const bg of enhancementExpanded) {
            totalPermanentParadox += Number(bg.templateData?.permanentParadox) || 0;
        }
        context.enhancementParadox = totalPermanentParadox;
        
        return context;
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Technocrat-specific event listeners
        // Spheres
        html.find('[data-sphere] .dot').click(this._onSphereClick.bind(this));
        
        // Quintessence/Paradox Wheel
        html.find('.wheel-box').click(this._onWheelBoxClick.bind(this));
        html.find('.wheel-box').contextmenu(this._onWheelBoxRightClick.bind(this));
        
        // Enlightenment
        html.find('[data-enlightenment] .dot').click(this._onDotClick.bind(this));
        
        // Primal Energy
        html.find('.primal-box').click(this._onPrimalEnergyClick.bind(this));
        
        // Procedures and Devices
        html.find('.add-procedure').click(this._onAddProcedure.bind(this));
        html.find('.add-device').click(this._onAddDevice.bind(this));
        
        // Focus instruments
        html.find('.add-instrument').click(this._onAddInstrument.bind(this));
        html.find('.remove-instrument').click(this._onRemoveInstrument.bind(this));
    }
    
    /**
     * Handle sphere dot click (Technocrat-specific)
     */
    async _onSphereClick(event) {
        event.preventDefault();
        const dot = event.currentTarget;
        const container = dot.closest('.dot-container');
        const sphereKey = container.dataset.sphere;
        const index = parseInt(dot.dataset.index);
        const currentValue = this.actor.system.spheres[sphereKey].rating;
        
        let newValue;
        if (index + 1 === currentValue) {
            // Clicking the current highest dot - decrease
            newValue = index;
        } else {
            // Clicking a higher dot - set to that level
            newValue = index + 1;
        }

        const updateData = {};
        updateData[`system.spheres.${sphereKey}.rating`] = Math.min(Math.max(newValue, 0), 5);
        await this.actor.update(updateData, { render: false });
        this._updateDotVisuals(container, newValue);
    }
    
    /**
     * Handle clicking on wheel boxes (Technocrat Quintessence/Paradox handler)
     */
    async _onWheelBoxClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const box = event.currentTarget;
        const index = parseInt(box.dataset.index);
        
        // DEQUE APPROACH: Use arrays of filled indices
        const quintessenceCount = Number(this.actor.system.advantages.primalEnergy.current) || 0;
        const permanentParadox = this._getEnhancementParadox();
        const currentParadox = Number(this.actor.system.advantages.paradox.current) || 0;
        const totalParadox = permanentParadox + currentParadox;
        
        // Build deque arrays
        const quintessenceIndices = Array.from({length: quintessenceCount}, (_, i) => i);
        const paradoxIndices = Array.from({length: totalParadox}, (_, i) => 19 - i);
        
        // Get last added type
        const lastAddedType = this.actor.getFlag('wodsystem', 'lastWheelAddType') || null;
        
        // Check what's at this index
        const hasQuintessence = quintessenceIndices.includes(index);
        const hasParadox = paradoxIndices.includes(index);
        const hasOverlap = hasQuintessence && hasParadox;
        
        // Check if wheel is completely full
        const wheelIsFull = (quintessenceCount + totalParadox) === 20;
        
        // CLICKING EXISTING: Remove from deque OR convert (if full)
        if (hasOverlap) {
            // Overlap zone - remove Quintessence (burn it away)
            await this.actor.update({
                'system.advantages.primalEnergy.current': index
            }, { render: false });
        }
        else if (hasQuintessence) {
            // SPECIAL: If wheel is full, ask if they want to add Paradox
            if (wheelIsFull) {
                const addParadox = await Dialog.confirm({
                    title: i18n('WODSYSTEM.Notifications.AddParadox'),
                    content: `<p>${i18n('WODSYSTEM.Notifications.WheelIsFull')}</p><p>${i18n('WODSYSTEM.Notifications.ClickNoToSpend')}</p>`,
                    yes: () => true,
                    no: () => false,
                    defaultYes: false
                });
                
                if (addParadox) {
                    // Add Paradox - which will cancel Quintessence
                    const newTotalParadox = totalParadox + 1;
                    const overlap = (quintessenceCount + newTotalParadox) - 20;
                    const newQuintessence = Math.max(0, quintessenceCount - overlap);
                    
                    await this.actor.update({
                        'system.advantages.paradox.current': newTotalParadox - permanentParadox,
                        'system.advantages.primalEnergy.current': newQuintessence
                    }, { render: false });
                } else {
                    // Remove Quintessence
                    await this.actor.update({
                        'system.advantages.primalEnergy.current': index
                    }, { render: false });
                }
            } else {
                // Remove Quintessence
                await this.actor.update({
                    'system.advantages.primalEnergy.current': index
                }, { render: false });
            }
        }
        else if (hasParadox) {
            // Remove Paradox (only current, not permanent)
            if (index >= (19 - currentParadox)) {
                await this.actor.update({
                    'system.advantages.paradox.current': currentParadox - 1
                }, { render: false });
            }
        }
        // CLICKING EMPTY: Add to deque
        else {
            // Determine what to add based on position and last added type
            let addType;
            if (lastAddedType === null) {
                // First click - determine by position
                addType = index < 10 ? 'quintessence' : 'paradox';
            } else {
                // Subsequent clicks - add same type as last time
                addType = lastAddedType;
            }
            
            // Check if we can add this type
            if (addType === 'quintessence') {
                if (quintessenceCount < 10) {
                    await this.actor.update({
                        'system.advantages.primalEnergy.current': quintessenceCount + 1
                    }, { render: false });
                    await this.actor.setFlag('wodsystem', 'lastWheelAddType', 'quintessence');
                }
            } else if (addType === 'paradox') {
                if (totalParadox < 20) {
                    await this.actor.update({
                        'system.advantages.paradox.current': currentParadox + 1
                    }, { render: false });
                    await this.actor.setFlag('wodsystem', 'lastWheelAddType', 'paradox');
                }
            }
        }
        
        this._syncVisualStateWithData();
    }
    
    /**
     * Handle right-click on wheel boxes (Technocrat-specific)
     */
    async _onWheelBoxRightClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const box = event.currentTarget;
        const index = parseInt(box.dataset.index);
        
        const quintessenceCount = Number(this.actor.system.advantages.primalEnergy.current) || 0;
        const permanentParadox = this._getEnhancementParadox();
        const currentParadox = Number(this.actor.system.advantages.paradox.current) || 0;
        const totalParadox = permanentParadox + currentParadox;
        
        const quintessenceIndices = Array.from({length: quintessenceCount}, (_, i) => i);
        const paradoxIndices = Array.from({length: totalParadox}, (_, i) => 19 - i);
        
        const hasQuintessence = quintessenceIndices.includes(index);
        const hasParadox = paradoxIndices.includes(index);
        
        // Right-click removes from rightmost position
        if (hasQuintessence && !hasParadox) {
            // Remove rightmost Quintessence
            await this.actor.update({
                'system.advantages.primalEnergy.current': quintessenceCount - 1
            }, { render: false });
        } else if (hasParadox) {
            // Remove rightmost Paradox (current only)
            if (index >= (19 - currentParadox)) {
                await this.actor.update({
                    'system.advantages.paradox.current': currentParadox - 1
                }, { render: false });
            }
        }
        
        this._syncVisualStateWithData();
    }
    
    /**
     * Update Enlightenment value (Technocrat-specific)
     */
    async _updateEnlightenment(value) {
        const updateData = {};
        const newValue = Math.min(Math.max(value, 0), 10);
        updateData[`system.advantages.enlightenment.current`] = newValue;
        
        await this.actor.update(updateData, { render: false });
        
        // Update visual dots
        const container = this.element.find(`.dot-container[data-enlightenment="current"]`)[0];
        if (container) {
            this._updateDotVisuals(container, newValue);
        }
        
        // Update the enlightenment label's data-value
        const label = this.element.find(`.trait-label[data-category="enlightenment"]`)[0];
        if (label) {
            label.setAttribute('data-value', newValue);
        }
    }
    
    /**
     * Update Paradox value (Technocrat-specific)
     */
    async _updateParadox(type, value) {
        const updateData = {};
        updateData[`system.advantages.paradox.${type}`] = Math.min(Math.max(value, 0), 10);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }
    
    /**
     * Handle adding procedure (Technocrat-specific)
     */
    async _onAddProcedure(event) {
        event.preventDefault();
        const procedures = Array.isArray(this.actor.system.procedures) ? this.actor.system.procedures : [];
        const newProcedures = [...procedures, { name: "", spheres: "", description: "" }];
        await this.actor.update({ "system.procedures": newProcedures });
    }
    
    /**
     * Handle adding device (Technocrat-specific)
     */
    async _onAddDevice(event) {
        event.preventDefault();
        const devices = Array.isArray(this.actor.system.devices) ? this.actor.system.devices : [];
        const newDevices = [...devices, { 
            name: "", description: "", spheres: "", effects: "", 
            arete: 0, paradoxRisk: 0, quintessence: 0 
        }];
        await this.actor.update({ "system.devices": newDevices });
    }
    
    /**
     * Get enhancement paradox for calculations
     */
    _getEnhancementParadox() {
        const backgroundsExpanded = Array.isArray(this.actor.system.backgroundsExpanded) 
            ? this.actor.system.backgroundsExpanded 
            : [];
        const enhancementExpanded = backgroundsExpanded.filter(bg => 
            bg && (bg.backgroundName === 'Enhancement' || bg.backgroundName === 'Enhancement/ Wonder')
        );
        let totalPermanentParadox = 0;
        for (const bg of enhancementExpanded) {
            totalPermanentParadox += Number(bg.templateData?.permanentParadox) || 0;
        }
        return totalPermanentParadox;
    }

    /**
     * Handle clicking on Primal Energy asterisks (Technocrat-specific)
     * Toggles between spent and available
     * @param {Event} event
     * @private
     */
    async _onPrimalEnergyClick(event) {
        event.preventDefault();
        const box = event.currentTarget;
        const index = parseInt(box.dataset.index);
        const currentSpent = this.actor.system.advantages.primalEnergy.spent || 0;
        
        // Toggle: if this box is spent, unspend it (and all after it)
        // If not spent, spend it (and all before it)
        let newSpent;
        if (index < currentSpent) {
            // Clicking a spent box - unspend from this point
            newSpent = index;
        } else {
            // Clicking an unspent box - spend up to this point
            newSpent = index + 1;
        }
        
        const updateData = {};
        updateData[`system.advantages.primalEnergy.spent`] = Math.min(Math.max(newSpent, 0), this.actor.system.advantages.primalEnergy.maximum);
        await this.actor.update(updateData, { render: false });
        
        // Update visual state
        const boxes = this.element.find('.primal-box');
        boxes.each((i, el) => {
            if (i < newSpent) {
                el.classList.add('spent');
            } else {
                el.classList.remove('spent');
            }
        });
    }

    /**
     * Handle biography field changes (Technocrat-specific override)
     */
    async _onBiographyChange(event) {
        event.preventDefault();
        const field = event.currentTarget.name;
        const value = event.currentTarget.value;
        
        // Handle instrument inputs specifically (they're in an array)
        if (field === 'system.biography.focus.instruments') {
            // Initialize focus if it doesn't exist or is incomplete
            if (!this.actor.system.biography.focus || !this.actor.system.biography.focus.instruments) {
                await this.actor.update({
                    'system.biography.focus': {
                        paradigm: "",
                        instruments: ["", "", "", "", "", "", ""],
                        practices: ""
                    }
                });
                ui.notifications.info('Focus section initialized.');
                return;
            }
            
            const index = parseInt(event.currentTarget.dataset.index);
            const instruments = foundry.utils.duplicate(this.actor.system.biography.focus.instruments);
            instruments[index] = value;
            await this.actor.update({ 'system.biography.focus.instruments': instruments });
        } else {
            await this.actor.update({ [field]: value });
        }
    }

    /**
     * Add a new instrument to the focus (Technocrat-specific)
     */
    async _onAddInstrument(event) {
        event.preventDefault();
        
        // Initialize focus structure if it doesn't exist or is incomplete
        if (!this.actor.system.biography.focus || !this.actor.system.biography.focus.instruments) {
            await this.actor.update({
                'system.biography.focus': {
                    paradigm: "",
                    instruments: ["", "", "", "", "", "", ""],
                    practices: ""
                }
            });
            ui.notifications.info('Focus section initialized. Click again to add an instrument.');
            return;
        }
        
        // Capture scroll position before update
        const scrollContainer = this.element.find('.tab[data-tab="biography"]');
        const scrollTop = scrollContainer.scrollTop();
        
        const instruments = foundry.utils.duplicate(this.actor.system.biography.focus.instruments);
        instruments.push("");
        await this.actor.update({ 'system.biography.focus.instruments': instruments });
        
        // Restore scroll position after render
        setTimeout(() => {
            scrollContainer.scrollTop(scrollTop);
        }, 0);
    }

    /**
     * Remove an instrument from the focus (Technocrat-specific)
     */
    async _onRemoveInstrument(event) {
        event.preventDefault();
        
        // Initialize focus if it doesn't exist or is incomplete
        if (!this.actor.system.biography.focus || !this.actor.system.biography.focus.instruments) {
            await this.actor.update({
                'system.biography.focus': {
                    paradigm: "",
                    instruments: ["", "", "", "", "", "", ""],
                    practices: ""
                }
            });
            ui.notifications.info('Focus section initialized.');
            return;
        }
        
        const index = parseInt(event.currentTarget.dataset.index);
        const instruments = foundry.utils.duplicate(this.actor.system.biography.focus.instruments);
        
        // Ensure minimum of 7 instruments
        if (instruments.length <= 7) {
            ui.notifications.warn('Cannot remove instrument: minimum of 7 instruments required.');
            return;
        }
        
        // Capture scroll position before update
        const scrollContainer = this.element.find('.tab[data-tab="biography"]');
        const scrollTop = scrollContainer.scrollTop();
        
        instruments.splice(index, 1);
        await this.actor.update({ 'system.biography.focus.instruments': instruments });
        
        // Restore scroll position after render
        setTimeout(() => {
            scrollContainer.scrollTop(scrollTop);
        }, 0);
    }
}

