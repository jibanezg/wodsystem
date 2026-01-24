/**
 * Spirit Actor Sheet
 * Extends WodActorSheet but overrides significant methods for Spirit-specific traits
 * Spirits use Willpower/Rage/Gnosis instead of Physical/Social/Mental attributes
 * Spirits use Essence instead of Health
 */

import { WodActorSheet } from "./wod-actor-sheet.js";

export class SpiritSheet extends WodActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "spirit"],
            template: "systems/wodsystem/templates/actor/spirit-sheet.html",
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Add Spirit-specific context data
        // Calculate Essence from Willpower + Rage + Gnosis if not set
        const willpower = this.actor.system.attributes?.willpower?.current || 1;
        const rage = this.actor.system.attributes?.rage?.current || 1;
        const gnosis = this.actor.system.attributes?.gnosis?.current || 1;
        const essenceMax = this.actor.system.advantages?.essence?.maximum || 0;
        
        // If essence maximum is 0 or not set, calculate from formula
        if (essenceMax === 0) {
            const calculatedEssence = willpower + rage + gnosis;
            context.calculatedEssence = calculatedEssence;
        } else {
            context.calculatedEssence = essenceMax;
        }
        
        // Get charms and s-advantages from reference service
        const service = game.wod?.referenceDataService;
        if (service && service.initialized) {
            context.charmsList = service.getCharmsList();
            context.sAdvantagesList = service.getSAdvantagesList();
        } else {
            context.charmsList = [];
            context.sAdvantagesList = [];
        }
        
        // Get selected charms and s-advantages from actor
        context.selectedCharms = this.actor.system.advantages?.charms || [];
        context.selectedSAdvantages = this.actor.system.advantages?.sAdvantages || [];
        
        // Fill in missing descriptions from reference service for s-advantages
        if (service && service.initialized && context.selectedSAdvantages.length > 0) {
            context.selectedSAdvantages = context.selectedSAdvantages.map(sAdv => {
                // If description is missing, try to get it from reference service
                if (!sAdv.description || sAdv.description.trim().length === 0) {
                    const fullSAdvData = service.getSAdvantageByName(sAdv.name);
                    if (fullSAdvData && fullSAdvData.description) {
                        return {
                            ...sAdv,
                            description: fullSAdvData.description
                        };
                    }
                }
                return sAdv;
            });
        }
        
        // Spirit type options (from spirits.md)
        context.spiritTypes = [
            "Essential Divinity (God/Goddess/The Great Spirit/The One)",
            "Godheads/Celestines/God-Avatars",
            "The Adversary",
            "Aeons/Incarnae/Godlings",
            "Lords and Ladies/The High Umbrood",
            "Totem Avatars",
            "Archangels",
            "Demon Lords",
            "Greater Courtiers",
            "Bodhisattva Manifestations",
            "Praeceptors/Demigods",
            "Seraphim",
            "Greater Demons",
            "Oracles",
            "Jagglings",
            "Greater Court Servitors",
            "Minions/Lower Umbrood",
            "Cherubim",
            "Guardian Angels",
            "Demon Hosts",
            "Gafflings/Epiphlings",
            "Lesser Courtiers",
            "Djinni",
            "Loa",
            "Saints",
            "Elementals",
            "Banes (Wyrm spirits)",
            "Chaos Manifestations (Wyld spirits)",
            "Pattern Entities (Weaver spirits)",
            "Naturae/Kami (Nature spirits)",
            "Ghosts (the Restless Dead)",
            "Ancestors (the Honored Dead)",
            "Bygones (mythic creatures)",
            "Paradox Spirits",
            "Legends",
            "Abstracts",
            "Web Spirits",
            "Sendings",
            "Cthonic Entities",
            "Those Beyond"
        ];
        
        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Essence button handlers - use event delegation on the element for persistence
        this.element.off('click', '.essence-increase-btn, .essence-decrease-btn, .essence-capacity-increase, .essence-capacity-decrease');
        this.element.on('click', '.essence-increase-btn, .essence-decrease-btn, .essence-capacity-increase, .essence-capacity-decrease', this._onEssenceButtonClick.bind(this));
        
        // Charms and S-Advantages handlers
        this.element.off('click', '.add-charm-btn, .delete-charm, .add-s-advantage-btn, .delete-s-advantage, .charm-description-btn, .s-advantage-description-btn');
        this.element.on('click', '.add-charm-btn', this._onAddCharm.bind(this));
        this.element.on('click', '.delete-charm', this._onDeleteCharm.bind(this));
        this.element.on('click', '.add-s-advantage-btn', this._onAddSAdvantage.bind(this));
        this.element.on('click', '.delete-s-advantage', this._onDeleteSAdvantage.bind(this));
        
        // Register charm description button
        const charmHandler = (event) => {
            this._onCharmDescriptionClick(event);
        };
        
        this.element.on('click', '.charm-description-btn', charmHandler);
        this.element.on('mousedown', '.charm-description-btn', (e) => {
            e.preventDefault(); // Prevent text selection
        });
        
        // Also try direct binding as fallback
        setTimeout(() => {
            const charmButtons = this.element.find('.charm-description-btn');
            charmButtons.each((index, btn) => {
                const $btn = $(btn);
                
                // Remove any existing handlers first
                $btn.off('click.charm-direct');
                
                // Add direct handler
                $btn.on('click.charm-direct', (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this._onCharmDescriptionClick(event);
                });
            });
        }, 200);
        
        // Register s-advantage description button
        const sAdvantageHandler = (event) => {
            this._onSAdvantageDescriptionClick(event);
        };
        
        this.element.on('click', '.s-advantage-description-btn', sAdvantageHandler);
        this.element.on('mousedown', '.s-advantage-description-btn', (e) => {
            e.preventDefault(); // Prevent text selection
        });
        
        // Also try direct binding as fallback
        setTimeout(() => {
            const sAdvantageButtons = this.element.find('.s-advantage-description-btn');
            sAdvantageButtons.each((index, btn) => {
                const $btn = $(btn);
                
                // Remove any existing handlers first
                $btn.off('click.sadvantage-direct');
                
                // Add direct handler
                $btn.on('click.sadvantage-direct', (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this._onSAdvantageDescriptionClick(event);
                });
            });
        }, 200);
        
        // Power summary description buttons (for merged list in main tab)
        this.element.on('click', '.power-description-btn', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const type = event.currentTarget.getAttribute('data-type');
            if (type === 'charm') {
                this._onCharmDescriptionClick(event);
            } else if (type === 'sadvantage') {
                this._onSAdvantageDescriptionClick(event);
            }
        });
        
        // Also prevent text selection on mousedown
        this.element.on('mousedown', '.power-description-btn', (e) => {
            e.preventDefault();
        });
        
        // Direct binding as fallback for power description buttons
        setTimeout(() => {
            const powerButtons = this.element.find('.power-description-btn');
            powerButtons.each((index, btn) => {
                const $btn = $(btn);
                
                // Remove any existing handlers first
                $btn.off('click.power-direct');
                
                // Add direct handler
                $btn.on('click.power-direct', (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    const type = event.currentTarget.getAttribute('data-type');
                    if (type === 'charm') {
                        this._onCharmDescriptionClick(event);
                    } else if (type === 'sadvantage') {
                        this._onSAdvantageDescriptionClick(event);
                    }
                });
            });
        }, 200);
        
        // Fix select dropdown text cutoff by dynamically adjusting width
        this._fixSelectTextCutoff();
    }
    
    /**
     * Fix select dropdown text cutoff by dynamically adjusting select width based on selected option text
     */
    _fixSelectTextCutoff() {
        const fixSelect = (select) => {
            if (!select) return;
            
            // Create a temporary span to measure text width
            const measure = document.createElement('span');
            measure.style.visibility = 'hidden';
            measure.style.position = 'absolute';
            measure.style.whiteSpace = 'nowrap';
            measure.style.fontSize = window.getComputedStyle(select).fontSize;
            measure.style.fontFamily = window.getComputedStyle(select).fontFamily;
            measure.style.fontWeight = window.getComputedStyle(select).fontWeight;
            measure.style.padding = '0';
            document.body.appendChild(measure);
            
            const updateWidth = () => {
                const selectedOption = select.options[select.selectedIndex];
                if (selectedOption && selectedOption.text) {
                    measure.textContent = selectedOption.text;
                    const textWidth = measure.offsetWidth;
                    // Add padding for dropdown arrow (30px) and some extra space (20px)
                    const minWidth = Math.max(150, textWidth + 50);
                    select.style.minWidth = minWidth + 'px';
                    select.style.width = 'auto';
                }
            };
            
            // Update on change
            select.addEventListener('change', updateWidth);
            
            // Initial update
            setTimeout(updateWidth, 100);
        };
        
        // Fix charm select
        const charmSelect = this.element.find('.select-charm-to-add')[0];
        if (charmSelect) {
            fixSelect(charmSelect);
        }
        
        // Fix s-advantage select
        const sAdvantageSelect = this.element.find('.select-s-advantage-to-add')[0];
        if (sAdvantageSelect) {
            fixSelect(sAdvantageSelect);
        }
    }

    /**
     * Handle Essence button clicks (increase/decrease current or maximum)
     */
    async _onEssenceButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.currentTarget;
        
        // Don't process if button is disabled
        if (button.disabled) {
            return;
        }
        
        const action = button.dataset.action;
        
        if (!action) {
            return;
        }
        
        // Store scroll position
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const currentEssence = Number(this.actor.system.advantages?.essence?.current) || 0;
        const maximumEssence = Number(this.actor.system.advantages?.essence?.maximum) || 0;
        
        let updates = {};
        
        if (action === 'increase-current') {
            const newCurrent = Math.min(currentEssence + 1, maximumEssence);
            if (newCurrent !== currentEssence) {
                updates['system.advantages.essence.current'] = newCurrent;
            }
        } else if (action === 'decrease-current') {
            const newCurrent = Math.max(currentEssence - 1, 0);
            if (newCurrent !== currentEssence) {
                updates['system.advantages.essence.current'] = newCurrent;
            }
        } else if (action === 'increase-maximum') {
            const newMaximum = maximumEssence + 1;
            updates['system.advantages.essence.maximum'] = newMaximum;
            // If current is at max, increase it too
            if (currentEssence >= maximumEssence) {
                updates['system.advantages.essence.current'] = newMaximum;
            }
        } else if (action === 'decrease-maximum') {
            if (maximumEssence > 0) {
                const newMaximum = maximumEssence - 1;
                updates['system.advantages.essence.maximum'] = newMaximum;
                // Ensure current doesn't exceed new maximum
                if (currentEssence > newMaximum) {
                    updates['system.advantages.essence.current'] = newMaximum;
                }
            }
        }
        
        if (Object.keys(updates).length > 0) {
            await this.actor.update(updates);
            
            // Restore scroll position after update
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) {
                    newSheetBody.scrollTop(scrollPos);
                }
            }, 50);
        }
    }
    
    /**
     * Handle adding a charm
     */
    async _onAddCharm(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const select = this.element.find('.select-charm-to-add')[0];
        const charmName = select?.value;
        
        if (!charmName) {
            ui.notifications.warn(game.i18n.localize('WODSYSTEM.CharacterSheet.Charms.NoCharmSelected'));
            return;
        }
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) {
            ui.notifications.error(game.i18n.localize('WODSYSTEM.CharacterSheet.Charms.ServiceNotAvailable'));
            return;
        }
        
        const charmData = service.getCharmByName(charmName);
        if (!charmData) {
            ui.notifications.error(game.i18n.format('WODSYSTEM.CharacterSheet.Charms.CharmNotFound', {name: charmName}));
            return;
        }
        
        // Check if charm already exists
        const currentCharms = this.actor.system.advantages?.charms || [];
        if (currentCharms.some(c => c.name === charmName || c.id === charmData.id)) {
            ui.notifications.warn(game.i18n.format('WODSYSTEM.CharacterSheet.Charms.CharmAlreadyAdded', {name: charmName}));
            return;
        }
        
        // Create charm entry
        // Default essenceCost to 'None' if not provided
        const essenceCost = charmData.essenceCost || { type: 'none' };
        
        const newCharm = {
            id: foundry.utils.randomID(),
            name: charmData.name || charmName,
            description: charmData.description || '',
            essenceCost: essenceCost,
            rollInfo: charmData.rollInfo || null,
            difficulty: charmData.difficulty || null
        };
        
        // Add to actor
        const updatedCharms = [...currentCharms, newCharm];
        await this.actor.update({'system.advantages.charms': updatedCharms});
        
        // Reset select
        if (select) select.value = '';
    }
    
    /**
     * Handle deleting a charm
     */
    async _onDeleteCharm(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const charmId = event.currentTarget.dataset.charmId;
        if (!charmId) return;
        
        const currentCharms = this.actor.system.advantages?.charms || [];
        const updatedCharms = currentCharms.filter(c => c.id !== charmId);
        
        await this.actor.update({'system.advantages.charms': updatedCharms});
    }
    
    /**
     * Handle adding an s-advantage
     */
    async _onAddSAdvantage(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const select = this.element.find('.select-s-advantage-to-add')[0];
        const sAdvantageName = select?.value;
        
        if (!sAdvantageName) {
            ui.notifications.warn(game.i18n.localize('WODSYSTEM.CharacterSheet.SAdvantages.NoSAdvantageSelected'));
            return;
        }
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) {
            ui.notifications.error(game.i18n.localize('WODSYSTEM.CharacterSheet.SAdvantages.ServiceNotAvailable'));
            return;
        }
        
        const sAdvantageData = service.getSAdvantageByName(sAdvantageName);
        if (!sAdvantageData) {
            ui.notifications.error(game.i18n.format('WODSYSTEM.CharacterSheet.SAdvantages.SAdvantageNotFound', {name: sAdvantageName}));
            return;
        }
        
        // Check if s-advantage already exists
        const currentSAdvantages = this.actor.system.advantages?.sAdvantages || [];
        if (currentSAdvantages.some(s => s.name === sAdvantageName || s.id === sAdvantageData.id)) {
            ui.notifications.warn(game.i18n.format('WODSYSTEM.CharacterSheet.SAdvantages.SAdvantageAlreadyAdded', {name: sAdvantageName}));
            return;
        }
        
        // Create s-advantage entry
        const newSAdvantage = {
            id: foundry.utils.randomID(),
            name: sAdvantageData.name || sAdvantageName,
            description: sAdvantageData.description || '',
            cost: sAdvantageData.cost || null
        };
        
        // Add to actor
        const updatedSAdvantages = [...currentSAdvantages, newSAdvantage];
        await this.actor.update({'system.advantages.sAdvantages': updatedSAdvantages});
        
        // Reset select
        if (select) select.value = '';
    }
    
    /**
     * Handle deleting an s-advantage
     */
    async _onDeleteSAdvantage(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const sAdvantageId = event.currentTarget.dataset.sAdvantageId;
        if (!sAdvantageId) return;
        
        const currentSAdvantages = this.actor.system.advantages?.sAdvantages || [];
        const updatedSAdvantages = currentSAdvantages.filter(s => s.id !== sAdvantageId);
        
        await this.actor.update({'system.advantages.sAdvantages': updatedSAdvantages});
        
        ui.notifications.info(game.i18n.localize('WODSYSTEM.CharacterSheet.SAdvantages.SAdvantageRemoved'));
    }
    
    /**
     * Handle charm description button click (show tooltip)
     */
    _onCharmDescriptionClick(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        const charmId = event.currentTarget.dataset.charmId;
        if (!charmId) return;
        
        const currentCharms = this.actor.system.advantages?.charms || [];
        const charm = currentCharms.find(c => c.id === charmId);
        
        if (!charm) return;
        
        // Try to get full charm data from reference service if description is missing
        if (!charm.description || charm.description.trim().length === 0) {
            const service = game.wod?.referenceDataService;
            if (service && service.initialized) {
                const fullCharmData = service.getCharmByName(charm.name);
                if (fullCharmData && fullCharmData.description) {
                    charm.description = fullCharmData.description;
                    // Also update other fields if missing
                    if (!charm.rollInfo && fullCharmData.rollInfo) {
                        charm.rollInfo = fullCharmData.rollInfo;
                    }
                    if (!charm.difficulty && fullCharmData.difficulty) {
                        charm.difficulty = fullCharmData.difficulty;
                    }
                    if (!charm.essenceCost && fullCharmData.essenceCost) {
                        charm.essenceCost = fullCharmData.essenceCost;
                    }
                }
            }
        }
        
        if (!charm.description || charm.description.trim().length === 0) {
            ui.notifications.warn(game.i18n.format('WODSYSTEM.CharacterSheet.Charms.NoDescription', {name: charm.name || 'Unknown'}));
            return;
        }
        
        // Toggle tooltip
        const existingTooltip = $('.wod-charm-tooltip');
        if (existingTooltip.length && existingTooltip.data('charm-id') === charmId) {
            this._hideCharmTooltip();
        } else {
            this._showCharmTooltip(event, charm);
        }
    }
    
    /**
     * Handle s-advantage description button click (show tooltip)
     */
    _onSAdvantageDescriptionClick(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        const sAdvantageId = event.currentTarget.dataset.sAdvantageId;
        if (!sAdvantageId) return;
        
        const currentSAdvantages = this.actor.system.advantages?.sAdvantages || [];
        const sAdvantage = currentSAdvantages.find(s => s.id === sAdvantageId);
        
        if (!sAdvantage) return;
        
        // Try to get full s-advantage data from reference service if description is missing
        if (!sAdvantage.description || sAdvantage.description.trim().length === 0) {
            const service = game.wod?.referenceDataService;
            if (service && service.initialized) {
                const fullSAdvantageData = service.getSAdvantageByName(sAdvantage.name);
                if (fullSAdvantageData && fullSAdvantageData.description) {
                    sAdvantage.description = fullSAdvantageData.description;
                    // Also update cost if missing
                    if (!sAdvantage.cost && fullSAdvantageData.cost) {
                        sAdvantage.cost = fullSAdvantageData.cost;
                    }
                }
            }
        }
        
        if (!sAdvantage.description || sAdvantage.description.trim().length === 0) {
            ui.notifications.warn(game.i18n.format('WODSYSTEM.CharacterSheet.SAdvantages.NoDescription', {name: sAdvantage.name || 'Unknown'}));
            return;
        }
        
        // Toggle tooltip
        const existingTooltip = $('.wod-s-advantage-tooltip');
        if (existingTooltip.length && existingTooltip.data('s-advantage-id') === sAdvantageId) {
            this._hideSAdvantageTooltip();
        } else {
            this._showSAdvantageTooltip(event, sAdvantage);
        }
    }
    
    /**
     * Show charm tooltip
     */
    _showCharmTooltip(event, charm) {
        this._hideCharmTooltip(); // Remove any existing tooltip
        
        const tooltipHTML = this._generateCharmTooltipHTML(charm);
        if (!tooltipHTML || tooltipHTML.trim().length === 0) {
            return;
        }
        
        const tooltip = $(`
            <div class="wod-reference-tooltip wod-charm-tooltip" 
                 data-charm-id="${charm.id}"
                 style="position: fixed; 
                        z-index: 100000; 
                        background-color: white; 
                        border: 2px solid var(--wod-primary, #4A90E2); 
                        border-radius: 8px; 
                        padding: 16px; 
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        max-width: 500px;
                        max-height: 400px;
                        overflow-y: auto;
                        pointer-events: auto;
                        user-select: text;
                        -webkit-user-select: text;
                        -moz-user-select: text;
                        -ms-user-select: text;
                        display: block;">
                ${tooltipHTML}
            </div>
        `);
        
        $(document.body).append(tooltip);
        
        // Position tooltip
        const buttonRect = event.currentTarget.getBoundingClientRect();
        const tooltipEl = tooltip[0];
        const tooltipRect = tooltipEl.getBoundingClientRect();
        
        // Try to position to the right of the button first
        let left = buttonRect.right + window.scrollX + 10;
        let top = buttonRect.top + window.scrollY;
        
        // If tooltip would go off the right edge, position to the left instead
        if (left + tooltipRect.width > window.innerWidth) {
            left = buttonRect.left + window.scrollX - tooltipRect.width - 10;
        }
        
        // Adjust vertical position if tooltip goes off-screen
        if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
            top = window.innerHeight + window.scrollY - tooltipRect.height - 10;
        }
        if (top < window.scrollY) {
            top = window.scrollY + 10;
        }
        
        tooltip.css({ top: `${top}px`, left: `${left}px` });
        
        // Handle post to chat button - MUST be set up BEFORE the general click handler
        const self = this;
        const postButton = tooltip.find('.post-charm-btn');
        if (postButton.length > 0) {
            postButton.off('click.post-charm').on('click.post-charm', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const charmId = $(e.currentTarget).data('charm-id');
                const currentCharms = self.actor.system.advantages?.charms || [];
                const charm = currentCharms.find(c => c.id === charmId);
                if (charm) {
                    self._postCharmToChat(charm);
                    self._hideCharmTooltip();
                }
                return false;
            });
        }
        
        // Prevent tooltip from closing when clicking inside it (but allow button clicks)
        tooltip.on('click', (e) => {
            // Don't stop propagation for button clicks
            if ($(e.target).closest('.post-charm-btn').length === 0) {
                e.stopPropagation();
            }
        });
        
        // Close tooltip when clicking outside
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideCharmTooltip();
            });
        }, 0);
    }
    
    /**
     * Show s-advantage tooltip
     */
    _showSAdvantageTooltip(event, sAdvantage) {
        this._hideSAdvantageTooltip(); // Remove any existing tooltip
        
        const tooltipHTML = this._generateSAdvantageTooltipHTML(sAdvantage);
        
        const tooltip = $(`
            <div class="wod-reference-tooltip wod-s-advantage-tooltip" 
                 data-s-advantage-id="${sAdvantage.id}"
                 style="position: fixed; 
                        z-index: 100000; 
                        background-color: white; 
                        border: 2px solid var(--wod-primary, #4A90E2); 
                        border-radius: 8px; 
                        padding: 16px; 
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                        max-width: 500px;
                        max-height: 400px;
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
        
        // Try to position to the right of the button first
        let left = buttonRect.right + window.scrollX + 10;
        let top = buttonRect.top + window.scrollY;
        
        // If tooltip would go off the right edge, position to the left instead
        if (left + tooltipRect.width > window.innerWidth) {
            left = buttonRect.left + window.scrollX - tooltipRect.width - 10;
        }
        
        // Adjust vertical position if tooltip goes off-screen
        if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
            top = window.innerHeight + window.scrollY - tooltipRect.height - 10;
        }
        if (top < window.scrollY) {
            top = window.scrollY + 10;
        }
        
        tooltip.css({ top: `${top}px`, left: `${left}px` });
        
        // Handle post to chat button - MUST be set up BEFORE the general click handler
        const self = this;
        const postButton = tooltip.find('.post-sadvantage-btn');
        
        if (postButton.length > 0) {
            postButton.off('click.post-sadvantage').on('click.post-sadvantage', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const sAdvantageId = $(e.currentTarget).data('s-advantage-id');
                const currentSAdvantages = self.actor.system.advantages?.sAdvantages || [];
                const sAdvantage = currentSAdvantages.find(s => s.id === sAdvantageId);
                if (sAdvantage) {
                    self._postSAdvantageToChat(sAdvantage);
                    self._hideSAdvantageTooltip();
                }
                return false;
            });
        }
        
        // Close tooltip when clicking outside
        setTimeout(() => {
            $(document).on('click.sadvantage-tooltip', (e) => {
                if ($(e.target).closest('.wod-s-advantage-tooltip').length === 0) {
                    self._hideSAdvantageTooltip();
                    $(document).off('click.sadvantage-tooltip');
                }
                // Don't close if clicking the post button
                if ($(e.target).closest('.post-sadvantage-btn').length === 0) {
                    e.stopPropagation();
                }
            });
        }, 100);
        
        // Close tooltip when clicking outside
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideCharmTooltip();
            });
        }, 0);
    }
    
    /**
     * Post charm to chat
     */
    async _postCharmToChat(charm) {
        try {
            const html = this._generateCharmChatHTML(charm);
            await ChatMessage.create({ 
                speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
                content: html, 
                style: CONST.CHAT_MESSAGE_STYLES.OTHER 
            });
        } catch (error) {
            ui.notifications.error("Failed to post charm to chat: " + error.message);
        }
    }
    
    /**
     * Generate HTML for charm chat message
     */
    _generateCharmChatHTML(charm) {
        let html = `<div class="wod-reference-card charm-reference-card" style="background: white; border: 2px solid var(--wod-primary, #4A90E2); border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div class="charm-header" style="border-bottom: 2px solid var(--wod-primary, #4A90E2); padding-bottom: 12px; margin-bottom: 12px;">
                <h3 style="margin: 0; color: var(--wod-primary, #4A90E2); font-size: 1.3em;">${this._escapeHtml(charm.name)}</h3>
            </div>`;
        
        if (charm.rollInfo) {
            let rollText = this._escapeHtml(charm.rollInfo.trait);
            if (charm.difficulty) {
                if (charm.difficulty.type === 'fixed') {
                    rollText += ` (Difficulty: ${charm.difficulty.value})`;
                } else if (charm.difficulty.type === 'variable') {
                    rollText += ` (Difficulty: ${this._escapeHtml(charm.difficulty.description || 'Variable')})`;
                } else if (charm.difficulty.value) {
                    rollText += ` (Difficulty: ${charm.difficulty.value})`;
                }
            }
            html += `<p style="margin: 0 0 12px 0;"><strong>Roll:</strong> ${rollText}</p>`;
        }
        
        // Always show essence cost, default to 'None' if null
        const essenceCost = charm.essenceCost || { type: 'none' };
        let costText = '';
        if (essenceCost.type === 'none') {
            costText = 'None';
        } else if (essenceCost.value) {
            costText = essenceCost.value.toString();
        }
        if (costText) {
            html += `<p style="margin: 0 0 12px 0;"><strong>Essence Cost:</strong> ${costText}</p>`;
        }
        
        if (charm.description) {
            // Replace newlines with <br> tags
            const description = this._escapeHtml(charm.description).replace(/\n/g, '<br>');
            html += `<div style="margin-top: 12px; line-height: 1.6; color: #333;">${description}</div>`;
        }
        
        html += `</div>`;
        return html;
    }
    
    /**
     * Simple HTML escape function
     */
    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Generate HTML for charm tooltip
     */
    _generateCharmTooltipHTML(charm) {
        let html = `<div class="reference-tooltip-inner wod-charm-tooltip-inner">
            <h3 style="margin: 0 0 12px 0; color: var(--wod-primary, #4A90E2); font-weight: bold;">${this._escapeHtml(charm.name)}</h3>`;
        
        if (charm.rollInfo) {
            let rollText = this._escapeHtml(charm.rollInfo.trait);
            if (charm.difficulty) {
                if (charm.difficulty.type === 'fixed') {
                    rollText += ` (Difficulty: ${charm.difficulty.value})`;
                } else if (charm.difficulty.type === 'variable') {
                    rollText += ` (Difficulty: ${this._escapeHtml(charm.difficulty.description || 'Variable')})`;
                } else if (charm.difficulty.value) {
                    rollText += ` (Difficulty: ${charm.difficulty.value})`;
                }
            }
            html += `<p style="margin: 0 0 12px 0; color: #1a1a1a;"><strong style="color: #333;">Roll:</strong> <span style="color: #1a1a1a;">${rollText}</span></p>`;
        }
        
        // Always show essence cost, default to 'None' if null
        const essenceCost = charm.essenceCost || { type: 'none' };
        let costText = '';
        if (essenceCost.type === 'none') {
            costText = 'None';
        } else if (essenceCost.value) {
            costText = essenceCost.value.toString();
        }
        if (costText) {
            html += `<p style="margin: 0 0 12px 0; color: #1a1a1a;"><strong style="color: #333;">Essence Cost:</strong> <span style="color: #1a1a1a;">${costText}</span></p>`;
        }
        
        if (charm.description) {
            // Replace newlines with <br> tags
            const description = this._escapeHtml(charm.description).replace(/\n/g, '<br>');
            html += `<div style="margin-top: 12px; line-height: 1.6; color: #1a1a1a;">${description}</div>`;
        }
        
        // Add post to chat button
        html += `
            <div class="tooltip-footer" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #ddd;">
                <button class="post-charm-btn" type="button" 
                        data-charm-id="${charm.id}"
                        data-action="post-charm" 
                        title="Post charm details to chat"
                        style="background: var(--wod-primary, #4A90E2); border: none; border-radius: 4px; padding: 6px 12px; color: white; cursor: pointer; font-size: 0.9em; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <i class="fas fa-comment-dots"></i> Post to Chat
                </button>
            </div>
        </div>`;
        
        return html;
    }
    
    /**
     * Generate HTML for s-advantage tooltip
     */
    _generateSAdvantageTooltipHTML(sAdvantage) {
        let html = `<h3 style="margin: 0 0 12px 0; color: var(--wod-primary, #4A90E2);">${this._escapeHtml(sAdvantage.name)}</h3>`;
        
        if (sAdvantage.cost) {
            let costText = '';
            if (sAdvantage.cost.values) {
                costText = `${sAdvantage.cost.values.join(', ')} ${sAdvantage.cost.unit || ''}`;
            } else if (sAdvantage.cost.cost) {
                costText = `${sAdvantage.cost.cost}${sAdvantage.cost.per ? ' per ' + sAdvantage.cost.per : ''}${sAdvantage.cost.unit ? ' ' + sAdvantage.cost.unit : ''}`;
            } else if (sAdvantage.cost.description) {
                costText = sAdvantage.cost.description;
            } else if (sAdvantage.cost.value) {
                costText = `${sAdvantage.cost.value}${sAdvantage.cost.unit ? ' ' + sAdvantage.cost.unit : ''}`;
            } else {
                costText = sAdvantage.cost.toString();
            }
            if (costText) {
                html += `<p style="margin: 0 0 12px 0; color: #1a1a1a;"><strong style="color: #333;">Cost:</strong> <span style="color: #1a1a1a;">${this._escapeHtml(costText)}</span></p>`;
            }
        }
        
        if (sAdvantage.description) {
            // Replace newlines with <br> tags
            const description = this._escapeHtml(sAdvantage.description).replace(/\n/g, '<br>');
            html += `<div style="margin-top: 12px; line-height: 1.6; color: #1a1a1a;">${description}</div>`;
        }
        
        // Add post to chat button
        html += `
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #ddd; display: flex; justify-content: flex-end;">
                <button class="post-sadvantage-btn" type="button" 
                        data-s-advantage-id="${sAdvantage.id}"
                        data-action="post-sadvantage" 
                        title="Post s-advantage details to chat"
                        style="background: var(--wod-primary, #4A90E2); color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 0.9em; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fas fa-comment-dots"></i> Post to Chat
                </button>
            </div>
        </div>`;
        
        return html;
    }
    
    /**
     * Hide charm tooltip
     */
    _hideCharmTooltip() {
        $('.wod-charm-tooltip').fadeOut(200, function() {
            $(this).remove();
        });
    }
    
    /**
     * Hide s-advantage tooltip
     */
    _hideSAdvantageTooltip() {
        $('.wod-s-advantage-tooltip').fadeOut(200, function() {
            $(this).remove();
        });
        $(document).off('click.sadvantage-tooltip');
    }
    
    /**
     * Post s-advantage to chat
     */
    async _postSAdvantageToChat(sAdvantage) {
        try {
            const html = this._generateSAdvantageChatHTML(sAdvantage);
            await ChatMessage.create({ 
                speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
                content: html, 
                style: CONST.CHAT_MESSAGE_STYLES.OTHER 
            });
        } catch (error) {
            ui.notifications.error("Failed to post s-advantage to chat: " + error.message);
        }
    }
    
    /**
     * Generate HTML for s-advantage chat message
     */
    _generateSAdvantageChatHTML(sAdvantage) {
        let html = `<div class="wod-reference-card sadvantage-reference-card" style="background: white; border: 2px solid var(--wod-primary, #4A90E2); border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div class="sadvantage-header" style="border-bottom: 2px solid var(--wod-primary, #4A90E2); padding-bottom: 12px; margin-bottom: 12px;">
                <h3 style="margin: 0; color: var(--wod-primary, #4A90E2); font-size: 1.3em;">${this._escapeHtml(sAdvantage.name)}</h3>
            </div>`;
        
        if (sAdvantage.cost) {
            let costText = '';
            if (sAdvantage.cost.values) {
                costText = `${sAdvantage.cost.values.join(', ')} ${sAdvantage.cost.unit || ''}`;
            } else if (sAdvantage.cost.cost) {
                costText = `${sAdvantage.cost.cost}${sAdvantage.cost.per ? ' per ' + sAdvantage.cost.per : ''}${sAdvantage.cost.unit ? ' ' + sAdvantage.cost.unit : ''}`;
            } else if (sAdvantage.cost.description) {
                costText = sAdvantage.cost.description;
            } else if (sAdvantage.cost.value) {
                costText = `${sAdvantage.cost.value}${sAdvantage.cost.unit ? ' ' + sAdvantage.cost.unit : ''}`;
            } else {
                costText = sAdvantage.cost.toString();
            }
            if (costText) {
                html += `<p style="margin: 0 0 12px 0;"><strong>Cost:</strong> ${this._escapeHtml(costText)}</p>`;
            }
        }
        
        if (sAdvantage.description) {
            // Replace newlines with <br> tags
            const description = this._escapeHtml(sAdvantage.description).replace(/\n/g, '<br>');
            html += `<div style="margin-top: 12px; line-height: 1.6; color: #333;">${description}</div>`;
        }
        
        html += `</div>`;
        return html;
    }
}
