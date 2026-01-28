console.log("🚀 [WODSYSTEM] File loading started - BEFORE imports");

import { WodActor } from "./module/actor/data/wod-actor.js";
import { WodActorSheet } from "./module/actor/template/wod-actor-sheet.js";
import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { TechnocratSheet } from "./module/actor/template/technocrat-sheet.js";
import { MageSheet } from "./module/actor/template/mage-sheet.js";
import { SpiritSheet } from "./module/actor/template/spirit-sheet.js";
import { DemonSheet } from "./module/actor/template/demon-sheet.js";
import { WodDicePool } from "./module/dice/wod-dice-pool.js";
import { WodRollDialog } from "./module/apps/wod-roll-dialog.js";
import { initializeApprovalSocket } from "./module/apps/wod-st-approval-dialog.js";
import { registerHandlebarsHelpers } from "./scripts/utilities.js";
import { WodCharacterWizard } from "./module/character-creation/wod-character-wizard.js";

// Import Services
import { GameDataService } from "./module/services/game-data-service.js"; // Game data by source (M20, D20)
import { EquipmentEffectsManager } from "./module/services/equipment-effects-manager.js"; // Equipment UI/token effects
import { MinimapManager } from "./module/services/minimap-manager.js"; // Minimap feature

// Import Item Classes
import { WodItem, WodWeapon, WodArmor, WodGear } from "./module/items/wod-item.js";

console.log("🚀 [WODSYSTEM] All imports completed successfully");

