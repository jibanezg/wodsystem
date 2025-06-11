export class RpgThruApp extends Application {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "rpgthru-app",
            template: "systems/wodsystem/templates/rpgthru/rpgthru-app.html",
            width: 800,
            height: 600,
            resizable: true,
            minimizable: true,
            title: "RPGThru Integration"
        });
    }

    /** @override */
    getData() {
        return {
            connected: this.isConnected(),
            userLibrary: this.getUserLibrary()
        };
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Connect button
        html.find('.connect-btn').on('click', this._onConnect.bind(this));
        
        // Disconnect button
        html.find('.disconnect-btn').on('click', this._onDisconnect.bind(this));
        
        // Open DriveThru button
        html.find('.open-drivethru').on('click', this._openDriveThru.bind(this));
        
        // Refresh library button
        html.find('.refresh-library').on('click', this._refreshLibrary.bind(this));
    }

    /**
     * Check if user is connected to RPGThru
     */
    isConnected() {
        return game.settings.get("wodsystem", "rpgthruConnected") || false;
    }

    /**
     * Get user's library from settings
     */
    getUserLibrary() {
        return game.settings.get("wodsystem", "rpgthruLibrary") || [];
    }

    /**
     * Handle connect button click
     */
    async _onConnect(event) {
        event.preventDefault();
        
        // For now, we'll use a simple approach with iframe
        // In the future, this could integrate with DriveThruRPG API
        this._openDriveThru();
        
        // Mark as connected (in a real implementation, this would verify login)
        await game.settings.set("wodsystem", "rpgthruConnected", true);
        
        // Refresh the app
        this.render(true);
    }

    /**
     * Handle disconnect button click
     */
    async _onDisconnect(event) {
        event.preventDefault();
        
        await game.settings.set("wodsystem", "rpgthruConnected", false);
        await game.settings.set("wodsystem", "rpgthruLibrary", []);
        
        this.render(true);
    }

    /**
     * Open DriveThruRPG in iframe
     */
    _openDriveThru() {
        const iframeWindow = new RpgThruIframeApp();
        iframeWindow.render(true);
    }

    /**
     * Refresh user library
     */
    async _refreshLibrary(event) {
        event.preventDefault();
        
        // In a real implementation, this would fetch from DriveThruRPG API
        // For now, we'll just show a message
        ui.notifications.info("Library refresh functionality would be implemented with DriveThruRPG API integration.");
    }
} 