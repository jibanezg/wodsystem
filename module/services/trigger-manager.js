import { TriggerAPI } from './trigger-api.js';
import { TriggerEventRegistry } from './trigger-event-registry.js';
import { ConditionEvaluator } from './condition-evaluator.js';
import { TriggerActionExecutor } from './trigger-action-executor.js';

/**
 * TriggerManager v2 - Core trigger event detection and execution
 * 
 * Architecture:
 * - Detects events from multiple document types (tile, region, wall, actor, scene)
 * - Routes events to appropriate triggers based on document type
 * - Evaluates conditions and executes actions
 * - Supports proximity detection as a modifier
 */
export class TriggerManager {
    constructor() {
        // Token state tracking for movement detection
        this._tokenState = new Map(); // tokenUuid -> {x,y,width,height, sceneId, tiles:Set, regions:Set}
        this._movementMonitors = new Map(); // tokenUuid -> animationFrame
        
        // Rate limiting
        this._processingQueue = new Set();
        this._lastProcessTime = new Map();
        this._PROCESS_COOLDOWN = 50;
        
        // Active timing intervals
        this._activeIntervals = new Map();
        
        // Debug mode - default to false during early initialization
        this._debugMode = false;
        
        // Initialize services
        this._triggerAPI = TriggerAPI.getInstance();
        this._registry = TriggerEventRegistry.getInstance();
        this._conditionEvaluator = new ConditionEvaluator();
        this._conditionEvaluator.setDebugMode(this._debugMode);
        this._actionExecutor = TriggerActionExecutor.getInstance();
    }

    initialize() {
        // Update debug mode from settings now that they're available
        // Use try-catch to handle case where settings aren't registered yet
        try {
            this._debugMode = true; // Temporarily enable debug mode for troubleshooting
        } catch (error) {
            console.warn('WoD TriggerManager | Debug mode setting not available, using default:', error);
            this._debugMode = true; // Enable debug mode by default for troubleshooting
        }
        this._conditionEvaluator.setDebugMode(this._debugMode);
        this._actionExecutor.setDebugMode(this._debugMode);
        
        if (this._debugMode) {
            console.log('WoD TriggerManager v2 | Initializing...');
        }
        
        // ==================== Actor Events (Global) ====================
        Hooks.on('updateActor', (actor, changes, options, userId) => {
            try {
                // Handle actor effect changes
                if (changes.effects !== undefined) {
                    this._onActorEffectsChanged(actor, changes.effects);
                }
                // Handle actor attribute changes (health, etc.)
                if (changes.system !== undefined) {
                    this._onActorAttributesChanged(actor, changes.system);
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error processing actor changes:', error);
            }
        });

        // ==================== Wall/Door Events ====================
        Hooks.on('updateWall', (wall, changes, options, userId) => {
            try {
                // Check if this is a door state change
                if (changes.ds !== undefined) {
                    this._onDoorStateChanged(wall, changes);
                }
            } catch (error) {
                console.error('WoD TriggerManager | Error processing door update:', error);
            }
        });

        // ==================== Combat Events ====================
        Hooks.on('combatStart', (combat, updateData) => {
            try {
                this._onCombatEvent('onCombatStart', combat);
            } catch (error) {
                console.error('WoD TriggerManager | Error processing combat start:', error);
            }
        });
        
        Hooks.on('deleteCombat', (combat, options, userId) => {
            try {
                this._onCombatEvent('onCombatEnd', combat);
            } catch (error) {
                console.error('WoD TriggerManager | Error processing combat end:', error);
            }
        });
        
        Hooks.on('combatRound', (combat, updateData, updateOptions) => {
            try {
                this._onCombatEvent('onRoundStart', combat);
            } catch (error) {
                console.error('WoD TriggerManager | Error processing round start:', error);
            }
        });

        // ==================== Canvas/Scene Events ====================
        Hooks.on('canvasReady', () => {
            try {
                this._primeInitialTokenState();
            } catch (error) {
                console.error('WoD TriggerManager | Error priming token state:', error);
            }
        });

        Hooks.on('ready', () => {
            try {
                this._primeInitialTokenState();
                this._startSceneTriggerMonitoring();
            } catch (error) {
                console.error('WoD TriggerManager | Error on ready:', error);
            }
        });
        
        if (this._debugMode) {
            console.log('WoD TriggerManager v2 | Initialization complete');
        }
    }

    _primeInitialTokenState() {
        if (!canvas?.scene) return;
        for (const tokenDoc of canvas.scene.tokens) {
            const state = this._computeTokenState(tokenDoc);
            this._tokenState.set(tokenDoc.uuid, state);
        }
    }

    // ==================== Token Movement Handler ====================
    
    /**
     * Handle token movement - fires onEnter, onExit, onProximity events
     * @param {TokenDocument} tokenDoc - The token document
     * @param {Object} changes - The changes object
     */
    _onTokenMovement(tokenDoc, changes) {
        if (!canvas?.scene) return;

        // Only care about movement
        if (changes.x === undefined && changes.y === undefined) return;

        if (this._debugMode) {
            console.log(`WoD TriggerManager | Token movement: ${tokenDoc.name}`);
        }

        const tokenUuid = tokenDoc.uuid;
        const now = Date.now();
        const lastProcess = this._lastProcessTime.get(tokenUuid) || 0;
        
        // Rate limit
        if (now - lastProcess < this._PROCESS_COOLDOWN) {
            return;
        }
        this._lastProcessTime.set(tokenUuid, now);

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

        if (this._debugMode) {
            console.log(`WoD TriggerManager | MOVEMENT: from (${actualPrevState.rect.x}, ${actualPrevState.rect.y}) to (${nextState.rect.x}, ${nextState.rect.y})`);
            console.log(`WoD TriggerManager | TILES: entered=[${Array.from(enteredTiles).join(', ')}] exited=[${Array.from(exitedTiles).join(', ')}]`);
        }

        
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

        // Check for effects on token and trigger onEffect for nearby tiles
        if (tokenDoc.actor && tokenDoc.actor.effects) {
            const effects = tokenDoc.actor.effects;
            if (effects.size > 0) {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Token has ${effects.size} effects, checking nearby tiles`);
                }
                
                // Get all tiles the token is currently on/near
                const currentTiles = this._computeTokenState(tokenDoc).tiles;
                
                for (const effect of effects) {
                    if (!effect) continue;
                    
                    for (const tileId of currentTiles) {
                        const tileDoc = canvas.scene.tiles.get(tileId);
                        if (tileDoc) {
                            if (this._debugMode) {
                                console.log(`WoD TriggerManager | Checking onEffect trigger for tile ${tileId} with effect ${effect.name}`);
                            }
                            this._fireDocumentTriggers('tile', tileDoc, tokenDoc, 'onEffect', tileDoc, effect);
                        }
                    }
                }
            }
        }
        
        // Check proximity-based triggers
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Checking proximity triggers for token ${tokenDoc.name}`);
        }
        this._checkProximityTriggers(tokenDoc);
    }
    
    /**
     * Check all proximity-based triggers for the given token
     * @param {TokenDocument} tokenDoc - The token to check
     */
    _checkProximityTriggers(tokenDoc) {
        if (!canvas?.scene) return;
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | _checkProximityTriggers called for token ${tokenDoc.name}`);
        }
        
        const tokenRect = this._getTokenRect(tokenDoc);
        const tokenCenter = {
            x: tokenRect.x + tokenRect.width / 2,
            y: tokenRect.y + tokenRect.height / 2
        };
        
        // Check all tiles for proximity triggers
        let totalTilesChecked = 0;
        let tilesWithTriggers = 0;
        
        for (const tile of canvas.scene.tiles) {
            totalTilesChecked++;
            const triggers = tile.getFlag('wodsystem', 'triggers') || [];
            if (!Array.isArray(triggers) || triggers.length === 0) continue;
            
            tilesWithTriggers++;
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Found ${triggers.length} triggers on tile ${tile.id}`);
            }
            
