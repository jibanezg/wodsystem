import { WodActor } from "./module/actor/data/wod-actor.js";
import { WodActorSheet } from "./module/actor/template/wod-actor-sheet.js";
import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { TechnocratSheet } from "./module/actor/template/technocrat-sheet.js";
import { registerHandlebarsHelpers } from "./scripts/utilities.js";

// Import Services
import "./scripts/reference-data-service.js"; // External data (archetypes, backgrounds)
// import "./scripts/health-service.js"; // DEPRECATED - moved to WodActor domain methods
import "./scripts/calculation-service.js"; // Future: complex cross-actor calculations

Hooks.once("init", async function() {
    console.log("WoD | Initializing World of Darkness System");
    
    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Preload Handlebars partials
    await loadTemplates([
        "systems/wodsystem/templates/actor/partials/header.html",
        "systems/wodsystem/templates/actor/partials/technocrat-header.html",
        "systems/wodsystem/templates/actor/partials/technocrat-advantages.html",
        "systems/wodsystem/templates/actor/partials/attributes.html",
        "systems/wodsystem/templates/actor/partials/abilities.html",
        "systems/wodsystem/templates/actor/partials/health.html",
        "systems/wodsystem/templates/actor/partials/biography.html",
        "systems/wodsystem/templates/actor/partials/secondary-abilities.html",
        "systems/wodsystem/templates/actor/partials/virtues-humanity.html",
        "systems/wodsystem/templates/actor/partials/merits-flaws.html",
        "systems/wodsystem/templates/actor/partials/advantages-common.html",
        "systems/wodsystem/templates/actor/partials/mortal-numina.html"
    ]);
    console.log("WoD | Handlebars partials loaded");

    // Register Actor Classes
    CONFIG.Actor.documentClass = WodActor;
    
    // Register Actor Sheets
    Actors.registerSheet("wodsystem", MortalSheet, {
        types: ["Mortal"],
        makeDefault: true
    });
    
    Actors.registerSheet("wodsystem", TechnocratSheet, {
        types: ["Technocrat"],
        makeDefault: true
    });
    
    console.log("WoD | Actor sheets registered");
});

Hooks.on("ready", async () => {
    console.log("WoD | World of Darkness System ready");
    console.log("WoD | Services loaded:", {
        reference: !!window.referenceDataService,
        health: !!window.healthService,
        calculation: !!window.calculationService
    });
});
