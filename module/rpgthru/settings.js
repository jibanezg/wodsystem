export class RpgThruSettings {
    static init() {
        // Register RPGThru settings
        game.settings.register("wodsystem", "rpgthruConnected", {
            name: "RPGThru Connected",
            hint: "Whether the user is connected to DriveThruRPG",
            scope: "world",
            config: false,
            type: Boolean,
            default: false
        });

        game.settings.register("wodsystem", "rpgthruLibrary", {
            name: "RPGThru Library",
            hint: "User's DriveThruRPG library",
            scope: "world",
            config: false,
            type: Array,
            default: []
        });

        // Client-scoped API key (persists per user)
        game.settings.register("wodsystem", "rpgthruApiKey", {
            name: "DriveThruRPG API Key",
            hint: "Your personal API key for DriveThruRPG integration. Get this from your DriveThruRPG account settings.",
            scope: "client",
            config: true,
            type: String,
            default: "",
            restricted: false
        });

        // World-scoped API key (for GMs to set default)
        game.settings.register("wodsystem", "rpgthruDefaultApiKey", {
            name: "Default DriveThruRPG API Key",
            hint: "Default API key for DriveThruRPG integration (GM only)",
            scope: "world",
            config: true,
            type: String,
            default: "",
            restricted: true
        });
    }

    /**
     * Get the API key (prefers client setting, falls back to world default)
     */
    static getApiKey() {
        const clientKey = game.settings.get("wodsystem", "rpgthruApiKey");
        const worldKey = game.settings.get("wodsystem", "rpgthruDefaultApiKey");
        return clientKey || worldKey || "";
    }

    /**
     * Set the API key in client settings
     */
    static setApiKey(apiKey) {
        return game.settings.set("wodsystem", "rpgthruApiKey", apiKey);
    }

    /**
     * Check if user has an API key set
     */
    static hasApiKey() {
        return !!this.getApiKey();
    }
} 