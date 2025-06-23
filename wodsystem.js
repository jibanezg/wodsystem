import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { WodActor } from "./module/actor/data/wod-actor.js";
import { registerHandlebarsHelpers } from "./scripts/utilities.js";

// Import Content Store
import "./scripts/content-store.js";

// Import LLM Services
Promise.all([
    import("./scripts/debug-service.js").catch(error => {
        console.error('WoD | Failed to import Debug Service:', error);
    }),
    import("./scripts/llm-prompts.js").catch(error => {
        console.error('WoD | Failed to import LLM Prompts:', error);
    }),
    import("./scripts/llm-service.js").catch(error => {
        console.error('WoD | Failed to import LLM Service:', error);
    }),
    import("./scripts/browser-llm-provider.js").catch(error => {
        console.error('WoD | Failed to import Browser LLM Provider:', error);
    }),
    import("./scripts/tensorflow-llm-provider.js").catch(error => {
        console.error('WoD | Failed to import TensorFlow LLM Provider:', error);
    }),
    import("./scripts/rule-discovery-service.js").catch(error => {
        console.error('WoD | Failed to import Rule Discovery Service:', error);
    })
]).catch(error => {
    console.error('WoD | Some LLM imports failed:', error);
});

// Import Rulespedia Services
import "./scripts/rulespedia-services.js";
import "./scripts/rulespedia-statistics.js";

// Import Template Loader
import "./scripts/template-loader.js";

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
    
    // Register Rulespedia content store setting programmatically
    // This ensures the setting is available even if system.json hasn't been reloaded
    if (!game.settings.settings.has('wodsystem.rulespedia-content')) {
        game.settings.register('wodsystem', 'rulespedia-content', {
            name: 'Rulespedia Content Store',
            hint: 'Internal storage for Rulespedia text chunks and TF-IDF data',
            type: Object,
            default: null,
            scope: 'world',
            config: false
        });
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
    
    // Initialize content store
    if (window.ContentStore) {
        window.rulespediaContentStore = new window.ContentStore();
        window.rulespediaContentStore.initialize().catch(error => {
            console.error("WoD | Content store initialization failed:", error);
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