Hooks.once("init", async function() {
    console.log("🎬 [SYSTEM INIT] WoD System initialization starting...");
    
    // Register Actor Classes FIRST (before any async operations)
    console.log("🎬 [SYSTEM INIT] Registering Actor classes...");
    CONFIG.Actor.documentClass = WodActor;
    
    // Register Item Classes
    CONFIG.Item.documentClass = WodItem;
    
    // Register Item types explicitly
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
    
    // Register Actor Sheets EARLY (before async operations that might fail)
    console.log("🎬 [SYSTEM INIT] Registering Actor Sheets...");
    Actors.registerSheet("wodsystem", MortalSheet, {
        types: ["Mortal", "Mortal-NPC"],
        makeDefault: true
    });
    
    Actors.registerSheet("wodsystem", TechnocratSheet, {
        types: ["Technocrat", "Technocrat-NPC"],
        makeDefault: true
    });
    
    Actors.registerSheet("wodsystem", MageSheet, {
        types: ["Mage", "Mage-NPC"],
        makeDefault: true
    });
    
    Actors.registerSheet("wodsystem", SpiritSheet, {
        types: ["Spirit"],
        makeDefault: true
    });
    
    Actors.registerSheet("wodsystem", DemonSheet, {
        types: ["Demon", "Demon-NPC", "Earthbound"],
        makeDefault: true
    });
    
    console.log("🎬 [SYSTEM INIT] Actor Sheets registered successfully");
    
    // Make Character Wizard available globally
    game.wodsystem = game.wodsystem || {};
    game.wodsystem.WodCharacterWizard = WodCharacterWizard;
    
    // Now do async operations (these might fail but sheets are already registered)
    // Initialize game data service (organizes data by source: M20, D20)
    try {
        console.log("🎬 [SYSTEM INIT] Creating GameDataService...");
        game.wod = game.wod || {};
        game.wod.referenceDataService = new GameDataService();
        game.wod.gameDataService = game.wod.referenceDataService;
        console.log("🎬 [SYSTEM INIT] Initializing GameDataService...");
        await game.wod.referenceDataService.initialize();
        console.log("🎬 [SYSTEM INIT] GameDataService initialized successfully");
    } catch (error) {
        console.error("WoD | CRITICAL: Failed to initialize Game Data Service:", error);
        // Create a minimal service to prevent complete failure
        game.wod = game.wod || {};
        game.wod.referenceDataService = {
            initialized: true,
            data: { m20: {}, d20: {}, shared: {} },
            trieIndices: {},
            search: () => [],
            getByName: () => null,
            getBackgroundsList: () => [],
            getArchetypes: () => []
        };
        game.wod.gameDataService = game.wod.referenceDataService;
    }
    
    // Register Handlebars helpers
    registerHandlebarsHelpers();

    // Preload Handlebars partials
    await loadTemplates([
        "systems/wodsystem/templates/actor/partials/header.html",
        "systems/wodsystem/templates/actor/partials/technocrat-header.html",
        "systems/wodsystem/templates/actor/partials/mage-header.html",
        "systems/wodsystem/templates/actor/partials/spirit-header.html",
        "systems/wodsystem/templates/actor/partials/demon-header.html",
        "systems/wodsystem/templates/actor/partials/demon-advantages.html",
        "systems/wodsystem/templates/actor/partials/demon-lore.html",
        "systems/wodsystem/templates/actor/partials/demon-apocalyptic-form.html",
        "systems/wodsystem/templates/actor/partials/technocrat-advantages.html",
        "systems/wodsystem/templates/actor/partials/mage-advantages.html",
        "systems/wodsystem/templates/actor/partials/technocrat-spheres.html",
        "systems/wodsystem/templates/actor/partials/mage-spheres.html",
        "systems/wodsystem/templates/actor/partials/spirit-spheres.html",
        "systems/wodsystem/templates/actor/partials/technocrat-backgrounds-expanded.html",
        "systems/wodsystem/templates/actor/partials/spirit-attributes.html",
        "systems/wodsystem/templates/actor/partials/spirit-essence.html",
        "systems/wodsystem/templates/actor/partials/spirit-charms.html",
        "systems/wodsystem/templates/actor/partials/spirit-advantages.html",
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
    
    console.log("🎬 [SYSTEM INIT] Templates loaded successfully");
    console.log("🎬 [SYSTEM INIT] WoD System initialization complete");
});

Hooks.on("setup", () => {
    console.log("🎬 [SYSTEM SETUP] WoD System setup phase starting...");
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
});

// Filter NPC types from actor creation dialog - only show to GMs
// Spirits are always NPCs and only available to GMs
Hooks.on("getActorTypes", (actorTypes) => {
    // If user is not GM, filter out NPC types and Spirits
    if (!game.user.isGM) {
        const filteredTypes = {};
        for (const [key, value] of Object.entries(actorTypes)) {
            // Filter out types ending with '-NPC' and also 'Spirit' (always NPC)
            if (!key.endsWith('-NPC') && key !== 'Spirit') {
                filteredTypes[key] = value;
            }
        }
        return filteredTypes;
    }
    // GMs see all types
    return actorTypes;
});

// Hook to recalculate Essence for Spirits after actor update (backup to _preUpdate)
Hooks.on("updateActor", async (actor, updateData, options, userId) => {
    // Only process for Spirit actors and skip if this update already includes essence changes (to avoid loops)
    if (actor.type === "Spirit" && 
        !updateData.system?.advantages?.essence && // Skip if essence is already being updated
        updateData.system?.attributes &&
        (updateData.system.attributes.willpower?.current !== undefined ||
         updateData.system.attributes.rage?.current !== undefined ||
         updateData.system.attributes.gnosis?.current !== undefined)) {
        
        // Wait a tick to ensure the update has been applied
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Get the fresh actor data
        const freshActor = game.actors.get(actor.id);
        if (!freshActor) return;
        
        // Calculate essence from current permanent values
        const willpowerCurrent = Number(freshActor.system.attributes?.willpower?.current ?? 1);
        const rageCurrent = Number(freshActor.system.attributes?.rage?.current ?? 1);
        const gnosisCurrent = Number(freshActor.system.attributes?.gnosis?.current ?? 1);
        const newEssenceMax = willpowerCurrent + rageCurrent + gnosisCurrent;
        
        // Only update if the essence maximum needs to change
        const currentEssenceMax = Number(freshActor.system.advantages?.essence?.maximum ?? 0);
        if (currentEssenceMax !== newEssenceMax) {
            const updatePayload = {
                "system.advantages.essence.maximum": newEssenceMax
            };
            
            // Also cap current essence if it exceeds the new maximum
            const currentEssence = Number(freshActor.system.advantages?.essence?.current ?? 0);
            if (currentEssence > newEssenceMax) {
                updatePayload["system.advantages.essence.current"] = newEssenceMax;
            }
            
            await freshActor.update(updatePayload, { render: true });
        }
    }
});

Hooks.on("ready", async () => {
    console.log("🎬 [SYSTEM READY] WoD System ready phase starting...");
    // Initialize socket for effect approval system
    initializeApprovalSocket();
    
    // Initialize Equipment Effects Manager
    EquipmentEffectsManager.initialize();
    
    // Initialize Minimap Manager
    MinimapManager.initialize();
    
    console.log("🎬 [SYSTEM READY] WoD System fully ready");
    
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
    });
});

