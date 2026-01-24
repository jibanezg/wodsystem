/**
 * Mage Actor Sheet
 * Extends WodActorSheet to reuse all logic, only sets template and CSS class
 * For Mage: The Ascension - Traditions
 */

import { WodActorSheet } from "./wod-actor-sheet.js";

export class MageSheet extends WodActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "mage"],
            template: "systems/wodsystem/templates/actor/mage-sheet.html",
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        // Future: Add Mage-specific context data here
        // (e.g., Tradition, Cabal, Spheres)
        return context;
    }
}
