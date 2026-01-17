/**
 * Equipment Effects Manager
 * Handles UI and token effects based on equipped items
 * Supports: lights, visibility, sounds, and other visual/audio effects
 */
export class EquipmentEffectsManager {
    constructor() {
        this.activeEffects = new Map(); // Map of actorId -> Map of itemId -> effect data
    }

    /**
     * Initialize the manager and set up hooks
     */
    static initialize() {
        const manager = new EquipmentEffectsManager();
        game.wod = game.wod || {};
        game.wod.equipmentEffectsManager = manager;

        // Hook into item updates to detect equipment changes and effect configuration changes
        Hooks.on("updateItem", async (item, updateData, options, userId) => {
            const actor = item.actor || (item.actorId ? game.actors.get(item.actorId) : null);
            if (!actor || (!game.user.isGM && !actor.isOwner)) {
                return;
            }

            // Wait for the update to complete, then get the fresh item
            await new Promise(resolve => setTimeout(resolve, 0));
            const freshItem = item.actor?.items?.get(item.id) || item;

            // Check for equipment state change (equip/unequip)
            if (updateData.system?.equipped !== undefined) {
                manager._handleEquipmentChange(freshItem, updateData.system.equipped);
            }
            // Check for equipment effects configuration changes (when item is already equipped)
            else if (updateData.system?.equipmentEffects !== undefined && freshItem.system?.equipped) {
                // Item is equipped and effects configuration changed - reapply effects
                console.log("WoD Equipment Effects: Equipment effects configuration changed, reapplying", {
                    itemId: freshItem.id,
                    itemName: freshItem.name,
                    actorId: actor.id,
                    newEffects: updateData.system.equipmentEffects
                });
                const effects = freshItem.system?.equipmentEffects || {};
                const hasEffects = effects.light !== null || effects.visibility !== null || effects.sound !== null;
                
                if (hasEffects) {
                    // Reapply effects with new configuration
                    await manager._applyItemEffects(actor, freshItem, effects);
                } else {
                    // Effects were removed, clean up
                    await manager._removeItemEffects(actor, freshItem.id);
                }
            }
        });

        // Hook into item creation (in case item is created as equipped)
        Hooks.on("createItem", (item, options, userId) => {
            if (item.system?.equipped) {
                // Get actor from item - try multiple methods
                let actor = item.actor;
                if (!actor && item.parent) {
                    actor = item.parent;
                }
                if (!actor && item.actorId) {
                    actor = game.actors.get(item.actorId);
                }
                
                // CRITICAL: Only process if the current user is the one who created the item
                // or if they are GM/owner of the actor
                if (actor && (game.user.isGM || actor.isOwner)) {
                    manager._handleEquipmentChange(item, true);
                } else {
                    console.debug("WoD Equipment Effects: Skipping equipment change on create - user does not have permission", {
                        userId: game.user.id,
                        actorId: actor?.id
                    });
                }
            }
        });

        // Hook into item deletion to clean up effects
        // CRITICAL: Use "preDeleteItem" to capture item data before deletion
        Hooks.on("preDeleteItem", async (item, options, userId) => {
            // CRITICAL: Only process if item was equipped and had effects
            if (item.system?.equipped) {
                // Get actor from item - try multiple methods
                let actor = item.actor;
                if (!actor && item.parent) {
                    actor = item.parent;
                }
                if (!actor && item.actorId) {
                    actor = game.actors.get(item.actorId);
                }
                
                // CRITICAL: Only process if the current user is the one who deleted the item
                // or if they are GM/owner of the actor
                if (actor && (game.user.isGM || actor.isOwner)) {
                    // CRITICAL: Capture item effects BEFORE the item is deleted
                    // This ensures we can remove only the effects from this specific item
                    const itemId = item.id;
                    const effects = item.system?.equipmentEffects || {};
                    
                    // Remove effects directly (bypassing _handleEquipmentChange since item will be gone)
                    await manager._removeItemEffectsDirectly(actor, itemId, effects);
                } else {
                    console.debug("WoD Equipment Effects: Skipping equipment change on delete - user does not have permission", {
                        userId: game.user.id,
                        actorId: actor?.id
                    });
                }
            }
        });

        // Helper to get actor from token/tokenDoc
        const getActorFromToken = (tokenOrDoc) => {
            // Try multiple methods to get the actor
            if (tokenOrDoc.actor) return tokenOrDoc.actor;
            if (tokenOrDoc.document?.actor) return tokenOrDoc.document.actor;
            if (tokenOrDoc.actorId) return game.actors.get(tokenOrDoc.actorId);
            if (tokenOrDoc.document?.actorId) return game.actors.get(tokenOrDoc.document.actorId);
            if (tokenOrDoc.data?.actorId) return game.actors.get(tokenOrDoc.data.actorId);
            return null;
        };

        // Track token location for actors (only when token is created, not on every movement)
        Hooks.on("createToken", async (token, options, userId) => {
            // CRITICAL: Only process if the current user is the one who created the token
            // or if they are GM/owner of the actor
            const actor = getActorFromToken(token);
            if (actor) {
                // Verify permissions before updating
                if (game.user.isGM || actor.isOwner) {
                    // Store token location in actor flags
                    await manager._updateTokenLocation(actor, token);
                    
                    // CRITICAL: Wait a moment for token to be fully initialized in the scene
                    // Then apply all effects from equipped items when token is created
                    // This ensures effects work immediately when token is added to scene
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    console.log("WoD Equipment Effects: Token created, applying actor effects", { 
                        actorId: actor.id, 
                        actorName: actor.name,
                        tokenId: token.id || token.document?.id
                    });
                    await manager._applyActorEffects(actor, token);
                } else {
                    console.debug("WoD Equipment Effects: User does not have permission to update token location on create", {
                        userId: game.user.id,
                        userName: game.user.name,
                        actorId: actor.id,
                        actorName: actor.name
                    });
                }
            }
        });

        // NOTE: We don't track token movement in real-time as it blocks performance
        // Instead, we'll find tokens when needed using getActiveTokens or stored location

        return manager;
    }

