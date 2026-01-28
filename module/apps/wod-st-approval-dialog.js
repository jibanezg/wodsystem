/**
 * Send a socket message with fallback to multiple channels
 * @param {Object} data - The data to send
 * @private
 */
function sendSocketMessage(data) {
    
    try {
        game.socket.emit('system.wodsystem', data);
    } catch (error) {
    }
    
    try {
        game.socket.emit('module.wodsystem', data);
    } catch (error) {
    }
}

/**
 * Handle incoming socket data
 * @param {Object} data - The socket data received
 * @private
 */
async function handleSocketData(data) {
    
    if (data.type === 'requestEffectApproval') {
        
        if (!game.user.isGM) {
            return;
        }
        
        let actor = game.actors.get(data.actorId);
        
        // If not found in game.actors, try to find it in all documents
        if (!actor) {
            actor = game.actors.find(a => a.id === data.actorId);
        }
        
        if (!actor) {
            ui.notifications.error(`Effect approval request failed: Actor not found (${data.actorId})`);
            
            // Send denial back to player
            sendSocketMessage({
                type: 'effectApprovalResponse',
                playerId: data.playerId,
                approved: false
            });
            return;
        }
        
        ui.notifications.info(game.i18n.format('WODSYSTEM.Dialogs.PlayerRequestingApproval', {
            player: data.playerName || game.i18n.localize('WODSYSTEM.EffectManager.Player'),
            actor: actor.name
        }));
        await WodStApprovalDialog.showApprovalDialog(actor, data.effectIds, data.playerId);
    }
    
    
    // Players listen for approval responses
    if (data.type === 'effectApprovalResponse') {
        Hooks.call('wodEffectApprovalResponse', data);
    }
}

/**
 * ST Approval Dialog for Player-Created Effects
 * Shows when a player tries to use a custom effect in their roll
 */
// Import i18n helper (using game.i18n directly since this file doesn't have module structure)
// Note: This file uses game.i18n.localize directly for compatibility