// Store roll data for each combatant so we can use it when the chat message is created
const initiativeRollData = new Map();

// Hook to intercept Combat Tracker initiative rolls
Hooks.on("rollInitiative", async (combat, combatant, roll) => {
    // This hook fires when initiative is rolled from the Combat Tracker
    const actor = combatant.actor;
    if (!actor || typeof actor.getInitiative !== "function") {
        return; // Not a WoD actor
    }
    
    // Ensure roll is evaluated
    if (roll && !roll._evaluated) {
        await roll.evaluate();
    }
    
    // Get individual components for breakdown
    const dexterity = Number(actor._findAttributeValue("Dexterity")) || 0;
    const wits = Number(actor._findAttributeValue("Wits")) || 0;
    const bonus = Number(actor.system.combat?.initiativeBonus) || 0;
    const initiativeValue = actor.getInitiative();
    
    // Get the d10 result from the roll - try multiple ways to access it
    let d10Result = 0;
    const rollTotal = roll?.total ?? 0;
    
    if (roll) {
        // Try accessing through roll.terms (newer Foundry API)
        if (roll.terms && roll.terms.length > 0) {
            const d10Term = roll.terms.find(t => t.faces === 10 || (t.number === 1 && t.faces === 10));
            if (d10Term && d10Term.results && d10Term.results.length > 0) {
                d10Result = d10Term.results[0].result ?? d10Term.results[0].value ?? 0;
            }
        }
        
        // Fallback: try roll.dice (older API)
        if (d10Result === 0 && roll.dice && roll.dice.length > 0) {
            const d10Die = roll.dice.find(d => d.faces === 10) || roll.dice[0];
            if (d10Die && d10Die.results && d10Die.results.length > 0) {
                d10Result = d10Die.results[0].result ?? d10Die.results[0].value ?? 0;
            }
        }
        
        // Last resort: calculate from total
        if (d10Result === 0 && rollTotal > 0) {
            d10Result = rollTotal - initiativeValue;
        }
    }
    
    // Ensure rollTotal includes the d10 result
    const expectedTotal = d10Result + initiativeValue;
    if (rollTotal !== expectedTotal) {
        rollTotal = expectedTotal;
    }
    
    // Store the roll data for this combatant so we can use it in createChatMessage
    initiativeRollData.set(combatant.id, {
        d10Result,
        rollTotal,
        dexterity,
        wits,
        bonus,
        initiativeValue,
        actorId: actor.id
    });
    
    // Create detailed breakdown
    let breakdown = `Dexterity: ${dexterity}`;
    breakdown += ` + Wits: ${wits}`;
    if (bonus !== 0) {
        breakdown += ` + Bonus: ${bonus}`;
    }
    breakdown += ` = Base: ${initiativeValue}`;
    breakdown += ` | Roll: 1d10 (${d10Result}) + ${initiativeValue} = ${rollTotal}`;
    
    // Wait a moment for the chat message to be created, then update it
    setTimeout(async () => {
        // Find the most recent chat message from this actor
        const messages = game.messages.filter(m => {
            const speaker = m.speaker;
            return speaker && speaker.actor === actor.id && 
                   (m.flavor?.toLowerCase().includes("initiative") || 
                    m.content?.toLowerCase().includes("initiative") ||
                    (m.roll && m.roll.formula && m.roll.formula.includes("1d10")));
        });
        
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            await lastMessage.update({
                content: "", // Clear default content to hide Foundry's roll display
                flavor: `<div class="wod-initiative-roll">
                    <strong>Initiative Roll</strong><br/>
                    <div class="initiative-breakdown">${breakdown}</div>
                </div>`
            });
        }
    }, 100);
});

