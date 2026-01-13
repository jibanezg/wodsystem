/**
 * Base Item class for WoD System
 */
export class WodItem extends Item {
    /** @override */
    static get types() {
        // Return the valid Item types for this system
        // These must match the types defined in template.json
        return {
            "Trait": "Trait",
            "weapon": "Weapon",
            "armor": "Armor",
            "gear": "Gear"
        };
    }

    /** @override */
    prepareData() {
        super.prepareData();
    }

    /** @override */
    prepareDerivedData() {
        super.prepareDerivedData();
    }
}

/**
 * Weapon Item class
 */
export class WodWeapon extends WodItem {
    /** @override */
    prepareDerivedData() {
        super.prepareDerivedData();
    }
}

/**
 * Armor Item class
 */
export class WodArmor extends WodItem {
    /** @override */
    prepareDerivedData() {
        super.prepareDerivedData();
    }
}

/**
 * Gear Item class
 */
export class WodGear extends WodItem {
    /** @override */
    prepareDerivedData() {
        super.prepareDerivedData();
    }
}
