import { MortalSheet } from "./module/actor/template/mortal-sheet.js";
import { WodActor } from "./module/actor/data/wod-actor.js";

Hooks.once("init", async function() {
    console.log("WoD | Initializing World of Darkness System");
    
    // Register Handlebars helper
    Handlebars.registerHelper('times', function(n, block) {
        let accum = '';
        for(let i = 0; i < n; ++i) {
            block.data.index = i;
            accum += block.fn(i);
        }
        return accum;
    });

    // Register Actor Classes
    CONFIG.Actor.documentClass = WodActor;
    
    // Register Actor Sheets
    Actors.registerSheet("wodsystem", MortalSheet, {
        types: ["Mortal"],
        makeDefault: true
    });
});
