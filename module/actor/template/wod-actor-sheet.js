/**
 * Base Actor Sheet for World of Darkness System
 * Extended by creature-specific sheets (MortalSheet, VampireSheet, etc.)
 */
export class WodActorSheet extends ActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor"],
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Load reference data (archetypes, backgrounds, etc.) via service
        if (window.referenceDataService) {
            context.archetypes = await window.referenceDataService.getArchetypes();
            // Load base + creature-specific backgrounds
            context.backgroundsList = await window.referenceDataService.getBackgrounds(this.actor.type);
        } else {
            console.error("ReferenceDataService not available");
            context.archetypes = [];
            context.backgroundsList = [];
        }
        
        // Add creature type for conditional rendering in templates
        context.creatureType = this.actor.type;
        
        // Add health edit mode flag
        context.isHealthEditMode = this.actor.getFlag('wodsystem', 'healthEditMode') || false;
        
        // Backgrounds pagination
        const backgroundsPerPage = 3;
        const allBackgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        const currentPage = this.actor.getFlag('wodsystem', 'backgroundsPage') || 0;
        const totalPages = Math.max(1, Math.ceil(allBackgrounds.length / backgroundsPerPage));
        const validPage = Math.min(currentPage, totalPages - 1);
        
        const startIdx = validPage * backgroundsPerPage;
        const endIdx = startIdx + backgroundsPerPage;
        
        context.backgroundsPagination = {
            currentPage: validPage,
            totalPages: totalPages,
            hasMultiplePages: totalPages > 1,
            hasPrevPage: validPage > 0,
            hasNextPage: validPage < totalPages - 1,
            backgrounds: allBackgrounds.slice(startIdx, endIdx).map((bg, idx) => ({
                ...bg,
                actualIndex: startIdx + idx // Store the actual index in the full array
            }))
        };
        
        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Common listeners for all sheets
        html.find('.dot').click(this._onDotClick.bind(this));
        html.find('.health-checkbox').click(this._onHealthCheckboxClick.bind(this));
        html.find('.health-box').click(this._onHealthBoxClick.bind(this));
        html.find('.health-box').contextmenu(this._onHealthBoxRightClick.bind(this));
        html.find('.reset-health').click(this._onResetHealth.bind(this));
        
        // Health editing handlers
        html.find('.toggle-health-edit').click(this._onToggleHealthEdit.bind(this));
        html.find('.health-name-edit').change(this._onHealthNameChange.bind(this));
        html.find('.health-penalty-edit').change(this._onHealthPenaltyChange.bind(this));
        html.find('.add-health-level').click(this._onAddHealthLevel.bind(this));
        html.find('.delete-health-level').click(this._onDeleteHealthLevel.bind(this));
        
        // Identity field handlers
        html.find('input[name^="system.identity"]').change(this._onIdentityChange.bind(this));
        html.find('select[name^="system.identity"]').change(this._onIdentityChange.bind(this));
        
        // Merit/Flaw handlers
        html.find('.add-merit').click(this._onAddMerit.bind(this));
        html.find('.delete-merit').click(this._onDeleteMerit.bind(this));
        html.find('.add-flaw').click(this._onAddFlaw.bind(this));
        html.find('.delete-flaw').click(this._onDeleteFlaw.bind(this));
        
        // Background handlers
        html.find('.add-background').click(this._onAddBackground.bind(this));
        html.find('.delete-background').click(this._onDeleteBackground.bind(this));
        html.find('.background-name-select').change(this._onBackgroundNameChange.bind(this));
        html.find('.background-custom-name').change(this._onBackgroundCustomNameChange.bind(this));
        
        // Background pagination handlers
        html.find('.backgrounds-prev-page').click(this._onBackgroundsPrevPage.bind(this));
        html.find('.backgrounds-next-page').click(this._onBackgroundsNextPage.bind(this));
        
        // Biography field handlers
        html.find('input[name^="system.biography"]').change(this._onBiographyChange.bind(this));
        html.find('textarea[name^="system.biography"]').change(this._onBiographyChange.bind(this));
        
        // Secondary ability handlers
        html.find('.add-secondary-talent').click((ev) => this._onAddSecondaryAbility(ev, 'talents'));
        html.find('.add-secondary-skill').click((ev) => this._onAddSecondaryAbility(ev, 'skills'));
        html.find('.add-secondary-knowledge').click((ev) => this._onAddSecondaryAbility(ev, 'knowledges'));
        html.find('.delete-secondary-ability').click(this._onDeleteSecondaryAbility.bind(this));
        
        // Technocrat-specific handlers
        html.find('.primal-box').click(this._onPrimalEnergyClick.bind(this));
    }

    /**
     * Handle clicking on a dot
     */
    async _onDotClick(event) {
        event.preventDefault();
        const dot = event.currentTarget;
        const container = dot.closest('.dot-container');
        const index = parseInt(dot.dataset.index);
        const currentValue = this._getCurrentValue(container);
        
        // Toggle the clicked dot
        let newValue;
        if (index + 1 === currentValue) {
            // If clicking the last filled dot, decrease by 1
            newValue = Math.max(currentValue - 1, 0);
        } else {
            // Otherwise, set to the clicked position
            newValue = index + 1;
        }

        // Determine what type of dot this is
        let updatePromise;
        if (container.dataset.attribute) {
            updatePromise = this._updateAttribute(container.dataset.attribute, container.dataset.key, newValue);
        } else if (container.dataset.ability) {
            updatePromise = this._updateAbility(container.dataset.ability, container.dataset.key, newValue);
        } else if (container.dataset.willpower) {
            updatePromise = this._updateWillpower(container.dataset.willpower, newValue);
        } else if (container.dataset.merit !== undefined) {
            updatePromise = this._updateMerit(container.dataset.merit, newValue);
        } else if (container.dataset.flaw !== undefined) {
            updatePromise = this._updateFlaw(container.dataset.flaw, newValue);
        } else if (container.dataset.background !== undefined) {
            updatePromise = this._updateBackground(parseInt(container.dataset.background), newValue);
        } else if (container.dataset.virtue) {
            updatePromise = this._updateVirtue(container.dataset.virtue, newValue);
        } else if (container.dataset.humanity) {
            updatePromise = this._updateHumanity(newValue);
        } else if (container.dataset.torment) {
            updatePromise = this._updateTorment(newValue);
        } else if (container.dataset.enlightenment) {
            updatePromise = this._updateEnlightenment(newValue);
        } else if (container.dataset.paradox) {
            updatePromise = this._updateParadox(container.dataset.paradox, newValue);
        } else if (container.dataset.secondaryAbility) {
            updatePromise = this._updateSecondaryAbility(
                container.dataset.category,
                parseInt(container.dataset.index),
                newValue
            );
        }

        // Update the visual appearance immediately
        this._updateDotVisuals(container, newValue);
        
        // Wait for the data update to complete
        if (updatePromise) {
            await updatePromise;
        }
    }

    /**
     * Handle clicking on a health box (old system - to be replaced)
     */
    async _onHealthCheckboxClick(event) {
        event.preventDefault();
        const checkbox = event.currentTarget;
        const container = checkbox.closest('.checkbox-container');
        const index = parseInt(checkbox.dataset.index);
        const currentValue = this._getCurrentHealthValue(container);
        
        // Toggle the clicked checkbox
        let newValue;
        if (index + 1 === currentValue) {
            // If clicking the last checked checkbox, decrease by 1
            newValue = Math.max(currentValue - 1, 0);
        } else {
            // Otherwise, set to the clicked position
            newValue = index + 1;
        }
        
        // Update the visual appearance immediately
        this._updateHealthCheckboxVisuals(container, newValue);
        
        // Update the data
        await this._updateHealthOld(container.dataset.health, newValue);
    }

    /**
     * Handle left-clicking on a health box (add damage)
     * Single click = bashing, double click = lethal, triple click = aggravated
     */
    async _onHealthBoxClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const clickCount = event.detail; // 1, 2, or 3
        
        // For multi-clicks (2 or 3), process immediately
        // For single clicks, wait a bit to see if it becomes a multi-click
        if (clickCount >= 2) {
            // Clear any pending single-click timeout
            if (this._healthClickTimeout) {
                clearTimeout(this._healthClickTimeout);
                this._healthClickTimeout = null;
            }
            
            let damageType = null;
            if (clickCount === 2) damageType = "lethal";
            else if (clickCount === 3) damageType = "aggravated";
            
            if (damageType) {
                const updatedHealth = await this.actor.applyDamage(damageType, 1);
                this._updateHealthDisplay(updatedHealth);
            }
        } else {
            // Single click - wait to see if it becomes a double/triple click
            if (this._healthClickTimeout) {
                clearTimeout(this._healthClickTimeout);
            }
            
            this._healthClickTimeout = setTimeout(async () => {
                const updatedHealth = await this.actor.applyDamage("bashing", 1);
                this._updateHealthDisplay(updatedHealth);
                this._healthClickTimeout = null;
            }, 300); // 300ms delay to detect if this becomes a multi-click
        }
    }
    
    /**
     * Handle right-clicking on a health box (heal damage)
     */
    async _onHealthBoxRightClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const updatedHealth = await this.actor.healDamage(1);
        
        // Manually update the visual display without re-rendering the entire sheet
        this._updateHealthDisplay(updatedHealth);
    }
    
    /**
     * Handle reset health button click
     */
    async _onResetHealth(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const updatedHealth = await this.actor.resetHealth();
        
        // Manually update the visual display without re-rendering the entire sheet
        this._updateHealthDisplay(updatedHealth);
    }
    
    /**
     * Toggle health edit mode on/off
     * @param {Event} event
     * @private
     */
    async _onToggleHealthEdit(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const currentMode = this.actor.getFlag('wodsystem', 'healthEditMode') || false;
        await this.actor.setFlag('wodsystem', 'healthEditMode', !currentMode);
        this.render(false);
    }
    
    /**
     * Handle changing a health level's name
     * @param {Event} event
     * @private
     */
    async _onHealthNameChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const index = parseInt(input.dataset.index);
        const newName = input.value;
        
        await this.actor.updateHealthLevel(index, { name: newName });
    }
    
    /**
     * Handle changing a health level's penalty
     * @param {Event} event
     * @private
     */
    async _onHealthPenaltyChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const index = parseInt(input.dataset.index);
        const newPenalty = parseInt(input.value);
        
        await this.actor.updateHealthLevel(index, { penalty: newPenalty });
    }
    
    /**
     * Handle adding a new health level
     * @param {Event} event
     * @private
     */
    async _onAddHealthLevel(event) {
        event.preventDefault();
        event.stopPropagation();
        
        await this.actor.addHealthLevel("New Level", 0);
        this.render(false);
        
        // Scroll to show the add button after render
        setTimeout(() => {
            const addButton = this.element.find('.add-health-level')[0];
            if (addButton) {
                addButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    }
    
    /**
     * Handle deleting a health level
     * @param {Event} event
     * @private
     */
    async _onDeleteHealthLevel(event) {
        event.preventDefault();
        event.stopPropagation();
        const button = event.currentTarget;
        const index = parseInt(button.dataset.index);
        
        await this.actor.removeHealthLevel(index);
        this.render(false);
        
        // Scroll to show the add button after render
        setTimeout(() => {
            const addButton = this.element.find('.add-health-level')[0];
            if (addButton) {
                addButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    }
    
    /**
     * Update health display without re-rendering the entire sheet
     * @private
     */
    _updateHealthDisplay(health) {
        const healthBoxes = this.element.find('.health-box');
        
        health.levels.forEach((level, index) => {
            const box = healthBoxes[index];
            if (box) {
                // Remove all damage type classes
                box.classList.remove('marked', 'damage-bashing', 'damage-lethal', 'damage-aggravated');
                
                // Add appropriate classes if marked
                if (level.marked && level.damageType) {
                    box.classList.add('marked', `damage-${level.damageType}`);
                }
            }
        });
        
        // Update the health summary stats
        if (health.derived) {
            const penaltyElement = this.element.find('.penalty-value')[0];
            if (penaltyElement) penaltyElement.textContent = health.derived.currentPenalty;
            
            const healthStats = this.element.find('.health-stat span');
            if (healthStats[1]) healthStats[1].textContent = health.derived.bashingDamage;
            if (healthStats[2]) healthStats[2].textContent = health.derived.lethalDamage;
            if (healthStats[3]) healthStats[3].textContent = health.derived.aggravatedDamage;
        }
    }

    /**
     * Handle identity field changes
     */
    async _onIdentityChange(event) {
        event.preventDefault();
        const field = event.currentTarget.name;
        const value = event.currentTarget.value;
        await this.actor.update({ [field]: value });
    }

    /**
     * Handle biography field changes
     */
    async _onBiographyChange(event) {
        event.preventDefault();
        const field = event.currentTarget.name;
        const value = event.currentTarget.value;
        await this.actor.update({ [field]: value });
    }

    /**
     * Add a merit
     */
    async _onAddMerit(event) {
        event.preventDefault();
        const merits = foundry.utils.duplicate(this.actor.system.miscellaneous?.merits || []);
        merits.push({ name: "", value: 1 });
        await this.actor.update({ "system.miscellaneous.merits": merits });
    }

    /**
     * Delete a merit
     */
    async _onDeleteMerit(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const merits = foundry.utils.duplicate(this.actor.system.miscellaneous.merits);
        merits.splice(index, 1);
        await this.actor.update({ "system.miscellaneous.merits": merits });
    }

    /**
     * Add a flaw
     */
    async _onAddFlaw(event) {
        event.preventDefault();
        const flaws = foundry.utils.duplicate(this.actor.system.miscellaneous?.flaws || []);
        flaws.push({ name: "", value: 1 });
        await this.actor.update({ "system.miscellaneous.flaws": flaws });
    }

    /**
     * Delete a flaw
     */
    async _onDeleteFlaw(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const flaws = foundry.utils.duplicate(this.actor.system.miscellaneous.flaws);
        flaws.splice(index, 1);
        await this.actor.update({ "system.miscellaneous.flaws": flaws });
    }

    /**
     * Add a background
     */
    async _onAddBackground(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position before any updates
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const backgrounds = foundry.utils.duplicate(this.actor.system.miscellaneous?.backgrounds || []);
        backgrounds.push({ name: "Allies", value: 1 });
        
        // Navigate to the page containing the new background
        const backgroundsPerPage = 3;
        const newIndex = backgrounds.length - 1;
        const newPage = Math.floor(newIndex / backgroundsPerPage);
        
        await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds }, { render: false });
        await this.actor.setFlag('wodsystem', 'backgroundsPage', newPage);
        
        // Render without scrolling
        await this.render(false);
        
        // Restore scroll position after render
        setTimeout(() => {
            const newSheetBody = this.element.find('.sheet-body');
            if (newSheetBody.length) {
                newSheetBody.scrollTop(scrollPos);
            }
        }, 0);
    }

    /**
     * Handle background name dropdown change
     * Updates the name and initializes customName if "Custom" is selected
     */
    async _onBackgroundNameChange(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position (we will re-render to show/hide the custom input)
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;

        const select = event.currentTarget;
        const value = select.value;
        const match = select.name.match(/\.backgrounds\.(\d+)\.name/);
        if (!match) return;
        
        const index = parseInt(match[1]);
        const backgrounds = foundry.utils.duplicate(this.actor.system.miscellaneous.backgrounds);
        
        if (backgrounds[index]) {
            // Update the name
            backgrounds[index].name = value;
            
            // If "Custom" is selected, ensure customName field exists
            if (value === "Custom" && !backgrounds[index].customName) {
                backgrounds[index].customName = "";
            }

            // If switching away from Custom, remove customName to keep data clean
            if (value !== "Custom" && backgrounds[index].customName !== undefined) {
                delete backgrounds[index].customName;
            }
            
            // Update without letting Foundry auto-render the full sheet (prevents scroll jumps)
            await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds }, { render: false });

            // Re-render so the customName input shows/hides immediately
            await this.render(false);

            // Restore scroll position after render
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) newSheetBody.scrollTop(scrollPos);
            }, 0);
        }
    }

    /**
     * Handle custom background name input change
     * (We must update via an array-safe path because backgrounds are paginated in the template.)
     */
    async _onBackgroundCustomNameChange(event) {
        event.preventDefault();
        event.stopPropagation();

        const input = event.currentTarget;
        const value = input.value;
        const match = input.name.match(/\.backgrounds\.(\d+)\.customName/);
        if (!match) return;

        const index = parseInt(match[1]);
        const backgrounds = foundry.utils.duplicate(this.actor.system.miscellaneous.backgrounds);
        if (!backgrounds[index]) return;

        backgrounds[index].customName = value;
        await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds }, { render: false });
    }

    /**
     * Delete a background
     */
    async _onDeleteBackground(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position before any updates
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const index = parseInt(event.currentTarget.dataset.index);
        const backgrounds = foundry.utils.duplicate(this.actor.system.miscellaneous.backgrounds);
        backgrounds.splice(index, 1);
        
        // If we deleted the last item on the current page, go back to the previous page
        const backgroundsPerPage = 3;
        const currentPage = this.actor.getFlag('wodsystem', 'backgroundsPage') || 0;
        const totalPages = Math.max(1, Math.ceil(backgrounds.length / backgroundsPerPage));
        
        await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds }, { render: false });
        
        if (currentPage >= totalPages && currentPage > 0) {
            await this.actor.setFlag('wodsystem', 'backgroundsPage', totalPages - 1);
        }
        
        // Render without scrolling
        await this.render(false);
        
        // Restore scroll position after render
        setTimeout(() => {
            const newSheetBody = this.element.find('.sheet-body');
            if (newSheetBody.length) {
                newSheetBody.scrollTop(scrollPos);
            }
        }, 0);
    }

    /**
     * Navigate to previous page of backgrounds
     */
    async _onBackgroundsPrevPage(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position before any updates
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const currentPage = this.actor.getFlag('wodsystem', 'backgroundsPage') || 0;
        if (currentPage > 0) {
            await this.actor.setFlag('wodsystem', 'backgroundsPage', currentPage - 1);
            await this.render(false);
            
            // Restore scroll position after render
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) {
                    newSheetBody.scrollTop(scrollPos);
                }
            }, 0);
        }
    }

    /**
     * Navigate to next page of backgrounds
     */
    async _onBackgroundsNextPage(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position before any updates
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const backgroundsPerPage = 3;
        const totalBackgrounds = this.actor.system.miscellaneous?.backgrounds?.length || 0;
        const totalPages = Math.ceil(totalBackgrounds / backgroundsPerPage);
        const currentPage = this.actor.getFlag('wodsystem', 'backgroundsPage') || 0;
        
        if (currentPage < totalPages - 1) {
            await this.actor.setFlag('wodsystem', 'backgroundsPage', currentPage + 1);
            await this.render(false);
            
            // Restore scroll position after render
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) {
                    newSheetBody.scrollTop(scrollPos);
                }
            }, 0);
        }
    }

    /**
     * Add a secondary ability
     */
    async _onAddSecondaryAbility(event, category) {
        event.preventDefault();
        const abilities = foundry.utils.duplicate(this.actor.system.secondaryAbilities?.[category] || []);
        abilities.push({ name: "", value: 0 });
        await this.actor.update({ [`system.secondaryAbilities.${category}`]: abilities });
    }

    /**
     * Delete a secondary ability
     */
    async _onDeleteSecondaryAbility(event) {
        event.preventDefault();
        const category = event.currentTarget.dataset.category;
        const index = parseInt(event.currentTarget.dataset.index);
        const abilities = foundry.utils.duplicate(this.actor.system.secondaryAbilities[category]);
        abilities.splice(index, 1);
        await this.actor.update({ [`system.secondaryAbilities.${category}`]: abilities });
    }

    /**
     * Update an attribute
     */
    async _updateAttribute(category, key, value) {
        const updateData = {};
        updateData[`system.attributes.${category}.${key}`] = Math.min(Math.max(value, 1), 5);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update an ability
     */
    async _updateAbility(category, key, value) {
        const updateData = {};
        updateData[`system.abilities.${category}.${key}`] = Math.min(Math.max(value, 0), 5);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update willpower
     */
    async _updateWillpower(type, value) {
        const maxValue = type === 'temporary' ? this.actor.system.miscellaneous.willpower.permanent : 10;
        const updateData = {};
        updateData[`system.miscellaneous.willpower.${type}`] = Math.min(Math.max(value, 0), maxValue);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update a merit value
     */
    async _updateMerit(index, value) {
        const updateData = {};
        updateData[`system.miscellaneous.merits.${index}.value`] = Math.min(Math.max(value, 1), 5);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update a flaw value
     */
    async _updateFlaw(index, value) {
        const updateData = {};
        updateData[`system.miscellaneous.flaws.${index}.value`] = Math.min(Math.max(value, 1), 5);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update a background value
     */
    async _updateBackground(index, value) {
        const updateData = {};
        updateData[`system.miscellaneous.backgrounds.${index}.value`] = Math.min(Math.max(value, 0), 5);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update a virtue value
     */
    async _updateVirtue(virtueName, value) {
        const updateData = {};
        updateData[`system.advantages.virtues.${virtueName}`] = Math.min(Math.max(value, 0), 5);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update humanity value
     */
    async _updateHumanity(value) {
        const updateData = {};
        updateData[`system.miscellaneous.humanity.current`] = Math.min(Math.max(value, 0), 10);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update torment value (for Demons)
     * @param {number} value
     * @private
     */
    async _updateTorment(value) {
        const updateData = {};
        updateData[`system.miscellaneous.torment.current`] = Math.min(Math.max(value, 0), 10);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update Enlightenment value (for Technocrats)
     * @param {number} value
     * @private
     */
    async _updateEnlightenment(value) {
        const updateData = {};
        updateData[`system.advantages.enlightenment.current`] = Math.min(Math.max(value, 0), 10);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update Paradox value (for Technocrats)
     * @param {string} type - "current" or "permanent"
     * @param {number} value
     * @private
     */
    async _updateParadox(type, value) {
        const updateData = {};
        updateData[`system.advantages.paradox.${type}`] = Math.min(Math.max(value, 0), 10);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Handle clicking on Primal Energy asterisks (for Technocrats)
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
     * Update a secondary ability value
     */
    async _updateSecondaryAbility(category, index, value) {
        const updateData = {};
        updateData[`system.secondaryAbilities.${category}.${index}.value`] = Math.min(Math.max(value, 0), 5);
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Update health (old system)
     */
    async _updateHealthOld(type, value) {
        const maxValue = type === 'current' ? this.actor.system.miscellaneous.health.maximum : 10;
        const updateData = {};
        updateData[`system.miscellaneous.health.${type}`] = Math.min(Math.max(value, 0), maxValue);
        
        await this.actor.update(updateData, { render: false });
        this._syncVisualStateWithData();
    }

    /**
     * Get current value from a dot container
     */
    _getCurrentValue(container) {
        const input = container.querySelector('.dot-input');
        return parseInt(input.value) || 0;
    }

    /**
     * Get current health value from container
     */
    _getCurrentHealthValue(container) {
        const input = container.querySelector('.health-input');
        return parseInt(input.value) || 0;
    }

    /**
     * Update dot visuals
     */
    _updateDotVisuals(container, newValue) {
        const dots = container.querySelectorAll('.dot');
        const input = container.querySelector('.dot-input');
        
        if (input) {
            input.value = newValue;
        }
        
        dots.forEach((dot, index) => {
            if (index < newValue) {
                dot.classList.add('filled');
                dot.style.setProperty('background-color', '#800000', 'important');
                dot.style.backgroundColor = '#800000';
                dot.setAttribute('style', dot.getAttribute('style') + '; background-color: #800000 !important;');
            } else {
                dot.classList.remove('filled');
                dot.style.setProperty('background-color', 'white', 'important');
                dot.style.backgroundColor = 'white';
                dot.setAttribute('style', dot.getAttribute('style') + '; background-color: white !important;');
            }
        });
    }

    /**
     * Update health checkbox visuals (old system)
     */
    _updateHealthCheckboxVisuals(container, newValue) {
        const checkboxes = container.querySelectorAll('.health-checkbox');
        const input = container.querySelector('.health-input');
        
        if (input) {
            input.value = newValue;
        }
        
        checkboxes.forEach((checkbox, index) => {
            if (index < newValue) {
                checkbox.classList.add('checked');
            } else {
                checkbox.classList.remove('checked');
            }
        });
    }

    /** @override */
    /** @override */
    async _onChangeInput(event) {
        // Store scroll position before any form change
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;

        // IMPORTANT:
        // Backgrounds are paginated, so only a subset of array rows exist in the form at any time.
        // Foundry's default _onChangeInput merges "submit data" for the WHOLE form, which can clobber
        // `system.miscellaneous.backgrounds` when paging is active. We therefore ignore background field
        // changes here and handle them with dedicated handlers above.
        const fieldName = event?.target?.name ?? "";
        if (fieldName.startsWith("system.miscellaneous.backgrounds.")) {
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) newSheetBody.scrollTop(scrollPos);
            }, 0);
            return;
        }

        // Call parent method to handle non-background updates
        await super._onChangeInput(event);
        
        // Restore scroll position after update
        setTimeout(() => {
            const newSheetBody = this.element.find('.sheet-body');
            if (newSheetBody.length) {
                newSheetBody.scrollTop(scrollPos);
            }
        }, 0);
    }

    async _render(force = false, options = {}) {
        const result = await super._render(force, options);
        
        // After rendering, sync the visual state with the actual data
        if (this.element) {
            this._syncVisualStateWithData();
        }
        
        return result;
    }

    /**
     * Sync visual state with data after updates
     */
    _syncVisualStateWithData() {
        if (!this.element) return;
        
        // Sync all dot containers
        const containers = this.element.find('.dot-container');
        containers.each((index, container) => {
            const $container = $(container);
            const input = $container.find('.dot-input')[0];
            if (input) {
                const currentValue = parseInt(input.value) || 0;
                this._updateDotVisuals($container[0], currentValue);
            }
        });
        
        // Sync all health checkbox containers (old system)
        const healthContainers = this.element.find('.checkbox-container');
        healthContainers.each((index, container) => {
            const $container = $(container);
            const input = $container.find('.health-input')[0];
            if (input) {
                const currentValue = parseInt(input.value) || 0;
                this._updateHealthCheckboxVisuals($container[0], currentValue);
            }
        });
    }
}

