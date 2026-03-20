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
            const $form = $(this.form);
            const filterType = $form.find('select[name="targetFilter.type"]').val() || '';
            const category = this._determineTargetCategory(filterType);
            return this._getEventsForTargetType(category);
        }
        
        // During getData(), the form doesn't exist yet — use the trigger's saved targetFilter.type
        const triggers = this.document.getFlag('wodsystem', 'triggers') || [];
        const existing = triggers.find(t => t.id === this.triggerId);
        const savedFilterType = existing?.trigger?.targetFilter?.type || '';
        const category = this._determineTargetCategory(savedFilterType);
        return this._getEventsForTargetType(category);
    }

    /**
     * Determine the broad target category from a targetFilter.type value
     * @param {string} filterType - The targetFilter.type value from the dropdown
     * @returns {string} The target category ('actor', 'doors', 'tokens', etc.)
     * @private
     */
    _determineTargetCategory(filterType) {
        // "self", empty, or "any" → use the host document type
        if (!filterType || filterType === 'self' || filterType === 'any') {
            return this._categoryFromDocumentType();
        }
        
        // Special conditions always apply to actors
        if (filterType.startsWith('hasEffect') || filterType.startsWith('is')) {
            return 'actor';
        }
        
        // Direct element types
        if (['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(filterType)) {
            return filterType;
        }
        
        // "any:" prefixes — check if they contain element types
        if (filterType.startsWith('any:')) {
            const types = filterType.substring(4).split(',').map(t => t.trim());
            const elementType = types.find(t => ['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(t));
            if (elementType) return elementType;
            return 'actor';
        }
        
        // Named actor types (Mortal, Mage, etc.) → actor
        return 'actor';
    }

    /**
     * Map the host document type to a target category for event filtering
     * @returns {string} The target category
     * @private
     */
    _categoryFromDocumentType() {
        switch (this.documentType) {
            case 'wall': return 'doors';
            case 'tile': return 'tiles';
            case 'region': return 'regions';
            case 'scene': return 'scene';
            case 'actor':
            default: return 'actor';
        }
    }

    /**
     * Get events for a specific target type
     * @param {string} targetType - The target type
     * @returns {Array} Array of event objects
     * @private
     */
    _getEventsForTargetType(targetType) {
        const registry = TriggerEventRegistry.getInstance();
        if (!registry) {
            return this._getDefaultEvents();
        }
        
        switch (targetType) {
            case 'actor':
                return registry.getEventsForDocumentType('actor');
                
            case 'doors':
            case 'walls':
                return registry.getEventsForDocumentType('wall');
                
            case 'tokens':
                // Tokens can trigger tile and region events (movement + effect)
                const tileEvents = registry.getEventsForDocumentType('tile');
                const regionEvents = registry.getEventsForDocumentType('region');
                // Merge and deduplicate by id
                const seen = new Set();
                const merged = [];
                for (const event of [...tileEvents, ...regionEvents]) {
                    if (!seen.has(event.id)) {
                        seen.add(event.id);
                        merged.push(event);
                    }
                }
                return merged;
                
            case 'tiles':
                return registry.getEventsForDocumentType('tile');
                
            case 'regions':
                return registry.getEventsForDocumentType('region');
                
            case 'scene':
                return registry.getEventsForDocumentType('scene');
                
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
        
        // Prioritize in-memory data over existing data for new triggers
        let triggerData = this._currentTriggerData;
        
        // Only use existing data if we don't have in-memory data
        if (!triggerData) {
            triggerData = existing;
        }
        
        // If form exists and we have cached data, merge it with trigger data
        if (this.form && this._cachedName) {
            triggerData = {
                ...triggerData,
                name: this._cachedName
            };
        }
        
        // Default trigger structure (clean format)
        const defaultTrigger = {
            id: this.triggerId,
            name: "",
            enabled: true,
            priority: 10,
            trigger: {
                // Target filter (what elements to monitor)
                targetFilter: {
                    type: '',
                    ids: '',
                    match: 'any'
                },
                // New format
                scope: {
                    type: 'tile',
                    target: null,
                    tile: { boundary: 'enter' },
                    region: { boundary: 'enter' }
                },
                conditions: [],
                execution: {
                    mode: 'event',
                    event: 'onEnter',
                    timing: {
                        delay: 0,
                        repeat: 0,
                        duration: null
                    }
                }
            },
            actions: {
                always: [],
                success: [],
                failure: []
            }
        };
        
        // Ensure triggerData has the correct structure
        const triggerSource = triggerData || defaultTrigger;
        const trigger = foundry.utils.duplicate(triggerSource);
        
        // Ensure trigger.trigger exists
        if (!trigger.trigger) {
            trigger.trigger = {};
        }
        
        // Ensure roll defaults exist
        if (!trigger.roll) {
            trigger.roll = {};
        }
        if (!trigger.roll.source) {
            trigger.roll.source = 'triggeringEntity';
        }
        if (!trigger.roll.specificActorId) {
            trigger.roll.specificActorId = '';
        }
        
        // Ensure new format fields exist
        if (!trigger.trigger.targetFilter) {
            trigger.trigger.targetFilter = { type: '', ids: '', match: 'any' };
        }
        if (!trigger.trigger.targetFilter.match) {
            trigger.trigger.targetFilter.match = 'any';
        }
        if (!trigger.trigger.targetFilter.type && trigger.trigger.targetFilter.type !== '') {
            trigger.trigger.targetFilter.type = '';
        }
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
            eventType: trigger.trigger?.execution?.event || 'onEnter',
            targetFilterType: trigger.trigger?.targetFilter?.type || '',
            targetFilterMatch: trigger.trigger?.targetFilter?.match || 'any',
            availableEffects: this._getAvailableEffects(),
            availableAttributes: this._getAvailableAttributes(),
            availableAbilities: this._getAvailableAbilities(),
            availablePools: this._getAvailablePools(),
            conditionTypes: Object.values(conditionTypes),
            currentScopeType: isActor ? (trigger.trigger?.scope?.type || 'actor') : autoScopeType,
            hasConditions: trigger.trigger?.conditions?.length > 0,
            documentType: documentType,
            availableEvents: availableEvents,
            availableActors: game.actors?.contents?.map(a => ({ id: a.id, name: a.name }))?.sort((a, b) => a.name.localeCompare(b.name)) || []
        };
    }

    /**
     * Update event dropdown when target changes
     * @private
     */
    _updateEventDropdown() {
        const $form = $(this.form);
        const targetSelect = $form.find('select[name="targetFilter.type"]');
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

        // Handle target filter type changes to update event dropdown
        html.find('select[name="targetFilter.type"]').on('change', this._onTargetFilterChange.bind(this));

        // Handle event type changes to show/hide effect configuration
        html.find('select[name="trigger.eventType"]').on('change', (event) => {
            this._onEventTypeChange(event);
        });
        
        // Debug: Add event listener to name field and store value
        this._cachedName = '';
        html.find('input[name="name"]').on('input', (event) => {
            this._cachedName = $(event.currentTarget).val();
        });

        // Initialize effect field visibility
        this._updateEffectFieldVisibility(html);
        
        // Initialize autocompletes for existing hasEffect conditions
        this._initializeConditionAutocompletes(html);
        
        // Initialize autocompletes for existing effect action name inputs
        this._initializeActionEffectAutocompletes(html);
        
        // Initialize region behavior action rows (populate + restore saved values)
        this._initializeBehaviorRows(html);

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

        // Toggle roll source actor picker
        html.find('select[data-action="change-roll-source"]').on('change', (ev) => {
            const source = ev.currentTarget.value;
            html.find('.roll-specific-actor').toggle(source === 'specificActor');
        });

        // Handle execution mode changes to show/hide event field
        html.find('select[name="trigger.execution.mode"]').on('change', (ev) => {
            const executionMode = ev.currentTarget.value;
            const eventField = html.find('.event-field');
            eventField.toggle(executionMode === 'event');
        });

        // Initialize event field visibility based on current mode
        const currentMode = html.find('select[name="trigger.execution.mode"]').val();
        const eventField = html.find('.event-field');
        eventField.toggle(currentMode === 'event');

        // Add condition button
        const addConditionBtn = html.find('button[data-action="add-condition"]');
        addConditionBtn.off('click.addCondition').on('click.addCondition', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this._addCondition();
        });

        // Remove condition buttons - use event delegation for dynamic content
        html.off('click', 'button[data-action="remove-condition"]').on('click', 'button[data-action="remove-condition"]', (ev) => {
            ev.preventDefault();
            const index = Number(ev.currentTarget.dataset.index);
            this._removeCondition(index);
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
        html.find('button[data-action="add-action"]').on('click', (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const type = ev.currentTarget.dataset.type;
            this._addAction(outcome, type);
        });

        // Remove action buttons - use event delegation for dynamic content
        html.off('click', 'button[data-action="remove-action"]').on('click', 'button[data-action="remove-action"]', (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const index = Number(ev.currentTarget.dataset.index);
            this._removeAction(outcome, index);
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

        // Pick target filter IDs from scene
        html.find('button[data-action="pick-target-filter"]').on('click', (ev) => {
            ev.preventDefault();
            this._startPickTargetFilter();
        });

        // Handle target mode changes - show/hide element ID fields and pick buttons
        html.on('change', '.target-mode', (ev) => {
            const mode = ev.currentTarget.value;
            const actionRow = $(ev.currentTarget).closest('.action-row, .action-grid');
            const idCell = actionRow.find('.target-id-cell');
            const idInput = actionRow.find('input[name$=".target.elementId"]');
            const pickBtn = actionRow.find('button[data-action="pick-element"]');
            const typeCell = actionRow.find('.target-type-cell');
            
            // Show/hide element ID field and pick button based on mode
            if (mode === 'specific') {
                idCell.show();
                idInput.show();
                pickBtn.show();
            } else {
                idCell.hide();
                idInput.hide();
                pickBtn.hide();
            }
            
            // Show/hide element type based on mode
            if (mode === 'triggering' || mode === 'source') {
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
            const $actionRow = $(select.closest('.action-row'));
            const tileImgInput = $actionRow.find('.tile-image-input');
            const tileTargetSection = $actionRow.find('.tile-target-section');
            const effectIdInput = $actionRow.find('input[name$=".effectId"]');
            const targetLabel = $actionRow.find('span.action-type-label');
            
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

    _addAction(outcome, type) {
        // DOM-only: append action row HTML. No setFlag, no render(false).
        // _updateObject (Save button) reads all form values from the DOM.
        const actionList = $(this.element).find(`.action-list[data-outcome="${outcome}"]`);
        if (!actionList.length) {
            console.warn('WoD TriggerConfig | Action list not found for outcome:', outcome);
            return;
        }
        
        const index = actionList.children('.action-row').length;
        let actionHtml = '';
        
        if (type === 'door') {
            actionHtml = `
            <div class="action-row flexrow" data-index="${index}">
                <input type="hidden" name="actions.${outcome}.${index}.type" value="door" />
                <div class="action-grid compact">
                    <select name="actions.${outcome}.${index}.target.mode" class="target-mode">
                        <option value="source">Source (Trigger Host)</option>
                        <option value="specific" selected>Specific Door</option>
                        <option value="all">All Doors in Scene</option>
                    </select>
                    <input type="text" name="actions.${outcome}.${index}.target.elementId" value="" placeholder="Wall ID" class="target-input" />
                    <button type="button" class="pick-target" data-action="pick-element" data-outcome="${outcome}" data-index="${index}" title="Pick"><i class="fas fa-crosshairs"></i></button>
                    <select name="actions.${outcome}.${index}.state">
                        <option value="open" selected>Open</option>
                        <option value="closed">Closed</option>
                        <option value="locked">Locked</option>
                    </select>
                    <input type="number" name="actions.${outcome}.${index}.delay" value="0" min="0" step="0.1" style="width:60px" />
                    <button type="button" class="remove-action" data-action="remove-action" data-outcome="${outcome}" data-index="${index}" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        } else if (type === 'tileAsset') {
            actionHtml = `
            <div class="action-row flexrow" data-index="${index}">
                <input type="hidden" name="actions.${outcome}.${index}.type" value="changeTileAsset" />
                <div class="action-grid compact">
                    <select name="actions.${outcome}.${index}.target.mode" class="target-mode">
                        <option value="self" selected>Self (Trigger Source)</option>
                        <option value="specific">Specific Element</option>
                        <option value="all">All in Scene</option>
                    </select>
                    <input type="hidden" name="actions.${outcome}.${index}.target.elementType" value="tile" />
                    <input type="text" name="actions.${outcome}.${index}.target.elementId" value="" placeholder="Tile ID" class="target-input" style="display:none" />
                    <button type="button" class="pick-target" data-action="pick-element" data-outcome="${outcome}" data-index="${index}" title="Pick"><i class="fas fa-crosshairs"></i></button>
                    <input type="text" name="actions.${outcome}.${index}.tileImg" value="" placeholder="tiles/path/to/image.png" />
                    <button type="button" data-action="pick-asset" data-outcome="${outcome}" data-index="${index}" title="Browse"><i class="fas fa-folder-open"></i></button>
                    <label><input type="checkbox" name="actions.${outcome}.${index}.useCurrentTile" checked /> Use current tile</label>
                    <input type="number" name="actions.${outcome}.${index}.delay" value="0" min="0" step="0.1" style="width:60px" />
                    <button type="button" class="remove-action" data-action="remove-action" data-outcome="${outcome}" data-index="${index}" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        } else if (type === 'regionBehavior') {
            const regionOptions = this._getSceneRegionOptions();
            actionHtml = `
            <div class="action-row flexrow" data-index="${index}">
                <input type="hidden" name="actions.${outcome}.${index}.type" value="enableRegionBehavior" />
                <div class="action-grid compact">
                    <select name="actions.${outcome}.${index}.target.mode" class="target-mode behavior-target-mode">
                        <option value="source" selected>Source (Trigger Host)</option>
                        <option value="specific">Specific Region</option>
                        <option value="all">All Regions in Scene</option>
                    </select>
                    <select name="actions.${outcome}.${index}.target.elementId" class="behavior-region-select" style="display:none">
                        <option value="">-- Select Region --</option>
                        ${regionOptions}
                    </select>
                    <input type="hidden" name="actions.${outcome}.${index}.target.elementType" value="region" />
                    <select name="actions.${outcome}.${index}.behaviorId" class="behavior-search-select">
                        <option value="">-- Select Behavior --</option>
                    </select>
                    <select name="actions.${outcome}.${index}.type" class="behavior-action-type">
                        <option value="enableRegionBehavior" selected>Enable</option>
                        <option value="disableRegionBehavior">Disable</option>
                        <option value="toggleRegionBehavior">Toggle</option>
                    </select>
                    <button type="button" class="remove-action" data-action="remove-action" data-outcome="${outcome}" data-index="${index}" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        } else {
            actionHtml = `
            <div class="action-row flexrow" data-index="${index}">
                <input type="hidden" name="actions.${outcome}.${index}.type" value="enableCoreEffect" />
                <div class="action-grid compact">
                    <select name="actions.${outcome}.${index}.type" class="effect-action-type">
                        <option value="enableCoreEffect" selected>Enable</option>
                        <option value="disableCoreEffect">Disable</option>
                        <option value="toggleCoreEffect">Toggle</option>
                    </select>
                    <select name="actions.${outcome}.${index}.target.mode" class="target-mode">
                        <option value="source">Source (Trigger Host)</option>
                        <option value="triggering" selected>Triggering</option>
                        <option value="specific">Specific</option>
                        <option value="all">All in Scene</option>
                    </select>
                    <select name="actions.${outcome}.${index}.target.elementType" class="target-element-type">
                        <option value="actor" selected>Actor</option>
                        <option value="token">Token</option>
                        <option value="wall">Door</option>
                        <option value="tile">Tile</option>
                        <option value="region">Region</option>
                        <option value="scene">Scene</option>
                    </select>
                    <input type="text" name="actions.${outcome}.${index}.target.elementId" value="" placeholder="ID" class="target-input" style="display:none" />
                    <button type="button" class="pick-target" data-action="pick-element" data-outcome="${outcome}" data-index="${index}" title="Pick" style="display:none"><i class="fas fa-crosshairs"></i></button>
                    <input type="text" name="actions.${outcome}.${index}.effectId" value="" placeholder="effect name" class="effect-action-name" />
                    <button type="button" class="remove-action" data-action="remove-action" data-outcome="${outcome}" data-index="${index}" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }
        
        actionList.append(actionHtml);
        
        // Initialize autocomplete for effect action name input
        if (type === 'coreEffect') {
            const newRow = actionList.find(`.action-row[data-index="${index}"]`);
            const effectInput = newRow.find('.effect-action-name')[0];
            if (effectInput) {
                const acKey = `action_${outcome}_${index}`;
                this._setupEffectAutocomplete(effectInput, acKey);
            }
        }
        
        // Set up behavior row (target mode, region picker, behavior dropdown, search)
        if (type === 'regionBehavior') {
            const newRow = actionList.find(`.action-row[data-index="${index}"]`);
            this._setupBehaviorRow(newRow);
        }
    }

    _removeAction(outcome, index) {
        // DOM-only: remove the action row and re-index. No setFlag, no render(false).
        const actionList = $(this.element).find(`.action-list[data-outcome="${outcome}"]`);
        const actionRow = actionList.find(`.action-row[data-index="${index}"]`);
        actionRow.remove();
        
        // Re-index remaining action rows
        actionList.children('.action-row').each((newIndex, row) => {
            $(row).attr('data-index', newIndex);
            // Update all name attributes with new index
            $(row).find('select, input, button').each((i, field) => {
                const $f = $(field);
                const name = $f.attr('name');
                if (name && name.startsWith(`actions.${outcome}.`)) {
                    $f.attr('name', name.replace(/actions\.\w+\.\d+/, `actions.${outcome}.${newIndex}`));
                }
                // Update data-index on buttons
                if ($f.attr('data-index') !== undefined) {
                    $f.attr('data-index', newIndex);
                }
            });
        });
    }

    /**
     * Build HTML <option> elements for all regions in the current scene.
     * @returns {string} HTML string of <option> elements
     * @private
     */
    _getSceneRegionOptions() {
        if (!canvas?.scene?.regions) return '';
        let html = '';
        for (const region of canvas.scene.regions) {
            const label = region.name || `Region ${region.id.substring(0, 6)}`;
            html += `<option value="${region.id}">${label}</option>`;
        }
        return html;
    }
    
    /**
     * Build HTML <option> elements for behaviors of a specific region (or the
     * trigger-host region when regionId is null/empty and mode is "source").
     * @param {string|null} regionId - Region document ID, or null for trigger host
     * @returns {string} HTML string of <option> elements
     * @private
     */
    _getBehaviorsForRegion(regionId) {
        let region = null;
        if (regionId) {
            region = canvas?.scene?.regions?.get(regionId);
        } else if (this.document?.documentName === 'Region') {
            region = this.document;
        }
        if (!region || !region.behaviors || region.behaviors.size === 0) return '';
        
        let html = '';
        for (const behavior of region.behaviors) {
            const bName = behavior.name || behavior.type || behavior.id;
            const statusTag = behavior.disabled ? ' [disabled]' : '';
            html += `<option value="${behavior.id}">${bName}${statusTag} (${behavior.type})</option>`;
        }
        return html;
    }
    
    /**
     * Build behavior options for "all regions" mode — grouped by region.
     * @returns {string} HTML string of <optgroup>/<option> elements
     * @private
     */
    _getBehaviorsForAllRegions() {
        if (!canvas?.scene?.regions) return '';
        let html = '';
        for (const region of canvas.scene.regions) {
            if (!region.behaviors || region.behaviors.size === 0) continue;
            const regionLabel = region.name || `Region ${region.id.substring(0, 6)}`;
            html += `<optgroup label="${regionLabel}">`;
            for (const behavior of region.behaviors) {
                const bName = behavior.name || behavior.type || behavior.id;
                const statusTag = behavior.disabled ? ' [disabled]' : '';
                html += `<option value="${behavior.id}">${bName}${statusTag} (${behavior.type})</option>`;
            }
            html += `</optgroup>`;
        }
        return html;
    }
    
    /**
     * Wire up a regionBehavior action row: target-mode toggles region picker
     * visibility, region picker changes populate the behavior dropdown,
     * and a search input filters the behavior list.
     * @param {jQuery} $row - The action-row jQuery element
     * @private
     */
    _setupBehaviorRow($row) {
        const $targetMode = $row.find('.behavior-target-mode');
        const $regionSelect = $row.find('.behavior-region-select');
        const $behaviorSelect = $row.find('.behavior-search-select');
        
        const populateBehaviors = () => {
            const mode = $targetMode.val();
            $behaviorSelect.find('option:not(:first), optgroup').remove();
            
            if (mode === 'source') {
                $behaviorSelect.append(this._getBehaviorsForRegion(null));
            } else if (mode === 'specific') {
                const selectedRegionId = $regionSelect.val();
                if (selectedRegionId) {
                    $behaviorSelect.append(this._getBehaviorsForRegion(selectedRegionId));
                }
            } else if (mode === 'all') {
                $behaviorSelect.append(this._getBehaviorsForAllRegions());
            }
            
            // Restore filter
            const $searchInput = $row.find('.behavior-search-input');
            if ($searchInput.length && $searchInput.val()) {
                $searchInput.trigger('input');
            }
        };
        
        // Show/hide region picker based on target mode
        $targetMode.on('change', () => {
            const mode = $targetMode.val();
            $regionSelect.toggle(mode === 'specific');
            populateBehaviors();
        });
        
        // Update behaviors when region changes
        $regionSelect.on('change', () => {
            populateBehaviors();
        });
        
        // Initial population
        populateBehaviors();
        
        // Wrap behavior select with search input if not wrapped
        if (!$behaviorSelect.parent().hasClass('behavior-search-wrapper')) {
            const $wrapper = $('<div class="behavior-search-wrapper" style="position:relative;flex:1;"></div>');
            const $searchInput = $('<input type="text" class="behavior-search-input" placeholder="Search behaviors..." style="width:100%;margin-bottom:2px;" />');
            
            $behaviorSelect.before($wrapper);
            $wrapper.append($searchInput);
            $wrapper.append($behaviorSelect);
            
            $searchInput.on('input', () => {
                const query = $searchInput.val().toLowerCase();
                $behaviorSelect.find('option').each((_, opt) => {
                    const $opt = $(opt);
                    if (!$opt.val()) return;
                    const text = $opt.text().toLowerCase();
                    const id = $opt.val().toLowerCase();
                    $opt.toggle(text.includes(query) || id.includes(query));
                });
                $behaviorSelect.find('optgroup').each((_, grp) => {
                    const $grp = $(grp);
                    $grp.toggle($grp.find('option:visible').length > 0);
                });
            });
        }
    }

    /**
     * Initialize all existing regionBehavior action rows on render.
     * Populates region selectors, restores saved values, and wires up events.
     * @param {jQuery} html - The form html
     * @private
     */
    _initializeBehaviorRows(html) {
        const regionOptions = this._getSceneRegionOptions();
        
        html.find('.behavior-target-mode').each((_, el) => {
            const $row = $(el).closest('.action-row');
            const $regionSelect = $row.find('.behavior-region-select');
            const $behaviorSelect = $row.find('.behavior-search-select');
            const $targetMode = $(el);
            
            // Populate region dropdown
            $regionSelect.find('option:not(:first)').remove();
            $regionSelect.append(regionOptions);
            
            // Restore saved values
            const savedRegionId = $row.find('.behavior-saved-region').val();
            const savedBehaviorId = $row.find('.behavior-saved-id').val();
            const savedMode = $targetMode.val();
            
            if (savedRegionId && savedMode === 'specific') {
                $regionSelect.val(savedRegionId);
                $regionSelect.show();
            } else {
                $regionSelect.toggle(savedMode === 'specific');
            }
            
            // Wire up the row (events + initial behavior population)
            this._setupBehaviorRow($row);
            
            // Restore behavior selection after population
            if (savedBehaviorId) {
                $behaviorSelect.val(savedBehaviorId);
            }
        });
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

    /**
     * Start picking target filter IDs from the scene
     */
    _startPickTargetFilter() {
        if (!canvas?.ready) {
            ui.notifications?.warn('Canvas not ready');
            return;
        }

        // Get the current target filter type to determine what to pick
        const form = $(this.element).find('form');
        const targetType = form.find('select[name="targetFilter.type"]').val();
        
        if (!targetType) {
            ui.notifications?.warn('Please select a target type first');
            return;
        }

        // Map target filter types to element types for picking
        let elementType = 'wall'; // default
        switch (targetType) {
            case 'doors':
            case 'walls':
                elementType = 'wall';
                break;
            case 'tiles':
                elementType = 'tile';
                break;
            case 'tokens':
                elementType = 'token';
                break;
            case 'Mortal':
            case 'Technocrat':
            case 'Mage':
            case 'Spirit':
            case 'Demon':
            case 'Earthbound':
            case 'Mortal-NPC':
            case 'Technocrat-NPC':
            case 'Mage-NPC':
            case 'Demon-NPC':
                elementType = 'actor';
                break;
            default:
                ui.notifications?.warn(`Cannot pick IDs for target type: ${targetType}`);
                return;
        }

        // Use existing picker infrastructure with special handling for target filter
        this._startPickTargetFilterForType(elementType);
    }

    /**
     * Start picking for target filter with specific element type
     */
    _startPickTargetFilterForType(elementType) {
        this._stopPickMode();
        const previousLayer = canvas.activeLayer?.options?.name;
        this._pickMode = { elementType, previousLayer, isTargetFilter: true };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                this._stopPickMode();
            }
        };

        switch (elementType) {
            case 'wall':
                ui.notifications?.info('Click doors on the canvas. Press Escape to cancel.');
                try { canvas.walls?.activate(); } catch (e) { /* ignore */ }
                
                const onControlWall = (wall, controlled) => {
                    if (!controlled || !this._pickMode?.isTargetFilter) return;
                    const wallId = wall?.document?.id;
                    if (!wallId) return;
                    this._addTargetFilterId(wallId);
                };
                this._pickHandlers = { onControlWall, onKeyDown };
                Hooks.on('controlWall', onControlWall);
                break;

            case 'tile':
                ui.notifications?.info('Click tiles on the canvas. Press Escape to cancel.');
                try { canvas.tiles?.activate(); } catch (e) { /* ignore */ }
                
                const onControlTile = (tile, controlled) => {
                    if (!controlled || !this._pickMode?.isTargetFilter) return;
                    const tileId = tile?.document?.id;
                    if (!tileId) return;
                    this._addTargetFilterId(tileId);
                };
                this._pickHandlers = { onControlTile, onKeyDown };
                Hooks.on('controlTile', onControlTile);
                break;

            case 'token':
                ui.notifications?.info('Click tokens on the canvas. Press Escape to cancel.');
                try { canvas.tokens?.activate(); } catch (e) { /* ignore */ }
                
                const onControlToken = (token, controlled) => {
                    if (!controlled || !this._pickMode?.isTargetFilter) return;
                    const tokenId = token?.document?.id;
                    if (!tokenId) return;
                    this._addTargetFilterId(tokenId);
                };
                this._pickHandlers = { onControlToken, onKeyDown };
                Hooks.on('controlToken', onControlToken);
                break;

            case 'actor':
                // For actors, show a dialog to select from game.actors
                this._showActorPickerForTargetFilter();
                return;

            default:
                ui.notifications?.warn(`Unknown element type: ${elementType}`);
                return;
        }

        document.addEventListener('keydown', onKeyDown);
    }

    /**
     * Add an ID to the target filter IDs field (supports multiple selections)
     */
    _addTargetFilterId(elementId) {
        const form = $(this.element).find('form');
        const idsInput = form.find('input[name="trigger.targetFilter.ids"]');
        const currentIds = idsInput.val().split(',').map(id => id.trim()).filter(Boolean);
        
        // Add the new ID if not already present
        if (!currentIds.includes(elementId)) {
            currentIds.push(elementId);
            idsInput.val(currentIds.join(', '));
            ui.notifications?.info(`Added ${elementId} to target filter`);
        } else {
            ui.notifications?.info(`${elementId} already in target filter`);
        }
    }

    /**
     * Show actor picker dialog for target filter
     */
    async _showActorPickerForTargetFilter() {
        const actors = game.actors.contents.map(a => ({ id: a.id, name: a.name }));
        if (actors.length === 0) {
            ui.notifications?.warn('No actors available');
            return;
        }

        const content = `<form><div class="form-group"><label>Select Actor</label>
            <select name="actorId">${actors.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
        </div></form>`;

        new Dialog({
            title: 'Select Actor for Target Filter',
            content,
            buttons: {
                select: {
                    label: 'Select',
                    callback: (html) => {
                        const actorId = html.find('select[name="actorId"]').val();
                        this._addTargetFilterId(actorId);
                    }
                },
                cancel: { label: 'Cancel' }
            },
            default: 'select'
        }).render(true);
    }

    _addCondition() {
        // DOM-only: append condition row HTML. No setFlag, no render(false).
        // _updateObject (Save button) reads all form values from the DOM.
        const form = $(this.element).find('form');
        const conditionsContainer = form.find('.conditions-list');
        
        if (conditionsContainer.length === 0) {
            console.error('WoD TriggerConfig | Conditions container not found!');
            return;
        }
        
        const conditionIndex = conditionsContainer.children('.condition-row').length;
        
        // Build condition type options from registry (same source as the template)
        const conditionTypes = this._triggerAPI.getConditionTypes();
        const typeOptions = Object.values(conditionTypes)
            .map(ct => `<option value="${ct.id}">${ct.label}</option>`)
            .join('\n                    ');
        
        const conditionHtml = `
            <div class="condition-row" data-index="${conditionIndex}">
                <select name="trigger.conditions.${conditionIndex}.type" class="condition-type">
                    ${typeOptions}
                </select>
                <select name="trigger.conditions.${conditionIndex}.operator" class="condition-operator">
                    <option value="equals">Equals</option>
                    <option value="notEquals">Not Equals</option>
                    <option value="greaterThan">Greater Than</option>
                    <option value="lessThan">Less Than</option>
                    <option value="contains">Contains</option>
                </select>
                <input type="text" name="trigger.conditions.${conditionIndex}.value" value="" placeholder="Value" class="condition-value" />
                <select name="trigger.conditions.${conditionIndex}.logic" class="condition-logic">
                    <option value="none">None</option>
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                </select>
                <button type="button" class="remove-condition" data-action="remove-condition" data-index="${conditionIndex}" title="Remove Condition"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        conditionsContainer.append(conditionHtml);
        conditionsContainer.find('.no-conditions').remove();
        
        // Setup autocomplete for the new condition value input
        const newConditionRow = conditionsContainer.find(`.condition-row[data-index="${conditionIndex}"]`);
        setTimeout(() => {
            const valueInput = newConditionRow.find('.condition-value')[0];
            if (valueInput) {
                this._setupEffectAutocomplete(valueInput, conditionIndex);
            }
        }, 10);
    }

    _removeCondition(index) {
        // DOM-only: remove the condition row and re-index. No setFlag, no render(false).
        const form = $(this.element).find('form');
        const conditionRow = form.find(`.condition-row[data-index="${index}"]`);
        conditionRow.remove();
        
        // Re-index remaining conditions
        form.find('.condition-row').each((newIndex, row) => {
            $(row).attr('data-index', newIndex);
            $(row).find('button[data-action="remove-condition"]').attr('data-index', newIndex);
            $(row).find('select, input').each((i, field) => {
                const name = $(field).attr('name');
                if (name && name.includes('trigger.conditions.')) {
                    const newName = name.replace(/trigger\.conditions\.\d+/, `trigger.conditions.${newIndex}`);
                    $(field).attr('name', newName);
                }
            });
        });
        
        // Show "no conditions" if none left
        const conditionsContainer = form.find('.conditions-list');
        if (conditionsContainer.children('.condition-row').length === 0) {
            conditionsContainer.append('<p class="no-conditions">No conditions configured.</p>');
        }
    }
    
    /**
     * Setup effect autocomplete for a condition value input
     * @private
     */
    _setupEffectAutocomplete(input, index) {
        // Safety check - ensure input exists
        if (!input) {
            console.warn('WoD TriggerConfig | Cannot setup autocomplete - input element is undefined');
            return;
        }
        
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

    /**
     * Initialize autocompletes for existing effect action name inputs
     * @private
     */
    _initializeActionEffectAutocompletes(html) {
        html.find('.effect-action-name').each((i, input) => {
            const row = input.closest('.action-row');
            const outcome = row?.closest('.action-list')?.dataset?.outcome || 'always';
            const index = row?.dataset?.index || i;
            const acKey = `action_${outcome}_${index}`;
            this._setupEffectAutocomplete(input, acKey);
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
                            } else if (actionType === 'enableRegionBehavior' || actionType === 'disableRegionBehavior' || actionType === 'toggleRegionBehavior') {
                                if (field === 'behaviorId') {
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
        }
        return execution;
    }

    async _saveTrigger(formData, _) {
        
        const parsedActions = this._parseActionsFromFormData(formData);
        
        // Use context-aware flag path like the unified dialog
        const flagPath = this._getFlagPath();
        const triggers = this.document.getFlag('wodsystem', flagPath) || [];
        const triggerIndex = triggers.findIndex(t => t?.id === this.triggerId);
        
        const next = {
            id: this.triggerId,
            version: 2, // Mark as V2 schema
            name: formData.name || 'Unnamed Trigger',
            enabled: formData.enabled === true, // Force-extracted checkbox value
            priority: Number(formData.priority ?? 10),
            trigger: {
                targetFilter: {
                    type: (formData['targetFilter.type'] || '').trim(),
                    ids: (formData['trigger.targetFilter.ids'] || '').trim(),
                    match: formData['targetFilter.match'] || 'any'
                },
                scope: this._parseScopeFromFormData(formData),
                conditions: formData['trigger.conditions'] || [],
                execution: this._parseExecutionFromFormData(formData)
            },
            roll: {
                enabled: Boolean(formData.roll?.enabled),
                source: formData.roll?.source || 'triggeringEntity',
                specificActorId: formData.roll?.specificActorId || '',
                type: formData.roll?.type || 'attribute+ability',
                attribute: formData.roll?.attribute || '',
                ability: formData.roll?.ability || '',
                poolName: formData.roll?.poolName || '',
                difficulty: Number(formData.roll?.difficulty ?? 6),
                successThreshold: Number(formData.roll?.successThreshold ?? 1)
            }
        };
        
        next.actions = this._normalizeActions(parsedActions, triggerIndex >= 0 ? triggers[triggerIndex]?.actions : null);

        if (triggerIndex >= 0) {
            triggers[triggerIndex] = next;
        } else {
            triggers.push(next);
        }

        await this.document.setFlag('wodsystem', flagPath, triggers);
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
        
    }

    /**
     * Get the flag path for storing triggers based on document type
     * @returns {string} The flag path
     * @private
     */
    _getFlagPath() {
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
            } else if (actionType === 'enableRegionBehavior' || actionType === 'disableRegionBehavior' || actionType === 'toggleRegionBehavior') {
                return {
                    type: actionType,
                    target: normalizeTarget(a?.target, 'source', 'region'),
                    behaviorId: a?.behaviorId || '',
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
        formData.name = this._cachedName || $form.find('input[name="name"]').val();
        
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
        
        // Force region behavior values (behaviorId dropdown + region select)
        $form.find('select[name$=".behaviorId"]').each((i, el) => {
            const $select = $(el);
            const name = $select.attr('name');
            formData[name] = $select.val();
        });
        $form.find('select.behavior-region-select').each((i, el) => {
            const $select = $(el);
            const name = $select.attr('name');
            if (name) formData[name] = $select.val();
        });
        
        // Force roll source values
        const rollSourceVal = $form.find('select[name="roll.source"]').val();
        if (rollSourceVal) {
            if (!formData.roll) formData.roll = {};
            formData.roll.source = rollSourceVal;
        }
        const rollActorVal = $form.find('select[name="roll.specificActorId"]').val();
        if (rollActorVal !== undefined) {
            if (!formData.roll) formData.roll = {};
            formData.roll.specificActorId = rollActorVal;
        }
        
        // Force event type value
        formData['trigger.eventType'] = $form.find('select[name="trigger.eventType"]').val();
        
        // Force execution timing values
        formData['trigger.execution.mode'] = $form.find('select[name="trigger.execution.mode"]').val();
        formData['trigger.execution.timing.delay'] = $form.find('input[name="trigger.execution.timing.delay"]').val();
        formData['trigger.execution.timing.repeat'] = $form.find('input[name="trigger.execution.timing.repeat"]').val();
        formData['trigger.execution.timing.duration'] = $form.find('input[name="trigger.execution.timing.duration"]').val();
        
        // Force enabled field to ensure triggers are enabled by default
        const enabledCheckbox = $form.find('input[name="enabled"]');
        formData['enabled'] = enabledCheckbox.is(':checked');
        
        // Force proximity scope values
        formData['trigger.scope.proximity.distance'] = $form.find('input[name="trigger.scope.proximity.distance"]').val();
        formData['trigger.scope.proximity.unit'] = $form.find('select[name="trigger.scope.proximity.unit"]').val();
        formData['trigger.scope.proximity.shape'] = $form.find('select[name="trigger.scope.proximity.shape"]').val();
        
        // Force basic trigger values
        formData['name'] = $form.find('input[name="name"]').val();
        formData['enabled'] = $form.find('input[name="enabled"]').is(':checked');
        formData['priority'] = $form.find('input[name="priority"]').val();
        
        // Force target filter values
        const targetFilterTypeValue = $form.find('select[name="targetFilter.type"]').val();
        const targetFilterMatchValue = $form.find('select[name="targetFilter.match"]').val();
        formData['targetFilter.type'] = targetFilterTypeValue;
        formData['targetFilter.match'] = targetFilterMatchValue;
        formData['trigger.targetFilter.ids'] = $form.find('input[name="trigger.targetFilter.ids"]').val();
        
        // Parse conditions from form data
        this._parseConditionsFromFormData(formData, $form);
        
        // If we have in-memory conditions (for new triggers), merge them with form data
        if (this._currentTriggerData?.trigger?.conditions) {
            formData['trigger.conditions'] = [
                ...this._currentTriggerData.trigger.conditions,
                ...formData['trigger.conditions']
            ];
        }
                
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

    _onTargetFilterChange(event) {
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
        }
    }
}
