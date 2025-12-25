import { WodActor } from "./module/actor/data/wod-actor.js";
import { WodActorSheet } from "./module/actor/template/wod-actor-sheet.js";
import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { TechnocratSheet } from "./module/actor/template/technocrat-sheet.js";
import { WodDicePool } from "./module/dice/wod-dice-pool.js";
import { WodRollDialog } from "./module/apps/wod-roll-dialog.js";
import { registerHandlebarsHelpers } from "./scripts/utilities.js";

// Import Services
import "./scripts/reference-data-service.js"; // External data (archetypes, backgrounds)

Hooks.once("init", async function() {
    console.log("WoD | Initializing World of Darkness System");
    
    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Preload Handlebars partials
    await loadTemplates([
        "systems/wodsystem/templates/actor/partials/header.html",
        "systems/wodsystem/templates/actor/partials/technocrat-header.html",
        "systems/wodsystem/templates/actor/partials/technocrat-advantages.html",
        "systems/wodsystem/templates/actor/partials/technocrat-spheres.html",
        "systems/wodsystem/templates/actor/partials/technocrat-backgrounds-expanded.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-sanctum.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-construct.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-mentor.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-allies.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-contacts.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-resources.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-familiar.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-device.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-enhancement.html",
        "systems/wodsystem/templates/actor/partials/backgrounds/bg-custom.html",
        "systems/wodsystem/templates/actor/partials/attributes.html",
        "systems/wodsystem/templates/actor/partials/abilities.html",
        "systems/wodsystem/templates/actor/partials/health.html",
        "systems/wodsystem/templates/actor/partials/biography.html",
        "systems/wodsystem/templates/actor/partials/secondary-abilities.html",
        "systems/wodsystem/templates/actor/partials/virtues-humanity.html",
        "systems/wodsystem/templates/actor/partials/merits-flaws.html",
        "systems/wodsystem/templates/actor/partials/advantages-common.html",
        "systems/wodsystem/templates/actor/partials/mortal-numina.html",
        "systems/wodsystem/templates/actor/partials/experience.html",
        "systems/wodsystem/templates/actor/partials/quick-rolls-panel.html",
        "systems/wodsystem/templates/apps/roll-dialog.html",
        "systems/wodsystem/templates/dice/roll-card.html"
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
    console.log("WoD | Reference data service loaded:", !!window.referenceDataService);
});
