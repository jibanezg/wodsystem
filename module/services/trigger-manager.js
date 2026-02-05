export class TriggerManager {
    constructor() {
        this._tokenState = new Map(); // tokenUuid -> {x,y,width,height, sceneId, tiles:Set, regions:Set}
        this._movementMonitors = new Map(); // tokenUuid -> animationFrame
    }

    initialize() {
        // Listen for token updates
        Hooks.on('updateToken', (token, changes, options, userId) => {
            try {
                // Only process movement updates
                if (changes.x !== undefined || changes.y !== undefined) {
                    this._onTokenUpdated(token, changes);
                }
                // Check if effects were modified
                if (changes.effects !== undefined) {
                    this._onTokenEffectsChanged(token, changes.effects);
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error processing token update:', error);
            }
        });

        // Listen for door state changes
        Hooks.on('updateWall', (wall, changes, options, userId) => {
            try {
                this._onDoorUpdated(wall, changes);
            } catch (error) {
                console.error('WoD TriggerManager | Failed processing updateWall', error);
            }
        });

        // Listen for actor effect changes (for tokens that inherit from actors)
        Hooks.on('updateActor', (actor, changes, options, userId) => {
            try {
                // Check if effects were modified
                if (changes.effects !== undefined) {
                    this._onActorEffectsChanged(actor, changes.effects);
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error processing actor effects change:', error);
            }
        });

        Hooks.on('canvasReady', () => {
            try {
                this._primeInitialTokenState();
            } catch (error) {
                console.error('WoD TriggerManager | Failed priming token state', error);
            }
        });

        Hooks.on('ready', () => {
            try {
                this._primeInitialTokenState();
            } catch (error) {
                console.error('WoD TriggerManager | Failed priming token state (ready)', error);
            }
        });
    }

    _primeInitialTokenState() {
        if (!canvas?.scene) return;
        for (const tokenDoc of canvas.scene.tokens) {
            const state = this._computeTokenState(tokenDoc);
            this._tokenState.set(tokenDoc.uuid, state);
        }
    }

    _onTokenUpdated(tokenDoc, changes) {
        if (!canvas?.scene) return;

        // Only care about movement
        if (changes.x === undefined && changes.y === undefined) return;

        const tokenUuid = tokenDoc.uuid;
        const prevState = this._tokenState.get(tokenUuid);
        const nextState = this._computeTokenState(tokenDoc);

        // If no previous state, create an empty one
        const emptyState = {
            sceneId: canvas.scene.id,
            rect: nextState.rect,
            tiles: new Set(),
            regions: new Set()
        };

        const actualPrevState = prevState || emptyState;

        // Check which tiles were crossed during movement (path-based detection)
        const crossedTiles = this._getCrossedTiles(actualPrevState.rect, nextState.rect);
        
        // Determine entry: tiles that were crossed but token wasn't on before
        const enteredTiles = this._setDiff(crossedTiles, actualPrevState.tiles);
        
        // Determine exit: tiles that token was on before but not on after (original onExit logic)
        const exitedTiles = this._setDiff(actualPrevState.tiles, nextState.tiles);
        
        const enteredRegions = this._setDiff(nextState.regions, actualPrevState.regions);
        const exitedRegions = this._setDiff(actualPrevState.regions, nextState.regions);

        console.log(`WoD TriggerManager | MOVEMENT: from (${actualPrevState.rect.x}, ${actualPrevState.rect.y}) to (${nextState.rect.x}, ${nextState.rect.y})`);
        console.log(`WoD TriggerManager | TILES: entered=[${Array.from(enteredTiles).join(', ')}] exited=[${Array.from(exitedTiles).join(', ')}]`);

        
        for (const tileId of enteredTiles) {
            const tileDoc = canvas.scene.tiles.get(tileId);
            if (tileDoc) {
                                this._fireDocumentTriggers('tile', tileDoc, tokenDoc, 'onEnter');
            }
        }

        for (const tileId of exitedTiles) {
            const tileDoc = canvas.scene.tiles.get(tileId);
            if (tileDoc) {
                this._fireDocumentTriggers('tile', tileDoc, tokenDoc, 'onExit');
            }
        }

        if (canvas.scene.regions) {
            for (const regionId of enteredRegions) {
                const regionDoc = canvas.scene.regions.get(regionId);
                if (regionDoc) this._fireDocumentTriggers('region', regionDoc, tokenDoc, 'onEnter');
            }

            for (const regionId of exitedRegions) {
                const regionDoc = canvas.scene.regions.get(regionId);
                if (regionDoc) this._fireDocumentTriggers('region', regionDoc, tokenDoc, 'onExit');
            }
        }
    }

    _computeTokenState(tokenDoc) {
        const gridSize = canvas?.grid?.size || 100;
        const widthPx = (tokenDoc.width || 1) * gridSize;
        const heightPx = (tokenDoc.height || 1) * gridSize;

        const tokenRect = {
            x: tokenDoc.x ?? 0,
            y: tokenDoc.y ?? 0,
            width: widthPx,
            height: heightPx
        };

        const tiles = new Set();
        for (const tile of canvas.scene.tiles) {
            const tokenElevation = tokenDoc.elevation ?? 0;
            const tileElevation = tile.elevation ?? 0;
            
            // Check both 2D intersection and elevation
            if (this._rectIntersects(tokenRect, tile) && Math.abs(tokenElevation - tileElevation) < 1) {
                tiles.add(tile.id);
                console.log(`WoD TriggerManager | Tile ${tile.id} at (${tile.x}, ${tile.y}) elevation=${tileElevation} intersects token at (${tokenRect.x}, ${tokenRect.y}) elevation=${tokenElevation}`);
            }
        }
        
        // Also check specifically for the trigger tile
        const triggerTile = canvas.scene.tiles.get('yOMeLH13TRgES3Uf');
        if (triggerTile) {
            const tokenElevation = tokenDoc.elevation ?? 0;
            const tileElevation = triggerTile.elevation ?? 0;
            
            console.log(`WoD TriggerManager | Trigger tile yOMeLH13TRgES3Uf at (${triggerTile.x}, ${triggerTile.y}) size ${triggerTile.width}x${triggerTile.height} elevation=${tileElevation}`);
            console.log(`WoD TriggerManager | Token rect: x=${tokenRect.x}, y=${tokenRect.y}, w=${tokenRect.width}, h=${tokenRect.height} elevation=${tokenElevation}`);
            console.log(`WoD TriggerManager | Intersection: ${this._rectIntersects(tokenRect, triggerTile)} (ignoring elevation)`);
            console.log(`WoD TriggerManager | Elevation match: ${Math.abs(tokenElevation - tileElevation) < 1}`);
        } else {
            console.warn('WoD TriggerManager | Trigger tile yOMeLH13TRgES3Uf not found in scene!');
        }

        const regions = new Set();
        if (canvas.scene.regions) {
            for (const region of canvas.scene.regions) {
                if (this._rectIntersectsRegion(tokenRect, region)) regions.add(region.id);
            }
        }

        
        return {
            sceneId: canvas.scene.id,
            rect: tokenRect,
            tiles,
            regions
        };
    }

    _pointInRect(point, tileDoc) {
        const r = {
            x: tileDoc.x ?? 0,
            y: tileDoc.y ?? 0,
            width: tileDoc.width ?? 0,
            height: tileDoc.height ?? 0
        };

        return point.x >= r.x && point.x <= (r.x + r.width) && point.y >= r.y && point.y <= (r.y + r.height);
    }

    _pointInRegion(point, regionDoc) {
        // Best-effort across Foundry versions.
        const obj = regionDoc.object;

        if (obj?.contains) {
            try {
                return obj.contains(point.x, point.y);
            } catch (e) {
                // fallthrough
            }
        }

        if (obj?.shape?.contains) {
            try {
                return obj.shape.contains(point.x, point.y);
            } catch (e) {
                // fallthrough
            }
        }

        if (obj?.bounds?.contains) {
            return obj.bounds.contains(point.x, point.y);
        }

        // Fallback: rectangular region document data
        if (regionDoc.x !== undefined && regionDoc.y !== undefined && regionDoc.width !== undefined && regionDoc.height !== undefined) {
            return point.x >= regionDoc.x && point.x <= (regionDoc.x + regionDoc.width) && point.y >= regionDoc.y && point.y <= (regionDoc.y + regionDoc.height);
        }

        return false;
    }

    _rectIntersects(rect1, rect2) {
        return !(rect1.x + rect1.width <= rect2.x ||
                rect2.x + rect2.width <= rect1.x ||
                rect1.y + rect1.height <= rect2.y ||
                rect2.y + rect2.height <= rect1.y);
    }

    _rectIntersectsRegion(tokenRect, region) {
        // Try to get region bounds from different sources
        const bounds = region.bounds || region.document?.bounds;
        if (bounds) {
            return this._rectIntersects(tokenRect, bounds);
        }

        // Fallback: rectangular region document data
        if (region.x !== undefined && region.y !== undefined && region.width !== undefined && region.height !== undefined) {
            return this._rectIntersects(tokenRect, region);
        }

        // Last resort: use center point
        const center = {
            x: tokenRect.x + tokenRect.width / 2,
            y: tokenRect.y + tokenRect.height / 2
        };
        return this._pointInRegion(center, region);
    }

    _getTilesAlongPath(fromRect, toRect) {
        const pathTiles = new Set();
        const steps = 10; // Check 10 points along the path
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: fromRect.x + (toRect.x - fromRect.x) * t + fromRect.width / 2,
                y: fromRect.y + (toRect.y - fromRect.y) * t + fromRect.height / 2
            };
            
            // Check which tiles contain this point
            for (const tile of canvas.scene.tiles) {
                if (this._pointInRect(point, tile)) {
                    pathTiles.add(tile.id);
                }
            }
        }
        
        return pathTiles;
    }

    _getCrossedTiles(fromRect, toRect) {
        const crossedTiles = new Set();
        const steps = 20; // Check more points along the path for accuracy
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            // Calculate token rectangle at this point along the path
            const tokenRectAtPoint = {
                x: fromRect.x + (toRect.x - fromRect.x) * t,
                y: fromRect.y + (toRect.y - fromRect.y) * t,
                width: fromRect.width,
                height: fromRect.height
            };
            
            // Check all tiles using rectangle intersection
            for (const tile of canvas.scene.tiles) {
                if (this._rectIntersects(tokenRectAtPoint, tile)) {
                    crossedTiles.add(tile.id);
                }
            }
        }
        return crossedTiles;
    }

    
    async _fireDocumentTriggers(documentType, doc, tokenDoc, eventType, sourceDoc = null, effect = null) {
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        if (!Array.isArray(triggers) || triggers.length === 0) return;

        console.log(`WoD TriggerManager | ${eventType.toUpperCase()}: ${triggers.length} triggers for ${documentType} ${doc.id}`);

        const actor = tokenDoc?.actor || null;
        for (const trigger of triggers) {
            if (!trigger || trigger.enabled === false) continue;
            if (trigger?.trigger?.eventType !== eventType) continue;
            
            // For onEffect events, check if the effect name matches
            if (eventType === 'onEffect' && effect) {
                const expectedEffectName = trigger?.trigger?.effectName?.trim().toLowerCase();
                const actualEffectName = effect.label?.trim().toLowerCase() || effect.name?.trim().toLowerCase();
                
                if (!expectedEffectName || expectedEffectName !== actualEffectName) {
                    continue;
                }
            }

            console.log(`WoD TriggerManager | TRIGGER: ${trigger.name || 'Unnamed'}`);

            const rollConfig = trigger.roll || {};
            const actionsConfig = trigger.actions || {};

            let passed = null;
            if (rollConfig.enabled) {
                passed = await this._executeRoll(actor, rollConfig);
            }

            // Always actions execute regardless of roll
            const alwaysActions = actionsConfig.always || [];
            if (alwaysActions.length > 0) {
                console.log(`WoD TriggerManager | ACTIONS: ${alwaysActions.length} always actions`);
                await this._executeActions(actor, alwaysActions, tokenDoc, sourceDoc || doc);
            }

            if (rollConfig.enabled) {
                if (passed) {
                    const successActions = actionsConfig.success || [];
                    if (successActions.length > 0) {
                        console.log(`WoD TriggerManager | ACTIONS: ${successActions.length} success actions`);
                        await this._executeActions(actor, successActions, tokenDoc, doc);
                    }
                } else {
                    const failureActions = actionsConfig.failure || [];
                    if (failureActions.length > 0) {
                        console.log(`WoD TriggerManager | ACTIONS: ${failureActions.length} failure actions`);
                        await this._executeActions(actor, failureActions, tokenDoc, doc);
                    }
                }
            }
        }
    }

    async _executeRoll(actor, rollConfig) {
        if (!actor) return false;

        const difficulty = Number(rollConfig.difficulty ?? 6);
        const successThreshold = Number(rollConfig.successThreshold ?? 1);

        let poolSize = 0;
        let poolName = '';
        let traits = [];

        if (rollConfig.type === 'attribute+ability') {
            const attribute = rollConfig.attribute;
            const ability = rollConfig.ability;

            if (!attribute || !ability) {
                ui.notifications?.warn('WoD TriggerManager | Roll missing attribute or ability');
                return false;
            }

            poolSize = actor.calculatePool ? actor.calculatePool(attribute, ability) : 0;
            poolName = `${attribute} + ${ability}`;
            traits = [
                { name: attribute, value: actor._findAttributeValue ? actor._findAttributeValue(attribute) : null, type: 'attribute', category: 'attribute' },
                { name: ability, value: actor._findAbilityValue ? actor._findAbilityValue(ability) : null, type: 'ability', category: 'ability' }
            ];
        } else if (rollConfig.type === 'single') {
            const poolNameConfig = rollConfig.poolName || '';
            if (!poolNameConfig) {
                ui.notifications?.warn('WoD TriggerManager | Single roll missing pool name');
                return false;
            }

            poolName = poolNameConfig;
            const poolKey = poolNameConfig.toLowerCase();

            // Try to find the pool value from actor system data
            const systemData = actor.system || actor.data?.system || {};
            
            // Check common locations for single pools
            if (systemData[poolKey] !== undefined) {
                poolSize = Number(systemData[poolKey]) || 0;
            } else if (systemData.pools?.[poolKey] !== undefined) {
                poolSize = Number(systemData.pools[poolKey]) || 0;
            } else if (systemData.advantages?.[poolKey]?.value !== undefined) {
                poolSize = Number(systemData.advantages[poolKey].value) || 0;
            } else if (systemData[poolKey]?.value !== undefined) {
                poolSize = Number(systemData[poolKey].value) || 0;
            } else {
                // Fallback: search through all properties
                const found = this._findPoolValue(systemData, poolKey);
                poolSize = found ?? 0;
            }

            traits = [{ name: poolNameConfig, value: poolSize, type: 'pool', category: 'pool' }];
        } else {
            ui.notifications?.warn(`WoD TriggerManager | Unknown roll type: ${rollConfig.type}`);
            return false;
        }

        if (poolSize <= 0) {
            ui.notifications?.warn(`WoD TriggerManager | Pool size is 0 for ${poolName}`);
            return false;
        }

        const result = await actor.rollPool(poolName, poolSize, {
            difficulty,
            specialty: false,
            modifiers: [],
            traits
        });

        return (result?.successes ?? 0) >= successThreshold && !result?.isBotch;
    }

    _findPoolValue(obj, key, depth = 0) {
        if (depth > 5 || !obj || typeof obj !== 'object') return null;
        
        for (const [k, v] of Object.entries(obj)) {
            if (k.toLowerCase() === key) {
                if (typeof v === 'number') return v;
                if (typeof v === 'object' && v?.value !== undefined) return Number(v.value);
            }
            if (typeof v === 'object' && v !== null) {
                const found = this._findPoolValue(v, key, depth + 1);
                if (found !== null) return found;
            }
        }
        return null;
    }

    _onDoorUpdated(wall, changes) {
        try {
            // Handle case where changes might be undefined or incomplete
            let oldState, newState;
            
            if (!changes) {
                const defaultState = (wall.ds !== undefined) ? wall.ds : CONST.WALL_DOOR_STATES.CLOSED;
                oldState = defaultState;
                newState = defaultState;
            } else {
                // Since changes._original is undefined, we need to determine old state differently
                // The new state is in changes.ds, but we need to infer the old state
                newState = (changes.ds !== undefined) ? changes.ds : wall.ds;
                
                // For the old state, we'll use the opposite of the new state since we know a change occurred
                // This is a workaround for when _original is not available
                if (newState === CONST.WALL_DOOR_STATES.OPEN) {
                    oldState = CONST.WALL_DOOR_STATES.CLOSED;
                } else if (newState === CONST.WALL_DOOR_STATES.CLOSED) {
                    oldState = CONST.WALL_DOOR_STATES.OPEN;
                } else {
                    oldState = wall.ds; // fallback to current state
                }
            }
        
        // Only proceed if there's an actual state change
        if (oldState === newState) {
            return;
        }
        
        // Find tiles that might have triggers for this door
        // Add defensive checking for wall properties
        if (!wall.c || !Array.isArray(wall.c) || wall.c.length < 4) {
            return;
        }
        
        // Wall coordinates are stored as [x1, y1, x2, y2] in the c array
        const doorCenter = { 
            x: (wall.c[0] + wall.c[2]) / 2,
            y: (wall.c[1] + wall.c[3]) / 2
        };
        
        for (const tile of canvas.scene.tiles) {
            const tileRect = {
                x: tile.x,
                y: tile.y,
                width: tile.width,
                height: tile.height
            };
            
            // Check if door is within tile bounds (with some tolerance)
            const tolerance = 50;
            const isWithinTile = doorCenter.x >= tileRect.x - tolerance && 
                doorCenter.x <= tileRect.x + tileRect.width + tolerance &&
                doorCenter.y >= tileRect.y - tolerance && 
                doorCenter.y <= tileRect.y + tileRect.height + tolerance;
            
            if (isWithinTile) {
                
                // Fire appropriate event based on state change
                if (oldState !== CONST.WALL_DOOR_STATES.OPEN && newState === CONST.WALL_DOOR_STATES.OPEN) {
                    this._fireDocumentTriggers('tile', tile, null, 'onDoorOpened', tile, null);
                } else if (oldState === CONST.WALL_DOOR_STATES.OPEN && newState !== CONST.WALL_DOOR_STATES.OPEN) {
                    this._fireDocumentTriggers('tile', tile, null, 'onDoorClosed', tile, null);
                }
            }
        }
        } catch (error) {
            console.error('WoD TriggerManager | ERROR in _onDoorUpdated:', error);
        }
    }

    _onTokenEffectsChanged(token, newEffects) {
        // Get the old effects from the token document
        const oldEffects = token.document.effects || [];
        
        // Find newly added effects
        const addedEffects = newEffects.filter(effect => 
            !oldEffects.some(oldEffect => oldEffect.id === effect.id)
        );

        // Check each added effect against triggers
        for (const effect of addedEffects) {
            this._checkEffectTriggers(token, effect);
        }
    }

    _onActorEffectsChanged(actor, newEffects) {
        // Get the old effects from the actor
        const oldEffects = actor.effects || [];
        
        // Find newly added effects
        const addedEffects = newEffects.filter(effect => 
            !oldEffects.some(oldEffect => oldEffect.id === effect.id)
        );

        // Check each added effect against triggers
        for (const effect of addedEffects) {
            // Find all tokens for this actor and check triggers
            const tokens = actor.getActiveTokens();
            for (const token of tokens) {
                this._checkEffectTriggers(token, effect);
            }
        }
    }

    _checkEffectTriggers(token, effect) {
        // Get all tiles that might have triggers
        const tileRect = {
            x: token.x,
            y: token.y,
            width: token.width,
            height: token.height
        };

        for (const tile of canvas.scene.tiles) {
            if (this._rectIntersects(tileRect, tile)) {
                // Check if this tile has an onEffect trigger for this effect
                this._fireDocumentTriggers('tile', tile, token, 'onEffect', tile, effect);
            }
        }
    }

    async _executeActions(actor, actions, tokenDoc, sourceDoc) {
        for (const action of actions) {
            if (!action) continue;
            
            const delay = parseFloat(action.delay) || 0;
            
            if (delay > 0) {
                // Schedule the action with delay
                setTimeout(async () => {
                    await this._executeSingleAction(actor, action, tokenDoc, sourceDoc);
                }, delay * 1000);
            } else {
                // Execute immediately
                await this._executeSingleAction(actor, action, tokenDoc, sourceDoc);
            }
        }
    }

    async _executeSingleAction(actor, action, tokenDoc, sourceDoc) {
        switch (action.type) {
            case 'door':
                await this._actionDoor(action);
                break;
            case 'enableCoreEffect':
            case 'disableCoreEffect':
            case 'toggleCoreEffect':
                await this._actionCoreEffect(actor, action);
                break;
            case 'changeTileAsset':
                await this._actionChangeTileAsset(action, tokenDoc, sourceDoc);
                break;
            default:
                ui.notifications?.warn(`WoD TriggerManager | Action type not implemented: ${action.type}`);
        }
    }

    async _actionDoor(action) {
        console.log(`WoD TriggerManager | DOOR ACTION: ${action.state} door ${action.target} (delay=${action.delay}s)`);
        
        if (!game.user.isGM) {
            ui.notifications?.warn('WoD TriggerManager | Only the GM can change door states');
            return;
        }

        const wallId = action.target;
        if (!wallId) {
            console.warn('WoD TriggerManager | No wall ID specified for door action');
            return;
        }

        const wall = canvas?.scene?.walls?.get(wallId);
        if (!wall) {
            console.warn('WoD TriggerManager | Wall not found:', wallId);
            return;
        }

        const currentState = wall.ds;
        const state = (action.state || action.parameters?.state || '').toLowerCase();

        let ds;
        switch (state) {
            case 'open':
                ds = CONST.WALL_DOOR_STATES.OPEN;
                break;
            case 'closed':
            case 'close':
                ds = CONST.WALL_DOOR_STATES.CLOSED;
                break;
            case 'locked':
            case 'lock':
                ds = CONST.WALL_DOOR_STATES.LOCKED;
                break;
            case 'unlocked':
            case 'unlock':
                ds = CONST.WALL_DOOR_STATES.CLOSED;
                break;
            default:
                console.warn('WoD TriggerManager | Unknown door state:', state);
                return;
        }

        if (wall.ds === ds) {
            console.log(`WoD TriggerManager | DOOR: ${action.target} already ${state}`);
            return;
        }

        console.log(`WoD TriggerManager | DOOR: ${action.target} ${this._getDoorStateName(currentState)} → ${state}`);
        await wall.update({ ds });
        console.log(`WoD TriggerManager | DOOR: ${action.target} updated to ${state}`);
    }

    async _actionChangeTileAsset(action, tokenDoc, sourceDoc) {
        if (!game.user.isGM) {
            ui.notifications?.warn('WoD TriggerManager | Only the GM can change tile assets');
            return;
        }

        const tileImg = action.tileImg;
        const tileId = action.tileId;
        const useCurrentTile = action.useCurrentTile;
        
        if (!tileImg) {
            console.warn('WoD TriggerManager | No tile image specified for tile asset action');
            return;
        }

        // Determine target tile based on settings
        let targetTile = null;
        
        if (useCurrentTile && sourceDoc) {
            // Use the current tile (the one with the trigger)
            targetTile = sourceDoc;
        } else if (tileId && !useCurrentTile) {
            // Use the specified tile ID
            targetTile = canvas.scene.tiles.get(tileId);
        }
        
        // Fall back to source tile if no tile ID specified or tile not found
        if (!targetTile && sourceDoc) {
            targetTile = sourceDoc;
        }
        
        if (!targetTile) {
            console.warn('WoD TriggerManager | No target tile available for tile asset action');
            return;
        }

        const originalImg = targetTile.texture.src;
        
        try {
            await targetTile.update({ 
                'texture.src': tileImg 
            });
        } catch (error) {
            console.error('WoD TriggerManager | Error updating tile asset:', error);
        }
    }

    _getDoorStateName(state) {
        switch (state) {
            case CONST.WALL_DOOR_STATES.OPEN: return 'OPEN';
            case CONST.WALL_DOOR_STATES.CLOSED: return 'CLOSED';
            case CONST.WALL_DOOR_STATES.LOCKED: return 'LOCKED';
            default: return 'NONE';
        }
    }

    _isTokenBeingDragged() {
        // Check if any token layer is currently being dragged
        if (canvas?.tokens?.controlled?.length > 0) {
            for (const token of canvas.tokens.controlled) {
                if (token._dragging) return true;
            }
        }
        
        // Check canvas drag state
        if (canvas?.mouseInteractionManager?.state) {
            return true;
        }
        
        // Check if mouse is down and dragging
        if (canvas?.mouseInteractionManager?.isDragging) {
            return true;
        }
        
        return false;
    }

    
    async _actionCoreEffect(actor, action) {
        if (!actor || !game.wod?.coreEffectsManager) return;

        const effectId = action.effectId;
        const sourceId = action.sourceId || 'trigger';

        if (!effectId) return;

        if (action.type === 'enableCoreEffect') {
            await game.wod.coreEffectsManager.enableCoreEffect(actor, effectId, sourceId);
        } else if (action.type === 'disableCoreEffect') {
            await game.wod.coreEffectsManager.disableCoreEffect(actor, effectId, sourceId);
        } else if (action.type === 'toggleCoreEffect') {
            const enabled = game.wod.coreEffectsManager.isCoreEffectEnabled(actor, effectId);
            if (enabled) {
                await game.wod.coreEffectsManager.disableCoreEffect(actor, effectId, sourceId);
            } else {
                await game.wod.coreEffectsManager.enableCoreEffect(actor, effectId, sourceId);
            }
        }
    }

    _setDiff(a, b) {
        const out = new Set();
        for (const v of a) {
            if (!b.has(v)) out.add(v);
        }
        return out;
    }
}
