/**
 * Minimap HUD Component
 * Renders the minimap in the HUD with contour, tokens, and markers
 */
export class MinimapHUD {
    constructor() {
        this.element = null;
        this.canvas = null;
        this.ctx = null;
        this.updateThrottle = null;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panOffsetX = 0;
        this.panOffsetY = 0;
    }

    /**
     * Initialize the HUD
     */
    static initialize() {
        const hud = new MinimapHUD();
        game.wod = game.wod || {};
        game.wod.minimapHUD = hud;

        // Hook into canvas ready to create HUD element
        Hooks.on("canvasReady", () => {
            hud._createHUDElement();
            hud.render();
        });

        // If canvas is already ready, create HUD element immediately
        if (canvas?.ready && canvas?.scene) {
            hud._createHUDElement();
            hud.render();
        }

        // Hook into scene changes
        Hooks.on("updateScene", () => {
            hud.render();
        });

        // Hook into token movement and elevation changes
        Hooks.on("updateToken", (tokenDocument, updateData, options, userId) => {
            if (updateData.x !== undefined || updateData.y !== undefined || updateData.elevation !== undefined) {
                setTimeout(() => { hud.render(); }, 50);
            }
        });

        // Levels module: re-render when the viewed elevation changes
        Hooks.on("levelsChangeLevel", () => { hud.render(); });
        Hooks.on("levelChanged",      () => { hud.render(); });

        // Also listen for token refresh (when canvas updates)
        Hooks.on("refreshToken", (token, options) => {
            hud.render();
        });

    }

    /**
     * Create the HUD element
     */
    _createHUDElement() {
        // Remove existing element if any
        if (this.element) {
            // Clean up event listeners
            $(document).off("mousemove.minimapPan mouseup.minimapPan");
            this.element.remove();
        }

        // Get user's zoom preference (with fallback if setting not registered)
        let userZoom = 1.0;
        try {
            userZoom = game.settings.get("wodsystem", "minimapZoom") || 1.0;
        } catch (e) {
            userZoom = 1.0;
        }

        // Create container with zoom controls
        // Outer container maintains fixed size, inner content gets zoomed
        this.element = $(`
            <div id="wod-minimap-hud" class="wod-minimap-container">
                <div class="wod-minimap-content">
                    <canvas class="wod-minimap-canvas"></canvas>
                    <div class="wod-minimap-tokens"></div>
                    <div class="wod-minimap-markers"></div>
                </div>
            </div>
        `);

        // Append to HUD
        $("#ui-bottom").append(this.element);

        // Get canvas
        this.canvas = this.element.find(".wod-minimap-canvas")[0];
        if (this.canvas) {
            this.ctx = this.canvas.getContext("2d");
        }
        
        // Get content container (for zoom)
        this.contentContainer = this.element.find(".wod-minimap-content");

        // Set up zoom controls (mouse wheel only, no buttons)
        this._setupZoomControls();
        
        // Set up panning
        this._setupPanning();
        
        // Load pan offset from settings
        this._loadPanOffset();
    }

    /**
     * Set up zoom controls (mouse wheel only)
     */
    _setupZoomControls() {
        // Support mouse wheel for zoom (but not when panning)
        this.element.on("wheel", (event) => {
            // Prevent event from propagating to Foundry VTT (which would zoom the scene)
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            // Only zoom if middle button is not pressed
            if (event.originalEvent.buttons !== 4) {
                const delta = event.originalEvent.deltaY > 0 ? -0.1 : 0.1;
                this._adjustZoom(delta);
            }
        });
    }
    
