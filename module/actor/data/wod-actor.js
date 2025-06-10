import { TraitFactory } from "../scripts/trait-factory.js";

export class WodActor extends Actor {
    /** @override */
    prepareData() {
        if (game.actors.invalidDocumentIds.has(this.id)) {
            return
        }

        super.prepareData();
        const actorData = this;
        this._prepareCharacterData(actorData);
    }

    _prepareCharacterData(actorData) {
        let listData = [];
        actorData.listData = listData;
    }

    /** @override */
    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user);
    }

    /** @override */
    async _onCreate(data, options, user) {
        // Create a duplicate of the actor data
        const actorData = foundry.utils.duplicate(this);
        
        // Check if traits need to be created
        if (!actorData.system.isCreated) {
            const factory = new TraitFactory();
            await factory.createAllTraits(this);
            // Update isCreated flag
            await this.update({ "system.isCreated": true });
        }
        
        await super._onCreate(data, options, user);
    }
} 