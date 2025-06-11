export class RpgThruIframeApp extends Application {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "rpgthru-iframe",
            template: "systems/wodsystem/templates/rpgthru/rpgthru-iframe.html",
            width: 1200,
            height: 800,
            resizable: true,
            minimizable: true,
            title: "DriveThruRPG"
        });
    }

    /** @override */
    getData() {
        return {
            drivethruUrl: "https://www.drivethrurpg.com/"
        };
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Handle iframe load events
        const iframe = html.find('iframe')[0];
        if (iframe) {
            iframe.onload = this._onIframeLoad.bind(this);
        }
    }

    /**
     * Handle iframe load event
     */
    _onIframeLoad(event) {
        console.log("DriveThruRPG iframe loaded");
        // You could add logic here to detect login state, etc.
    }
} 