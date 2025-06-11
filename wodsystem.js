import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { WodActor } from "./module/actor/data/wod-actor.js";
import { RpgThruSettings } from "./module/rpgthru/settings.js";
import { RpgThruTabManager } from "./scripts/rpgthru-tab-manager.js";
import { RpgThruSidebar } from "./scripts/rpgthru-sidebar.js";
import { registerHandlebarsHelpers } from "./scripts/utilities.js";

// Import API scripts to make them globally available
import "./scripts/api-utils.js";
import "./scripts/api-client.js";
import "./scripts/drivethrurpg-controller.js";

Hooks.once("init", async function() {
    console.log("WoD | Initializing World of Darkness System");
    
    // Initialize RPGThru settings
    RpgThruSettings.init();
    
    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Register Actor Classes
    CONFIG.Actor.documentClass = WodActor;
    
    // Register Actor Sheets
    Actors.registerSheet("wodsystem", MortalSheet, {
        types: ["Mortal"],
        makeDefault: true
    });
    
    console.log("WoD | System initialized");
});

// Initialize RPGThru UI components
let rpgThruTabManager;
let rpgThruSidebar;

Hooks.on("ready", () => {
    console.log("WoD | Ready hook triggered, initializing RPGThru UI");
    
    // Initialize RPGThru components
    rpgThruTabManager = new RpgThruTabManager();
    rpgThruSidebar = new RpgThruSidebar();
    rpgThruSidebar.init();
    
    // Add RPGThru tab to sidebar
    setTimeout(async () => {
        const sidebar = $('#sidebar');
        if (sidebar.length > 0) {
            await rpgThruTabManager.addTabToSidebar(sidebar);
        }
    }, 1000);
});

// Add RPGThru tab when sidebar is rendered (only if not already added)
Hooks.on("renderSidebar", async (app, html) => {
    if (html && html instanceof jQuery && rpgThruTabManager && !rpgThruTabManager.isTabAdded) {
        await rpgThruTabManager.addTabToSidebar(html);
    }
});
