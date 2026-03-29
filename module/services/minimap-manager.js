/**
 * Minimap Manager
 * Handles minimap logic, coordinate mapping, token tracking, and marker management
 * Generates minimap from scene walls and displays tokens and markers
 */
export class MinimapManager {
    constructor() {
        this.contourCache = new Map(); // Cache for generated contours per scene
    }

    /**
     * Initialize the manager and set up hooks
     */
    static initialize() {
        const manager = new MinimapManager();
        game.wod = game.wod || {};
        game.wod.minimapManager = manager;
        

        // Hook into scene loading
        Hooks.on("canvasReady", async () => {
            if (canvas.scene) {
                await manager._initializeMinimapForScene(canvas.scene);
            }
        });

        // Hook into level changes (for Levels module support)
        Hooks.on("updateElevation", () => {
            if (canvas.scene) {
                manager._updateMinimapDisplay(canvas.scene);
            }
        });
        
        // Also listen for Levels module specific hooks if available
        if (game.modules.get("levels")?.active) {
            Hooks.on("levels.elevationChanged", () => {
                if (canvas.scene) {
                    manager._updateMinimapDisplay(canvas.scene);
                }
            });
        }

        // Socket listeners removed - using simpler approach

        // Hook into token updates
        // Use a small delay to ensure canvas has updated before updating minimap
        Hooks.on("updateToken", async (tokenDocument, updateData, options, userId) => {
            if (canvas.scene && tokenDocument.scene) {
                // Only update if position changed
                if (updateData.x !== undefined || updateData.y !== undefined) {
                    // Small delay to ensure canvas tokens have updated
                    setTimeout(async () => {
                        await manager._updateMinimapDisplay(canvas.scene);
                    }, 50);
                } else {
                    // For non-position updates, update immediately
                    await manager._updateMinimapDisplay(canvas.scene);
                }
            }
        });
        
        // Also listen for token refresh (when canvas updates)
        Hooks.on("refreshToken", async (token, options) => {
            if (canvas.scene && token.scene) {
                await manager._updateMinimapDisplay(canvas.scene);
            }
        });

        // Hook into wall changes
        Hooks.on("createWall", async (wall, options, userId) => {
            if (canvas.scene && wall.scene) {
                manager.contourCache.delete(wall.scene.id);
                // Recalculate walls by level if GM
                if (game.user.isGM) {
                    const config = manager.getSceneConfig(canvas.scene);
                    if (config && config.enabled && game.modules.get("levels")?.active) {
                        await manager._precalculateWallsByLevel(canvas.scene, config);
                    }
                }
                await manager._updateMinimapDisplay(canvas.scene);
            }
        });

        Hooks.on("updateWall", async (wall, updateData, options, userId) => {
            if (canvas.scene && wall.scene) {
                manager.contourCache.delete(wall.scene.id);
                // Recalculate walls by level if GM
                if (game.user.isGM) {
                    const config = manager.getSceneConfig(canvas.scene);
                    if (config && config.enabled && game.modules.get("levels")?.active) {
                        await manager._precalculateWallsByLevel(canvas.scene, config);
                    }
                }
                await manager._updateMinimapDisplay(canvas.scene);
            }
        });

        Hooks.on("deleteWall", async (wall, options, userId) => {
            if (canvas.scene && wall.scene) {
                manager.contourCache.delete(wall.scene.id);
                // Recalculate walls by level if GM
                if (game.user.isGM) {
                    const config = manager.getSceneConfig(canvas.scene);
                    if (config && config.enabled && game.modules.get("levels")?.active) {
                        await manager._precalculateWallsByLevel(canvas.scene, config);
                    }
                }
                await manager._updateMinimapDisplay(canvas.scene);
            }
        });

        // Refresh HUD when the minimap world setting changes
        Hooks.on("updateSetting", (setting) => {
            if (setting.key === 'wodsystem.minimapConfig') {
                manager.contourCache.clear();
                manager._updateMinimapDisplay(canvas.scene);
            }
        });

        // Hook into scene controls to add minimap toggle + config buttons (GM only)
        Hooks.on("getSceneControlButtons", (controls) => {
            if (!game.user.isGM) return;
            if (!Array.isArray(controls)) return;

            const navigationControl = controls.find(c => c.name === "navigation");
            if (!navigationControl) return;

            // Toggle visibility button — instantly shows/hides the minimap
            navigationControl.tools.push({
                name: "minimap-toggle",
                title: "Toggle Minimap",
                icon: "fas fa-map",
                button: true,
                onClick: async () => {
                    const config = foundry.utils.deepClone(
                        game.settings.get('wodsystem', 'minimapConfig')
                    );
                    config.enabled = !config.enabled;
                    await game.settings.set('wodsystem', 'minimapConfig', config);
                    ui.notifications.info(
                        config.enabled ? "Minimap shown" : "Minimap hidden"
                    );
                }
            });

            // Config button — opens the full settings dialog
            navigationControl.tools.push({
                name: "minimap-config",
                title: "Minimap Settings",
                icon: "fas fa-cog",
                button: true,
                onClick: () => manager._openConfigDialog()
            });
        });


        // Register user setting for minimap zoom (each player can set their own)
        // Register immediately in initialize() to ensure it's available before ready
        try {
            game.settings.register("wodsystem", "minimapZoom", {
                name: "Minimap Zoom",
                hint: "Zoom level for the minimap (0.5x to 2.0x)",
                scope: "client",
                config: false,
                default: 1.0,
                type: Number,
                range: {
                    min: 0.5,
                    max: 2.0,
                    step: 0.1
                }
            });
            
            // Register user setting for minimap panning offset
            game.settings.register("wodsystem", "minimapPan", {
                name: "Minimap Pan Offset",
                hint: "Pan offset for the minimap (stored as {x, y})",
                scope: "client",
                config: false,
                default: { x: 0, y: 0 },
                type: Object
            });
        } catch (e) {
            // Setting might already be registered, or game.settings not available yet
            // Will register in init hook as fallback
            Hooks.once("init", () => {
                try {
                    game.settings.register("wodsystem", "minimapZoom", {
                        name: "Minimap Zoom",
                        hint: "Zoom level for the minimap (0.5x to 2.0x)",
                        scope: "client",
                        config: false,
                        default: 1.0,
                        type: Number,
                        range: {
                            min: 0.5,
                            max: 2.0,
                            step: 0.1
                        }
                    });
                    
                    game.settings.register("wodsystem", "minimapPan", {
                        name: "Minimap Pan Offset",
                        hint: "Pan offset for the minimap (stored as {x, y})",
                        scope: "client",
                        config: false,
                        default: { x: 0, y: 0 },
                        type: Object
                    });
                } catch (e2) {
                }
            });
        }

        // Chat command handler (/minimap opens the config dialog)
        Hooks.on("chatMessage", (chatLog, message, chatData) => {
            if (!game.user.isGM) return;
            const content = message.content?.toLowerCase() || "";
            if (content.startsWith("/minimap") || content.startsWith("!minimap")) {
                manager._openConfigDialog();
                return false;
            }
        });

    }

