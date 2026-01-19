import { WodActor } from "./module/actor/data/wod-actor.js";
import { WodActorSheet } from "./module/actor/template/wod-actor-sheet.js";
import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { TechnocratSheet } from "./module/actor/template/technocrat-sheet.js";
import { WodDicePool } from "./module/dice/wod-dice-pool.js";
import { WodRollDialog } from "./module/apps/wod-roll-dialog.js";
import { initializeApprovalSocket } from "./module/apps/wod-st-approval-dialog.js";
import { registerHandlebarsHelpers } from "./scripts/utilities.js";
import { WodCharacterWizard } from "./module/character-creation/wod-character-wizard.js";

// Import Services
import { ReferenceDataService } from "./module/services/reference-data-service.js"; // Merits, flaws, backgrounds
import { EquipmentEffectsManager } from "./module/services/equipment-effects-manager.js"; // Equipment UI/token effects
import { MinimapManager } from "./module/services/minimap-manager.js"; // Minimap feature

// Import Item Classes
import { WodItem, WodWeapon, WodArmor, WodGear } from "./module/items/wod-item.js";

Hooks.once("init", async function() {
    console.log("WoD | Initializing World of Darkness System");
    
    // Initialize game reference data service (merits, flaws, abilities, spheres)
    game.wod = game.wod || {};
    game.wod.referenceDataService = new ReferenceDataService();
    await game.wod.referenceDataService.initialize();
    
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
        "systems/wodsystem/templates/actor/partials/equipment.html",
        "systems/wodsystem/templates/actor/partials/active-effects.html",
        "systems/wodsystem/templates/apps/roll-dialog.html",
        "systems/wodsystem/templates/apps/effect-manager.html",
        "systems/wodsystem/templates/apps/st-approval-dialog.html",
        "systems/wodsystem/templates/apps/equipment-effects-dialog.html",
        "systems/wodsystem/templates/apps/minimap-config-dialog.html",
        "systems/wodsystem/templates/apps/minimap-marker-dialog.html",
        "systems/wodsystem/templates/dice/roll-card.html",
        "systems/wodsystem/templates/chat/reference-card.html",
        "systems/wodsystem/templates/chat/background-reference-card.html",
        // Character Creation Wizard
        "systems/wodsystem/templates/apps/wizard-steps/step-concept.html",
        "systems/wodsystem/templates/apps/wizard-steps/step-attributes.html",
        "systems/wodsystem/templates/apps/wizard-steps/step-abilities.html",
        "systems/wodsystem/templates/apps/wizard-steps/step-advantages.html",
        "systems/wodsystem/templates/apps/wizard-steps/step-merits-flaws.html",
        "systems/wodsystem/templates/apps/wizard-steps/step-freebies.html",
        "systems/wodsystem/templates/apps/wizard-steps/step-review.html"
    ]);
    console.log("WoD | Handlebars partials loaded");

    // Register Actor Classes
    CONFIG.Actor.documentClass = WodActor;
    
    // Register Item Classes
    CONFIG.Item.documentClass = WodItem;
    
    // Register Item types explicitly (Foundry should load from template.json, but we ensure they're available)
    if (!CONFIG.Item.types) {
        CONFIG.Item.types = {};
    }
    CONFIG.Item.types["Trait"] = "Trait";
    CONFIG.Item.types["weapon"] = "Weapon";
    CONFIG.Item.types["armor"] = "Armor";
    CONFIG.Item.types["gear"] = "Gear";
    
    // Register Item type labels
    CONFIG.Item.typeLabels = CONFIG.Item.typeLabels || {};
    CONFIG.Item.typeLabels.weapon = "Weapon";
    CONFIG.Item.typeLabels.armor = "Armor";
    CONFIG.Item.typeLabels.gear = "Gear";
    
    console.log("WoD | Item types registered:", Object.keys(CONFIG.Item.types));
    
    // Make Character Wizard available globally
    game.wodsystem = game.wodsystem || {};
    game.wodsystem.WodCharacterWizard = WodCharacterWizard;
    
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

Hooks.on("setup", () => {
    // Ensure Item types are registered (Foundry loads these from template.json)
    // But we explicitly register them here to ensure they're available
    if (!CONFIG.Item.types) {
        CONFIG.Item.types = {};
    }
    
    // Register our Item types explicitly
    CONFIG.Item.types["Trait"] = "Trait";
    CONFIG.Item.types["weapon"] = "Weapon";
    CONFIG.Item.types["armor"] = "Armor";
    CONFIG.Item.types["gear"] = "Gear";
    
    console.log("WoD | Item types registered:", Object.keys(CONFIG.Item.types));
});

Hooks.on("ready", async () => {
    console.log("WoD | World of Darkness System ready");
    console.log("WoD | Reference data service loaded:", !!game.wod.referenceDataService);
    console.log("WoD | Reference data initialized:", game.wod.referenceDataService?.initialized);
    console.log("WoD | Current user is GM:", game.user.isGM);
    console.log("WoD | Socket available:", !!game.socket);
    
    // Initialize socket for effect approval system
    initializeApprovalSocket();
    console.log("WoD | Effect approval socket initialized");
    
    // Initialize Equipment Effects Manager
    EquipmentEffectsManager.initialize();
    console.log("WoD | Equipment Effects Manager initialized");
    
    // Initialize Minimap Manager
    MinimapManager.initialize();
    console.log("WoD | Minimap Manager initialized");
    
    // Load Minimap dialogs and make them globally available
    Promise.all([
        import("./module/apps/wod-minimap-config-dialog.js"),
        import("./module/apps/wod-minimap-marker-dialog.js"),
        import("./module/ui/minimap-hud.js")
    ]).then(([configDialog, markerDialog, hud]) => {
        // Make dialogs globally available
        game.wod = game.wod || {};
        game.wod.MinimapConfigDialog = configDialog.WodMinimapConfigDialog;
        game.wod.MinimapMarkerDialog = markerDialog.WodMinimapMarkerDialog;
        
        // Initialize Minimap HUD
        hud.MinimapHUD.initialize();
        console.log("WoD | Minimap HUD initialized");
        console.log("WoD | Minimap dialogs loaded");
    });
});
