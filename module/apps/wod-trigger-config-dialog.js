export class WodTriggerConfigDialog extends FormApplication {
    constructor(document, triggerId = null, options = {}) {
        super({}, options);
        this.document = document;
        this.triggerId = triggerId || foundry.utils.randomID();
        this._onCloseCb = options?.onClose || null;
        this._pickMode = null;
        this._pickHandlers = null;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sheet"],
            template: "systems/wodsystem/templates/apps/wod-trigger-config-dialog.html",
            width: 480,
            height: "auto",
            closeOnSubmit: true,
            submitOnChange: false,
            resizable: true,
            title: "Configure Trigger"
        });
    }

    getData() {
        const triggers = this.document.getFlag('wodsystem', 'triggers') || [];
        console.log('WoD TriggerManager | DEBUG: Loading triggers, found:', triggers.length);
        console.log('WoD TriggerManager | DEBUG: Looking for triggerId:', this.triggerId);
        
        const existing = Array.isArray(triggers) ? triggers.find(t => t?.id === this.triggerId) : null;
        console.log('WoD TriggerManager | DEBUG: Found existing trigger:', existing);
        const trigger = foundry.utils.duplicate(existing || {
            id: this.triggerId,
            name: "",
            enabled: true,
            priority: 10,
            trigger: {
                eventType: 'onEnter',
                effectName: '',
                actorTypes: []
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
        });

        return {
            trigger,
            isNew: !existing,
            actorTypesCsv: (trigger.trigger?.actorTypes || []).join(', '),
            availableEffects: this._getAvailableEffects()
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Handle event type changes to show/hide effect configuration
        html.find('select[name="trigger.eventType"]').on('change', this._onEventTypeChange.bind(this));

        // Initialize effect field visibility
        this._updateEffectFieldVisibility(html);

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

        // Add action buttons
        html.find('button[data-action="add-action"]').on('click', async (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const type = ev.currentTarget.dataset.type;
            await this._addAction(outcome, type);
        });

        // Remove action buttons
        html.find('button[data-action="remove-action"]').on('click', async (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const index = Number(ev.currentTarget.dataset.index);
            await this._removeAction(outcome, index);
        });

        // Pick target from scene
        html.find('button[data-action="pick-target"]').on('click', (ev) => {
            ev.preventDefault();
            const outcome = ev.currentTarget.dataset.outcome;
            const index = Number(ev.currentTarget.dataset.index);
            this._startPickTarget(outcome, index);
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
        const triggers = this.document.getFlag('wodsystem', 'triggers') || [];
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

        if (type === 'door') {
            trigger.actions[outcome].push({ type: 'door', target: '', state: 'open' });
        } else if (type === 'tileAsset') {
            trigger.actions[outcome].push({ type: 'changeTileAsset', tileImg: '', tileId: '', useCurrentTile: true });
        } else {
            trigger.actions[outcome].push({ type: 'enableCoreEffect', effectId: '' });
        }

        triggers[triggerIndex] = trigger;
        await this.document.setFlag('wodsystem', 'triggers', triggers);
        this.render(false);
    }

    async _removeAction(outcome, index) {
        const triggers = this.document.getFlag('wodsystem', 'triggers') || [];
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

        await this.document.setFlag('wodsystem', 'triggers', triggers);
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
        const actionKeys = Object.keys(formData).filter(key => key.startsWith('actions.'));
        
        Object.keys(formData).forEach(key => {
            if (key.startsWith('actions.')) {
                const parts = key.split('.');
                if (parts.length >= 3) {
                    const outcome = parts[1]; // always, success, failure
                    const index = parseInt(parts[2]); // 0, 1, 2...
                    const field = parts[3]; // type, target, state, etc.

                    if (!isNaN(index) && actions[outcome]) {
                        // Ensure array has enough elements
                        while (actions[outcome].length <= index) {
                            actions[outcome].push({});
                        }

                        // Get the action type first to determine which fields to set
                        const actionTypeKey = `actions.${outcome}.${index}.type`;
                        const actionType = actions[outcome][index].type || formData[actionTypeKey] || 'door';
                        
                        // Only set relevant fields based on action type
                        if (actionType === 'changeTileAsset') {
                            // Only set tile asset related fields
                            if (field === 'tileImg' || field === 'tileId' || field === 'useCurrentTile' || field === 'delay') {
                                actions[outcome][index][field] = formData[key];
                            }
                        } else if (actionType === 'door') {
                            // Only set door related fields
                            if (field === 'target' || field === 'state' || field === 'delay') {
                                actions[outcome][index][field] = formData[key];
                            }
                        } else {
                            // Core effect fields
                            if (field === 'effectId' || field === 'delay') {
                                actions[outcome][index][field] = formData[key];
                            }
                        }
                        
                        // Set type separately to avoid duplication
                        if (field === 'type') {
                            actions[outcome][index].type = actionType;
                        }
                    }
                }
            }
        });

        return actions;
    }

    async _saveTrigger(expanded) {
        const parsedActions = this._parseActionsFromFormData(expanded);
        
        const triggers = this.document.getFlag('wodsystem', 'triggers') || [];
        const triggerIndex = triggers.findIndex(t => t?.id === expanded.id);
        
        const actorTypesCsv = (expanded.actorTypesCsv || '').trim();
        const actorTypes = actorTypesCsv.length ? actorTypesCsv.split(',').map(s => s.trim()).filter(Boolean) : [];

        const next = {
            id: expanded.id,
            name: expanded.name || 'Unnamed Trigger',
            enabled: expanded.enabled === true || expanded.enabled === 'true' || expanded.enabled === 'on',
            priority: Number(expanded.priority ?? 10),
            trigger: {
                eventType: expanded['trigger.eventType'] || 'onEnter',
                effectName: expanded['trigger.effectName'] || '',
                actorTypes
            },
            roll: {
                enabled: Boolean(expanded.roll?.enabled),
                attribute: expanded.roll?.attribute || '',
                ability: expanded.roll?.ability || '',
                poolName: expanded.roll?.poolName || '',
                difficulty: Number(expanded.roll?.difficulty ?? 6),
                successThreshold: Number(expanded.roll?.successThreshold ?? 1)
            },
            actions: this._normalizeActions(parsedActions, triggerIndex >= 0 ? triggers[triggerIndex]?.actions : null)
        };

        if (triggerIndex >= 0) {
            triggers[triggerIndex] = next;
        } else {
            triggers.push(next);
        }

        await this.document.setFlag('wodsystem', 'triggers', triggers);
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
            
            if (actionType === 'door') {
                return { 
                    type: 'door', 
                    target: a?.target || '', 
                    state: a?.state || 'open',
                    delay: delay
                };
            } else if (actionType === 'changeTileAsset') {
                return { 
                    type: 'changeTileAsset', 
                    tileImg: a?.tileImg || '',
                    tileId: a?.tileId || '',
                    useCurrentTile: Boolean(a?.useCurrentTile),
                    delay: delay
                };
            } else {
                return { 
                    type: actionType, 
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

        await this._saveTrigger(formData);
        return {};
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

    _getAvailableEffects() {
        const effects = new Set();
        
        // Get effects from all active tokens
        for (const token of canvas.tokens.placeables) {
            const tokenEffects = token.document.effects || [];
            tokenEffects.forEach(effect => {
                if (effect.label) effects.add(effect.label);
                if (effect.name) effects.add(effect.name);
            });
            
            // Also get effects from the token's actor
            if (token.actor) {
                const actorEffects = token.actor.effects || [];
                actorEffects.forEach(effect => {
                    if (effect.label) effects.add(effect.label);
                    if (effect.name) effects.add(effect.name);
                });
            }
        }
        
        // Get effects from all actors in the world
        for (const actor of game.actors.contents) {
            const actorEffects = actor.effects || [];
            actorEffects.forEach(effect => {
                if (effect.label) effects.add(effect.label);
                if (effect.name) effects.add(effect.name);
            });
        }
        
        // Get effects from all items in the world
        for (const item of game.items.contents) {
            if (item.effects) {
                item.effects.forEach(effect => {
                    if (effect.label) effects.add(effect.label);
                    if (effect.name) effects.add(effect.name);
                });
            }
        }
        
        // Convert to array and sort alphabetically
        return Array.from(effects).sort((a, b) => a.localeCompare(b));
    }

    async close(options) {
        this._stopPickMode();
        await super.close(options);
        if (typeof this._onCloseCb === 'function') {
            try {
                await this._onCloseCb();
            } catch (error) {
                console.error('WoD TriggerManager | Error in close callback', error);
            }
        }
    }
}