    /**
     * Initialize minimap for a scene
     * @param {Scene} scene - The scene to initialize minimap for
     */
    async _initializeMinimapForScene(scene) {
        const config = this.getSceneConfig(scene);
        if (!config || !config.enabled) {
            return;
        }

        // If GM and Levels is active, pre-calculate walls for each level and persist
        if (game.user.isGM && game.modules.get("levels")?.active) {
            const mutableConfig = foundry.utils.deepClone(config);
            await this._precalculateWallsByLevel(scene, mutableConfig);
            await game.settings.set('wodsystem', 'minimapConfig', mutableConfig);
        }

        await this._updateMinimapDisplay(scene);
    }

    /**
     * Pre-calculate walls for each level and store in scene config
     * This allows players to access walls for their level without needing level data access
     * @param {Scene} scene - The scene
     * @param {Object} config - Minimap configuration
     */
    async _precalculateWallsByLevel(scene, config) {
        if (!scene || !scene.walls) {
            return;
        }
        
        const levelsModule = game.modules.get("levels");
        if (!levelsModule?.active) {
            return;
        }
        
        const allWalls = Array.from(scene.walls.values());
        const wallsByLevel = new Map();
        
        // Get all unique levels from walls
        const levels = new Set();
        let wallsWithLevelInfo = 0;
        let wallsWithoutLevelInfo = 0;
        
        allWalls.forEach((wall, index) => {
            const wallData = wall.document || wall;
            if (!wallData) {
                wallsWithoutLevelInfo++;
                return;
            }
            
            let wallBottom = null;
            let wallTop = null;
            
            // Extract level info - try multiple ways
            // Method 1: Check range property (most common in Levels v3+)
            if (wallData.range !== undefined) {
                if (Array.isArray(wallData.range)) {
                    wallBottom = wallData.range[0];
                    wallTop = wallData.range[1] ?? wallData.range[0];
                } else if (typeof wallData.range === 'object' && wallData.range !== null) {
                    wallBottom = wallData.range.bottom ?? wallData.range.min;
                    wallTop = wallData.range.top ?? wallData.range.max ?? wallBottom;
                }
            }
            
            // Method 2: Check level property
            if (wallBottom === null && wallTop === null) {
                const wallLevel = wallData.level ?? wallData.bottom ?? wallData.elevation;
                if (wallLevel !== null && wallLevel !== undefined) {
                    wallBottom = wallLevel;
                    wallTop = wallLevel;
                }
            }
            
            // Method 3: Check flags.wall-height (Levels module stores level info here)
            if (wallBottom === null && wallTop === null && wallData.flags) {
                const wallHeight = wallData.flags['wall-height'];
                if (wallHeight) {
                    // Wall Height module format: {bottom: X, top: Y}
                    if (typeof wallHeight === 'object' && wallHeight !== null) {
                        wallBottom = wallHeight.bottom ?? wallHeight.min;
                        wallTop = wallHeight.top ?? wallHeight.max ?? wallBottom;
                    }
                }
                
                // Also check for levels module flags
                const levelsFlags = wallData.flags.levels;
                if (wallBottom === null && wallTop === null && levelsFlags) {
                    if (Array.isArray(levelsFlags.range)) {
                        wallBottom = levelsFlags.range[0];
                        wallTop = levelsFlags.range[1] ?? levelsFlags.range[0];
                    } else if (typeof levelsFlags.range === 'object' && levelsFlags.range !== null) {
                        wallBottom = levelsFlags.range.bottom ?? levelsFlags.range.min;
                        wallTop = levelsFlags.range.top ?? levelsFlags.range.max ?? wallBottom;
                    } else if (levelsFlags.level !== undefined) {
                        wallBottom = levelsFlags.level;
                        wallTop = levelsFlags.level;
                    }
                }
            }
            
            // Method 4: Check data.range (might be nested)
            if (wallBottom === null && wallTop === null && wallData.data) {
                const dataRange = wallData.data.range;
                if (dataRange) {
                    if (Array.isArray(dataRange)) {
                        wallBottom = dataRange[0];
                        wallTop = dataRange[1] ?? dataRange[0];
                    } else if (typeof dataRange === 'object' && dataRange !== null) {
                        wallBottom = dataRange.bottom ?? dataRange.min;
                        wallTop = dataRange.top ?? dataRange.max ?? wallBottom;
                    }
                }
            }
            
            if (wallBottom !== null && wallTop !== null) {
                wallsWithLevelInfo++;
                // Add all levels in the range
                for (let level = wallBottom; level <= wallTop; level++) {
                    levels.add(level);
                }
            } else {
                wallsWithoutLevelInfo++;
            }
        });
        
        
        // Calculate walls for each level
        levels.forEach(level => {
            const wallsForLevel = allWalls.filter(wall => {
                const wallData = wall.document || wall;
                if (!wallData) return false;
                
                const { bottom: wallBottom, top: wallTop } = this._extractWallElevation(wallData);

                if (wallBottom !== null || wallTop !== null) {
                    const effBottom = wallBottom ?? -Infinity;
                    const effTop    = wallTop    ??  Infinity;
                    return level >= effBottom && level < effTop;
                }
                // No elevation info — wall is not restricted, show on all levels
                return true;
            });
            
            // Store only wall IDs to save space
            const wallIdsForLevel = wallsForLevel.map(w => w.id);
            wallsByLevel.set(level, wallIdsForLevel);
            
            
        });
        
        // Update config with walls by level
        config.wallsByLevel = Object.fromEntries(wallsByLevel);
        
        // wallsByLevel is now set directly on the config object.
        // The caller (_updateObject or _initializeMinimapForScene) is responsible for saving
        // the config to game.settings so it persists.
        
    }