// Hook to intercept chat messages BEFORE they're created (to prevent default roll display)
Hooks.on("preCreateChatMessage", async (messageData, options, userId) => {
    // Check if this is an initiative roll message
    const flavor = messageData.flavor || "";
    const content = messageData.content || "";
    const roll = messageData.roll;
    
    // Check if this looks like an initiative roll
    const hasInitiativeKeyword = flavor.toLowerCase().includes("initiative") || 
                                  content.toLowerCase().includes("initiative") ||
                                  content.toLowerCase().includes("rolls for initiative");
    
    const hasInitiativeFormula = roll && roll.formula && 
                                  (roll.formula.includes("1d10") || roll.formula.match(/1d10\s*\+/));
    
    if (hasInitiativeKeyword || hasInitiativeFormula) {
        // Try to find the actor from the speaker
        const speaker = messageData.speaker;
        if (speaker && speaker.actor) {
            const actor = game.actors.get(speaker.actor);
            if (actor && typeof actor.getInitiative === "function") {
                // Store the roll data in flags so we can access it later
                messageData.flags = messageData.flags || {};
                messageData.flags.wodsystem = messageData.flags.wodsystem || {};
                messageData.flags.wodsystem.isInitiativeRoll = true;
                messageData.flags.wodsystem.initiativeRollData = {
                    formula: roll?.formula,
                    total: roll?.total
                };
                
                // Remove the roll from messageData to prevent Foundry from displaying it
                delete messageData.roll;
                
                // Set initial content to our custom breakdown structure (will be updated in createChatMessage)
                messageData.content = `<div class="wod-initiative-roll"><div class="initiative-breakdown">Calculating...</div></div>`;
            }
        }
    }
    
    return true;
});

