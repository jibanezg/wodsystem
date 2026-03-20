/**
 * CanvasEffectIndicators - Visual indicators for non-actor documents with applied effects
 * Draws PIXI overlays on walls/doors, tiles, and regions that have WoD effects applied
 */

export class CanvasEffectIndicators {
    constructor() {
        this._containers = new Map(); // docId -> PIXI.Container
        this._enabled = true;
    }

    /**
     * Initialize hooks for canvas rendering
     */
    initialize() {
        // Refresh indicators when canvas is ready
        Hooks.on('canvasReady', () => this.refreshAll());

        // Refresh when scene documents update (effect flags change)
        for (const hookName of ['updateWall', 'updateTile', 'updateRegion', 'updateScene']) {
            Hooks.on(hookName, (doc, changes) => {
                if (changes?.flags?.wodsystem && 'appliedEffects' in changes.flags.wodsystem) {
                    this._refreshIndicator(doc);
                }
            });
        }

        // Clean up on canvas teardown
        Hooks.on('canvasTearDown', () => this.removeAll());
    }

    /**
     * Toggle indicator visibility
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this._enabled = enabled;
        if (enabled) {
            this.refreshAll();
        } else {
            this.removeAll();
        }
    }

    /**
     * Refresh all indicators for the current scene
     */
    refreshAll() {
        this.removeAll();
        if (!this._enabled || !canvas?.scene) return;

        const collections = [
            canvas.scene.walls,
            canvas.scene.tiles,
            canvas.scene.regions
        ].filter(Boolean);

        for (const collection of collections) {
            for (const doc of collection) {
                this._refreshIndicator(doc);
            }
        }

        // Scene-level effects shown as notification badge (no canvas overlay)
    }

    /**
     * Remove all indicator containers from the canvas
     */
    removeAll() {
        for (const [id, container] of this._containers) {
            container.destroy({ children: true });
        }
        this._containers.clear();
    }

    /**
     * Refresh the indicator for a single document
     * @param {Document} doc
     * @private
     */
    _refreshIndicator(doc) {
        const docId = doc.id;

        // Remove existing indicator
        if (this._containers.has(docId)) {
            this._containers.get(docId).destroy({ children: true });
            this._containers.delete(docId);
        }

        if (!this._enabled) return;

        const appliedEffects = doc.getFlag?.('wodsystem', 'appliedEffects') || [];
        if (appliedEffects.length === 0) return;

        const docName = doc.documentName || doc.constructor?.documentName;

        switch (docName) {
            case 'Wall':
                this._drawWallIndicator(doc, appliedEffects);
                break;
            case 'Tile':
                this._drawTileIndicator(doc, appliedEffects);
                break;
            case 'Region':
                this._drawRegionIndicator(doc, appliedEffects);
                break;
        }
    }

    /**
     * Draw an effect indicator on a wall/door
     * @param {WallDocument} wall
     * @param {Array} effects
     * @private
     */
    _drawWallIndicator(wall, effects) {
        const layer = canvas.controls;
        if (!layer) return;

        const container = new PIXI.Container();
        container.name = `wod-effect-${wall.id}`;
        // Allow clicks to pass through while keeping the badge visible
        container.eventMode = 'passive';
        container.cursor = 'default';

        // Position at midpoint of wall
        const midX = (wall.c[0] + wall.c[2]) / 2;
        const midY = (wall.c[1] + wall.c[3]) / 2;

        this._drawBadge(container, midX, midY, effects.length);

        layer.addChild(container);
        this._containers.set(wall.id, container);
    }

    /**
     * Draw an effect indicator on a tile
     * @param {TileDocument} tile
     * @param {Array} effects
     * @private
     */
    _drawTileIndicator(tile, effects) {
        const layer = canvas.controls;
        if (!layer) return;

        const container = new PIXI.Container();
        container.name = `wod-effect-${tile.id}`;
        // Allow clicks to pass through while keeping the badge visible
        container.eventMode = 'passive';
        container.cursor = 'default';

        // Position at top-right corner of tile
        const x = tile.x + tile.width - 8;
        const y = tile.y + 8;

        this._drawBadge(container, x, y, effects.length);

        layer.addChild(container);
        this._containers.set(tile.id, container);
    }

    /**
     * Draw an effect indicator on a region
     * @param {RegionDocument} region
     * @param {Array} effects
     * @private
     */
    _drawRegionIndicator(region, effects) {
        const layer = canvas.controls;
        if (!layer) return;

        const container = new PIXI.Container();
        container.name = `wod-effect-${region.id}`;
        // Allow clicks to pass through while keeping the badge visible
        container.eventMode = 'passive';
        container.cursor = 'default';

        // Regions don't have simple x/y - use first shape's bounds if available
        const regionObj = canvas.regions?.get(region.id);
        if (regionObj?.bounds) {
            const bounds = regionObj.bounds;
            const x = bounds.x + bounds.width - 8;
            const y = bounds.y + 8;
            this._drawBadge(container, x, y, effects.length);
        }

        layer.addChild(container);
        this._containers.set(region.id, container);
    }

    /**
     * Draw a small circular badge with effect count
     * @param {PIXI.Container} container
     * @param {number} x
     * @param {number} y
     * @param {number} count
     * @private
     */
    _drawBadge(container, x, y, count) {
        const radius = 10;

        // Background circle
        const bg = new PIXI.Graphics();
        bg.beginFill(0x8b0000, 0.85); // dark red
        bg.drawCircle(0, 0, radius);
        bg.endFill();
        bg.lineStyle(1, 0xffffff, 0.8);
        bg.drawCircle(0, 0, radius);
        bg.position.set(x, y);
        container.addChild(bg);

        // Count text
        const text = new PIXI.Text(String(count), {
            fontFamily: 'Arial',
            fontSize: 11,
            fontWeight: 'bold',
            fill: 0xffffff,
            align: 'center'
        });
        text.anchor.set(0.5, 0.5);
        text.position.set(x, y);
        container.addChild(text);

        // Pulsing glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(0x8b0000, 0.3);
        glow.drawCircle(0, 0, radius + 4);
        glow.endFill();
        glow.position.set(x, y);
        container.addChildAt(glow, 0);
    }
}

// Singleton
export const canvasEffectIndicators = new CanvasEffectIndicators();