    /**
     * Extract elevation range from a wall document, covering all known storage formats:
     * - Wall Height module v2 (flags['wall-height'].top / .bottom)
     * - Wall Height module v3+ (flags['wall-height'].wallHeightTop / .wallHeightBottom)
     * - Levels module flags (flags.levels.rangeBottom / rangeTop, range array/object, level)
     * - Legacy range property (wallData.range)
     * - Foundry v12/v13 direct top/bottom when used as a range
     * @param {Object} wallData - Wall document or object
     * @returns {{bottom: number|null, top: number|null}}
     */
    _extractWallElevation(wallData) {
        let bottom = null;
        let top = null;

        // Wall Height module flags — multiple key formats across versions
        const wh = wallData.flags?.['wall-height'];
        if (wh && typeof wh === 'object') {
            // v3+ keys
            bottom = wh.wallHeightBottom ?? wh.bottom ?? wh.min ?? null;
            top    = wh.wallHeightTop    ?? wh.top    ?? wh.max ?? bottom;
            if (bottom !== null || top !== null) return { bottom, top };
        }

        // Levels module flags
        const lf = wallData.flags?.levels;
        if (lf && typeof lf === 'object') {
            if (lf.rangeBottom !== undefined || lf.rangeTop !== undefined) {
                bottom = lf.rangeBottom ?? null;
                top    = lf.rangeTop    ?? bottom;
            } else if (Array.isArray(lf.range)) {
                bottom = lf.range[0];
                top    = lf.range[1] ?? lf.range[0];
            } else if (lf.range && typeof lf.range === 'object') {
                bottom = lf.range.bottom ?? lf.range.min ?? null;
                top    = lf.range.top    ?? lf.range.max ?? bottom;
            } else if (lf.level !== undefined) {
                bottom = lf.level;
                top    = lf.level;
            }
            if (bottom !== null || top !== null) return { bottom, top };
        }

        // Legacy wallData.range property
        if (wallData.range) {
            if (Array.isArray(wallData.range)) {
                bottom = wallData.range[0];
                top    = wallData.range[1] ?? wallData.range[0];
                return { bottom, top };
            } else if (typeof wallData.range === 'object') {
                bottom = wallData.range.bottom ?? wallData.range.min ?? null;
                top    = wallData.range.top    ?? wallData.range.max ?? bottom;
                return { bottom, top };
            }
        }

        // Direct top/bottom as a range (Foundry native or misc modules)
        if (wallData.top !== undefined && wallData.bottom !== undefined) {
            return { bottom: wallData.bottom, top: wallData.top };
        }

        return { bottom: null, top: null };
    }