    /**
     * Set up panning - click and drag to move map content within minimap window
     */
    _setupPanning() {
        // Mouse down - start panning on any mouse button (left, middle, or right)
        this.element.on("mousedown", (event) => {
            // Allow left button (0), middle button (1), or right button (2) for panning
            // Prevent event from propagating to Foundry VTT
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            this.isPanning = true;
            this.panStartX = event.clientX;
            this.panStartY = event.clientY;
            
            // Get current pan offset
            try {
                const currentPan = game.settings.get("wodsystem", "minimapPan") || { x: 0, y: 0 };
                this.panOffsetX = currentPan.x || 0;
                this.panOffsetY = currentPan.y || 0;
            } catch (e) {
                this.panOffsetX = 0;
                this.panOffsetY = 0;
            }
            
            // Change cursor to indicate panning
            this.element.css("cursor", "grabbing");
            
            // Prevent context menu
            return false;
        });
        
        // Mouse move - update panning
        $(document).on("mousemove.minimapPan", (event) => {
            if (this.isPanning) {
                event.preventDefault();
                
                const deltaX = event.clientX - this.panStartX;
                const deltaY = event.clientY - this.panStartY;
                
                const newOffsetX = this.panOffsetX + deltaX;
                const newOffsetY = this.panOffsetY + deltaY;
                
                // Apply panning transform
                this._applyPanOffset(newOffsetX, newOffsetY);
            }
        });
        
        // Mouse up - stop panning (any button)
        $(document).on("mouseup.minimapPan", (event) => {
            if (this.isPanning) {
                event.preventDefault();
                
                // Calculate final offset
                const deltaX = event.clientX - this.panStartX;
                const deltaY = event.clientY - this.panStartY;
                
                const finalOffsetX = this.panOffsetX + deltaX;
                const finalOffsetY = this.panOffsetY + deltaY;
                
                // Save pan offset
                this._savePanOffset(finalOffsetX, finalOffsetY);

                this.isPanning = false;
                this.element.css("cursor", "grab");

                // Re-render with proper ctx transforms (bakes pan into canvas draw)
                this.render();
            }
        });
        
        // Prevent default button behaviors and prevent propagation
        this.element.on("mousedown", (event) => {
            // Prevent all mouse buttons from triggering default behaviors
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return false;
        });
        
        
        // Change cursor when hovering over minimap
        this.element.on("mouseenter", () => {
            if (!this.isPanning) {
                this.element.css("cursor", "grab");
            }
        });
        
        this.element.on("mouseleave", () => {
            if (!this.isPanning) {
                this.element.css("cursor", "");
            }
        });
    }
    
    /**
     * Load pan offset from settings
     */
    _loadPanOffset() {
        try {
            const pan = game.settings.get("wodsystem", "minimapPan") || { x: 0, y: 0 };
            this.panOffsetX = pan.x || 0;
            this.panOffsetY = pan.y || 0;
            this._applyPanOffset(this.panOffsetX, this.panOffsetY);
        } catch (e) {
            this.panOffsetX = 0;
            this.panOffsetY = 0;
        }
    }
    
    /**
     * Apply pan offset to the minimap element
     * @param {number} offsetX - X offset in pixels
     * @param {number} offsetY - Y offset in pixels
     */
    _applyPanOffset(offsetX, offsetY) {
        if (!this.contentContainer) return;
        // During drag: CSS translate for smooth real-time response (no canvas redraw)
        // The full re-render with ctx transforms fires on mouse up via render()
        this.contentContainer.css({
            "transform": `translate(${offsetX}px, ${offsetY}px)`,
            "transform-origin": "top left"
        });
    }
    
    /**
     * Save pan offset to settings
     * @param {number} offsetX - X offset in pixels
     * @param {number} offsetY - Y offset in pixels
     */
    _savePanOffset(offsetX, offsetY) {
        try {
            game.settings.set("wodsystem", "minimapPan", { x: offsetX, y: offsetY });
            this.panOffsetX = offsetX;
            this.panOffsetY = offsetY;
        } catch (e) {
            // Setting might not be registered yet
        }
    }

    /**
     * Adjust zoom level
     * @param {number} delta - Change in zoom (positive = zoom in, negative = zoom out)
     */
    _adjustZoom(delta) {
        // Get current zoom, with fallback if setting not registered yet
        let currentZoom = 1.0;
        try {
            currentZoom = game.settings.get("wodsystem", "minimapZoom") || 1.0;
        } catch (e) {
            currentZoom = 1.0;
        }
        
        const newZoom = Math.max(0.5, Math.min(2.0, currentZoom + delta));
        
        // Save user preference (with try-catch in case setting not registered)
        try {
            game.settings.set("wodsystem", "minimapZoom", newZoom);
        } catch (e) {
        }
        
        // Re-render minimap with new zoom
        this.render();
    }

