import { i18n as i18nHelper } from "../helpers/i18n.js";

/**
 * Minimap Configuration Dialog
 * Allows GM to configure minimap settings for a scene
 */
export class WodMinimapConfigDialog extends FormApplication {
    constructor(scene, options = {}) {
        if (!options.title) {
            if (game?.i18n) {
                const localized = game.i18n.localize("WODSYSTEM.Minimap.Config.Title");
                options.title = (localized !== "WODSYSTEM.Minimap.Config.Title") 
                    ? localized 
                    : "Minimap Configuration";
            } else {
                options.title = "Minimap Configuration";
            }
        }
        
        super({}, options);
        this.scene = scene;
        this.activeTab = "general";
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "wod-minimap-config",
            classes: ["wod", "dialog", "minimap-config-dialog"],
            template: "systems/wodsystem/templates/apps/minimap-config-dialog.html",
            width: 700,
            height: 750,
            resizable: true,
            title: "Minimap Configuration"
        });
    }

    /** @override */
    async getData() {
        // Get base data from FormApplication
        const data = await super.getData();
        
        const config = this.scene.flags?.wodsystem?.minimap || this._getDefaultConfig();
        const manager = game.wod?.minimapManager;
        
        // Get walls and generate contour preview
        let contourPoints = [];
        let boundingBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        
        if (manager && this.scene.walls) {
            const walls = manager.readSceneWalls(this.scene, config);
            if (walls.length > 0) {
                contourPoints = manager.generateMapContour(walls);
                const allPoints = [];
                walls.forEach(wall => {
                    // Handle both wall documents and wall objects
                    const wallData = wall.document || wall;
                    if (!wallData) {
                        return;
                    }
                    
                    // Try different possible coordinate properties
                    const coords = wallData.c || wallData.coords || wallData.coordinates || [];
                    if (coords.length >= 4) {
                        allPoints.push({ x: coords[0], y: coords[1] });
                        allPoints.push({ x: coords[2], y: coords[3] });
                    }
                });
                boundingBox = manager.calculateBoundingBox(allPoints);
            }
        }

        // Store for preview drawing
        this.contourPoints = contourPoints;
        this.boundingBox = boundingBox;


        // Merge our data with base data
        return foundry.utils.mergeObject(data, {
            scene: this.scene,
            config: config,
            contourPoints: contourPoints,
            boundingBox: boundingBox,
            activeTab: this.activeTab,
            markers: config.markers || [],
            positionOptions: {
                vertical: ["top", "bottom"],
                horizontal: ["left", "center", "right"]
            },
            tokenDisplayOptions: (() => {
                const localize = (key, fallback) => {
                    if (!game.i18n) return fallback;
                    const translated = game.i18n.localize(key);
                    // If translation equals the key, it wasn't found - use fallback
                    return translated !== key ? translated : fallback;
                };
                
                return [
                    { 
                        value: "player-only", 
                        label: localize("WODSYSTEM.Minimap.TokenDisplay.PlayerOnly", "Player Only")
                    },
                    { 
                        value: "all-visible", 
                        label: localize("WODSYSTEM.Minimap.TokenDisplay.AllVisible", "All Visible")
                    },
                    { 
                        value: "all-controlled", 
                        label: localize("WODSYSTEM.Minimap.TokenDisplay.AllControlled", "All Controlled")
                    },
                    { 
                        value: "all", 
                        label: localize("WODSYSTEM.Minimap.TokenDisplay.All", "All")
                    }
                ];
            })()
        });
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Tab switching
        html.find(".tab").on("click", (event) => {
            event.preventDefault();
            const tab = $(event.currentTarget).data("tab");
            this.activeTab = tab;
            
            // Update active tab
            html.find(".tab").removeClass("active");
            $(event.currentTarget).addClass("active");
            
            // Show/hide tab content
            html.find(".tab-content").hide();
            html.find(`.tab-content[data-tab="${tab}"]`).show();
        });
        
        // Initialize tab visibility
        html.find(".tab-content").hide();
        html.find(`.tab-content[data-tab="${this.activeTab}"]`).show();

        // Add marker button
        html.find(".add-marker").on("click", (event) => {
            event.preventDefault();
            this._openMarkerDialog();
        });

        // Edit marker buttons
        html.find(".edit-marker").on("click", (event) => {
            event.preventDefault();
            const markerId = $(event.currentTarget).data("marker-id");
            this._openMarkerDialog(markerId);
        });

        // Delete marker buttons
        html.find(".delete-marker").on("click", (event) => {
            event.preventDefault();
            const markerId = $(event.currentTarget).data("marker-id");
            this._deleteMarker(markerId);
        });

        // Coordinate mapping mode toggle
        html.find('input[name="coordinateMapping.autoDetect"]').on("change", (event) => {
            const autoDetect = $(event.currentTarget).is(":checked");
            if (autoDetect) {
                html.find(".manual-mapping").hide();
            } else {
                html.find(".manual-mapping").show();
            }
        });

        // Initialize manual mapping visibility
        const autoDetect = html.find('input[name="coordinateMapping.autoDetect"]').is(":checked");
        if (autoDetect) {
            html.find(".manual-mapping").hide();
        }
    }

    /** @override */
    async _updateObject(event, formData) {
        const config = this.scene.flags?.wodsystem?.minimap || this._getDefaultConfig();
        
        // Update enabled
        if (formData["enabled"] !== undefined) {
            config.enabled = formData["enabled"] === true || formData["enabled"] === "on";
        }

        // Update size
        if (formData["width"] !== undefined) {
            config.width = parseFloat(formData["width"]) || 200;
        }
        if (formData["height"] !== undefined) {
            config.height = parseFloat(formData["height"]) || 200;
        }

        // Update position
        if (formData["position.vertical"] !== undefined) {
            config.position = config.position || {};
            config.position.vertical = formData["position.vertical"];
        }
        if (formData["position.horizontal"] !== undefined) {
            config.position = config.position || {};
            config.position.horizontal = formData["position.horizontal"];
        }

        // Zoom is now controlled by each player individually via user settings
        // No longer stored in scene config

        // Update token display
        if (formData["tokenDisplay"] !== undefined) {
            config.tokenDisplay = formData["tokenDisplay"];
        }

        // Update show secret walls
        if (formData["showSecretWalls"] !== undefined) {
            config.showSecretWalls = formData["showSecretWalls"] === true || formData["showSecretWalls"] === "on";
        }

        // Update coordinate mapping
        if (formData["coordinateMapping.autoDetect"] !== undefined) {
            config.coordinateMapping = config.coordinateMapping || {};
            config.coordinateMapping.autoDetect = formData["coordinateMapping.autoDetect"] === true || 
                                                   formData["coordinateMapping.autoDetect"] === "on";
        }

        // Manual mapping coordinates
        if (!config.coordinateMapping.autoDetect) {
            if (formData["coordinateMapping.sceneTopLeft.x"] !== undefined) {
                config.coordinateMapping.sceneTopLeft = config.coordinateMapping.sceneTopLeft || {};
                config.coordinateMapping.sceneTopLeft.x = parseFloat(formData["coordinateMapping.sceneTopLeft.x"]) || 0;
            }
            if (formData["coordinateMapping.sceneTopLeft.y"] !== undefined) {
                config.coordinateMapping.sceneTopLeft = config.coordinateMapping.sceneTopLeft || {};
                config.coordinateMapping.sceneTopLeft.y = parseFloat(formData["coordinateMapping.sceneTopLeft.y"]) || 0;
            }
            if (formData["coordinateMapping.sceneBottomRight.x"] !== undefined) {
                config.coordinateMapping.sceneBottomRight = config.coordinateMapping.sceneBottomRight || {};
                config.coordinateMapping.sceneBottomRight.x = parseFloat(formData["coordinateMapping.sceneBottomRight.x"]) || 0;
            }
            if (formData["coordinateMapping.sceneBottomRight.y"] !== undefined) {
                config.coordinateMapping.sceneBottomRight = config.coordinateMapping.sceneBottomRight || {};
                config.coordinateMapping.sceneBottomRight.y = parseFloat(formData["coordinateMapping.sceneBottomRight.y"]) || 0;
            }
            if (formData["coordinateMapping.minimapTopLeft.x"] !== undefined) {
                config.coordinateMapping.minimapTopLeft = config.coordinateMapping.minimapTopLeft || {};
                config.coordinateMapping.minimapTopLeft.x = parseFloat(formData["coordinateMapping.minimapTopLeft.x"]) || 0;
            }
            if (formData["coordinateMapping.minimapTopLeft.y"] !== undefined) {
                config.coordinateMapping.minimapTopLeft = config.coordinateMapping.minimapTopLeft || {};
                config.coordinateMapping.minimapTopLeft.y = parseFloat(formData["coordinateMapping.minimapTopLeft.y"]) || 0;
            }
            if (formData["coordinateMapping.minimapBottomRight.x"] !== undefined) {
                config.coordinateMapping.minimapBottomRight = config.coordinateMapping.minimapBottomRight || {};
                config.coordinateMapping.minimapBottomRight.x = parseFloat(formData["coordinateMapping.minimapBottomRight.x"]) || config.width || 200;
            }
            if (formData["coordinateMapping.minimapBottomRight.y"] !== undefined) {
                config.coordinateMapping.minimapBottomRight = config.coordinateMapping.minimapBottomRight || {};
                config.coordinateMapping.minimapBottomRight.y = parseFloat(formData["coordinateMapping.minimapBottomRight.y"]) || config.height || 200;
            }
        }

        // Update style
        if (formData["style.fillColor"] !== undefined) {
            config.style = config.style || {};
            config.style.fillColor = formData["style.fillColor"] || "#333333";
        }
        if (formData["style.strokeColor"] !== undefined) {
            config.style = config.style || {};
            config.style.strokeColor = formData["style.strokeColor"] || "#ffffff";
        }
        if (formData["style.strokeWidth"] !== undefined) {
            config.style = config.style || {};
            config.style.strokeWidth = parseFloat(formData["style.strokeWidth"]) || 2;
        }

        // Preserve markers
        if (!config.markers) {
            config.markers = [];
        }

        // Pre-calculate walls by level if Levels module is active (GM only)
        if (game.user.isGM && game.modules.get("levels")?.active) {
            const manager = game.wod?.minimapManager;
            if (manager) {
                await manager._precalculateWallsByLevel(this.scene, config);
            } else {
            }
        }

        // Save configuration (including wallsByLevel)
        await this.scene.setFlag("wodsystem", "minimap", config);

        // Update minimap display
        if (game.wod?.minimapManager) {
            await game.wod.minimapManager._updateMinimapDisplay(this.scene);
        }
    }

    /**
     * Open marker dialog
     * @param {string} markerId - Optional marker ID to edit
     */
    async _openMarkerDialog(markerId = null) {
        if (!game.wod?.MinimapMarkerDialog) {
            console.error("WoD Minimap: MinimapMarkerDialog not loaded");
            return;
        }

        const marker = markerId ? 
            (this.scene.flags?.wodsystem?.minimap?.markers || []).find(m => m.id === markerId) : 
            null;

        const dialog = new game.wod.MinimapMarkerDialog(this.scene, marker);
        dialog.render(true);
    }

    /**
     * Delete a marker
     * @param {string} markerId - Marker ID to delete
     */
    async _deleteMarker(markerId) {
        if (!game.user.isGM) return;

        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("WODSYSTEM.Minimap.Markers.DeleteConfirmTitle") || "Delete Marker",
            content: game.i18n.localize("WODSYSTEM.Minimap.Markers.DeleteConfirm") || "Are you sure you want to delete this marker?",
            yes: () => true,
            no: () => false
        });

        if (confirmed) {
            const manager = game.wod?.minimapManager;
            if (manager) {
                await manager.deleteMarker(this.scene, markerId);
                this.render();
            }
        }
    }

    /**
     * Draw contour preview on canvas
     * @param {jQuery} html - Dialog HTML
     */
    _drawContourPreview(html) {
        const canvas = html.find(".contour-canvas")[0];
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        const contourPoints = this.contourPoints || [];
        if (contourPoints.length < 3) return;

        const boundingBox = this.boundingBox || { minX: 0, minY: 0, maxX: width, maxY: height };
        const config = this.scene.flags?.wodsystem?.minimap || this._getDefaultConfig();
        const manager = game.wod?.minimapManager;
        if (!manager) return;

        // Calculate scale
        const sceneWidth = boundingBox.maxX - boundingBox.minX;
        const sceneHeight = boundingBox.maxY - boundingBox.minY;
        const scaleX = sceneWidth > 0 ? width / sceneWidth : 1;
        const scaleY = sceneHeight > 0 ? height / sceneHeight : 1;

        // Draw contour
        ctx.fillStyle = config.style?.fillColor || "#333333";
        ctx.strokeStyle = config.style?.strokeColor || "#ffffff";
        ctx.lineWidth = config.style?.strokeWidth || 2;

        ctx.beginPath();
        contourPoints.forEach((point, index) => {
            const x = (point.x - boundingBox.minX) * scaleX;
            const y = (point.y - boundingBox.minY) * scaleY;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    /**
     * Get default configuration
     * @returns {Object} Default config
     */
    _getDefaultConfig() {
        return {
            enabled: false,
            width: 200,
            height: 200,
            position: { vertical: "top", horizontal: "right" },
            // zoom is now controlled by each player individually via user settings
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
