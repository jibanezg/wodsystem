import { WodRollDialog } from "../../apps/wod-roll-dialog.js";
import { WodEffectManager } from "../../apps/wod-effect-manager.js";

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
    async close(options) {
        // Clean up trigger button when sheet is closed (with fade out)
        const trigger = document.querySelector(`.quick-rolls-trigger[data-app-id="${this.appId}"]`);
        if (trigger) {
            trigger.style.opacity = '0';
            setTimeout(() => trigger.remove(), 300);
        }
        
        // Clean up position update interval
        if (this._positionUpdateInterval) {
            clearInterval(this._positionUpdateInterval);
            this._positionUpdateInterval = null;
        }
        
        // Clean up wizard check interval
        if (this._wizardCheckInterval) {
            clearInterval(this._wizardCheckInterval);
            this._wizardCheckInterval = null;
        }
        
        // Clean up panel if open
        this._destroyQuickRollsPanel();
        
        return super.close(options);
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // In Foundry v10+, we need to expose system at the top level for templates
        // The data is in context.data.system, but templates expect context.system
        context.system = context.data.system;
        
        // SAFEGUARD: Ensure biography.image is always a string (prevents [object Object] error)
        if (context.actor?.system?.biography?.image && typeof context.actor.system.biography.image !== 'string') {
            console.warn(`Biography image was not a string (was ${typeof context.actor.system.biography.image}), clearing it`);
            context.actor.system.biography.image = "";
        }
        
        // Load reference data (archetypes, backgrounds, etc.) via service
        const service = game.wod?.referenceDataService;
        if (service && service.initialized) {
            context.archetypes = await window.referenceDataService?.getArchetypes?.() || [];
            // Load base + creature-specific backgrounds from new service
            context.backgroundsList = service.getBackgroundsList(this.actor.type);
        } else if (window.referenceDataService) {
            // Fallback to old service
            context.archetypes = await window.referenceDataService.getArchetypes();
            context.backgroundsList = await window.referenceDataService.getBackgrounds(this.actor.type);
        } else {
            console.error("ReferenceDataService not available");
            context.archetypes = [];
            context.backgroundsList = [];
        }
        
        // Add creature type for conditional rendering in templates
        context.creatureType = this.actor.type;
        
        // Add character creation status
        context.isCreated = this.actor.system.isCreated ?? false;
        context.hasWizardSupport = ['Mortal', 'Technocrat'].includes(this.actor.type);
        
        // Add health edit mode flag
        context.isHealthEditMode = this.actor.getFlag('wodsystem', 'healthEditMode') || false;
        
        // Backgrounds pagination
        const backgroundsPerPage = 9;
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
            backgrounds: allBackgrounds.slice(startIdx, endIdx).map((bg, idx) => {
                // Get max rating from reference data if available
                const refService = game.wod?.referenceDataService;
                let maxRating = 5; // Default to 5
                
                if (refService && refService.initialized && bg.name) {
                    const bgData = refService.getBackgroundByName(bg.name);
                    if (bgData && typeof bgData.maxRating === 'number') {
                        maxRating = bgData.maxRating;
                    }
                }
                
                // Always ensure maxRating is a valid number
                if (typeof maxRating !== 'number' || maxRating < 5) {
                    maxRating = 5;
                }
                
                return {
                    ...bg,
                    actualIndex: startIdx + idx, // Store the actual index in the full array
                    maxRating: maxRating // Add maxRating for template
                };
            })
        };
        
        // Calculate Avatar rating (for permanent Quintessence)
        const avatarBg = allBackgrounds.find(bg => bg.name === 'Avatar' || bg.name === 'Avatar/ Genius' || bg.name === 'Genius');
        context.avatarRating = avatarBg ? (avatarBg.value || 0) : 0;
        
        // Calculate Enhancement Paradox (permanent Paradox from Enhancement background)
        const enhancementBg = allBackgrounds.find(bg => bg.name === 'Enhancement');
        context.enhancementParadox = enhancementBg ? (enhancementBg.value || 0) : 0;
        
        // Procedures pagination (4 per page)
        if (this.actor.system.procedures) {
            const procPagination = this._getPaginationData(
                Array.isArray(this.actor.system.procedures) ? this.actor.system.procedures : [],
                'proceduresPage',
                4
            );
            context.proceduresPagination = {
                ...procPagination,
                procedures: procPagination.items
            };
        }
        
        // Devices pagination (2 per page)
        if (this.actor.system.devices) {
            const devPagination = this._getPaginationData(
                Array.isArray(this.actor.system.devices) ? this.actor.system.devices : [],
                'devicesPage',
                2
            );
            context.devicesPagination = {
                ...devPagination,
                devices: devPagination.items
            };
        }
        
        // Enhancements pagination (2 per page)
        if (this.actor.system.enhancements) {
            const enhPagination = this._getPaginationData(
                Array.isArray(this.actor.system.enhancements) ? this.actor.system.enhancements : [],
                'enhancementsPage',
                2
            );
            context.enhancementsPagination = {
                ...enhPagination,
                enhancements: enhPagination.items
            };
        }
        
        // Backgrounds Expanded - Categorized list view with pagination (3 categories per page)
        // Only process if backgroundsExpanded exists
        if (this.actor.system.backgroundsExpanded !== undefined) {
            const allCategorizedBackgrounds = this._categorizeExpandedBackgrounds(
                this.actor.system.backgroundsExpanded || []
            );
            
            const categoriesPerPage = 3;
            const currentCategoryPage = this.actor.getFlag("wodsystem", "bgExpandedCategoriesPage") || 0;
            const totalCategoryPages = Math.max(1, Math.ceil(allCategorizedBackgrounds.length / categoriesPerPage));
            const validCategoryPage = Math.min(currentCategoryPage, totalCategoryPages - 1);
            
            const startIdx = validCategoryPage * categoriesPerPage;
            const endIdx = startIdx + categoriesPerPage;
            const paginatedCategories = allCategorizedBackgrounds.slice(startIdx, endIdx);
            
            context.bgExpandedCategories = paginatedCategories;
            context.bgExpandedCategoriesPagination = {
                currentPage: validCategoryPage,
                totalPages: totalCategoryPages,
                hasMultiplePages: totalCategoryPages > 1,
                hasPrevPage: validCategoryPage > 0,
                hasNextPage: validCategoryPage < totalCategoryPages - 1
            };
            
            // Backgrounds Expanded modal state
            context.bgExpandedViewMode = this.actor.getFlag("wodsystem", "bgExpandedViewMode") || "list";
        }
        
        // Active Effects for the status effects section
        context.effects = Array.from(this.actor.effects || []).map(effect => {
            // Ensure icon path is valid, fallback to default if empty or invalid
            // Use img (v12+) with fallback to icon for backwards compatibility
            let iconPath = effect.img || effect.icon || "icons/svg/aura.svg";
            if (!iconPath || iconPath.trim() === "" || iconPath === "icons/svg/mystery-man.svg") {
                iconPath = "icons/svg/aura.svg";
            }
            const isPlayerCreated = effect.getFlag('wodsystem', 'createdBy') === 'player';
            const canDelete = game.user.isGM || isPlayerCreated; // GMs can delete all, players can only delete their own
            return {
                id: effect.id,
                name: effect.name,
                icon: iconPath,
                isPlayerCreated: isPlayerCreated,
                isMandatory: effect.getFlag('wodsystem', 'mandatory') === true,
                canDelete: canDelete
            };
        });
        
        return context;
    }

    /**
     * Generic pagination helper
     */
    _getPaginationData(itemsArray, flagName, itemsPerPage) {
        const currentPage = this.actor.getFlag('wodsystem', flagName) || 0;
        const totalPages = Math.max(1, Math.ceil(itemsArray.length / itemsPerPage));
        const validPage = Math.min(currentPage, totalPages - 1);
        
        const startIdx = validPage * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        
        return {
            currentPage: validPage,
            totalPages: totalPages,
            hasMultiplePages: totalPages > 1,
            hasPrevPage: validPage > 0,
            hasNextPage: validPage < totalPages - 1,
            items: itemsArray.slice(startIdx, endIdx).map((item, idx) => ({
                ...item,
                actualIndex: startIdx + idx
            }))
        };
    }

    /** 
     * @override 
     * 
     * ⚠️ CRITICAL: SCROLL POSITION HANDLING ⚠️
     * 
     * When adding new click handlers that call `this.actor.update()`:
     * YOU MUST store and restore scroll position to prevent autoscroll!
     * 
     * Template to copy for ALL new handlers that update actor data:
     * 
     * ```javascript
     * async _onYourNewHandler(event) {
     *     event.preventDefault();
     *     event.stopPropagation();
     *     
     *     // STEP 1: Store scroll position BEFORE update
     *     const sheetBody = this.element.find('.sheet-body');
     *     const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
     *     
     *     // ... your logic here ...
     *     
     *     // STEP 2: Update with { render: false } to prevent re-render
     *     await this.actor.update({
     *         'system.your.path': value
     *     }, { render: false });
     *     
     *     // STEP 3: Restore scroll position AFTER update
     *     setTimeout(() => {
     *         const newSheetBody = this.element.find('.sheet-body');
     *         if (newSheetBody.length) {
     *             newSheetBody.scrollTop(scrollPos);
     *         }
     *     }, 0);
     * }
     * ```
     * 
     * WHY: Foundry re-renders the sheet after updates, which resets scroll to top.
     * This creates a jarring UX where the page jumps when clicking controls.
     * 
     * Examples: _onQuintessenceBoxClick, _onParadoxBoxClick, _onAddBackground, etc.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Character Creation Wizard
        html.find('.start-character-wizard-overlay').click(this._onStartCharacterWizard.bind(this));

        // Common listeners for all sheets
        html.find('.dot').click(this._onDotClick.bind(this));
        html.find('.health-checkbox').click(this._onHealthCheckboxClick.bind(this));
        html.find('.damage-btn').click(this._onDamageButtonClick.bind(this));
        html.find('.health-box').contextmenu(this._onHealthBoxRightClick.bind(this));
        html.find('.reset-health').click(this._onResetHealth.bind(this));
        
        // Roll system - trait label listeners
        html.find('.trait-label').off('click').click(this._onTraitLabelLeftClick.bind(this));
        html.find('.trait-label').off('contextmenu').on('contextmenu', this._onTraitLabelRightClick.bind(this));
        
        // Create quick rolls trigger button dynamically (completely outside layout)
        // Use setTimeout to ensure it's created after the sheet is fully rendered
        setTimeout(() => this._createQuickRollsTrigger(), 0);
        
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
        html.find('.merit-name').change(this._onMeritNameChange.bind(this));
        html.find('.flaw-name').change(this._onFlawNameChange.bind(this));
        html.find('.merit-reference-btn').click(this._onMeritReferenceClick.bind(this));
        html.find('.flaw-reference-btn').click(this._onFlawReferenceClick.bind(this));
        
        // Merit/Flaw autocomplete
        html.find('.merit-name').on('input', this._onMeritNameInput.bind(this));
        html.find('.flaw-name').on('input', this._onFlawNameInput.bind(this));
        html.find('.merit-name').on('focus', this._onMeritNameFocus.bind(this));
        html.find('.flaw-name').on('focus', this._onFlawNameFocus.bind(this));
        html.find('.merit-name').on('blur', this._onAutocompleteBlur.bind(this));
        html.find('.flaw-name').on('blur', this._onAutocompleteBlur.bind(this));
        html.find('.merit-name').on('keydown', this._onAutocompleteKeydown.bind(this));
        html.find('.flaw-name').on('keydown', this._onAutocompleteKeydown.bind(this));
        
        // Merit/Flaw reference integration (tooltips and click-to-chat)
        this._initializeReferenceIntegrations(html);
        
        // Background handlers
        html.find('.add-background').click(this._onAddBackground.bind(this));
        html.find('.delete-background').click(this._onDeleteBackground.bind(this));
        html.find('.lock-background').click(this._onLockBackground.bind(this));
        html.find('.background-name-select').change(this._onBackgroundNameChange.bind(this));
        html.find('.background-custom-name').change(this._onBackgroundCustomNameChange.bind(this));
        
        // Background reference buttons (tooltips and click-to-chat)
        html.find('.background-reference-btn').click(this._onBackgroundReferenceClick.bind(this));
        
        // Sphere reference buttons (tooltips and click-to-chat)
        html.find('.sphere-reference-btn').click(this._onSphereReferenceClick.bind(this));
        html.find('.sphere-table-btn').click(this._onSphereTableClick.bind(this));
        
        // Prevent locked backgrounds from being changed via dropdown
        html.find('.background-name-select.locked').on('mousedown', (e) => {
            e.preventDefault();
        });
        
        // Background pagination handlers
        html.find('.backgrounds-prev-page').click(this._onBackgroundsPrevPage.bind(this));
        html.find('.backgrounds-next-page').click(this._onBackgroundsNextPage.bind(this));
        
        // Apply disabled state to dots beyond maxRating (in case template doesn't render it)
        html.find('.background-item .dot-container').each((idx, container) => {
            const $container = $(container);
            const maxRating = parseInt($container.attr('data-max-rating')) || 5;
            $container.find('.dot').each((dotIdx, dot) => {
                const $dot = $(dot);
                const index = parseInt($dot.attr('data-index'));
                if (index >= maxRating) {
                    $dot.addClass('disabled');
                    $dot.attr('data-disabled', 'true');
                }
            });
        });
        
        // Equipment tab handlers
        html.find('.add-weapon').click(this._onAddWeapon.bind(this));
        html.find('.add-weapon-empty').click(this._onAddWeapon.bind(this));
        html.find('.add-armor').click(this._onAddArmor.bind(this));
        html.find('.add-armor-empty').click(this._onAddArmor.bind(this));
        html.find('.add-gear').click(this._onAddGear.bind(this));
        html.find('.add-gear-empty').click(this._onAddGear.bind(this));
        html.find('.delete-weapon').click(this._onDeleteWeapon.bind(this));
        html.find('.delete-armor').click(this._onDeleteArmor.bind(this));
        html.find('.delete-gear').click(this._onDeleteGear.bind(this));
        html.find('.weapon-equipped').change((event) => {
            this._onToggleWeaponEquipped(event);
        });
        html.find('.armor-equipped').change((event) => {
            this._onToggleArmorEquipped(event);
        });
        html.find('.equipment-type-tab').click(this._onEquipmentTypeTab.bind(this));
        
        // Status Effects Management
        html.find('.add-effect-btn').click(this._onManageEffects.bind(this));
        html.find('.create-first-effect').click(this._onManageEffects.bind(this));
        html.find('.effect-preview-item').click(this._onEditEffect.bind(this));
        html.find('.effect-preview-item').contextmenu(this._onDeleteEffectQuick.bind(this));
        // Delete button on effect preview - stop propagation to prevent opening edit dialog
        html.find('.delete-effect-preview-item').click((event) => {
            event.stopPropagation(); // Prevent opening edit dialog
            this._onDeleteEffectQuick(event);
        });
        
        // Set equipment filter based on stored state or default to weapons
        const activeEquipmentTab = this._activeEquipmentTab || 'weapons';
        html.find('.equipment-list').attr('data-filter', activeEquipmentTab);
        html.find('.equipment-type-tab').removeClass('active');
        html.find(`.equipment-type-tab[data-type="${activeEquipmentTab}"]`).addClass('active');
        
        // Biography field handlers
        html.find('input[name^="system.biography"]').change(this._onBiographyChange.bind(this));
        html.find('textarea[name^="system.biography"]').change(this._onBiographyChange.bind(this));
        html.find('.wod-file-picker').click(this._onFilePicker.bind(this));
        html.find('.clear-image').click(this._onClearImage.bind(this));
        html.find('.add-instrument').click(this._onAddInstrument.bind(this));
        html.find('.remove-instrument').click(this._onRemoveInstrument.bind(this));
        
        // Secondary ability handlers
        html.find('.add-secondary-talent').click((ev) => this._onAddSecondaryAbility(ev, 'talents'));
        html.find('.add-secondary-skill').click((ev) => this._onAddSecondaryAbility(ev, 'skills'));
        html.find('.add-secondary-knowledge').click((ev) => this._onAddSecondaryAbility(ev, 'knowledges'));
        html.find('.delete-secondary-ability').click(this._onDeleteSecondaryAbility.bind(this));
        html.find('.ability-name-input').change(this._onSecondaryAbilityNameChange.bind(this));
        
        // Backgrounds Expanded - Available to ALL creature types
        html.find('.category-toggle').click(this._onToggleCategory.bind(this));
        html.find('.floating-add-bg').click(this._onOpenAddModal.bind(this));
        html.find('.close-bg-modal').click(this._onCloseModal.bind(this));
        html.find('.cancel-bg-modal').click(this._onCloseModal.bind(this));
        html.find('.save-bg-modal').click(this._onSaveModalBackground.bind(this));
        html.find('.select-bg-category').change(this._onModalCategorySelect.bind(this));
        html.find('.select-background-to-expand').change(this._onModalBackgroundSelect.bind(this));
        html.find('.edit-bg-expanded').click(this._onEditBgExpanded.bind(this));
        html.find('.delete-expanded-bg').click(this._onDeleteExpandedBackground.bind(this));
        
        // Backgrounds Expanded pagination
        html.find('.bg-expanded-prev-page').click(this._onBgExpandedPrevPage.bind(this));
        html.find('.bg-expanded-next-page').click(this._onBgExpandedNextPage.bind(this));
        
        // Hover preview for expanded backgrounds
        html.find('.bg-card-mini').hover(
            this._onShowBgPreview.bind(this),
            this._onHideBgPreview.bind(this)
        );
        
        // Dynamic template buttons within the modal (using event delegation)
        html.on('click', '.add-ally', this._onAddAlly.bind(this));
        html.on('click', '.delete-ally', this._onDeleteAlly.bind(this));
        html.on('click', '.add-contact', this._onAddContact.bind(this));
        html.on('click', '.delete-contact', this._onDeleteContact.bind(this));
        html.on('click', '.add-property', this._onAddProperty.bind(this));
        html.on('click', '.delete-property', this._onDeleteProperty.bind(this));
        html.on('click', '.add-asset', this._onAddAsset.bind(this));
        html.on('click', '.delete-asset', this._onDeleteAsset.bind(this));
        html.on('click', '.add-custom-field', this._onAddCustomField.bind(this));
        html.on('click', '.delete-custom-field', this._onDeleteCustomField.bind(this));
        
        // Enhancement type change handler (show/hide genetic flaws field)
        html.on('change', 'select[name*="enhancementType"]', this._onEnhancementTypeChange.bind(this));
        
        // Technocrat-specific handlers
        if (this.actor.type === "Technocrat") {
            html.find('.primal-box').click(this._onPrimalEnergyClick.bind(this));
            
            // Quintessence/Paradox Wheel
            html.find('.wheel-box').click(this._onWheelBoxClick.bind(this));
            html.find('.wheel-box').contextmenu(this._onWheelBoxRightClick.bind(this));
            
            // Spheres - use event delegation to avoid conflicts
            html.find('[data-sphere] .dot').click(this._onSphereClick.bind(this));
            
            // Procedures
            html.find('.add-procedure').click(this._onAddProcedure.bind(this));
            html.find('.delete-procedure').click(this._onDeleteProcedure.bind(this));
            html.find('.procedures-prev-page').click(this._onProceduresPrevPage.bind(this));
            html.find('.procedures-next-page').click(this._onProceduresNextPage.bind(this));
            
            // Devices
            html.find('.add-device').click(this._onAddDevice.bind(this));
            html.find('.delete-device').click(this._onDeleteDevice.bind(this));
            html.find('.devices-prev-page').click(this._onDevicesPrevPage.bind(this));
            html.find('.devices-next-page').click(this._onDevicesNextPage.bind(this));
            
            // Enhancements
            html.find('.add-enhancement').click(this._onAddEnhancement.bind(this));
            html.find('.delete-enhancement').click(this._onDeleteEnhancement.bind(this));
            html.find('.enhancements-prev-page').click(this._onEnhancementsPrevPage.bind(this));
            html.find('.enhancements-next-page').click(this._onEnhancementsNextPage.bind(this));
        }
    }

    /**
     * Handle clicking on a dot
     */
    async _onDotClick(event) {
        event.preventDefault();
        
        const dot = event.currentTarget;
        const container = dot.closest('.dot-container');
        
        // Skip if this is a sphere dot (handled by _onSphereClick)
        if (container.dataset.sphere) {
            return;
        }
        
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

        // Determine what type of dot this is
        let updatePromise;
        if (container.dataset.attribute) {
            updatePromise = this._updateAttribute(container.dataset.attribute, container.dataset.key, newValue);
        } else if (container.dataset.ability) {
            updatePromise = this._updateAbility(container.dataset.ability, container.dataset.key, newValue);
        } else if (container.dataset.secondaryAbility) {
            // Secondary abilities - EXACTLY like backgrounds!
            updatePromise = this._updateSecondaryAbility(
                container.dataset.secondaryAbility, 
                parseInt(container.dataset.secondaryIndex), 
                newValue
            );
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
        }
        
        // Wait for the data update to complete, THEN update visuals
        if (updatePromise) {
            await updatePromise;
        }
        
        // Update the visual appearance after data is saved
        // Skip for willpower - it handles its own visuals with validation
        if (!container.dataset.willpower) {
            this._updateDotVisuals(container, newValue);
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
     * Handle clicking on damage type buttons
     */
    async _onDamageButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.currentTarget;
        const damageType = button.dataset.damageType;
        
        if (!damageType) return;
        
        const updatedHealth = await this.actor.applyDamage(damageType, 1);
        this._updateHealthDisplay(updatedHealth);
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
     * Roll initiative for this actor
     * @param {Event} event
     * @private
     */
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
        
        // Handle instrument inputs specifically (they're in an array)
        if (field === 'system.biography.focus.instruments') {
            // Initialize focus if it doesn't exist or is incomplete
            if (!this.actor.system.biography.focus || !this.actor.system.biography.focus.instruments) {
                if (this.actor.type === "Technocrat") {
                    await this.actor.update({
                        'system.biography.focus': {
                            paradigm: "",
                            instruments: ["", "", "", "", "", "", ""],
                            practices: ""
                        }
                    });
                    ui.notifications.info('Focus section initialized.');
                }
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
     * Clear character portrait image
     */

    /**
     * Handle file picker button click
     * Opens a custom modal for selecting/entering image path
     */
    async _onFilePicker(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const button = event.currentTarget;
        const target = button.dataset.target;
        const currentValue = foundry.utils.getProperty(this.actor, target) || "";
        
        // Create and show custom file picker modal
        this._showImagePickerModal(target, currentValue);
    }
    
    /**
     * Show a simple image picker modal (scoped to WoD system only)
     */
    _showImagePickerModal(target, currentValue) {
        // Remove any existing modal
        const existingModal = document.querySelector('.wod-image-picker-modal');
        if (existingModal) existingModal.remove();
        
        // Simple modal HTML - just preview, upload, and URL input
        const modalHtml = `
            <div class="wod-image-picker-modal">
                <div class="wod-image-picker-content">
                    <div class="wod-image-picker-header">
                        <h3><i class="fas fa-image"></i> Character Portrait</h3>
                        <button type="button" class="wod-image-picker-close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="wod-image-picker-body">
                        <div class="wod-image-picker-preview">
                            ${currentValue ? `<img src="${currentValue}" alt="Preview"/>` : '<div class="no-preview"><i class="fas fa-user"></i><span>No image</span></div>'}
                        </div>
                        
                        <div class="wod-image-picker-input-group">
                            <label>Image Path or URL</label>
                            <input type="text" class="wod-image-picker-url" value="${currentValue || ''}" placeholder="Enter path or URL..."/>
                        </div>
                        
                        <div class="wod-image-picker-upload">
                            <input type="file" class="wod-upload-input" accept="image/*" style="display:none"/>
                            <button type="button" class="wod-upload-btn"><i class="fas fa-folder-open"></i> Browse PC...</button>
                        </div>
                    </div>
                    <div class="wod-image-picker-footer">
                        <button type="button" class="wod-image-picker-cancel">Cancel</button>
                        <button type="button" class="wod-image-picker-save">Save</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.querySelector('.wod-image-picker-modal');
        const urlInput = modal.querySelector('.wod-image-picker-url');
        const preview = modal.querySelector('.wod-image-picker-preview');
        const uploadInput = modal.querySelector('.wod-upload-input');
        const uploadBtn = modal.querySelector('.wod-upload-btn');
        
        // Update preview
        const updatePreview = (url) => {
            if (url) {
                preview.innerHTML = `<img src="${url}" alt="Preview" onerror="this.parentElement.innerHTML='<div class=\\'no-preview\\'><i class=\\'fas fa-exclamation-triangle\\'></i><span>Invalid</span></div>'"/>`;
            } else {
                preview.innerHTML = '<div class="no-preview"><i class="fas fa-user"></i><span>No image</span></div>';
            }
        };
        
        // Preview on input change
        urlInput.addEventListener('input', () => updatePreview(urlInput.value.trim()));
        
        // Upload button opens file picker, then uploads to Foundry
        uploadBtn.addEventListener('click', () => uploadInput.click());
        
        uploadInput.addEventListener('change', async () => {
            if (uploadInput.files.length === 0) return;
            const file = uploadInput.files[0];
            
            try {
                const FilePickerClass = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
                
                // Upload directly to the Data folder root (always exists)
                const response = await FilePickerClass.upload("data", "", file, {});
                
                if (response?.path) {
                    urlInput.value = response.path;
                    updatePreview(response.path);
                    ui.notifications.info(`Uploaded: ${file.name}`);
                }
            } catch (error) {
                console.error('Upload error:', error);
                if (error.message?.includes('permission') || error.message?.includes('Permission')) {
                    ui.notifications.error('No permission to upload. Ask your GM to enable file uploads.');
                } else {
                    ui.notifications.error(`Upload failed: ${error.message || 'Unknown error'}`);
                }
            }
        });
        
        // Close handlers
        const closeModal = () => modal.remove();
        modal.querySelector('.wod-image-picker-close').addEventListener('click', closeModal);
        modal.querySelector('.wod-image-picker-cancel').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        
        // Save handler
        modal.querySelector('.wod-image-picker-save').addEventListener('click', async () => {
            await this.actor.update({ [target]: urlInput.value.trim() });
            closeModal();
        });
        
        // Keyboard shortcuts
        urlInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                await this.actor.update({ [target]: urlInput.value.trim() });
                closeModal();
            } else if (e.key === 'Escape') {
                closeModal();
            }
        });
    }

    async _onClearImage(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const target = button.dataset.target;
        await this.actor.update({ [target]: "" });
    }

    /**
     * Add a new instrument to the focus
     */
    async _onAddInstrument(event) {
        event.preventDefault();
        
        // Check if actor type supports focus
        if (this.actor.type !== "Technocrat") {
            ui.notifications.warn('Focus section is not available for this character type.');
            return;
        }
        
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
        
        // Store scroll position
        const scrollContainer = this.element.find('.tab[data-tab="biography"]');
        const scrollTop = scrollContainer.scrollTop();
        
        const instruments = foundry.utils.duplicate(this.actor.system.biography.focus.instruments);
        instruments.push("");
        await this.actor.update({ 'system.biography.focus.instruments': instruments });
        
        // Restore scroll position after render
        setTimeout(() => {
            const newScrollContainer = this.element.find('.tab[data-tab="biography"]');
            newScrollContainer.scrollTop(scrollTop);
        }, 0);
    }

    /**
     * Remove an instrument from the focus
     */
    async _onRemoveInstrument(event) {
        event.preventDefault();
        
        // Check if actor type supports focus
        if (this.actor.type !== "Technocrat") {
            ui.notifications.warn('Focus section is not available for this character type.');
            return;
        }
        
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
            ui.notifications.warn("You must have at least 7 instruments.");
            return;
        }
        
        // Store scroll position
        const scrollContainer = this.element.find('.tab[data-tab="biography"]');
        const scrollTop = scrollContainer.scrollTop();
        
        instruments.splice(index, 1);
        await this.actor.update({ 'system.biography.focus.instruments': instruments });
        
        // Restore scroll position after render
        setTimeout(() => {
            const newScrollContainer = this.element.find('.tab[data-tab="biography"]');
            newScrollContainer.scrollTop(scrollTop);
        }, 0);
    }

    /**
     * Add a merit
     */
    async _onAddMerit(event) {
        event.preventDefault();
        let merits = foundry.utils.duplicate(this.actor.system.miscellaneous?.merits || []);
        
        // Defensive: ensure it's an array (Foundry form processing can convert to object)
        if (!Array.isArray(merits)) {
            console.warn("Merits was not an array, converting:", merits);
            merits = [];
        }
        
        merits.push({ name: "", value: 1 });
        await this.actor.update({ "system.miscellaneous.merits": merits });
    }

    /**
     * Delete a merit
     */
    async _onDeleteMerit(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        let merits = foundry.utils.duplicate(this.actor.system.miscellaneous.merits);
        
        // Defensive: ensure it's an array
        if (!Array.isArray(merits)) {
            console.warn("Merits was not an array during delete, resetting");
            merits = [];
        } else {
            merits.splice(index, 1);
        }
        
        await this.actor.update({ "system.miscellaneous.merits": merits });
    }

    /**
     * Add a flaw
     */
    async _onAddFlaw(event) {
        event.preventDefault();
        let flaws = foundry.utils.duplicate(this.actor.system.miscellaneous?.flaws || []);
        
        // Defensive: ensure it's an array (Foundry form processing can convert to object)
        if (!Array.isArray(flaws)) {
            console.warn("Flaws was not an array, converting:", flaws);
            flaws = [];
        }
        
        flaws.push({ name: "", value: 1 });
        await this.actor.update({ "system.miscellaneous.flaws": flaws });
    }

    /**
     * Delete a flaw
     */
    async _onDeleteFlaw(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        let flaws = foundry.utils.duplicate(this.actor.system.miscellaneous.flaws);
        
        // Defensive: ensure it's an array
        if (!Array.isArray(flaws)) {
            console.warn("Flaws was not an array during delete, resetting");
            flaws = [];
        } else {
            flaws.splice(index, 1);
        }
        
        await this.actor.update({ "system.miscellaneous.flaws": flaws });
    }
    
    /**
     * Handle merit name change
     * Update entire merits array to prevent form processing corruption
     */
    async _onMeritNameChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const index = parseInt(input.dataset.index);
        const newName = input.value;
        
        let merits = foundry.utils.duplicate(this.actor.system.miscellaneous.merits);
        if (!Array.isArray(merits)) {
            console.warn("Merits was not an array, resetting");
            merits = [];
        }
        
        if (merits[index]) {
            merits[index].name = newName;
            await this.actor.update({ "system.miscellaneous.merits": merits });
        }
        
        // Re-initialize reference integrations after name change
        this._initializeReferenceIntegrations($(this.element));
    }

    _onMeritNameInput(event) {
        const input = event.currentTarget;
        const query = input.value.trim();
        
        // Update reference button visibility in real-time
        const service = game.wod?.referenceDataService;
        if (service && service.initialized) {
            const $button = $(input).siblings('.merit-reference-btn');
            const reference = service.getByName(query, 'Merit');
            
            if (reference) {
                $button.addClass('has-reference');
                $button.data('reference', reference);
            } else {
                $button.removeClass('has-reference');
                $button.removeData('reference');
            }
        }
        
        if (query.length < 2) {
            this._hideAutocomplete();
            return;
        }
        
        if (!service || !service.initialized) {
            return;
        }
        
        // Search for merits matching the query, filtered by actor type
        const results = service.search(query, { category: 'Merit', actorType: this.actor.type }).slice(0, 10); // Limit to 10 results
        
        if (results.length > 0) {
            this._showAutocomplete(input, results, 'merit');
        } else {
            this._hideAutocomplete();
        }
    }

    _onMeritNameFocus(event) {
        const input = event.currentTarget;
        const query = input.value.trim();
        
        if (query.length >= 2) {
            // Trigger search on focus if there's already text
            this._onMeritNameInput(event);
        }
    }
    
    /**
     * Handle flaw name change
     * Update entire flaws array to prevent form processing corruption
     */
    async _onFlawNameChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const index = parseInt(input.dataset.index);
        const newName = input.value;
        
        let flaws = foundry.utils.duplicate(this.actor.system.miscellaneous.flaws);
        if (!Array.isArray(flaws)) {
            console.warn("Flaws was not an array, resetting");
            flaws = [];
        }
        
        if (flaws[index]) {
            flaws[index].name = newName;
            await this.actor.update({ "system.miscellaneous.flaws": flaws });
        }
        
        // Re-initialize reference integrations after name change
        this._initializeReferenceIntegrations($(this.element));
    }

    _onFlawNameInput(event) {
        const input = event.currentTarget;
        const query = input.value.trim();
        
        // Update reference button visibility in real-time
        const service = game.wod?.referenceDataService;
        if (service && service.initialized) {
            const $button = $(input).siblings('.flaw-reference-btn');
            const reference = service.getByName(query, 'Flaw');
            
            if (reference) {
                $button.addClass('has-reference');
                $button.data('reference', reference);
            } else {
                $button.removeClass('has-reference');
                $button.removeData('reference');
            }
        }
        
        if (query.length < 2) {
            this._hideAutocomplete();
            return;
        }
        
        if (!service || !service.initialized) {
            return;
        }
        
        // Search for flaws matching the query, filtered by actor type
        const results = service.search(query, { category: 'Flaw', actorType: this.actor.type }).slice(0, 10); // Limit to 10 results
        
        if (results.length > 0) {
            this._showAutocomplete(input, results, 'flaw');
        } else {
            this._hideAutocomplete();
        }
    }

    _onFlawNameFocus(event) {
        const input = event.currentTarget;
        const query = input.value.trim();
        
        if (query.length >= 2) {
            // Trigger search on focus if there's already text
            this._onFlawNameInput(event);
        }
    }
    
    /**
     * Handle click on merit reference button
     * @param {Event} event - The click event
     * @private
     */
    async _onMeritReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const $button = $(event.currentTarget);
        const reference = $button.data('reference');
        
        if (!reference) {
            const index = parseInt($button.data('index'));
            const $input = $button.siblings('.merit-name');
            const name = $input.val()?.trim();
            
            if (name) {
                ui.notifications.warn(`No reference data found for "${name}"`);
            }
            return;
        }
        
        // Show tooltip instead of posting to chat
        const existingTooltip = $('.wod-reference-tooltip');
        if (existingTooltip.length) {
            this._hideReferenceTooltip();
        } else {
            this._showReferenceTooltip(event, reference);
        }
    }
    
    /**
     * Handle click on flaw reference button
     * @param {Event} event - The click event
     * @private
     */
    async _onFlawReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const $button = $(event.currentTarget);
        const reference = $button.data('reference');
        
        if (!reference) {
            const index = parseInt($button.data('index'));
            const $input = $button.siblings('.flaw-name');
            const name = $input.val()?.trim();
            
            if (name) {
                ui.notifications.warn(`No reference data found for "${name}"`);
            }
            return;
        }
        
        // Show tooltip instead of posting to chat
        const existingTooltip = $('.wod-reference-tooltip');
        if (existingTooltip.length) {
            this._hideReferenceTooltip();
        } else {
            this._showReferenceTooltip(event, reference);
        }
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
        
        const currentBackgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        
        // CRITICAL: Validate that backgrounds is an array
        if (!Array.isArray(currentBackgrounds)) {
            console.error(`Actor ${this.actor.name}: Cannot add background - backgrounds is not an array! Type: ${typeof currentBackgrounds}`);
            ui.notifications.error('Background data corruption detected. Please reload the actor sheet.');
            return;
        }
        
        const backgrounds = foundry.utils.duplicate(currentBackgrounds);
        backgrounds.push({ name: "Allies", value: 1 });
        
        // Navigate to the page containing the new background
        const backgroundsPerPage = 9;
        const newIndex = backgrounds.length - 1;
        const newPage = Math.floor(newIndex / backgroundsPerPage);
        
        // Set the page first, then update backgrounds
        await this.actor.setFlag('wodsystem', 'backgroundsPage', newPage);
        await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds }, { render: false });
        
        // Force a complete re-render to refresh all select elements
        await this.render(true);
        
        // Restore scroll position after render completes
        setTimeout(() => {
            const newSheetBody = this.element.find('.sheet-body');
            if (newSheetBody.length) {
                newSheetBody.scrollTop(scrollPos);
            }
        }, 50);
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
        const currentBackgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        
        // CRITICAL: Validate that backgrounds is an array
        if (!Array.isArray(currentBackgrounds)) {
            console.error(`Actor ${this.actor.name}: Cannot change background name - backgrounds is not an array! Type: ${typeof currentBackgrounds}`);
            ui.notifications.error('Background data corruption detected. Please reload the actor sheet.');
            return;
        }
        
        const backgrounds = foundry.utils.duplicate(currentBackgrounds);
        
        if (backgrounds[index]) {
            // Update the name
            backgrounds[index].name = value;
            
            const needsRerender = (value === "Custom" && !backgrounds[index].customName) || 
                                 (value !== "Custom" && backgrounds[index].customName !== undefined);
            
            // If "Custom" is selected, ensure customName field exists
            if (value === "Custom" && !backgrounds[index].customName) {
                backgrounds[index].customName = "";
            }

            // If switching away from Custom, remove customName to keep data clean
            if (value !== "Custom" && backgrounds[index].customName !== undefined) {
                delete backgrounds[index].customName;
            }
            
            if (needsRerender) {
                // Need to re-render to show/hide custom input
                await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds });
                
                // Restore scroll position after render completes
                setTimeout(() => {
                    const newSheetBody = this.element.find('.sheet-body');
                    if (newSheetBody.length) newSheetBody.scrollTop(scrollPos);
                }, 50);
            } else {
                // Just update data without re-rendering (dropdown already shows correct value)
                await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds }, { render: false });
                
                // Update disabled state of dots for this background
                this._updateBackgroundDotsDisabledState(select, value);
            }
        }
    }
    
    /**
     * Update the disabled state of dots when background name changes
     */
    _updateBackgroundDotsDisabledState(selectElement, backgroundName) {
        const $select = $(selectElement);
        const $backgroundItem = $select.closest('.background-item');
        const $dotContainer = $backgroundItem.find('.dot-container');
        
        // Get maxRating for the new background
        const refService = game.wod?.referenceDataService;
        let maxRating = 5; // Default
        
        if (refService && refService.initialized && backgroundName && backgroundName !== "Custom") {
            const bgData = refService.getBackgroundByName(backgroundName);
            if (bgData && typeof bgData.maxRating === 'number') {
                maxRating = bgData.maxRating;
            }
        }
        
        // Update data-max-rating attribute
        $dotContainer.attr('data-max-rating', maxRating);
        
        // Update disabled state for each dot
        $dotContainer.find('.dot').each((idx, dot) => {
            const $dot = $(dot);
            const dotIndex = parseInt($dot.attr('data-index'));
            
            if (dotIndex >= maxRating) {
                // Should be disabled
                $dot.addClass('disabled');
                $dot.attr('data-disabled', 'true');
            } else {
                // Should be enabled
                $dot.removeClass('disabled');
                $dot.removeAttr('data-disabled');
            }
        });
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
        const currentBackgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        
        // CRITICAL: Validate that backgrounds is an array
        if (!Array.isArray(currentBackgrounds)) {
            console.error(`Actor ${this.actor.name}: Cannot delete background - backgrounds is not an array! Type: ${typeof currentBackgrounds}`);
            ui.notifications.error('Background data corruption detected. Please reload the actor sheet.');
            return;
        }
        
        const backgrounds = foundry.utils.duplicate(currentBackgrounds);
        backgrounds.splice(index, 1);
        
        // If we deleted the last item on the current page, go back to the previous page
        const backgroundsPerPage = 9;
        const currentPage = this.actor.getFlag('wodsystem', 'backgroundsPage') || 0;
        const totalPages = Math.max(1, Math.ceil(backgrounds.length / backgroundsPerPage));
        
        // Update page first if needed, then update backgrounds
        if (currentPage >= totalPages && currentPage > 0) {
            await this.actor.setFlag('wodsystem', 'backgroundsPage', totalPages - 1);
        }
        
        await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds }, { render: false });
        
        // Force a complete re-render to refresh all select elements
        await this.render(true);
        
        // Restore scroll position after render completes
        setTimeout(() => {
            const newSheetBody = this.element.find('.sheet-body');
            if (newSheetBody.length) {
                newSheetBody.scrollTop(scrollPos);
            }
        }, 50);
    }

    /**
     * Handle background reference button click (show tooltip and post to chat)
     */
    _onBackgroundReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;
        
        // Read the current value from the adjacent dropdown, not the data attribute
        const $button = $(event.currentTarget);
        const $select = $button.siblings('.background-name-select');
        const backgroundName = $select.val();
        
        if (!backgroundName || backgroundName === "Custom") return;
        
        const background = service.getBackgroundByName(backgroundName);
        if (!background) return;
        
        // Toggle tooltip on click
        const existingTooltip = $('.wod-reference-tooltip');
        if (existingTooltip.length) {
            this._hideReferenceTooltip();
        } else {
            this._showBackgroundTooltip(event, background);
        }
    }

    /**
     * Show tooltip for background reference
     */
    _showBackgroundTooltip(event, background) {
        this._hideReferenceTooltip(); // Remove any existing tooltip
        
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        // Create tooltip element
        const tooltip = $('<div class="wod-reference-tooltip"></div>');
        tooltip.html(service.generateBackgroundTooltipHTML(background));
        
        // Add to body with visibility hidden to measure
        tooltip.css({ 
            visibility: 'hidden', 
            display: 'block',
            position: 'fixed'
        });
        $('body').append(tooltip);
        
        // Get dimensions
        const rect = event.currentTarget.getBoundingClientRect();
        const tooltipWidth = tooltip.outerWidth();
        const tooltipHeight = tooltip.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        
        // Calculate left position (prevent overflow)
        let left = rect.left;
        if (left + tooltipWidth > windowWidth - 10) {
            left = windowWidth - tooltipWidth - 10;
        }
        if (left < 10) {
            left = 10;
        }
        
        // Calculate top position - show above the element
        let top = rect.top - tooltipHeight - 10;
        
        // If it goes off the top of the screen, position below instead
        if (top < 10) {
            top = rect.bottom + 10;
            // If it goes off the bottom too, just clamp to top
            if (top + tooltipHeight > windowHeight - 10) {
                top = 10;
            }
        }
        
        // Apply final position and make visible
        tooltip.css({
            position: 'fixed',
            top: top + 'px',
            left: left + 'px',
            maxWidth: '500px',
            maxHeight: '400px',
            overflowY: 'auto',
            visibility: 'visible',
            display: 'none',
            pointerEvents: 'auto'
        });
        
        // Fade in
        tooltip.fadeIn(200);
        
        // Add click handler to the chat button only
        tooltip.find('.post-to-chat-btn').click((e) => {
            e.stopPropagation();
            this._postBackgroundToChat(background);
            this._hideReferenceTooltip();
        });
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.on('click', (e) => {
            e.stopPropagation();
        });
        
        // Close tooltip when clicking outside (use setTimeout to prevent immediate closure)
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideReferenceTooltip();
            });
        }, 100);
    }

    /**
     * Post background reference to chat
     */
    async _postBackgroundToChat(background) {
        const html = await renderTemplate('systems/wodsystem/templates/chat/background-reference-card.html', { background });
        await ChatMessage.create({ 
            speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
            content: html, 
            style: CONST.CHAT_MESSAGE_STYLES.OTHER 
        });
    }

    /**
     * Handle sphere reference button click (main tooltip)
     */
    _onSphereReferenceClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const sphereId = $(event.currentTarget).data('sphere-id');
        const service = game.wod?.referenceDataService;
        
        if (!service) {
            ui.notifications.warn("Reference data service not available");
            return;
        }
        
        const sphere = service.getSphereById(sphereId);
        
        if (sphere) {
            this._showSphereTooltip(event, sphere);
        }
    }

    /**
     * Handle sphere table button click (table tooltip)
     */
    _onSphereTableClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const sphereId = $(event.currentTarget).data('sphere-id');
        const service = game.wod?.referenceDataService;
        
        if (!service) {
            ui.notifications.warn("Reference data service not available");
            return;
        }
        
        const sphere = service.getSphereById(sphereId);
        
        if (sphere && sphere.specialTable) {
            this._showSphereTableTooltip(event, sphere);
        }
    }

    /**
     * Show sphere tooltip with all levels
     */
    _showSphereTooltip(event, sphere) {
        this._hideSphereTooltip(); // Remove any existing sphere tooltip
        
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        const tooltipHTML = service.generateSphereTooltipHTML(sphere);
        
        const tooltip = $(`
            <div class="wod-reference-tooltip wod-sphere-tooltip" 
                 style="position: fixed; 
                        z-index: 100000; 
                        background-color: white; 
                        border: 2px solid var(--wod-primary, #7B1FA2); 
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
        
        // Position tooltip to the side of the button
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
        
        // Add click handlers for post buttons
        tooltip.find('.post-description-btn').click((e) => {
            e.stopPropagation();
            this._postSphereToChat(sphere, 'description');
            this._hideSphereTooltip();
        });
        
        tooltip.find('.post-level-btn').click((e) => {
            e.stopPropagation();
            const levelNumber = parseInt($(e.currentTarget).data('level'));
            this._postSphereToChat(sphere, 'level', levelNumber);
            this._hideSphereTooltip();
        });
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.on('click', (e) => {
            e.stopPropagation();
        });
        
        // Close tooltip when clicking outside
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideSphereTooltip();
            });
        }, 100);
    }

    /**
     * Show sphere table tooltip
     */
    _showSphereTableTooltip(event, sphere) {
        this._hideSphereTableTooltip(); // Remove any existing table tooltip
        
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        const tooltipHTML = service.generateSphereTableTooltipHTML(sphere);
        
        const tooltip = $(`
            <div class="wod-reference-tooltip wod-sphere-table-tooltip" 
                 style="position: fixed; 
                        z-index: 100000; 
                        background-color: white; 
                        border: 2px solid var(--wod-primary, #7B1FA2); 
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
        
        // Position tooltip to the side of the button
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
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.on('click', (e) => {
            e.stopPropagation();
        });
        
        // Close tooltip when clicking outside
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideSphereTableTooltip();
            });
        }, 100);
    }

    /**
     * Hide sphere main tooltip
     */
    _hideSphereTooltip() {
        $('.wod-sphere-tooltip').fadeOut(200, function() {
            $(this).remove();
        });
    }

    /**
     * Hide sphere table tooltip
     */
    _hideSphereTableTooltip() {
        $('.wod-sphere-table-tooltip').fadeOut(200, function() {
            $(this).remove();
        });
    }

    /**
     * Post sphere reference to chat
     * @param {object} sphere - Sphere data
     * @param {string} type - 'description', 'level', or 'table'
     * @param {number} levelNumber - Level number (if type is 'level')
     */
    async _postSphereToChat(sphere, type = 'description', levelNumber = null) {
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        const html = service.generateSphereChatHTML(sphere, { type, levelNumber });
        
        await ChatMessage.create({ 
            speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
            content: html, 
            style: CONST.CHAT_MESSAGE_STYLES.OTHER 
        });
    }

    /**
     * Toggle lock state of a background
     */
    async _onLockBackground(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position before update
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const index = parseInt(event.currentTarget.dataset.index);
        const backgrounds = foundry.utils.duplicate(this.actor.system.miscellaneous.backgrounds);
        
        if (backgrounds[index]) {
            const wasLocked = backgrounds[index].locked;
            backgrounds[index].locked = !wasLocked;
            
            await this.actor.update({ "system.miscellaneous.backgrounds": backgrounds });
            
            // After update, manually toggle rollable attributes on the element
            const bgItem = this.element.find(`.dot-container[data-background="${index}"]`).closest('.background-item');
            const bgElement = bgItem.find('.background-name-select, .background-custom-name')[0];
            
            if (bgElement) {
                if (backgrounds[index].locked) {
                    // Just locked - make it rollable
                    const bgName = backgrounds[index].name === "Custom" 
                        ? backgrounds[index].customName 
                        : backgrounds[index].name;
                    bgElement.classList.add('trait-label', 'locked');
                    bgElement.setAttribute('data-trait', bgName);
                    bgElement.setAttribute('data-value', backgrounds[index].value);
                    bgElement.setAttribute('data-category', 'background');
                    bgElement.setAttribute('data-background-index', index);
                    
                    // Attach event listeners to the newly rollable background
                    $(bgElement).off('click').click(this._onTraitLabelLeftClick.bind(this));
                    $(bgElement).off('contextmenu').on('contextmenu', this._onTraitLabelRightClick.bind(this));
                    
                    // Prevent dropdown from opening for locked selects
                    if (bgElement.tagName === 'SELECT') {
                        $(bgElement).on('mousedown', (e) => e.preventDefault());
                    } else if (bgElement.tagName === 'INPUT') {
                        bgElement.setAttribute('readonly', 'readonly');
                    }
                } else {
                    // Just unlocked - remove rollable attributes and listeners
                    bgElement.classList.remove('trait-label', 'locked');
                    bgElement.removeAttribute('data-trait');
                    bgElement.removeAttribute('data-value');
                    bgElement.removeAttribute('data-category');
                    bgElement.removeAttribute('data-background-index');
                    
                    // Remove readonly from custom inputs
                    if (bgElement.tagName === 'INPUT') {
                        bgElement.removeAttribute('readonly');
                    }
                    
                    // Remove event listeners
                    $(bgElement).off('click');
                    $(bgElement).off('contextmenu');
                    $(bgElement).off('mousedown');
                }
            }
            
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
        
        const backgroundsPerPage = 9;
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

    // ========================================
    // Equipment Tab Handlers
    // ========================================

    /**
     * Add a new weapon
     */
    async _onAddWeapon(event) {
        event.preventDefault();
        // console.log("Add weapon clicked!");
        // console.log("Current equipment:", this.actor.system.equipment);
        
        // Convert weapons to array (Foundry sometimes stores as object)
        let weaponsData = this.actor.system.equipment?.weapons;
        const weapons = Array.isArray(weaponsData) 
            ? foundry.utils.duplicate(weaponsData)
            : Object.values(weaponsData || {});
        
        // console.log("Current weapons (converted to array):", weapons);
        
        const newWeapon = {
            id: foundry.utils.randomID(),
            name: "New Weapon",
            type: "weapon",
            subtype: "melee",
            equipped: false,
            damage: "1",
            difficulty: 6,
            range: "-",
            rate: "1",
            clip: "-",
            concealment: "P",
            description: "",
            grantsEffects: []
        };
        
        weapons.push(newWeapon);
        await this.actor.update({ "system.equipment.weapons": weapons });
        
        // Scroll to bottom of equipment list to show new item
        setTimeout(() => {
            const equipmentList = this.element.find('.equipment-list')[0];
            if (equipmentList) {
                equipmentList.scrollTop = equipmentList.scrollHeight;
            }
        }, 100);
    }

    /**
     * Delete a weapon
     */
    async _onDeleteWeapon(event) {
        event.preventDefault();
        const weaponId = event.currentTarget.dataset.weaponId;
        
        // Convert weapons to array (Foundry sometimes stores as object)
        let weaponsData = this.actor.system.equipment?.weapons;
        const weapons = Array.isArray(weaponsData) 
            ? foundry.utils.duplicate(weaponsData)
            : Object.values(weaponsData || {});
        
        const index = weapons.findIndex(w => w.id === weaponId);
        if (index > -1) {
            weapons.splice(index, 1);
            await this.actor.update({ "system.equipment.weapons": weapons });
        }
    }

    /**
     * Toggle weapon equipped status
     */
    async _onToggleWeaponEquipped(event) {
        const weaponId = event.currentTarget.dataset.weaponId;
        const isEquipped = event.currentTarget.checked;
        
        // Convert weapons to array (Foundry sometimes stores as object)
        let weaponsData = this.actor.system.equipment?.weapons;
        const weapons = Array.isArray(weaponsData) 
            ? foundry.utils.duplicate(weaponsData)
            : Object.values(weaponsData || {});
        
        const weapon = weapons.find(w => w.id === weaponId);
        if (weapon) {
            weapon.equipped = isEquipped;
            await this.actor.update({ "system.equipment.weapons": weapons });
        }
    }

    /**
     * Add a new armor piece
     */
    async _onAddArmor(event) {
        event.preventDefault();
        const armor = Array.isArray(this.actor.system.equipment?.armor)
            ? foundry.utils.duplicate(this.actor.system.equipment.armor)
            : [];
        
        const newArmor = {
            id: foundry.utils.randomID(),
            name: "New Armor",
            type: "armor",
            equipped: false,
            rating: 1,
            penalty: 0,
            description: "",
            grantsEffects: []
        };
        
        armor.push(newArmor);
        await this.actor.update({ "system.equipment.armor": armor });
    }

    /**
     * Delete an armor piece
     */
    async _onDeleteArmor(event) {
        event.preventDefault();
        const armorId = event.currentTarget.dataset.armorId;
        const armor = Array.isArray(this.actor.system.equipment?.armor)
            ? foundry.utils.duplicate(this.actor.system.equipment.armor)
            : [];
        
        const index = armor.findIndex(a => a.id === armorId);
        if (index > -1) {
            armor.splice(index, 1);
            await this.actor.update({ "system.equipment.armor": armor });
        }
    }

    /**
     * Toggle armor equipped status
     */
    async _onToggleArmorEquipped(event) {
        const armorId = event.currentTarget.dataset.armorId;
        const isEquipped = event.currentTarget.checked;
        const armor = Array.isArray(this.actor.system.equipment?.armor)
            ? foundry.utils.duplicate(this.actor.system.equipment.armor)
            : [];
        
        const armorPiece = armor.find(a => a.id === armorId);
        if (armorPiece) {
            armorPiece.equipped = isEquipped;
            await this.actor.update({ "system.equipment.armor": armor });
        }
    }

    /**
     * Add a new gear item
     */
    async _onAddGear(event) {
        event.preventDefault();
        const gear = Array.isArray(this.actor.system.equipment?.gear)
            ? foundry.utils.duplicate(this.actor.system.equipment.gear)
            : [];
        
        const newGear = {
            id: foundry.utils.randomID(),
            name: "New Gear",
            type: "gear",
            quantity: 1,
            weight: "0 lbs",
            description: "",
            grantsEffects: []
        };
        
        gear.push(newGear);
        await this.actor.update({ "system.equipment.gear": gear });
    }

    /**
     * Delete a gear item
     */
    async _onDeleteGear(event) {
        event.preventDefault();
        const gearId = event.currentTarget.dataset.gearId;
        const gear = Array.isArray(this.actor.system.equipment?.gear)
            ? foundry.utils.duplicate(this.actor.system.equipment.gear)
            : [];
        
        const index = gear.findIndex(g => g.id === gearId);
        if (index > -1) {
            gear.splice(index, 1);
            await this.actor.update({ "system.equipment.gear": gear });
        }
    }


    /**
     * Determine roll context based on traits being rolled
     * @param {Array} traits - Array of trait objects {name, value}
     * @returns {Object} Roll context with action type
     * @private
     */
    _determineRollContext(traits) {
        const rollContext = {
            action: null,
            traits: traits
        };
        
        // Combat abilities indicate attack rolls
        const combatAbilities = ['firearms', 'melee', 'brawl', 'archery', 'thrown', 'heavy weapons'];
        const traitNames = traits.map(t => t.name.toLowerCase());
        
        if (traitNames.some(name => combatAbilities.includes(name))) {
            rollContext.action = 'attack';
        }
        
        // Could add more context detection here:
        // - 'soak' if rolling Stamina alone or in specific contexts
        // - 'social' for social abilities
        // - etc.
        
        return rollContext;
    }
    
    /**
     * Handle equipment type tab switching
     */
    _onEquipmentTypeTab(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const type = button.dataset.type;
        
        // Store the active tab
        this._activeEquipmentTab = type;
        
        // Update active tab
        this.element.find('.equipment-type-tab').removeClass('active');
        $(button).addClass('active');
        
        // Filter equipment list
        const equipmentList = this.element.find('.equipment-list');
        equipmentList.attr('data-filter', type);
    }

    /**
     * Open the Status Effects Manager to create a new effect
     */
    _onManageEffects(event) {
        event.preventDefault();
        const manager = new WodEffectManager(this.actor);
        manager.render(true);
    }

    /**
     * Edit an existing effect (left-click)
     */
    _onEditEffect(event) {
        event.preventDefault();
        
        // Don't open editor for locked ST effects (handled in WodEffectManager constructor too)
        if (event.currentTarget.classList.contains('st-effect-locked')) {
            ui.notifications.warn("You cannot edit effects created by the Storyteller.");
            return;
        }
        
        const effectId = event.currentTarget.dataset.effectId;
        const manager = new WodEffectManager(this.actor, effectId);
        manager.render(true);
    }

    /**
     * Quick delete an effect (right-click)
     */
    async _onDeleteEffectQuick(event) {
        event.preventDefault();
        const effectId = event.currentTarget.dataset.effectId;
        const effect = this.actor.effects.get(effectId);
        
        if (!effect) {
            ui.notifications.warn("Effect not found.");
            return;
        }
        
        // Prevent players from deleting ST-created effects
        if (!game.user.isGM) {
            const createdBy = effect.getFlag('wodsystem', 'createdBy');
            if (createdBy === 'storyteller') {
                ui.notifications.warn("You cannot delete effects created by the Storyteller.");
                return;
            }
        }
        
        // Confirm deletion
        const confirmed = await Dialog.confirm({
            title: "Delete Status Effect",
            content: `<p>Are you sure you want to delete <strong>${effect.name}</strong>?</p><p>This action cannot be undone.</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (confirmed) {
            await effect.delete();
            ui.notifications.info(`Effect "${effect.name}" deleted.`);
        }
    }

    /**
     * Add a secondary ability (uses arrays like merits)
     */
    async _onAddSecondaryAbility(event, category) {
        event.preventDefault();
        let abilities = foundry.utils.duplicate(this.actor.system.secondaryAbilities[category] || []);
        
        // Defensive: ensure it's an array
        if (!Array.isArray(abilities)) {
            console.warn("Secondary abilities was not an array, resetting");
            abilities = [];
        }
        
        abilities.push({ name: "", value: 0 });
        await this.actor.update({ [`system.secondaryAbilities.${category}`]: abilities });
    }

    /**
     * Delete a secondary ability (uses arrays like merits)
     */
    async _onDeleteSecondaryAbility(event) {
        event.preventDefault();
        const category = event.currentTarget.dataset.category;
        const index = parseInt(event.currentTarget.dataset.index);
        
        let abilities = foundry.utils.duplicate(this.actor.system.secondaryAbilities[category]);
        
        // Defensive: ensure it's an array
        if (!Array.isArray(abilities)) {
            console.warn("Secondary abilities was not an array during delete, resetting");
            abilities = [];
        } else {
            abilities.splice(index, 1);
        }
        
        await this.actor.update({ [`system.secondaryAbilities.${category}`]: abilities });
    }
    
    /**
     * Handle secondary ability name change (uses arrays like merits)
     */
    async _onSecondaryAbilityNameChange(event) {
        event.preventDefault();
        const input = event.currentTarget;
        const category = input.dataset.secondaryCategory;
        const index = parseInt(input.dataset.index);
        const newName = input.value.trim();
        
        let abilities = foundry.utils.duplicate(this.actor.system.secondaryAbilities[category]);
        if (!Array.isArray(abilities)) {
            console.warn("Secondary abilities was not an array, resetting");
            abilities = [];
        }
        
        if (abilities[index]) {
            abilities[index].name = newName;
            await this.actor.update({ [`system.secondaryAbilities.${category}`]: abilities });
            
            // Make it rollable if it has a name, otherwise make it editable
            if (newName && newName.length > 0) {
                // Add trait-label class and attributes for roll system
                input.classList.add('trait-label');
                input.setAttribute('data-trait', newName);
                input.setAttribute('data-value', abilities[index].value || 0);
                input.setAttribute('data-category', category);
                input.setAttribute('readonly', 'readonly');
                
                // Attach event listeners for rolls
                $(input).off('click').click(this._onTraitLabelLeftClick.bind(this));
                $(input).off('contextmenu').on('contextmenu', this._onTraitLabelRightClick.bind(this));
            } else {
                // Remove trait-label class and attributes
                input.classList.remove('trait-label');
                input.removeAttribute('data-trait');
                input.removeAttribute('data-value');
                input.removeAttribute('data-category');
                input.removeAttribute('readonly');
                
                // Remove event listeners
                $(input).off('click');
                $(input).off('contextmenu');
            }
        }
    }


    /**
     * Update an attribute
     */
    async _updateAttribute(category, key, value) {
        const updateData = {};
        const newValue = Math.min(Math.max(value, 1), 5);
        updateData[`system.attributes.${category}.${key}`] = newValue;
        
        await this.actor.update(updateData, { render: false });
        
        // Update visual dots
        const container = this.element.find(`.dot-container[data-attribute="${category}"][data-key="${key}"]`)[0];
        if (container) {
            this._updateDotVisuals(container, newValue);
        }
        
        // Update the label's data-value attribute
        const label = this.element.find(`.trait-label[data-trait="${key}"][data-attribute-type="${category}"]`)[0];
        if (label) {
            label.setAttribute('data-value', newValue);
        }
    }

    /**
     * Update an ability
     */
    async _updateAbility(category, key, value) {
        const updateData = {};
        const newValue = Math.min(Math.max(value, 0), 5);
        updateData[`system.abilities.${category}.${key}`] = newValue;
        
        await this.actor.update(updateData, { render: false });
        
        // Update visual dots
        const container = this.element.find(`.dot-container[data-ability="${category}"][data-key="${key}"]`)[0];
        if (container) {
            this._updateDotVisuals(container, newValue);
        }
        
        // Update the label's data-value attribute
        const label = this.element.find(`.trait-label[data-trait="${key}"][data-category="${category}"]`)[0];
        if (label) {
            label.setAttribute('data-value', newValue);
        }
    }

    /**
     * Update willpower
     */
    async _updateWillpower(type, value) {
        const updateData = {};
        let finalValueForVisuals;
        let tempValueForVisuals;
        
        if (type === 'temporary') {
            // Temporary willpower cannot exceed permanent
            const maxValue = this.actor.system.miscellaneous.willpower.permanent;
            const newValue = Math.min(Math.max(value, 0), maxValue);
            
            updateData[`system.miscellaneous.willpower.temporary`] = newValue;
            finalValueForVisuals = newValue;
            
            if (value > maxValue) {
                ui.notifications.warn("Temporary Willpower cannot exceed Permanent Willpower.");
            }
        } else if (type === 'permanent') {
            // When reducing permanent, also reduce temporary if it exceeds new permanent
            const newPermanent = Math.min(Math.max(value, 0), 10);
            const currentTemporary = this.actor.system.miscellaneous.willpower.temporary;
            
            updateData[`system.miscellaneous.willpower.permanent`] = newPermanent;
            finalValueForVisuals = newPermanent;
            
            // If temporary exceeds new permanent, reduce it
            if (currentTemporary > newPermanent) {
                updateData[`system.miscellaneous.willpower.temporary`] = newPermanent;
                tempValueForVisuals = newPermanent;
                ui.notifications.warn(`Temporary Willpower reduced to match new Permanent value (${newPermanent}).`);
            }
        }
        
        await this.actor.update(updateData, { render: false });
        
        // Update visual dots for the type being changed
        const container = this.element.find(`.dot-container[data-willpower="${type}"]`)[0];
        if (container) {
            this._updateDotVisuals(container, finalValueForVisuals);
        }
        
        // If we also updated temporary when changing permanent, update its visuals too
        if (type === 'permanent' && tempValueForVisuals !== undefined) {
            const tempContainer = this.element.find(`.dot-container[data-willpower="temporary"]`)[0];
            if (tempContainer) {
                this._updateDotVisuals(tempContainer, tempValueForVisuals);
            }
        }
        
        // Update the willpower label's data-value (permanent only)
        if (type === 'permanent') {
            const label = this.element.find(`.trait-label[data-category="willpower"]`)[0];
            if (label) {
                label.setAttribute('data-value', finalValueForVisuals);
            }
        }
    }

    /**
     * Update a merit value
     * Update entire merits array to prevent form processing corruption
     */
    async _updateMerit(index, value) {
        let merits = foundry.utils.duplicate(this.actor.system.miscellaneous.merits);
        if (!Array.isArray(merits)) {
            console.warn("Merits was not an array, resetting");
            merits = [];
        }
        
        if (merits[index]) {
            const newValue = Math.min(Math.max(value, 1), 7);
            merits[index].value = newValue;
            
            // Update the actor data
            await this.actor.update({ "system.miscellaneous.merits": merits }, { render: false });
            
            // Manually update the hidden input in the DOM
            const container = this.element.find(`[data-merit="${index}"]`)[0];
            if (container) {
                const input = container.querySelector('.dot-input');
                if (input) {
                    input.value = newValue;
                }
            }
        }
    }

    /**
     * Update a flaw value
     * Update entire flaws array to prevent form processing corruption
     */
    async _updateFlaw(index, value) {
        let flaws = foundry.utils.duplicate(this.actor.system.miscellaneous.flaws);
        if (!Array.isArray(flaws)) {
            console.warn("Flaws was not an array, resetting");
            flaws = [];
        }
        
        if (flaws[index]) {
            const newValue = Math.min(Math.max(value, 1), 7);
            flaws[index].value = newValue;
            
            // Update the actor data
            await this.actor.update({ "system.miscellaneous.flaws": flaws }, { render: false });
            
            // Manually update the hidden input in the DOM
            const container = this.element.find(`[data-flaw="${index}"]`)[0];
            if (container) {
                const input = container.querySelector('.dot-input');
                if (input) {
                    input.value = newValue;
                }
            }
        }
    }

    /**
     * Update a background value
     */
    async _updateBackground(index, value) {
        // Get the full backgrounds array and update the specific entry
        const currentBackgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        
        // CRITICAL: Validate that backgrounds is an array before proceeding
        if (!Array.isArray(currentBackgrounds)) {
            console.error(`Actor ${this.actor.name}: backgrounds is not an array! Type: ${typeof currentBackgrounds}`);
            ui.notifications.error('Background data corruption detected. Please reload the actor sheet.');
            return;
        }
        
        const backgrounds = foundry.utils.duplicate(currentBackgrounds);
        
        if (backgrounds[index]) {
            const backgroundName = backgrounds[index].name;
            const newValue = Math.min(Math.max(value, 0), 5);
            backgrounds[index].value = newValue;
            
            // Also update any expanded backgrounds with the same name
            const backgroundsExpanded = foundry.utils.duplicate(
                Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
            );
            
            let expandedUpdated = false;
            backgroundsExpanded.forEach((bg) => {
                if (bg.backgroundName === backgroundName) {
                    bg.backgroundRating = newValue;
                    expandedUpdated = true;
                }
            });
            
            // Update both arrays
            const updateData = {
                "system.miscellaneous.backgrounds": backgrounds
            };
            
            if (expandedUpdated) {
                updateData["system.backgroundsExpanded"] = backgroundsExpanded;
            }
            
            // Capture scroll position before update
            const sheetBody = this.element.find('.sheet-body');
            const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
            
            // If we're updating expanded backgrounds, allow a render so the UI updates
            // Otherwise, skip render to avoid scroll jumping in Main tab
            if (expandedUpdated) {
                await this.actor.update(updateData);
                
                // Restore scroll position after render
                setTimeout(() => {
                    const newSheetBody = this.element.find('.sheet-body');
                    if (newSheetBody.length) {
                        newSheetBody.scrollTop(scrollPos);
                    }
                }, 0);
            } else {
                await this.actor.update(updateData, { render: false });
                
                // Update visual dots
                const container = this.element.find(`.dot-container[data-background="${index}"]`)[0];
                if (container) {
                    this._updateDotVisuals(container, newValue);
                }
                
                // Update the rollable label's data-value if locked
                const bgItem = this.element.find(`.dot-container[data-background="${index}"]`).closest('.background-item');
                const bgLabel = bgItem.find('.trait-label[data-category="background"]')[0];
                if (bgLabel) {
                    bgLabel.setAttribute('data-value', newValue);
                }
            }
        }
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
     * Handle clicking on wheel boxes (unified Quintessence/Paradox handler)
     * NEW SIMPLIFIED LOGIC:
     * - First click determines type based on position (left=Q, right=P)
     * - Subsequent clicks add the same type as last time
     * - Paradox can invade Quintessence area
     * - Quintessence cannot invade Paradox area
     * @param {Event} event
     * @private
     */
    async _onWheelBoxClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position before update
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const box = event.currentTarget;
        const index = parseInt(box.dataset.index);
        
        // DEQUE APPROACH: Use arrays of filled indices
        // Ensure values are numbers, not strings
        const quintessenceCount = Number(this.actor.system.advantages.primalEnergy.current) || 0;
        const permanentParadox = this._getEnhancementParadox();
        const currentParadox = Number(this.actor.system.advantages.paradox.current) || 0;
        const totalParadox = permanentParadox + currentParadox;
        
        // Build deque arrays
        // Quintessence fills from LEFT: [0, 1, 2, 3...]
        const quintessenceIndices = Array.from({length: quintessenceCount}, (_, i) => i);
        // Paradox fills from RIGHT: [19, 18, 17, 16...]
        const paradoxIndices = Array.from({length: totalParadox}, (_, i) => 19 - i);
        
        // Get last added type
        const lastAddedType = this.actor.getFlag('wodsystem', 'lastWheelAddType') || null;
        
        // Check what's at this index
        const hasQuintessence = quintessenceIndices.includes(index);
        const hasParadox = paradoxIndices.includes(index);
        const hasOverlap = hasQuintessence && hasParadox;
        
        console.log(`Click box ${index}:`, { quintessenceCount, totalParadox, hasQuintessence, hasParadox, hasOverlap, lastAddedType });
        
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
                    title: "Add Paradox?",
                    content: "<p>The wheel is full. Do you want to <strong>add Paradox</strong> (which will cancel this Quintessence)?</p><p>Click <strong>No</strong> to spend/remove this Quintessence instead.</p>",
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
                    await this.actor.setFlag('wodsystem', 'lastWheelAddType', 'paradox');
                    
                    if (overlap > 0) {
                        ui.notifications.info(`Paradox cancelled ${overlap} point(s) of Quintessence`);
                    }
                } else {
                    // Remove Quintessence (spending it)
                    await this.actor.update({
                        'system.advantages.primalEnergy.current': index
                    }, { render: false });
                }
            } else {
                // Normal removal - not full
                await this.actor.update({
                    'system.advantages.primalEnergy.current': index
                }, { render: false });
            }
        }
        else if (hasParadox) {
            // Calculate how many Paradox points from the right
            const paradoxIndex = 19 - index;
            
            // Can't remove permanent Paradox
            if (paradoxIndex < permanentParadox) {
                ui.notifications.warn("Cannot remove permanent Paradox (right-click to modify)");
                return;
            }
            
            // Always remove Paradox (no dialog, even when full)
            await this.actor.update({
                'system.advantages.paradox.current': Math.max(0, paradoxIndex - permanentParadox)
            }, { render: false });
        }
        // CLICKING EMPTY: Add to deque
        else {
            // SPECIAL: If only 1 empty box remains, ask which type to add
            const onlyOneEmpty = (quintessenceCount + totalParadox) === 19;
            let typeToAdd;
            
            if (onlyOneEmpty) {
                // Show dialog to choose type
                typeToAdd = await Dialog.wait({
                    title: "Last Box",
                    content: "<p>Only one box remains empty. What would you like to add?</p>",
                    buttons: {
                        quintessence: {
                            icon: '<i class="fas fa-check"></i>',
                            label: "Quintessence",
                            callback: () => 'quintessence'
                        },
                        paradox: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "Paradox",
                            callback: () => 'paradox'
                        }
                    },
                    default: "quintessence"
                });
                
                if (!typeToAdd) return; // User closed dialog
            } else {
                // Normal type determination
                // Determine type based on sequential fill pattern, not visual position
                // Quintessence fills from left (0, 1, 2...), Paradox fills from right (19, 18, 17...)
                const quintessenceStart = 0;
                const paradoxStart = 19;
                const distanceToQuintessence = Math.abs(index - quintessenceCount);
                const distanceToParadox = Math.abs(index - (19 - totalParadox));
                
                // If clicking the expected next box for that type, use that type
                const isNextQuintessence = index === quintessenceCount;
                const isNextParadox = index === (19 - totalParadox);
                
                if (isNextQuintessence && !isNextParadox) {
                    typeToAdd = 'quintessence';
                } else if (isNextParadox && !isNextQuintessence) {
                    typeToAdd = 'paradox';
                } else if (isNextQuintessence && isNextParadox) {
                    // Both are valid next - use last type, or default to quintessence
                    typeToAdd = lastAddedType || 'quintessence';
                } else {
                    // Not a valid next box for either - determine by which sequential position is closer
                    // If closer to quintessence fill position, prefer quintessence
                    // If closer to paradox fill position, prefer paradox
                    if (distanceToQuintessence < distanceToParadox) {
                        typeToAdd = 'quintessence';
                    } else if (distanceToParadox < distanceToQuintessence) {
                        typeToAdd = 'paradox';
                    } else {
                        // Equal distance - use last type or default to quintessence
                        typeToAdd = lastAddedType || 'quintessence';
                    }
                }
            }
            
            if (typeToAdd === 'quintessence') {
                // Must add sequentially from left
                if (index !== quintessenceCount) {
                    ui.notifications.warn("Must add Quintessence sequentially from box 0");
                    return;
                }
                
                // STRICT: Quintessence CANNOT invade Paradox territory
                // Check if this box OR any box we'd fill would overlap with Paradox
                const newQuintessenceCount = quintessenceCount + 1;
                const paradoxStartIndex = 20 - totalParadox;
                
                if (newQuintessenceCount > paradoxStartIndex) {
                    ui.notifications.warn("Cannot add Quintessence - blocked by Paradox");
                    return;
                }
                
                await this.actor.update({
                    'system.advantages.primalEnergy.current': newQuintessenceCount
                }, { render: false });
                await this.actor.setFlag('wodsystem', 'lastWheelAddType', 'quintessence');
            }
            else { // paradox
                // Must add sequentially from right
                const expectedIndex = 19 - totalParadox;
                if (index !== expectedIndex) {
                    ui.notifications.warn("Must add Paradox sequentially from box 19");
                    return;
                }
                
                // Add Paradox - can cancel Quintessence
                const newTotalParadox = totalParadox + 1;
                let newQuintessence = quintessenceCount;
                
                // Check overlap
                if ((newQuintessence + newTotalParadox) > 20) {
                    const overlap = (newQuintessence + newTotalParadox) - 20;
                    newQuintessence = Math.max(0, newQuintessence - overlap);
                    
                    if (overlap > 0) {
                        ui.notifications.info(`Paradox cancelled ${overlap} point(s) of Quintessence`);
                    }
                }
                
                await this.actor.update({
                    'system.advantages.paradox.current': newTotalParadox - permanentParadox,
                    'system.advantages.primalEnergy.current': newQuintessence
                }, { render: false });
                await this.actor.setFlag('wodsystem', 'lastWheelAddType', 'paradox');
            }
        }
        
        // Update visuals
        this._updateQuintessenceParadoxVisuals();
        
        // Restore scroll position after update
        setTimeout(() => {
            const newSheetBody = this.element.find('.sheet-body');
            if (newSheetBody.length) {
                newSheetBody.scrollTop(scrollPos);
            }
        }, 0);
    }
    
    /**
     * Request ST approval for removing permanent Paradox
     * @returns {Promise<boolean>} True if approved, false if denied
     * @private
     */
    async _requestSTApprovalForParadoxRemoval() {
        // If current user is GM, auto-approve
        if (game.user.isGM) {
            return true;
        }

        // Find the first connected GM
        const gm = game.users.find(u => u.isGM && u.active);
        
        if (!gm) {
            ui.notifications.warn("No Storyteller online to approve permanent Paradox removal!");
            return false;
        }

        // Create a unique request ID
        const requestId = `paradox-removal-${this.actor.id}-${Date.now()}`;

        // Create chat message with approval buttons
        const messageContent = `
            <div class="wod-approval-request" data-request-id="${requestId}">
                <h3 style="margin: 0 0 10px 0; color: #9C27B0; border-bottom: 2px solid #9C27B0; padding-bottom: 5px;">
                    <i class="fas fa-exclamation-triangle"></i> Paradox Removal Request
                </h3>
                <p style="margin: 8px 0;">
                    <strong>${game.user.name}</strong> wants to remove a permanent Paradox point from <strong>${this.actor.name}</strong>.
                </p>
                <div style="display: flex; gap: 10px; margin-top: 12px;" class="approval-buttons">
                    <button class="approve-paradox-btn" data-request-id="${requestId}" style="flex: 1; background: linear-gradient(135deg, #2ECC71, #27AE60); color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="deny-paradox-btn" data-request-id="${requestId}" style="flex: 1; background: linear-gradient(135deg, #E74C3C, #C0392B); color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        <i class="fas fa-times"></i> Deny
                    </button>
                </div>
            </div>
        `;

        // Send whisper to GM ONLY
        await ChatMessage.create({
            content: messageContent,
            whisper: [gm.id],
            speaker: { alias: "WoD System" },
            style: CONST.CHAT_MESSAGE_STYLES.WHISPER
        });

        ui.notifications.info("Approval request sent to Storyteller. Waiting for response...");

        // Wait for response via hook
        return new Promise((resolve) => {
            let timeoutId;
            
            const hookId = Hooks.on('wodParadoxRemovalResponse', (data) => {
                if (data.requestId === requestId) {
                    Hooks.off('wodParadoxRemovalResponse', hookId);
                    clearTimeout(timeoutId); // Clear the timeout
                    
                    if (data.approved) {
                        ui.notifications.success("Storyteller approved permanent Paradox removal");
                    } else {
                        ui.notifications.info("Storyteller denied permanent Paradox removal");
                    }
                    
                    resolve(data.approved);
                }
            });

            // Timeout after 60 seconds
            timeoutId = setTimeout(() => {
                Hooks.off('wodParadoxRemovalResponse', hookId);
                ui.notifications.error("ST approval request timed out");
                resolve(false);
            }, 60000);
        });
    }
    
    /**
     * Handle right-clicking on wheel boxes (add/remove permanent Paradox)
     * SEQUENTIAL: Must add from box 19 going counter-clockwise
     * @param {Event} event
     * @private
     */
    async _onWheelBoxRightClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Store scroll position before update
        const sheetBody = this.element.find('.sheet-body');
        const scrollPos = sheetBody.length ? sheetBody.scrollTop() : 0;
        
        const box = event.currentTarget;
        const index = parseInt(box.dataset.index);
        
        // Get current permanent Paradox (from Enhancement background)
        const permanentParadox = this._getEnhancementParadox();
        
        // Build array of permanent Paradox indices: [19, 18, 17, ...]
        const permanentParadoxIndices = Array.from({length: permanentParadox}, (_, i) => 19 - i);
        
        // Check if this box has permanent Paradox
        const hasPermanentParadox = permanentParadoxIndices.includes(index);
        
        // Expected next permanent Paradox box (must be sequential)
        const expectedNextIndex = 19 - permanentParadox;
        
        let newPermanentParadox;
        
        if (hasPermanentParadox) {
            // REMOVE: Can only remove the last added permanent Paradox
            const lastPermanentIndex = 19 - (permanentParadox - 1);
            
            if (index !== lastPermanentIndex) {
                ui.notifications.warn("Can only remove the last permanent Paradox point");
                return;
            }
            
            // Permanent Paradox removal REQUIRES ST APPROVAL
            const approved = await this._requestSTApprovalForParadoxRemoval();
            
            if (!approved) {
                return;
            }
            
            newPermanentParadox = permanentParadox - 1;
        } else {
            // ADD: Must be the next sequential box
            if (index !== expectedNextIndex) {
                ui.notifications.warn(`Must add permanent Paradox sequentially from box 19 (next: box ${expectedNextIndex})`);
                return;
            }
            
            newPermanentParadox = permanentParadox + 1;
        }
        
        // Update Enhancement background value
        const backgrounds = foundry.utils.duplicate(this.actor.system.miscellaneous.backgrounds || []);
        const enhancementIndex = backgrounds.findIndex(bg => bg.name === 'Enhancement');
        
        if (enhancementIndex >= 0) {
            backgrounds[enhancementIndex].value = newPermanentParadox;
        } else if (newPermanentParadox > 0) {
            // Create Enhancement background if it doesn't exist
            backgrounds.push({
                name: 'Enhancement',
                value: newPermanentParadox,
                locked: false
            });
        }
        
        await this.actor.update({
            'system.miscellaneous.backgrounds': backgrounds
        }, { render: false });
        
        // Update visuals
        this._updateQuintessenceParadoxVisuals();
        
        // Restore scroll position
        setTimeout(() => {
            const newSheetBody = this.element.find('.sheet-body');
            if (newSheetBody.length) {
                newSheetBody.scrollTop(scrollPos);
            }
        }, 0);
    }

    /**
     * Get Avatar rating from backgrounds
     * @returns {number}
     * @private
     */
    _getAvatarRating() {
        const backgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        const avatarBg = backgrounds.find(bg => 
            bg.name === 'Avatar' || bg.name === 'Avatar/ Genius' || bg.name === 'Genius'
        );
        return avatarBg ? (avatarBg.value || 0) : 0;
    }

    /**
     * Get Enhancement Paradox from backgrounds
     * @returns {number}
     * @private
     */
    _getEnhancementParadox() {
        const backgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        const enhancementBg = backgrounds.find(bg => bg.name === 'Enhancement');
        return enhancementBg ? (enhancementBg.value || 0) : 0;
    }

    /**
     * Manually update Quintessence/Paradox wheel visuals without full re-render
     * @private
     */
    _updateQuintessenceParadoxVisuals() {
        const permanentQuintessence = 0; // No permanent Quintessence
        const currentQuintessence = this.actor.system.advantages.primalEnergy.current || 0;
        const totalQuintessence = currentQuintessence;
        
        const permanentParadox = this._getEnhancementParadox();
        const currentParadox = this.actor.system.advantages.paradox.current || 0;
        const totalParadox = permanentParadox + currentParadox;
        
        const paradoxStartIndex = 20 - totalParadox;
        
        // Update all wheel boxes
        this.element.find('.wheel-box').each((i, box) => {
            const $box = $(box);
            const index = parseInt($box.data('index'));
            
            // Clear all classes first
            $box.removeClass('quintessence paradox permanent current cancelled disabled');
            $box.html('');
            
            // Check if this box is in the overlap zone (Paradox cancels Quintessence)
            const isInQuintessenceZone = index < totalQuintessence;
            const isInParadoxZone = index >= paradoxStartIndex;
            const isOverlap = isInQuintessenceZone && isInParadoxZone;
            
            // PARADOX ALWAYS WINS IN OVERLAP
            if (isOverlap) {
                // This box has Paradox that cancelled Quintessence
                const paradoxIndex = 19 - index;
                $box.addClass('paradox cancelled');
                
                // Permanent Paradox
                if (paradoxIndex < permanentParadox) {
                    $box.addClass('permanent');
                    $box.html('✗');
                }
                // Current Paradox (cancelling Quintessence)
                else {
                    $box.addClass('current');
                    $box.html('✗');
                }
            }
            // Paradox zone ONLY (not overlapping)
            else if (isInParadoxZone) {
                const paradoxIndex = 19 - index;
                $box.addClass('paradox');
                
                // Permanent Paradox
                if (paradoxIndex < permanentParadox) {
                    $box.addClass('permanent');
                    $box.html('✗');
                }
                // Current Paradox
                else {
                    $box.addClass('current');
                    $box.html('✗');
                }
            }
            // Quintessence zone ONLY (not overlapped by Paradox)
            else if (isInQuintessenceZone) {
                $box.addClass('quintessence current');
                $box.html('✓');
            }
            // Empty zone (between Quintessence and Paradox)
            else {
                // Just leave it empty - it's clickable for adding either
            }
        });
    }

    /**
     * Update a secondary ability value (uses arrays like merits)
     */
    async _updateSecondaryAbility(category, index, value) {
        let abilities = foundry.utils.duplicate(this.actor.system.secondaryAbilities[category] || []);
        if (!Array.isArray(abilities)) {
            console.warn("Secondary abilities was not an array, resetting");
            abilities = [];
        }
        
        // Ensure the ability exists at this index
        if (index >= 0 && index < abilities.length && abilities[index]) {
            const newValue = Math.min(Math.max(value, 0), 5);
            abilities[index].value = newValue;
            
            // Update the actor data
            await this.actor.update({ [`system.secondaryAbilities.${category}`]: abilities }, { render: false });
            
            // Manually update the hidden input in the DOM
            const container = this.element.find(`.dot-container[data-secondary-ability="${category}"][data-secondary-index="${index}"]`)[0];
            if (container) {
                const input = container.querySelector('.dot-input');
                if (input) {
                    input.value = newValue;
                }
            }
            
            // Update the trait-label's data-value attribute for roll system
            const abilityInput = this.element.find(`.ability-name-input[data-secondary-category="${category}"][data-index="${index}"]`)[0];
            if (abilityInput && abilityInput.classList.contains('trait-label')) {
                abilityInput.setAttribute('data-value', newValue);
            }
        }
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
        return parseInt(input?.value) || 0;
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
        // Same issue applies to secondaryAbilities - dots handle updates directly.
        const fieldName = event?.target?.name ?? "";
        const targetClass = event?.target?.className ?? "";
        
        if (fieldName.startsWith("system.miscellaneous.backgrounds.")) {
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) newSheetBody.scrollTop(scrollPos);
            }, 0);
            return;
        }
        
        // Ignore merits and flaws - they're handled by dedicated handlers to prevent array corruption
        if (fieldName.startsWith("system.miscellaneous.merits.") || 
            fieldName.startsWith("system.miscellaneous.flaws.")) {
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) newSheetBody.scrollTop(scrollPos);
            }, 0);
            return;
        }
        
        // Ignore secondary abilities - they use object keys for names, handled by dedicated handlers
        if (fieldName.startsWith("system.secondaryAbilities.")) {
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) newSheetBody.scrollTop(scrollPos);
            }, 0);
            return;
        }
        
        // Ignore backgroundsExpanded fields - they're handled by dedicated handlers or modal
        if (fieldName.startsWith("system.backgroundsExpanded.")) {
            setTimeout(() => {
                const newSheetBody = this.element.find('.sheet-body');
                if (newSheetBody.length) newSheetBody.scrollTop(scrollPos);
            }, 0);
            return;
        }
        
        // Ignore modal selects - they have their own handlers
        if (targetClass.includes("select-bg-category") || 
            targetClass.includes("select-background-to-expand")) {
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
        
        // Sync Quintessence/Paradox wheel if it exists
        if (this.element.find('.wheel-box').length > 0) {
            this._updateQuintessenceParadoxVisuals();
        }
        
        // Sync all dot containers (visual dots only, labels are updated separately)
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
        
        // Sync background select elements with their data-selected-value
        const backgroundSelects = this.element.find('.background-name-select[data-selected-value]');
        backgroundSelects.each((index, select) => {
            const selectedValue = select.dataset.selectedValue;
            if (selectedValue) {
                $(select).val(selectedValue);
            }
        });
    }

    /**
     * Categorize expanded backgrounds by their background name
     * Each background becomes its own category
     */
    _categorizeExpandedBackgrounds(backgroundsExpanded) {
        if (!Array.isArray(backgroundsExpanded)) {
            return [];
        }
        
        // Dynamically create categories based on background names
        const categories = {};
        
        backgroundsExpanded.forEach((bg, index) => {
            const categoryName = bg.backgroundName || "Other";
            
            // Create category if it doesn't exist
            if (!categories[categoryName]) {
                categories[categoryName] = [];
            }
            
            // Add background to its category
            categories[categoryName].push({ ...bg, actualIndex: index });
        });
        
        // Convert to array format for template
        return Object.entries(categories)
            .map(([name, items]) => ({ name, items }));
    }

    /**
     * Determine which template to use for a background
     */
    _getBackgroundTemplate(backgroundName) {
        const templates = {
            "Sanctum": "sanctum",
            "Laboratory": "sanctum",
            "Chantry": "sanctum",
            "Construct": "construct",
            "Mentor": "mentor",
            "Allies": "allies",
            "Contacts": "contacts",
            "Resources": "resources",
            "Familiar": "familiar",
            "Companion": "familiar",
            "Device": "device",
            "Enhancement": "enhancement",
            "Enhancements": "enhancement",
            "Wonder": "wonder",
            "Wonder (Device/ Fetish/ Talisman, etc.)": "wonder"
        };
        return templates[backgroundName] || "custom";
    }

    /**
     * Get default data for a template type
     */
    _getDefaultTemplateData(template) {
        switch (template) {
            case "sanctum":
                return { location: "", size: 0, securityLevel: 5, wardsDefenses: "", resourcesAvailable: "", rooms: "" };
            case "construct":
                return { location: "", size: 0, securityLevel: 5, securitySystems: "", equipmentAvailable: "", facilities: "" };
            case "mentor":
                return { mentorName: "", convention: "", relationshipLevel: 3, contactFrequency: "monthly", teachings: "", notes: "" };
            case "allies":
                return { npcs: [] };
            case "contacts":
                return { npcs: [] };
            case "resources":
                return { incomeLevel: "comfortable", liquidCash: "", properties: [], assets: [] };
            case "familiar":
                return { name: "", species: "", physicalDescription: "", physical: 1, social: 1, mental: 1, abilities: "", bondStrength: 3, personality: "" };
            case "device":
                return { name: "", description: "", spheres: "", effects: "", arete: 0, paradoxRisk: 0, quintessence: 0 };
            case "enhancement":
                return { name: "", description: "", location: "", enhancementType: "cybernetic", permanentParadox: 0, geneticFlaws: "", effects: "", sideEffects: "", gameMechanics: "" };
            case "wonder":
                return { name: "", description: "", spheres: "", powers: "", gameMechanics: "", arete: 0, paradoxType: "none", paradoxValue: 0, quintessenceStorage: 0, quintessenceBurnedPerUse: 0 };
            case "custom":
                return { description: "", mechanics: "", notes: "" };
            default:
                return { description: "", mechanics: "", notes: "" };
        }
    }

    /**
     * Toggle category section collapse/expand
     */
    _onToggleCategory(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const header = event.currentTarget.closest('.bg-category-header');
        const category = header.dataset.category;
        const content = this.element.find(`.bg-category-content[data-category="${category}"]`);
        const icon = header.querySelector('.category-toggle');
        
        content.slideToggle(200);
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-right');
    }

    /**
     * Open modal for adding new expanded background
     */
    _onOpenAddModal(event) {
        event.preventDefault();
        const modal = this.element.find('.bg-modal-overlay');
        const modalTitle = modal.find('.bg-modal-title');
        
        // Clear edit index data
        modal.removeData('editIndex');
        
        // Reset modal state
        modalTitle.text('Add Expanded Background');
        modal.find('.bg-modal-step-category').show();
        modal.find('.bg-modal-step-background').hide();
        modal.find('.bg-modal-form').hide();
        modal.find('.save-bg-modal').hide();
        
        const backgrounds = this.actor.system.miscellaneous?.backgrounds || [];
        
        // Dynamically populate category dropdown with unique background names
        const categorySelect = modal.find('.select-bg-category');
        categorySelect.find('option[value!=""]').remove(); // Clear existing except placeholder
        
        const uniqueCategories = new Set();
        backgrounds.forEach(bg => {
            if (bg.name) {
                uniqueCategories.add(bg.name);
            }
        });
        
        // Add each unique background as a category option
        Array.from(uniqueCategories).sort().forEach(category => {
            categorySelect.append(
                $('<option></option>')
                    .attr('value', category)
                    .text(category)
            );
        });
        
        categorySelect.val('');
        
        // Refresh background options with current data
        const bgSelect = modal.find('.select-background-to-expand');
        bgSelect.find('option[value!=""]').remove();
        
        // Add current backgrounds
        backgrounds.forEach(bg => {
            if (bg.name) {
                bgSelect.append(
                    $('<option></option>')
                        .attr('value', bg.name)
                        .attr('data-rating', bg.value)
                        .attr('data-category', bg.name)
                        .text(`${bg.name} (${bg.value} dots)`)
                );
            }
        });
        
        bgSelect.val('');
        
        // Show modal
        modal.fadeIn(200);
    }

    /**
     * Close modal
     */
    _onCloseModal(event) {
        event.preventDefault();
        const modal = this.element.find('.bg-modal-overlay');
        
        // Clear edit index data
        modal.removeData('editIndex');
        
        modal.fadeOut(200);
    }

    /**
     * Handle category selection in modal
     */
    _onModalCategorySelect(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const category = event.currentTarget.value;
        const modal = this.element.find('.bg-modal-overlay');
        const bgSelect = modal.find('.select-background-to-expand');
        const bgStep = modal.find('.bg-modal-step-background');
        
        if (!category) {
            bgStep.hide();
            modal.find('.bg-modal-form').hide();
            modal.find('.save-bg-modal').hide();
            return;
        }
        
        // Filter backgrounds by category
        bgSelect.find('option').each(function() {
            const option = $(this);
            const optionCategory = option.data('category');
            if (option.val() === '') {
                option.show(); // Keep the placeholder
            } else if (optionCategory === category || category === "Other") {
                option.show();
            } else {
                option.hide();
            }
        });
        
        bgSelect.val('');
        bgStep.show();
        modal.find('.bg-modal-form').hide();
        modal.find('.save-bg-modal').hide();
    }

    /**
     * Handle background selection in modal
     */
    async _onModalBackgroundSelect(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const select = event.currentTarget;
        const backgroundName = select.value;
        const backgroundRating = parseInt(select.selectedOptions[0]?.dataset.rating || 0);
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        
        if (!backgroundName) {
            formContainer.hide();
            modal.find('.save-bg-modal').hide();
            return;
        }
        
        // Get template type and generate form
        const template = this._getBackgroundTemplate(backgroundName);
        const templateData = this._getDefaultTemplateData(template);
        
        // Store data for save
        modal.data('selectedBackground', {
            name: backgroundName,
            rating: backgroundRating,
            template: template,
            templateData: templateData
        });
        
        // Render form
        const formHTML = await this._renderBackgroundForm(template, templateData, -1);
        formContainer.html(formHTML);
        formContainer.show();
        modal.find('.save-bg-modal').show();
        
        // Initialize genetic flaws field visibility
        this._initializeGeneticFlawsVisibility();
    }

    /**
     * Render background form template
     */
    async _renderBackgroundForm(template, data, index) {
        const partialPath = `systems/wodsystem/templates/actor/partials/backgrounds/bg-${template}.html`;
        const context = { 
            data: data, 
            index: index,
            isEditMode: index >= 0  // Edit mode if index is valid, add mode if -1
        };
        
        try {
            return await foundry.applications.handlebars.renderTemplate(partialPath, context);
        } catch (error) {
            console.error("Error rendering background form:", error);
            return `<p>Template not found for: ${template}</p>`;
        }
    }

    /**
     * Save background from modal
     */
    async _onSaveModalBackground(event) {
        event.preventDefault();
        const modal = this.element.find('.bg-modal-overlay');
        const selectedBg = modal.data('selectedBackground');
        const editIndex = modal.data('editIndex');
        
        if (!selectedBg && (editIndex === null || editIndex === undefined)) return;
        
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (editIndex !== null && editIndex !== undefined) {
            // Edit mode - extract form data directly from modal form elements
            const updatedTemplateData = {};
            
            // Find all input, textarea, and select elements in the modal form
            const formElements = modal.find('.bg-modal-form input, .bg-modal-form textarea, .bg-modal-form select');
            
            formElements.each((i, element) => {
                const name = element.name;
                if (!name || !name.startsWith(`system.backgroundsExpanded.${editIndex}.templateData.`)) return;
                
                const value = element.type === 'checkbox' ? element.checked : element.value;
                const fieldPath = name.replace(`system.backgroundsExpanded.${editIndex}.templateData.`, '');
                
                // Handle nested paths (e.g., npcs.0.name)
                const pathParts = fieldPath.split('.');
                let current = updatedTemplateData;
                
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    const nextPart = pathParts[i + 1];
                    
                    if (!isNaN(nextPart)) {
                        // Next part is an array index
                        if (!current[part]) current[part] = [];
                    } else {
                        // Next part is an object key
                        if (!current[part]) current[part] = {};
                    }
                    current = current[part];
                }
                
                const lastPart = pathParts[pathParts.length - 1];
                current[lastPart] = value;
            });
            
            // Update the existing entry with new template data
            backgroundsExpanded[editIndex].templateData = updatedTemplateData;
            
            await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded });
            modal.removeData('editIndex');
            modal.fadeOut(200);
        } else {
            // Add mode - create new entry, extract form data
            const newTemplateData = {};
            const formElements = modal.find('.bg-modal-form input, .bg-modal-form textarea, .bg-modal-form select');
            
            console.log("WoD | Found", formElements.length, "form elements");
            
            formElements.each((i, element) => {
                const name = element.name;
                if (!name || !name.includes('templateData.')) return;
                
                const value = element.type === 'checkbox' ? element.checked : element.value;
                const fieldPath = name.substring(name.indexOf('templateData.') + 'templateData.'.length);
                
                console.log(`WoD | Extracting field: ${fieldPath} = "${value}"`);
                
                // Handle nested paths (e.g., npcs.0.name)
                const pathParts = fieldPath.split('.');
                let current = newTemplateData;
                
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    const nextPart = pathParts[i + 1];
                    
                    if (!isNaN(nextPart)) {
                        // Next part is an array index
                        if (!current[part]) current[part] = [];
                    } else {
                        // Next part is an object key
                        if (!current[part]) current[part] = {};
                    }
                    current = current[part];
                }
                
                const lastPart = pathParts[pathParts.length - 1];
                current[lastPart] = value;
            });
            
            console.log("WoD | New Wonder data being saved:", JSON.stringify(newTemplateData, null, 2));
            
            const newExpanded = {
                backgroundName: selectedBg.name,
                backgroundRating: selectedBg.rating,
                template: selectedBg.template,
                templateData: newTemplateData,
                customFields: []
            };
            
            backgroundsExpanded.push(newExpanded);
            await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded });
            modal.fadeOut(200);
        }
    }

    /**
     * Edit existing expanded background
     */
    async _onEditBgExpanded(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const index = parseInt(event.currentTarget.dataset.index);
        const backgroundsExpanded = this.actor.system.backgroundsExpanded;
        
        if (!backgroundsExpanded || !backgroundsExpanded[index]) return;
        
        const bg = backgroundsExpanded[index];
        const modal = this.element.find('.bg-modal-overlay');
        const modalTitle = modal.find('.bg-modal-title');
        const formContainer = modal.find('.bg-modal-form');
        
        // Store edit index directly on modal (no flags needed)
        modal.data('editIndex', index);
        
        // Update modal title
        modalTitle.text(`Edit ${bg.backgroundName}`);
        
        // Hide category selection steps
        modal.find('.bg-modal-step-category').hide();
        modal.find('.bg-modal-step-background').hide();
        
        // Render form with existing data
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, index);
        formContainer.html(formHTML);
        formContainer.show();
        modal.find('.save-bg-modal').show();
        
        // Initialize genetic flaws field visibility
        this._initializeGeneticFlawsVisibility();
        
        // Show modal
        modal.fadeIn(200);
    }

    /**
     * Show preview tooltip on hover
     */
    _onShowBgPreview(event) {
        const card = event.currentTarget;
        const index = parseInt(card.dataset.index);
        const backgroundsExpanded = this.actor.system.backgroundsExpanded;
        
        if (!backgroundsExpanded || !backgroundsExpanded[index]) return;
        
        const bg = backgroundsExpanded[index];
        const tooltip = this.element.find('.bg-preview-tooltip');
        
        // Generate summary
        let summary = `<strong>${bg.backgroundName}</strong> (${bg.backgroundRating} dots)<br/>`;
        summary += `<em>Type: ${bg.template}</em><br/>`;
        
        // Special handling for Wonder template
        if (bg.template === "wonder" && bg.templateData) {
            console.log("WoD | Wonder tooltip data:", JSON.stringify(bg.templateData, null, 2));
            console.log("WoD | Has spheres?", !!bg.templateData.spheres, bg.templateData.spheres);
            console.log("WoD | Has powers?", !!bg.templateData.powers, bg.templateData.powers);
            console.log("WoD | Has gameMechanics?", !!bg.templateData.gameMechanics, bg.templateData.gameMechanics);
            summary += `<br/>`; // Add spacing
            
            if (bg.templateData.name && bg.templateData.name.trim()) {
                summary += `<strong>Name:</strong> ${bg.templateData.name}<br/>`;
            }
            if (bg.templateData.arete !== null && bg.templateData.arete !== undefined && bg.templateData.arete !== "") {
                summary += `<strong>Arete:</strong> ${bg.templateData.arete}<br/>`;
            }
            if (bg.templateData.paradoxType && bg.templateData.paradoxType !== "none") {
                const paradoxLabel = bg.templateData.paradoxType === "permanent" ? "Permanent Paradox" : "Paradox Per Use";
                const paradoxValue = bg.templateData.paradoxValue !== null && bg.templateData.paradoxValue !== undefined ? bg.templateData.paradoxValue : 0;
                summary += `<strong>${paradoxLabel}:</strong> ${paradoxValue}<br/>`;
            }
            if (bg.templateData.quintessenceStorage !== null && bg.templateData.quintessenceStorage !== undefined && bg.templateData.quintessenceStorage !== "") {
                summary += `<strong>Quintessence Storage:</strong> ${bg.templateData.quintessenceStorage}<br/>`;
            }
            if (bg.templateData.quintessenceBurnedPerUse !== null && bg.templateData.quintessenceBurnedPerUse !== undefined && bg.templateData.quintessenceBurnedPerUse !== "") {
                summary += `<strong>Quintessence Per Use:</strong> ${bg.templateData.quintessenceBurnedPerUse}<br/>`;
            }
            if (bg.templateData.spheres && bg.templateData.spheres.trim()) {
                const truncatedSpheres = bg.templateData.spheres.length > 50 ? bg.templateData.spheres.substring(0, 47) + '...' : bg.templateData.spheres;
                summary += `<strong>Spheres:</strong> ${truncatedSpheres}<br/>`;
            }
            if (bg.templateData.description && bg.templateData.description.trim()) {
                const truncatedDesc = bg.templateData.description.length > 80 ? bg.templateData.description.substring(0, 77) + '...' : bg.templateData.description;
                summary += `<br/><em>${truncatedDesc}</em><br/>`;
            }
            if (bg.templateData.powers && bg.templateData.powers.trim()) {
                const truncatedPowers = bg.templateData.powers.length > 80 ? bg.templateData.powers.substring(0, 77) + '...' : bg.templateData.powers;
                summary += `<br/><strong>Powers:</strong> ${truncatedPowers}<br/>`;
            }
            if (bg.templateData.gameMechanics && bg.templateData.gameMechanics.trim()) {
                const truncatedMechanics = bg.templateData.gameMechanics.length > 100 ? bg.templateData.gameMechanics.substring(0, 97) + '...' : bg.templateData.gameMechanics;
                summary += `<br/><strong>Game Mechanics:</strong><br/>${truncatedMechanics}`;
            }
        } else if (bg.template === "enhancement" && bg.templateData) {
            // Special handling for Enhancement template
            summary += `<br/>`; // Add spacing
            
            if (bg.templateData.name && bg.templateData.name.trim()) {
                summary += `<strong>Name:</strong> ${bg.templateData.name}<br/>`;
            }
            if (bg.templateData.location && bg.templateData.location.trim()) {
                summary += `<strong>Location:</strong> ${bg.templateData.location}<br/>`;
            }
            if (bg.templateData.enhancementType) {
                const typeLabel = bg.templateData.enhancementType === "cybernetic" ? "Cybernetic" : 
                                 bg.templateData.enhancementType === "biomod" ? "Biomod" : "Genengineered";
                summary += `<strong>Type:</strong> ${typeLabel}<br/>`;
            }
            if (bg.templateData.permanentParadox !== null && bg.templateData.permanentParadox !== undefined && bg.templateData.permanentParadox !== "" && bg.templateData.permanentParadox != 0) {
                summary += `<strong>Permanent Paradox:</strong> ${bg.templateData.permanentParadox}<br/>`;
            }
            if (bg.templateData.geneticFlaws && bg.templateData.geneticFlaws.trim()) {
                const truncatedFlaws = bg.templateData.geneticFlaws.length > 60 ? bg.templateData.geneticFlaws.substring(0, 57) + '...' : bg.templateData.geneticFlaws;
                summary += `<strong>Genetic Flaws:</strong> ${truncatedFlaws}<br/>`;
            }
            if (bg.templateData.description && bg.templateData.description.trim()) {
                const truncatedDesc = bg.templateData.description.length > 80 ? bg.templateData.description.substring(0, 77) + '...' : bg.templateData.description;
                summary += `<br/><em>${truncatedDesc}</em><br/>`;
            }
            if (bg.templateData.effects && bg.templateData.effects.trim()) {
                const truncatedEffects = bg.templateData.effects.length > 80 ? bg.templateData.effects.substring(0, 77) + '...' : bg.templateData.effects;
                summary += `<br/><strong>Effects:</strong> ${truncatedEffects}<br/>`;
            }
            if (bg.templateData.sideEffects && bg.templateData.sideEffects.trim()) {
                const truncatedSide = bg.templateData.sideEffects.length > 60 ? bg.templateData.sideEffects.substring(0, 57) + '...' : bg.templateData.sideEffects;
                summary += `<strong>Side Effects:</strong> ${truncatedSide}<br/>`;
            }
            if (bg.templateData.gameMechanics && bg.templateData.gameMechanics.trim()) {
                const truncatedMechanics = bg.templateData.gameMechanics.length > 100 ? bg.templateData.gameMechanics.substring(0, 97) + '...' : bg.templateData.gameMechanics;
                summary += `<br/><strong>Game Mechanics:</strong><br/>${truncatedMechanics}`;
            }
        } else {
            // Add first non-empty template field for other templates
            if (bg.templateData) {
                for (const [key, value] of Object.entries(bg.templateData)) {
                    if (value && typeof value === 'string' && value.trim().length > 0) {
                        const truncated = value.length > 50 ? value.substring(0, 47) + '...' : value;
                        summary += truncated;
                        break;
                    }
                }
            }
        }
        
        tooltip.html(summary);
        
        // Position tooltip BELOW the card
        const rect = card.getBoundingClientRect();
        const sheetRect = this.element[0].getBoundingClientRect();
        
        tooltip.css({
            top: rect.bottom - sheetRect.top + 5, // 5px below the card
            left: rect.left - sheetRect.left + (rect.width / 2) - (tooltip.outerWidth() / 2),
            display: 'block'
        });
        
        tooltip.fadeIn(150);
    }

    /**
     * Hide preview tooltip
     */
    _onHideBgPreview(event) {
        const tooltip = this.element.find('.bg-preview-tooltip');
        tooltip.fadeOut(150);
    }

    /**
     * Handle deleting expanded background
     */
    async _onDeleteExpandedBackground(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const index = parseInt(event.currentTarget.dataset.index);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        backgroundsExpanded.splice(index, 1);
        
        // ONLY update backgroundsExpanded, NOT main backgrounds
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded });
    }

    /**
     * Navigate to previous page of expanded background categories
     */
    async _onBgExpandedPrevPage(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const currentPage = this.actor.getFlag("wodsystem", "bgExpandedCategoriesPage") || 0;
        if (currentPage > 0) {
            await this.actor.setFlag("wodsystem", "bgExpandedCategoriesPage", currentPage - 1);
        }
    }

    /**
     * Navigate to next page of expanded background categories
     */
    async _onBgExpandedNextPage(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const categoriesPerPage = 3;
        const allCategorizedBackgrounds = this._categorizeExpandedBackgrounds(
            this.actor.system.backgroundsExpanded || []
        );
        const totalPages = Math.ceil(allCategorizedBackgrounds.length / categoriesPerPage);
        const currentPage = this.actor.getFlag("wodsystem", "bgExpandedCategoriesPage") || 0;
        
        if (currentPage < totalPages - 1) {
            await this.actor.setFlag("wodsystem", "bgExpandedCategoriesPage", currentPage + 1);
        }
    }

    /**
     * Handle adding custom field
     */
    async _onAddCustomField(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex]) return;
        if (!Array.isArray(backgroundsExpanded[bgIndex].customFields)) {
            backgroundsExpanded[bgIndex].customFields = [];
        }
        
        backgroundsExpanded[bgIndex].customFields.push({ name: "", value: "" });
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded });
    }

    /**
     * Handle deleting custom field
     */
    async _onDeleteCustomField(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const fieldIndex = parseInt(event.currentTarget.dataset.fieldIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex] || !Array.isArray(backgroundsExpanded[bgIndex].customFields)) return;
        
        backgroundsExpanded[bgIndex].customFields.splice(fieldIndex, 1);
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded });
    }

    /**
     * Handle enhancement type change (show/hide paradox and genetic flaws fields)
     * - Cybernetic: Only Permanent Paradox
     * - Biomod: Both Permanent Paradox AND Genetic Flaws
     * - Genengineered: Only Genetic Flaws
     */
    _onEnhancementTypeChange(event) {
        const select = event.currentTarget;
        const selectedType = select.value;
        const modal = this.element.find('.bg-modal-overlay');
        const permanentParadoxField = modal.find('.permanent-paradox-field');
        const geneticFlawsField = modal.find('.genetic-flaws-field');
        
        if (selectedType === 'cybernetic') {
            permanentParadoxField.show();
            geneticFlawsField.hide();
        } else if (selectedType === 'biomod') {
            permanentParadoxField.show();
            geneticFlawsField.show();
        } else if (selectedType === 'genengineered') {
            permanentParadoxField.hide();
            geneticFlawsField.show();
        }
    }

    /**
     * Initialize paradox and genetic flaws field visibility based on current enhancement type
     */
    _initializeGeneticFlawsVisibility() {
        const modal = this.element.find('.bg-modal-overlay');
        const enhancementTypeSelect = modal.find('select[name*="enhancementType"]');
        const permanentParadoxField = modal.find('.permanent-paradox-field');
        const geneticFlawsField = modal.find('.genetic-flaws-field');
        
        if (enhancementTypeSelect.length > 0) {
            const selectedType = enhancementTypeSelect.val();
            
            if (selectedType === 'cybernetic') {
                permanentParadoxField.show();
                geneticFlawsField.hide();
            } else if (selectedType === 'biomod') {
                permanentParadoxField.show();
                geneticFlawsField.show();
            } else if (selectedType === 'genengineered') {
                permanentParadoxField.hide();
                geneticFlawsField.show();
            }
        }
    }

    /**
     * Handle adding ally
     */
    async _onAddAlly(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex]) return;
        
        if (!Array.isArray(backgroundsExpanded[bgIndex].templateData.npcs)) {
            backgroundsExpanded[bgIndex].templateData.npcs = [];
        }
        
        backgroundsExpanded[bgIndex].templateData.npcs.push({
            name: "", role: "", influence: 1, reliability: 3, notes: ""
        });
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle deleting ally
     */
    async _onDeleteAlly(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const npcIndex = parseInt(event.currentTarget.dataset.npcIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex] || !Array.isArray(backgroundsExpanded[bgIndex].templateData.npcs)) return;
        
        backgroundsExpanded[bgIndex].templateData.npcs.splice(npcIndex, 1);
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle adding contact
     */
    async _onAddContact(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex]) return;
        
        if (!Array.isArray(backgroundsExpanded[bgIndex].templateData.npcs)) {
            backgroundsExpanded[bgIndex].templateData.npcs = [];
        }
        
        backgroundsExpanded[bgIndex].templateData.npcs.push({
            name: "", role: "", influence: 1, reliability: 3, notes: ""
        });
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle deleting contact
     */
    async _onDeleteContact(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const npcIndex = parseInt(event.currentTarget.dataset.npcIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex] || !Array.isArray(backgroundsExpanded[bgIndex].templateData.npcs)) return;
        
        backgroundsExpanded[bgIndex].templateData.npcs.splice(npcIndex, 1);
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle adding property
     */
    async _onAddProperty(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex]) return;
        
        if (!Array.isArray(backgroundsExpanded[bgIndex].templateData.properties)) {
            backgroundsExpanded[bgIndex].templateData.properties = [];
        }
        
        backgroundsExpanded[bgIndex].templateData.properties.push({
            type: "", location: "", value: ""
        });
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle deleting property
     */
    async _onDeleteProperty(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const propIndex = parseInt(event.currentTarget.dataset.propIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex] || !Array.isArray(backgroundsExpanded[bgIndex].templateData.properties)) return;
        
        backgroundsExpanded[bgIndex].templateData.properties.splice(propIndex, 1);
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle adding asset
     */
    async _onAddAsset(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex]) return;
        
        if (!Array.isArray(backgroundsExpanded[bgIndex].templateData.assets)) {
            backgroundsExpanded[bgIndex].templateData.assets = [];
        }
        
        backgroundsExpanded[bgIndex].templateData.assets.push({
            description: "", value: ""
        });
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle deleting asset
     */
    async _onDeleteAsset(event) {
        event.preventDefault();
        const bgIndex = parseInt(event.currentTarget.dataset.bgIndex);
        const assetIndex = parseInt(event.currentTarget.dataset.assetIndex);
        const backgroundsExpanded = foundry.utils.duplicate(
            Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : []
        );
        
        if (!backgroundsExpanded[bgIndex] || !Array.isArray(backgroundsExpanded[bgIndex].templateData.assets)) return;
        
        backgroundsExpanded[bgIndex].templateData.assets.splice(assetIndex, 1);
        
        // Update without re-rendering to keep modal open
        await this.actor.update({ "system.backgroundsExpanded": backgroundsExpanded }, { render: false });
        
        // Manually refresh the form in the modal
        const modal = this.element.find('.bg-modal-overlay');
        const formContainer = modal.find('.bg-modal-form');
        const bg = this.actor.system.backgroundsExpanded[bgIndex];
        const formHTML = await this._renderBackgroundForm(bg.template, bg.templateData, bgIndex);
        formContainer.html(formHTML);
    }

    /**
     * Handle sphere dot click
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
            newValue = Math.max(currentValue - 1, 0);
        } else {
            newValue = index + 1;
        }

        const updateData = {};
        updateData[`system.spheres.${sphereKey}.rating`] = Math.min(Math.max(newValue, 0), 5);
        await this.actor.update(updateData, { render: false });
        this._updateDotVisuals(container, newValue);
    }

    /**
     * Handle adding procedure
     */
    async _onAddProcedure(event) {
        event.preventDefault();
        const procedures = Array.isArray(this.actor.system.procedures) ? this.actor.system.procedures : [];
        const newProcedures = [...procedures, { name: "", spheres: "", description: "" }];
        await this.actor.update({ "system.procedures": newProcedures });
    }

    /**
     * Handle deleting procedure
     */
    async _onDeleteProcedure(event) {
        event.preventDefault();
        const index = parseInt(event.currentTarget.dataset.index);
        const procedures = foundry.utils.duplicate(Array.isArray(this.actor.system.procedures) ? this.actor.system.procedures : []);
        procedures.splice(index, 1);
        await this.actor.update({ "system.procedures": procedures });
    }

    /**
     * Handle adding device
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
     * Handle deleting device
     */
    async _onDeleteDevice(event) {
        event.preventDefault();
        const index = parseInt(event.currentTarget.dataset.index);
        const devices = foundry.utils.duplicate(Array.isArray(this.actor.system.devices) ? this.actor.system.devices : []);
        devices.splice(index, 1);
        await this.actor.update({ "system.devices": devices });
    }

    /**
     * Handle adding enhancement
     */
    async _onAddEnhancement(event) {
        event.preventDefault();
        const enhancements = Array.isArray(this.actor.system.enhancements) ? this.actor.system.enhancements : [];
        const newEnhancements = [...enhancements, { 
            name: "", description: "", location: "", effects: "", sideEffects: "" 
        }];
        await this.actor.update({ "system.enhancements": newEnhancements });
    }

    /**
     * Handle deleting enhancement
     */
    async _onDeleteEnhancement(event) {
        event.preventDefault();
        const index = parseInt(event.currentTarget.dataset.index);
        const enhancements = foundry.utils.duplicate(Array.isArray(this.actor.system.enhancements) ? this.actor.system.enhancements : []);
        enhancements.splice(index, 1);
        await this.actor.update({ "system.enhancements": enhancements });
    }

    /**
     * Procedures pagination handlers
     */
    async _onProceduresPrevPage(event) {
        event.preventDefault();
        const currentPage = this.actor.getFlag('wodsystem', 'proceduresPage') || 0;
        if (currentPage > 0) {
            await this.actor.setFlag('wodsystem', 'proceduresPage', currentPage - 1);
        }
    }

    async _onProceduresNextPage(event) {
        event.preventDefault();
        const procedures = Array.isArray(this.actor.system.procedures) ? this.actor.system.procedures : [];
        const currentPage = this.actor.getFlag('wodsystem', 'proceduresPage') || 0;
        const totalPages = Math.max(1, Math.ceil(procedures.length / 4));
        if (currentPage < totalPages - 1) {
            await this.actor.setFlag('wodsystem', 'proceduresPage', currentPage + 1);
        }
    }

    /**
     * Devices pagination handlers
     */
    async _onDevicesPrevPage(event) {
        event.preventDefault();
        const currentPage = this.actor.getFlag('wodsystem', 'devicesPage') || 0;
        if (currentPage > 0) {
            await this.actor.setFlag('wodsystem', 'devicesPage', currentPage - 1);
        }
    }

    async _onDevicesNextPage(event) {
        event.preventDefault();
        const devices = Array.isArray(this.actor.system.devices) ? this.actor.system.devices : [];
        const currentPage = this.actor.getFlag('wodsystem', 'devicesPage') || 0;
        const totalPages = Math.max(1, Math.ceil(devices.length / 2));
        if (currentPage < totalPages - 1) {
            await this.actor.setFlag('wodsystem', 'devicesPage', currentPage + 1);
        }
    }

    /**
     * Enhancements pagination handlers
     */
    async _onEnhancementsPrevPage(event) {
        event.preventDefault();
        const currentPage = this.actor.getFlag('wodsystem', 'enhancementsPage') || 0;
        if (currentPage > 0) {
            await this.actor.setFlag('wodsystem', 'enhancementsPage', currentPage - 1);
        }
    }

    async _onEnhancementsNextPage(event) {
        event.preventDefault();
        const enhancements = Array.isArray(this.actor.system.enhancements) ? this.actor.system.enhancements : [];
        const currentPage = this.actor.getFlag('wodsystem', 'enhancementsPage') || 0;
        const totalPages = Math.max(1, Math.ceil(enhancements.length / 2));
        if (currentPage < totalPages - 1) {
            await this.actor.setFlag('wodsystem', 'enhancementsPage', currentPage + 1);
        }
    }

    /**
     * Backgrounds Expanded pagination handlers
     */
    async _onBackgroundsExpandedPrevPage(event) {
        event.preventDefault();
        const currentPage = this.actor.getFlag('wodsystem', 'backgroundsExpandedPage') || 0;
        if (currentPage > 0) {
            await this.actor.setFlag('wodsystem', 'backgroundsExpandedPage', currentPage - 1);
        }
    }

    async _onBackgroundsExpandedNextPage(event) {
        event.preventDefault();
        const backgroundsExpanded = Array.isArray(this.actor.system.backgroundsExpanded) ? this.actor.system.backgroundsExpanded : [];
        const currentPage = this.actor.getFlag('wodsystem', 'backgroundsExpandedPage') || 0;
        const totalPages = Math.max(1, Math.ceil(backgroundsExpanded.length / 1));
        if (currentPage < totalPages - 1) {
            await this.actor.setFlag('wodsystem', 'backgroundsExpandedPage', currentPage + 1);
        }
    }

    /**
     * Handle LEFT-CLICK on trait label: Show context menu to combine with other traits
     * @param {Event} event
     * @private
     */
    async _onTraitLabelLeftClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.currentTarget;
        
        // If this element is selectable, it means we're completing a pool selection
        // Let the one-time handler in _startPoolSelection handle it.
        if (element.classList.contains('selectable')) {
            return;
        }
        
        const trait = element.dataset.trait;
        const value = parseInt(element.dataset.value);
        const category = element.dataset.category;
        
        // Willpower and enlightenment should only work with right-click (direct rolls)
        if (category === 'willpower' || category === 'enlightenment') {
            return;
        }
        
        // If already in pool selection mode, clean it up and start new selection
        if (this._pendingPool) {
            this._cleanupPoolSelection();
        }
        
        this._showCombineContextMenu(element);
    }

    /**
     * Handle RIGHT-CLICK on trait label: Show roll dialog for single trait
     * @param {Event} event
     * @private
     */
    async _onTraitLabelRightClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.currentTarget;
        const trait = element.dataset.trait;
        const value = parseInt(element.dataset.value);
        const category = element.dataset.category;
        const attributeType = element.dataset.attributeType;
        
        // Determine trait type for roll context
        let type = 'ability'; // Default to ability
        if (category === 'attribute' || attributeType) {
            type = 'attribute';
        } else if (category === 'background') {
            type = 'background';
        } else if (category === 'willpower' || category === 'enlightenment') {
            type = 'advantage';
        }
        
        // Build trait object with type for effect matching
        const traitObject = { 
            name: trait, 
            value: value,
            type: type,
            category: category
        };
        
        // Determine roll context for single trait
        const rollContext = this._determineRollContext([traitObject]);
        
        // Open roll dialog for just this trait
        const dialog = new WodRollDialog(this.actor, {
            traits: [traitObject],
            poolName: trait,
            totalPool: value,
            rollContext: rollContext
        });
        dialog.render(true);
    }

    /**
     * Create the quick rolls trigger button dynamically
     * @private
     */
    _createQuickRollsTrigger() {
        const windowApp = this.element.closest('.window-app')[0];
        if (!windowApp) {
            console.warn('WoD | Could not create Quick Rolls trigger: window-app not found');
            return;
        }
        
        // Don't create button for uncreated characters (they need to go through wizard)
        if (!this.actor.system.isCreated) {
            return;
        }
        
        // Remove existing trigger if any
        const existingTrigger = document.querySelector(`.quick-rolls-trigger[data-app-id="${this.appId}"]`);
        if (existingTrigger) {
            existingTrigger.remove();
        }
        
        // Get theme colors
        const sheetElement = this.element[0];
        const computedStyle = getComputedStyle(sheetElement);
        const primaryColor = computedStyle.getPropertyValue('--wod-primary') || '#4682B4';
        const primaryDark = computedStyle.getPropertyValue('--wod-primary-dark') || '#2F4F6F';
        
        // Get window position
        const windowRect = windowApp.getBoundingClientRect();
        
        // Create trigger button - FULLY STYLED BEFORE APPENDING
        const trigger = document.createElement('div');
        trigger.className = 'quick-rolls-trigger';
        trigger.dataset.appId = this.appId;
        trigger.title = 'Quick Rolls';
        trigger.innerHTML = '<i class="fas fa-dice-d10"></i>';
        
        // Set ALL styles inline BEFORE adding to DOM to prevent any layout impact
        // Style as a tab attached to the window edge
        trigger.style.position = 'fixed';
        trigger.style.left = `${windowRect.left}px`; // Right at the edge, no gap
        trigger.style.top = `${windowRect.top + windowRect.height / 2}px`;
        trigger.style.transform = 'translateY(-50%)';
        trigger.style.background = primaryColor;
        trigger.style.color = 'white';
        trigger.style.width = '20px';
        trigger.style.height = '28px';
        trigger.style.borderRadius = '0 3px 3px 0'; // Only round the right side
        trigger.style.cursor = 'pointer';
        trigger.style.display = 'flex';
        trigger.style.alignItems = 'center';
        trigger.style.justifyContent = 'center';
        trigger.style.boxShadow = '1px 0 4px rgba(0,0,0,0.3)';
        trigger.style.transition = 'width 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, opacity 0.3s ease';
        trigger.style.zIndex = '1000'; // Increased to ensure visibility
        trigger.style.fontSize = '0.8em';
        trigger.style.pointerEvents = 'auto';
        trigger.style.borderLeft = 'none'; // No border on the window edge side
        trigger.style.opacity = '1'; // Start fully visible for debugging
        
        // Add hover effect - expand width to extend outward without moving from edge
        trigger.addEventListener('mouseenter', () => {
            trigger.style.background = primaryDark;
            trigger.style.width = '24px'; // Expand outward
            trigger.style.boxShadow = '2px 0 8px rgba(0,0,0,0.4)';
        });
        trigger.addEventListener('mouseleave', () => {
            trigger.style.background = primaryColor;
            trigger.style.width = '20px'; // Return to normal
            trigger.style.boxShadow = '1px 0 4px rgba(0,0,0,0.3)';
        });
        
        // Add click listener
        trigger.addEventListener('click', this._onToggleQuickRollsPanel.bind(this));
        
        // Append to body AFTER all styles are set
        document.body.appendChild(trigger);
        
        // Store reference for cleanup
        this._quickRollsTrigger = trigger;
        
        // Button is now immediately visible (no fade-in needed)
        
        // Update position when window is dragged/resized
        this._updateTriggerPosition = () => {
            const newRect = windowApp.getBoundingClientRect();
            trigger.style.left = `${newRect.left}px`;
            trigger.style.top = `${newRect.top + newRect.height / 2}px`;
        };
        
        // Continuously update position to follow window movement
        this._positionUpdateInterval = setInterval(this._updateTriggerPosition, 50);
        
        // Monitor for wizard windows and hide/show button accordingly
        this._wizardCheckInterval = setInterval(() => {
            const wizardOpen = document.querySelector('.window-app.character-wizard');
            const currentDisplay = trigger.style.display;
            
            if (wizardOpen && currentDisplay !== 'none') {
                trigger.style.display = 'none';
            } else if (!wizardOpen && currentDisplay === 'none') {
                trigger.style.display = 'flex';
            }
        }, 500);
    }

    /**
     * Toggle the quick rolls panel visibility (create/destroy on demand)
     * @param {Event} event - Click event
     * @private
     */
    _onToggleQuickRollsPanel(event) {
        event.preventDefault();
        
        const windowApp = this.element.closest('.window-app')[0];
        if (!windowApp) return;
        
        // Check if panel already exists
        const panel = windowApp.querySelector('.quick-rolls-panel-overlay');
        
        if (panel) {
            // Close and remove panel
            this._destroyQuickRollsPanel();
        } else {
            // Create and show panel
            this._createQuickRollsPanel();
        }
    }

    /**
     * Create the quick rolls panel dynamically with inline styles
     * @private
     */
    _createQuickRollsPanel() {
        // Ensure rollTemplates is always an array (Foundry sometimes converts empty arrays to objects)
        const rollTemplates = this.actor.system.rollTemplates || [];
        const templates = Array.isArray(rollTemplates) ? rollTemplates : Object.values(rollTemplates);
        const maxTemplates = 10;
        const displayTemplates = templates.slice(0, maxTemplates);
        
        // Get theme colors from CSS variables
        const sheetElement = this.element[0];
        const computedStyle = getComputedStyle(sheetElement);
        const primaryColor = computedStyle.getPropertyValue('--wod-primary') || '#4682B4';
        const bgMain = computedStyle.getPropertyValue('--wod-bg-main') || '#fff';
        const borderLight = computedStyle.getPropertyValue('--wod-border-light') || '#ccc';
        const textMain = computedStyle.getPropertyValue('--wod-text-main') || '#000';
        const textAlt = computedStyle.getPropertyValue('--wod-text-alt') || '#666';
        const dangerColor = computedStyle.getPropertyValue('--wod-danger') || '#dc143c';
        
        // Get the Foundry window container (not just the form element)
        const windowApp = this.element.closest('.window-app')[0];
        if (!windowApp) {
            console.error('Could not find window-app container for quick rolls panel');
            return;
        }
        
        // Apply overflow-x to window-content (the scrollable section) instead of entire window-app
        // This preserves vertical scrolling while clipping horizontal overflow
        const windowContent = windowApp.querySelector('.window-content');
        if (!windowContent) {
            console.error('Could not find window-content for quick rolls panel');
            return;
        }
        windowContent.style.overflowX = 'hidden';
        windowContent.style.position = 'relative';
        
        // Create overlay element with inline styles (absolute within window-content)
        const overlay = document.createElement('div');
        overlay.className = 'quick-rolls-panel-overlay';
        overlay.style.position = 'absolute';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.zIndex = '998';
        overlay.style.background = 'rgba(0, 0, 0, 0)';
        overlay.style.opacity = '0';
        overlay.style.transition = 'background 0.25s ease-out, opacity 0.25s ease-out';
        overlay.style.pointerEvents = 'all';
        
        // Create content panel
        const content = document.createElement('div');
        content.className = 'quick-rolls-content';
        content.style.position = 'absolute';
        content.style.left = '0';
        content.style.top = '0';
        content.style.width = '260px';
        content.style.height = '100%';
        content.style.background = bgMain;
        content.style.borderRight = `1px solid ${borderLight}`;
        content.style.padding = '16px';
        content.style.overflowY = 'auto';
        content.style.boxShadow = '2px 0 12px rgba(0,0,0,0.2)';
        content.style.transform = 'translateX(-100%)';
        content.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        content.style.opacity = '1'; // Fully opaque - slides from behind the window
        content.style.willChange = 'transform';
        
        // Create header
        const header = document.createElement('h4');
        header.textContent = 'Saved Roll Templates';
        header.style.cssText = `
            margin: 0 0 16px 0;
            color: ${textMain};
            font-size: 1.1em;
            font-weight: 600;
            padding-bottom: 8px;
            border-bottom: 1px solid ${borderLight};
        `;
        content.appendChild(header);
        
        // Build template list
        if (displayTemplates.length > 0) {
            for (const template of displayTemplates) {
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: ${bgMain};
                    border: 1px solid ${borderLight};
                    border-radius: 6px;
                    padding: 8px;
                    margin-bottom: 8px;
                    transition: all 0.2s ease;
                `;
                
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'execute-template';
                button.dataset.templateId = template.id;
                button.title = `${template.name} (Difficulty ${template.difficulty})`;
                button.innerHTML = `<i class="fas fa-dice-d10"></i> ${template.name}`;
                button.style.cssText = `
                    flex: 1;
                    background: transparent;
                    color: ${textMain};
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    font-size: 0.9em;
                    text-align: left;
                    font-weight: 500;
                `;
                
                const deleteBtn = document.createElement('a');
                deleteBtn.className = 'delete-template';
                deleteBtn.dataset.templateId = template.id;
                deleteBtn.title = 'Delete template';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.style.cssText = `
                    color: ${textAlt};
                    cursor: pointer;
                    padding: 4px;
                    font-size: 0.9em;
                    opacity: 0.6;
                    transition: all 0.2s ease;
                `;
                
                item.appendChild(button);
                item.appendChild(deleteBtn);
                content.appendChild(item);
            }
        } else {
            const noTemplates = document.createElement('p');
            noTemplates.textContent = 'No saved templates yet. Save a roll configuration to create quick access.';
            noTemplates.style.cssText = `
                font-size: 0.9em;
                color: ${textAlt};
                margin: 0;
                padding: 16px;
                text-align: center;
                line-height: 1.5;
            `;
            content.appendChild(noTemplates);
        }
        
        overlay.appendChild(content);
        
        // Append to window-content (not window-app) so overflow-x works
        windowContent.appendChild(overlay);
        
        // Attach event listeners to execute buttons
        content.querySelectorAll('.execute-template').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const templateId = e.currentTarget.dataset.templateId;
                await this.actor.executeTemplate(templateId);
                
                // Close panel after executing
                this._destroyQuickRollsPanel();
            });
        });
        
        // Attach event listeners to delete buttons
        content.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const templateId = e.currentTarget.dataset.templateId;
                
                const confirmed = await Dialog.confirm({
                    title: "Delete Roll Template",
                    content: "<p>Are you sure you want to delete this roll template?</p>",
                    yes: () => true,
                    no: () => false
                });
                
                if (confirmed) {
                    await this.actor.deleteRollTemplate(templateId);
                    
                    // Close and recreate panel to show updated list
                    this._destroyQuickRollsPanel();
                    setTimeout(() => {
                        this._createQuickRollsPanel();
                    }, 350);
                }
            });
        });
        
        // Add hover effects
        content.querySelectorAll('.execute-template').forEach(btn => {
            const item = btn.parentElement;
            btn.addEventListener('mouseenter', () => {
                item.style.transform = 'translateX(4px)';
                item.style.borderColor = primaryColor;
            });
            btn.addEventListener('mouseleave', () => {
                item.style.transform = 'translateX(0)';
                item.style.borderColor = borderLight;
            });
        });
        
        content.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.opacity = '1';
                btn.style.color = dangerColor;
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.opacity = '0.6';
                btn.style.color = textAlt;
            });
        });
        
        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this._destroyQuickRollsPanel();
            }
        });
        
        // Force a reflow to ensure initial state is rendered before transition
        content.offsetHeight;
        
        // Trigger animation on next frame for smooth transition
        // Only overlay fades in, content slides at full opacity (looks like sliding from behind)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.style.background = 'rgba(0, 0, 0, 0.2)';
                overlay.style.opacity = '1';
                content.style.transform = 'translateX(0)';
            });
        });
    }

    /**
     * Destroy the quick rolls panel
     * @private
     */
    _destroyQuickRollsPanel() {
        const windowApp = this.element.closest('.window-app')[0];
        if (!windowApp) return;
        
        // Look for panel in window-content since that's where we append it
        const windowContent = windowApp.querySelector('.window-content');
        const panel = windowContent ? windowContent.querySelector('.quick-rolls-panel-overlay') : null;
        if (panel) {
            const content = panel.querySelector('.quick-rolls-content');
            
            // Animate out smoothly
            // Only overlay fades out, content slides back at full opacity
            panel.style.background = 'rgba(0, 0, 0, 0)';
            panel.style.opacity = '0';
            if (content) {
                content.style.transform = 'translateX(-100%)';
                // Keep content opaque - it slides behind the window edge
            }
            
            // Remove after animation completes (match transition duration)
            setTimeout(() => {
                panel.remove();
            }, 250);
        }
    }

    /**
     * Show context menu for combining traits (LEFT-CLICK)
     * @param {HTMLElement} element - The clicked element
     * @private
     */
    _showCombineContextMenu(element) {
        const trait = element.dataset.trait;
        const value = parseInt(element.dataset.value);
        const category = element.dataset.category;
        const attributeType = element.dataset.attributeType;
        
        // Determine trait type for roll context
        let type = 'ability'; // Default to ability
        if (category === 'attribute' || attributeType) {
            type = 'attribute';
        } else if (category === 'background') {
            type = 'background';
        }
        
        // Build trait object with type for effect matching
        const traitObject = { 
            name: trait, 
            value: value,
            type: type,
            category: category
        };
        
        if (category === 'attribute' || attributeType) {
            // Attribute clicked - immediately highlight ALL abilities for selection
            this._startPoolSelection(traitObject, 'abilities');
            return;
        }
        
        if (category === 'background') {
            // Background clicked - immediately highlight ALL attributes for selection
            this._startPoolSelection(traitObject, 'attributes');
            return;
        }
        
        // Ability clicked - immediately highlight ALL attributes for selection
        this._startPoolSelection(traitObject, 'attributes');
    }

    /**
     * Start pool selection mode - highlight available traits for combination
     * @param {Object} firstTraitObject - First trait object {name, value, type, category}
     * @param {string} targetCategory - Category to select from
     * @private
     */
    _startPoolSelection(firstTraitObject, targetCategory) {
        // Store first trait
        this._pendingPool = {
            traits: [firstTraitObject],
            targetCategory: targetCategory
        };
        
        // Visual feedback
        this.element.addClass('pool-selection-active');
        
        // Determine selector based on category
        let selector;
        if (targetCategory === 'physical' || targetCategory === 'social' || targetCategory === 'mental') {
            // Selecting a specific attribute type
            selector = `.trait-label[data-attribute-type="${targetCategory}"]`;
        } else if (targetCategory === 'abilities') {
            // Selecting ANY ability (talents, skills, OR knowledges)
            selector = `.trait-label[data-category="talents"], .trait-label[data-category="skills"], .trait-label[data-category="knowledges"]`;
        } else if (targetCategory === 'attributes') {
            // Selecting ANY attribute (physical, social, OR mental)
            selector = `.trait-label[data-category="attribute"]`;
        } else {
            // Selecting a specific ability category
            selector = `.trait-label[data-category="${targetCategory}"]`;
        }
        
        const selectableElements = this.element.find(selector);
        selectableElements.addClass('selectable');
        
        // One-time click handler
        const handler = (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const secondElement = event.currentTarget;
            const secondTrait = secondElement.dataset.trait;
            const secondValue = parseInt(secondElement.dataset.value);
            const secondCategory = secondElement.dataset.category;
            const secondAttributeType = secondElement.dataset.attributeType;
            
            // Determine trait type for roll context
            let secondType = 'ability'; // Default to ability
            if (secondCategory === 'attribute' || secondAttributeType) {
                secondType = 'attribute';
            } else if (secondCategory === 'background') {
                secondType = 'background';
            }
            
            // Build second trait object with type for effect matching
            const secondTraitObject = { 
                name: secondTrait, 
                value: secondValue,
                type: secondType,
                category: secondCategory
            };
            
            this._pendingPool.traits.push(secondTraitObject);
            
            const totalPool = this._pendingPool.traits.reduce((sum, t) => sum + t.value, 0);
            const poolName = this._pendingPool.traits.map(t => t.name).join(' + ');
            
            // Open dialog
            // Detect roll context based on traits involved
            const rollContext = this._determineRollContext(this._pendingPool.traits);
            
            const dialog = new WodRollDialog(this.actor, {
                traits: this._pendingPool.traits,
                poolName: poolName,
                totalPool: totalPool,
                rollContext: rollContext
            });
            dialog.render(true);
            
            // Cleanup
            this._cleanupPoolSelection();
        };
        
        this.element.find('.selectable').one('click.poolSelection', handler);
        
        // ESC to cancel
        this._poolSelectionEscHandler = (event) => {
            if (event.key === 'Escape') {
                this._cleanupPoolSelection();
            }
        };
        $(document).one('keydown', this._poolSelectionEscHandler);
    }

    /**
     * Clean up pool selection mode
     * @private
     */
    _cleanupPoolSelection() {
        this.element.removeClass('pool-selection-active');
        // Only remove the namespaced pool selection handlers, not the permanent trait-label handlers
        this.element.find('.selectable').removeClass('selectable').off('click.poolSelection');
        this._pendingPool = null;
        if (this._poolSelectionEscHandler) {
            $(document).off('keydown', this._poolSelectionEscHandler);
            this._poolSelectionEscHandler = null;
        }
    }

    /**
     * Show saved roll templates
     * @param {string} trait - Trait name (for filtering)
     * @param {HTMLElement} element - Element to attach menu to
     * @private
     */
    _showSavedRolls(trait, element) {
        // Ensure rollTemplates is always an array (Foundry sometimes converts empty arrays to objects)
        const rollTemplates = this.actor.system.rollTemplates || [];
        const templates = Array.isArray(rollTemplates) ? rollTemplates : Object.values(rollTemplates);
        
        if (templates.length === 0) {
            ui.notifications.info("No saved roll templates yet!");
            return;
        }
        
        // For now, just show all templates
        // Future: Could filter by trait
        const menuItems = templates.map(template => ({
            name: template.name,
            icon: '<i class="fas fa-dice-d10"></i>',
            callback: () => this.actor.executeTemplate(template.id)
        }));
        
        new foundry.applications.ux.ContextMenu.implementation(
            this.element[0],
            element,
            menuItems,
            { jQuery: false }
        );
    }

    /**
     * Open Character Creation Wizard
     * @param {Event} event - The click event
     * @private
     */
    async _onStartCharacterWizard(event) {
        event.preventDefault();
        
        // Check if wizard is available
        if (!game.wodsystem?.WodCharacterWizard) {
            ui.notifications.error("Character Creation Wizard not available");
            return;
        }
        
        // Create and render wizard
        const wizard = new game.wodsystem.WodCharacterWizard(this.actor);
        wizard.render(true);
    }
    
    /* -------------------------------------------- */
    /*  Reference Data Integration (Tooltips & Click-to-Chat)          */
    /* -------------------------------------------- */
    
    /**
     * Initialize reference data integrations for merits/flaws
     * Adds tooltips on hover and click-to-chat functionality
     * @param {jQuery} html - The rendered HTML
     * @private
     */
    _initializeReferenceIntegrations(html) {
        const service = game.wod?.referenceDataService;
        if (!service || !service.initialized) return;
        
        // Process merits
        html.find('.merit-name').each((index, element) => {
            const $input = $(element);
            const $button = $input.siblings('.merit-reference-btn');
            
            const name = $input.val()?.trim();
            if (!name) {
                $button.removeClass('has-reference');
                return;
            }
            
            const reference = service.getByName(name, 'Merit');
            
            if (reference) {
                // Show button and store reference data
                $button.addClass('has-reference');
                $button.data('reference', reference);
                $input.addClass('has-reference');
            } else {
                $button.removeClass('has-reference');
                $input.removeClass('has-reference');
            }
        });
        
        // Process flaws
        html.find('.flaw-name').each((index, element) => {
            const $input = $(element);
            const $button = $input.siblings('.flaw-reference-btn');
            
            const name = $input.val()?.trim();
            if (!name) {
                $button.removeClass('has-reference');
                return;
            }
            
            const reference = service.getByName(name, 'Flaw');
            
            if (reference) {
                // Show button and store reference data
                $button.addClass('has-reference');
                $button.data('reference', reference);
                $input.addClass('has-reference');
            } else {
                $button.removeClass('has-reference');
                $input.removeClass('has-reference');
            }
        });
    }
    
    /**
     * Show tooltip for merit/flaw reference
     * @param {Event} event - The hover event
     * @param {object} reference - The reference data
     * @private
     */
    _showReferenceTooltip(event, reference) {
        this._hideReferenceTooltip(); // Remove any existing tooltip
        
        const service = game.wod?.referenceDataService;
        if (!service) return;
        
        // Create tooltip element
        const tooltip = $('<div class="wod-reference-tooltip"></div>');
        tooltip.html(service.generateTooltipHTML(reference));
        
        // Store reference data on the tooltip for the chat button
        tooltip.data('reference', reference);
        
        // Add to body with visibility hidden to measure
        tooltip.css({ 
            visibility: 'hidden', 
            display: 'block',
            position: 'fixed',  // Use fixed positioning relative to viewport
            pointerEvents: 'auto'  // Enable click events
        });
        $('body').append(tooltip);
        
        // Add click handler for post-to-chat button
        tooltip.find('.post-to-chat-btn').on('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const ref = tooltip.data('reference');
            if (ref) {
                await this._postReferenceToChat(ref);
                this._hideReferenceTooltip();
            }
        });
        
        // Prevent tooltip from closing when clicking inside it
        tooltip.on('click', (e) => {
            e.stopPropagation();
        });
        
        // Get dimensions
        const rect = event.currentTarget.getBoundingClientRect();
        const tooltipWidth = tooltip.outerWidth();
        const tooltipHeight = tooltip.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        
        // Calculate left position (prevent overflow)
        let left = rect.left;
        if (left + tooltipWidth > windowWidth - 10) {
            left = windowWidth - tooltipWidth - 10;
        }
        if (left < 10) {
            left = 10;
        }
        
        // Calculate top position - show above the element
        let top = rect.top - tooltipHeight - 10;
        
        // If it goes off the top of the screen, position below instead
        if (top < 10) {
            top = rect.bottom + 10;
            // If it goes off the bottom too, just clamp to top
            if (top + tooltipHeight > windowHeight - 10) {
                top = 10;
            }
        }
        
        // Apply final position and make visible
        tooltip.css({
            position: 'fixed',
            top: top + 'px',
            left: left + 'px',
            maxWidth: '400px',
            maxHeight: (windowHeight - 20) + 'px',  // Limit height to viewport
            overflowY: 'auto',  // Allow scrolling if content is too long
            visibility: 'visible',
            display: 'none',
            pointerEvents: 'auto'  // Enable click events
        });
        
        // Fade in
        tooltip.fadeIn(200);
        
        // Close tooltip when clicking outside (use setTimeout to prevent immediate closure)
        setTimeout(() => {
            $(document).one('click', () => {
                this._hideReferenceTooltip();
            });
        }, 100);
    }
    
    /**
     * Hide reference tooltip
     * @private
     */
    _hideReferenceTooltip() {
        $('.wod-reference-tooltip').fadeOut(100, function() {
            $(this).remove();
        });
    }
    
    /**
     * Handle click on merit/flaw name to post to chat
     * @param {Event} event - The click event
     * @param {object} reference - The reference data
     * @private
     */
    async _onReferenceClickToChat(event, reference) {
        event.preventDefault();
        event.stopPropagation();
        
        // Hide tooltip when clicking
        this._hideReferenceTooltip();
        
        if (!reference) {
            ui.notifications.warn(`Reference data not found`);
            return;
        }
        
        // Post to chat
        await this._postReferenceToChat(reference);
    }
    
    /**
     * Post merit/flaw reference to chat
     * @param {object} reference - The reference data
     * @private
     */
    async _postReferenceToChat(reference) {
        const content = await renderTemplate(
            "systems/wodsystem/templates/chat/reference-card.html",
            { reference }
        );
        
        const messageData = {
            content: content,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            flags: {
                wodsystem: {
                    referenceType: reference.category,
                    referenceId: reference.id
                }
            }
        };
        
        await ChatMessage.create(messageData);
        
        ui.notifications.info(`Posted ${reference.name} to chat`);
    }

    // ===========================
    // Autocomplete Methods
    // ===========================

    _showAutocomplete(input, results, type) {
        this._hideAutocomplete(); // Remove any existing dropdown
        
        const $input = $(input);
        const inputPos = $input.offset();
        const inputHeight = $input.outerHeight();
        const inputWidth = $input.outerWidth();
        
        // Create dropdown
        const $dropdown = $('<div class="wod-autocomplete-dropdown"></div>');
        $dropdown.css({
            position: 'absolute',
            top: inputPos.top + inputHeight + 2,
            left: inputPos.left,
            width: inputWidth,
            maxHeight: '200px',
            zIndex: 10000
        });
        
        // Add results
        results.forEach((result, index) => {
            const $item = $(`
                <div class="autocomplete-item" data-index="${index}">
                    <span class="autocomplete-name">${result.name}</span>
                    <span class="autocomplete-meta">${result.costDescription} pt</span>
                </div>
            `);
            
            // Mouse events
            $item.on('mousedown', (e) => {
                e.preventDefault(); // Prevent blur
                this._selectAutocompleteItem(input, result, type);
            });
            
            $item.on('mouseenter', (e) => {
                $dropdown.find('.autocomplete-item').removeClass('highlighted');
                $item.addClass('highlighted');
                this._autocompleteSelectedIndex = index;
            });
            
            $dropdown.append($item);
        });
        
        // Add to body
        $('body').append($dropdown);
        
        // Store reference and data
        this._autocompleteDropdown = $dropdown;
        this._autocompleteResults = results;
        this._autocompleteInput = input;
        this._autocompleteType = type;
        this._autocompleteSelectedIndex = -1;
    }

    _hideAutocomplete() {
        if (this._autocompleteDropdown) {
            this._autocompleteDropdown.remove();
            this._autocompleteDropdown = null;
            this._autocompleteResults = null;
            this._autocompleteInput = null;
            this._autocompleteType = null;
            this._autocompleteSelectedIndex = -1;
        }
    }

    _onAutocompleteBlur(event) {
        // Delay hiding to allow clicks on dropdown
        setTimeout(() => {
            this._hideAutocomplete();
        }, 200);
    }

    _onAutocompleteKeydown(event) {
        if (!this._autocompleteDropdown || !this._autocompleteResults) {
            return;
        }
        
        const results = this._autocompleteResults;
        
        switch(event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this._autocompleteSelectedIndex = Math.min(
                    this._autocompleteSelectedIndex + 1,
                    results.length - 1
                );
                this._updateAutocompleteHighlight();
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this._autocompleteSelectedIndex = Math.max(
                    this._autocompleteSelectedIndex - 1,
                    0
                );
                this._updateAutocompleteHighlight();
                break;
                
            case 'Enter':
                if (this._autocompleteSelectedIndex >= 0) {
                    event.preventDefault();
                    const selected = results[this._autocompleteSelectedIndex];
                    this._selectAutocompleteItem(
                        this._autocompleteInput,
                        selected,
                        this._autocompleteType
                    );
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                this._hideAutocomplete();
                break;
        }
    }

    _updateAutocompleteHighlight() {
        if (!this._autocompleteDropdown) return;
        
        const $items = this._autocompleteDropdown.find('.autocomplete-item');
        $items.removeClass('highlighted');
        
        if (this._autocompleteSelectedIndex >= 0) {
            $items.eq(this._autocompleteSelectedIndex).addClass('highlighted');
            
            // Scroll into view if needed
            const $highlighted = $items.eq(this._autocompleteSelectedIndex);
            if ($highlighted.length) {
                const dropdown = this._autocompleteDropdown[0];
                const item = $highlighted[0];
                
                if (item.offsetTop < dropdown.scrollTop) {
                    dropdown.scrollTop = item.offsetTop;
                } else if (item.offsetTop + item.offsetHeight > dropdown.scrollTop + dropdown.offsetHeight) {
                    dropdown.scrollTop = item.offsetTop + item.offsetHeight - dropdown.offsetHeight;
                }
            }
        }
    }

    async _selectAutocompleteItem(input, result, type) {
        // Hide dropdown first
        this._hideAutocomplete();
        
        // Get the index from the input
        const index = parseInt(input.dataset.index);
        
        // Determine the cost value(s)
        const costs = Array.isArray(result.cost) ? result.cost : [result.cost];
        
        let selectedValue;
        
        // If single cost, use it directly
        if (costs.length === 1) {
            selectedValue = costs[0];
        } else {
            // Multiple costs - show dialog to choose
            selectedValue = await this._showCostSelectionDialog(result.name, costs, result.category);
            
            if (!selectedValue) {
                // User cancelled
                return;
            }
        }
        
        // Update both name and value in a single update
        if (type === 'merit') {
            let merits = foundry.utils.duplicate(this.actor.system.miscellaneous.merits);
            if (merits[index]) {
                merits[index].name = result.name;
                merits[index].value = selectedValue;
                await this.actor.update({ "system.miscellaneous.merits": merits });
            }
        } else if (type === 'flaw') {
            let flaws = foundry.utils.duplicate(this.actor.system.miscellaneous.flaws);
            if (flaws[index]) {
                flaws[index].name = result.name;
                flaws[index].value = selectedValue;
                await this.actor.update({ "system.miscellaneous.flaws": flaws });
            }
        }
        
        // Wait a frame for Foundry to process the update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force re-render the dots for this specific item
        const $container = $(this.element).find(type === 'merit' ? `.merit-item:eq(${index})` : `.flaw-item:eq(${index})`);
        const $dots = $container.find('.dot-container .dot');
        
        // Update dot visual state
        $dots.each((dotIndex, dot) => {
            if (dotIndex < selectedValue) {
                $(dot).addClass('filled');
            } else {
                $(dot).removeClass('filled');
            }
        });
        
        // Update hidden input
        $container.find('.dot-input').val(selectedValue);
        
        // Show success notification
        ui.notifications.info(`Selected: ${result.name} (${selectedValue} pt)`);
    }
    
    /**
     * Show dialog to select cost when multiple options available
     * @param {string} name - Merit/Flaw name
     * @param {Array} costs - Array of cost options
     * @param {string} category - 'Merit' or 'Flaw'
     * @returns {Promise<number|null>} Selected cost or null if cancelled
     * @private
     */
    async _showCostSelectionDialog(name, costs, category) {
        return new Promise((resolve) => {
            const color = category === 'Merit' ? '#4CAF50' : '#f44336';
            let resolved = false;
            
            const safeResolve = (value) => {
                if (!resolved) {
                    resolved = true;
                    resolve(value);
                }
            };
            
            // Shorter title to avoid horizontal scroll
            const shortTitle = `Select Cost`;
            
            const content = `
                <div style="padding: 8px;">
                    <p style="margin: 0 0 10px 0; font-size: 0.9em; line-height: 1.3;">
                        <strong style="display: block; margin-bottom: 6px; font-size: 0.95em; word-wrap: break-word;">${name}</strong>
                        <span style="font-size: 0.85em; color: #666;">Select point value:</span>
                    </p>
                    <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin: 0;">
                        ${costs.map(cost => `<button type="button" class="cost-option-btn" data-cost="${cost}" style="padding: 4px 10px; font-size: 0.85em; font-weight: 600; background: ${color}; color: white; border: none; border-radius: 2px; cursor: pointer; min-width: 35px; transition: opacity 0.2s;">${cost} pt</button>`).join('')}
                    </div>
                </div>
            `;
            
            const dialog = new Dialog({
                title: shortTitle,
                content: content,
                buttons: {
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => safeResolve(null)
                    }
                },
                default: "cancel",
                render: (html) => {
                    // Add click handlers to cost buttons
                    html.find('.cost-option-btn').click((event) => {
                        const selectedCost = parseInt(event.currentTarget.dataset.cost);
                        safeResolve(selectedCost);
                        dialog.close();  // Explicitly close the dialog
                    });
                    
                    // Add hover effect
                    html.find('.cost-option-btn').hover(
                        function() { $(this).css('opacity', '0.8'); },
                        function() { $(this).css('opacity', '1'); }
                    );
                    
                    // Remove the "Close" text from the close button
                    setTimeout(() => {
                        const closeButton = html.closest('.app').find('.header-button.close')[0];
                        if (closeButton) {
                            // Remove all text nodes, keep only the icon
                            Array.from(closeButton.childNodes).forEach(node => {
                                if (node.nodeType === Node.TEXT_NODE) {
                                    node.remove();
                                }
                            });
                        }
                    }, 0);
                },
                close: () => {
                    // If dialog is closed without selection, resolve null
                    safeResolve(null);
                }
            }, {
                width: 280,
                height: "auto",
                resizable: false,
                classes: ["dialog", "wod-cost-selection-dialog"]
            }).render(true);
        });
    }
}

