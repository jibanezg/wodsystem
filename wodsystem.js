import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { WodActor } from "./module/actor/data/wod-actor.js";
import { registerHandlebarsHelpers } from "./scripts/utilities.js";

// Import Vector Database
import "./scripts/vector-database.js";

// Import CSS Loader
import "./scripts/css-loader.js";

// Load framework files dynamically to ensure proper order
async function loadRulespediaFramework() {
    try {
        await import("./scripts/rulespedia-framework.js");
        await import("./scripts/rulespedia-views.js");
        await import("./scripts/rulespedia.js");
    } catch (error) {
        console.error("WoD | Error loading Rulespedia framework:", error);
    }
}

// Load the framework
loadRulespediaFramework();

Hooks.once("init", async function() {
    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Register Actor Classes
    CONFIG.Actor.documentClass = WodActor;
    
    // Register Actor Sheets
    Actors.registerSheet("wodsystem", MortalSheet, {
        types: ["Mortal"],
        makeDefault: true
    });
    
    // Register Rulespedia vector database setting programmatically
    // This ensures the setting is available even if system.json hasn't been reloaded
    if (!game.settings.settings.has('wodsystem.rulespedia-vectors')) {
        game.settings.register('wodsystem', 'rulespedia-vectors', {
            name: 'Rulespedia Vector Database',
            hint: 'Internal storage for Rulespedia vector embeddings',
            type: Object,
            default: null,
            scope: 'world',
            config: false
        });
        console.log('WoD | Registered rulespedia-vectors setting programmatically');
    }
});

Hooks.on("ready", async () => {
    // Load CSS files using the modular CSS loader
    try {
        if (window.rulespediaCSSLoader) {
            await window.rulespediaCSSLoader.loadAllCSS();
        } else {
            console.error("WoD | RulespediaCSSLoader not available");
        }
    } catch (error) {
        console.error("WoD | Error loading CSS:", error);
    }
    
    // Initialize vector database
    if (window.VectorDatabaseManager) {
        window.rulespediaVectorDB = new window.VectorDatabaseManager();
        window.rulespediaVectorDB.initialize().catch(error => {
            console.error("WoD | Vector database initialization failed:", error);
        });
    }
    
    // Set up global rulespediaManager reference
    // This will be set when the Rulespedia tab is created
    Hooks.on('renderSidebarTab', (app, html) => {
        if (app.options.id === 'rulespedia') {
            // Find the Rulespedia instance and set it globally
            const rulespediaElement = document.querySelector('[data-tab="rulespedia"]');
            if (rulespediaElement && window.Rulespedia) {
                // The Rulespedia instance should already be created by this point
            }
        }
    });
});