// Fallback: Hook to intercept chat messages as they're created
Hooks.on("createChatMessage", async (message, options, userId) => {
    // Check if this is an initiative roll message
    const flavor = message.flavor || "";
    const content = message.content || "";
    const roll = message.roll;
    
    // Check if this looks like an initiative roll
    const hasInitiativeKeyword = flavor.toLowerCase().includes("initiative") || 
                                  content.toLowerCase().includes("initiative") ||
                                  content.toLowerCase().includes("rolls for initiative");
    
    const hasInitiativeFormula = roll && roll.formula && 
                                  (roll.formula.includes("1d10") || roll.formula.match(/1d10\s*\+/));
    
    if (!hasInitiativeFormula && !hasInitiativeKeyword) {
        return; // Not an initiative roll
    }
    
    // Try to find the actor from the speaker
    const speaker = message.speaker;
    if (!speaker || !speaker.actor) {
        return; // No actor
    }
    
    const actor = game.actors.get(speaker.actor);
    if (!actor || typeof actor.getInitiative !== "function") {
        return; // Not a WoD actor
    }
    
    // Try to find stored roll data from rollInitiative hook
    let rollData = null;
    let combatant = null;
    if (game.combat) {
        combatant = game.combat.combatants.find(c => c.actorId === actor.id);
        
        if (combatant && initiativeRollData.has(combatant.id)) {
            rollData = initiativeRollData.get(combatant.id);
        } else if (combatant && combatant.initiative !== null && combatant.initiative !== undefined) {
            // Try to get roll data from combatant's initiative value
            const baseInitiative = actor.getInitiative();
            
            // Calculate d10Result from combatant.initiative and actor's base
            const calculatedD10 = combatant.initiative - baseInitiative;
            
            // If the calculation makes sense (d10 between 1-10), use it
            let d10Result, rollTotal;
            
            if (calculatedD10 >= 1 && calculatedD10 <= 10) {
                // Normal case: combatant.initiative is the total
                d10Result = calculatedD10;
                rollTotal = combatant.initiative;
            } else if (combatant.initiative >= 1 && combatant.initiative <= 10) {
                // Alternative: combatant.initiative is just the d10
                d10Result = combatant.initiative;
                rollTotal = d10Result + baseInitiative;
            } else {
                // Fallback: use combatant.initiative as total anyway
                d10Result = Math.max(1, Math.min(10, calculatedD10));
                rollTotal = combatant.initiative;
            }
            
            rollData = {
                d10Result: d10Result,
                rollTotal: rollTotal,
                dexterity: Number(actor._findAttributeValue("Dexterity")) || 0,
                wits: Number(actor._findAttributeValue("Wits")) || 0,
                bonus: Number(actor.system.combat?.initiativeBonus) || 0,
                initiativeValue: baseInitiative,
                actorId: actor.id
            };
        }
    }
    
    // Get individual components for breakdown - use stored data if available
    let dexterity, wits, bonus, initiativeValue, d10Result, rollTotal;
    
    if (rollData) {
        // Use stored data from rollInitiative hook
        dexterity = rollData.dexterity;
        wits = rollData.wits;
        bonus = rollData.bonus;
        initiativeValue = rollData.initiativeValue;
        d10Result = rollData.d10Result;
        rollTotal = rollData.rollTotal;
    } else {
        // Fallback: calculate from actor and message roll
        dexterity = Number(actor._findAttributeValue("Dexterity")) || 0;
        wits = Number(actor._findAttributeValue("Wits")) || 0;
        bonus = Number(actor.system.combat?.initiativeBonus) || 0;
        initiativeValue = actor.getInitiative();
        rollTotal = roll?.total ?? 0;
        
        // Get the d10 result from the roll - try multiple ways to access it
        d10Result = 0;
        
        if (roll) {
            // Try accessing through roll.terms (newer Foundry API)
            if (roll.terms && roll.terms.length > 0) {
                const d10Term = roll.terms.find(t => t.faces === 10 || (t.number === 1 && t.faces === 10));
                if (d10Term && d10Term.results && d10Term.results.length > 0) {
                    d10Result = d10Term.results[0].result ?? d10Term.results[0].value ?? 0;
                }
            }
            
            // Fallback: try roll.dice (older API)
            if (d10Result === 0 && roll.dice && roll.dice.length > 0) {
                const d10Die = roll.dice.find(d => d.faces === 10) || roll.dice[0];
                if (d10Die && d10Die.results && d10Die.results.length > 0) {
                    d10Result = d10Die.results[0].result ?? d10Die.results[0].value ?? 0;
                }
            }
            
            // Last resort: calculate from total
            if (d10Result === 0 && rollTotal > 0) {
                d10Result = rollTotal - initiativeValue;
            }
        }
    }
    
    // CRITICAL: Ensure d10Result is correct BEFORE generating HTML
    // If d10Result is 0 or invalid, calculate from rollTotal
    if (!d10Result || d10Result === 0 || d10Result < 1 || d10Result > 10) {
        if (rollTotal > 0 && initiativeValue >= 0) {
            const calculatedD10 = rollTotal - initiativeValue;
            if (calculatedD10 >= 1 && calculatedD10 <= 10) {
                d10Result = calculatedD10;
            }
        }
    }
    
    // Ensure rollTotal includes the d10 result
    const expectedTotal = d10Result + initiativeValue;
    if (rollTotal !== expectedTotal) {
        rollTotal = expectedTotal;
    }
    
    // Final validation: d10Result MUST be between 1 and 10
    if (d10Result < 1 || d10Result > 10) {
        // Force a valid value - calculate from total
        if (rollTotal > initiativeValue) {
            d10Result = Math.max(1, Math.min(10, rollTotal - initiativeValue));
        }
    }
    
    // Create detailed breakdown - format nicely with structured layout similar to reference cards
    let baseParts = [`Dexterity: ${dexterity}`, `Wits: ${wits}`];
    if (bonus !== 0) {
        baseParts.push(`Bonus: ${bonus}`);
    }
    const baseCalculation = baseParts.join(' + ');
    
    const breakdown = `
        <div class="initiative-calculation">
            <div class="initiative-base">
                <span class="calc-label">Base:</span>
                <span class="calc-formula">${baseCalculation}</span>
                <span class="calc-equals">=</span>
                <span class="calc-result">${initiativeValue}</span>
            </div>
            <div class="initiative-roll">
                <span class="calc-label">Roll:</span>
                <span class="dice-notation">1d10</span>
                <span class="dice-result" data-d10-result="${d10Result}">(${d10Result >= 1 && d10Result <= 10 ? d10Result : '?'})</span>
                <span class="calc-formula">+ ${initiativeValue}</span>
                <span class="calc-equals">=</span>
                <span class="initiative-total">${rollTotal}</span>
            </div>
        </div>
    `;
    
    const htmlContent = `<div class="wod-initiative-card">
        <div class="initiative-header">
            <h3><i class="fas fa-bolt"></i> Initiative Roll</h3>
        </div>
        <div class="initiative-breakdown">${breakdown}</div>
    </div>`;
    
    // Update the message with our detailed breakdown
    // Set content directly and remove roll to prevent Foundry from regenerating the roll display
    try {
        await message.update({
            content: htmlContent,
            roll: null  // Explicitly remove roll to prevent regeneration
        });
    } catch (error) {
        console.error("💬 [Initiative] Error updating message", error);
    }
    
    // Also delete the roll from the message object directly to be safe
    if (message.roll) {
        delete message.roll;
    }
    
    // Update combatant initiative to the correct total (d10Result + initiativeValue)
    // The total MUST include the d10 roll result
    if (rollData && game.combat && combatant) {
        const currentInitiative = combatant.initiative;
        // Ensure correctTotal includes the d10 result
        const correctTotal = rollData.d10Result + rollData.initiativeValue;
        
        if (currentInitiative !== correctTotal) {
            await game.combat.setInitiative(combatant.id, correctTotal);
        }
        
        // Clean up stored data after a delay
        setTimeout(() => {
            initiativeRollData.delete(combatant.id);
        }, 1000);
    }
});