    /**
     * Get minimap configuration for a scene
     * @param {Scene} scene - The scene
     * @returns {Object|null} Configuration object or null if not configured
     */
    getSceneConfig(scene) {
        try {
            return game.settings.get('wodsystem', 'minimapConfig') || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get the current active level from Levels module
     * @returns {number|null} Current level or null if Levels is not available
     */
    getCurrentLevel() {
        // Check if Levels module is available
        const levelsModule = game.modules.get("levels");
        if (!levelsModule?.active) {
            return null;
        }
        
        // Try different ways to get the current level
        // Levels module v3+ uses canvas.levels
        let detectedLevel = null;
        let detectionMethod = null;
        
        if (canvas?.levels) {
            // Try various properties that Levels might use
            if (canvas.levels.currentLevel !== undefined) {
                detectedLevel = canvas.levels.currentLevel;
                detectionMethod = "canvas.levels.currentLevel";
            } else if (canvas.levels.current !== undefined) {
                detectedLevel = canvas.levels.current;
                detectionMethod = "canvas.levels.current";
            } else if (canvas.levels.elevation !== undefined) {
                detectedLevel = canvas.levels.elevation;
                detectionMethod = "canvas.levels.elevation";
            } else if (typeof canvas.levels.getCurrentLevel === 'function') {
                // Try getCurrentLevel method if available
                try {
                    detectedLevel = canvas.levels.getCurrentLevel();
                    detectionMethod = "canvas.levels.getCurrentLevel()";
                } catch (e) {
                }
            }
        }
        
        // Try game.levels
        if (detectedLevel === null && game?.levels) {
            if (game.levels.currentLevel !== undefined) {
                detectedLevel = game.levels.currentLevel;
                detectionMethod = "game.levels.currentLevel";
            } else if (game.levels.current !== undefined) {
                detectedLevel = game.levels.current;
                detectionMethod = "game.levels.current";
            } else if (typeof game.levels.getCurrentLevel === 'function') {
                // Try getCurrentLevel method if available
                try {
                    detectedLevel = game.levels.getCurrentLevel();
                    detectionMethod = "game.levels.getCurrentLevel()";
                } catch (e) {
                }
            }
        }
        
        // Try canvas elevation (some versions use this)
        if (detectedLevel === null && canvas?.elevation !== undefined) {
            detectedLevel = canvas.elevation;
            detectionMethod = "canvas.elevation";
        }
        
        if (detectedLevel !== null) {
            return detectedLevel;
        }
        
        // Try to get from the first controlled token's elevation
        const controlledTokens = canvas.tokens?.controlled || [];
        if (controlledTokens.length > 0) {
            const token = controlledTokens[0];
            const elevation = token.document?.elevation ?? token.elevation;
            if (elevation !== undefined && elevation !== null) {
                return elevation;
            }
        }
        
        // Try to get from all visible tokens' elevation (use most common)
        if (canvas.tokens?.placeables) {
            const elevations = canvas.tokens.placeables
                .map(t => t.document?.elevation ?? t.elevation)
                .filter(e => e !== undefined && e !== null);
            if (elevations.length > 0) {
                // Return the most common elevation
                const elevationCounts = {};
                elevations.forEach(e => {
                    elevationCounts[e] = (elevationCounts[e] || 0) + 1;
                });
                const mostCommon = Object.entries(elevationCounts)
                    .sort((a, b) => b[1] - a[1])[0];
                if (mostCommon) {
                    return parseFloat(mostCommon[0]);
                }
            }
        }
        
        // Default to level 0 if Levels is active but we can't find the current level
        return 0;
    }

    /**
     * Read scene walls, filtering by level and secret walls according to config
     * @param {Scene} scene - The scene
     * @param {Object} config - Minimap configuration
     * @returns {Array} Array of wall documents for the current level
     */
    readSceneWalls(scene, config) {
        if (!scene) return [];
        
        const showSecretWalls = config?.showSecretWalls === true;
        const isGM = game.user.isGM;
        const currentLevel = this.getCurrentLevel();
        const levelsModule = game.modules.get("levels");
        const levelsActive = levelsModule?.active;


        // All users get all walls from scene — elevation filtering applied uniformly below
        const walls = Array.from(scene.walls.values());

        // Filter walls by level and secret status
        const filteredWalls = walls.filter(wall => {
            const wallData = wall.document || wall;
            if (!wallData) return false;

            // Filter by elevation if Levels module is active
            if (levelsActive && currentLevel !== null) {
                const { bottom: wallBottom, top: wallTop } = this._extractWallElevation(wallData);

                if (wallBottom !== null || wallTop !== null) {
                    // Half-open interval [bottom, top): elevation 10 belongs to [10,20) not [9,10)
                    // Missing boundary treated as ±Infinity
                    const effBottom = wallBottom ?? -Infinity;
                    const effTop    = wallTop    ??  Infinity;
                    if (currentLevel < effBottom || currentLevel >= effTop) {
                        return false;
                    }
                }
                // Both null: no elevation restriction — show at all levels
            }
            // For players: walls from canvas.walls.placeables are already filtered by level
            
            // Filter secret walls
            // Check if wall is secret - Foundry VTT v13 uses wall.document.move for movement type
            // Secret walls typically have move === CONST.WALL_MOVEMENT_TYPES.SECRET
            const isSecret = wallData.move === CONST.WALL_MOVEMENT_TYPES?.SECRET || 
                           wallData.ds === CONST.WALL_SENSE_TYPES?.SECRET ||
                           (wallData.ds !== undefined && wallData.ds === 2); // Alternative check
            
            // GM always sees all walls, players only see secret walls if configured
            if (isSecret && !isGM && !showSecretWalls) {
                return false;
            }
            return true;
        });
        
        // --- DIAGNOSTIC ---
        const elevRanges = walls.map(w => {
            const d = w.document || w;
            return this._extractWallElevation(d);
        });
        const withElev = elevRanges.filter(r => r.bottom !== null).length;
        const noElev   = elevRanges.filter(r => r.bottom === null).length;
        console.log(`[WOD Minimap] currentLevel=${currentLevel} levelsActive=${levelsActive} isGM=${isGM}`);
        console.log(`[WOD Minimap] total walls=${walls.length}  with elevation=${withElev}  no elevation=${noElev}  passed filter=${filteredWalls.length}`);
        if (walls.length > 0) {
            const unique = [...new Set(elevRanges.map(r => `[${r.bottom},${r.top}]`))];
            console.log('[WOD Minimap] distinct elevation ranges:', unique.join('  '));
        }
        // --- END DIAGNOSTIC ---

        return filteredWalls;
    }

    /**
     * Generate wall segments from walls (returns actual wall lines, not a contour)
     * @param {Array} walls - Array of wall documents
     * @returns {Array} Array of wall segments [{x0, y0, x1, y1}, ...]
     */
    generateWallSegments(walls) {
        if (!walls || walls.length === 0) return [];

        const segments = [];
        walls.forEach(wall => {
            // Handle both wall documents and wall objects
            const wallData = wall.document || wall;
            if (!wallData) {
                return;
            }
            
            // Try different possible coordinate properties
            const coords = wallData.c || wallData.coords || wallData.coordinates || [];
            if (coords.length >= 4) {
                // Wall coordinates: [x0, y0, x1, y1]
                segments.push({
                    x0: coords[0],
                    y0: coords[1],
                    x1: coords[2],
                    y1: coords[3]
                });
            }
        });


        return segments;
    }

    /**
     * Generate map contour from walls (legacy method - now uses wall segments)
     * @param {Array} walls - Array of wall documents
     * @returns {Array} Array of wall segments for direct drawing
     */
    generateMapContour(walls) {
        // Return wall segments instead of a contour polygon
        // This allows drawing the actual walls
        return this.generateWallSegments(walls);
    }

    /**
     * Calculate bounding box from points
     * @param {Array} points - Array of {x, y} objects
     * @returns {Object} Bounding box {minX, minY, maxX, maxY}
     */
    calculateBoundingBox(points) {
        if (!points || points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        return { minX, minY, maxX, maxY };
    }

    /**
     * Calculate bounding box points (rectangle)
     * @param {Array} points - Array of {x, y} objects
     * @returns {Array} Array of 4 corner points
     */
    _calculateBoundingBoxPoints(points) {
        const bbox = this.calculateBoundingBox(points);
        return [
            { x: bbox.minX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.maxY },
            { x: bbox.minX, y: bbox.maxY }
        ];
    }

    /**
     * Convex Hull using Graham scan algorithm
     * @param {Array} points - Array of {x, y} objects
     * @returns {Array} Array of points forming the convex hull
     */
    _convexHull(points) {
        if (points.length < 3) return points;

        // Create a copy to avoid mutating the original array
        const sortedPoints = [...points];

        // Find the bottom-most point (or leftmost in case of tie)
        let bottom = 0;
        for (let i = 1; i < sortedPoints.length; i++) {
            if (sortedPoints[i].y < sortedPoints[bottom].y || 
                (sortedPoints[i].y === sortedPoints[bottom].y && sortedPoints[i].x < sortedPoints[bottom].x)) {
                bottom = i;
            }
        }

        // Swap bottom point to first position
        [sortedPoints[0], sortedPoints[bottom]] = [sortedPoints[bottom], sortedPoints[0]];

        // Sort points by polar angle with respect to bottom point
        const pivot = sortedPoints[0];
        sortedPoints.slice(1).sort((a, b) => {
            const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
            const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
            if (Math.abs(angleA - angleB) > 0.0001) return angleA - angleB;
            // If same angle, keep the one closer to pivot
            const distA = Math.pow(a.x - pivot.x, 2) + Math.pow(a.y - pivot.y, 2);
            const distB = Math.pow(b.x - pivot.x, 2) + Math.pow(b.y - pivot.y, 2);
            return distA - distB;
        });

        // Build convex hull
        const hull = [sortedPoints[0]];
        if (sortedPoints.length > 1) {
            hull.push(sortedPoints[1]);
        }
        
        for (let i = 2; i < sortedPoints.length; i++) {
            while (hull.length > 1 && this._crossProduct(
                hull[hull.length - 2],
                hull[hull.length - 1],
                sortedPoints[i]
            ) <= 0) {
                hull.pop();
            }
            hull.push(sortedPoints[i]);
        }

        // Ensure the hull is closed (first point = last point)
        if (hull.length > 0 && (hull[0].x !== hull[hull.length - 1].x || hull[0].y !== hull[hull.length - 1].y)) {
            hull.push({ x: hull[0].x, y: hull[0].y });
        }

        return hull;
    }

    /**
     * Calculate cross product for three points
     * @param {Object} o - Origin point
     * @param {Object} a - Point a
     * @param {Object} b - Point b
     * @returns {number} Cross product value
     */
    _crossProduct(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    /**
     * Calculate coordinate mapping (auto-detect based on bounding box)
     * @param {Scene} scene - The scene
     * @param {Object} config - Minimap configuration
     * @param {Object} boundingBox - Bounding box {minX, minY, maxX, maxY}
     * @returns {Object} Mapping configuration
     */
    calculateCoordinateMapping(scene, config, boundingBox) {
        if (!config || !boundingBox) return null;

        if (config.coordinateMapping?.autoDetect !== false) {
            // Auto-detect: use bounding box
            const sceneWidth = boundingBox.maxX - boundingBox.minX;
            const sceneHeight = boundingBox.maxY - boundingBox.minY;
            const minimapWidth = config.width || 200;
            const minimapHeight = config.height || 200;

            return {
                autoDetect: true,
                boundingBox: boundingBox,
                scaleX: sceneWidth > 0 ? minimapWidth / sceneWidth : 1,
                scaleY: sceneHeight > 0 ? minimapHeight / sceneHeight : 1,
                offsetX: boundingBox.minX,
                offsetY: boundingBox.minY
            };
        } else {
            // Manual mapping
            const mapping = config.coordinateMapping;
            return {
                autoDetect: false,
                boundingBox: mapping.boundingBox || boundingBox,
                sceneTopLeft: mapping.sceneTopLeft || { x: boundingBox.minX, y: boundingBox.minY },
                sceneBottomRight: mapping.sceneBottomRight || { x: boundingBox.maxX, y: boundingBox.maxY },
                minimapTopLeft: mapping.minimapTopLeft || { x: 0, y: 0 },
                minimapBottomRight: mapping.minimapBottomRight || { x: config.width || 200, y: config.height || 200 }
            };
        }
    }

    /**
     * Map scene coordinates to minimap coordinates
     * @param {number} sceneX - X coordinate in scene
     * @param {number} sceneY - Y coordinate in scene
     * @param {Object} config - Minimap configuration
     * @param {Object} boundingBox - Bounding box
     * @returns {Object} {x, y} coordinates in minimap
     */
    mapSceneToMinimap(sceneX, sceneY, config, boundingBox) {
        if (!config || !boundingBox) return { x: 0, y: 0 };

        const mapping = this.calculateCoordinateMapping(config.scene || canvas.scene, config, boundingBox);
        if (!mapping) return { x: 0, y: 0 };

        if (mapping.autoDetect) {
            const minimapX = (sceneX - mapping.offsetX) * mapping.scaleX;
            const minimapY = (sceneY - mapping.offsetY) * mapping.scaleY;
            return { x: minimapX, y: minimapY };
        } else {
            // Manual mapping using affine transformation
            const sceneWidth = mapping.sceneBottomRight.x - mapping.sceneTopLeft.x;
            const sceneHeight = mapping.sceneBottomRight.y - mapping.sceneTopLeft.y;
            const minimapWidth = mapping.minimapBottomRight.x - mapping.minimapTopLeft.x;
            const minimapHeight = mapping.minimapBottomRight.y - mapping.minimapTopLeft.y;

            if (sceneWidth === 0 || sceneHeight === 0) return { x: 0, y: 0 };

            const scaleX = minimapWidth / sceneWidth;
            const scaleY = minimapHeight / sceneHeight;

            const relativeX = sceneX - mapping.sceneTopLeft.x;
            const relativeY = sceneY - mapping.sceneTopLeft.y;

            const minimapX = mapping.minimapTopLeft.x + relativeX * scaleX;
            const minimapY = mapping.minimapTopLeft.y + relativeY * scaleY;

            return { x: minimapX, y: minimapY };
        }
    }

    /**
     * Map minimap coordinates to scene coordinates
     * @param {number} minimapX - X coordinate in minimap
     * @param {number} minimapY - Y coordinate in minimap
     * @param {Object} config - Minimap configuration
     * @param {Object} boundingBox - Bounding box
     * @returns {Object} {x, y} coordinates in scene
     */
    mapMinimapToScene(minimapX, minimapY, config, boundingBox) {
        if (!config || !boundingBox) return { x: 0, y: 0 };

        const mapping = this.calculateCoordinateMapping(config.scene || canvas.scene, config, boundingBox);
        if (!mapping) return { x: 0, y: 0 };

        if (mapping.autoDetect) {
            const sceneX = minimapX / mapping.scaleX + mapping.offsetX;
            const sceneY = minimapY / mapping.scaleY + mapping.offsetY;
            return { x: sceneX, y: sceneY };
        } else {
            // Manual mapping - inverse transformation
            const sceneWidth = mapping.sceneBottomRight.x - mapping.sceneTopLeft.x;
            const sceneHeight = mapping.sceneBottomRight.y - mapping.sceneTopLeft.y;
            const minimapWidth = mapping.minimapBottomRight.x - mapping.minimapTopLeft.x;
            const minimapHeight = mapping.minimapBottomRight.y - mapping.minimapTopLeft.y;

            if (minimapWidth === 0 || minimapHeight === 0) return { x: 0, y: 0 };

            const scaleX = sceneWidth / minimapWidth;
            const scaleY = sceneHeight / minimapHeight;

            const relativeX = minimapX - mapping.minimapTopLeft.x;
            const relativeY = minimapY - mapping.minimapTopLeft.y;

            const sceneX = mapping.sceneTopLeft.x + relativeX * scaleX;
            const sceneY = mapping.sceneTopLeft.y + relativeY * scaleY;

            return { x: sceneX, y: sceneY };
        }
    }

    /**
     * Check if a token belongs to a player character (PC) and not an NPC
     * @param {TokenDocument} token - The token document
     * @returns {boolean} True if token is a PC
     */
    _isPlayerCharacter(token) {
        const actor = token.actor;
        if (!actor) return false;
        
        // Check actor type - PCs in WoD system are "Mortal" or "Technocrat"
        const actorType = actor.type;
        const isPCType = actorType === "Mortal" || 
                        actorType === "Technocrat" ||
                        actorType === "character";
        
        // Check if actor has any player owner (not just GM)
        // NPCs typically only have GM ownership or no ownership
        let hasPlayerOwner = false;
        if (actor.hasPlayerOwner !== undefined) {
            hasPlayerOwner = actor.hasPlayerOwner;
        } else if (actor.ownership) {
            // Check if any non-GM user has ownership level >= 1
            hasPlayerOwner = Object.entries(actor.ownership).some(([userId, perm]) => {
                const user = game.users.get(userId);
                return user && !user.isGM && perm >= 1;
            });
        }
        
        // Token is a PC if it's a PC type OR has a player owner
        return isPCType || hasPlayerOwner;
    }

    /**
     * Get visible tokens according to configuration
     * @param {Scene} scene - The scene
     * @param {Object} config - Minimap configuration
     * @returns {Array} Array of token documents
     */
    getVisibleTokens(scene, config) {
        if (!scene || !config) return [];

        const tokenDisplay = config.tokenDisplay || "all-visible";
        const isGM = game.user.isGM;
        
        // Get all tokens from the scene
        // Use canvas.tokens.placeables if available (rendered tokens), otherwise use scene.tokens
        let tokens = [];
        if (canvas.tokens?.placeables) {
            // canvas.tokens.placeables already filters by visibility for the current user
            tokens = canvas.tokens.placeables.map(t => t.document || t);
        } else if (scene.tokens) {
            tokens = Array.from(scene.tokens.values());
        }
        
        // Filter out hidden tokens
        tokens = tokens.filter(token => {
            const tokenDoc = token.document || token;
            return !tokenDoc.hidden;
        });
        
        // IMPORTANT: Only show player character tokens (PCs), not NPCs or enemies
        tokens = tokens.filter(token => {
            return this._isPlayerCharacter(token);
        });


        switch (tokenDisplay) {
            case "player-only":
                // Only tokens owned by current player
                return tokens.filter(token => {
                    const actor = token.actor;
                    if (!actor) return false;
                    const isOwner = actor.isOwner;
                    return isOwner;
                });

            case "all-controlled":
                // All tokens controlled by current user (including those they can control)
                return tokens.filter(token => {
                    if (isGM) return true;
                    const actor = token.actor;
                    if (!actor) return false;
                    // Check if user owns or can control the actor
                    const isOwner = actor.isOwner;
                    const canControl = actor.testUserPermission(game.user, "CONTROLLER");
                    return isOwner || canControl;
                });

            case "all-visible":
                // All player character tokens visible on the canvas
                // Note: NPCs are already filtered out above
                // For "all-visible", show ALL player character tokens, not just ones the user can observe
                return tokens.filter(token => {
                    if (isGM) return true; // GM sees all PCs
                    
                    // For players: show all PC tokens (they're already filtered to be PCs only)
                    // This allows players to see where other players are on the minimap
                    return true; // Show all PC tokens
                });

            case "all":
            default:
                // All player character tokens (GM only)
                // Note: NPCs are already filtered out above
                if (isGM) {
                    return tokens;
                }
                // For non-GM, show all visible PC tokens (same as all-visible)
                return tokens.filter(token => {
                    const actor = token.actor;
                    if (!actor) return false;
                    
                    const canObserve = actor.testUserPermission(game.user, "OBSERVER");
                    const isOwner = actor.isOwner;
                    
                    return canObserve || isOwner;
                });
        }
    }

    /**
     * Get markers for a scene
     * @param {Scene} scene - The scene
     * @param {Object} config - Minimap configuration
     * @returns {Array} Array of marker objects
     */
    getMarkers(scene, config) {
        if (!scene || !config || !config.markers) return [];
        return config.markers || [];
    }

    /**
     * Add a new marker (GM only)
     * @param {Scene} scene - The scene
     * @param {Object} markerData - Marker data {name, description, category, color, sceneX, sceneY}
     * @returns {Promise<Object>} Created marker with ID
     */
    async addMarker(scene, markerData) {
        if (!game.user.isGM) {
            throw new Error("Only GM can add markers");
        }

        const config = foundry.utils.deepClone(this.getSceneConfig() || this._getDefaultConfig());
        if (!config.markers) config.markers = [];

        const marker = {
            id: foundry.utils.randomID(),
            name: markerData.name || "",
            description: markerData.description || "",
            category: markerData.category || "",
            color: markerData.color || "#ff0000",
            sceneX: markerData.sceneX || 0,
            sceneY: markerData.sceneY || 0,
            createdAt: Date.now(),
            createdBy: game.user.id
        };

        config.markers.push(marker);
        await game.settings.set('wodsystem', 'minimapConfig', config);
        return marker;
    }

    /**
     * Update an existing marker (GM only)
     * @param {Scene} scene - The scene
     * @param {string} markerId - Marker ID
     * @param {Object} markerData - Updated marker data
     * @returns {Promise<Object>} Updated marker
     */
    async updateMarker(scene, markerId, markerData) {
        if (!game.user.isGM) {
            throw new Error("Only GM can update markers");
        }

        const config = foundry.utils.deepClone(this.getSceneConfig() || this._getDefaultConfig());
        if (!config.markers) throw new Error("Marker not found");

        const markerIndex = config.markers.findIndex(m => m.id === markerId);
        if (markerIndex === -1) throw new Error("Marker not found");

        Object.assign(config.markers[markerIndex], markerData);
        await game.settings.set('wodsystem', 'minimapConfig', config);
        return config.markers[markerIndex];
    }

    /**
     * Delete a marker (GM only)
     * @param {Scene} scene - The scene
     * @param {string} markerId - Marker ID
     * @returns {Promise<void>}
     */
    async deleteMarker(scene, markerId) {
        if (!game.user.isGM) {
            throw new Error("Only GM can delete markers");
        }

        const config = foundry.utils.deepClone(this.getSceneConfig() || this._getDefaultConfig());
        if (!config.markers) return;

        config.markers = config.markers.filter(m => m.id !== markerId);
        await game.settings.set('wodsystem', 'minimapConfig', config);
    }

    /**
     * Update minimap display
     * @param {Scene} scene - The scene
     */
    async _updateMinimapDisplay(scene) {
        if (!scene) return;

        // Trigger HUD update if it exists
        if (game.wod?.minimapHUD) {
            await game.wod.minimapHUD.render();
        }
    }


    /**
     * Open configuration dialog
     * @param {Scene} scene - The scene
     */
    _openConfigDialog() {
        if (!game.wod?.MinimapConfigDialog) {
            return;
        }
        new game.wod.MinimapConfigDialog().render(true);
    }

    /**
     * Get default configuration
     * @returns {Object} Default config object
     */
    _getDefaultConfig() {
        return {
            enabled: true,
            width: 200,
            height: 200,
            position: { vertical: "top", horizontal: "right" },
            zoom: 1.0,
            tokenDisplay: "all-visible",
            showSecretWalls: false,
            coordinateMapping: {
                autoDetect: true,
                boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }
            },
            style: {
                fillColor: "#333333",
                strokeColor: "#ffffff",
                strokeWidth: 2
            },
            markers: []
        };
    }
}
