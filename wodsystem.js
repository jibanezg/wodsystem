import { WodActor } from "./module/actor/data/wod-actor.js";
import { WodActorSheet } from "./module/actor/template/wod-actor-sheet.js";
import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { TechnocratSheet } from "./module/actor/template/technocrat-sheet.js";
import { MageSheet } from "./module/actor/template/mage-sheet.js";
import { SpiritSheet } from "./module/actor/template/spirit-sheet.js";
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
        "systems/wodsystem/templates/actor/partials/mage-header.html",
        "systems/wodsystem/templates/actor/partials/spirit-header.html",
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
    
    Actors.registerSheet("wodsystem", MageSheet, {
        types: ["Mage"],
        makeDefault: true
    });
    
    Actors.registerSheet("wodsystem", SpiritSheet, {
        types: ["Spirit"],
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

// Store roll data for each combatant so we can use it when the chat message is created
const initiativeRollData = new Map();

console.log("🎲 [Initiative] Registering rollInitiative hook");

// Hook to intercept Combat Tracker initiative rolls
Hooks.on("rollInitiative", async (combat, combatant, roll) => {
    console.log("🎲 [Initiative] rollInitiative hook triggered", {
        combatId: combat?.id,
        combatantId: combatant?.id,
        actorId: combatant?.actor?.id,
        actorName: combatant?.actor?.name,
        rollExists: !!roll,
        rollFormula: roll?.formula,
        rollTotal: roll?.total,
        rollEvaluated: roll?._evaluated,
        rollTerms: roll?.terms?.length,
        rollDice: roll?.dice?.length
    });
    
    // This hook fires when initiative is rolled from the Combat Tracker
    const actor = combatant.actor;
    if (!actor || typeof actor.getInitiative !== "function") {
        console.log("🎲 [Initiative] Not a WoD actor, skipping");
        return; // Not a WoD actor
    }
    
    // Ensure roll is evaluated
    if (roll && !roll._evaluated) {
        console.log("🎲 [Initiative] Roll not evaluated, evaluating now...");
        await roll.evaluate();
        console.log("🎲 [Initiative] Roll evaluated", {
            total: roll.total,
            formula: roll.formula
        });
    }
    
    // Get individual components for breakdown
    const dexterity = Number(actor._findAttributeValue("Dexterity")) || 0;
    const wits = Number(actor._findAttributeValue("Wits")) || 0;
    const bonus = Number(actor.system.combat?.initiativeBonus) || 0;
    const initiativeValue = actor.getInitiative();
    
    console.log("🎲 [Initiative] Actor attributes", {
        actorName: actor.name,
        dexterity,
        wits,
        bonus,
        initiativeValue,
        calculatedBase: dexterity + wits + bonus
    });
    
    // Get the d10 result from the roll - try multiple ways to access it
    let d10Result = 0;
    const rollTotal = roll?.total ?? 0;
    
    console.log("🎲 [Initiative] Roll structure", {
        rollTotal,
        hasTerms: !!roll?.terms,
        termsLength: roll?.terms?.length,
        hasDice: !!roll?.dice,
        diceLength: roll?.dice?.length,
        terms: roll?.terms,
        dice: roll?.dice
    });
    
    if (roll) {
        // Try accessing through roll.terms (newer Foundry API)
        if (roll.terms && roll.terms.length > 0) {
            console.log("🎲 [Initiative] Trying roll.terms approach", {
                termsCount: roll.terms.length,
                terms: roll.terms.map(t => ({
                    type: t.constructor?.name,
                    faces: t.faces,
                    number: t.number,
                    results: t.results
                }))
            });
            
            const d10Term = roll.terms.find(t => t.faces === 10 || (t.number === 1 && t.faces === 10));
            if (d10Term) {
                console.log("🎲 [Initiative] Found d10 term", {
                    term: d10Term,
                    results: d10Term.results,
                    firstResult: d10Term.results?.[0]
                });
                
                if (d10Term.results && d10Term.results.length > 0) {
                    d10Result = d10Term.results[0].result ?? d10Term.results[0].value ?? 0;
                    console.log("🎲 [Initiative] Extracted d10Result from terms", { d10Result });
                }
            }
        }
        
        // Fallback: try roll.dice (older API)
        if (d10Result === 0 && roll.dice && roll.dice.length > 0) {
            console.log("🎲 [Initiative] Trying roll.dice approach", {
                diceCount: roll.dice.length,
                dice: roll.dice.map(d => ({
                    faces: d.faces,
                    results: d.results
                }))
            });
            
            const d10Die = roll.dice.find(d => d.faces === 10) || roll.dice[0];
            if (d10Die) {
                console.log("🎲 [Initiative] Found d10 die", {
                    die: d10Die,
                    results: d10Die.results,
                    firstResult: d10Die.results?.[0]
                });
                
                if (d10Die.results && d10Die.results.length > 0) {
                    d10Result = d10Die.results[0].result ?? d10Die.results[0].value ?? 0;
                    console.log("🎲 [Initiative] Extracted d10Result from dice", { d10Result });
                }
            }
        }
        
        // Last resort: calculate from total
        if (d10Result === 0 && rollTotal > 0) {
            d10Result = rollTotal - initiativeValue;
            console.log("🎲 [Initiative] Calculated d10Result from total", {
                rollTotal,
                initiativeValue,
                calculated: d10Result
            });
        }
    }
    
    // Ensure rollTotal includes the d10 result
    // rollTotal should be d10Result + initiativeValue
    const expectedTotal = d10Result + initiativeValue;
    if (rollTotal !== expectedTotal) {
        console.log("🎲 [Initiative] Correcting rollTotal to include d10", {
            oldTotal: rollTotal,
            d10Result,
            initiativeValue,
            newTotal: expectedTotal
        });
        rollTotal = expectedTotal;
    }
    
    console.log("🎲 [Initiative] Final values", {
        d10Result,
        rollTotal,
        initiativeValue,
        expectedTotal: d10Result + initiativeValue,
        totalIncludesD10: rollTotal === (d10Result + initiativeValue)
    });
    
    // Store the roll data for this combatant so we can use it in createChatMessage
    initiativeRollData.set(combatant.id, {
        d10Result,
        rollTotal,  // This is now guaranteed to be d10Result + initiativeValue
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
    
    console.log("🎲 [Initiative] Breakdown string", { breakdown });
    console.log("🎲 [Initiative] Stored roll data", { combatantId: combatant.id, data: initiativeRollData.get(combatant.id) });
    
    // Wait a moment for the chat message to be created, then update it
    setTimeout(async () => {
        console.log("🎲 [Initiative] Searching for chat message...");
        // Find the most recent chat message from this actor
        const messages = game.messages.filter(m => {
            const speaker = m.speaker;
            return speaker && speaker.actor === actor.id && 
                   (m.flavor?.toLowerCase().includes("initiative") || 
                    m.content?.toLowerCase().includes("initiative") ||
                    (m.roll && m.roll.formula && m.roll.formula.includes("1d10")));
        });
        
        console.log("🎲 [Initiative] Found messages", {
            totalMessages: game.messages.size,
            matchingMessages: messages.length,
            messages: messages.map(m => ({
                id: m.id,
                flavor: m.flavor,
                content: m.content,
                rollFormula: m.roll?.formula
            }))
        });
        
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            console.log("🎲 [Initiative] Updating message", {
                messageId: lastMessage.id,
                breakdown
            });
            
            await lastMessage.update({
                content: "", // Clear default content to hide Foundry's roll display
                flavor: `<div class="wod-initiative-roll">
                    <strong>Initiative Roll</strong><br/>
                    <div class="initiative-breakdown">${breakdown}</div>
                </div>`
            });
            
            console.log("🎲 [Initiative] Message updated successfully");
        } else {
            console.warn("🎲 [Initiative] No matching messages found to update");
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
                console.log("💬 [Initiative] preCreateChatMessage: Preventing default roll display");
                
                // Store the roll data in flags so we can access it later
                messageData.flags = messageData.flags || {};
                messageData.flags.wodsystem = messageData.flags.wodsystem || {};
                messageData.flags.wodsystem.isInitiativeRoll = true;
                messageData.flags.wodsystem.initiativeRollData = {
                    formula: roll?.formula,
                    total: roll?.total
                };
                
                // Remove the roll from messageData to prevent Foundry from displaying it
                // We'll recreate our own display in createChatMessage
                delete messageData.roll;
                
                // Set initial content to our custom breakdown structure (will be updated in createChatMessage)
                // This prevents Foundry from generating default roll display
                messageData.content = `<div class="wod-initiative-roll"><div class="initiative-breakdown">Calculating...</div></div>`;
            }
        }
    }
    
    return true;
});

// Fallback: Hook to intercept chat messages as they're created
Hooks.on("createChatMessage", async (message, options, userId) => {
    console.log("💬 [Initiative] createChatMessage hook triggered", {
        messageId: message.id,
        flavor: message.flavor,
        content: message.content?.substring(0, 100),
        hasRoll: !!message.roll,
        rollFormula: message.roll?.formula,
        rollTotal: message.roll?.total,
        speaker: message.speaker
    });
    
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
    
    console.log("💬 [Initiative] Detection", {
        hasInitiativeKeyword,
        hasInitiativeFormula,
        isInitiative: hasInitiativeKeyword || hasInitiativeFormula
    });
    
    if (!hasInitiativeFormula && !hasInitiativeKeyword) {
        console.log("💬 [Initiative] Not an initiative roll, skipping");
        return; // Not an initiative roll
    }
    
    // Try to find the actor from the speaker
    const speaker = message.speaker;
    if (!speaker || !speaker.actor) {
        console.log("💬 [Initiative] No speaker or actor, skipping");
        return; // No actor
    }
    
    const actor = game.actors.get(speaker.actor);
    if (!actor || typeof actor.getInitiative !== "function") {
        console.log("💬 [Initiative] Not a WoD actor, skipping", {
            actorExists: !!actor,
            hasGetInitiative: typeof actor?.getInitiative === "function"
        });
        return; // Not a WoD actor
    }
    
    console.log("💬 [Initiative] Processing for actor", { actorName: actor.name });
    
    // Try to find stored roll data from rollInitiative hook
    let rollData = null;
    let combatant = null;
    if (game.combat) {
        combatant = game.combat.combatants.find(c => c.actorId === actor.id);
        console.log("💬 [Initiative] Looking for combatant", {
            hasCombat: !!game.combat,
            combatantFound: !!combatant,
            combatantId: combatant?.id,
            combatantInitiative: combatant?.initiative,
            storedDataKeys: Array.from(initiativeRollData.keys()),
            hasStoredData: combatant ? initiativeRollData.has(combatant.id) : false
        });
        
        if (combatant && initiativeRollData.has(combatant.id)) {
            rollData = initiativeRollData.get(combatant.id);
            console.log("💬 [Initiative] Found stored roll data", { combatantId: combatant.id, rollData });
        } else if (combatant && combatant.initiative !== null && combatant.initiative !== undefined) {
            // Try to get roll data from combatant's initiative value
            const baseInitiative = actor.getInitiative();
            console.log("💬 [Initiative] No stored data, but combatant has initiative value", {
                combatantInitiative: combatant.initiative,
                baseInitiative: baseInitiative,
                calculatedD10: combatant.initiative - baseInitiative
            });
            
            // Calculate d10Result from combatant.initiative and actor's base
            // combatant.initiative should be the total (d10 + base)
            const calculatedD10 = combatant.initiative - baseInitiative;
            
            // If the calculation makes sense (d10 between 1-10), use it
            // Otherwise, assume combatant.initiative IS the d10 result (some systems do this)
            let d10Result, rollTotal;
            
            if (calculatedD10 >= 1 && calculatedD10 <= 10) {
                // Normal case: combatant.initiative is the total
                d10Result = calculatedD10;
                rollTotal = combatant.initiative;
                console.log("💬 [Initiative] Using combatant.initiative as total", { d10Result, rollTotal });
            } else if (combatant.initiative >= 1 && combatant.initiative <= 10) {
                // Alternative: combatant.initiative is just the d10
                d10Result = combatant.initiative;
                rollTotal = d10Result + baseInitiative;
                console.log("💬 [Initiative] Using combatant.initiative as d10 result", { d10Result, rollTotal });
            } else {
                // Fallback: use combatant.initiative as total anyway
                d10Result = Math.max(1, Math.min(10, calculatedD10));
                rollTotal = combatant.initiative;
                console.log("💬 [Initiative] Using fallback calculation", { d10Result, rollTotal });
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
            console.log("💬 [Initiative] Calculated roll data from combatant initiative", { rollData });
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
        console.log("💬 [Initiative] Using stored roll data", { d10Result, rollTotal, initiativeValue });
    } else {
        // Fallback: calculate from actor and message roll
        dexterity = Number(actor._findAttributeValue("Dexterity")) || 0;
        wits = Number(actor._findAttributeValue("Wits")) || 0;
        bonus = Number(actor.system.combat?.initiativeBonus) || 0;
        initiativeValue = actor.getInitiative();
        rollTotal = roll?.total ?? 0;
        
        console.log("💬 [Initiative] Actor attributes", {
            actorName: actor.name,
            dexterity,
            wits,
            bonus,
            initiativeValue
        });
        
        // Get the d10 result from the roll - try multiple ways to access it
        d10Result = 0;
        
        console.log("💬 [Initiative] Roll structure", {
            rollTotal,
            hasTerms: !!roll?.terms,
            termsLength: roll?.terms?.length,
            hasDice: !!roll?.dice,
            diceLength: roll?.dice?.length
        });
        
        if (roll) {
            // Try accessing through roll.terms (newer Foundry API)
            if (roll.terms && roll.terms.length > 0) {
                const d10Term = roll.terms.find(t => t.faces === 10 || (t.number === 1 && t.faces === 10));
                if (d10Term && d10Term.results && d10Term.results.length > 0) {
                    d10Result = d10Term.results[0].result ?? d10Term.results[0].value ?? 0;
                    console.log("💬 [Initiative] Extracted d10Result from terms", { d10Result });
                }
            }
            
            // Fallback: try roll.dice (older API)
            if (d10Result === 0 && roll.dice && roll.dice.length > 0) {
                const d10Die = roll.dice.find(d => d.faces === 10) || roll.dice[0];
                if (d10Die && d10Die.results && d10Die.results.length > 0) {
                    d10Result = d10Die.results[0].result ?? d10Die.results[0].value ?? 0;
                    console.log("💬 [Initiative] Extracted d10Result from dice", { d10Result });
                }
            }
            
            // Last resort: calculate from total
            if (d10Result === 0 && rollTotal > 0) {
                d10Result = rollTotal - initiativeValue;
                console.log("💬 [Initiative] Calculated d10Result from total", {
                    rollTotal,
                    initiativeValue,
                    calculated: d10Result
                });
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
                console.log("💬 [Initiative] Calculated d10Result from rollTotal", {
                    rollTotal,
                    initiativeValue,
                    calculatedD10: d10Result
                });
            } else {
                console.warn("💬 [Initiative] Invalid d10Result calculation", {
                    rollTotal,
                    initiativeValue,
                    calculatedD10,
                    d10Result
                });
            }
        } else {
            console.warn("💬 [Initiative] Cannot calculate d10Result", {
                rollTotal,
                initiativeValue,
                d10Result
            });
        }
    }
    
    // Ensure rollTotal includes the d10 result
    // rollTotal should be d10Result + initiativeValue
    const expectedTotal = d10Result + initiativeValue;
    if (rollTotal !== expectedTotal) {
        rollTotal = expectedTotal;
        console.log("💬 [Initiative] Corrected rollTotal to include d10", {
            oldTotal: rollTotal - d10Result,
            d10Result,
            initiativeValue,
            newTotal: rollTotal
        });
    }
    
    // Final validation: d10Result MUST be between 1 and 10
    if (d10Result < 1 || d10Result > 10) {
        console.error("💬 [Initiative] Invalid d10Result after all calculations", {
            d10Result,
            rollTotal,
            initiativeValue
        });
        // Force a valid value - calculate from total
        if (rollTotal > initiativeValue) {
            d10Result = Math.max(1, Math.min(10, rollTotal - initiativeValue));
            console.log("💬 [Initiative] Forced d10Result to valid value", { d10Result });
        }
    }
    
    console.log("💬 [Initiative] Final values BEFORE HTML generation", {
        d10Result,
        rollTotal,
        initiativeValue,
        expectedTotal: d10Result + initiativeValue,
        calculation: `${d10Result} (d10) + ${initiativeValue} (base) = ${rollTotal}`,
        d10ResultValid: d10Result >= 1 && d10Result <= 10
    });
    
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
    
    // Debug: Check if d10Result is in the HTML
    const d10ResultInHTML = htmlContent.includes(`(${d10Result})`);
    console.log("💬 [Initiative] Updating message with breakdown", { 
        d10Result,
        d10ResultInHTML,
        breakdown,
        htmlContent: htmlContent.substring(0, 500),
        messageId: message.id,
        currentContent: message.content?.substring(0, 100),
        hasDiceResultInBreakdown: breakdown.includes(`(${d10Result})`)
    });
    
    // Update the message with our detailed breakdown
    // Set content directly and remove roll to prevent Foundry from regenerating the roll display
    try {
        await message.update({
            content: htmlContent,
            roll: null  // Explicitly remove roll to prevent regeneration
        });
        
        console.log("💬 [Initiative] Message update completed", {
            messageId: message.id,
            newContent: message.content?.substring(0, 200),
            hasRoll: !!message.roll
        });
    } catch (error) {
        console.error("💬 [Initiative] Error updating message", error);
    }
    
    // Also delete the roll from the message object directly to be safe
    if (message.roll) {
        delete message.roll;
    }
    
    console.log("💬 [Initiative] Message updated successfully");
    
    // Update combatant initiative to the correct total (d10Result + initiativeValue)
    // The total MUST include the d10 roll result
    if (rollData && game.combat && combatant) {
        const currentInitiative = combatant.initiative;
        // Ensure correctTotal includes the d10 result
        const correctTotal = rollData.d10Result + rollData.initiativeValue;
        
        console.log("💬 [Initiative] Checking combatant initiative", {
            currentInitiative,
            correctTotal,
            d10Result: rollData.d10Result,
            initiativeValue: rollData.initiativeValue,
            storedRollTotal: rollData.rollTotal,
            needsUpdate: currentInitiative !== correctTotal
        });
        
        if (currentInitiative !== correctTotal) {
            console.log("💬 [Initiative] Updating combatant initiative", {
                from: currentInitiative,
                to: correctTotal,
                calculation: `${rollData.d10Result} (d10) + ${rollData.initiativeValue} (base) = ${correctTotal}`
            });
            
            await game.combat.setInitiative(combatant.id, correctTotal);
            console.log("💬 [Initiative] Combatant initiative updated successfully");
        }
        
        // Clean up stored data after a delay
        setTimeout(() => {
            initiativeRollData.delete(combatant.id);
            console.log("💬 [Initiative] Cleaned up stored roll data", { combatantId: combatant.id });
        }, 1000);
    }
});

// Function to clean up initiative roll display
function cleanupInitiativeRollDisplay(messageElement) {
    if (!messageElement || !messageElement.length) return;
    
    const initiativeRoll = messageElement.find('.wod-initiative-card, .wod-initiative-roll');
    if (initiativeRoll.length === 0) return;
    
    const beforeCounts = {
        diceRoll: messageElement.find('.dice-roll').length,
        diceResult: messageElement.find('.dice-result').length,
        dice: messageElement.find('.dice').length
    };
    
    // Only log if there are actually elements to remove
    if (beforeCounts.diceRoll > 0 || beforeCounts.diceResult > 0 || beforeCounts.dice > 0) {
        console.log("🧹 [Initiative] Cleaning up default roll display from DOM", {
            beforeCleanup: beforeCounts
        });
    }
    
    // Remove Foundry's default roll display elements - be very aggressive
    // Target the main dice-roll container first (this is the parent of all dice elements)
    const diceRollContainer = messageElement.find('.dice-roll');
    if (diceRollContainer.length > 0) {
        console.log("🧹 [Initiative] Removing dice-roll container", {
            count: diceRollContainer.length,
            classes: diceRollContainer.attr('class'),
            html: diceRollContainer.html()?.substring(0, 150)
        });
        diceRollContainer.remove();
    }
    
    // Remove all dice-related elements individually
    // CRITICAL: Only remove Foundry's dice-result, NOT our custom one inside .wod-initiative-card
    messageElement.find('.dice-result').each(function() {
        const $el = $(this);
        // Skip if it's inside our custom initiative card
        if ($el.closest('.wod-initiative-card').length || $el.closest('.wod-initiative-roll').length) {
            console.log("🧹 [Initiative] SKIPPING dice-result (it's our custom element)", { 
                classes: this.className,
                parent: $el.parent().attr('class')
            });
            return; // Skip this element
        }
        console.log("🧹 [Initiative] Removing dice-result (Foundry's default)", { classes: this.className });
        $el.remove();
    });
    
    messageElement.find('.dice-formula').remove();
    messageElement.find('.dice-total').remove();
    messageElement.find('.dice').not('.wod-initiative-card *').not('.wod-initiative-roll *').each(function() {
        if (!$(this).closest('.wod-initiative-card').length && !$(this).closest('.wod-initiative-roll').length) {
            console.log("🧹 [Initiative] Removing dice element", { classes: this.className });
            $(this).remove();
        }
    });
    messageElement.find('.dice-formula-part').remove();
    messageElement.find('.dice-rolls').remove();
    messageElement.find('.dice-tooltip').remove();
    
    // Remove any elements with dice-related classes (be very specific)
    messageElement.find('[class*="dice-roll"]').not('.wod-initiative-card').not('.wod-initiative-card *').not('.wod-initiative-roll').not('.wod-initiative-roll *').each(function() {
        console.log("🧹 [Initiative] Removing element with dice-roll class", { classes: this.className });
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
                console.log("🧹 [Initiative] Removing dice element from message-content", {
                    tag: this.tagName,
                    classes: childClasses,
                    text: $child.text().trim().substring(0, 50)
                });
                $child.remove();
                return;
            }
            
            // Remove if it's just a number
            const text = $child.text().trim();
            if (/^\d+$/.test(text) && $child.children().length === 0) {
                console.log("🧹 [Initiative] Removing number-only element from message-content", {
                    tag: this.tagName,
                    text
                });
                $child.remove();
            }
        });
        
        // Also check for text nodes with just numbers
        messageContent.contents().each(function() {
            if (this.nodeType === 3) { // Text node
                const text = $(this).text().trim();
                if (/^\d+$/.test(text)) {
                    console.log("🧹 [Initiative] Removing text node with number", { text });
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
            console.log("🧹 [Initiative] Removing dice element", { classes, text: text.substring(0, 50) });
            $el.remove();
            return;
        }
        
        // Remove if it's a simple div/span with just a number (likely the roll result)
        if (($el.is('div') || $el.is('span')) && 
            /^\d+$/.test(text) && 
            $el.children().length === 0) {
            console.log("🧹 [Initiative] Removing number-only element", { tag: this.tagName, text });
            $el.remove();
        }
    });
    
    const afterCounts = {
        diceRoll: messageElement.find('.dice-roll').length,
        diceResult: messageElement.find('.dice-result').length,
        dice: messageElement.find('.dice').not('.wod-initiative-card *').not('.wod-initiative-roll *').length
    };
    
    // Only log if there were elements before or if there are still elements after
    if (beforeCounts.diceRoll > 0 || beforeCounts.diceResult > 0 || beforeCounts.dice > 0 ||
        afterCounts.diceRoll > 0 || afterCounts.diceResult > 0 || afterCounts.dice > 0) {
        console.log("🧹 [Initiative] Cleanup complete", {
            before: beforeCounts,
            after: afterCounts
        });
    }
}

// Hook to clean up DOM after chat message is rendered (using new API)
Hooks.on("renderChatMessageHTML", (message, html, data) => {
    // Convert HTMLElement to jQuery for easier manipulation
    const $html = $(html);
    
    // Check if this message has our custom initiative breakdown
    const initiativeRoll = $html.find('.wod-initiative-card, .wod-initiative-roll');
    if (initiativeRoll.length > 0) {
        console.log("🧹 [Initiative] renderChatMessageHTML: Found initiative roll, inspecting HTML structure", {
            messageId: message.id,
            htmlLength: html.innerHTML.length,
            hasDiceRoll: $html.find('.dice-roll').length,
            hasDiceResult: $html.find('.dice-result').length,
            messageContent: $html.find('.message-content').html()?.substring(0, 300)
        });
        
        // Use native DOM manipulation for more reliable removal
        const diceRollElements = html.querySelectorAll('.dice-roll');
        let removedCount = 0;
        diceRollElements.forEach((el) => {
            // Make sure it's not part of our custom breakdown
            if (!el.closest('.wod-initiative-card') && !el.closest('.wod-initiative-roll')) {
                removedCount++;
                el.remove();
            }
        });
        
        if (removedCount > 0) {
            console.log(`🧹 [Initiative] Removed ${removedCount} dice-roll element(s) (native DOM)`);
        }
        
        // Now use jQuery for the rest
        cleanupInitiativeRollDisplay($html);
        
        // Set up a single delayed cleanup and MutationObserver
        const messageElement = html;
        if (messageElement) {
            // Single delayed cleanup after a short delay (for elements added by Dice So Nice, etc.)
            const cleanupTimeout = setTimeout(() => {
                const diceRollElements = html.querySelectorAll('.dice-roll');
                let delayedRemoved = 0;
                diceRollElements.forEach((el) => {
                    if (!el.closest('.wod-initiative-card') && !el.closest('.wod-initiative-roll')) {
                        delayedRemoved++;
                        el.remove();
                    }
                });
                if (delayedRemoved > 0) {
                    console.log(`🧹 [Initiative] Delayed cleanup removed ${delayedRemoved} dice-roll element(s)`);
                    cleanupInitiativeRollDisplay($html);
                }
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
                    let observerRemoved = 0;
                    diceRollElements.forEach((el) => {
                        if (!el.closest('.wod-initiative-card') && !el.closest('.wod-initiative-roll')) {
                            observerRemoved++;
                            el.remove();
                        }
                    });
                    if (observerRemoved > 0) {
                        console.log(`🧹 [Initiative] MutationObserver removed ${observerRemoved} dice-roll element(s)`);
                        cleanupInitiativeRollDisplay($html);
                    }
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