// Function to clean up initiative roll display
function cleanupInitiativeRollDisplay(messageElement) {
    if (!messageElement || !messageElement.length) return;
    
    const initiativeRoll = messageElement.find('.wod-initiative-card, .wod-initiative-roll');
    if (initiativeRoll.length === 0) return;
    
    // Remove Foundry's default roll display elements
    const diceRollContainer = messageElement.find('.dice-roll');
    if (diceRollContainer.length > 0) {
        diceRollContainer.remove();
    }
    
    // Remove all dice-related elements individually
    // CRITICAL: Only remove Foundry's dice-result, NOT our custom one inside .wod-initiative-card
    messageElement.find('.dice-result').each(function() {
        const $el = $(this);
        // Skip if it's inside our custom initiative card
        if ($el.closest('.wod-initiative-card').length || $el.closest('.wod-initiative-roll').length) {
            return; // Skip this element
        }
        $el.remove();
    });
    
    messageElement.find('.dice-formula').remove();
    messageElement.find('.dice-total').remove();
    messageElement.find('.dice').not('.wod-initiative-card *').not('.wod-initiative-roll *').each(function() {
        if (!$(this).closest('.wod-initiative-card').length && !$(this).closest('.wod-initiative-roll').length) {
            $(this).remove();
        }
    });
    messageElement.find('.dice-formula-part').remove();
    messageElement.find('.dice-rolls').remove();
    messageElement.find('.dice-tooltip').remove();
    
    // Remove any elements with dice-related classes (be very specific)
    messageElement.find('[class*="dice-roll"]').not('.wod-initiative-card').not('.wod-initiative-card *').not('.wod-initiative-roll').not('.wod-initiative-roll *').each(function() {
        $(this).remove();
    });
    messageElement.find('[class*="dice-result"]').not('.wod-initiative-card').not('.wod-initiative-card *').not('.wod-initiative-roll').not('.wod-initiative-roll *').remove();
    messageElement.find('[class*="dice-formula"]').not('.wod-initiative-card').not('.wod-initiative-card *').not('.wod-initiative-roll').not('.wod-initiative-roll *').remove();
    
    // Get message content container
    const messageContent = messageElement.find('.message-content');
    if (messageContent.length > 0) {
        // Remove ALL direct children that are dice-related or just numbers
        messageContent.children().each(function() {
            const $child = $(this);
            const childClasses = this.className || '';
            
            // Keep our custom breakdown and message header
            if ($child.hasClass('wod-initiative-card') || $child.hasClass('wod-initiative-roll') || $child.hasClass('message-header')) {
                return;
            }
            
            // Remove if it has ANY dice-related classes
            if (childClasses.includes('dice') || 
                childClasses.includes('dice-roll') ||
                childClasses.includes('dice-result') ||
                $child.find('.dice').length > 0 ||
                $child.find('.dice-roll').length > 0) {
                $child.remove();
                return;
            }
            
            // Remove if it's just a number
            const text = $child.text().trim();
            if (/^\d+$/.test(text) && $child.children().length === 0) {
                $child.remove();
            }
        });
        
        // Also check for text nodes with just numbers
        messageContent.contents().each(function() {
            if (this.nodeType === 3) { // Text node
                const text = $(this).text().trim();
                if (/^\d+$/.test(text)) {
                    $(this).remove();
                }
            }
        });
    }
    
    // Also check the entire message for any remaining dice elements
    messageElement.find('*').each(function() {
        const $el = $(this);
        const classes = this.className || '';
        const text = $el.text().trim();
        
        // Skip if it's part of our custom breakdown
        if ($el.closest('.wod-initiative-card').length || $el.closest('.wod-initiative-roll').length) return;
        
        // Remove if it has dice-related classes
        if (classes.includes('dice')) {
            $el.remove();
            return;
        }
        
        // Remove if it's a simple div/span with just a number (likely the roll result)
        if (($el.is('div') || $el.is('span')) && 
            /^\d+$/.test(text) && 
            $el.children().length === 0) {
            $el.remove();
        }
    });
}

