/**
 * Migration helper to convert legacy system.equipment to Foundry Items
 */
export class EquipmentMigration {
    /**
     * Migrate all equipment from system.equipment to Items for an actor
     * @param {Actor} actor - The actor to migrate
     * @returns {Promise<Object>} Migration result with counts
     */
    static async migrateActorEquipment(actor) {
        if (!actor || !actor.system.equipment) {
            return { weapons: 0, armor: 0, gear: 0, errors: [] };
        }
        
        const results = {
            weapons: 0,
            armor: 0,
            gear: 0,
            errors: []
        };
        
        // Migrate weapons
        const weapons = Array.isArray(actor.system.equipment.weapons)
            ? actor.system.equipment.weapons
            : Object.values(actor.system.equipment.weapons || {});
        
        for (const weapon of weapons) {
            try {
                const itemData = {
                    name: weapon.name || "Unnamed Weapon",
                    type: "weapon",
                    system: {
                        equipped: weapon.equipped || false,
                        subtype: weapon.subtype || "melee",
                        damage: weapon.damage || "1",
                        difficulty: weapon.difficulty || 6,
                        range: weapon.range || "-",
                        rate: weapon.rate || "1",
                        clip: weapon.clip || "-",
                        concealment: weapon.concealment || "P",
                        description: weapon.description || "",
                        grantsEffects: weapon.grantsEffects || []
                    }
                };
                
                await Item.create(itemData, { parent: actor });
                results.weapons++;
            } catch (error) {
                console.error(`Error migrating weapon ${weapon.name || weapon.id}:`, error);
                results.errors.push(`Weapon ${weapon.name || weapon.id}: ${error.message}`);
            }
        }
        
        // Migrate armor
        const armor = Array.isArray(actor.system.equipment.armor)
            ? actor.system.equipment.armor
            : Object.values(actor.system.equipment.armor || {});
        
        for (const armorPiece of armor) {
            try {
                const itemData = {
                    name: armorPiece.name || "Unnamed Armor",
                    type: "armor",
                    system: {
                        equipped: armorPiece.equipped || false,
                        rating: armorPiece.rating || 1,
                        penalty: armorPiece.penalty || 0,
                        description: armorPiece.description || "",
                        grantsEffects: armorPiece.grantsEffects || []
                    }
                };
                
                await Item.create(itemData, { parent: actor });
                results.armor++;
            } catch (error) {
                console.error(`Error migrating armor ${armorPiece.name || armorPiece.id}:`, error);
                results.errors.push(`Armor ${armorPiece.name || armorPiece.id}: ${error.message}`);
            }
        }
        
        // Migrate gear
        const gear = Array.isArray(actor.system.equipment.gear)
            ? actor.system.equipment.gear
            : Object.values(actor.system.equipment.gear || {});
        
        for (const gearItem of gear) {
            try {
                const itemData = {
                    name: gearItem.name || "Unnamed Gear",
                    type: "gear",
                    system: {
                        quantity: gearItem.quantity || 1,
                        weight: gearItem.weight || "",
                        description: gearItem.description || ""
                    }
                };
                
                await Item.create(itemData, { parent: actor });
                results.gear++;
            } catch (error) {
                console.error(`Error migrating gear ${gearItem.name || gearItem.id}:`, error);
                results.errors.push(`Gear ${gearItem.name || gearItem.id}: ${error.message}`);
            }
        }
        
        // Clear legacy equipment data after successful migration
        if (results.weapons > 0 || results.armor > 0 || results.gear > 0) {
            await actor.update({
                "system.equipment.weapons": [],
                "system.equipment.armor": [],
                "system.equipment.gear": []
            });
        }
        
        return results;
    }
    
    /**
     * Migrate equipment for all actors in the world
     * @returns {Promise<Object>} Migration results for all actors
     */
    static async migrateAllActors() {
        const actors = game.actors.filter(a => a.type === "Mortal" || a.type === "Technocrat");
        const allResults = {
            totalActors: actors.length,
            totalWeapons: 0,
            totalArmor: 0,
            totalGear: 0,
            errors: []
        };
        
        for (const actor of actors) {
            const result = await this.migrateActorEquipment(actor);
            allResults.totalWeapons += result.weapons;
            allResults.totalArmor += result.armor;
            allResults.totalGear += result.gear;
            allResults.errors.push(...result.errors.map(e => `${actor.name}: ${e}`));
        }
        
        return allResults;
    }
}