    /**
     * Update and store token location information for an actor
     * @param {Actor} actor - The actor
     * @param {Token|TokenDocument} token - The token or token document
     */
    async _updateTokenLocation(actor, token) {
        if (!actor || !token) return;
        
        // CRITICAL: Only GM or actor owner can update token location
        if (!game.user.isGM && !actor.isOwner) {
            console.debug("WoD Equipment Effects: User does not have permission to update token location", {
                userId: game.user.id,
                userName: game.user.name,
                actorId: actor.id,
                actorName: actor.name,
                isOwner: actor.isOwner
            });
            return;
        }
        
        try {
            // Get token ID - handle both Token (PlaceableObject) and TokenDocument
            let tokenId = token.id;
            let sceneId = null;
            
            // If it's a Token (PlaceableObject), get from document
            if (token.document) {
                tokenId = token.document.id;
                sceneId = token.document.sceneId || token.scene?.id || canvas?.scene?.id;
            } 
            // If it's a TokenDocument
            else if (token.sceneId) {
                tokenId = token.id;
                sceneId = token.sceneId;
            }
            // Fallback: try to get from various properties
            else {
                tokenId = token.id || token._id || token.data?._id;
                sceneId = token.sceneId || token.scene?.id || token.data?.sceneId || canvas?.scene?.id;
            }
            
            if (!tokenId || !sceneId) {
                console.debug("WoD Equipment Effects: Cannot update token location - missing tokenId or sceneId", {
                    tokenId,
                    sceneId,
                    hasToken: !!token,
                    hasDocument: !!token.document,
                    tokenKeys: Object.keys(token)
                });
                return;
            }
            
            // Store in actor flags
            const currentLocation = actor.flags?.wodsystem?.tokenLocation;
            const needsUpdate = !currentLocation || 
                               currentLocation.tokenId !== tokenId || 
                               currentLocation.sceneId !== sceneId;
            
            if (needsUpdate) {
                // Use silent update to avoid triggering other hooks and blocking movement
                await actor.setFlag("wodsystem", "tokenLocation", {
                    tokenId: tokenId,
                    sceneId: sceneId,
                    lastUpdated: Date.now()
                }, { silent: true });
            }
        } catch (e) {
            console.warn("WoD Equipment Effects: Error updating token location", e);
        }
    }

    /**
     * Get stored token for an actor
     * @param {Actor} actor - The actor
     * @returns {Promise<Token|TokenDocument|null>} The token if found
     */
    async _getStoredToken(actor) {
        if (!actor) {
            return null;
        }
        
        const location = actor.flags?.wodsystem?.tokenLocation;
        
        if (!location || !location.tokenId || !location.sceneId) {
            return null;
        }
        
        try {
            // CRITICAL: Verify user has access to the scene before accessing it
            const scene = game.scenes.get(location.sceneId);
            if (!scene) {
                console.warn("WoD Equipment Effects: _getStoredToken - Scene not found", location.sceneId);
                return null;
            }
            
            // CRITICAL: Verify user has permission to view this scene
            if (!game.user.isGM && !scene.testUserPermission(game.user, "LIMITED")) {
                console.debug("WoD Equipment Effects: _getStoredToken - User does not have access to scene", {
                    userId: game.user.id,
                    userName: game.user.name,
                    sceneId: location.sceneId,
                    sceneName: scene.name
                });
                return null;
            }
            
            // Try to get the token from the scene
            let tokenDoc = scene.tokens.get(location.tokenId);
            if (!tokenDoc) {
                // Token not found with stored ID - try to find any token for this actor in the scene
                console.warn("WoD Equipment Effects: _getStoredToken - Stored token ID not found, searching for any token of this actor in scene", {
                    storedTokenId: location.tokenId,
                    sceneId: location.sceneId,
                    sceneName: scene.name,
                    totalTokens: scene.tokens.size
                });
                
                // Search for any token linked to this actor
                const sceneTokens = Array.from(scene.tokens.values());
                tokenDoc = sceneTokens.find(t => {
                    const tokenActorId = t.actorId || t.data?.actorId;
                    return tokenActorId === actor.id;
                });
                
                if (tokenDoc) {
                    // Found a token for this actor - update stored location
                    await this._updateTokenLocation(actor, tokenDoc);
                } else {
                    return null;
                }
            }
            
            // Verify the token is actually linked to this actor
            const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
            if (tokenActorId !== actor.id) {
                return null;
            }
            
            // If scene is active, try to get the canvas token
            if (scene.active && canvas && canvas.tokens) {
                const canvasToken = canvas.tokens.get(location.tokenId);
                if (canvasToken) {
                    return canvasToken.object || canvasToken;
                }
            }
            
            // Return TokenDocument as fallback
            return tokenDoc;
        } catch (e) {
            console.error("WoD Equipment Effects: _getStoredToken - Error", e);
            return null;
        }
    }

    /**
     * Handle equipment change (equip/unequip)
     * @param {Item} item - The item that changed
     * @param {boolean} isEquipped - Whether the item is now equipped
     */
    async _handleEquipmentChange(item, isEquipped) {
        // Get actor from item - try multiple methods
        let actor = item.actor;
        if (!actor && item.parent) {
            actor = item.parent;
        }
        if (!actor && item.actorId) {
            actor = game.actors.get(item.actorId);
        }
        
        if (!actor) {
            return;
        }
        
        // CRITICAL: Verify user has permission to modify this actor's items
        if (!game.user.isGM && !actor.isOwner) {
            return;
        }
        
        const actorId = actor.id;
        const itemId = item.id;

        // Get equipment effects configuration from item
        const effects = item.system?.equipmentEffects || {};

        // Check if there are any actual effects configured (not null)
        const hasEffects = effects.light !== null || effects.visibility !== null || effects.sound !== null;

        if (isEquipped && hasEffects) {
            // Apply effects
            console.log("WoD Equipment Effects: Equipping item with effects", { itemId, itemName: item.name, effects });
            await this._applyItemEffects(actor, item, effects);
        } else if (!isEquipped) {
            // Remove effects
            console.log("WoD Equipment Effects: Unequipping item, removing effects", { itemId, itemName: item.name, effects });
            await this._removeItemEffects(actor, itemId);
        }
    }

