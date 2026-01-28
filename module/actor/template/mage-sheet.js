/**
 * Mage Actor Sheet
 * Extends WodActorSheet to reuse all logic, only sets template and CSS class
 * For Mage: The Ascension - Traditions
 */

import { WodActorSheet } from "./wod-actor-sheet.js";

export class MageSheet extends WodActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "mage"],
            template: "systems/wodsystem/templates/actor/mage-sheet.html",
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Mage-specific data processing
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
        
        // Mage-specific event listeners
        // Spheres
        html.find('[data-sphere] .dot').click(this._onSphereClick.bind(this));
        
        // Quintessence/Paradox Wheel
        html.find('.wheel-box').click(this._onWheelBoxClick.bind(this));
        html.find('.wheel-box').contextmenu(this._onWheelBoxRightClick.bind(this));
    }
    
    /**
     * Handle sphere dot click (Mage-specific)
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
     * Handle clicking on wheel boxes (Mage Quintessence/Paradox handler)
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
     * Handle right-click on wheel boxes (Mage-specific)
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
}