// Hook to clean up DOM after chat message is rendered (using new API)
Hooks.on("renderChatMessageHTML", (message, html, data) => {
    // Convert HTMLElement to jQuery for easier manipulation
    const $html = $(html);
    
    // Check if this message has our custom initiative breakdown
    const initiativeRoll = $html.find('.wod-initiative-card, .wod-initiative-roll');
    if (initiativeRoll.length > 0) {
        // Use native DOM manipulation for more reliable removal
        const diceRollElements = html.querySelectorAll('.dice-roll');
        diceRollElements.forEach((el) => {
            // Make sure it's not part of our custom breakdown
            if (!el.closest('.wod-initiative-card') && !el.closest('.wod-initiative-roll')) {
                el.remove();
            }
        });
        
        // Now use jQuery for the rest
        cleanupInitiativeRollDisplay($html);
        
        // Set up a single delayed cleanup and MutationObserver
        const messageElement = html;
        if (messageElement) {
            // Single delayed cleanup after a short delay (for elements added by Dice So Nice, etc.)
            const cleanupTimeout = setTimeout(() => {
                const diceRollElements = html.querySelectorAll('.dice-roll');
                diceRollElements.forEach((el) => {
                    if (!el.closest('.wod-initiative-card') && !el.closest('.wod-initiative-roll')) {
                        el.remove();
                    }
                });
                cleanupInitiativeRollDisplay($html);
            }, 300);
            
            // MutationObserver to catch elements added dynamically
            let observerActive = true;
            const observer = new MutationObserver((mutations) => {
                if (!observerActive) return;
                
                let shouldCleanup = false;
                mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { // Element node
                                if (node.classList?.contains('dice') || 
                                    node.classList?.contains('dice-roll') || 
                                    node.classList?.contains('dice-result') ||
                                    node.querySelector('.dice') ||
                                    node.querySelector('.dice-roll')) {
                                    shouldCleanup = true;
                                }
                            }
                        });
                    }
                });
                
                if (shouldCleanup) {
                    const diceRollElements = html.querySelectorAll('.dice-roll');
                    diceRollElements.forEach((el) => {
                        if (!el.closest('.wod-initiative-card') && !el.closest('.wod-initiative-roll')) {
                            el.remove();
                        }
                    });
                    cleanupInitiativeRollDisplay($html);
                }
            });
            
            observer.observe(messageElement, {
                childList: true,
                subtree: true
            });
            
            // Clean up observer and timeout after a delay
            setTimeout(() => {
                observerActive = false;
                observer.disconnect();
                clearTimeout(cleanupTimeout);
            }, 2000);
        }
    }
});

// Legacy hook for backwards compatibility (will be removed in Foundry v15)
// Note: This hook is deprecated but Foundry still calls it
// We do nothing here to avoid double-processing - renderChatMessageHTML handles everything
Hooks.on("renderChatMessage", (message, html, data) => {
    // Intentionally empty - renderChatMessageHTML does all the work
    // Calling it here would cause double-processing
});
