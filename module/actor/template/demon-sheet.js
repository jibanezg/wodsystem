/**
 * Demon/Earthbound Actor Sheet
 * Extends WodActorSheet to reuse all logic, only sets template and CSS class
 * For Demon: The Fallen - Demons and Earthbounds
 */

import { WodActorSheet } from "./wod-actor-sheet.js";

// Houses list - defined here to avoid import issues
const HOUSES = ["Devil", "Fiend", "Devourer", "Malefactor", "Scourge", "Slayer", "Defiler"];

export class DemonSheet extends WodActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "demon"],
            template: "systems/wodsystem/templates/actor/demon-sheet.html",
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Set Demon/Earthbound flags for template conditionals
        const actorType = this.actor.type;
        context.isEarthbound = actorType === "Earthbound";
        context.isDemon = actorType === "Demon" || actorType === "Demon-NPC";
        context.isNPC = actorType.includes("-NPC");
        
        // Add houses list for House dropdown
        context.houses = HOUSES;
        
        // Resolve apocalyptic form ID to display name
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

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Add earthbound class to form if actor is Earthbound (for CSS theming)
        if (this.actor.type === "Earthbound") {
            html.find("form").addClass("earthbound");
        }
        
        // Demon-specific handlers for lore paths
        if (this.actor.type === "Demon" || this.actor.type === "Demon-NPC" || this.actor.type === "Earthbound") {
            // Render lore paths
            this._renderLorePaths();
            
            // Lore path reference buttons
            html.find('.lore-reference-btn').click(this._onLoreReferenceClick.bind(this));
            
            // Apocalyptic form reference button
            html.find('.apocalyptic-form-reference-btn').click(this._onApocalypticFormReferenceClick.bind(this));
            
            // Apocalyptic form dropdown change
            html.find('.apocalyptic-form-select').change(this._onApocalypticFormChange.bind(this));
            
            // Initialize apocalyptic tab
            this._initializeApocalypticTab();
            
            // Torment event listeners (Demon-specific)
            html.find('[data-torment] .dot').click(this._onDotClick.bind(this));
        }
    }
    
    /**
     * Handle lore path reference button click (show tooltip)
     */
    _onLoreReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const loreId = $(event.currentTarget).data('lore-id');
        const service = game.wod?.referenceDataService;
        
        if (!service) {
            ui.notifications.warn("Reference data service not available");
            return;
        }
        
        // Get lore path by ID
        const lore = service.getLorePathById?.(loreId);
        
        if (lore) {
            this._showLoreTooltip(event, lore);
        } else {
            ui.notifications.warn(`Lore path "${loreId}" not found`);
        }
    }
    
    /**
     * Handle apocalyptic form reference button click (show tooltip)
     */
    _onApocalypticFormReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const formId = $(event.currentTarget).data('form-id');
        if (!formId) return;
        
        // Ensure formId is a string
        const formIdStr = typeof formId === 'string' ? formId : String(formId);
        
        const service = game.wod?.referenceDataService;
        if (!service) {
            ui.notifications.warn("Reference data service not available");
            return;
        }
        
        // Get apocalyptic form - need to check if service has this method
        const form = service.getApocalypticFormById?.(formIdStr) || service.getApocalypticFormByName?.(formIdStr);
        
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
            refButton.attr('data-form-id', formId).addClass('has-reference');
        } else {
            refButton.removeClass('has-reference').hide();
        }
        
        // Populate powers
        this._populateApocalypticFormPowers();
    }
    
    /**
     * Show lore tooltip with evocations
     */
    _showLoreTooltip(event, lore) {
        this._hideLoreTooltip(); // Remove any existing tooltip
        
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        const tooltipHTML = service.generateLoreTooltipHTML?.(lore);
        if (!tooltipHTML) {
            ui.notifications.warn("Lore tooltip generation not available");
            return;
        }
        
        const tooltip = $(`
            <div class="wod-reference-tooltip wod-lore-tooltip" 
                 style="position: fixed; 
                        z-index: 100000; 
                        background-color: white; 
                        border: 2px solid var(--wod-primary, #DC143C); 
                        border-radius: 8px; 
                        padding: 16px; 
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        max-width: 600px;
                        max-height: 450px;
                        overflow-y: auto;
                        pointer-events: auto;
                        display: block;">
                ${tooltipHTML}
            </div>
        `);
        
        $(document.body).append(tooltip);
        
        // Position tooltip
        const buttonRect = event.currentTarget.getBoundingClientRect();
        const tooltipEl = tooltip[0];
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        let left = buttonRect.right + window.scrollX + 10;
        let top = buttonRect.top + window.scrollY;
        
        if (left + tooltipRect.width > window.innerWidth) {
            left = buttonRect.left + window.scrollX - tooltipRect.width - 10;
        }
        
        if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
            top = window.innerHeight + window.scrollY - tooltipRect.height - 10;
        }
        if (top < window.scrollY) {
            top = window.scrollY + 10;
        }
        
        tooltip.css({ top: `${top}px`, left: `${left}px` });
        
        // Add click handlers for post buttons
        tooltip.find('.post-to-chat-btn').click((e) => {
            e.stopPropagation();
            this._postLoreToChat(lore, 'full');
            this._hideLoreTooltip();
        });
        
        tooltip.find('.post-description-btn').click((e) => {
            e.stopPropagation();
            this._postLoreToChat(lore, 'description');
            this._hideLoreTooltip();
        });
        
        tooltip.find('.post-evocation-btn').click((e) => {
            e.stopPropagation();
            const evocationNumber = parseInt($(e.currentTarget).data('evocation'));
            this._postLoreToChat(lore, 'evocation', evocationNumber);
            this._hideLoreTooltip();
        });
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.on('click', (e) => {
            e.stopPropagation();
        });
        
        // Close tooltip when clicking outside
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideLoreTooltip();
            });
        }, 100);
    }
    
    /**
     * Hide lore tooltip
     */
    _hideLoreTooltip() {
        $('.wod-lore-tooltip').fadeOut(200, function() {
            $(this).remove();
        });
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
                        border: 2px solid var(--wod-primary, #DC143C); 
                        border-radius: 8px; 
                        padding: 16px; 
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        max-width: 600px;
                        max-height: 450px;
                        overflow-y: auto;
                        pointer-events: auto;
                        display: block;">
                ${tooltipHTML}
            </div>
        `);
        
        $(document.body).append(tooltip);
        
        // Position tooltip
        const buttonRect = event.currentTarget.getBoundingClientRect();
        const tooltipEl = tooltip[0];
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        let left = buttonRect.right + window.scrollX + 10;
        let top = buttonRect.top + window.scrollY;
        
        if (left + tooltipRect.width > window.innerWidth) {
            left = buttonRect.left + window.scrollX - tooltipRect.width - 10;
        }
        
        if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
            top = window.innerHeight + window.scrollY - tooltipRect.height - 10;
        }
        if (top < window.scrollY) {
            top = window.scrollY + 10;
        }
        
        tooltip.css({ top: `${top}px`, left: `${left}px` });
        
        // Add click handler for post button
        tooltip.find('.post-form-btn').click((e) => {
            e.stopPropagation();
            this._postApocalypticFormToChat(form);
            this._hideApocalypticFormTooltip();
        });
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.on('click', (e) => {
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
                <h3 style="color: var(--wod-primary, #DC143C); margin: 0 0 12px 0; font-size: 1.2em;">
                    ${form.name || 'Unknown Visage'}
                </h3>
        `;
        
        if (form.house) {
            html += `
                <p style="margin: 0 0 8px 0; font-weight: bold; color: #666;">
                    House: ${form.house}
                </p>
            `;
        }
        
        if (form.description) {
            html += `
                <div style="margin: 12px 0; padding: 8px; background: #f5f5f5; border-radius: 4px; font-style: italic;">
                    ${form.description}
                </div>
            `;
        }
        
        if (form.powers && form.powers.length > 0) {
            const lowTorment = form.powers.filter(p => p.torment === 'low');
            const highTorment = form.powers.filter(p => p.torment === 'high');
            
            if (lowTorment.length > 0) {
                html += `
                    <div style="margin: 12px 0;">
                        <h4 style="color: #28a745; margin: 0 0 8px 0; font-size: 1em;">
                            <i class="fas fa-heart"></i> Low Torment Powers
                        </h4>
                        <ul style="margin: 0; padding-left: 20px;">
                `;
                lowTorment.forEach(power => {
                    html += `<li style="margin: 4px 0;">${power.name}</li>`;
                });
                html += `</ul></div>`;
            }
            
            if (highTorment.length > 0) {
                html += `
                    <div style="margin: 12px 0;">
                        <h4 style="color: #dc3545; margin: 0 0 8px 0; font-size: 1em;">
                            <i class="fas fa-fire"></i> High Torment Powers
                        </h4>
                        <ul style="margin: 0; padding-left: 20px;">
                `;
                highTorment.forEach(power => {
                    html += `<li style="margin: 4px 0;">${power.name}</li>`;
                });
                html += `</ul></div>`;
            }
        }
        
        html += `</div>`;
        return html;
    }
    
    /**
     * Post lore reference to chat
     */
    async _postLoreToChat(lore, type = 'description', evocationNumber = null) {
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        const html = service.generateLoreChatHTML?.(lore, { type, evocationNumber });
        if (!html) {
            ui.notifications.warn("Lore chat HTML generation not available");
            return;
        }
        
        await ChatMessage.create({ 
            speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
            content: html, 
            style: CONST.CHAT_MESSAGE_STYLES.OTHER 
        });
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
        
        await ChatMessage.create({ 
            speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
            content: html, 
            style: CONST.CHAT_MESSAGE_STYLES.OTHER 
        });
    }
    
    /**
     * Render lore paths dynamically
     */
    _renderLorePaths() {
        const container = this.element.find('#lore-paths-container');
        if (!container.length) return;
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;
        
        // Get lore paths
        const lorePaths = service.getLorePaths?.() || service.data?.lorePaths || [];
        if (!lorePaths || lorePaths.length === 0) {
            return;
        }
        
        // Get the selected house from the actor
        const selectedHouse = this.actor.system.identity?.house;
        
        // Filter lore paths: show Common Lore and House-specific lore for selected house only
        const filteredLorePaths = lorePaths.filter(lore => {
            const loreHouse = lore.house || 'Common Lore';
            // Show if it's Common Lore or matches the selected house
            return loreHouse === 'Common Lore' || (selectedHouse && loreHouse === selectedHouse);
        });
        
        // Group by house (Common Lore and the selected house)
        const grouped = {};
        filteredLorePaths.forEach(lore => {
            const category = lore.house || 'Common Lore';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(lore);
        });
        
        // Render grouped lore paths using three-column card grid layout
        let html = '';
        Object.keys(grouped).sort().forEach(category => {
            html += `<div class="lore-category">`;
            html += `<h4>${category}</h4>`;
            html += `<div class="lore-cards-grid">`; // Use three-column grid layout
            
            grouped[category].forEach(lore => {
                const currentRating = this.actor.system.lore?.[lore.id]?.rating || 0;
                html += `
                    <div class="background-item" data-lore-id="${lore.id}">
                        <div class="background-header">
                            <div class="background-info">
                                <select name="system.lore.${lore.id}.name" class="background-name-select trait-label" data-selected-value="${lore.name}" readonly>
                                    <option value="${lore.name}" selected>${lore.name}</option>
                                </select>
                            </div>
                        </div>
                        <div class="background-rating">
                            <div class="dot-container" data-lore="${lore.id}" data-max-rating="5">
                                ${Array.from({length: 5}, (_, i) => 
                                    `<div class="dot ${i < currentRating ? 'filled' : ''}" data-index="${i}"></div>`
                                ).join('')}
                                <input type="hidden" class="dot-input" name="system.lore.${lore.id}.rating" value="${currentRating}"/>
                            </div>
                            <div class="background-actions">
                                <button type="button" class="background-reference-btn lore-reference-btn" data-lore-id="${lore.id}" title="View ${lore.name} details">
                                    <i class="fas fa-book"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        });
        
        container.html(html);
        
        // Re-attach listeners for dynamically created elements
        container.find('.lore-reference-btn').click(this._onLoreReferenceClick.bind(this));
        container.find('[data-lore] .dot').click(this._onLoreDotClick.bind(this));
    }
    
    /**
     * Handle lore dot click
     */
    async _onLoreDotClick(event) {
        event.preventDefault();
        const dot = event.currentTarget;
        const container = dot.closest('.dot-container');
        const loreId = container.dataset.lore;
        const index = parseInt(dot.dataset.index);
        
        const currentRating = this.actor.system.lore?.[loreId]?.rating || 0;
        const newRating = index + 1 === currentRating ? index : index + 1;
        
        const updateData = {};
        if (!this.actor.system.lore) updateData["system.lore"] = {};
        updateData[`system.lore.${loreId}.rating`] = newRating;
        
        await this.actor.update(updateData);
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
        if (!formId) {
            powersContainer.html('');
            return;
        }
        
        // Ensure formId is a string
        const formIdStr = typeof formId === 'string' ? formId : String(formId);
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;
        
        // Get apocalyptic form - try by ID first, then by name
        const form = service.getApocalypticFormById?.(formIdStr) || 
                    service.getApocalypticFormByName?.(formIdStr) ||
                    (service.d20ApocalypticForms || []).find(f => (f.id || f.name) === formIdStr);
        
        if (!form || !form.powers) {
            powersContainer.html('');
            return;
        }
        
        // Render powers
        let html = '<h3>Powers</h3><ul class="form-powers">';
        form.powers.forEach(power => {
            html += `<li><strong>${power.name || power}</strong>${power.description ? `: ${power.description}` : ''}</li>`;
        });
        html += '</ul>';
        
        powersContainer.html(html);
        
        // Update reference button
        const refButton = this.element.find('.apocalyptic-form-reference-btn');
        refButton.attr('data-form-id', formId).addClass('has-reference');
    }
    
    /**
     * Handle house selection change
     */
    _onHouseChange(event) {
        // Re-render lore paths when house changes to filter appropriately
        this._renderLorePaths();
    }
    
    /**
     * Initialize apocalyptic form tab
     */
    async _initializeApocalypticTab() {
        // Load powers for current visage
        this._loadApocalypticPowers();
    }
    
    /**
     * Load apocalyptic powers for character's existing visage
     */
    _loadApocalypticPowers() {
        const container = this.element.find('#apocalyptic-powers-container');
        const visageDisplay = this.element.find('#current-visage-display');
        
        if (!container.length) return;
        
        // Get the character's existing visage from their data
        const visageId = this.actor.system.apocalypticForm;
        
        // Handle empty objects and invalid data during character creation
        if (!visageId || 
            (typeof visageId === 'object' && Object.keys(visageId).length === 0) ||
            visageId === '[object Object]') {
            container.html('<div class="no-visage-selected"><p>This character has no visage selected.</p></div>');
            visageDisplay.text('No Visage Selected');
            return;
        }
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) {
            container.html('<div class="loading-visage"><p>Loading reference data...</p></div>');
            visageDisplay.text('Loading...');
            return;
        }
        
        // Ensure visageId is a string for the service calls
        let visageIdStr;
        
        if (typeof visageId === 'object') {
            // Check if it's an empty object
            if (Object.keys(visageId).length === 0) {
                container.html('<div class="no-visage-selected"><p>This character has no visage selected.</p></div>');
                visageDisplay.text('No Visage Selected');
                return;
            }
            
            // Extract ID or name from object
            visageIdStr = visageId.id || visageId.name || visageId.value || String(visageId);
        } else if (typeof visageId === 'string' && visageId === '[object Object]') {
            // Handle the case where an object was stringified
            visageIdStr = ''; // Set to empty to trigger "no visage selected" flow
        } else {
            visageIdStr = String(visageId);
        }
        
        // Try ID lookup first (new format)
        let form = service.getApocalypticFormById(visageIdStr);
        
        // If ID lookup fails, try name-based lookup (old format - backward compatibility)
        if (!form) {
            form = service.getApocalypticFormByName(visageIdStr);
        }
        
        // Final fallback - try to match by partial ID conversion
        if (!form) {
            const convertedName = visageIdStr.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            form = service.getApocalypticFormByName(convertedName);
        }
        
        if (!form || !form.powers) {
            container.html(`<div class="no-visage-selected"><p>No apocalyptic form found for visage: ${visageIdStr}</p></div>`);
            visageDisplay.text('Unknown Visage');
            return;
        }
        
        // Update visage display
        const capitalizedVisageName = form.name.charAt(0).toUpperCase() + form.name.slice(1);
        visageDisplay.text(capitalizedVisageName);
        
        // Divide powers by torment
        const { lowTorment, highTorment } = this._dividePowersByTorment(form.powers);
        
        // Render powers
        const html = this._renderApocalypticPowers(lowTorment, highTorment, form);
        container.html(html);
        
        // Add event listeners to the newly created power buttons
        this._addPowerCardListeners();
    }
    
    /**
     * Render apocalyptic powers HTML
     */
    _renderApocalypticPowers(lowTorment, highTorment, form) {
        let html = '';
        
        // Visage Description
        if (form && form.description) {
            html += `
                <div class="visage-description">
                    <div class="visage-description-content">
                        ${form.description}
                    </div>
                </div>
            `;
        }
        
        // Low Torment Powers
        if (lowTorment.length > 0) {
            html += `
                <div class="torment-section low-torment">
                    <h4><i class="fas fa-heart"></i> Low Torment Powers</h4>
                    <div class="powers-grid">
            `;
            lowTorment.forEach(power => {
                html += this._renderPowerCard(power, 'low');
            });
            html += '</div></div>';
        }
        
        // High Torment Powers
        if (highTorment.length > 0) {
            html += `
                <div class="torment-section high-torment">
                    <h4><i class="fas fa-fire"></i> High Torment Powers</h4>
                    <div class="powers-grid">
            `;
            highTorment.forEach(power => {
                html += this._renderPowerCard(power, 'high');
            });
            html += '</div></div>';
        }
        
        return html;
    }
    
    /**
     * Divide powers into low and high torment categories using explicit data
     */
    _dividePowersByTorment(powers) {
        const lowTorment = [];
        const highTorment = [];
        
        powers.forEach(power => {
            // Use the explicit isHighTorment field from the data
            if (power.isHighTorment === true) {
                highTorment.push(power);
            } else {
                lowTorment.push(power);
            }
        });
        
        return { lowTorment, highTorment };
    }
    
    /**
     * Render a single power card using slim design like lore paths
     */
    _renderPowerCard(power, tormentLevel) {
        const powerName = power.name || power;
        const description = power.description || '';
        
        // Create one-line preview (max 60 chars)
        const preview = description.length > 60 ? 
            description.substring(0, 60) + '...' : 
            description;
        
        return `
            <div class="power-card ${tormentLevel}-torment" data-power="${powerName}">
                <div class="power-name">${powerName}</div>
                <button type="button" class="power-reference-btn" data-power="${powerName}" title="View details">
                    <i class="fas fa-book"></i>
                </button>
            </div>
        `;
    }
    
    /**
     * Add event listeners for power cards
     */
    _addPowerCardListeners() {
        // Power reference buttons
        this.element.find('.power-reference-btn').click((e) => {
            e.preventDefault();
            e.stopPropagation();
            const powerName = $(e.currentTarget).data('power');
            this._showPowerTooltip(powerName, e);
        });
    }
    
    /**
     * Get the current apocalyptic form data
     */
    _getCurrentApocalypticForm() {
        const formId = this.actor.system.apocalypticForm;
        
        if (!formId || formId === '[object Object]') {
            return null;
        }
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) {
            return null;
        }
        
        let formIdStr;
        if (typeof formId === 'object') {
            formIdStr = formId.id || formId.name || formId.value || String(formId);
        } else {
            formIdStr = String(formId);
        }
        
        let form = service.getApocalypticFormById(formIdStr);
        if (!form) {
            form = service.getApocalypticFormByName(formIdStr);
        }
        
        return form;
    }
    
    /**
     * Show tooltip for power details
     */
    _showPowerTooltip(powerName, event) {
        // Clean up the power name
        const cleanPowerName = powerName.replace(/[@#]+$/g, '').trim();
        
        // Hide any existing tooltips
        $('.wod-power-tooltip').remove();
        
        // Get the actual power data from the current form
        const form = this._getCurrentApocalypticForm();
        let powerDetails = null;
        let description = 'No description available.';
        
        if (form && form.powers) {
            powerDetails = form.powers.find(p => {
                const pName = p.name || p;
                return (pName && pName.toLowerCase() === cleanPowerName.toLowerCase()) ||
                       (typeof p === 'string' && p.toLowerCase() === cleanPowerName.toLowerCase());
            });
            
            if (powerDetails) {
                description = powerDetails.description || 'No description available.';
            }
        }
        
        // Simple tooltip with inline styles to avoid CSS conflicts
        const tooltip = $(`
            <div class="wod-power-tooltip" style="
                position: fixed;
                z-index: 99999;
                background: white;
                border: 2px solid #DC143C;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 400px;
                font-family: 'Signika', sans-serif;
                color: #333;
            ">
                <h4 style="margin: 0 0 12px 0; color: #DC143C; font-size: 1.2em;">${cleanPowerName}</h4>
                <p style="margin: 0 0 12px 0; line-height: 1.4;">${description}</p>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button style="
                        background: #DC143C;
                        border: none;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    " title="Post to chat">
                        <i class="fas fa-comment-dots"></i>
                    </button>
                    <span style="font-size: 12px; color: #666;">Post to chat</span>
                </div>
            </div>
        `);
        
        // Add to DOM
        $(document.body).append(tooltip);
        
        // Position tooltip near the button
        const button = $(event.currentTarget);
        const buttonRect = button[0].getBoundingClientRect();
        
        // Get tooltip dimensions after adding to DOM
        const tooltipEl = tooltip[0];
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        // Initial position (right of button)
        let left = buttonRect.right + window.scrollX + 10;
        let top = buttonRect.top + window.scrollY;
        
        // Ensure tooltip doesn't go off right edge
        if (left + tooltipRect.width > window.innerWidth + window.scrollX) {
            // Try positioning to the left of the button
            left = buttonRect.left + window.scrollX - tooltipRect.width - 10;
            
            // If still off-screen, align with right edge
            if (left < window.scrollX) {
                left = window.innerWidth + window.scrollX - tooltipRect.width - 10;
            }
        }
        
        // Ensure tooltip doesn't go off left edge
        if (left < window.scrollX) {
            left = window.scrollX + 10;
        }
        
        // Ensure tooltip doesn't go off bottom edge
        if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
            // Position above the button
            top = buttonRect.top + window.scrollY - tooltipRect.height - 10;
            
            // If still off-screen, align with bottom edge
            if (top < window.scrollY) {
                top = window.innerHeight + window.scrollY - tooltipRect.height - 10;
            }
        }
        
        // Ensure tooltip doesn't go off top edge
        if (top < window.scrollY) {
            top = window.scrollY + 10;
        }
        
        tooltip.css({ top: `${top}px`, left: `${left}px` });
        
        // Auto-hide after 10 seconds or click outside
        const hideTooltip = () => tooltip.fadeOut(200, function() { $(this).remove(); });
        
        setTimeout(hideTooltip, 10000);
        $(document).one('click', hideTooltip);
        
        // Add click handler for post to chat button
        tooltip.find('button').click((e) => {
            e.stopPropagation();
            this._postPowerToChat(cleanPowerName, description);
            tooltip.fadeOut(200, function() { $(this).remove(); });
        });
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.on('click', (e) => {
            e.stopPropagation();
        });
    }
    
    /**
     * Post power details to chat
     */
    _postPowerToChat(powerName, description) {
        const chatContent = `
            <div class="wod-chat-power" style="
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 2px solid #DC143C;
                border-left: 5px solid #DC143C;
                border-radius: 8px;
                padding: 16px;
                margin: 8px 0;
                box-shadow: 0 2px 8px rgba(220, 20, 60, 0.2);
                font-family: 'Signika', sans-serif;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <i class="fas fa-fire" style="color: #DC143C; font-size: 1.2em; margin-right: 8px;"></i>
                    <h3 style="color: #DC143C; margin: 0; font-size: 1.1em; font-weight: 600;">
                        ${powerName}
                    </h3>
                </div>
                <div style="color: #333; line-height: 1.5; font-size: 0.95em;">
                    ${description}
                </div>
                <div style="
                    margin-top: 12px; 
                    padding-top: 8px; 
                    border-top: 1px solid rgba(220, 20, 60, 0.2);
                    font-size: 0.8em; 
                    color: #666;
                    font-style: italic;
                ">
                    <i class="fas fa-user"></i> ${this.actor.name} - Apocalyptic Form Power
                </div>
            </div>
        `;
        
        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: chatContent,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER
        });
    }

    /**
     * Update torment value (Demon-specific)
     * @param {string} type - "permanent" or "temporary"
     * @param {number} value
     * @private
     */
    async _updateTorment(type, value) {
        // Store current scroll position to prevent auto-scrolling after rerender
        const scrollContainer = this.element.find('.sheet-body')[0];
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;

        const updateData = {};
        let finalValueForVisuals;
        let tempValueForVisuals;
        
        if (type === 'temporary') {
            // Get current values with proper defaults
            const currentPermanent = parseInt(this.actor.system.advantages.torment?.permanent) || 0;
            const currentTemporary = parseInt(this.actor.system.advantages.torment?.temporary) || 0;
            
            // Validate input value
            const newValue = Math.min(Math.max(parseInt(value) || 0, 0), 10);
            
            // Check if temporary torment equals or exceeds permanent torment
            if (newValue >= currentPermanent && currentPermanent > 0) {
                // Calculate new permanent value (capped at 10)
                const newPermanent = Math.min(currentPermanent + 1, 10);
                
                // Prepare update data
                updateData[`system.advantages.torment.permanent`] = newPermanent;
                updateData[`system.advantages.torment.temporary`] = 0;
                
                // Set visual update values
                finalValueForVisuals = 0; // Temporary reset to 0
                tempValueForVisuals = newPermanent; // New permanent value
                
                // Show notification
                ui.notifications.info(`Torment threshold reached! Permanent Torment increased to ${newPermanent}, Temporary Torment reset to 0.`);
                
            } else {
                // Normal temporary torment update (cannot exceed permanent)
                const maxValue = currentPermanent;
                const clampedValue = Math.min(newValue, maxValue);
                
                updateData[`system.advantages.torment.temporary`] = clampedValue;
                finalValueForVisuals = clampedValue;
                
                // Warn if player tried to exceed permanent torment
                if (newValue > maxValue) {
                    ui.notifications.warn("Temporary Torment cannot exceed Permanent Torment.");
                }
            }
            
        } else if (type === 'permanent') {
            // Permanent torment logic
            const newPermanent = Math.min(Math.max(parseInt(value) || 0, 0), 10);
            const currentTemporary = parseInt(this.actor.system.advantages.torment?.temporary) || 0;
            
            updateData[`system.advantages.torment.permanent`] = newPermanent;
            finalValueForVisuals = newPermanent;
            
            // If temporary exceeds new permanent, reduce it to match
            if (currentTemporary > newPermanent) {
                updateData[`system.advantages.torment.temporary`] = newPermanent;
                tempValueForVisuals = newPermanent;
                ui.notifications.warn(`Temporary Torment reduced to match new Permanent value (${newPermanent}).`);
            }
        }
        
        // Apply the updates
        await this.actor.update(updateData);
        
        // Restore scroll position after rerender
        setTimeout(() => {
            const updatedScrollContainer = this.element.find('.sheet-body')[0];
            if (updatedScrollContainer) {
                updatedScrollContainer.scrollTop = scrollTop;
                updatedScrollContainer.scrollLeft = scrollLeft;
            }
        }, 10); // Faster delay to ensure rerender completes
        
        // Update visuals
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
            const label = this.element.find(`.trait-label[data-category="torment"]`)[0];
            if (label) {
                label.setAttribute('data-value', tempValueForVisuals);
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
            
            // Update permanent label
            if (type === 'permanent') {
                const label = this.element.find(`.trait-label[data-category="torment"]`)[0];
                if (label) {
                    label.setAttribute('data-value', finalValueForVisuals);
                }
            }
        }
    }

    /**
     * Handle clicking on a dot (Demon-specific for torment)
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

        // Handle torment specifically
        if (container.dataset.torment) {
            await this._updateTorment(container.dataset.torment, newValue);
        }
        
        // Update the visual appearance after data is saved
        this._updateDotVisuals(container, newValue);
    }
}