export class WodStApprovalDialog extends Application {
    constructor(actor, effectIds, options = {}) {
        // Set title in options if not provided, using i18n if available
        // This must be done BEFORE calling super() - exactly like WodEquipmentEffectsDialog
        if (!options.title) {
            if (game?.i18n) {
                const localized = game.i18n.localize("WODSYSTEM.Dialogs.STApprovalRequired");
                // Only use localized if it's not the same as the key (meaning translation was found)
                options.title = (localized !== "WODSYSTEM.Dialogs.STApprovalRequired") 
                    ? localized 
                    : "ST Approval Required";
            } else {
                options.title = "ST Approval Required";
            }
        }
        
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
            title: "ST Approval Required", // Static title, will be overridden in constructor if i18n is available
            resizable: false
        });
    }

    async getData() {
        const data = await super.getData();
        
        data.effects = this.effectIds.map(id => {
            const effect = this.actor.effects.get(id);
            
            if (!effect) {
                return null;
            }
            
            return {
                id: effect.id,
                name: effect.name,
                icon: effect.img || effect.icon || "icons/svg/aura.svg", // Use img (v12+) with fallback
                modifiers: this._getEffectModifierDisplay(effect)
            };
        }).filter(e => e !== null);
        
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
            ui.notifications.warn(game.i18n.localize('WODSYSTEM.STApproval.NoSTOnline'));
            return false;
        }

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
                    <i class="fas fa-question-circle"></i> ${game.i18n.localize('WODSYSTEM.STApproval.EffectApprovalRequest')}
                </h3>
                <p style="margin: 8px 0;">
                    <strong>${game.user.name}</strong> ${game.i18n.localize('WODSYSTEM.STApproval.WantsToUseEffectsFor')} <strong>${actor.name}</strong>:
                </p>
                <div style="margin: 10px 0;">
                    ${effectsHtml}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 12px;" class="approval-buttons">
                    <button class="approve-effect-btn" data-request-id="${requestId}" style="flex: 1; background: linear-gradient(135deg, #2ECC71, #27AE60); color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        <i class="fas fa-check"></i> ${game.i18n.localize('WODSYSTEM.Common.Approve')}
                    </button>
                    <button class="deny-effect-btn" data-request-id="${requestId}" style="flex: 1; background: linear-gradient(135deg, #E74C3C, #C0392B); color: white; border: none; padding: 8px; border-radius: 4px; font-weight: bold; cursor: pointer;">
                        <i class="fas fa-times"></i> ${game.i18n.localize('WODSYSTEM.Common.Deny')}
                    </button>
                </div>
            </div>
        `;

        // Send whisper to GM ONLY
        await ChatMessage.create({
            content: messageContent,
            whisper: [gm.id],
            speaker: { alias: game.i18n.localize('WODSYSTEM.Common.SystemName') },
            style: CONST.CHAT_MESSAGE_STYLES.WHISPER
        });

        ui.notifications.info(game.i18n.localize('WODSYSTEM.STApproval.ApprovalRequestSent'));

        // Wait for response via hook (will be triggered by socket OR chat message)
        return new Promise((resolve) => {
            let timeoutId;
            
            const hookId = Hooks.on('wodEffectApprovalResponse', (data) => {
                
                if (data.requestId === requestId) {
                    Hooks.off('wodEffectApprovalResponse', hookId);
                    clearTimeout(timeoutId); // Clear the timeout
                    
                    if (data.approved) {
                        ui.notifications.success(game.i18n.localize('WODSYSTEM.STApproval.Approved'));
                    } else {
                        ui.notifications.error(game.i18n.localize('WODSYSTEM.STApproval.Denied'));
                    }
                    
                    resolve(data.approved);
                }
            });

            // Timeout after 60 seconds
            timeoutId = setTimeout(() => {
                Hooks.off('wodEffectApprovalResponse', hookId);
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
        const dialog = new WodStApprovalDialog(actor, effectIds);
        
        return new Promise((resolve) => {
            dialog.render(true);
            
            // When dialog closes, send response
            Hooks.once('closeApplication', (app) => {
                if (app === dialog) {
                    
                    // Send response back to player
                    const responseData = {
                        type: 'effectApprovalResponse',
                        playerId: playerId,
                        approved: dialog.approved
                    };
                    
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
    if (!game.socket) {
        return;
    }
    
    // Listen to BOTH the generic system socket AND specific event names
    // This provides better compatibility across Foundry versions
    
    // Generic listener (backwards compatibility)
    game.socket.on('system.wodsystem', async (data) => {
        await handleSocketData(data);
    });
    
    // Specific listeners (more reliable)
    game.socket.on('module.wodsystem', async (data) => {
        await handleSocketData(data);
    });
    
    // Register chat message button handlers
    registerChatButtonHandlers();
    
    // Listen for approval response messages in chat (fallback when sockets don't work)
    Hooks.on('createChatMessage', (message, options, userId) => {
        const flags = message.flags?.wodsystem;
        
        if (flags?.approvalResponse) {
            
            // Trigger the hook so the waiting promise resolves
            Hooks.callAll('wodEffectApprovalResponse', {
                requestId: flags.requestId,
                approved: flags.approved
            });
        }
        
        if (flags?.paradoxRemovalResponse) {
            
            // Trigger the hook so the waiting promise resolves
            Hooks.callAll('wodParadoxRemovalResponse', {
                requestId: flags.requestId,
                approved: flags.approved
            });
        }
    });
}

/**
 * Register click handlers for chat message approval buttons
 */
function registerChatButtonHandlers() {
    
    // Use event delegation on the chat log
    $(document).on('click', '.approve-effect-btn', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const requestId = $(this).data('request-id');
        
        if (!game.user.isGM) {
            ui.notifications.warn("Only the Storyteller can approve effects.");
            return;
        }
        
        // Disable buttons immediately
        $(this).closest('.approval-buttons').find('button').prop('disabled', true).css('opacity', '0.5');
        
        // Update message to show approved
        $(this).closest('.wod-approval-request').html(`
            <h3 style="margin: 0 0 10px 0; color: #2ECC71; border-bottom: 2px solid #2ECC71; padding-bottom: 5px;">
                <i class="fas fa-check-circle"></i> ${game.i18n.localize('WODSYSTEM.STApproval.RequestApproved')}
            </h3>
            <p style="color: #27AE60; font-weight: bold;">
                ${game.i18n.localize('WODSYSTEM.STApproval.STApprovedEffects')}
            </p>
        `);
        
        // Try to send via sockets first (for local testing)
        try {
            sendSocketMessage({
                type: 'effectApprovalResponse',
                requestId: requestId,
                approved: true
            });
        } catch (error) {
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
                        <i class="fas fa-check-circle"></i> ${game.i18n.format('WODSYSTEM.STApproval.EffectRequestApproved', {name: actor.name})}
                        <div style="font-size: 0.85em; margin-top: 6px; opacity: 0.9;">${game.i18n.localize('WODSYSTEM.STApproval.ProceedWithRoll')}</div>
                    </div>`,
                    whisper: [playerUser.id],
                    speaker: { alias: game.i18n.localize('WODSYSTEM.Common.SystemName') },
                    style: CONST.CHAT_MESSAGE_STYLES.WHISPER,
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
        
        ui.notifications.success(game.i18n.localize('WODSYSTEM.STApproval.EffectApproved'));
    });
    
    // Handle Paradox removal approval
    $(document).on('click', '.approve-paradox-btn', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const requestId = $(this).data('request-id');
        
        if (!game.user.isGM) {
            ui.notifications.warn(game.i18n.localize('WODSYSTEM.STApproval.OnlySTCanApproveParadox'));
            return;
        }
        
        // Disable buttons immediately
        $(this).closest('.approval-buttons').find('button').prop('disabled', true).css('opacity', '0.5');
        
        // Extract actor ID from requestId (format: paradox-removal-{actorId}-{timestamp})
        const parts = requestId.split('-');
        const actorId = parts[2]; // Skip "paradox" and "removal"
        const actor = game.actors.get(actorId);
        
        if (actor) {
            // Find the player who owns this actor
            const playerUser = game.users.find(u => {
                return actor.testUserPermission(u, "OWNER") && !u.isGM;
            });
            
            if (playerUser) {
                // Send whispered response to player with flags
                await ChatMessage.create({
                    content: `<div style="background: linear-gradient(135deg, #2ECC71, #27AE60); color: white; padding: 12px; border-radius: 6px; text-align: center; font-weight: bold;">
                        <i class="fas fa-check-circle"></i> ${game.i18n.format('WODSYSTEM.STApproval.ParadoxRemovalApprovedMessage', {name: actor.name})}
                    </div>`,
                    whisper: [playerUser.id],
                    speaker: { alias: game.i18n.localize('WODSYSTEM.Common.SystemName') },
                    style: CONST.CHAT_MESSAGE_STYLES.WHISPER,
                    flags: {
                        wodsystem: {
                            paradoxRemovalResponse: true,
                            requestId: requestId,
                            approved: true
                        }
                    }
                });
            }
        }
        
        // Update chat message
        $(this).closest('.wod-approval-request').html(`
            <p style="color: #2ECC71; font-weight: bold;">
                <i class="fas fa-check-circle"></i> ${game.i18n.localize('WODSYSTEM.STApproval.PermanentParadoxRemovalApproved')}
            </p>
        `);
        
        ui.notifications.success(game.i18n.localize('WODSYSTEM.STApproval.ParadoxRemovalApproved'));
    });
    
    $(document).on('click', '.deny-paradox-btn', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const requestId = $(this).data('request-id');
        
        if (!game.user.isGM) {
            ui.notifications.warn(game.i18n.localize('WODSYSTEM.STApproval.OnlySTCanDenyParadox'));
            return;
        }
        
        // Disable buttons immediately
        $(this).closest('.approval-buttons').find('button').prop('disabled', true).css('opacity', '0.5');
        
        // Extract actor ID from requestId (format: paradox-removal-{actorId}-{timestamp})
        const parts = requestId.split('-');
        const actorId = parts[2]; // Skip "paradox" and "removal"
        const actor = game.actors.get(actorId);
        
        if (actor) {
            // Find the player who owns this actor
            const playerUser = game.users.find(u => {
                return actor.testUserPermission(u, "OWNER") && !u.isGM;
            });
            
            if (playerUser) {
                // Send whispered response to player with flags
                await ChatMessage.create({
                    content: `<div style="background: linear-gradient(135deg, #E74C3C, #C0392B); color: white; padding: 12px; border-radius: 6px; text-align: center; font-weight: bold;">
                        <i class="fas fa-times-circle"></i> ${game.i18n.format('WODSYSTEM.STApproval.ParadoxRemovalDeniedMessage', {name: actor.name})}
                    </div>`,
                    whisper: [playerUser.id],
                    speaker: { alias: game.i18n.localize('WODSYSTEM.Common.SystemName') },
                    style: CONST.CHAT_MESSAGE_STYLES.WHISPER,
                    flags: {
                        wodsystem: {
                            paradoxRemovalResponse: true,
                            requestId: requestId,
                            approved: false
                        }
                    }
                });
            }
        }
        
        // Update chat message
        $(this).closest('.wod-approval-request').html(`
            <p style="color: #E74C3C; font-weight: bold;">
                <i class="fas fa-times-circle"></i> ${game.i18n.localize('WODSYSTEM.STApproval.PermanentParadoxRemovalDenied')}
            </p>
        `);
        
        ui.notifications.info(game.i18n.localize('WODSYSTEM.STApproval.ParadoxRemovalDenied'));
    });
    
    $(document).on('click', '.deny-effect-btn', async function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const requestId = $(this).data('request-id');
        
        if (!game.user.isGM) {
            ui.notifications.warn("Only the Storyteller can deny effects.");
            return;
        }
        
        // Disable buttons immediately
        $(this).closest('.approval-buttons').find('button').prop('disabled', true).css('opacity', '0.5');
        
        // Update message to show denied
        $(this).closest('.wod-approval-request').html(`
            <h3 style="margin: 0 0 10px 0; color: #E74C3C; border-bottom: 2px solid #E74C3C; padding-bottom: 5px;">
                <i class="fas fa-times-circle"></i> ${game.i18n.localize('WODSYSTEM.STApproval.RequestDenied')}
            </h3>
            <p style="color: #C0392B; font-weight: bold;">
                ${game.i18n.localize('WODSYSTEM.STApproval.STDeniedEffects')}
            </p>
        `);
        
        Hooks.call('wodEffectApprovalResponse', {requestId, approved: false});
        
        try {
            sendSocketMessage({
                type: 'effectApprovalResponse',
                requestId: requestId,
                approved: false
            });
        } catch (error) {
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
                        <i class="fas fa-times-circle"></i> ${game.i18n.format('WODSYSTEM.STApproval.EffectRequestDenied', {name: actor.name})}
                        <div style="font-size: 0.85em; margin-top: 6px; opacity: 0.9;">${game.i18n.localize('WODSYSTEM.STApproval.RollCancelled')}</div>
                    </div>`,
                    whisper: [playerUser.id],
                    speaker: { alias: game.i18n.localize('WODSYSTEM.Common.SystemName') },
                    style: CONST.CHAT_MESSAGE_STYLES.WHISPER,
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
        
        ui.notifications.info(game.i18n.localize('WODSYSTEM.STApproval.EffectDenied'));
    });
    
}

