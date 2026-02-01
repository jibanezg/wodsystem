import { DemonSheet } from "./demon-sheet.js";

// Houses list - defined here to avoid import issues (though Earthbound don't use houses)
const HOUSES = ["Devil", "Fiend", "Devourer", "Malefactor", "Scourge", "Slayer", "Defiler"];

/**
 * Earthbound Actor Sheet
 * Extends DemonSheet with Earthbound-specific functionality
 */
export class EarthboundSheet extends DemonSheet {
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "earthbound"],
            template: "systems/wodsystem/templates/actor/earthbound-sheet.html",
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }
    
    /** @override */
    get template() {
        return "systems/wodsystem/templates/actor/earthbound-sheet.html";
    }
    
    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Set Earthbound-specific flags
        context.isEarthbound = true;
        context.isDemon = false;
        context.isNPC = this.actor.type.includes("-NPC");
        
        // Add houses list for House dropdown (though Earthbound don't use houses)
        context.houses = HOUSES;
        
        // Create Earthbound-specific background list (both + earthbound only)
        // Use the canonical list computed by the base sheet (filtered by actor type)
        context.earthboundBackgroundsList = context.backgroundsList || [];
        
        // Resolve apocalyptic form ID to display name (Earthbound use same system as Demon)
        const service = game.wod?.referenceDataService;
        const formId = this.actor?.system?.apocalypticForm;
        
        // Handle different formId formats
        if (formId && typeof formId === 'string' && formId.trim() !== '') {
            if (service) {
                // Try to get the form by ID first
                let form = service.getApocalypticFormById?.(formId);
                
                // If that fails, try by name (backward compatibility)
                if (!form) {
                    form = service.getApocalypticFormByName?.(formId);
                }
                
                // If we found a form, use its name for display
                if (form) {
                    context.apocalypticFormName = form.name;
                } else {
                    // Fallback: try to format the ID nicely
                    context.apocalypticFormName = formId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
            } else {
                // No service available, use formatted ID
                context.apocalypticFormName = formId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
        } else {
            // No valid formId (empty string, null, undefined, or empty object)
            context.apocalypticFormName = '';
        }
        
        return context;
    }
    
    /**
     * Get Earthbound-specific backgrounds list (both + earthbound only)
     */
    _getEarthboundBackgroundsList() {
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return [];
        
        const backgrounds = service.getBackgrounds?.() || service.data?.d20?.backgrounds || [];
        if (!backgrounds || backgrounds.length === 0) return [];
        
        // Filter backgrounds: show "both" and "earthbound" only
        const filteredBackgrounds = backgrounds.filter(bg => {
            const availableTo = bg.availableTo;
            return availableTo === 'both' || availableTo === 'earthbound';
        });
        
        // Sort alphabetically and return just the names
        return filteredBackgrounds
            .map(bg => bg.name)
            .sort((a, b) => a.localeCompare(b));
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Apocalyptic form reference button
        html.find('.apocalyptic-form-reference-btn').click(this._onApocalypticFormReferenceClick.bind(this));
        
        // Apocalyptic form dropdown change
        html.find('.apocalyptic-form-select').change(this._onApocalypticFormChange.bind(this));
        
        // Initialize apocalyptic tab
        this._initializeApocalypticTab();
    }

    _onBackgroundReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;

        const $button = $(event.currentTarget);
        const $select = $button.siblings('.background-name-select');
        const backgroundName = $select.val();

        if (!backgroundName || backgroundName === "Custom") return;

        const background = service.getBackgroundByName(backgroundName, this.actor.type);
        if (!background) return;

        const existingTooltip = $('.wod-reference-tooltip');
        if (existingTooltip.length) {
            this._hideReferenceTooltip();
        } else {
            this._showBackgroundTooltip(event, background);
        }
    }

    _showBackgroundTooltip(event, background) {
        super._showBackgroundTooltip(event, background);

        const earthboundOnlyNames = new Set([
            'Allies',
            'Contacts',
            'Codex',
            'Cult',
            'Hoard',
            'Influence',
            'Mastery',
            'Resources',
            'Thralls',
            'Worship'
        ]);

        // Debug logging to check what's happening
        console.log('Earthbound tooltip check:', {
            backgroundName: background?.name,
            availableTo: background?.availableTo,
            earthboundModification: background?.earthboundModification,
            modification: background?.modification,
            fullBackground: background
        });

        const shouldAdd = background?.availableTo === 'earthbound' || earthboundOnlyNames.has(background?.name);
        if (!shouldAdd) return;

        const $tooltip = $('.wod-reference-tooltip');
        if (!$tooltip.length) return;

        const $inner = $tooltip.find('.reference-tooltip-inner');
        if (!$inner.length) return;

        // Use the extracted Earthbound modification if available
        const modificationText = background?.earthboundModification;
        if (modificationText) {
            $inner.append(`
                <div class="earthbound-background-modification" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.15);">
                    <strong style="color: #1e3a8a;">Earthbound Modification:</strong><br/>
                    <p style="margin: 5px 0; font-size: 0.9em; line-height: 1.3; color: #1e40af;">${modificationText}</p>
                </div>
            `);
        } else {
            $inner.append(`
                <div class="earthbound-background-modification" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.15);">
                    <strong style="color: #1e3a8a;">Earthbound:</strong> <span style="color: #1e40af;">This background functions differently for Earthbound characters.</span>
                </div>
            `);
        }
    }
    
    /**
     * Handle Earthbound background reference button clicks
     */
    async _onEarthboundBackgroundReference(event) {
        event.preventDefault();
        const button = $(event.currentTarget);
        const backgroundName = button.data('background-name');
        
        if (!backgroundName) return;
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;
        
        const background = service.getBackground(backgroundName);
        if (!background) return;
        
        // Create tooltip content with Earthbound-specific modifications
        let content = `
            <div class="background-reference">
                <h3>${background.name}</h3>
                <p>${background.description}</p>
        `;
        
        // Add Earthbound-specific modifications if applicable
        if (background.availableTo === 'earthbound') {
            content += `
                <div class="earthbound-modification">
                    <h4>Earthbound Modification:</h4>
                    <p>This background works differently for Earthbound characters.</p>
                </div>
            `;
        }
        
        // Add cost levels
        if (background.costLevels && background.costLevels.length > 0) {
            content += '<div class="cost-levels"><h4>Cost Levels:</h4><ul>';
            background.costLevels.forEach(level => {
                content += `<li><strong>${level.label}:</strong> ${level.description}</li>`;
            });
            content += '</ul></div>';
        }
        
        content += '</div>';
        
        // Show tooltip/dialog
        const dialog = new Dialog({
            title: `${background.name} - Reference`,
            content: content,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Close',
                    callback: () => {}
                }
            },
            default: 'close'
        });
        
        dialog.render(true);
    }
    
    /**
     * Handle Earthbound lock background button clicks
     */
    async _onEarthboundLockBackground(event) {
        event.preventDefault();
        const button = $(event.currentTarget);
        const index = button.data('index');
        
        if (index === undefined) return;
        
        const backgrounds = this.actor.system.miscellaneous.backgrounds || [];
        const background = backgrounds[index];
        
        if (!background) return;
        
        // Toggle lock state
        const isLocked = !background.locked;
        
        // Update the background
        await this.actor.update({
            [`system.miscellaneous.backgrounds.${index}.locked`]: isLocked
        });
        
        // Update button appearance
        const icon = button.find('i');
        if (isLocked) {
            icon.removeClass('fa-lock-open').addClass('fa-lock');
            button.addClass('locked');
            button.attr('title', 'Unlock Background');
        } else {
            icon.removeClass('fa-lock').addClass('fa-lock-open');
            button.removeClass('locked');
            button.attr('title', 'Lock Background');
        }
    }
    
    /**
     * Handle Earthbound delete background button clicks
     */
    async _onEarthboundDeleteBackground(event) {
        event.preventDefault();
        const button = $(event.currentTarget);
        const index = button.data('index');
        
        if (index === undefined) return;
        
        const backgrounds = this.actor.system.miscellaneous.backgrounds || [];
        const background = backgrounds[index];
        
        if (!background) return;
        
        // Confirm deletion
        const dialog = new Dialog({
            title: 'Delete Background',
            content: `<p>Are you sure you want to delete the background "${background.name || background.customName || 'Unknown'}"?</p>`,
            buttons: {
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: 'Delete',
                    callback: async () => {
                        // Remove the background
                        const updatedBackgrounds = [...backgrounds];
                        updatedBackgrounds.splice(index, 1);
                        
                        await this.actor.update({
                            'system.miscellaneous.backgrounds': updatedBackgrounds
                        });
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel',
                    callback: () => {}
                }
            },
            default: 'cancel'
        });
        
        dialog.render(true);
    }
    
    /**
     * Handle Earthbound add background button clicks
     */
    async _onEarthboundAddBackground(event) {
        event.preventDefault();
        
        const backgrounds = this.actor.system.miscellaneous.backgrounds || [];
        
        // Add new background
        const newBackground = {
            name: '',
            customName: '',
            value: 0,
            maxRating: 5,
            locked: false
        };
        
        const updatedBackgrounds = [...backgrounds, newBackground];
        
        await this.actor.update({
            'system.miscellaneous.backgrounds': updatedBackgrounds
        });
    }
    
    /**
     * Render lore paths dynamically - Earthbound version with Black Knowledge
     */
    _renderLorePaths() {
        const container = this.element.find('#lore-paths-container');
        if (!container.length) return;
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;
        
        // Get lore paths and black knowledge separately
        const lorePaths = service.getLorePaths?.() || service.data?.d20?.lorePaths || [];
        const blackKnowledge = service.data?.d20?.blackKnowledge || [];
        
        if (!lorePaths || lorePaths.length === 0) {
            return;
        }
        
        // Earthbound include both regular lore paths and Black Knowledge
        const allLorePaths = [...lorePaths, ...blackKnowledge];
        
        // Filter lore paths: show Common Lore and Black Knowledge only
        const filteredLorePaths = allLorePaths.filter(lore => {
            const loreHouse = lore.house || 'Common Lore';
            const availableTo = lore.availableTo;
            
            // Show if it's Common Lore
            if (loreHouse === 'Common Lore') return true;
            
            // Show Black Knowledge lore paths
            if (availableTo === 'earthbound') return true;
            
            return false;
        });
        
        // Group by category (Common Lore and Black Knowledge)
        const grouped = {};
        filteredLorePaths.forEach(lore => {
            let category;
            if (lore.availableTo === 'earthbound') {
                category = 'Black Knowledge';
            } else {
                category = lore.house || 'Common Lore';
            }
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(lore);
        });
        
        // Render grouped lore paths using three-column card grid layout
        let html = '';
        Object.keys(grouped).sort().forEach(category => {
            html += `<div class="lore-category">`;
            html += `<h4>${category}</h4>`;
            html += `<div class="lore-cards-grid">`;
            
            grouped[category].forEach(lore => {
                const currentRating = this.actor.system.lore?.[lore.id]?.rating || 0;
                html += this._renderLorePathCard(lore, currentRating);
            });
            
            html += `</div></div>`;
        });
        
        container.html(html);
        
        // Re-attach listeners for dynamically created elements
        container.find('.lore-reference-btn').click(this._onLoreReferenceClick.bind(this));
        container.find('.lore-dot').click(this._onLoreDotClick.bind(this));
    }
    
    _renderLorePathCard(lore, currentRating) {
        return `
            <div class="lore-card" data-lore-id="${lore.id}">
                <div class="lore-header">
                    <h4 class="lore-name">${lore.name}</h4>
                    <div class="lore-actions">
                        <button type="button" class="lore-reference-btn" data-lore-id="${lore.id}" title="View Reference">
                            <i class="fas fa-book"></i>
                        </button>
                    </div>
                </div>
                <div class="lore-rating">
                    <div class="dot-container">
                        ${[1, 2, 3, 4, 5].map(level => `
                            <div class="dot lore-dot ${level <= currentRating ? 'filled' : ''}" 
                                 data-lore-id="${lore.id}" data-rating="${level}"></div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Handle lore dot clicks
     */
    _onLoreDotClick(event) {
        event.preventDefault();
        const dot = $(event.currentTarget);
        const loreId = dot.data('lore-id');
        const rating = parseInt(dot.data('rating'));
        
        // Toggle the rating
        const currentRating = this.actor.system.lore?.[loreId]?.rating || 0;
        const newRating = rating === currentRating ? 0 : rating;
        
        // Update the actor data
        this.actor.update({
            [`system.lore.${loreId}.rating`]: newRating
        });
    }
    
    /**
     * Handle clicking on a dot (Earthbound-specific for torment)
     */
    async _onDotClick(event) {
        event.preventDefault();
        
        const dot = event.currentTarget;
        const container = dot.closest('.dot-container');
        
        // Skip if this dot is disabled (beyond maxRating)
        if (dot.dataset.disabled === "true" || dot.classList.contains('disabled')) {
            return;
        }
        
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

        // Handle torment specifically for Earthbound (stored in miscellaneous, not advantages)
        if (container.dataset.torment) {
            await this._updateEarthboundTorment(container.dataset.torment, newValue);
        } else if (container.dataset.faith) {
            // Handle faith with scroll position preservation
            await this._updateFaith(container.dataset.faith, newValue);
        } else {
            // For all other dots, use the base sheet handling
            await super._onDotClick(event);
            return; // Skip the visual update since super._onDotClick handles it
        }
        
        // Update the visual appearance after data is saved
        this._updateDotVisuals(container, newValue);
    }
    
    /**
     * Update Earthbound Torment (stored in system.miscellaneous.torment)
     */
    async _updateEarthboundTorment(type, value) {
        // Store current scroll position to prevent auto-scrolling after rerender
        const scrollContainer = this.element.find('.sheet-body')[0];
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;

        const updateData = {};
        let finalValueForVisuals;
        let tempValueForVisuals;
        
        if (type === 'temporary') {
            // Get current values with proper defaults
            const currentPermanent = parseInt(this.actor.system.miscellaneous.torment?.permanent) || 0;
            const currentTemporary = parseInt(this.actor.system.miscellaneous.torment?.temporary) || 0;
            
            // Validate input value
            const newValue = Math.min(Math.max(parseInt(value) || 0, 0), 10);
            
            // Check if temporary torment equals or exceeds permanent torment
            if (newValue >= currentPermanent && currentPermanent > 0) {
                // Calculate new permanent value (capped at 10)
                const newPermanent = Math.min(currentPermanent + 1, 10);
                
                // Prepare update data for Earthbound path
                updateData[`system.miscellaneous.torment.permanent`] = newPermanent;
                updateData[`system.miscellaneous.torment.temporary`] = 0;
                
                // Set visual update values
                finalValueForVisuals = 0; // Temporary reset to 0
                tempValueForVisuals = newPermanent; // New permanent value
                
                ui.notifications.info(`Temporary Torment reached Permanent! Permanent Torment increased to ${newPermanent}.`);
            } else {
                // Normal temporary update
                const maxValue = currentPermanent;
                const clampedValue = Math.min(newValue, maxValue);
                
                updateData[`system.miscellaneous.torment.temporary`] = clampedValue;
                finalValueForVisuals = clampedValue;
                
                // Warn if player tried to exceed permanent torment
                if (newValue > currentPermanent && currentPermanent > 0) {
                    ui.notifications.warn(`Cannot exceed Permanent Torment (${currentPermanent}).`);
                }
            }
        } else if (type === 'permanent') {
            // Permanent torment logic
            const newPermanent = Math.min(Math.max(parseInt(value) || 0, 0), 10);
            const currentTemporary = parseInt(this.actor.system.miscellaneous.torment?.temporary) || 0;
            
            updateData[`system.miscellaneous.torment.permanent`] = newPermanent;
            finalValueForVisuals = newPermanent;
            
            // If temporary exceeds new permanent, reduce it to match
            if (currentTemporary > newPermanent) {
                updateData[`system.miscellaneous.torment.temporary`] = newPermanent;
                tempValueForVisuals = newPermanent;
                ui.notifications.warn(`Temporary Torment reduced to match new Permanent value (${newPermanent}).`);
            }
        }
        
        // Update the actor
        await this.actor.update(updateData);
        
        // Restore scroll position after rerender
        setTimeout(() => {
            const updatedScrollContainer = this.element.find('.sheet-body')[0];
            if (updatedScrollContainer) {
                updatedScrollContainer.scrollTop = scrollTop;
                updatedScrollContainer.scrollLeft = scrollLeft;
            }
        }, 10); // Faster delay to ensure rerender completes
        
        // Update visuals for special cases
        if (type === 'temporary' && tempValueForVisuals !== undefined) {
            // Special case: temporary reached permanent, so both need updating
            const tempContainer = this.element.find(`.dot-container[data-torment="temporary"]`)[0];
            if (tempContainer) {
                this._updateDotVisuals(tempContainer, 0);
            }
            
            const permContainer = this.element.find(`.dot-container[data-torment="permanent"]`)[0];
            if (permContainer) {
                this._updateDotVisuals(permContainer, tempValueForVisuals);
            }
            
            // Update label to show new permanent value
            const permLabel = this.element.find('[data-torment="permanent"] .trait-label')[0];
            if (permLabel) {
                permLabel.dataset.value = tempValueForVisuals;
            }
            
        } else {
            // Normal update: just update the type being changed
            const container = this.element.find(`.dot-container[data-torment="${type}"]`)[0];
            if (container) {
                this._updateDotVisuals(container, finalValueForVisuals);
            }
            
            // If permanent changed and temporary was reduced, update temporary too
            if (type === 'permanent' && tempValueForVisuals !== undefined) {
                const tempContainer = this.element.find(`.dot-container[data-torment="temporary"]`)[0];
                if (tempContainer) {
                    this._updateDotVisuals(tempContainer, tempValueForVisuals);
                }
            }
        }
    }
    
    /**
     * Handle lore reference button clicks
     */
    _onLoreReferenceClick(event) {
        event.preventDefault();
        const btn = $(event.currentTarget);
        const loreId = btn.data('lore-id');
        
        // Get the lore data
        const service = game.wod?.referenceDataService;
        if (service) {
            const lore = service.getLorePathById(loreId);
            if (lore) {
                // Create and show reference dialog
                new Dialog({
                    title: lore.name,
                    content: `
                        <div style="padding: 10px;">
                            <h3>${lore.name}</h3>
                            <p><strong>Category:</strong> ${lore.house || 'Common Lore'}</p>
                            <p><strong>Description:</strong></p>
                            <p>${lore.description || 'No description available.'}</p>
                            ${lore.system ? `<p><strong>System:</strong> ${lore.system}</p>` : ''}
                        </div>
                    `,
                    buttons: {
                        close: {
                            label: "Close",
                            callback: () => {}
                        }
                    },
                    default: "close"
                }).render(true);
            }
        }
    }
    
    /**
     * Initialize apocalyptic tab
     */
    _initializeApocalypticTab() {
        // Populate dropdown
        this._populateApocalypticFormDropdown();
        
        // Update reference button visibility
        const formId = this.actor.system.apocalypticForm;
        const refButton = this.element.find('.apocalyptic-form-reference-btn');
        
        // Handle different possible types of formId
        if (formId) {
            let formIdStr = '';
            if (Array.isArray(formId)) {
                // If it's an array, take the first non-empty element
                formIdStr = formId.find(item => item && typeof item === 'string' && item.trim() !== '') || '';
            } else if (typeof formId === 'string') {
                formIdStr = formId;
            } else if (typeof formId === 'object' && formId !== null) {
                // If it's an object, try to get a string representation
                formIdStr = formId.id || formId.name || JSON.stringify(formId);
            } else {
                formIdStr = String(formId);
            }
            
            if (formIdStr.trim() !== '') {
                refButton.attr('data-form-id', formIdStr).addClass('has-reference').show();
            } else {
                refButton.hide();
            }
        } else {
            refButton.hide();
        }
        
        // Populate powers
        this._populateApocalypticFormPowers();
    }
    
    /**
     * Handle apocalyptic form reference button click (show tooltip)
     */
    _onApocalypticFormReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const btn = $(event.currentTarget);
        const formId = btn.data('form-id');
        
        if (!formId || formId === 'undefined') {
            return;
        }
        
        // Get apocalyptic form
        const service = game.wod?.referenceDataService;
        const form = service.getApocalypticFormById?.(formId) || service.getApocalypticFormByName?.(formId);
        
        if (form) {
            this._showApocalypticFormTooltip(event, form);
        } else {
            ui.notifications.warn(`Apocalyptic form "${formId}" not found`);
        }
    }
    
    /**
     * Handle apocalyptic form dropdown change
     */
    async _onApocalypticFormChange(event) {
        const formId = $(event.currentTarget).val();
        const updateData = { "system.apocalypticForm": formId || null };
        await this.actor.update(updateData);
        
        // Update reference button visibility and data
        const refButton = this.element.find('.apocalyptic-form-reference-btn');
        if (formId) {
            refButton.attr('data-form-id', formId).addClass('has-reference').show();
        } else {
            refButton.hide();
        }
        
        // Populate powers
        this._populateApocalypticFormPowers();
    }
    
    /**
     * Populate apocalyptic form dropdown
     */
    _populateApocalypticFormDropdown() {
        const select = this.element.find('.apocalyptic-form-select');
        if (!select.length) return;
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;
        
        // Get visage options with proper ID-to-name mapping
        const visageOptions = service.getVisageOptions();
        if (!visageOptions || visageOptions.length === 0) return;
        
        // Clear existing options except the first "None" option
        select.find('option:not(:first)').remove();
        
        // Add visage options using ID as value and name as display
        visageOptions.forEach(visage => {
            select.append(`<option value="${visage.id}" ${this.actor.system.apocalypticForm === visage.id ? 'selected' : ''}>${visage.name}</option>`);
        });
    }
    
    /**
     * Populate apocalyptic form powers when a form is selected
     */
    _populateApocalypticFormPowers() {
        const powersContainer = this.element.find('#apocalyptic-form-powers');
        if (!powersContainer.length) return;
        
        const formId = this.actor.system.apocalypticForm;
        
        // Handle different possible types of formId
        let formIdStr = '';
        if (formId) {
            if (Array.isArray(formId)) {
                // If it's an array, take the first non-empty element
                formIdStr = formId.find(item => item && typeof item === 'string' && item.trim() !== '') || '';
            } else if (typeof formId === 'string') {
                formIdStr = formId;
            } else if (typeof formId === 'object' && formId !== null) {
                formIdStr = formId.id || formId.name || JSON.stringify(formId);
            } else {
                formIdStr = String(formId);
            }
        }
        
        if (!formIdStr || formIdStr.trim() === '') {
            powersContainer.html('<p><em>No apocalyptic form selected.</em></p>');
            return;
        }
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) {
            powersContainer.html('<p><em>Loading apocalyptic form data...</em></p>');
            return;
        }
        
        // Get the form data
        const form = service.getApocalypticFormById?.(formIdStr) || service.getApocalypticFormByName?.(formIdStr);
        if (!form) {
            powersContainer.html(`<p><em>Apocalyptic form "${formIdStr}" not found.</em></p>`);
            return;
        }
        
        // Generate powers HTML
        let powersHTML = '';
        if (form.powers && form.powers.length > 0) {
            powersHTML += '<div class="form-powers"><h4>Apocalyptic Form Powers</h4><ul>';
            form.powers.forEach(power => {
                powersHTML += `<li><strong>${power.name || 'Unknown Power'}:</strong> ${power.description || 'No description available.'}</li>`;
            });
            powersHTML += '</ul></div>';
        } else {
            powersHTML = '<p><em>No powers available for this form.</em></p>';
        }
        
        powersContainer.html(powersHTML);
    }
    
    /**
     * Show apocalyptic form tooltip
     */
    _showApocalypticFormTooltip(event, form) {
        this._hideApocalypticFormTooltip(); // Remove any existing tooltip
        
        const service = game.wod?.referenceDataService;
        if (!service) {
            ui.notifications.warn("Reference data service not available");
            return;
        }
        
        // Try to get tooltip HTML from service, fallback to custom generation
        let tooltipHTML = service.generateApocalypticFormTooltipHTML?.(form);
        
        if (!tooltipHTML) {
            // Generate fallback tooltip HTML
            tooltipHTML = this._generateApocalypticFormTooltipHTML(form);
        }
        
        if (!tooltipHTML) {
            ui.notifications.warn("Could not generate apocalyptic form tooltip");
            return;
        }
        
        const tooltip = $(`
            <div class="wod-reference-tooltip wod-apocalyptic-form-tooltip" 
                 style="position: fixed; 
                        z-index: 100000; 
                        background-color: white; 
                        border: 2px solid var(--wod-primary, #2F5F3F); 
                        border-radius: 6px; 
                        padding: 15px; 
                        box-shadow: 0 4px 20px rgba(47, 95, 63, 0.4); 
                        max-width: 600px; 
                        max-height: 80vh; 
                        overflow-y: auto;">
                ${tooltipHTML}
            </div>
        `);
        
        $('body').append(tooltip);
        
        // Position tooltip
        const button = $(event.currentTarget);
        const buttonOffset = button.offset();
        tooltip.css({
            top: buttonOffset.top + button.outerHeight() + 5,
            left: buttonOffset.left
        });
        
        // Add click handler for post button
        tooltip.find('.post-form-btn').click((e) => {
            e.stopPropagation();
            this._postApocalypticFormToChat(form);
            this._hideApocalypticFormTooltip();
        });
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.click((e) => {
            e.stopPropagation();
        });
        
        // Close tooltip when clicking outside
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideApocalypticFormTooltip();
            });
        }, 100);
    }
    
    /**
     * Hide apocalyptic form tooltip
     */
    _hideApocalypticFormTooltip() {
        $('.wod-apocalyptic-form-tooltip').fadeOut(200, function() {
            $(this).remove();
        });
    }
    
    /**
     * Generate fallback apocalyptic form tooltip HTML
     */
    _generateApocalypticFormTooltipHTML(form) {
        if (!form) return '';
        
        let html = `
            <div style="font-family: 'Signika', sans-serif;">
                <h3 style="color: var(--wod-primary, #2F5F3F); margin: 0 0 12px 0; font-size: 1.2em;">
                    ${form.name || 'Unknown Visage'}
                </h3>
        `;
        
        if (form.description) {
            html += `<p style="margin: 0 0 12px 0; line-height: 1.4;">${form.description}</p>`;
        }
        
        if (form.powers && form.powers.length > 0) {
            html += '<h4 style="color: var(--wod-primary-light, #3F7F5F); margin: 12px 0 8px 0;">Powers</h4><ul style="margin: 0 0 12px 0; padding-left: 20px;">';
            form.powers.forEach(power => {
                html += `<li style="margin-bottom: 4px;"><strong>${power.name || 'Unknown Power'}:</strong> ${power.description || 'No description'}</li>`;
            });
            html += '</ul>';
        }
        
        html += `
            <div style="margin-top: 15px; text-align: right; border-top: 1px solid #ddd; padding-top: 10px;">
                <button class="post-form-btn" style="background: var(--wod-primary, #2F5F3F); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                    <i class="fas fa-comment-dots"></i> Post to Chat
                </button>
            </div>
        `;
        
        html += '</div>';
        return html;
    }
    
    /**
     * Post apocalyptic form reference to chat
     */
    async _postApocalypticFormToChat(form) {
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        const html = service.generateApocalypticFormChatHTML?.(form);
        if (!html) {
            ui.notifications.warn("Apocalyptic form chat HTML generation not available");
            return;
        }
        
        const chatData = {
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: html,
            type: CONST.CHAT_MESSAGE_TYPES.OOC
        };
        
        ChatMessage.create(chatData);
    }
}