    /**
     * Apply effects from an equipped item
     * Simple approach: iterate over the item's effects and enable each one
     * @param {Actor} actor - The actor
     * @param {Item} item - The equipped item
     * @param {Object} effects - Effects configuration (from item.system.equipmentEffects)
     * @param {Token|TokenDocument} specificToken - Optional: specific token to apply effects to (when token is just created)
     */
    async _applyItemEffects(actor, item, effects, specificToken = null) {
        const actorId = actor.id;
        const itemId = item.id;

        // Store effect data in map for tracking
        if (!this.activeEffects.has(actorId)) {
            this.activeEffects.set(actorId, new Map());
        }
        this.activeEffects.get(actorId).set(itemId, effects);

        // Track if we need to recalculate combined effects
        let needsLightRecalc = false;
        let needsVisibilityRecalc = false;

        // Iterate over all effects provided by this item and enable each one
        // The item stores all its effects, so we just go through them
        if (effects.light !== null && effects.light !== undefined) {
            // Check if there are other light sources - if so, we need to recalculate
            needsLightRecalc = this._hasOtherLightSourceFromMap(actor, itemId);
            if (needsLightRecalc) {
                // If there are other lights, recalculate to get the combined/strongest light
                await this._recalculateLightFromMap(actor);
            } else {
                // No other lights, just apply this one directly
                await this._applyLightEffect(actor, item, effects.light, specificToken);
            }
        }

        if (effects.visibility !== null && effects.visibility !== undefined) {
            // Check if there are other visibility sources - if so, we need to recalculate
            needsVisibilityRecalc = this._hasOtherVisibilitySourceFromMap(actor, itemId);
            if (needsVisibilityRecalc) {
                // If there are other visibility sources, recalculate to get the best one
                await this._recalculateVisibilityFromMap(actor);
            } else {
                // No other visibility sources, just apply this one directly
                await this._applyVisibilityEffect(actor, item, effects.visibility, specificToken);
            }
        }

        if (effects.sound !== null && effects.sound !== undefined) {
            await this._applySoundEffect(actor, item, effects.sound);
        }

        // Update tokens
        await this._updateActorTokens(actor);
    }

    /**
     * Remove effects from an unequipped item
     * Simple approach: iterate over the item's effects and disable each one
     * @param {Actor} actor - The actor
     * @param {string} itemId - The item ID
     */
    async _removeItemEffects(actor, itemId) {
        console.log("WoD Equipment Effects: _removeItemEffects called", { actorId: actor.id, actorName: actor.name, itemId });
        
        const actorId = actor.id;

        // Get the item to access its effects
        const item = actor.items.get(itemId);
        console.log("WoD Equipment Effects: Item found", { itemId, itemExists: !!item, itemName: item?.name });
        
        // Get effects directly from the item - this is the source of truth
        // If item doesn't exist (was deleted), try to get from the map
        let effects = item?.system?.equipmentEffects;
        console.log("WoD Equipment Effects: Effects from item", { effects });
        
        if (!effects && this.activeEffects.has(actorId)) {
            const actorEffects = this.activeEffects.get(actorId);
            effects = actorEffects.get(itemId);
            console.log("WoD Equipment Effects: Effects from map", { effects });
        }
        
        if (!effects) {
            console.log("WoD Equipment Effects: No effects found, cleaning up map only");
            // Item has no effects configured, just clean up the map
            if (this.activeEffects.has(actorId)) {
                const actorEffects = this.activeEffects.get(actorId);
                actorEffects.delete(itemId);
                if (actorEffects.size === 0) {
                    this.activeEffects.delete(actorId);
                }
            }
            return;
        }

        // CRITICAL: Remove from active effects map FIRST, before removing effects
        // This ensures that when we check for other light sources, this item is already removed
        if (this.activeEffects.has(actorId)) {
            const actorEffects = this.activeEffects.get(actorId);
            actorEffects.delete(itemId);
            if (actorEffects.size === 0) {
                this.activeEffects.delete(actorId);
            }
        }

        // Iterate over all effects provided by this item and disable each one
        // The item stores all its effects, so we just go through them
        console.log("WoD Equipment Effects: Removing effects", { 
            hasLight: effects.light !== null && effects.light !== undefined,
            hasVisibility: effects.visibility !== null && effects.visibility !== undefined,
            hasSound: effects.sound !== null && effects.sound !== undefined
        });
        
        if (effects.light !== null && effects.light !== undefined) {
            console.log("WoD Equipment Effects: Calling _removeLightEffect");
            await this._removeLightEffect(actor, itemId);
        }

        if (effects.visibility !== null && effects.visibility !== undefined) {
            console.log("WoD Equipment Effects: Calling _removeVisibilityEffect");
            await this._removeVisibilityEffect(actor, itemId);
        }

        if (effects.sound !== null && effects.sound !== undefined) {
            console.log("WoD Equipment Effects: Calling _removeSoundEffect");
            await this._removeSoundEffect(actor, itemId);
        }

        // Update tokens
        await this._updateActorTokens(actor);
        console.log("WoD Equipment Effects: _removeItemEffects completed");
    }