            for (const trigger of triggers) {
                if (!trigger || trigger.enabled === false) continue;
                
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Checking trigger:`, {
                        id: trigger.id,
                        name: trigger.name,
                        enabled: trigger.enabled,
                        scopeType: trigger.trigger?.scope?.type,
                        executionMode: trigger.trigger?.execution?.mode,
                        conditions: trigger.trigger?.conditions
                    });
                }
                
                // Check if this is a proximity scope trigger
                const scopeType = trigger.trigger?.scope?.type;
                if (scopeType !== 'proximity') continue;
                
                const proximityConfig = trigger.trigger?.scope?.proximity || {};
                const distance = proximityConfig.distance || 5;
                const unit = proximityConfig.unit || 'grid';
                const shape = proximityConfig.shape || 'circle';
                
                // Check if token is within proximity and get actual distance
                const proximityResult = this._isTokenWithinProximity(
                    tokenCenter, tile, distance, unit, shape
                );
                const isWithinProximity = proximityResult.isWithin;
                const actualDistance = proximityResult.distance;
                
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Proximity check:`, {
                        tokenId: trigger.id,
                        triggerName: trigger.name,
                        tokenCenter,
                        tilePosition: { x: tile.x, y: tile.y },
                        distance,
                        unit,
                        shape,
                        actualDistance,
                        isWithinProximity
                    });
                }
                
                if (isWithinProximity) {
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | Token within proximity of tile ${tile.id} at distance ${actualDistance} ${unit}`);
                    }
                    
                    // Get execution mode to determine how to handle the trigger
                    const execution = trigger.trigger?.execution || {};
                    const executionMode = execution.mode || 'event';
                    
                    if (executionMode === 'event') {
                        // Event mode: fire with 'onProximity' event type and distance context
                        this._fireDocumentTriggers('tile', tile, tokenDoc, 'onProximity', null, null, {
                            distance: actualDistance,
                            distanceUnit: unit
                        });
                    } else {
                        // State/Continuous mode: fire with 'onProximity' event type but let execution mode handle timing
                        this._fireDocumentTriggers('tile', tile, tokenDoc, 'onProximity', null, null, {
                            distance: actualDistance,
                            distanceUnit: unit
                        });
                    }
                }
            }
        }
        
        // Check all regions for proximity triggers
        if (canvas.scene.regions) {
            for (const region of canvas.scene.regions) {
                const triggers = region.getFlag('wodsystem', 'triggers') || [];
                if (!Array.isArray(triggers) || triggers.length === 0) continue;
                
                for (const trigger of triggers) {
                    if (!trigger || trigger.enabled === false) continue;
                    
                    const scopeType = trigger.trigger?.scope?.type;
                    if (scopeType !== 'proximity') continue;
                    
                    const proximityConfig = trigger.trigger?.scope?.proximity || {};
                    const distance = proximityConfig.distance || 5;
                    const unit = proximityConfig.unit || 'grid';
                    const shape = proximityConfig.shape || 'circle';
                    
                    // Check if token is within proximity and get actual distance
                    const proximityResult = this._isTokenWithinProximityOfRegion(
                        tokenCenter, region, distance, unit, shape
                    );
                    const isWithinProximity = proximityResult.isWithin;
                    const actualDistance = proximityResult.distance;
                    
                    if (isWithinProximity) {
                        if (this._debugMode) {
                            console.log(`WoD TriggerManager | Token within proximity of region ${region.id}`);
                        }
                        
                        // Get execution mode to determine how to handle the trigger
                        const execution = trigger.trigger?.execution || {};
                        const executionMode = execution.mode || 'event';
                        
                        if (executionMode === 'event') {
                            // Event mode: fire with 'onProximity' event type and distance context
                            this._fireDocumentTriggers('region', region, tokenDoc, 'onProximity', null, null, {
                                distance: actualDistance,
                                distanceUnit: unit
                            });
                        } else {
                            // State/Continuous mode: fire with 'onProximity' event type but let execution mode handle timing
                            this._fireDocumentTriggers('region', region, tokenDoc, 'onProximity', null, null, {
                                distance: actualDistance,
                                distanceUnit: unit
                            });
                        }
                    }
                }
            }
        }
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Proximity check complete: ${totalTilesChecked} tiles checked, ${tilesWithTriggers} with triggers`);
        }
    }
    
    /**
     * Get token rectangle from token document
     * @private
     */
    _getTokenRect(tokenDoc) {
        const gridSize = canvas?.grid?.size || 100;
        const widthPx = (tokenDoc.width || 1) * gridSize;
        const heightPx = (tokenDoc.height || 1) * gridSize;
        
        return {
            x: tokenDoc.x ?? 0,
            y: tokenDoc.y ?? 0,
            width: widthPx,
            height: heightPx
        };
    }
    
    /**
     * Check if token center is within proximity of a tile
     * @private
     */
    _isTokenWithinProximity(tokenCenter, tile, distance, unit, shape) {
        const gridSize = canvas?.grid?.size || 100;
        const distancePx = unit === 'grid' ? distance * gridSize : distance;
        
        // Get tile bounds
        const tileRect = {
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: tile.height
        };
        
        // Expand tile bounds by proximity distance
        const expandedRect = {
            x: tileRect.x - distancePx,
            y: tileRect.y - distancePx,
            width: tileRect.width + distancePx * 2,
            height: tileRect.height + distancePx * 2
        };
        
        if (shape === 'square' || shape === 'rectangle') {
            // Simple rectangle check - calculate distance to rectangle
            const dx = Math.max(0, Math.max(tileRect.x - tokenCenter.x, tokenCenter.x - (tileRect.x + tileRect.width)));
            const dy = Math.max(0, Math.max(tileRect.y - tokenCenter.y, tokenCenter.y - (tileRect.y + tileRect.height)));
            const distanceToTile = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToTile <= distancePx,
                distance: unit === 'grid' ? distanceToTile / gridSize : distanceToTile
            };
        } else {
            // Circle check - distance from token center to nearest point on tile
            const tileCenter = {
                x: tileRect.x + tileRect.width / 2,
                y: tileRect.y + tileRect.height / 2
            };
            
            // Find nearest point on tile to token center
            const nearestX = Math.max(tileRect.x, Math.min(tokenCenter.x, tileRect.x + tileRect.width));
            const nearestY = Math.max(tileRect.y, Math.min(tokenCenter.y, tileRect.y + tileRect.height));
            
            // Calculate distance from token center to nearest point
            const dx = tokenCenter.x - nearestX;
            const dy = tokenCenter.y - nearestY;
            const distanceToTile = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToTile <= distancePx,
                distance: unit === 'grid' ? distanceToTile / gridSize : distanceToTile
            };
        }
    }
    
    /**
     * Check if token center is within proximity of a region
     * @private
     */
    _isTokenWithinProximityOfRegion(tokenCenter, region, distance, unit, shape) {
        const gridSize = canvas?.grid?.size || 100;
        const distancePx = unit === 'grid' ? distance * gridSize : distance;
        
        // Get region bounds
        const bounds = region.bounds || region.document?.bounds;
        if (!bounds) return false;
        
        const regionRect = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
        };
        
        // Expand region bounds by proximity distance
        const expandedRect = {
            x: regionRect.x - distancePx,
            y: regionRect.y - distancePx,
            width: regionRect.width + distancePx * 2,
            height: regionRect.height + distancePx * 2
        };
        
        if (shape === 'square' || shape === 'rectangle') {
            // Calculate distance to rectangle
            const dx = Math.max(0, Math.max(regionRect.x - tokenCenter.x, tokenCenter.x - (regionRect.x + regionRect.width)));
            const dy = Math.max(0, Math.max(regionRect.y - tokenCenter.y, tokenCenter.y - (regionRect.y + regionRect.height)));
            const distanceToRegion = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToRegion <= distancePx,
                distance: unit === 'grid' ? distanceToRegion / gridSize : distanceToRegion
            };
        } else {
            // Circle check
            const nearestX = Math.max(regionRect.x, Math.min(tokenCenter.x, regionRect.x + regionRect.width));
            const nearestY = Math.max(regionRect.y, Math.min(tokenCenter.y, regionRect.y + regionRect.height));
            
            const dx = tokenCenter.x - nearestX;
            const dy = tokenCenter.y - nearestY;
            const distanceToRegion = Math.sqrt(dx * dx + dy * dy);
            
            return {
                isWithin: distanceToRegion <= distancePx,
                distance: unit === 'grid' ? distanceToRegion / gridSize : distanceToRegion
            };
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

        // Use Foundry's spatial indexing for tiles - much faster than iterating all tiles
        const tiles = new Set();
        const tokenElevation = tokenDoc.elevation ?? 0;
        
        // Get tiles in the token's vicinity using quadtree if available
        let nearbyTiles = [];
        if (canvas.scene.tiles.quadtree) {
            // Use quadtree for spatial lookup
            nearbyTiles = canvas.scene.tiles.quadtree.getObjects(tokenRect);
        } else {
            // Fallback to checking only tiles that could possibly intersect
            nearbyTiles = canvas.scene.tiles.filter(tile => {
                // Quick bounding box check before expensive intersection
                return (tile.x < tokenRect.x + tokenRect.width &&
                        tile.x + tile.width > tokenRect.x &&
                        tile.y < tokenRect.y + tokenRect.height &&
                        tile.y + tile.height > tokenRect.y);
            });
        }
        
        for (const tile of nearbyTiles) {
            const tileElevation = tile.elevation ?? 0;
            if (Math.abs(tokenElevation - tileElevation) < 1) {
                tiles.add(tile.id);
            }
        }

        // Use spatial indexing for regions too
        const regions = new Set();
        if (canvas.scene.regions) {
            let nearbyRegions = [];
            if (canvas.scene.regions.quadtree) {
                nearbyRegions = canvas.scene.regions.quadtree.getObjects(tokenRect);
            } else {
                nearbyRegions = canvas.scene.regions.filter(region => {
                    return region.bounds && 
                           region.bounds.x < tokenRect.x + tokenRect.width &&
                           region.bounds.x + region.bounds.width > tokenRect.x &&
                           region.bounds.y < tokenRect.y + tokenRect.height &&
                           region.bounds.y + region.bounds.height > tokenRect.y;
                });
            }
            
            for (const region of nearbyRegions) {
                if (this._rectIntersectsRegion(tokenRect, region)) {
                    regions.add(region.id);
                }
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
        const steps = 5; // Reduced from 10 to improve performance
        
        // Create expanded bounds to include the entire path
        const pathBounds = {
            x: Math.min(fromRect.x, toRect.x),
            y: Math.min(fromRect.y, toRect.y),
            width: Math.abs(toRect.x - fromRect.x) + fromRect.width,
            height: Math.abs(toRect.y - fromRect.y) + fromRect.height
        };
        
        // Get tiles that could possibly be in the path using spatial indexing
        let candidateTiles = [];
        if (canvas.scene.tiles.quadtree) {
            candidateTiles = canvas.scene.tiles.quadtree.getObjects(pathBounds);
        } else {
            candidateTiles = canvas.scene.tiles.filter(tile => {
                return (tile.x < pathBounds.x + pathBounds.width &&
                        tile.x + tile.width > pathBounds.x &&
                        tile.y < pathBounds.y + pathBounds.height &&
                        tile.y + tile.height > pathBounds.y);
            });
        }
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: fromRect.x + (toRect.x - fromRect.x) * t + fromRect.width / 2,
                y: fromRect.y + (toRect.y - fromRect.y) * t + fromRect.height / 2
            };
            
            // Only check candidate tiles, not all tiles
            for (const tile of candidateTiles) {
                if (this._pointInRect(point, tile)) {
                    pathTiles.add(tile.id);
                }
            }
        }
        
        return pathTiles;
    }

    _getCrossedTiles(fromRect, toRect) {
        const crossedTiles = new Set();
        const steps = 8; // Reduced from 20 to improve performance
        
        // Create expanded bounds to include the entire path
        const pathBounds = {
            x: Math.min(fromRect.x, toRect.x),
            y: Math.min(fromRect.y, toRect.y),
            width: Math.abs(toRect.x - fromRect.x) + fromRect.width,
            height: Math.abs(toRect.y - fromRect.y) + fromRect.height
        };
        
        // Get tiles that could possibly be crossed using spatial indexing
        let candidateTiles = [];
        if (canvas.scene.tiles.quadtree) {
            candidateTiles = canvas.scene.tiles.quadtree.getObjects(pathBounds);
        } else {
            candidateTiles = canvas.scene.tiles.filter(tile => {
                return (tile.x < pathBounds.x + pathBounds.width &&
                        tile.x + tile.width > pathBounds.x &&
                        tile.y < pathBounds.y + pathBounds.height &&
                        tile.y + tile.height > pathBounds.y);
            });
        }
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            // Calculate token rectangle at this point along the path
            const tokenRectAtPoint = {
                x: fromRect.x + (toRect.x - fromRect.x) * t,
                y: fromRect.y + (toRect.y - fromRect.y) * t,
                width: fromRect.width,
                height: fromRect.height
            };
            
            // Only check candidate tiles, not all tiles
            for (const tile of candidateTiles) {
                if (this._rectIntersects(tokenRectAtPoint, tile)) {
                    crossedTiles.add(tile.id);
                }
            }
        }
        return crossedTiles;
    }

    
    async _fireDocumentTriggers(documentType, doc, tokenDoc, eventType, sourceDoc = null, effect = null, additionalContext = {}) {
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        if (!Array.isArray(triggers) || triggers.length === 0) return;

        if (this._debugMode) {
            console.log(`WoD TriggerManager | ${eventType.toUpperCase()}: ${triggers.length} triggers for ${documentType} ${doc.id}`);
        }

        const actor = tokenDoc?.actor || null;
        for (const trigger of triggers) {
            if (!trigger || trigger.enabled === false) continue;
            
            // Build evaluation context
            const context = {
                token: tokenDoc,
                actor: actor,
                document: doc,
                documentType: documentType,
                eventType: eventType,
                effect: effect,
                sourceDoc: sourceDoc,
                entered: eventType === 'onEnter',
                exited: eventType === 'onExit',
                ...additionalContext  // Merge additional context
            };
            
            // Check if trigger should fire based on format (new vs legacy)
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Evaluating trigger "${trigger.name}" for firing`);
            }
            const shouldFire = this._shouldTriggerFire(trigger, context, executionMode);
            if (!shouldFire) {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Trigger "${trigger.name}" conditions not met, skipping`);
                }
                continue;
            }
            
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Trigger "${trigger.name}" conditions met, executing actions`);
            }

            // Notify TriggerAPI that trigger is firing
            this._triggerAPI.notifyTriggerFired(trigger.id, { passed: true }, context);

            // Get execution configuration
            const execution = trigger.trigger?.execution || {};
            const executionMode = execution.mode || 'event';
            const timingConfig = execution.timing || {};
            const delay = timingConfig.delay || 0;
            const repeat = timingConfig.repeat || 0;
            const duration = timingConfig.duration || null;

            if (this._debugMode) {
                console.log(`WoD TriggerManager | Trigger "${trigger.name}" execution config:`, {
                    executionMode,
                    delay,
                    repeat,
                    duration
                });
            }

            // Route based on execution mode
            if (executionMode === 'event') {
                // Event mode: route by specific event OR conditions
                const triggerEvent = execution.event || 'onEnter';
                const hasConditions = trigger.trigger?.conditions && trigger.trigger.conditions.length > 0;
                
                // If trigger has conditions, they were already evaluated in _shouldTriggerFire
                // If no conditions, check event type match
                if (hasConditions || triggerEvent === eventType) {
                    await this._executeTimedTrigger(trigger, context, { delay, repeat, duration });
                }
            } else if (executionMode === 'continuous') {
                // Continuous mode: always evaluate conditions
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Trigger "${trigger.name}" using continuous mode`);
                }
                await this._executeContinuousTrigger(trigger, context, { delay, repeat, duration });
            } else {
                // State mode: evaluate once when conditions become true
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Trigger "${trigger.name}" using state mode`);
                }
                await this._executeTimedTrigger(trigger, context, { delay, repeat, duration });
            }
        }
    }
    
    // ==================== V2 Trigger Execution ====================
    
    /**
     * Fire triggers on a document using v2 schema
     * @param {Document} doc - The document with triggers
     * @param {string} documentType - The document type (tile, region, wall, actor, scene)
     * @param {string} eventType - The event type
     * @param {Object} context - Additional context
     */
    async _fireDocumentTriggersV2(doc, documentType, eventType, context = {}) {
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        if (!Array.isArray(triggers) || triggers.length === 0) return;
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | V2: Checking ${triggers.length} triggers on ${documentType} for event: ${eventType}`);
        }
        
        for (const trigger of triggers) {
            if (!trigger || trigger.enabled === false) continue;
            
            // Check if trigger is v2 schema
            const isV2 = trigger.version === 2 || trigger.anchor?.documentType;
            
            if (isV2) {
                // V2 Schema processing
                
                // Check if this trigger responds to this event
                if (trigger.execution?.mode === 'event') {
                    if (trigger.execution.event !== eventType) continue;
                }
                
                // Build full context
                const fullContext = {
                    eventType: eventType,
                    document: doc,
                    documentType: documentType,
                    ...context
                };
                
                // Evaluate conditions
                if (trigger.conditions && trigger.conditions.length > 0) {
                    const result = this._conditionEvaluator.evaluateConditions(trigger.conditions, fullContext);
                    if (!result.passed) {
                        if (this._debugMode) {
                            console.log(`WoD TriggerManager | V2: Trigger "${trigger.name}" conditions not met`);
                        }
                        continue;
                    }
                }
                
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | V2: Executing trigger "${trigger.name}"`);
                }
                
                // Execute trigger
                await this._executeTriggerV2(trigger, fullContext);
            } else {
                // Legacy schema - use old method
                // This maintains backward compatibility during transition
            }
        }
    }
    
    /**
     * Execute a v2 schema trigger
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     */
    async _executeTriggerV2(trigger, context) {
        const execution = trigger.execution || {};
        const timing = execution.timing || {};
        const delay = timing.delay || 0;
        const repeat = timing.repeat || 0;
        const duration = timing.duration || null;
        
        // Notify API
        this._triggerAPI.notifyTriggerFired(trigger.id, { passed: true }, context);
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | V2: Trigger "${trigger.name}" timing:`, { delay, repeat, duration });
        }
        
        // Apply delay if specified
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
        
        // Execute actions
        await this._executeTriggerActionsV2(trigger, context);
        
        // Handle repeat
        if (repeat > 0) {
            const startTime = Date.now();
            const repeatInterval = setInterval(async () => {
                // Check duration limit
                if (duration && (Date.now() - startTime) >= duration * 1000) {
                    clearInterval(repeatInterval);
                    this._activeIntervals.delete(trigger.id);
                    return;
                }
                
                await this._executeTriggerActionsV2(trigger, context);
            }, repeat * 1000);
            
            this._activeIntervals.set(trigger.id, repeatInterval);
        }
    }
    
    /**
     * Execute actions for a v2 schema trigger
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     */
    async _executeTriggerActionsV2(trigger, context) {
        // Handle roll if configured
        let rollPassed = true;
        if (trigger.roll?.enabled && context.actor) {
            rollPassed = await this._executeRoll(context.actor, trigger.roll);
        }
        
        // Determine which actions to execute
        const actions = trigger.actions || {};
        const actionsToExecute = [];
        
        // Always actions
        if (actions.always && actions.always.length > 0) {
            actionsToExecute.push(...actions.always);
        }
        
        // Success/Failure actions based on roll
        if (trigger.roll?.enabled) {
            if (rollPassed && actions.success && actions.success.length > 0) {
                actionsToExecute.push(...actions.success);
            } else if (!rollPassed && actions.failure && actions.failure.length > 0) {
                actionsToExecute.push(...actions.failure);
            }
        }
        
        // Execute actions using the action executor
        if (actionsToExecute.length > 0) {
            await this._actionExecutor.executeActions(actionsToExecute, trigger, context);
        }
    }
    
    /**
     * Execute a single action with v2 target selection (legacy - use _actionExecutor instead)
     * @param {Object} action - The action object
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     * @deprecated Use TriggerActionExecutor.executeAction instead
     */
    async _executeActionV2(action, trigger, context) {
        // Delegate to action executor
        return this._actionExecutor.executeAction(action, trigger, context);
    }
    
    /**
     * Legacy execute action method - kept for backwards compatibility
     * @deprecated
     */
    async _executeActionV2Legacy(action, trigger, context) {
        if (!action || !action.type) return;
        
        // Handle action delay
        const actionDelay = action.delay || 0;
        if (actionDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, actionDelay * 1000));
        }
        
        // Resolve target based on target mode
        const targetDoc = await this._resolveActionTarget(action, trigger, context);
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | V2: Executing action "${action.type}" on target:`, targetDoc?.id || 'self');
        }
        
        // Execute based on action type
        switch (action.type) {
            case 'door':
                await this._actionDoor({ 
                    ...action, 
                    target: targetDoc?.id || action.parameters?.target || action.target 
                });
                break;
                
            case 'enableCoreEffect':
            case 'disableCoreEffect':
            case 'toggleCoreEffect':
                const targetActor = targetDoc?.actor || context.actor;
                await this._actionCoreEffect(targetActor, action);
                break;
                
            case 'changeTileAsset':
                await this._actionChangeTileAsset(action, context.token, targetDoc || context.document);
                break;
                
            default:
                console.warn(`WoD TriggerManager | V2: Unknown action type: ${action.type}`);
        }
    }
    
    /**
     * Resolve the target for an action based on target mode
     * @param {Object} action - The action object
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The execution context
     * @returns {Document|null} The resolved target document
     */
    async _resolveActionTarget(action, trigger, context) {
        const targetConfig = action.target || { mode: 'self' };
        const mode = targetConfig.mode || 'self';
        
        switch (mode) {
            case 'self':
                // Target is the document the trigger is anchored to
                return context.document;
                
            case 'triggering':
                // Target is the triggering token/actor
                return context.token || null;
                
            case 'specific':
                // Target is a specific document by ID
                const docType = targetConfig.documentType;
                const docId = targetConfig.documentId;
                
                if (!docId) return null;
                
                switch (docType) {
                    case 'wall':
                        return canvas.scene.walls.get(docId);
                    case 'tile':
                        return canvas.scene.tiles.get(docId);
                    case 'token':
                        return canvas.scene.tokens.get(docId);
                    case 'actor':
                        return game.actors.get(docId);
                    default:
                        return null;
                }
                
            case 'all':
                // Return first matching document (for now - full implementation would return array)
                // This is a simplified implementation
                return context.document;
                
            default:
                return context.document;
        }
    }

    /**
     * Determine if a trigger should fire based on its conditions
     * Supports both new compound conditions format and legacy eventType format
     * @private
     */
    _shouldTriggerFire(trigger, context, executionMode = 'event') {
        // Check target actor types first - this filters which actors the trigger applies to
        const actorTypes = trigger.trigger?.actorTypes || [];
        if (actorTypes.length > 0) {
            const actorType = context.actor?.type;
            if (!actorType) {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Trigger "${trigger.name}" has target types but no actor in context, skipping`);
                }
                return false;
            }
            
            // Handle special target formats
            const targetTypeMatches = this._checkTargetTypeMatch(actorTypes, actorType, context);
            if (!targetTypeMatches) {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Trigger "${trigger.name}" target types [${actorTypes.join(', ')}] do not match actor type "${actorType}", skipping`);
                }
                return false;
            }
        }
        
        // Check scope type first - for proximity triggers, they should only fire on onProximity events
        const scopeType = trigger.trigger?.scope?.type;
        
        // New format with scope and conditions
        if (scopeType) {
            // Proximity triggers: event mode only fires on onProximity, state/continuous modes evaluate conditions
            if (scopeType === 'proximity') {
                if (executionMode === 'event' && context.eventType !== 'onProximity') {
                    return false;
                }
                // For state/continuous modes, allow condition evaluation regardless of event type
            }
            
            // Tile/region triggers fire on onEnter/onExit/onEffect based on boundary config
            if (scopeType === 'tile' || scopeType === 'region') {
                const boundary = trigger.trigger?.scope?.[scopeType]?.boundary || 'both';
                if (boundary === 'enter' && context.eventType !== 'onEnter') return false;
                if (boundary === 'exit' && context.eventType !== 'onExit') return false;
                // 'both' accepts either
            }
            
            // Global triggers fire on onGlobal events
            if (scopeType === 'global' && context.eventType !== 'onGlobal') {
                if (executionMode === 'event') {
                    return false;
                }
                // For state/continuous modes, allow condition evaluation regardless of event type
            }
        }
        
        // New format: use conditions array with ConditionEvaluator
        if (trigger.trigger?.conditions && Array.isArray(trigger.trigger.conditions) && trigger.trigger.conditions.length > 0) {
            const result = this._conditionEvaluator.evaluateConditions(trigger.trigger.conditions, context);
            return result.passed;
        }
        
        // State/Continuous mode with no conditions: handle based on scope type
        if (executionMode === 'state' || executionMode === 'continuous') {
            if (scopeType === 'proximity' && context.eventType === 'onProximity') {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | State/Continuous trigger "${trigger.name}" with no conditions firing for proximity`);
                }
                return true;
            }
            
            if (scopeType === 'tile' || scopeType === 'region') {
                const boundary = trigger.trigger?.scope?.[scopeType]?.boundary || 'both';
                if (boundary === 'enter' && context.eventType === 'onEnter') {
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | State/Continuous trigger "${trigger.name}" with no conditions firing for tile/region enter`);
                    }
                    return true;
                }
                if (boundary === 'exit' && context.eventType === 'onExit') {
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | State/Continuous trigger "${trigger.name}" with no conditions firing for tile/region exit`);
                    }
                    return true;
                }
                if (boundary === 'both' && (context.eventType === 'onEnter' || context.eventType === 'onExit')) {
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | State/Continuous trigger "${trigger.name}" with no conditions firing for tile/region ${context.eventType}`);
                    }
                    return true;
                }
            }
            
            if (scopeType === 'global') {
                // Global triggers fire regardless of context
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | State/Continuous trigger "${trigger.name}" with no conditions firing for global scope`);
                }
                return true;
            }
        }
        
        // Legacy format: check eventType directly
        const eventType = context.eventType;
        const triggerEventType = trigger.trigger?.eventType;
        
        if (triggerEventType !== eventType) {
            return false;
        }
        
        // For onEffect events, check if the effect name matches
        if (eventType === 'onEffect' && context.effect) {
            const expectedEffectName = trigger.trigger?.effectName?.trim().toLowerCase();
            const actualEffectName = context.effect.label?.trim().toLowerCase() || context.effect.name?.trim().toLowerCase();
            
            if (!expectedEffectName || expectedEffectName !== actualEffectName) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Check if actor type matches the target specification
     * @param {Array} targetTypes - Array of target type specifications
     * @param {string} actorType - The actor's type
     * @param {Object} context - The trigger context
     * @returns {boolean} Whether the actor matches the target specification
     * @private
     */
    _checkTargetTypeMatch(targetTypes, actorType, context) {
        for (const targetType of targetTypes) {
            // Handle "any" - matches any actor
            if (targetType === 'any') {
                return true;
            }
            
            // Handle "any:Type1,Type2" - matches any of the specified types
            if (targetType.startsWith('any:')) {
                const allowedTypes = targetType.substring(4).split(',').map(t => t.trim());
                if (allowedTypes.includes(actorType)) {
                    return true;
                }
                continue;
            }
            
            // Handle special conditions like "hasEffect", "isPlayer", "isGM", "isOwner"
            if (targetType.startsWith('hasEffect') || targetType.startsWith('is')) {
                if (this._evaluateSpecialCondition(targetType, context)) {
                    return true;
                }
                continue;
            }
            
            // Handle element types like "tokens", "doors", "walls", "tiles", "regions"
            if (['tokens', 'doors', 'walls', 'tiles', 'regions'].includes(targetType)) {
                if (this._evaluateElementTypeTarget(targetType, context)) {
                    return true;
                }
                continue;
            }
            
            // Handle direct type match
            if (targetType === actorType) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Evaluate special condition targets like "isPlayer", "isGM", "isOwner"
     * @param {string} condition - The special condition
     * @param {Object} context - The trigger context
     * @returns {boolean} Whether the condition is met
     * @private
     */
    _evaluateSpecialCondition(condition, context) {
        const actor = context.actor;
        if (!actor) return false;
        
        switch (condition) {
            case 'isPlayer':
                // Check if actor has any player owner (not GM)
                return Object.entries(actor.ownership || {}).some(([userId, perm]) => {
                    const user = game.users.get(userId);
                    return user && !user.isGM && perm >= 1;
                });
                
            case 'isGM':
                // Check if actor is owned by GM
                return Object.entries(actor.ownership || {}).some(([userId, perm]) => {
                    const user = game.users.get(userId);
                    return user && user.isGM && perm >= 1;
                });
                
            case 'isOwner':
                // Check if current user owns the actor
                const currentUserId = game.user.id;
                return (actor.ownership?.[currentUserId] || 0) >= 1;
                
            case 'hasEffect':
                // Check if actor has any effects
                return actor.effects && actor.effects.size > 0;
                
            default:
                // Handle "hasEffect:EffectName" format
                if (condition.startsWith('hasEffect:')) {
                    const effectName = condition.substring(10);
                    return actor.effects.some(effect => effect.name === effectName);
                }
                return false;
        }
    }

    /**
     * Evaluate element type targets like "tokens", "doors", "walls", "tiles", "regions"
     * @param {string} elementType - The element type
     * @param {Object} context - The trigger context
     * @returns {boolean} Whether the element type matches
     * @private
     */
    _evaluateElementTypeTarget(elementType, context) {
        switch (elementType) {
            case 'tokens':
                return context.token !== undefined;
            case 'doors':
            case 'walls':
                return context.wall !== undefined;
            case 'tiles':
                return context.tile !== undefined;
            case 'regions':
                return context.region !== undefined;
            default:
                return false;
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

    // ==================== Door State Handler ====================
    
    /**
     * Get a human-readable name for a door state
     * @param {number} state - The door state constant
     * @returns {string} Human-readable state name
     */
    _getDoorStateName(state) {
        switch (state) {
            case CONST.WALL_DOOR_STATES.CLOSED: return 'closed';
            case CONST.WALL_DOOR_STATES.OPEN: return 'open';
            case CONST.WALL_DOOR_STATES.LOCKED: return 'locked';
            default: return 'unknown';
        }
    }
    
    /**
     * Handle door state changes - fires door triggers on the wall itself AND scene triggers
     * @param {WallDocument} wall - The wall document
     * @param {Object} changes - The changes object
     */
    _onDoorStateChanged(wall, changes) {
        try {
            if (!canvas?.scene) return;
            
            // Determine old and new state
            const newState = changes.ds;
            let oldState;
            
            // Infer old state from the change
            if (newState === CONST.WALL_DOOR_STATES.OPEN) {
                oldState = CONST.WALL_DOOR_STATES.CLOSED;
            } else if (newState === CONST.WALL_DOOR_STATES.CLOSED) {
                oldState = CONST.WALL_DOOR_STATES.OPEN;
            } else if (newState === CONST.WALL_DOOR_STATES.LOCKED) {
                oldState = CONST.WALL_DOOR_STATES.CLOSED;
            } else {
                oldState = wall.ds;
            }
            
            if (oldState === newState) return;
            
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Door state changed: ${this._getDoorStateName(oldState)} -> ${this._getDoorStateName(newState)}`);
            }
            
            // Determine which event to fire
            let eventType = null;
            if (newState === CONST.WALL_DOOR_STATES.OPEN) {
                eventType = 'onDoorOpened';
            } else if (newState === CONST.WALL_DOOR_STATES.CLOSED && oldState === CONST.WALL_DOOR_STATES.OPEN) {
                eventType = 'onDoorClosed';
            } else if (newState === CONST.WALL_DOOR_STATES.LOCKED) {
                eventType = 'onDoorLocked';
            } else if (oldState === CONST.WALL_DOOR_STATES.LOCKED && newState !== CONST.WALL_DOOR_STATES.LOCKED) {
                eventType = 'onDoorUnlocked';
            }
            
            if (!eventType) return;
            
            // 1. Fire triggers on the wall/door itself (v2 architecture)
            this._fireDocumentTriggersV2(wall, 'wall', eventType, {
                oldState: oldState,
                newState: newState,
                wall: wall
            });
            
            // 2. Fire scene-level triggers (onAnyDoorOpened, onAnyDoorClosed)
            const sceneEventType = eventType === 'onDoorOpened' ? 'onAnyDoorOpened' : 
                                   eventType === 'onDoorClosed' ? 'onAnyDoorClosed' : null;
            if (sceneEventType) {
                this._fireSceneTriggers(sceneEventType, {
                    wall: wall,
                    oldState: oldState,
                    newState: newState
                });
            }
            
        } catch (error) {
            console.error('WoD TriggerManager | Error in _onDoorStateChanged:', error);
        }
    }
    
    // ==================== Combat Event Handler ====================
    
    /**
     * Handle combat events - fires scene-level combat triggers
     * @param {string} eventType - The combat event type
     * @param {Combat} combat - The combat instance
     */
    _onCombatEvent(eventType, combat) {
        if (!canvas?.scene) return;
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Combat event: ${eventType}`);
        }
        
        this._fireSceneTriggers(eventType, {
            combat: combat,
            round: combat?.round,
            turn: combat?.turn
        });
    }
    
    // ==================== Scene Trigger Monitoring ====================
    
    /**
     * Start monitoring for scene-level triggers
     */
    _startSceneTriggerMonitoring() {
        if (this._debugMode) {
            console.log('WoD TriggerManager | Starting scene trigger monitoring');
        }
        // Scene triggers are fired by specific events, no continuous monitoring needed
        // This method exists for future time-based triggers (Simple Calendar integration)
    }
    
    /**
     * Fire triggers attached to the scene document
     * @param {string} eventType - The event type
     * @param {Object} context - Additional context
     */
    _fireSceneTriggers(eventType, context = {}) {
        if (!canvas?.scene) return;
        
        console.log(`WoD TriggerManager | _fireSceneTriggers called with eventType: ${eventType}`, context);
        
        const sceneTriggers = canvas.scene.getFlag('wodsystem', 'sceneTriggers') || [];
        if (!Array.isArray(sceneTriggers) || sceneTriggers.length === 0) {
            console.log(`WoD TriggerManager | No scene triggers found for event: ${eventType}`);
            return;
        }
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Checking ${sceneTriggers.length} scene triggers for event: ${eventType}`);
        }
        
        for (const trigger of sceneTriggers) {
            if (!trigger.enabled) continue;
            
            // Check if this trigger responds to this event
            if (trigger.execution?.mode === 'event') {
                if (trigger.execution.event !== eventType) continue;
            }
            
            // Check target filtering for scene triggers
            const actorTypes = trigger.trigger?.actorTypes || [];
            if (actorTypes.length > 0) {
                // For scene triggers, we need to determine if any relevant actors are involved
                const shouldContinue = this._checkSceneTriggerTargetMatch(trigger, context, eventType);
                if (!shouldContinue) continue;
            }
            
            // Build full context
            const fullContext = {
                eventType: eventType,
                scene: canvas.scene,
                ...context
            };
            
            // Evaluate conditions
            if (trigger.conditions && trigger.conditions.length > 0) {
                const result = this._conditionEvaluator.evaluateConditions(trigger.conditions, fullContext);
                if (!result.passed) continue;
            }
            
            // Execute trigger
            this._executeTriggerV2(trigger, fullContext);
        }
    }

    /**
     * Check if a scene trigger should fire based on target matching
     * @param {Object} trigger - The trigger object
     * @param {Object} context - The event context
     * @param {string} eventType - The event type
     * @returns {boolean} Whether the trigger should continue processing
     * @private
     */
    _checkSceneTriggerTargetMatch(trigger, context, eventType) {
        const actorTypes = trigger.trigger?.actorTypes || [];
        if (actorTypes.length === 0) return true; // No target restriction
        
        // For scene triggers, we need to determine relevant actors based on the event type
        let relevantActors = [];
        
        switch (eventType) {
            case 'onEffectApplied':
            case 'onEffectRemoved':
                // For effect events, check all actors in the scene
                relevantActors = canvas.scene.tokens.map(t => t.actor).filter(a => a);
                break;
                
            case 'onAnyDoorOpened':
            case 'onAnyDoorClosed':
                // For door events, no actors are directly involved
                // But we should check if the trigger targets doors
                const targetTypeMatches = this._checkTargetTypeMatch(actorTypes, 'doors', context);
                if (!targetTypeMatches) {
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | Scene trigger "${trigger.name}" target types [${actorTypes.join(', ')}] do not match event type "${eventType}", skipping`);
                    }
                    return false;
                }
                return true; // Door target matches, continue
                
            case 'onCombatStart':
            case 'onCombatEnd':
                // For combat events, check combatants
                if (context.combat?.combatants) {
                    relevantActors = context.combat.combatants.map(c => c.actor).filter(a => a);
                }
                break;
                
            default:
                // For other events, try to extract actors from context
                if (context.actor) {
                    relevantActors = [context.actor];
                } else if (context.token?.actor) {
                    relevantActors = [context.token.actor];
                }
                break;
        }
        
        // If no relevant actors found, skip
        if (relevantActors.length === 0) {
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Scene trigger "${trigger.name}" has target types but no relevant actors for event "${eventType}", skipping`);
            }
            return false;
        }
        
        // Check if any relevant actor matches the target types
        for (const actor of relevantActors) {
            const targetTypeMatches = this._checkTargetTypeMatch(actorTypes, actor.type, context);
            if (targetTypeMatches) {
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Scene trigger "${trigger.name}" target types [${actorTypes.join(', ')}] match actor type "${actor.type}" for event "${eventType}"`);
                }
                return true;
            }
        }
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Scene trigger "${trigger.name}" target types [${actorTypes.join(', ')}] do not match any relevant actors for event "${eventType}", skipping`);
        }
        return false;
    }

    /**
     * Find tokens near a specific tile
     * @param {Tile} tile - The tile to check around
     * @returns {Token[]} Array of nearby tokens
     * @private
     */
    _findTokensNearTile(tile) {
        const nearbyTokens = [];
        const proximity = 2; // Check within 2 grid spaces
        
        for (const token of canvas.scene.tokens) {
            const distance = Math.max(
                Math.abs(token.x - tile.x),
                Math.abs(token.y - tile.y)
            );
            
            if (distance <= proximity * canvas.scene.grid.size) {
                nearbyTokens.push(token);
            }
        }
        
        return nearbyTokens;
    }

    
/**
 * Find tokens near a specific tile
 * @param {Tile} tile - The tile to check around
 * @returns {Token[]} Array of nearby tokens
 * @private
 */

    _checkEffectTriggers(token, effect) {
        // Get all tiles that might have triggers using spatial indexing
        const tileRect = {
            x: token.x,
            y: token.y,
            width: token.width,
            height: token.height
        };

        let nearbyTiles = [];
        if (canvas.scene.tiles.quadtree) {
            nearbyTiles = canvas.scene.tiles.quadtree.getObjects(tileRect);
        } else {
            nearbyTiles = canvas.scene.tiles.filter(tile => {
                return (tile.x < tokenRect.x + tokenRect.width &&
                        tile.x + tile.width > tokenRect.x &&
                        tile.y < tokenRect.y + tokenRect.height &&
                        tile.y + tile.height > tokenRect.y);
            });
        }

        for (const tile of nearbyTiles) {
            if (this._rectIntersects(tileRect, tile)) {
                // Check if this tile has an onEffect trigger for this effect
                this._fireDocumentTriggers('tile', tile, token, 'onEffect', tile, effect);
            }
        }
    }

    async _executeActions(actor, actions, tokenDoc, sourceDoc) {
        if (this._debugMode) {
            console.log(`WoD TriggerManager | EXECUTING ${actions.length} actions for actor ${actor?.name || 'unknown'}`);
        }
        
        for (const action of actions) {
            if (!action) {
                if (this._debugMode) console.log('WoD TriggerManager | Skipping null action');
                continue;
            }
            
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Executing action: ${action.type}`, action);
            }
            
            const delay = parseFloat(action.delay) || 0;
            
            if (delay > 0) {
                // Schedule the action with delay
                if (this._debugMode) console.log(`WoD TriggerManager | Scheduling action with ${delay}s delay`);
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
        if (this._debugMode) {
            console.log(`WoD TriggerManager | EXECUTING SINGLE ACTION: ${action.type}`, action);
        }
        
        try {
            switch (action.type) {
                case 'door':
                    if (this._debugMode) console.log('WoD TriggerManager | Executing door action');
                    await this._actionDoor(action);
                    break;
                case 'enableCoreEffect':
                case 'disableCoreEffect':
                case 'toggleCoreEffect':
                    if (this._debugMode) console.log('WoD TriggerManager | Executing core effect action');
                    await this._actionCoreEffect(actor, action);
                    break;
                case 'changeTileAsset':
                    if (this._debugMode) console.log('WoD TriggerManager | Executing tile asset action');
                    await this._actionChangeTileAsset(action, tokenDoc, sourceDoc);
                    break;
                default:
                    console.warn(`WoD TriggerManager | Action type not implemented: ${action.type}`);
                    ui.notifications?.warn(`WoD TriggerManager | Action type not implemented: ${action.type}`);
            }
            
            if (this._debugMode) {
                console.log(`WoD TriggerManager | SUCCESS: Action ${action.type} completed`);
            }
        } catch (error) {
            console.error(`WoD TriggerManager | ERROR: Failed to execute action ${action.type}:`, error);
            ui.notifications?.error(`WoD TriggerManager | Failed to execute ${action.type} action`);
        }
    }

    async _actionDoor(action) {
        if (!game.user.isGM) return;

        const wallId = action.target;
        if (!wallId) return;

        const wall = canvas?.scene?.walls?.get(wallId);
        if (!wall) return;

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

        if (wall.ds === ds) return;

        await wall.update({ ds });
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
    
    /**
     * Execute trigger with timing controls (delay, repeat, duration)
     * @private
     */
    async _executeTimedTrigger(trigger, context, timing) {
        const { delay, repeat, duration } = timing;
        const startTime = Date.now();
        
        console.log(`WoD TriggerManager | Starting timed trigger: "${trigger.name}"`, { delay, repeat, duration });
        
        // Apply initial delay
        if (delay > 0) {
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Delaying execution by ${delay} seconds`);
            }
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
        
        // Execute initial trigger
        console.log(`WoD TriggerManager | Executing initial trigger: "${trigger.name}"`);
        await this._executeTriggerActions(trigger, context);
        
        // Handle repeat execution
        if (repeat > 0) {
            let executionCount = 1;
            const repeatInterval = setInterval(async () => {
                // Check duration limit
                if (duration && (Date.now() - startTime) >= duration * 1000) {
                    clearInterval(repeatInterval);
                    if (this._debugMode) {
                        console.log(`WoD TriggerManager | Stopping repeat due to duration limit`);
                    }
                    return;
                }
                
                executionCount++;
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Repeating execution #${executionCount}`);
                }
                
                await this._executeTriggerActions(trigger, context);
            }, repeat * 1000);
            
            // Store interval for cleanup if needed
            if (!this._activeIntervals) {
                this._activeIntervals = new Map();
            }
            this._activeIntervals.set(trigger.id, repeatInterval);
        }
    }
    
    /**
     * Execute continuous trigger (monitors state continuously)
     * @private
     */
    async _executeContinuousTrigger(trigger, context, timing) {
        const { delay, repeat, duration } = timing;
        const startTime = Date.now();
        
        // Apply initial delay
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
        
        // Start continuous monitoring
        const monitorInterval = setInterval(async () => {
            // Check duration limit
            if (duration && (Date.now() - startTime) >= duration * 1000) {
                clearInterval(monitorInterval);
                if (this._debugMode) {
                    console.log(`WoD TriggerManager | Stopping continuous monitoring due to duration limit`);
                }
                return;
            }
            
            // Re-evaluate conditions for continuous mode
            const shouldFire = this._shouldTriggerFire(trigger, context);
            if (shouldFire) {
                await this._executeTriggerActions(trigger, context);
            }
        }, (repeat || 1) * 1000);
        
        // Store interval for cleanup
        if (!this._activeIntervals) {
            this._activeIntervals = new Map();
        }
        this._activeIntervals.set(`continuous-${trigger.id}`, monitorInterval);
    }
    
    /**
     * Execute the actual trigger actions
     * @private
     */
    async _executeTriggerActions(trigger, context) {
        const actor = context.actor;
        const tokenDoc = context.token;
        const sourceDoc = context.document;
        
        const rollConfig = trigger.roll || trigger.rollConfig || {};
        const actionsConfig = trigger.actions || {};

        let passed = null;
        if (rollConfig.enabled) {
            passed = await this._executeRoll(actor, rollConfig);
        }

        // Always actions execute regardless of roll
        const alwaysActions = actionsConfig.always || [];
        if (alwaysActions.length > 0) {
            if (this._debugMode) {
                console.log(`WoD TriggerManager | ACTIONS: ${alwaysActions.length} always actions`);
            }
            await this._executeActions(actor, alwaysActions, tokenDoc, sourceDoc);
        }

        if (rollConfig.enabled) {
            if (passed) {
                const successActions = actionsConfig.success || [];
                if (successActions.length > 0) {
                    await this._executeActions(actor, successActions, tokenDoc, sourceDoc);
                }
            } else {
                const failureActions = actionsConfig.failure || [];
                if (failureActions.length > 0) {
                    await this._executeActions(actor, failureActions, tokenDoc, sourceDoc);
                }
            }
        }
    }
    
    /**
     * Clean up active intervals for a trigger
     * @param {string} triggerId - The trigger ID to clean up
     */
    _cleanupTriggerIntervals(triggerId) {
        if (!this._activeIntervals) return;
        
        // Clean up regular interval
        const interval = this._activeIntervals.get(triggerId);
        if (interval) {
            clearInterval(interval);
            this._activeIntervals.delete(triggerId);
        }
        
        // Clean up continuous interval
        const continuousInterval = this._activeIntervals.get(`continuous-${triggerId}`);
        if (continuousInterval) {
            clearInterval(continuousInterval);
            this._activeIntervals.delete(`continuous-${triggerId}`);
        }
    }
    
    /**
     * Start monitoring global triggers
     * @private
     */
    _startGlobalTriggerMonitoring() {
        if (!canvas?.scene) return;
        
        // Get all global triggers from the scene
        const globalTriggers = canvas.scene.getFlag('wodsystem', 'globalTriggers') || [];
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Starting global trigger monitoring: ${globalTriggers.length} global triggers found`);
        }
        
        // Check global triggers every 5 seconds
        this._globalTriggerInterval = setInterval(() => {
            this._checkGlobalTriggers();
        }, 5000);
        
        // Also check immediately
        this._checkGlobalTriggers();
    }
    
    /**
     * Check all global triggers
     * @private
     */
    async _checkGlobalTriggers() {
        if (!canvas?.scene) return;
        
        const globalTriggers = canvas.scene.getFlag('wodsystem', 'globalTriggers') || [];
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Checking ${globalTriggers.length} global triggers`);
        }
        
        // Get all tokens for condition evaluation context
        const allTokens = canvas.scene.tokens.contents || [];
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Global triggers will check against ${allTokens.length} tokens for condition evaluation`);
        }
        
        for (const trigger of globalTriggers) {
            if (!trigger || trigger.enabled === false) continue;
            
            if (this._debugMode) {
                console.log(`WoD TriggerManager | Processing global trigger "${trigger.name}" with ${trigger.trigger?.conditions?.length || 0} conditions`);
            }
            
            // Check global triggers for each token (for condition evaluation)
            for (const tokenDoc of allTokens) {
                const context = {
                    token: tokenDoc,
                    actor: tokenDoc.actor,
                    document: canvas.scene,
                    documentType: 'scene',
                    eventType: 'onGlobal',
                    effect: null,
                    sourceDoc: null,
                    entered: false,
                    exited: false
                };
                
                // Fire the global trigger with token context
                await this._fireDocumentTriggers('scene', canvas.scene, tokenDoc, 'onGlobal', null, null);
            }
        }
    }

    /**
     * Handle actor effect changes (global)
     * @param {Actor} actor - The actor document
     * @param {Array} effects - The effects array
     */
    async _onActorEffectsChanged(actor, effects) {
        if (!actor) return;
        
        console.log(`WoD TriggerManager | _onActorEffectsChanged called for actor: ${actor.name}`, effects);
        
        // Determine effect event type based on changes
        const currentEffects = actor.effects || [];
        const addedEffects = effects.filter(e => !currentEffects.includes(e));
        const removedEffects = currentEffects.filter(e => !effects.includes(e));
        
        console.log(`WoD TriggerManager | Added effects: [${addedEffects.join(', ')}], Removed effects: [${removedEffects.join(', ')}]`);
        
        // Fire effect applied events (global)
        for (const effectId of addedEffects) {
            console.log(`WoD TriggerManager | Firing onEffectApplied for effect: ${effectId}`);
            this._fireDocumentTriggers('actor', actor, actor, 'onEffectApplied', effectId, null);
            
            // Also fire scene triggers for effect events
            this._fireSceneTriggers('onEffectApplied', {
                actor: actor,
                effectId: effectId,
                effect: actor.effects.get(effectId)
            });
        }
        
        // Fire effect removed events (global)
        for (const effectId of removedEffects) {
            console.log(`WoD TriggerManager | Firing onEffectRemoved for effect: ${effectId}`);
            this._fireDocumentTriggers('actor', actor, actor, 'onEffectRemoved', effectId, null);
            
            // Also fire scene triggers for effect events
            this._fireSceneTriggers('onEffectRemoved', {
                actor: actor,
                effectId: effectId,
                effect: null
            });
        }
    }

    /**
     * Handle actor attribute changes (global)
     * @param {Actor} actor - The actor document
     * @param {Object} systemData - The system data changes
     */
    _onActorAttributesChanged(actor, systemData) {
        if (!actor) return;
        
        if (this._debugMode) {
            console.log(`WoD TriggerManager | Actor attributes changed for ${actor.name}:`, systemData);
        }
        
        // Check for health changes
        if (systemData.health !== undefined) {
            this._fireDocumentTriggers('actor', actor, actor, 'onHealthChanged', 'health', systemData.health);
        }
        
        // Fire general attribute change event
        this._fireDocumentTriggers('actor', actor, actor, 'onAttributeChanged', 'attributes', systemData);
    }

    /**
     * Emergency: Clear all active triggers and intervals
     * Call this if triggers are interfering with normal Foundry operations
     */
    emergencyClearAllTriggers() {
        console.warn('WoD TriggerManager | EMERGENCY: Clearing all active triggers');
        
        // Clear all intervals
        if (this._activeIntervals) {
            for (const [id, interval] of this._activeIntervals) {
                clearInterval(interval);
                console.log(`WoD TriggerManager | Cleared interval: ${id}`);
            }
            this._activeIntervals.clear();
        }
        
        // Clear any other active timers
        if (this._activeTimers) {
            for (const [id, timer] of this._activeTimers) {
                clearTimeout(timer);
                console.log(`WoD TriggerManager | Cleared timer: ${id}`);
            }
            this._activeTimers.clear();
        }
        
        console.log('WoD TriggerManager | Emergency clear completed');
    }

    }
