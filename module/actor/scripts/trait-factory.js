import { WodActor } from "../data/wod-actor.js";

export class TraitFactory {
    constructor() {
        this.templateData = null;
    }

    async loadTemplateData() {
        if (!this.templateData) {
            const response = await fetch("systems/wodsystem/template.json");
            this.templateData = await response.json();
        }
        return this.templateData;
    }

    _deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    _getCreatureTraits(actorType) {
        const creatureConfig = this.templateData.Actor.creatureTypes[actorType];
        if (!creatureConfig) {
            throw new Error(`No creature type configuration found for: ${actorType}`);
        }

        let traits = { ...this.templateData.Actor.baseTraits };

        if (creatureConfig.traits.add) {
            traits = this._deepMerge(traits, creatureConfig.traits.add);
        }

        if (creatureConfig.traits.replace) {
            traits = this._deepMerge(traits, creatureConfig.traits.replace);
        }

        return traits;
    }

    async createAllTraits(actor) {
        await this.loadTemplateData();
        
        if (!actor.system) {
            actor.system = {};
        }

        const traits = this._getCreatureTraits(actor.type);
        
        for (const [category, value] of Object.entries(traits)) {
            actor.system[category] = { ...value };
        }
        
        await actor.update({ system: actor.system });
    }

    async createTraits(actor, category, properties) {
        if (!actor.system) {
            actor.system = {};
        }
        actor.system[category] = { ...properties };
        return actor.system[category];
    }
} 