    /**
     * Remove effects directly when item is being deleted
     * This method is used when the item no longer exists, so we pass the effects directly
     * CRITICAL: This ensures we only remove effects from the deleted item, not from other items
     * @param {Actor} actor - The actor
     * @param {string} itemId - The item ID
     * @param {Object} effects - The effects configuration from the deleted item
     */
    async _removeItemEffectsDirectly(actor, itemId, effects) {
        const actorId = actor.id;

        // CRITICAL: Remove from activeEffects map FIRST
        if (this.activeEffects.has(actorId)) {
            const actorEffects = this.activeEffects.get(actorId);
            actorEffects.delete(itemId);
            if (actorEffects.size === 0) {
                this.activeEffects.delete(actorId);
            }
        }

        // Remove each effect type ONLY if this specific item had that effect configured
        // This ensures we only remove effects from the deleted item, not from other items
        if (effects) {
            if (effects.light !== null && effects.light !== undefined) {
                await this._removeLightEffect(actor, itemId);
            }

            if (effects.visibility !== null && effects.visibility !== undefined) {
                await this._removeVisibilityEffect(actor, itemId);
            }

            if (effects.sound !== null && effects.sound !== undefined) {
                await this._removeSoundEffect(actor, itemId);
            }
        }

        // Update tokens
        await this._updateActorTokens(actor);
    }

