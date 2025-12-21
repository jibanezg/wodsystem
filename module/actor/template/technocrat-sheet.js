/**
 * Technocrat Actor Sheet
 * Extends WodActorSheet to reuse all logic, only sets template and CSS class
 * For Mage: The Ascension - Technocracy
 */

import { WodActorSheet } from "./wod-actor-sheet.js";

export class TechnocratSheet extends WodActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "technocrat"],
            template: "systems/wodsystem/templates/actor/technocrat-sheet.html",
            width: 800,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main"}]
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        // Future: Add Technocrat-specific context data here
        // (e.g., Enlightenment, Primal Utility, Procedures)
        return context;
    }
}

