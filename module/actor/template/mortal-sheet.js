import { WodActorSheet } from "./wod-actor-sheet.js";

/**
 * Mortal Actor Sheet
 * Extends the base WodActorSheet with mortal-specific functionality
 */
export class MortalSheet extends WodActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "sheet", "actor", "mortal"],
            template: "systems/wodsystem/templates/actor/mortal-sheet.html"
        });
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Add mortal-specific data if needed
        // For now, everything is handled by the base class
        
        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Add mortal-specific listeners here if needed in the future
    }
}