    /**
     * Apply light effect (flashlight, etc.)
     * @param {Actor} actor - The actor
     * @param {Item} item - The item providing the light
     * @param {Object} lightConfig - Light configuration
     */
    async _applyLightEffect(actor, item, lightConfig, specificToken = null) {
        if (!lightConfig || (lightConfig.dim === 0 && lightConfig.bright === 0)) {
            return;
        }

        console.log("WoD Equipment Effects: _applyLightEffect called", { 
            actorId: actor.id, 
            itemId: item.id,
            hasSpecificToken: !!specificToken
        });

        // Get tokens - use specific token if provided (just created), then stored location, then fallback
        let tokens = [];
        
        // Method 1: Use specific token if provided (token just created)
        if (specificToken) {
            console.log("WoD Equipment Effects: Using specific token provided", { tokenId: specificToken.id || specificToken.document?.id });
            tokens.push(specificToken);
        } else {
            // Method 2: Try stored token location (most reliable and fastest)
            const storedToken = await this._getStoredToken(actor);
            if (storedToken) {
                tokens.push(storedToken);
            } else {
                // Method 3: Quick fallback - getActiveTokens (only if stored location not available)
                try {
                    const activeTokens = actor.getActiveTokens(true);
                    if (activeTokens.length > 0) {
                        tokens.push(...activeTokens);
                        // Store location for future use
                        await this._updateTokenLocation(actor, activeTokens[0]);
                    } else {
                        // If no active tokens, try to find token in the stored scene
                        const location = actor.flags?.wodsystem?.tokenLocation;
                        if (location && location.sceneId) {
                            const scene = game.scenes.get(location.sceneId);
                            // CRITICAL: Verify user has access to the scene before searching
                            if (scene && (game.user.isGM || scene.testUserPermission(game.user, "LIMITED"))) {
                                // Try to find any token for this actor in the stored scene
                                const sceneTokens = Array.from(scene.tokens.values()).filter(t => {
                                    const tokenActorId = t.actorId || t.data?.actorId;
                                    return tokenActorId === actor.id;
                                });
                                if (sceneTokens.length > 0) {
                                    tokens.push(...sceneTokens);
                                    // Update stored location with the first token found
                                    await this._updateTokenLocation(actor, sceneTokens[0]);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn("WoD Equipment Effects: getActiveTokens failed", e);
                }
            }
        }
        
        if (tokens.length === 0) {
            // Store the light configuration so it can be applied when token is created
            // Update the prototype token's light configuration
            const lightData = {
                dim: lightConfig.dim || 0,
                bright: lightConfig.bright || 0,
                angle: lightConfig.angle || 360,
                color: lightConfig.color || "#ffffff",
                alpha: lightConfig.alpha !== undefined ? lightConfig.alpha : 0.5
            };

            if (lightConfig.animation) {
                lightData.animation = lightConfig.animation;
            }

            if (lightConfig.darkness) {
                lightData.darkness = lightConfig.darkness;
            } else {
                lightData.darkness = { min: 0, max: 1 };
            }

            // CRITICAL: Only update prototype token if user has permission
            if (game.user.isGM || actor.isOwner) {
                await actor.update({ "prototypeToken.light": lightData });
            } else {
                console.debug("WoD Equipment Effects: User does not have permission to update prototype token", {
                    userId: game.user.id,
                    actorId: actor.id
                });
            }
            return;
        }

        const lightData = {
            dim: lightConfig.dim || 0,
            bright: lightConfig.bright || 0,
            angle: lightConfig.angle || 360,
            color: lightConfig.color || "#ffffff",
            alpha: lightConfig.alpha !== undefined ? lightConfig.alpha : 0.5
        };

        // If animation is provided, add it
        if (lightConfig.animation) {
            lightData.animation = lightConfig.animation;
        }

        // If darkness is provided, add it
        if (lightConfig.darkness) {
            lightData.darkness = lightConfig.darkness;
        } else {
            lightData.darkness = { min: 0, max: 1 };
        }

        for (const token of tokens) {
            try {
                // CRITICAL: Verify token belongs to the correct actor
                const tokenDoc = token.document || token;
                const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
                
                // Double-check: token must belong to the actor we're modifying
                if (tokenActorId !== actor.id) {
                    console.warn("WoD Equipment Effects: Token does not belong to actor, skipping", {
                        tokenActorId: tokenActorId,
                        targetActorId: actor.id,
                        tokenId: tokenDoc.id
                    });
                    continue;
                }
                
                // Check permissions - only GM or actor owner can update tokens
                const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                
                if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                    continue;
                }
                
                // Check if token is a Token (has .document property)
                if (token.document) {
                    // It's a Token (from getActiveTokens or scene.tokens when active)
                    await token.document.update({ light: lightData });
                } 
                // Check if token is a TokenDocument (has .update method directly)
                else if (token.update) {
                    // It's a TokenDocument (from scene.tokens when scene is not active)
                    await token.update({ light: lightData });
                } 
                // Check if token has data property (might be raw data)
                else if (token.data && token.scene) {
                    // Try to get the TokenDocument from the scene
                    const scene = game.scenes.get(token.scene.id || token.scene);
                    // CRITICAL: Verify user has access to the scene
                    if (scene && (game.user.isGM || scene.testUserPermission(game.user, "LIMITED"))) {
                        const tokenDoc = scene.tokens.get(token.id || token.data._id);
                        if (tokenDoc) {
                            // CRITICAL: Verify token belongs to the correct actor
                            const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
                            if (tokenActorId !== actor.id) {
                                console.warn("WoD Equipment Effects: Token does not belong to actor, skipping light update via scene lookup", {
                                    tokenActorId: tokenActorId,
                                    targetActorId: actor.id,
                                    tokenId: tokenDoc.id
                                });
                                continue;
                            }
                            
                            // Verify permissions again for the token document
                            const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                            if (game.user.isGM || (tokenActor && tokenActor.isOwner)) {
                                await tokenDoc.update({ light: lightData });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("WoD Equipment Effects: Error updating token light", error);
            }
        }
    }

    /**
     * Remove light effect
     * @param {Actor} actor - The actor
     * @param {string} itemId - The item ID
     */
    async _removeLightEffect(actor, itemId) {
        console.log("WoD Equipment Effects: _removeLightEffect called", { actorId: actor.id, itemId });
        
        const actorId = actor.id;
        
        // CRITICAL: The item has already been removed from the map in _removeItemEffects
        // So we can directly check if other items have light effects
        const hasOtherLight = this._hasOtherLightSourceFromMap(actorId);
        console.log("WoD Equipment Effects: Has other light sources?", { hasOtherLight });
        
        if (!hasOtherLight) {
            console.log("WoD Equipment Effects: No other light sources, resetting to default");
            // Reset to default light (completely disable)
            // Use Foundry's default light values to ensure proper reset
            const defaultLightData = {
                dim: 0,
                bright: 0,
                angle: 360,
                color: "#000000",
                alpha: 0.5,
                darkness: { min: 0, max: 1 },
                // Explicitly set animation to null to remove any animation
                animation: null
            };
            
            let tokens = [];
            const storedToken = await this._getStoredToken(actor);
            if (storedToken) {
                tokens.push(storedToken);
            } else {
                // Try getActiveTokens first
                tokens = actor.getActiveTokens(true);
                
                // If no active tokens, try to find token in the stored scene
                if (tokens.length === 0) {
                    const location = actor.flags?.wodsystem?.tokenLocation;
                    if (location && location.sceneId) {
                        const scene = game.scenes.get(location.sceneId);
                        // CRITICAL: Verify user has access to the scene before searching
                        if (scene && (game.user.isGM || scene.testUserPermission(game.user, "LIMITED"))) {
                            // Try to find any token for this actor in the stored scene
                            const sceneTokens = Array.from(scene.tokens.values()).filter(t => {
                                const tokenActorId = t.actorId || t.data?.actorId;
                                return tokenActorId === actor.id;
                            });
                            if (sceneTokens.length > 0) {
                                tokens.push(...sceneTokens);
                                // Update stored location with the first token found
                                await this._updateTokenLocation(actor, sceneTokens[0]);
                            }
                        }
                    }
                }
            }
            
            if (tokens.length === 0) {
                console.log("WoD Equipment Effects: No tokens found, updating prototype token");
                // No tokens found - update prototype token so new tokens won't have light
                // CRITICAL: Only update prototype token if user has permission
                if (game.user.isGM || actor.isOwner) {
                    await actor.update({ "prototypeToken.light": defaultLightData });
                    console.log("WoD Equipment Effects: Prototype token updated");
                }
            } else {
                console.log("WoD Equipment Effects: Found tokens, updating", { tokenCount: tokens.length });
                // Update all found tokens
                for (const token of tokens) {
                    try {
                        // CRITICAL: Verify token belongs to the correct actor
                        const tokenDoc = token.document || token;
                        const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
                        
                        // Double-check: token must belong to the actor we're modifying
                        if (tokenActorId !== actor.id) {
                            console.warn("WoD Equipment Effects: Token does not belong to actor, skipping light removal", {
                                tokenActorId: tokenActorId,
                                targetActorId: actor.id,
                                tokenId: tokenDoc.id
                            });
                            continue;
                        }
                        
                        // Check permissions - only GM or actor owner can update tokens
                        const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                        
                        if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                            continue;
                        }
                        
                        // Handle both Token and TokenDocument
                        if (token.document) {
                            console.log("WoD Equipment Effects: Updating token via document", { tokenId: token.id });
                            await token.document.update({ light: defaultLightData });
                            console.log("WoD Equipment Effects: Token updated successfully");
                        } else if (token.update) {
                            console.log("WoD Equipment Effects: Updating token directly", { tokenId: token.id });
                            await token.update({ light: defaultLightData });
                            console.log("WoD Equipment Effects: Token updated successfully");
                        }
                    } catch (error) {
                        console.error("WoD Equipment Effects: Error removing light", error);
                    }
                }
            }
        } else {
            // Other items have light - recalculate from the map (no race conditions)
            console.log("WoD Equipment Effects: Other items have light, recalculating");
            await this._recalculateLightFromMap(actor);
        }
    }

    /**
     * Apply visibility effect (scanner, etc.)
     * @param {Actor} actor - The actor
     * @param {Item} item - The item providing the visibility
     * @param {Object} visibilityConfig - Visibility configuration
     * @param {Token|TokenDocument} specificToken - Optional: specific token to apply effect to (when token is just created)
     */
    async _applyVisibilityEffect(actor, item, visibilityConfig, specificToken = null) {
        console.log("WoD Equipment Effects: _applyVisibilityEffect called", { 
            actorId: actor.id, 
            itemId: item.id,
            hasSpecificToken: !!specificToken
        });
        
        // Get tokens - use specific token if provided (just created), then stored location, then fallback
        let tokens = [];
        
        // Method 1: Use specific token if provided (token just created)
        if (specificToken) {
            console.log("WoD Equipment Effects: Using specific token provided for visibility", { tokenId: specificToken.id || specificToken.document?.id });
            tokens.push(specificToken);
        } else {
            // Method 2: Try stored token location first
            const storedToken = await this._getStoredToken(actor);
            if (storedToken) {
                tokens.push(storedToken);
            } else {
                // Method 3: Fallback to getActiveTokens
                tokens = actor.getActiveTokens(true);
            }
        }
        
        if (tokens.length === 0) {
            return;
        }
        
        for (const token of tokens) {
            // CRITICAL: Verify token belongs to the correct actor
            const tokenDoc = token.document || token;
            const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
            
            // Double-check: token must belong to the actor we're modifying
            if (tokenActorId !== actor.id) {
                console.warn("WoD Equipment Effects: Token does not belong to actor, skipping visibility update", {
                    tokenActorId: tokenActorId,
                    targetActorId: actor.id,
                    tokenId: tokenDoc.id
                });
                continue;
            }
            
            // Check permissions - only GM or actor owner can update tokens
            const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
            
            if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                continue;
            }
            
            const updates = {};

            // Set sight range (dim sight)
            if (visibilityConfig.dimSight !== undefined && visibilityConfig.dimSight > 0) {
                updates["sight.range"] = visibilityConfig.dimSight;
            }

            // Set bright sight range (for modes that support it)
            // Note: Foundry uses sight.range for dim and doesn't have a separate bright range
            // brightSight is typically the same as dimSight or represents enhanced vision range
            if (visibilityConfig.brightSight !== undefined && visibilityConfig.brightSight > 0) {
                // For most vision modes, bright sight is the same as dim sight
                // But we can use it to set a higher range if needed
                if (visibilityConfig.brightSight > (visibilityConfig.dimSight || 0)) {
                    updates["sight.range"] = visibilityConfig.brightSight;
                }
            }

            // Set vision mode
            if (visibilityConfig.visionMode !== undefined) {
                updates["sight.visionMode"] = visibilityConfig.visionMode;
            }

            // Set angle only for directional vision modes
            // Omnidirectional modes (darkvision, tremorsense, blindsight, truesight, xray) should use 360
            const directionalModes = ["basic", "lowlight"];
            const visionMode = visibilityConfig.visionMode || "basic";
            
            if (directionalModes.includes(visionMode)) {
                // For directional modes, use the configured angle (default 360 = full circle)
                if (visibilityConfig.angle !== undefined) {
                    updates["sight.angle"] = visibilityConfig.angle;
                } else {
                    updates["sight.angle"] = 360; // Default to full circle
                }
            } else {
                // For omnidirectional modes, always use 360 (full circle)
                updates["sight.angle"] = 360;
            }

            if (Object.keys(updates).length > 0) {
                // Handle both Token and TokenDocument
                if (token.document) {
                    await token.document.update(updates);
                } else if (token.update) {
                    await token.update(updates);
                }
            }
        }
    }

    /**
     * Remove visibility effect
     * @param {Actor} actor - The actor
     * @param {string} itemId - The item ID
     */
    async _removeVisibilityEffect(actor, itemId) {
        console.log("WoD Equipment Effects: _removeVisibilityEffect called", { actorId: actor.id, itemId });
        
        const actorId = actor.id;
        
        // CRITICAL: The item has already been removed from the map in _removeItemEffects
        // So we can directly check if other items have visibility effects
        const hasOtherVisibility = this._hasOtherVisibilitySourceFromMap(actorId);
        console.log("WoD Equipment Effects: Has other visibility sources?", { hasOtherVisibility });
        
        // Get tokens using stored location or fallback
        let tokens = [];
        const storedToken = await this._getStoredToken(actor);
        if (storedToken) {
            tokens.push(storedToken);
        } else {
            tokens = actor.getActiveTokens(true);
        }
        
        if (!hasOtherVisibility) {
            // Reset to default visibility
            if (tokens.length === 0) {
                tokens = actor.getActiveTokens(true);
            }
            
            for (const token of tokens) {
                // CRITICAL: Verify token belongs to the correct actor
                const tokenDoc = token.document || token;
                const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
                
                // Double-check: token must belong to the actor we're modifying
                if (tokenActorId !== actor.id) {
                    console.warn("WoD Equipment Effects: Token does not belong to actor, skipping visibility reset", {
                        tokenActorId: tokenActorId,
                        targetActorId: actor.id,
                        tokenId: tokenDoc.id
                    });
                    continue;
                }
                
                // Check permissions - only GM or actor owner can update tokens
                const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                
                if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                    continue;
                }
                
                // Handle both Token and TokenDocument
                if (token.document) {
                    await token.document.update({ 
                        "sight.range": token.actor?.system?.attributes?.perception || 0,
                        "sight.angle": 360
                    });
                } else if (token.update) {
                    await token.update({ 
                        "sight.range": token.actor?.system?.attributes?.perception || 0,
                        "sight.angle": 360
                    });
                }
            }
        } else {
            // Other items have visibility - recalculate from the map (no race conditions)
            await this._recalculateVisibilityFromMap(actor);
        }
    }

    /**
     * Apply sound effect
     * @param {Actor} actor - The actor
     * @param {Item} item - The item providing the sound
     * @param {Object} soundConfig - Sound configuration
     */
    async _applySoundEffect(actor, item, soundConfig) {
        if (soundConfig.file) {
            // Play sound file
            AudioHelper.play({
                src: soundConfig.file,
                volume: soundConfig.volume !== undefined ? soundConfig.volume : 0.5,
                loop: soundConfig.loop || false
            });
        }
    }

    /**
     * Remove sound effect
     * @param {Actor} actor - The actor
     * @param {string} itemId - The item ID
     */
    async _removeSoundEffect(actor, itemId) {
        // Sound effects are typically one-time or looped, handled by AudioHelper
        // No cleanup needed unless we're tracking specific sound instances
    }

    /**
     * Check if there are other light sources in the activeEffects map
     * This uses the map directly, avoiding race conditions with database state
     * @param {string} actorId - The actor ID
     * @returns {boolean}
     */
    _hasOtherLightSourceFromMap(actorId) {
        if (!this.activeEffects.has(actorId)) {
            return false;
        }
        
        const actorEffects = this.activeEffects.get(actorId);
        
        // Check if any item in the map has a light effect with actual values
        for (const [itemId, effects] of actorEffects.entries()) {
            if (effects.light !== null && effects.light !== undefined) {
                const lightEffect = effects.light;
                // Verify the light effect has actual values
                const hasLightValue = (lightEffect.dim > 0) || (lightEffect.bright > 0);
                if (hasLightValue) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Check if actor has other light sources (legacy method - uses database state)
     * @deprecated Use _hasOtherLightSourceFromMap instead to avoid race conditions
     * @param {Actor} actor - The actor
     * @param {string} excludeItemId - Item ID to exclude from check
     * @returns {boolean}
     */
    _hasOtherLightSource(actor, excludeItemId) {
        // CRITICAL: Only check items if user has permission to view the actor
        if (!game.user.isGM && !actor.isOwner) {
            return false;
        }
        
        // Check for items that are equipped AND have a non-null light effect
        // CRITICAL: Also verify that the light effect has actual values (dim > 0 or bright > 0)
        // and that the excluded item is not equipped (double-check to prevent race conditions)
        const equippedItems = actor.items.filter(item => {
            // Skip if item is not equipped
            if (!item.system?.equipped) return false;
            
            // CRITICAL: Double-check - skip the item we're removing even if it still appears equipped
            // This prevents race conditions where the item update hasn't propagated yet
            if (item.id === excludeItemId) {
                // Extra safety: if this is the excluded item, verify it's actually not equipped
                // If it's still marked as equipped, it means the update hasn't propagated yet
                return false;
            }
            
            // Only count items that have an actual light effect (not null/undefined)
            const lightEffect = item.system?.equipmentEffects?.light;
            if (lightEffect === null || lightEffect === undefined) return false;
            
            // CRITICAL: Also verify the light effect has actual values
            // An empty light effect object shouldn't count as a light source
            const hasLightValue = (lightEffect.dim > 0) || (lightEffect.bright > 0);
            return hasLightValue;
        });
        return equippedItems.length > 0;
    }

    /**
     * Check if there are other visibility sources in the activeEffects map
     * This uses the map directly, avoiding race conditions with database state
     * @param {string} actorId - The actor ID
     * @returns {boolean}
     */
    _hasOtherVisibilitySourceFromMap(actorId) {
        if (!this.activeEffects.has(actorId)) {
            return false;
        }
        
        const actorEffects = this.activeEffects.get(actorId);
        
        // Check if any item in the map has a visibility effect
        for (const [itemId, effects] of actorEffects.entries()) {
            if (effects.visibility !== null && effects.visibility !== undefined) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if actor has other visibility sources (legacy method - uses database state)
     * @deprecated Use _hasOtherVisibilitySourceFromMap instead to avoid race conditions
     * @param {Actor} actor - The actor
     * @param {string} excludeItemId - Item ID to exclude from check
     * @returns {boolean}
     */
    _hasOtherVisibilitySource(actor, excludeItemId) {
        // CRITICAL: Only check items if user has permission to view the actor
        if (!game.user.isGM && !actor.isOwner) {
            return false;
        }
        
        const equippedItems = actor.items.filter(item => 
            item.system?.equipped && 
            item.id !== excludeItemId && 
            item.system?.equipmentEffects?.visibility
        );
        return equippedItems.length > 0;
    }

    /**
     * Recalculate light from the activeEffects map (avoids race conditions)
     * @param {Actor} actor - The actor
     */
    async _recalculateLightFromMap(actor) {
        // CRITICAL: Only recalculate if user has permission
        if (!game.user.isGM && !actor.isOwner) {
            console.debug("WoD Equipment Effects: User does not have permission to recalculate light", {
                userId: game.user.id,
                actorId: actor.id
            });
            return;
        }
        
        const actorId = actor.id;
        
        // Get all items with light effects from the map
        const itemsWithLight = [];
        if (this.activeEffects.has(actorId)) {
            const actorEffects = this.activeEffects.get(actorId);
            
            for (const [itemId, effects] of actorEffects.entries()) {
                if (effects.light !== null && effects.light !== undefined) {
                    const lightEffect = effects.light;
                    // Verify the light effect has actual values
                    const hasLightValue = (lightEffect.dim > 0) || (lightEffect.bright > 0);
                    if (hasLightValue) {
                        // Get the item to pass to _applyLightEffect
                        const item = actor.items.get(itemId);
                        if (item) {
                            itemsWithLight.push({ item, light: lightEffect });
                        }
                    }
                }
            }
        }
        
        // If no items with light, reset to default
        if (itemsWithLight.length === 0) {
            const defaultLightData = {
                dim: 0,
                bright: 0,
                angle: 360,
                color: "#000000",
                alpha: 0.5,
                darkness: { min: 0, max: 1 },
                animation: null
            };
            
            let tokens = [];
            const storedToken = await this._getStoredToken(actor);
            if (storedToken) {
                tokens.push(storedToken);
            } else {
                tokens = actor.getActiveTokens(true);
            }
            
            if (tokens.length === 0) {
                if (game.user.isGM || actor.isOwner) {
                    await actor.update({ "prototypeToken.light": defaultLightData });
                }
            } else {
                for (const token of tokens) {
                    try {
                        // CRITICAL: Verify token belongs to the correct actor
                        const tokenDoc = token.document || token;
                        const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
                        
                        // Double-check: token must belong to the actor we're modifying
                        if (tokenActorId !== actor.id) {
                            console.warn("WoD Equipment Effects: Token does not belong to actor, skipping light reset in recalculate", {
                                tokenActorId: tokenActorId,
                                targetActorId: actor.id,
                                tokenId: tokenDoc.id
                            });
                            continue;
                        }
                        
                        const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                        
                        if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                            continue;
                        }
                        
                        if (token.document) {
                            await token.document.update({ light: defaultLightData });
                        } else if (token.update) {
                            await token.update({ light: defaultLightData });
                        }
                    } catch (error) {
                        console.error("WoD Equipment Effects: Error resetting light in recalculate", error);
                    }
                }
            }
            return;
        }

        // Find the strongest light source (highest bright value)
        let strongestLight = null;
        let strongestItem = null;
        let maxBright = 0;

        for (const { item, light } of itemsWithLight) {
            if (light.bright > maxBright) {
                maxBright = light.bright;
                strongestLight = light;
                strongestItem = item;
            }
        }

        if (strongestLight && strongestItem) {
            console.log("WoD Equipment Effects: Applying strongest light from recalculate", { itemId: strongestItem.id, bright: strongestLight.bright });
            await this._applyLightEffect(actor, strongestItem, strongestLight);
        }
    }

    /**
     * Recalculate visibility from the activeEffects map (avoids race conditions)
     * @param {Actor} actor - The actor
     */
    async _recalculateVisibilityFromMap(actor) {
        // CRITICAL: Only recalculate if user has permission
        if (!game.user.isGM && !actor.isOwner) {
            console.debug("WoD Equipment Effects: User does not have permission to recalculate visibility", {
                userId: game.user.id,
                actorId: actor.id
            });
            return;
        }
        
        const actorId = actor.id;
        
        // Get all items with visibility effects from the map
        const itemsWithVisibility = [];
        if (this.activeEffects.has(actorId)) {
            const actorEffects = this.activeEffects.get(actorId);
            
            for (const [itemId, effects] of actorEffects.entries()) {
                if (effects.visibility !== null && effects.visibility !== undefined) {
                    // Get the item to pass to _applyVisibilityEffect
                    const item = actor.items.get(itemId);
                    if (item) {
                        itemsWithVisibility.push({ item, visibility: effects.visibility });
                    }
                }
            }
        }
        
        // Find the best visibility source (highest dimSight)
        let bestVisibility = null;
        let bestItem = null;
        let maxDimSight = 0;

        for (const { item, visibility } of itemsWithVisibility) {
            if (visibility.dimSight > maxDimSight) {
                maxDimSight = visibility.dimSight;
                bestVisibility = visibility;
                bestItem = item;
            }
        }

        if (bestVisibility && bestItem) {
            await this._applyVisibilityEffect(actor, bestItem, bestVisibility);
        }
    }

    /**
     * Recalculate visibility from all equipped items (legacy method - uses database state)
     * @deprecated Use _recalculateVisibilityFromMap instead to avoid race conditions
     * @param {Actor} actor - The actor
     */
    async _recalculateVisibility(actor) {
        // CRITICAL: Only recalculate if user has permission
        if (!game.user.isGM && !actor.isOwner) {
            console.debug("WoD Equipment Effects: User does not have permission to recalculate visibility", {
                userId: game.user.id,
                actorId: actor.id
            });
            return;
        }
        
        const equippedItems = actor.items.filter(item => 
            item.system?.equipped && 
            item.system?.equipmentEffects?.visibility
        );

        // Find the best visibility source (highest dimSight)
        let bestVisibility = null;
        let maxDimSight = 0;

        for (const item of equippedItems) {
            const visibility = item.system.equipmentEffects.visibility;
            if (visibility.dimSight > maxDimSight) {
                maxDimSight = visibility.dimSight;
                bestVisibility = visibility;
            }
        }

        if (bestVisibility) {
            await this._applyVisibilityEffect(actor, equippedItems.find(i => 
                i.system.equipmentEffects.visibility === bestVisibility
            ), bestVisibility);
        }
    }

    /**
     * Apply all effects for an actor (used when token is created/updated)
     * @param {Actor} actor - The actor
     * @param {Token|TokenDocument} specificToken - Optional: specific token to apply effects to (when token is just created)
     */
    async _applyActorEffects(actor, specificToken = null) {
        if (!actor) return;
        
        console.log("WoD Equipment Effects: _applyActorEffects called", { 
            actorId: actor.id, 
            actorName: actor.name,
            hasSpecificToken: !!specificToken
        });
        
        // CRITICAL: Only apply effects if user has permission
        if (!game.user.isGM && !actor.isOwner) {
            console.debug("WoD Equipment Effects: User does not have permission to apply actor effects", {
                userId: game.user.id,
                actorId: actor.id
            });
            return;
        }

        // Get all equipped items with effects
        const equippedItems = actor.items.filter(item => 
            item.system?.equipped && 
            item.system?.equipmentEffects &&
            Object.values(item.system.equipmentEffects).some(e => e !== null)
        );

        console.log("WoD Equipment Effects: Found equipped items with effects", { 
            count: equippedItems.length,
            items: equippedItems.map(item => ({ id: item.id, name: item.name, effects: item.system.equipmentEffects }))
        });

        // Apply effects for each equipped item
        for (const item of equippedItems) {
            const effects = item.system.equipmentEffects;
            console.log("WoD Equipment Effects: Applying effects for item", { itemId: item.id, itemName: item.name, effects });
            
            // If we have a specific token (just created), pass it to apply methods
            await this._applyItemEffects(actor, item, effects, specificToken);
        }
        
        console.log("WoD Equipment Effects: _applyActorEffects completed");
    }

    /**
     * Update all tokens for an actor
     * @param {Actor} actor - The actor
     */
    async _updateActorTokens(actor) {
        const tokens = actor.getActiveTokens();
        // Effects are applied directly to tokens in _applyItemEffects
        // This method can be used for additional token updates if needed
    }
}
