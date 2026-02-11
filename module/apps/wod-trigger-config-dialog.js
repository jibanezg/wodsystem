import { TriggerAPI } from '../services/trigger-api.js';
import { EffectAutocomplete } from './effect-autocomplete.js';
import { TriggerEventRegistry } from '../services/trigger-event-registry.js';

export class WodTriggerConfigDialog extends FormApplication {
    constructor(document, triggerId = null, options = {}) {
        super({}, options);
        this.document = document;
        this.triggerId = triggerId || foundry.utils.randomID();
        this.documentType = options.documentType || 'actor'; // Store document type
        this._currentTriggerData = null; // Store in-memory trigger data
        this._onCloseCb = options?.onClose || null;
        this._closeCallbackCalled = false; // Track if callback was already called
        
        // Store the callback in multiple ways to ensure it survives Foundry internals
        this._wodOnCloseCallback = options?.onClose || null;
        this._wodCallbackBackup = options?.onClose;
        
        // Store it in a Map which is less likely to be interfered with
        this._wodCallbacks = new Map();
        if (options?.onClose) {
            this._wodCallbacks.set('onClose', options.onClose);
        }
        
        this._pickMode = null;
        this._pickHandlers = null;
        this._triggerAPI = TriggerAPI.getInstance();
        this._effectAutocompletes = new Map(); // Store autocomplete instances
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sheet", "wod-trigger-config"],
            template: "systems/wodsystem/templates/apps/wod-trigger-config-dialog.html",
            width: 480,
            height: "auto",
            closeOnSubmit: true,
            submitOnChange: false,
            resizable: true,
            title: "Configure Trigger"
        });
    }

    /**
     * Get available events based on target type
     * @returns {Array} Array of event objects
     * @private
     */
    _getAvailableEvents() {
        // If form exists (after render), use the current target selection
        if (this.form) {
            // this.form is a DOM element, so use jQuery to find elements
            const $form = $(this.form);
            const targetCsv = $form.find('select[name="targetCsv"]').val() || '';
            const targetType = this._determineTargetType(targetCsv);
            console.log(`WoD TriggerConfig | _getAvailableEvents - targetType: ${targetType}, targetCsv: ${targetCsv}`);
            return this._getEventsForTargetType(targetType);
        }
        
        // During getData(), the form doesn't exist yet, so use default actor events
        console.log(`WoD TriggerConfig | _getAvailableEvents - Using default actor events (form not ready)`);
        return this._getEventsForTargetType('actor');
    }

    /**
     * Determine target type from targetCsv value
     * @param {string} targetCsv - The target CSV value
     * @returns {string} The target type category
     * @private
     */
    _determineTargetType(targetCsv) {
        if (!targetCsv) return 'actor'; // Default to actor events
        
        // Handle special conditions
        if (targetCsv.startsWith('hasEffect') || targetCsv.startsWith('is')) {
            return 'actor';
        }
        
        // Handle universal
        if (targetCsv === 'any') {
            return 'actor';
        }
        
        // Handle element types
        if (['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(targetCsv)) {
            return targetCsv;
        }
        
        // Handle "any:" prefixes - determine from the types
        if (targetCsv.startsWith('any:')) {
            const types = targetCsv.substring(4).split(',').map(t => t.trim());
            // If any of the types are element types, use those
            if (types.some(t => ['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(t))) {
                return types.find(t => ['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(t));
            }
            return 'actor';
        }
        
        // Handle direct actor types
        const actorTypes = ['Mortal', 'Technocrat', 'Mage', 'Spirit', 'Demon', 'Earthbound', 
                          'Mortal-NPC', 'Technocrat-NPC', 'Mage-NPC', 'Demon-NPC'];
        if (actorTypes.some(type => targetCsv.includes(type))) {
            return 'actor';
        }
        
        // Default to actor
        return 'actor';
    }

    /**
     * Get events for a specific target type
     * @param {string} targetType - The target type
     * @returns {Array} Array of event objects
     * @private
     */
    _getEventsForTargetType(targetType) {
        console.log(`WoD TriggerConfig | _getEventsForTargetType called with targetType: ${targetType}`);
        
        const registry = game.wod?.triggerEventRegistry;
        console.log(`WoD TriggerConfig | Registry available:`, !!registry);
        
        if (!registry) {
            console.log(`WoD TriggerConfig | Registry not available, using default events`);
            return this._getDefaultEvents();
        }
        
        const allEvents = registry.getAllEvents();
        console.log(`WoD TriggerConfig | All events available:`, allEvents.map(e => e.id));
        
        switch (targetType) {
            case 'actor':
                // Actor events: onEffectApplied, onEffectRemoved, onHealthChanged, onAttributeChanged
                const actorEvents = allEvents.filter(event => 
                    event.documentTypes?.includes('actor')
                );
                console.log(`WoD TriggerConfig | Actor events filtered:`, actorEvents.map(e => e.id));
                return actorEvents;
                
            case 'doors':
            case 'walls':
                // Door events: onDoorOpened, onDoorClosed, onDoorLocked, onDoorUnlocked
                return allEvents.filter(event => 
                    event.documentTypes?.includes('wall') || 
                    event.documentTypes?.includes('scene')
                ).filter(event => 
                    event.category === 'door'
                );
                
            case 'tokens':
                // Token events: onEnter, onExit, onProximity, onEffect
                return allEvents.filter(event => 
                    event.documentTypes?.includes('tile') || 
                    event.documentTypes?.includes('region')
                ).filter(event => 
                    ['movement', 'effect'].includes(event.category)
                );
                
            case 'tiles':
                // Tile events: onEnter, onExit, onProximity, onEffect
                return allEvents.filter(event => 
                    event.documentTypes?.includes('tile')
                );
                
            case 'regions':
                // Region events: onEnter, onExit, onProximity, onEffect
                return allEvents.filter(event => 
                    event.documentTypes?.includes('region')
                );
                
            default:
                return this._getDefaultEvents();
        }
    }

    /**
     * Get default events (fallback)
     * @returns {Array} Default event options
     * @private
     */
    _getDefaultEvents() {
        return [
            { id: 'onEffectApplied', label: 'Effect Applied', description: 'Fires when an effect is applied' },
            { id: 'onEffectRemoved', label: 'Effect Removed', description: 'Fires when an effect is removed' },
            { id: 'onHealthChanged', label: 'Health Changed', description: 'Fires when health changes' },
            { id: 'onEnter', label: 'Token Enters', description: 'Fires when a token enters' },
            { id: 'onExit', label: 'Token Exits', description: 'Fires when a token exits' },
            { id: 'onDoorOpened', label: 'Door Opened', description: 'Fires when a door is opened' }
        ];
    }

    getData() {
        const flagPath = this._getFlagPath();
        const triggers = this.document.getFlag('wodsystem', flagPath) || [];
        const existing = Array.isArray(triggers) ? triggers.find(t => t?.id === this.triggerId) : null;
        
        console.log('WoD Trigger Config Dialog | getData - existing trigger:', existing);
        console.log('WoD Trigger Config Dialog | getData - in-memory data:', this._currentTriggerData);
        console.log('WoD Trigger Config Dialog | getData - in-memory conditions:', this._currentTriggerData?.trigger?.conditions?.length || 0);
        
        // Use in-memory data if available, otherwise use existing trigger data
        let triggerData = this._currentTriggerData || existing;
        
        // If we have saved data, clear in-memory data to use saved data instead
        if (existing && this._currentTriggerData) {
            console.log('WoD Trigger Config Dialog | Clearing in-memory data, using saved trigger');
            this._currentTriggerData = null;
            triggerData = existing; // Use existing trigger data instead
        }
        
        console.log('WoD Trigger Config Dialog | getData - triggerData conditions:', triggerData?.trigger?.conditions?.length || 0);
        
        // Default trigger structure (clean format)
        const defaultTrigger = {
            id: this.triggerId,
            name: "",
            enabled: true,
            priority: 10,
            trigger: {
                // Clean format - no legacy fields
                actorTypes: [],
                // New format
                scope: {
                    type: 'tile',
                    target: null,
                    tile: { boundary: 'enter' },
                    region: { boundary: 'enter' },
                    proximity: { distance: 5, unit: 'grid', shape: 'circle' }
                },
                conditions: [],
                execution: {
                    mode: 'event',
                    event: 'onEnter',  // Only for event mode
                    timing: { delay: 0, repeat: 0, duration: null }
                }
            },
            roll: {
                enabled: false,
                type: 'attribute+ability',
                attribute: '',
                ability: '',
                poolName: '',
                difficulty: 6,
                successThreshold: 1
            },
            actions: {
                always: [],
                success: [],
                failure: []
            }
        };
        
        const trigger = foundry.utils.duplicate(triggerData || defaultTrigger);
        
                
        // Ensure new format fields exist
        if (!trigger.trigger.scope) {
            trigger.trigger.scope = defaultTrigger.trigger.scope;
        }
        if (!trigger.trigger.conditions) {
            trigger.trigger.conditions = [];
        }
        if (!trigger.trigger.execution) {
            trigger.trigger.execution = defaultTrigger.trigger.execution;
        }
        
        // Auto-detect scope type based on document type (but not for actors - let them choose)
        const registry = TriggerEventRegistry.getInstance();
        const detectedDocumentType = registry.detectDocumentType(this.document);
        const isActor = this.document.documentName === 'Actor';
        const autoScopeType = detectedDocumentType || 'tile'; // Default to tile if detection fails
        
                
        // Get condition types from TriggerAPI
        const conditionTypes = this._triggerAPI.getConditionTypes();
        
        // Get available events for this document type from TriggerEventRegistry
        const documentType = detectedDocumentType;
        const availableEvents = this._getAvailableEvents(); // Use dynamic event filtering based on target

        return {
            trigger,
            isNew: !existing,
            targetCsv: this._formatTargetCsv(trigger.trigger?.actorTypes || []), // Convert legacy actorTypes to targetCsv
            availableEffects: this._getAvailableEffects(),
            availableAttributes: this._getAvailableAttributes(),
            availableAbilities: this._getAvailableAbilities(),
            availablePools: this._getAvailablePools(),
            // New format data
            conditionTypes: Object.values(conditionTypes),
            currentScopeType: isActor ? (trigger.trigger?.scope?.type || 'actor') : autoScopeType, // Use auto-detected for non-actors
            hasConditions: trigger.trigger?.conditions?.length > 0,
            // V2 architecture data
            documentType: documentType,
            availableEvents: availableEvents
        };
        
        console.log('WoD Trigger Config Dialog | getData - final trigger conditions:', trigger.trigger?.conditions?.length || 0);
        console.log('WoD Trigger Config Dialog | getData - final hasConditions:', data.hasConditions);
        return data;
    }

    /**
     * Update event dropdown when target changes
     * @private
     */
    _updateEventDropdown() {
        // Use jQuery to find elements since this.form is now a DOM element
        const $form = $(this.form);
        const targetSelect = $form.find('select[name="targetCsv"]');
        const eventSelect = $form.find('select[name="trigger.eventType"]');
        
        if (!targetSelect.length || !eventSelect.length) return;
        
        const currentEvent = eventSelect.val();
        const availableEvents = this._getAvailableEvents();
        
        // Clear and repopulate event dropdown
        eventSelect.empty();
        
        // Add default option
        eventSelect.append('<option value="">-- Select Event --</option>');
        
        // Group events by category
        const eventsByCategory = {};
        availableEvents.forEach(event => {
            const category = event.category || 'general';
            if (!eventsByCategory[category]) {
                eventsByCategory[category] = [];
            }
            eventsByCategory[category].push(event);
        });
        
        // Add events grouped by category
        Object.entries(eventsByCategory).forEach(([category, events]) => {
            const optgroup = $(`<optgroup label="${category.charAt(0).toUpperCase() + category.slice(1)} Events">`);
            
            events.forEach(event => {
                const option = $(`<option value="${event.id}">${event.label}</option>`)
                    .attr('title', event.description || '');
                if (event.id === currentEvent) {
                    option.prop('selected', true);
                }
                optgroup.append(option);
            });
            
            eventSelect.append(optgroup);
        });
        
        // If current event is not in the new list, select the first available
        if (!eventSelect.find(`option[value="${currentEvent}"]`).length && availableEvents.length > 0) {
            eventSelect.val(availableEvents[0].id);
        }
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Inject trigger configuration CSS if not already loaded
        if (!document.getElementById('wod-trigger-config-css')) {
            const link = document.createElement('link');
            link.id = 'wod-trigger-config-css';
            link.rel = 'stylesheet';
            link.href = 'systems/wodsystem/styles/themes/trigger-config.css';
            document.head.appendChild(link);
        }

        // Store form reference for later use (DOM element, not jQuery object)
        this.form = html[0] || html.get(0);

        // Initialize event dropdown based on current target selection
        this._updateEventDropdown();

        // Handle target type changes to update event dropdown
        html.find('select[name="targetCsv"]').on('change', this._onTargetChange.bind(this));

        // Handle event type changes to show/hide effect configuration
        html.find('select[name="trigger.eventType"]').on('change', this._onEventTypeChange.bind(this));

        // Initialize effect field visibility
        this._updateEffectFieldVisibility(html);
        
        // Initialize autocompletes for existing hasEffect conditions
        this._initializeConditionAutocompletes(html);

        // Cancel button
        html.find('button[data-action="cancel"]').on('click', (ev) => {
            ev.preventDefault();
            this.close();
        });

        // Toggle roll section visibility
        html.find('input[data-action="toggle-roll"]').on('change', (ev) => {
            const checked = ev.currentTarget.checked;
            html.find('.roll-config').toggle(checked);
            html.find('.roll-dependent').toggle(checked);
        });

        // Toggle roll type fields
        html.find('select[data-action="change-roll-type"]').on('change', (ev) => {
            const type = ev.currentTarget.value;
            html.find('.roll-attribute-ability').toggle(type === 'attribute+ability');
            html.find('.roll-single').toggle(type === 'single');
        });

        // Handle execution mode changes to show/hide event field
        html.find('select[name="trigger.execution.mode"]').on('change', (ev) => {
            const executionMode = ev.currentTarget.value;
            const eventField = html.find('.event-field');
            eventField.toggle(executionMode === 'event');
            
            console.log('WoD Trigger Config Dialog | Execution mode changed to:', executionMode);
            console.log('WoD Trigger Config Dialog | Event field found:', eventField.length > 0);
        });

        // Initialize event field visibility based on current mode
        const currentMode = html.find('select[name="trigger.execution.mode"]').val();
        const eventField = html.find('.event-field');
        eventField.toggle(currentMode === 'event');
        console.log('WoD Trigger Config Dialog | Initial execution mode:', currentMode);
        console.log('WoD Trigger Config Dialog | Initial event field visibility:', currentMode === 'event');

        // Add condition button
        const addConditionBtn = html.find('button[data-action="add-condition"]');
        addConditionBtn.on('click', async (ev) => {
            ev.preventDefault();
            await this._addCondition();
        });

        // Remove condition buttons - use event delegation for dynamic content
        html.off('click', 'button[data-action="remove-condition"]').on('click', 'button[data-action="remove-condition"]', async (ev) => {
            ev.preventDefault();
            const index = Number(ev.currentTarget.dataset.index);
            await this._removeCondition(index);
        });

        // Handle condition type changes to enable/disable autocomplete
        html.off('change', '.condition-type').on('change', '.condition-type', (ev) => {
            const conditionType = ev.currentTarget.value;
            const conditionRow = ev.currentTarget.closest('.condition-row');
            const valueInput = conditionRow.querySelector('.condition-value');
            const index = conditionRow.dataset.index;
            
            if (conditionType === 'hasEffect' || conditionType === 'removedEffect') {
                this._setupEffectAutocomplete(valueInput, index);
            } else {
                this._removeEffectAutocomplete(valueInput);
            }
        });

        // Add action buttons
        html.find('button[data-action="add-action"]').on('click', async (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const type = ev.currentTarget.dataset.type;
            await this._addAction(outcome, type);
        });

        // Remove action buttons - use event delegation for dynamic content
        html.off('click', 'button[data-action="remove-action"]').on('click', 'button[data-action="remove-action"]', async (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const index = Number(ev.currentTarget.dataset.index);
            await this._removeAction(outcome, index);
        });

        // Pick target from scene (legacy)
        html.find('button[data-action="pick-target"]').on('click', (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const index = Number(ev.currentTarget.dataset.index);
            this._startPickTarget(outcome, index);
        });

        // Pick element for new target system
        html.on('click', 'button[data-action="pick-element"]', (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const index = Number(ev.currentTarget.dataset.index);
            const actionRow = $(ev.currentTarget).closest('.action-row');
            const elementType = actionRow.find('.target-element-type').val() || 'wall';
            this._startPickElement(outcome, index, elementType);
        });

        // Handle target mode changes - show/hide element ID fields
        html.on('change', '.target-mode', (ev) => {
            const mode = ev.currentTarget.value;
            const actionRow = $(ev.currentTarget).closest('.action-row, .action-grid');
            const idCell = actionRow.find('.target-id-cell');
            const idInput = actionRow.find('input[name$=".target.elementId"]');
            const typeCell = actionRow.find('.target-type-cell');
            
            // Show/hide element ID field based on mode
            if (mode === 'specific') {
                idCell.show();
                idInput.show();
            } else {
                idCell.hide();
                idInput.hide();
            }
            
            // Show/hide element type for non-triggering modes
            if (mode === 'triggering') {
                typeCell.hide();
            } else {
                typeCell.show();
            }
        });

        // Pick asset from file browser
        const assetButtons = html.find('button[data-action="pick-asset"]');
        assetButtons.on('click', (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const index = Number(ev.currentTarget.dataset.index);
            this._startPickAsset(outcome, index);
        });

        // Handle effect action type changes
        html.find('select.effect-action-type').on('change', (ev) => {
            const select = ev.currentTarget;
            const actionRow = select.closest('.action-row');
            const tileImgInput = actionRow.find('.tile-image-input');
            const tileTargetSection = actionRow.find('.tile-target-section');
            const effectIdInput = actionRow.find('input[name$=".effectId"]');
            const targetLabel = actionRow.find('span.action-type-label');
            
            if (select.value === 'changeTileAsset') {
                tileImgInput.show();
                tileTargetSection.show();
                effectIdInput.hide();
                if (targetLabel.text() === 'Effect:') {
                    targetLabel.text('Tile:');
                }
                // Initialize checkbox state
                const checkbox = tileTargetSection.find('input[name$=".useCurrentTile"]');
                this._updateTilePickerVisibility(checkbox);
            } else {
                tileImgInput.hide();
                tileTargetSection.hide();
                effectIdInput.show();
                if (targetLabel.text() === 'Tile:') {
                    targetLabel.text('Effect:');
                }
            }
        });

        // Handle use current tile checkbox changes
        html.find('input[name$=".useCurrentTile"]').on('change', (ev) => {
            this._updateTilePickerVisibility($(ev.currentTarget));
        });

        // Initialize visibility for existing actions
        html.find('select.effect-action-type').each((i, select) => {
            const $select = $(select);
            const actionRow = $select.closest('.action-row');
            const tileImageInput = actionRow.find('.tile-image-input');
            const tileTargetSection = actionRow.find('.tile-target-section');
            const effectIdInput = actionRow.find('input[name$=".effectId"]');
            const targetLabel = actionRow.find('span.action-type-label');
            
            if ($select.val() === 'changeTileAsset') {
                tileImageInput.show();
                tileTargetSection.show();
                effectIdInput.hide();
                if (targetLabel.text() === 'Effect:') {
                    targetLabel.text('Tile:');
                }
                // Initialize checkbox state
                const checkbox = tileTargetSection.find('input[name$=".useCurrentTile"]');
                this._updateTilePickerVisibility(checkbox);
            } else {
                tileImageInput.hide();
                tileTargetSection.hide();
                effectIdInput.show();
                if (targetLabel.text() === 'Tile:') {
                    targetLabel.text('Effect:');
                }
            }
        });
    }

    async _addAction(outcome, type) {
        const flagPath = this._getFlagPath();
        const triggers = this.document.getFlag('wodsystem', flagPath) || [];
        let triggerIndex = triggers.findIndex(t => t?.id === this.triggerId);
        
        let trigger;
        if (triggerIndex >= 0) {
            trigger = foundry.utils.duplicate(triggers[triggerIndex]);
        } else {
            trigger = this.getData().trigger;
            triggerIndex = triggers.length;
            triggers.push(trigger);
        }

        trigger.actions = trigger.actions || { always: [], success: [], failure: [] };
        trigger.actions[outcome] = trigger.actions[outcome] || [];

        // Default target config - all actions now have cross-element targeting
        const defaultTarget = { mode: 'triggering', elementType: 'actor', elementId: '' };
        
        if (type === 'door') {
            trigger.actions[outcome].push({ 
                type: 'door', 
                target: { mode: 'specific', elementType: 'wall', elementId: '' },
                state: 'open',
                delay: 0
            });
        } else if (type === 'tileAsset') {
            trigger.actions[outcome].push({ 
                type: 'changeTileAsset', 
                target: { mode: 'self', elementType: 'tile', elementId: '' },
                tileImg: '', 
                useCurrentTile: true,
                delay: 0
            });
        } else {
            trigger.actions[outcome].push({ 
                type: 'enableCoreEffect', 
                target: defaultTarget,
                effectId: '',
                delay: 0
            });
        }

        triggers[triggerIndex] = trigger;
        await this.document.setFlag('wodsystem', flagPath, triggers);
        this.render(false);
    }

    async _removeAction(outcome, index) {
        const flagPath = this._getFlagPath();
        const triggers = this.document.getFlag('wodsystem', flagPath) || [];
        const triggerIndex = triggers.findIndex(t => t?.id === this.triggerId);
        
        if (triggerIndex < 0) {
            // Trigger not saved yet, just re-render
            this.render(false);
            return;
        }

        const trigger = foundry.utils.duplicate(triggers[triggerIndex]);
        if (!Array.isArray(trigger.actions?.[outcome])) return;

        trigger.actions[outcome].splice(index, 1);
        triggers[triggerIndex] = trigger;

        await this.document.setFlag('wodsystem', flagPath, triggers);
        this.render(false);
    }

    _startPickTarget(outcome, index) {
        if (!canvas?.ready) {
            ui.notifications?.warn('Canvas not ready');
            return;
        }

        this._stopPickMode();

        const previousLayer = canvas.activeLayer?.options?.name;

        // Determine what type of action this is to know what to pick
        const actionRow = $(this.element).find(`.action-row[data-index="${index}"]`);
        const actionType = actionRow.find('input[name$=".type"]').val();
        const isTileAction = actionType === 'changeTileAsset';

        this._pickMode = { outcome, index, previousLayer, isTileAction };

        if (isTileAction) {
            ui.notifications?.info('Click a tile on the canvas to select it. Press Escape to cancel.');
            
            // Activate tiles layer
            try {
                canvas.tiles?.activate();
            } catch (e) {
                console.warn('Could not activate tiles layer', e);
            }

            // Listen for tile control
            const onControlTile = (tile, controlled) => {
                if (!controlled || !this._pickMode) return;
                
                const tileId = tile?.document?.id;
                if (!tileId) return;
                
                this._setTileTarget(this._pickMode.outcome, this._pickMode.index, tileId);
                this._stopPickMode();
            };

            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    this._stopPickMode();
                }
                // Add defensive check to prevent focus errors
                try {
                    if (event.target && typeof event.target.focus === 'function') {
                        // Focus method exists, continue
                    }
                } catch (error) {
                    // Ignore focus-related errors
                    console.warn('WoD TriggerConfig | Focus error in keydown handler:', error);
                }
            };

            this._pickHandlers = { onControlTile, onKeyDown };
            Hooks.on('controlTile', onControlTile);
            document.addEventListener('keydown', onKeyDown);
        } else {
            ui.notifications?.info('Click a wall or door on the canvas to select it. Press Escape to cancel.');

            // Activate walls layer
            try {
                canvas.walls?.activate();
            } catch (e) {
                console.warn('Could not activate walls layer', e);
            }

            // Listen for wall control
            const onControlWall = (wall, controlled) => {
                if (!controlled || !this._pickMode) return;
                
                const wallId = wall?.document?.id;
                if (!wallId) return;
                
                this._setDoorTarget(this._pickMode.outcome, this._pickMode.index, wallId);
                this._stopPickMode();
            };

            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    this._stopPickMode();
                }
                // Add defensive check to prevent focus errors
                try {
                    if (event.target && typeof event.target.focus === 'function') {
                        // Focus method exists, continue
                    }
                } catch (error) {
                    // Ignore focus-related errors
                    console.warn('WoD TriggerConfig | Focus error in keydown handler:', error);
                }
            };

            this._pickHandlers = { onControlWall, onKeyDown };
            Hooks.on('controlWall', onControlWall);
            document.addEventListener('keydown', onKeyDown);
        }
    }

    _stopPickMode() {
        if (this._pickHandlers?.onControlWall) {
            Hooks.off('controlWall', this._pickHandlers.onControlWall);
        }
        if (this._pickHandlers?.onControlTile) {
            Hooks.off('controlTile', this._pickHandlers.onControlTile);
        }
        if (this._pickHandlers?.onControlToken) {
            Hooks.off('controlToken', this._pickHandlers.onControlToken);
        }
        if (this._pickHandlers?.onKeyDown) {
            document.removeEventListener('keydown', this._pickHandlers.onKeyDown);
        }

        const previousLayer = this._pickMode?.previousLayer;
        this._pickMode = null;
        this._pickHandlers = null;

        // Restore previous layer
        if (previousLayer && canvas?.[previousLayer]?.activate) {
            try {
                canvas[previousLayer].activate();
            } catch (e) {
                console.warn('Could not restore previous layer', e);
            }
        }
    }

    _setTileTarget(outcome, index, tileId) {
        const tileInput = $(this.element).find(`input[name="actions.${outcome}.${index}.tileId"]`);
        tileInput.val(tileId);
    }

    _setDoorTarget(outcome, index, wallId) {
        const targetInput = $(this.element).find(`input[name="actions.${outcome}.${index}.target"]`);
        targetInput.val(wallId);
    }

    async _startPickAsset(outcome, index) {
        try {
            const result = await new FilePicker({
                type: 'image',
                callback: (path) => {
                    this._setAssetTarget(outcome, index, path);
                },
                current: $(this.element).find(`input[name="actions.${outcome}.${index}.tileImg"]`).val()
            }).render(true);
        } catch (error) {
            console.error('Error opening file picker:', error);
            ui.notifications?.error('Failed to open asset browser');
        }
    }

    _setAssetTarget(outcome, index, assetPath) {
        const assetInput = $(this.element).find(`input[name="actions.${outcome}.${index}.tileImg"]`);
        assetInput.val(assetPath);
    }

    /**
     * Start pick mode for selecting an element from the scene
     * @param {string} outcome - Action outcome (always, success, failure)
     * @param {number} index - Action index
     * @param {string} elementType - Type of element to pick (wall, tile, token, actor)
     */
    _startPickElement(outcome, index, elementType) {
        if (!canvas?.ready) {
            ui.notifications?.warn('Canvas not ready');
            return;
        }

        this._stopPickMode();
        const previousLayer = canvas.activeLayer?.options?.name;
        this._pickMode = { outcome, index, previousLayer, elementType };

        const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    this._stopPickMode();
                }
                // Add defensive check to prevent focus errors
                try {
                    if (event.target && typeof event.target.focus === 'function') {
                        // Focus method exists, continue
                    }
                } catch (error) {
                    // Ignore focus-related errors
                    console.warn('WoD TriggerConfig | Focus error in keydown handler:', error);
                }
            };

        switch (elementType) {
            case 'wall':
                ui.notifications?.info('Click a door on the canvas. Press Escape to cancel.');
                try { canvas.walls?.activate(); } catch (e) { /* ignore */ }
                
                const onControlWall = (wall, controlled) => {
                    if (!controlled || !this._pickMode) return;
                    const wallId = wall?.document?.id;
                    if (!wallId) return;
                    this._setElementTarget(this._pickMode.outcome, this._pickMode.index, wallId);
                    this._stopPickMode();
                };
                this._pickHandlers = { onControlWall, onKeyDown };
                Hooks.on('controlWall', onControlWall);
                break;

            case 'tile':
                ui.notifications?.info('Click a tile on the canvas. Press Escape to cancel.');
                try { canvas.tiles?.activate(); } catch (e) { /* ignore */ }
                
                const onControlTile = (tile, controlled) => {
                    if (!controlled || !this._pickMode) return;
                    const tileId = tile?.document?.id;
                    if (!tileId) return;
                    this._setElementTarget(this._pickMode.outcome, this._pickMode.index, tileId);
                    this._stopPickMode();
                };
                this._pickHandlers = { onControlTile, onKeyDown };
                Hooks.on('controlTile', onControlTile);
                break;

            case 'token':
                ui.notifications?.info('Click a token on the canvas. Press Escape to cancel.');
                try { canvas.tokens?.activate(); } catch (e) { /* ignore */ }
                
                const onControlToken = (token, controlled) => {
                    if (!controlled || !this._pickMode) return;
                    const tokenId = token?.document?.id;
                    if (!tokenId) return;
                    this._setElementTarget(this._pickMode.outcome, this._pickMode.index, tokenId);
                    this._stopPickMode();
                };
                this._pickHandlers = { onControlToken, onKeyDown };
                Hooks.on('controlToken', onControlToken);
                break;

            case 'actor':
                // For actors, show a dialog to select from game.actors
                this._showActorPicker(outcome, index);
                return;

            default:
                ui.notifications?.warn(`Unknown element type: ${elementType}`);
                return;
        }

        document.addEventListener('keydown', onKeyDown);
    }

    /**
     * Show actor picker dialog
     */
    async _showActorPicker(outcome, index) {
        const actors = game.actors.contents.map(a => ({ id: a.id, name: a.name }));
        if (actors.length === 0) {
            ui.notifications?.warn('No actors available');
            return;
        }

        const content = `<form><div class="form-group"><label>Select Actor</label>
            <select name="actorId">${actors.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
        </div></form>`;

        new Dialog({
            title: 'Select Actor',
            content,
            buttons: {
                select: {
                    label: 'Select',
                    callback: (html) => {
                        const actorId = html.find('select[name="actorId"]').val();
                        this._setElementTarget(outcome, index, actorId);
                    }
                },
                cancel: { label: 'Cancel' }
            },
            default: 'select'
        }).render(true);
    }

    /**
     * Set element target ID for an action
     */
    _setElementTarget(outcome, index, elementId) {
        const targetInput = $(this.element).find(`input[name="actions.${outcome}.${index}.target.elementId"]`);
        targetInput.val(elementId);
    }

    async _addCondition() {
        const flagPath = this._getFlagPath();
        const triggers = this.document.getFlag('wodsystem', flagPath) || [];
        const triggerIndex = triggers.findIndex(t => t?.id === this.triggerId);
        
        if (triggerIndex < 0) {
            // Trigger not saved yet, add condition to in-memory data
            const currentData = this.getData();
            if (!currentData.trigger.trigger.conditions) {
                currentData.trigger.trigger.conditions = [];
            }
            currentData.trigger.trigger.conditions.push({
                type: 'hasEffect',
                operator: 'equals',
                value: '',
                logic: 'none'
            });
            
            // Store the updated data in memory (only the trigger part)
            this._currentTriggerData = currentData.trigger;
            console.log('WoD Trigger Config Dialog | Add condition - stored in-memory data with conditions:', currentData.trigger.trigger.conditions.length);
            
            this.render(false);
            return;
        }

        const trigger = foundry.utils.duplicate(triggers[triggerIndex]);
        if (!trigger.trigger.conditions) {
            trigger.trigger.conditions = [];
        }
        
        // Add new condition with defaults
        trigger.trigger.conditions.push({
            type: 'hasEffect',
            operator: 'equals',
            value: '',
            logic: 'none'
        });
        
        triggers[triggerIndex] = trigger;
        await this.document.setFlag('wodsystem', flagPath, triggers);
        this.render(false);
    }

    async _removeCondition(index) {
        const flagPath = this._getFlagPath();
        const triggers = this.document.getFlag('wodsystem', flagPath) || [];
        const triggerIndex = triggers.findIndex(t => t?.id === this.triggerId);
        
        if (triggerIndex < 0) {
            // Trigger not saved yet, remove condition from in-memory data
            console.log('WoD Trigger Config Dialog | Remove condition - trigger not saved, removing from in-memory data');
            if (this._currentTriggerData?.trigger?.conditions) {
                this._currentTriggerData.trigger.conditions.splice(index, 1);
                console.log('WoD Trigger Config Dialog | Remove condition - removed from in-memory data, remaining conditions:', this._currentTriggerData.trigger.conditions.length);
            }
            this.render(false);
            return;
        }

        const trigger = foundry.utils.duplicate(triggers[triggerIndex]);
        if (!Array.isArray(trigger.trigger?.conditions)) return;

        trigger.trigger.conditions.splice(index, 1);
        triggers[triggerIndex] = trigger;

        await this.document.setFlag('wodsystem', flagPath, triggers);
        this.render(false);
    }
    
    /**
     * Setup effect autocomplete for a condition value input
     * @private
     */
    _setupEffectAutocomplete(input, index) {
        // Remove existing autocomplete if any
        this._removeEffectAutocomplete(input);
        
        // Create new autocomplete
        const autocomplete = new EffectAutocomplete(input, {
            maxResults: 8,
            minQueryLength: 1
        });
        
        // Store reference
        this._effectAutocompletes.set(index, autocomplete);
    }
    
    /**
     * Remove effect autocomplete from an input
     * @private
     */
    _removeEffectAutocomplete(input) {
        // Find and destroy autocomplete by input element
        for (const [index, autocomplete] of this._effectAutocompletes) {
            if (autocomplete.input === input) {
                autocomplete.destroy();
                this._effectAutocompletes.delete(index);
                break;
            }
        }
    }
    
    /**
     * Clean up all autocompletes
     * @private
     */
    _cleanupAutocompletes() {
        for (const autocomplete of this._effectAutocompletes.values()) {
            autocomplete.destroy();
        }
        this._effectAutocompletes.clear();
    }
    
    /**
     * Initialize autocompletes for existing conditions
     * @private
     */
    _initializeConditionAutocompletes(html) {
        html.find('.condition-row').each((index, row) => {
            const conditionType = row.querySelector('.condition-type')?.value;
            const valueInput = row.querySelector('.condition-value');
            
            if ((conditionType === 'hasEffect' || conditionType === 'removedEffect') && valueInput) {
                this._setupEffectAutocomplete(valueInput, index);
            }
        });
    }

    _updateTilePickerVisibility(checkbox) {
        const actionRow = checkbox.closest('.action-row');
        const tilePickerSection = actionRow.find('.tile-picker-section');
        
        if (checkbox.is(':checked')) {
            tilePickerSection.hide();
        } else {
            tilePickerSection.show();
        }
    }

    _parseActionsFromFormData(formData) {
        const actions = {
            always: [],
            success: [],
            failure: []
        };

        // Parse actions from flat form data
        Object.keys(formData).forEach(key => {
            if (key.startsWith('actions.')) {
                const parts = key.split('.');
                if (parts.length >= 4) {
                    const outcome = parts[1]; // always, success, failure
                    const index = parseInt(parts[2]); // 0, 1, 2...
                    const field = parts[3]; // type, target, state, etc.
                    const subField = parts.length > 4 ? parts[4] : null; // mode, elementType, elementId (for nested target)

                    if (!isNaN(index) && actions[outcome]) {
                        // Ensure array has enough elements
                        while (actions[outcome].length <= index) {
                            actions[outcome].push({});
                        }

                        // Get the action type first
                        const actionTypeKey = `actions.${outcome}.${index}.type`;
                        const actionType = actions[outcome][index].type || formData[actionTypeKey] || 'door';
                        
                        // Handle nested target config (target.mode, target.elementType, target.elementId)
                        if (field === 'target' && subField) {
                            if (!actions[outcome][index].target) {
                                actions[outcome][index].target = { mode: 'triggering', elementType: 'actor', elementId: '' };
                            }
                            actions[outcome][index].target[subField] = formData[key];
                        }
                        // Handle regular fields (no subField)
                        else if (!subField) {
                            // Set type for all action types
                            if (field === 'type') {
                                actions[outcome][index].type = formData[key] || actionType;
                            }
                            // Common fields
                            else if (field === 'delay') {
                                actions[outcome][index].delay = parseFloat(formData[key]) || 0;
                            }
                            // Action-specific fields
                            else if (actionType === 'changeTileAsset') {
                                if (field === 'tileImg' || field === 'useCurrentTile') {
                                    actions[outcome][index][field] = formData[key];
                                }
                            } else if (actionType === 'door') {
                                if (field === 'state') {
                                    actions[outcome][index][field] = formData[key];
                                }
                            } else {
                                // Core effect fields
                                if (field === 'effectId') {
                                    actions[outcome][index][field] = formData[key];
                                }
                            }
                        }
                    }
                }
            }
        });

        return actions;
    }
    
    /**
     * Parse conditions from form data
     * @private
     */
    _parseConditionsFromFormData(formData, $form) {
        const conditions = [];
        
        // Find all condition rows
        $form.find('.condition-row').each((index, row) => {
            const $row = $(row);
            const conditionType = $row.find('.condition-type').val();
            const operator = $row.find('.condition-operator').val();
            const value = $row.find('.condition-value').val();
            const logic = $row.find('.condition-logic').val();
            
            // Only add condition if type is specified
            if (conditionType) {
                conditions.push({
                    type: conditionType,
                    operator: operator || 'equals',
                    value: value || '',
                    logic: logic || 'none'
                });
            }
        });
        
        // Store conditions in form data
        formData['trigger.conditions'] = conditions;
    }
    
    /**
     * Parse scope configuration from form data
     * @private
     */
    _parseScopeFromFormData(formData) {
        // Use auto-detected scope type if available, otherwise use form data
        const scopeType = formData['trigger.scope.type'] || 'tile';
        const scope = {
            type: scopeType
        };
        
        switch (scopeType) {
            case 'proximity':
                scope.proximity = {
                    distance: Number(formData['trigger.scope.proximity.distance'] || 5),
                    unit: formData['trigger.scope.proximity.unit'] || 'grid',
                    shape: formData['trigger.scope.proximity.shape'] || 'circle'
                };
                break;
            case 'tile':
                scope.target = formData['trigger.scope.target'] || '';
                break;
            case 'region':
                scope.target = formData['trigger.scope.target'] || '';
                break;
            case 'global':
                // Global scope has no additional config
                break;
        }
        
        return scope;
    }
    
    /**
     * Parse target configuration from form data
     * @private
     */
    _parseTargetFromFormData(formData) {
        const targetType = formData['trigger.target.type'] || 'actors';
        const target = {
            type: targetType
        };
        
        switch (targetType) {
            case 'actorsWithEffect':
                target.effectName = formData['trigger.target.effectName'] || '';
                break;
            case 'specificActors':
            case 'specificDoors':
                target.ids = formData['trigger.target.ids'] || '';
                break;
            // Other types don't need additional config
        }
        
        return target;
    }

    /**
     * Parse execution configuration from form data
     * @private
     */
    _parseExecutionFromFormData(formData) {
        const executionMode = formData['trigger.execution.mode'] || 'event';
        
        console.log('WoD TriggerConfig | _parseExecutionFromFormData called with:', {
            executionMode: formData['trigger.execution.mode'],
            eventType: formData['trigger.eventType']
        });
        
        const execution = {
            mode: executionMode,
            timing: {
                delay: Number(formData['trigger.execution.timing.delay'] || 0),
                repeat: Number(formData['trigger.execution.timing.repeat'] || 0),
                duration: formData['trigger.execution.timing.duration'] ? 
                    Number(formData['trigger.execution.timing.duration']) : null
            }
        };
        
        // Only include event field for event mode
        if (executionMode === 'event') {
            execution.event = formData['trigger.eventType'] || 'onEnter';
            console.log('WoD TriggerConfig | Event mode - setting event to:', execution.event);
        } else {
            console.log('WoD TriggerConfig | Non-event mode - no event field set');
        }
        
        console.log('WoD TriggerConfig | Final execution object:', execution);
        return execution;
    }

    async _saveTrigger(formData, _) {
        
        const parsedActions = this._parseActionsFromFormData(formData);
        
        // Use context-aware flag path like the unified dialog
        const flagPath = this._getFlagPath();
        console.log('WoD Trigger Config Dialog | Saving to flag path:', flagPath);
        const triggers = this.document.getFlag('wodsystem', flagPath) || [];
        console.log('WoD Trigger Config Dialog | Existing triggers:', triggers.length);
        const triggerIndex = triggers.findIndex(t => t?.id === this.triggerId);
        
        const targetCsv = (formData.targetCsv || '').trim();
        let actorTypes = [];
        
        // Parse targetCsv with support for special conditions and "any" logic
        if (targetCsv.length) {
            if (targetCsv.includes(':')) {
                // Special condition format like "hasEffect:EffectName" or "any:Type1,Type2"
                actorTypes = [targetCsv]; // Keep as-is for condition system to parse
            } else if (targetCsv === 'any') {
                // Universal "any" - check all actors
                actorTypes = ['any'];
            } else {
                // Regular comma-separated actor types (specific filtering)
                actorTypes = targetCsv.split(',').map(s => s.trim()).filter(Boolean);
            }
        }

                
        console.log('WoD TriggerConfig | Building final trigger object...');
        const next = {
            id: this.triggerId,
            name: formData.name || 'Unnamed Trigger',
            enabled: formData.enabled === true || formData.enabled === 'true' || formData.enabled === 'on',
            priority: Number(formData.priority ?? 10),
            trigger: {
                // Clean structure - no legacy fields
                actorTypes,
                // New structure
                scope: this._parseScopeFromFormData(formData),
                conditions: formData['trigger.conditions'] || [],
                execution: this._parseExecutionFromFormData(formData)
            },
            roll: {
                enabled: Boolean(formData.roll?.enabled),
                attribute: formData.roll?.attribute || '',
                ability: formData.roll?.ability || '',
                poolName: formData.roll?.poolName || '',
                difficulty: Number(formData.roll?.difficulty ?? 6),
                successThreshold: Number(formData.roll?.successThreshold ?? 1)
            },
            actions: this._normalizeActions(parsedActions, triggerIndex >= 0 ? triggers[triggerIndex]?.actions : null)
        };

        console.log('WoD TriggerConfig | Final trigger object before save:', JSON.stringify(next, null, 2));

        if (triggerIndex >= 0) {
            triggers[triggerIndex] = next;
        } else {
            triggers.push(next);
        }

        console.log('WoD Trigger Config Dialog | Saving triggers count:', triggers.length);
        await this.document.setFlag('wodsystem', flagPath, triggers);
        console.log('WoD Trigger Config Dialog | Save completed');
    }

    /**
     * Update available events based on target type
     * @param {jQuery} html - The dialog HTML
     * @param {string} targetType - The selected target type
     * @private
     */
    _updateAvailableEvents(html, targetType) {
        const eventSelect = html.find('select[name="trigger.eventType"]');
        let events = [];
        
        switch (targetType) {
            case 'actors':
            case 'actorsWithEffect':
            case 'specificActors':
                events = [
                    { id: 'onEffectApplied', label: 'Effect Applied' },
                    { id: 'onEffectRemoved', label: 'Effect Removed' },
                    { id: 'onHealthChanged', label: 'Health Changed' },
                    { id: 'onAttributeChanged', label: 'Attribute Changed' },
                    { id: 'onEnter', label: 'Token Enters Scene' },
                    { id: 'onExit', label: 'Token Exits Scene' }
                ];
                break;
            case 'tokens':
                events = [
                    { id: 'onTokenMove', label: 'Token Moves' },
                    { id: 'onTokenEnter', label: 'Token Enters Area' },
                    { id: 'onTokenExit', label: 'Token Exits Area' }
                ];
                break;
            case 'doors':
            case 'specificDoors':
                events = [
                    { id: 'onDoorOpen', label: 'Door Opens' },
                    { id: 'onDoorClose', label: 'Door Closes' },
                    { id: 'onDoorLock', label: 'Door Locks' },
                    { id: 'onDoorUnlock', label: 'Door Unlocks' }
                ];
                break;
            case 'tiles':
                events = [
                    { id: 'onTileClick', label: 'Tile Clicked' },
                    { id: 'onTileHover', label: 'Tile Hovered' }
                ];
                break;
            default:
                events = [
                    { id: 'onEnter', label: 'Token Enters Scene' },
                    { id: 'onExit', label: 'Token Exits Scene' }
                ];
        }
        
        // Update event options
        eventSelect.empty();
        events.forEach(event => {
            eventSelect.append(`<option value="${event.id}">${event.label}</option>`);
        });
        
        console.log('WoD Trigger Config Dialog | Updated events for target type:', targetType, events);
    }

    /**
     * Format target CSV for display in dropdown
     * @param {Array} actorTypes - Legacy actor types array
     * @returns {string} Formatted target CSV
     * @private
     */
    _formatTargetCsv(actorTypes) {
        if (!actorTypes || !actorTypes.length) {
            return '';
        }
        
        // If it's a special condition (contains colon), return as-is
        if (actorTypes.length === 1 && actorTypes[0].includes(':')) {
            return actorTypes[0];
        }
        
        // Regular comma-separated actor types
        return actorTypes.join(', ');
    }

    /**
     * Get the flag path for storing triggers based on document type
     * @returns {string} The flag path
     * @private
     */
    _getFlagPath() {
        console.log('WoD Trigger Config Dialog | Document type for flag path:', this.documentType);
        switch (this.documentType) {
            case 'scene':
                return 'sceneTriggers';
            case 'actor':
            case 'wall':
            case 'tile':
            case 'region':
            default:
                return 'triggers';
        }
    }

    _normalizeActions(rawActions, fallbackActions) {
        const fallback = {
            always: Array.isArray(fallbackActions?.always) ? fallbackActions.always : [],
            success: Array.isArray(fallbackActions?.success) ? fallbackActions.success : [],
            failure: Array.isArray(fallbackActions?.failure) ? fallbackActions.failure : []
        };

        if (!rawActions || typeof rawActions !== 'object') return fallback;

        const normalizeList = (maybeList, fallbackList) => {
            if (Array.isArray(maybeList)) return maybeList;
            if (maybeList && typeof maybeList === 'object') {
                return Object.keys(maybeList)
                    .sort((a, b) => Number(a) - Number(b))
                    .map(k => maybeList[k]);
            }
            return fallbackList;
        };

        const normalizeAction = (a) => {
            const actionType = a?.type || 'door';
            const delay = parseFloat(a?.delay) || 0;
            
            // Normalize target config - handle both legacy strings and new object format
            const normalizeTarget = (target, defaultMode, defaultType) => {
                if (!target) {
                    return { mode: defaultMode, elementType: defaultType, elementId: '' };
                }
                // Legacy string format (wall ID for doors)
                if (typeof target === 'string') {
                    return { mode: 'specific', elementType: defaultType, elementId: target };
                }
                // New object format
                return {
                    mode: target.mode || defaultMode,
                    elementType: target.elementType || defaultType,
                    elementId: target.elementId || ''
                };
            };
            
            if (actionType === 'door') {
                return { 
                    type: 'door', 
                    target: normalizeTarget(a?.target, 'specific', 'wall'),
                    state: a?.state || 'open',
                    delay: delay
                };
            } else if (actionType === 'changeTileAsset') {
                return { 
                    type: 'changeTileAsset', 
                    target: normalizeTarget(a?.target, 'self', 'tile'),
                    tileImg: a?.tileImg || '',
                    useCurrentTile: Boolean(a?.useCurrentTile),
                    delay: delay
                };
            } else {
                return { 
                    type: actionType, 
                    target: normalizeTarget(a?.target, 'triggering', 'actor'),
                    effectId: a?.effectId || '',
                    delay: delay
                };
            }
        };

        return {
            always: normalizeList(rawActions.always, fallback.always).map(normalizeAction),
            success: normalizeList(rawActions.success, fallback.success).map(normalizeAction),
            failure: normalizeList(rawActions.failure, fallback.failure).map(normalizeAction)
        };
    }

    async _updateObject(event, formData) {
        const $form = $(event?.currentTarget);
        if (!$form.length) return formData;
        
        
        // Force UI values for critical fields that might not be in formData
        formData['trigger.eventType'] = $form.find('select[name="trigger.eventType"]').val();
        formData.name = $form.find('input[name="name"]').val();
        
        // Force action type values
        $form.find('select[name$=".type"]').each((i, el) => {
            const $select = $(el);
            const name = $select.attr('name');
            formData[name] = $select.val();
        });
        
        // Force tile asset values
        $form.find('input[name$=".tileImg"]').each((i, el) => {
            const $input = $(el);
            const name = $input.attr('name');
            formData[name] = $input.val();
        });
        
        // Force useCurrentTile checkbox values
        $form.find('input[name$=".useCurrentTile"]').each((i, el) => {
            const $checkbox = $(el);
            const name = $checkbox.attr('name');
            formData[name] = $checkbox.is(':checked');
        });
        
        // Force target configuration values (mode, elementType, elementId)
        $form.find('select[name$=".target.mode"]').each((i, el) => {
            const $select = $(el);
            const name = $select.attr('name');
            formData[name] = $select.val();
        });
        
        $form.find('select[name$=".target.elementType"]').each((i, el) => {
            const $select = $(el);
            const name = $select.attr('name');
            formData[name] = $select.val();
        });
        
        $form.find('input[name$=".target.elementId"]').each((i, el) => {
            const $input = $(el);
            const name = $input.attr('name');
            formData[name] = $input.val();
        });
        
        // Force execution timing values
        formData['trigger.execution.mode'] = $form.find('select[name="trigger.execution.mode"]').val();
        formData['trigger.execution.timing.delay'] = $form.find('input[name="trigger.execution.timing.delay"]').val();
        formData['trigger.execution.timing.repeat'] = $form.find('input[name="trigger.execution.timing.repeat"]').val();
        formData['trigger.execution.timing.duration'] = $form.find('input[name="trigger.execution.timing.duration"]').val();
        
        // Force proximity scope values
        formData['trigger.scope.proximity.distance'] = $form.find('input[name="trigger.scope.proximity.distance"]').val();
        formData['trigger.scope.proximity.unit'] = $form.find('select[name="trigger.scope.proximity.unit"]').val();
        formData['trigger.scope.proximity.shape'] = $form.find('select[name="trigger.scope.proximity.shape"]').val();
        
        // Force target configuration values
        formData['trigger.target.type'] = $form.find('select[name="trigger.target.type"]').val();
        formData['trigger.target.effectName'] = $form.find('input[name="trigger.target.effectName"]').val();
        formData['trigger.target.ids'] = $form.find('input[name="trigger.target.ids"]').val();
        
        // Force target CSV value (the main target field)
        formData['targetCsv'] = $form.find('select[name="targetCsv"]').val();
        
        // Parse conditions from form data
        this._parseConditionsFromFormData(formData, $form);

                
                
        await this._saveTrigger(formData);
        
        // Only refresh actor sheets, not config dialogs
        if (this.document && this.document.sheet && this.document.documentName === 'Actor') {
            this.document.sheet.render();
        }
        
        // Don't call close callback here - let the close() method handle it
        // This prevents the callback from being called twice and ensures proper timing
        
        // Don't manually close - Foundry will handle it automatically due to closeOnSubmit: true
        
        return {};
    }

    _onTargetChange(event) {
        this._updateEventDropdown();
    }

    _onEventTypeChange(event) {
        this._updateEffectFieldVisibility($(event.currentTarget).closest('form'));
    }

    _updateEffectFieldVisibility(html) {
        const eventType = html.find('select[name="trigger.eventType"]').val();
        const effectGroup = html.find('#effect-config-group');
        
        if (eventType === 'onEffect') {
            effectGroup.show();
        } else {
            effectGroup.hide();
        }
    }

    _onEventTypeChange(event) {
        this._updateEffectFieldVisibility($(event.currentTarget).closest('form'));
    }

    _updateEffectFieldVisibility(html) {
        const eventType = html.find('select[name="trigger.eventType"]').val();
        const effectGroup = html.find('#effect-config-group');
        
        if (eventType === 'onEffect') {
            effectGroup.show();
        } else {
            effectGroup.hide();
        }
    }

    /**
     * Get available effects for autocomplete
     * @returns {Array} Array of effect names
     * @private
     */
    _getAvailableEffects() {
        const effects = new Set();
        
        // Only get effects from actors in the current scene (much more efficient)
        if (canvas?.scene) {
            for (const tokenDoc of canvas.scene.tokens) {
                const actor = tokenDoc.actor;
                if (actor) {
                    // Get active effects from the actor
                    for (const effect of actor.effects) {
                        if (effect.name && !effect.name.startsWith('WOD-')) {
                            effects.add(effect.name);
                        }
                    }
                }
            }
        }
        
        return Array.from(effects).sort();
    }
    
    _getAvailableAttributes() {
        // Standard WoD attributes (from wizard config)
        const attributes = [
            // Physical attributes
            'Strength', 'Dexterity', 'Stamina',
            // Social attributes
            'Charisma', 'Manipulation', 'Appearance', 
            // Mental attributes
            'Perception', 'Intelligence', 'Wits'
        ];
        return attributes;
    }

    _getAvailableAbilities() {
        // Standard WoD abilities (from wizard config)
        const abilities = [
            // Physical abilities
            'Animal Ken', 'Crafts', 'Drive', 'Etiquette', 'Firearms', 'Larceny', 'Melee',
            'Performance', 'Ride', 'Stealth', 'Survival', 'Swimming',
            // Social abilities
            'Academics', 'Computer', 'Finance', 'Investigation', 'Law', 'Linguistics',
            'Medicine', 'Occult', 'Politics', 'Science', 'Technology'
        ];
        return abilities;
    }

    _getAvailablePools() {
        // Collect pools from all creature types in the system
        const pools = new Set();
        
        // Standard pools that exist across most creature types
        const standardPools = [
            'Arete', 'Faith', 'Torment', 'Willpower', 'Quintessence',
            'Paradox', 'Glamour', 'Banality'
        ];
        
        standardPools.forEach(pool => pools.add(pool));
        
        // Try to get pools from existing actors in the game
        game.actors?.forEach(actor => {
            if (actor.system?.pools) {
                Object.keys(actor.system.pools).forEach(poolName => {
                    pools.add(poolName);
                });
            }
        });
        
        return Array.from(pools).sort();
    }

    async close(options) {
        
        // Prevent multiple calls by setting the flag immediately
        if (this._closeCallbackCalled) {
            this._stopPickMode();
            this._cleanupAutocompletes();
            await super.close(options);
            return;
        }
        
        this._stopPickMode();
        this._cleanupAutocompletes();
        await super.close(options);
        
        // Call the close callback if it exists and hasn't been called yet
        
        // Try all possible callback storage methods
        const callback = this._onCloseCb || 
                         this._wodOnCloseCallback || 
                         this._wodCallbackBackup || 
                         this._wodCallbacks?.get('onClose');
        
        if (callback && !this._closeCallbackCalled) {
            this._closeCallbackCalled = true; // Set immediately to prevent double calls
            
            try {
                
                // Call the callback - try both direct call and function call
                if (typeof callback === 'function') {
                    await callback();
                } else {
                    // Try to call it anyway in case it's a callable object
                    await callback();
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error in close callback', error);
            }
        } else {
            console.log('WoD TriggerConfig | onClose callback not called - original exists:', !!this._onCloseCb, 'backup1 exists:', !!this._wodOnCloseCallback, 'backup2 exists:', !!this._wodCallbackBackup, 'map exists:', !!this._wodCallbacks?.get('onClose'), 'type:', typeof callback, 'already called:', this._closeCallbackCalled);
        }
    }
}
