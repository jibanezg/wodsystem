/**
 * Send a socket message with fallback to multiple channels
 * @param {Object} data - The data to send
 * @private
 */
function sendSocketMessage(data) {
    console.log("WoD Approval - Sending socket message:", data);
    
    // Try multiple socket channels for compatibility
    try {
        game.socket.emit('system.wodsystem', data);
        console.log("WoD Approval - Message sent via system.wodsystem");
    } catch (error) {
        console.error("WoD Approval - Failed to send via system.wodsystem:", error);
    }
    
    try {
        game.socket.emit('module.wodsystem', data);
        console.log("WoD Approval - Message sent via module.wodsystem");
    } catch (error) {
        console.error("WoD Approval - Failed to send via module.wodsystem:", error);
    }
}

/**
 * Handle incoming socket data
 * @param {Object} data - The socket data received
 * @private
 */
async function handleSocketData(data) {
    console.log("WoD Approval - Processing data:", data);
    console.log("WoD Approval - Data type:", data.type, "Current user isGM:", game.user.isGM);
    
    // Only GM should handle approval requests
    if (data.type === 'requestEffectApproval') {
        console.log("WoD Approval - Received requestEffectApproval");
        
        if (!game.user.isGM) {
            console.log("WoD Approval - User is not GM, ignoring request");
            return;
        }
        
        console.log("WoD Approval - GM handling request for actor:", data.actorId);
        
        // Try to find the actor
        let actor = game.actors.get(data.actorId);
        
        // If not found in game.actors, try to find it in all documents
        if (!actor) {
            console.warn("WoD Approval - Actor not found in game.actors, searching all...");
            actor = game.actors.find(a => a.id === data.actorId);
        }
        
        if (!actor) {
            console.error("WoD Approval - Actor not found:", data.actorId);
            console.error("WoD Approval - Available actors:", game.actors.map(a => ({id: a.id, name: a.name})));
            ui.notifications.error(`Effect approval request failed: Actor not found (${data.actorId})`);
            
            // Send denial back to player
            sendSocketMessage({
                type: 'effectApprovalResponse',
                playerId: data.playerId,
                approved: false
            });
            return;
        }
        
        console.log("WoD Approval - Showing approval dialog for:", actor.name);
        ui.notifications.info(`${data.playerName || 'Player'} is requesting effect approval for ${actor.name}`);
        await WodStApprovalDialog.showApprovalDialog(actor, data.effectIds, data.playerId);
    }
    
    // Players listen for approval responses
    if (data.type === 'effectApprovalResponse') {
        console.log("WoD Approval - Player received response:", data);
        Hooks.call('wodEffectApprovalResponse', data);
    }
}

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
        
        console.log("WoD Approval - getData called for actor:", this.actor.name);
        console.log("WoD Approval - Effect IDs:", this.effectIds);
        console.log("WoD Approval - Actor effects:", this.actor.effects);
        
        // Get effect details
        data.effects = this.effectIds.map(id => {
            const effect = this.actor.effects.get(id);
            
            if (!effect) {
                console.error("WoD Approval - Effect not found:", id);
                return null;
            }
            
            console.log("WoD Approval - Processing effect:", effect.name, effect);
            
            return {
                id: effect.id,
                name: effect.name,
                icon: effect.img || effect.icon || "icons/svg/aura.svg", // Use img (v12+) with fallback
                modifiers: this._getEffectModifierDisplay(effect)
            };
        }).filter(e => e !== null);
        
        data.playerName = this.actor.name;
        data.actorName = this.actor.name;
        
        console.log("WoD Approval - Final data:", data);
        
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
            console.log("WoD Approval - User is GM, auto-approving");
            return true;
        }

        // Find the first connected GM
        const gm = game.users.find(u => u.isGM && u.active);
        
        if (!gm) {
            console.warn("WoD Approval - No GM online");
            ui.notifications.warn("No Storyteller online to approve effect!");
            return false;
        }

        console.log("WoD Approval - Requesting approval from GM via chat:", gm.name);
        console.log("WoD Approval - Actor:", actor.name, "Effects:", effectIds);

        // Create a unique request ID
        const requestId = `approval-${actor.id}-${Date.now()}`;
        
        // Get effect details for the message
        const effectsHtml = effectIds.map(id => {
            const effect = actor.effects.get(id);
            const modifiersDisplay = this.prototype._getEffectModifierDisplay(effect);
            return `
                <div style="padding: 6px; background: #f0f0f0; border-radius: 4px; margin: 4px 0;">
                    <strong>${effect.name}</strong>
                    ${modifiersDisplay ? `<br><em style="font-size: 0.9em; color: #666;">${modifiersDisplay}</em>` : ''}
                </div>
            `;
        }).join('');

        // Create chat message with approval buttons
        const messageContent = `
            <div class="wod-approval-request" data-request-id="${requestId}">
                <h3 style="margin: 0 0 10px 0; color: #3498DB; border-bottom: 2px solid #3498DB; padding-bottom: 5px;">
                    <i class="fas fa-question-circle"></i> Effect Approval Request
                </h3>
                <p style="margin: 8px 0;">
                    <strong>${game.user.name}</strong> wants to use the following effects for <strong>${actor.name}</strong>:
                </p>
                <div style="margin: 10px 0;">
                    ${effectsHtml}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 12px;" class="approval-buttons">
                    <button class="approve-effect-btn" data-request-id="${requestId}" style="flex: 1; background: linear-gradient(135deg, #2ECC71, #27AE60); color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="deny-effect-btn" data-request-id="${requestId}" style="flex: 1; background: linear-gradient(135deg, #E74C3C, #C0392B); color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        <i class="fas fa-times"></i> Deny
                    </button>
                </div>
            </div>
        `;

        // Send whisper to GM ONLY
        await ChatMessage.create({
            content: messageContent,
            whisper: [gm.id],
            speaker: { alias: "WoD System" },
            type: CONST.CHAT_MESSAGE_TYPES.WHISPER
        });

        ui.notifications.info("Approval request sent to Storyteller. Waiting for response...");
        console.log("WoD Approval - Player waiting for response for requestId:", requestId);

        // Wait for response via hook (will be triggered by socket OR chat message)
        return new Promise((resolve) => {
            const hookId = Hooks.on('wodEffectApprovalResponse', (data) => {
                console.log("WoD Approval - Player received response:", data);
                
                if (data.requestId === requestId) {
                    console.log("WoD Approval - RequestId matches! Approved:", data.approved);
                    Hooks.off('wodEffectApprovalResponse', hookId);
                    
                    if (data.approved) {
                        ui.notifications.success("Storyteller approved your effect! Proceeding with roll...");
                    } else {
                        ui.notifications.error("Storyteller denied your effect. Roll cancelled.");
                    }
                    
                    resolve(data.approved);
                }
            });

            // Timeout after 60 seconds
            setTimeout(() => {
                Hooks.off('wodEffectApprovalResponse', hookId);
                console.error("WoD Approval - Request timed out after 60 seconds");
                console.error("WoD Approval - No response received for requestId:", requestId);
                ui.notifications.error("ST approval request timed out. Roll cancelled.");
                resolve(false);
            }, 60000);
        });
    }

    /**
     * Show approval dialog to the GM
     * @param {Actor} actor
     * @param {Array<string>} effectIds
     * @param {string} playerId
     */
    static async showApprovalDialog(actor, effectIds, playerId) {
        console.log("WoD Approval - Creating dialog for actor:", actor.name, "effects:", effectIds);
        const dialog = new WodStApprovalDialog(actor, effectIds);
        
        return new Promise((resolve) => {
            console.log("WoD Approval - Rendering dialog");
            dialog.render(true);
            
            // When dialog closes, send response
            Hooks.once('closeApplication', (app) => {
                if (app === dialog) {
                    console.log("WoD Approval - Dialog closed, approved:", dialog.approved);
                    
                    // Send response back to player
                    const responseData = {
                        type: 'effectApprovalResponse',
                        playerId: playerId,
                        approved: dialog.approved
                    };
                    
                    console.log("WoD Approval - Emitting response:", responseData);
                    sendSocketMessage(responseData);
                    
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
    console.log("WoD Approval - Initializing socket listeners");
    console.log("WoD Approval - Current user:", game.user.name, "isGM:", game.user.isGM);
    console.log("WoD Approval - Socket available:", !!game.socket);
    
    if (!game.socket) {
        console.error("WoD Approval - game.socket is not available! Cannot initialize approval system.");
        return;
    }
    
    // Listen to BOTH the generic system socket AND specific event names
    // This provides better compatibility across Foundry versions
    
    // Generic listener (backwards compatibility)
    game.socket.on('system.wodsystem', async (data) => {
        console.log("WoD Approval - Socket received (generic):", data);
        await handleSocketData(data);
    });
    
    // Specific listeners (more reliable)
    game.socket.on('module.wodsystem', async (data) => {
        console.log("WoD Approval - Socket received (module):", data);
        await handleSocketData(data);
    });
    
    console.log("WoD Approval - Socket listener registered successfully");
    
    // Register chat message button handlers
    registerChatButtonHandlers();
    
    // Listen for approval response messages in chat (fallback when sockets don't work)
    Hooks.on('createChatMessage', (message, options, userId) => {
        const flags = message.flags?.wodsystem;
        
        if (flags?.approvalResponse) {
            console.log("WoD Approval - Received approval response via chat:", flags);
            
            // Trigger the hook so the waiting promise resolves
            Hooks.callAll('wodEffectApprovalResponse', {
                requestId: flags.requestId,
                approved: flags.approved
            });
        }
    });
    
    console.log("WoD Approval - Chat message listener registered for responses");
}

/**
 * Register click handlers for chat message approval buttons
 */
function registerChatButtonHandlers() {
    console.log("WoD Approval - Registering chat button handlers");
    
    // Use event delegation on the chat log
    $(document).on('click', '.approve-effect-btn', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const requestId = $(this).data('request-id');
        console.log("WoD Approval - Approve button clicked for request:", requestId);
        
        if (!game.user.isGM) {
            console.warn("WoD Approval - Non-GM tried to approve");
            ui.notifications.warn("Only the Storyteller can approve effects.");
            return;
        }
        
        // Disable buttons immediately
        $(this).closest('.approval-buttons').find('button').prop('disabled', true).css('opacity', '0.5');
        
        // Update message to show approved
        $(this).closest('.wod-approval-request').html(`
            <h3 style="margin: 0 0 10px 0; color: #2ECC71; border-bottom: 2px solid #2ECC71; padding-bottom: 5px;">
                <i class="fas fa-check-circle"></i> Request Approved
            </h3>
            <p style="color: #27AE60; font-weight: bold;">
                The Storyteller has approved the effect(s).
            </p>
        `);
        
        console.log("WoD Approval - Calling Hook with:", {requestId, approved: true});
        
        // Try to send via sockets first (for local testing)
        try {
            sendSocketMessage({
                type: 'effectApprovalResponse',
                requestId: requestId,
                approved: true
            });
        } catch (error) {
            console.warn("WoD Approval - Socket send failed:", error);
        }
        
        // Trigger response hook locally for the GM
        Hooks.callAll('wodEffectApprovalResponse', {
            requestId: requestId,
            approved: true
        });
        
        // Send a whisper back to the player to notify them
        // Extract actor ID and player ID from requestId (format: approval-{actorId}-{timestamp})
        const parts = requestId.split('-');
        const actorId = parts[1];
        const actor = game.actors.get(actorId);
        
        if (actor) {
            // Find the player who owns this actor
            const playerUser = game.users.find(u => {
                return actor.testUserPermission(u, "OWNER") && !u.isGM;
            });
            
            if (playerUser) {
                await ChatMessage.create({
                    content: `<div style="background: linear-gradient(135deg, #2ECC71, #27AE60); color: white; padding: 12px; border-radius: 6px; text-align: center; font-weight: bold;">
                        <i class="fas fa-check-circle"></i> Your effect request for <strong>${actor.name}</strong> has been APPROVED!
                        <div style="font-size: 0.85em; margin-top: 6px; opacity: 0.9;">You may now proceed with your roll.</div>
                    </div>`,
                    whisper: [playerUser.id],
                    speaker: { alias: "WoD System" },
                    type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
                    flags: {
                        wodsystem: {
                            approvalResponse: true,
                            requestId: requestId,
                            approved: true
                        }
                    }
                });
            }
        }
        
        ui.notifications.success("Effect approved!");
    });
    
    $(document).on('click', '.deny-effect-btn', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const requestId = $(this).data('request-id');
        console.log("WoD Approval - Deny button clicked for request:", requestId);
        
        if (!game.user.isGM) {
            console.warn("WoD Approval - Non-GM tried to deny");
            ui.notifications.warn("Only the Storyteller can deny effects.");
            return;
        }
        
        // Disable buttons immediately
        $(this).closest('.approval-buttons').find('button').prop('disabled', true).css('opacity', '0.5');
        
        // Update message to show denied
        $(this).closest('.wod-approval-request').html(`
            <h3 style="margin: 0 0 10px 0; color: #E74C3C; border-bottom: 2px solid #E74C3C; padding-bottom: 5px;">
                <i class="fas fa-times-circle"></i> Request Denied
            </h3>
            <p style="color: #C0392B; font-weight: bold;">
                The Storyteller has denied the effect(s).
            </p>
        `);
        
        console.log("WoD Approval - Calling Hook with:", {requestId, approved: false});
        
        // Try to send via sockets first (for local testing)
        try {
            sendSocketMessage({
                type: 'effectApprovalResponse',
                requestId: requestId,
                approved: false
            });
        } catch (error) {
            console.warn("WoD Approval - Socket send failed:", error);
        }
        
        // Trigger response hook locally for the GM
        Hooks.callAll('wodEffectApprovalResponse', {
            requestId: requestId,
            approved: false
        });
        
        // Send a whisper back to the player to notify them
        const parts = requestId.split('-');
        const actorId = parts[1];
        const actor = game.actors.get(actorId);
        
        if (actor) {
            // Find the player who owns this actor
            const playerUser = game.users.find(u => {
                return actor.testUserPermission(u, "OWNER") && !u.isGM;
            });
            
            if (playerUser) {
                await ChatMessage.create({
                    content: `<div style="background: linear-gradient(135deg, #E74C3C, #C0392B); color: white; padding: 12px; border-radius: 6px; text-align: center; font-weight: bold;">
                        <i class="fas fa-times-circle"></i> Your effect request for <strong>${actor.name}</strong> has been DENIED!
                        <div style="font-size: 0.85em; margin-top: 6px; opacity: 0.9;">Your roll has been cancelled.</div>
                    </div>`,
                    whisper: [playerUser.id],
                    speaker: { alias: "WoD System" },
                    type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
                    flags: {
                        wodsystem: {
                            approvalResponse: true,
                            requestId: requestId,
                            approved: false
                        }
                    }
                });
            }
        }
        
        ui.notifications.info("Effect denied.");
    });
    
    console.log("WoD Approval - Chat button handlers registered");
}

