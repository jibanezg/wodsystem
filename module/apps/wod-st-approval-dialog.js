/**
 * ST Approval Dialog for Player-Created Effects
 * Shows when a player tries to use a custom effect in their roll
 */
export class WodStApprovalDialog extends Application {
    constructor(actor, effectIds, options = {}) {
        super(options);
        this.actor = actor;
        this.effectIds = effectIds;
        this.approved = false;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["wod", "dialog", "st-approval"],
            template: "systems/wodsystem/templates/apps/st-approval-dialog.html",
            width: 400,
            height: "auto",
            title: "ST Approval Required",
            resizable: false
        });
    }

    async getData() {
        const data = await super.getData();
        
        // Get effect details
        data.effects = this.effectIds.map(id => {
            const effect = this.actor.effects.get(id);
            return {
                id: effect.id,
                name: effect.name,
                icon: effect.icon,
                modifiers: this._getEffectModifierDisplay(effect)
            };
        });
        
        data.playerName = this.actor.name;
        data.actorName = this.actor.name;
        
        return data;
    }

    /**
     * Get a display string for effect modifiers
     * @private
     */
    _getEffectModifierDisplay(effect) {
        const displays = [];
        
        for (const change of effect.changes) {
            let display = '';
            const value = Number(change.value);
            const sign = value >= 0 ? '+' : '';
            
            switch(change.key) {
                case 'pool':
                    display = `${sign}${value} dice`;
                    break;
                case 'difficulty':
                    display = `${sign}${value} difficulty`;
                    break;
                case 'autoSuccess':
                    display = `+${Math.abs(value)} auto success${Math.abs(value) !== 1 ? 'es' : ''}`;
                    break;
                case 'autoFail':
                    display = `+${Math.abs(value)} auto 1${Math.abs(value) !== 1 ? 's' : ''}`;
                    break;
                default:
                    display = `${sign}${value}`;
            }
            
            displays.push(display);
        }
        
        return displays.join(', ');
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        html.find('.approve-button').click(this._onApprove.bind(this));
        html.find('.deny-button').click(this._onDeny.bind(this));
    }

    async _onApprove(event) {
        event.preventDefault();
        this.approved = true;
        this.close();
    }

    async _onDeny(event) {
        event.preventDefault();
        this.approved = false;
        this.close();
    }

    /**
     * Static method to request approval from ST
     * @param {Actor} actor - The actor making the roll
     * @param {Array<string>} effectIds - Array of effect IDs to approve
     * @returns {Promise<boolean>} True if approved, false if denied
     */
    static async requestApproval(actor, effectIds) {
        // If current user is GM, auto-approve
        if (game.user.isGM) {
            return true;
        }

        // Find the first connected GM
        const gm = game.users.find(u => u.isGM && u.active);
        
        if (!gm) {
            ui.notifications.warn("No Storyteller online to approve effect!");
            return false;
        }

        // Create a promise that will resolve when we get a response
        return new Promise((resolve) => {
            // Send socket request to GM
            game.socket.emit('system.wodsystem', {
                type: 'requestEffectApproval',
                actorId: actor.id,
                effectIds: effectIds,
                playerId: game.user.id
            });

            // Listen for response
            const hookId = Hooks.on('wodEffectApprovalResponse', (data) => {
                if (data.playerId === game.user.id) {
                    Hooks.off('wodEffectApprovalResponse', hookId);
                    resolve(data.approved);
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                Hooks.off('wodEffectApprovalResponse', hookId);
                ui.notifications.warn("ST approval request timed out");
                resolve(false);
            }, 30000);
        });
    }

    /**
     * Show approval dialog to the GM
     * @param {Actor} actor
     * @param {Array<string>} effectIds
     * @param {string} playerId
     */
    static async showApprovalDialog(actor, effectIds, playerId) {
        const dialog = new WodStApprovalDialog(actor, effectIds);
        
        return new Promise((resolve) => {
            dialog.render(true);
            
            // When dialog closes, send response
            Hooks.once('closeApplication', (app) => {
                if (app === dialog) {
                    // Send response back to player
                    game.socket.emit('system.wodsystem', {
                        type: 'effectApprovalResponse',
                        playerId: playerId,
                        approved: dialog.approved
                    });
                    
                    resolve(dialog.approved);
                }
            });
        });
    }
}

/**
 * Initialize socket listeners for approval system
 */
export function initializeApprovalSocket() {
    game.socket.on('system.wodsystem', async (data) => {
        // Only GM should handle approval requests
        if (data.type === 'requestEffectApproval' && game.user.isGM) {
            const actor = game.actors.get(data.actorId);
            await WodStApprovalDialog.showApprovalDialog(actor, data.effectIds, data.playerId);
        }
        
        // Players listen for approval responses
        if (data.type === 'effectApprovalResponse') {
            Hooks.call('wodEffectApprovalResponse', data);
        }
    });
}