    /**
     * Render the minimap
     */
    async render() {
        if (!canvas.scene || !this.element) {
            return;
        }

        const manager = game.wod?.minimapManager;
        if (!manager) {
            return;
        }

        const config = manager.getSceneConfig(canvas.scene);
        if (!config || !config.enabled) {
            this.element.hide();
            return;
        }

        this.element.show();

        // Throttle updates for performance
        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
        }

        this.updateThrottle = setTimeout(() => {
            this._renderMinimap(config);
        }, 100);
    }

    /**
     * Render the minimap content
     * @param {Object} config - Minimap configuration
     */
    _renderMinimap(config) {
        if (!this.canvas || !this.ctx) return;

        const manager = game.wod?.minimapManager;
        if (!manager) return;

        const width = config.width || 200;
        const height = config.height || 200;

        let zoom = 1.0;
        try {
            zoom = game.settings.get("wodsystem", "minimapZoom") || 1.0;
        } catch (e) {}

        let panX = 0, panY = 0;
        try {
            const pan = game.settings.get("wodsystem", "minimapPan") || { x: 0, y: 0 };
            panX = pan.x || 0;
            panY = pan.y || 0;
        } catch (e) {}

        // Container: fixed display size
        this.element.css({ width: `${width}px`, height: `${height}px` });

        // Canvas: full resolution with DPR support — eliminates pixelation at any zoom
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        $(this.canvas).css({ width: `${width}px`, height: `${height}px` });

        this.currentZoom = zoom;
        this.panOffsetX = panX;
        this.panOffsetY = panY;

        // Content container: no CSS scale (zoom is baked into ctx transforms below)
        if (this.contentContainer) {
            this.contentContainer.css({
                "transform": "",
                "transform-origin": "",
                "width": `${width}px`,
                "height": `${height}px`,
                "position": "relative"
            });
        }

        // Position the minimap container
        this._positionMinimap(config.position);

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply ctx transforms: DPR scaling + zoom centered around canvas center + pan
        // Equivalent CSS would be: translate(panX, panY) scale(zoom) with transform-origin 50% 50%
        this.ctx.save();
        this.ctx.scale(dpr, dpr);
        this.ctx.translate(width / 2 + panX, height / 2 + panY);
        this.ctx.scale(zoom, zoom);
        this.ctx.translate(-width / 2, -height / 2);

        // Get walls
        const walls = manager.readSceneWalls(canvas.scene, config);
        if (walls.length === 0) {
            this.ctx.restore();
            this.ctx.save();
            this.ctx.scale(dpr, dpr);
            this.ctx.fillStyle = "#666666";
            this.ctx.font = "12px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText("No walls found", width / 2, height / 2);
            this.ctx.restore();
            return;
        }

        const wallSegments = manager.generateWallSegments(walls);
        if (wallSegments.length === 0) {
            this.ctx.restore();
            this.ctx.save();
            this.ctx.scale(dpr, dpr);
            this.ctx.fillStyle = "#666666";
            this.ctx.font = "12px Arial";
            this.ctx.textAlign = "center";
            this.ctx.fillText("No walls found", width / 2, height / 2);
            this.ctx.restore();
            return;
        }

        // Bounding box from wall points
        const allPoints = [];
        wallSegments.forEach(segment => {
            allPoints.push({ x: segment.x0, y: segment.y0 });
            allPoints.push({ x: segment.x1, y: segment.y1 });
        });
        const boundingBox = manager.calculateBoundingBox(allPoints);

        // Draw walls — mapSceneToMinimap maps to [0, config.width] space;
        // ctx transforms handle zoom and pan
        this._drawContour(wallSegments, config.style, boundingBox, width, height);

        this.ctx.restore();

        // Apply matching zoom/pan CSS to overlay containers (tokens/markers)
        // This mirrors the ctx transform: scale(zoom) centered + translate(pan)
        const overlayTransform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        this.element.find(".wod-minimap-tokens, .wod-minimap-markers").css({
            "transform": overlayTransform,
            "transform-origin": "50% 50%"
        });

        // Draw tokens and markers in unzoomed [0, config.width] space
        this._drawTokens(config, boundingBox, width, height, zoom);
        this._drawMarkers(config, boundingBox, width, height, zoom);
    }

    /**
     * Draw the map walls directly (not as a contour polygon)
     * @param {Array} wallSegments - Array of wall segments [{x0, y0, x1, y1}, ...]
     * @param {Object} style - Style configuration
     * @param {Object} boundingBox - Bounding box
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    _drawContour(wallSegments, style, boundingBox, width, height) {
        if (!wallSegments || wallSegments.length === 0) return;

        const manager = game.wod?.minimapManager;
        const config = manager.getSceneConfig(canvas.scene);
        if (!config) return;

        this.ctx.strokeStyle = style.strokeColor || "#ffffff";
        this.ctx.lineWidth = style.strokeWidth || 2;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        // Draw each wall segment as a line
        wallSegments.forEach(segment => {
            const start = manager.mapSceneToMinimap(segment.x0, segment.y0, config, boundingBox);
            const end = manager.mapSceneToMinimap(segment.x1, segment.y1, config, boundingBox);
            
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();
        });

        // Optionally fill the area (if fillColor is set)
        if (style.fillColor && style.fillColor !== "transparent") {
            // For filled area, we'd need to create a polygon from the wall perimeter
            // For now, skip filling to avoid complexity
            // TODO: Implement polygon filling if needed
        }
    }

    /**
     * Draw tokens on the minimap
     * @param {Object} config - Minimap configuration
     * @param {Object} boundingBox - Bounding box
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    _drawTokens(config, boundingBox, width, height, zoom = 1.0) {
        const manager = game.wod?.minimapManager;
        if (!manager) return;

        const tokens = manager.getVisibleTokens(canvas.scene, config);
        const tokensContainer = this.element.find(".wod-minimap-tokens");
        tokensContainer.empty();

        const isGM = game.user.isGM;
        const currentUserId = game.user.id;
        const controlledTokenIds = new Set((canvas.tokens?.controlled || []).map(t => t.id));
        

        tokens.forEach(token => {
            // Get token document - prefer canvas token's position if available (more up-to-date)
            const tokenDoc = token.document || token;
            
            // If token is from canvas.tokens.placeables, use token.x/y directly (more up-to-date)
            // Otherwise use tokenDoc.x/y
            let x, y;
            if (token.x !== undefined && token.y !== undefined && token.constructor?.name === 'Token') {
                // Canvas token - use its position directly (most up-to-date)
                x = token.x;
                y = token.y;
            } else {
                // Token document - use document position
                x = tokenDoc.x || 0;
                y = tokenDoc.y || 0;
            }

            const mapped = manager.mapSceneToMinimap(x, y, config, boundingBox);

            // Determine if this token belongs to the current user
            const actor = tokenDoc.actor;
            let isMyToken = false;
            
            if (isGM) {
                // GM sees all tokens as blue
                isMyToken = true;
            } else {
                // For players: check if this is their token
                // STRICT: Only mark as "my token" if explicitly owned by current user
                
                isMyToken = false; // Default to false - be strict!
                
                if (actor && actor.ownership && typeof actor.ownership === 'object') {
                    // 1. Check if token is currently controlled (most reliable indicator)
                    if (controlledTokenIds.has(tokenDoc.id)) {
                        isMyToken = true;
                    }
                    // 2. Check ownership by user ID explicitly (ONLY reliable check)
                    // Ownership level: 0 = none, 1 = owner, 2 = trusted player, 3 = assistant GM
                    const myOwnership = actor.ownership[currentUserId];
                    if (myOwnership !== undefined && myOwnership !== null && Number(myOwnership) >= 1) {
                        isMyToken = true;
                    }
                }
                // If no actor or no ownership data, it's definitely not my token
                
            }
            
            // Determine color based on NPC disposition or ownership
            let tokenColor, borderColor, shadowColor, tokenClass;
            
            // Check if actor is NPC
            const isNPC = actor?.system?.miscellaneous?.isNPC === true;
            const disposition = actor?.system?.miscellaneous?.disposition || "neutral";
            
            if (isNPC) {
                // NPC tokens: color by disposition
                switch (disposition) {
                    case "aggressive":
                        tokenColor = "#ff0000"; // Red
                        shadowColor = "rgba(255, 0, 0, 0.8)";
                        break;
                    case "ally":
                        tokenColor = "#00ff00"; // Green
                        shadowColor = "rgba(0, 255, 0, 0.8)";
                        break;
                    case "neutral":
                    default:
                        tokenColor = "#ffff00"; // Yellow
                        shadowColor = "rgba(255, 255, 0, 0.8)";
                        break;
                }
                borderColor = "#ffffff";
                tokenClass = "wod-minimap-token npc";
            } else {
                // Player tokens: use existing logic
                // - If GM: all tokens are blue
                // - If player: my token is blue, others are green
                tokenColor = isMyToken ? "#0080ff" : "#00ff00";
                borderColor = "#ffffff";
                shadowColor = isMyToken ? "rgba(0, 128, 255, 0.8)" : "rgba(0, 255, 0, 0.8)";
                tokenClass = isMyToken ? "wod-minimap-token active" : "wod-minimap-token";
            }

            // Create token indicator
            const tokenIndicator = $(`
                <div class="${tokenClass}" 
                     data-token-id="${tokenDoc.id}"
                     style="left: ${mapped.x}px; top: ${mapped.y}px;">
                    <div class="token-dot" style="background: ${tokenColor}; border-color: ${borderColor}; box-shadow: 0 0 3px ${shadowColor};"></div>
                </div>
            `);

            // Add tooltip with token name
            if (actor) {
                tokenIndicator.attr("title", actor.name || "Token");
            }

            tokensContainer.append(tokenIndicator);
        });
    }

    /**
     * Draw markers on the minimap
     * @param {Object} config - Minimap configuration
     * @param {Object} boundingBox - Bounding box
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    _drawMarkers(config, boundingBox, width, height, zoom = 1.0) {
        const manager = game.wod?.minimapManager;
        if (!manager) return;

        const markers = manager.getMarkers(canvas.scene, config);
        const markersContainer = this.element.find(".wod-minimap-markers");
        markersContainer.empty();

        markers.forEach(marker => {
            const mapped = manager.mapSceneToMinimap(marker.sceneX, marker.sceneY, config, boundingBox);

            // Create marker indicator
            const markerIndicator = $(`
                <div class="wod-minimap-marker" 
                     data-marker-id="${marker.id}"
                     style="left: ${mapped.x}px; top: ${mapped.y}px; color: ${marker.color};">
                    <i class="fas fa-map-marker-alt"></i>
                </div>
            `);

            // Add tooltip
            let tooltip = marker.name || "Marker";
            if (marker.category) {
                tooltip += ` (${marker.category})`;
            }
            if (marker.description) {
                tooltip += `\n${marker.description}`;
            }
            markerIndicator.attr("title", tooltip);

            markersContainer.append(markerIndicator);
        });
    }

    /**
     * Position the minimap according to configuration
     * @param {Object} position - Position configuration {vertical, horizontal}
     */
    _positionMinimap(position) {
        if (!position) {
            position = { vertical: "top", horizontal: "right" };
        }

        const vertical = position.vertical || "top";
        const horizontal = position.horizontal || "right";

        // Remove existing position classes
        this.element.removeClass("minimap-top minimap-bottom minimap-left minimap-center minimap-right");

        // Add position classes
        this.element.addClass(`minimap-${vertical}`);
        this.element.addClass(`minimap-${horizontal}`);
        
        // Container positioning only (no zoom/pan here - that's handled by contentContainer)
        // CSS classes handle the positioning via top/bottom/left/right
        this.element.css({
            "transform": "",
            "transform-origin": ""
        });
    }
}
