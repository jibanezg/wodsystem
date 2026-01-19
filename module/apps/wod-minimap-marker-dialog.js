import { i18n as i18nHelper } from "../helpers/i18n.js";

/**
 * Minimap Marker Dialog
 * Allows GM to create/edit markers for the minimap
 */
export class WodMinimapMarkerDialog extends FormApplication {
    constructor(scene, marker = null, options = {}) {
        if (!options.title) {
            if (game?.i18n) {
                const localized = game.i18n.localize(marker ? 
                    "WODSYSTEM.Minimap.Markers.EditTitle" : 
                    "WODSYSTEM.Minimap.Markers.AddTitle");
                options.title = (localized && localized !== (marker ? 
                    "WODSYSTEM.Minimap.Markers.EditTitle" : 
                    "WODSYSTEM.Minimap.Markers.AddTitle")) 
                    ? localized 
                    : (marker ? "Edit Marker" : "Add Marker");
            } else {
                options.title = marker ? "Edit Marker" : "Add Marker";
            }
        }
        
        super({}, options);
        this.scene = scene;
        this.marker = marker;
    }

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "wod-minimap-marker",
            classes: ["wod", "dialog", "minimap-marker-dialog"],
            template: "systems/wodsystem/templates/apps/minimap-marker-dialog.html",
            width: 500,
            height: 500,
            resizable: true,
            title: "Minimap Marker"
        });
    }

    /** @override */
    async getData() {
        // Get base data from FormApplication
        const data = await super.getData();
        
        const marker = this.marker || {
            name: "",
            description: "",
            category: "",
            color: "#ff0000",
            sceneX: 0,
            sceneY: 0
        };


        // Merge our data with base data
        return foundry.utils.mergeObject(data, {
            scene: this.scene,
            marker: marker,
            isEdit: !!this.marker,
            categoryOptions: (() => {
                const localize = (key, fallback) => {
                    if (!game.i18n) return fallback;
                    const translated = game.i18n.localize(key);
                    // If translation equals the key, it wasn't found - use fallback
                    return translated !== key ? translated : fallback;
                };
                
                return [
                    { value: "Shop", label: localize("WODSYSTEM.Minimap.Markers.CategoryShop", "Shop") },
                    { value: "NPC", label: localize("WODSYSTEM.Minimap.Markers.CategoryNPC", "NPC") },
                    { value: "Danger", label: localize("WODSYSTEM.Minimap.Markers.CategoryDanger", "Danger") },
                    { value: "Point of Interest", label: localize("WODSYSTEM.Minimap.Markers.CategoryPOI", "Point of Interest") },
                    { value: "Other", label: localize("WODSYSTEM.Minimap.Markers.CategoryOther", "Other") }
                ];
            })()
        });
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Color picker
        html.find('input[name="color"]').on("change", (event) => {
            const color = $(event.currentTarget).val();
            html.find(".color-preview").css("background-color", color);
        });

        // Initialize color preview
        const color = html.find('input[name="color"]').val();
        html.find(".color-preview").css("background-color", color);

        // Select coordinates from canvas button
        html.find(".select-coordinates").on("click", (event) => {
            event.preventDefault();
            this._selectCoordinatesFromCanvas();
        });
    }

    /** @override */
    async _updateObject(event, formData) {
        if (!game.user.isGM) {
            ui.notifications.error("Only GM can create/edit markers");
            return;
        }

        const markerData = {
            name: formData["name"] || "",
            description: formData["description"] || "",
            category: formData["category"] || "",
            color: formData["color"] || "#ff0000",
            sceneX: parseFloat(formData["sceneX"]) || 0,
            sceneY: parseFloat(formData["sceneY"]) || 0
        };

        const manager = game.wod?.minimapManager;
        if (!manager) {
            ui.notifications.error("Minimap Manager not available");
            return;
        }

        try {
            if (this.marker) {
                // Update existing marker
                await manager.updateMarker(this.scene, this.marker.id, markerData);
                ui.notifications.info(game.i18n.localize("WODSYSTEM.Minimap.Markers.Updated") || "Marker updated");
            } else {
                // Create new marker
                await manager.addMarker(this.scene, markerData);
                ui.notifications.info(game.i18n.localize("WODSYSTEM.Minimap.Markers.Created") || "Marker created");
            }

            // Close dialog
            this.close();

            // Refresh config dialog if open
            if (game.wod?.minimapConfigDialog) {
                game.wod.minimapConfigDialog.render();
            }
        } catch (error) {
            console.error("WoD Minimap: Error saving marker", error);
            ui.notifications.error(error.message || "Error saving marker");
        }
    }

    /**
     * Select coordinates from canvas
     */
    _selectCoordinatesFromCanvas() {
        if (!canvas.ready) {
            ui.notifications.warn("Canvas not ready");
            return;
        }

        // Store reference to dialog
        const dialog = this;
        const html = this.element;

        // Create instruction message
        const message = game.i18n.localize("WODSYSTEM.Minimap.Markers.SelectCoordinatesHint") || 
                       "Click on the canvas to select coordinates";
        ui.notifications.info(message);

        // Set up click handler on canvas
        const clickHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();

            // Get canvas coordinates
            const canvasCoords = canvas.app.stage.worldTransform.applyInverse(event.data.global);
            const sceneCoords = canvas.grid.getCenter(canvasCoords.x, canvasCoords.y);

            // Update form fields
            html.find('input[name="sceneX"]').val(Math.round(sceneCoords.x));
            html.find('input[name="sceneY"]').val(Math.round(sceneCoords.y));

            // Remove click handler
            canvas.app.stage.off("pointerdown", clickHandler);
            canvas.app.stage.cursor = "default";

            ui.notifications.info(game.i18n.localize("WODSYSTEM.Minimap.Markers.CoordinatesSelected") || 
                                 "Coordinates selected");
        };

        // Change cursor and add click handler
        canvas.app.stage.cursor = "crosshair";
        canvas.app.stage.once("pointerdown", clickHandler);

        // Cancel button in dialog
        const cancelButton = $(`
            <button type="button" class="cancel-coordinate-selection" style="margin-top: 10px;">
                ${game.i18n.localize("WODSYSTEM.Minimap.Markers.CancelSelection") || "Cancel"}
            </button>
        `);

        cancelButton.on("click", () => {
            canvas.app.stage.off("pointerdown", clickHandler);
            canvas.app.stage.cursor = "default";
            cancelButton.remove();
        });

        html.find(".select-coordinates").after(cancelButton);
    }
}
