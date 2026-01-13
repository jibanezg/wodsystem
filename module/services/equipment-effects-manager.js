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

        // Hook into item updates to detect equipment changes
        Hooks.on("updateItem", async (item, updateData, options, userId) => {
            if (updateData.system?.equipped !== undefined) {
                // CRITICAL: Only process if the current user is the one who made the change
                // or if they are GM/owner of the actor
                const actor = item.actor || (item.actorId ? game.actors.get(item.actorId) : null);
                if (actor && (game.user.isGM || actor.isOwner)) {
                    // Wait for the update to complete, then get the fresh item
                    await new Promise(resolve => setTimeout(resolve, 0));
                    const freshItem = item.actor?.items?.get(item.id) || item;
                    manager._handleEquipmentChange(freshItem, updateData.system.equipped);
                } else {
                    console.debug("WoD Equipment Effects: Skipping equipment change - user does not have permission", {
                        userId: game.user.id,
                        actorId: actor?.id
                    });
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
        Hooks.on("deleteItem", (item, options, userId) => {
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
                    manager._handleEquipmentChange(item, false);
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
                    // Store token location in actor flags only
                    await manager._updateTokenLocation(actor, token);
                    // Apply effects only once when token is created
                    await manager._applyActorEffects(actor);
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

        console.log("WoD | Equipment Effects Manager initialized");
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
            console.log("WoD Equipment Effects: _getStoredToken - No actor provided");
            return null;
        }
        
        const location = actor.flags?.wodsystem?.tokenLocation;
        console.log("WoD Equipment Effects: _getStoredToken - Checking location", {
            actorName: actor.name,
            actorId: actor.id,
            hasLocation: !!location,
            tokenId: location?.tokenId,
            sceneId: location?.sceneId
        });
        
        if (!location || !location.tokenId || !location.sceneId) {
            console.log("WoD Equipment Effects: _getStoredToken - No valid location stored");
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
                    console.log("WoD Equipment Effects: _getStoredToken - Found different token for actor, updating stored location", {
                        oldTokenId: location.tokenId,
                        newTokenId: tokenDoc.id
                    });
                    await this._updateTokenLocation(actor, tokenDoc);
                } else {
                    console.warn("WoD Equipment Effects: _getStoredToken - No token found for actor in scene");
                    return null;
                }
            }
            
            // Verify the token is actually linked to this actor
            const tokenActorId = tokenDoc.actorId || tokenDoc.data?.actorId;
            if (tokenActorId !== actor.id) {
                console.warn("WoD Equipment Effects: _getStoredToken - Token not linked to actor", {
                    tokenActorId: tokenActorId,
                    targetActorId: actor.id
                });
                return null;
            }
            
            // If scene is active, try to get the canvas token
            if (scene.active && canvas && canvas.tokens) {
                const canvasToken = canvas.tokens.get(location.tokenId);
                if (canvasToken) {
                    console.log("WoD Equipment Effects: _getStoredToken - Returning canvas token");
                    return canvasToken.object || canvasToken;
                }
            }
            
            // Return TokenDocument as fallback
            console.log("WoD Equipment Effects: _getStoredToken - Returning TokenDocument");
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
        console.log("WoD Equipment Effects: _handleEquipmentChange called", {
            itemName: item.name,
            itemId: item.id,
            isEquipped: isEquipped
        });
        
        // Get actor from item - try multiple methods
        let actor = item.actor;
        if (!actor && item.parent) {
            actor = item.parent;
        }
        if (!actor && item.actorId) {
            actor = game.actors.get(item.actorId);
        }
        
        if (!actor) {
            console.warn("WoD Equipment Effects: Item has no actor", item.name, item.id, {
                hasActor: !!item.actor,
                hasParent: !!item.parent,
                actorId: item.actorId
            });
            return;
        }
        
        // CRITICAL: Verify user has permission to modify this actor's items
        if (!game.user.isGM && !actor.isOwner) {
            console.warn("WoD Equipment Effects: User does not have permission to modify actor's equipment", {
                userId: game.user.id,
                userName: game.user.name,
                actorId: actor.id,
                actorName: actor.name,
                itemId: item.id,
                itemName: item.name,
                isOwner: actor.isOwner
            });
            return;
        }
        
        const actorId = actor.id;
        const itemId = item.id;

        // Get equipment effects configuration from item
        const effects = item.system?.equipmentEffects || {};

        // Check if there are any actual effects configured (not null)
        const hasEffects = effects.light !== null || effects.visibility !== null || effects.sound !== null;

        console.log("WoD Equipment Effects: Equipment change", {
            isEquipped: isEquipped,
            hasEffects: hasEffects,
            effects: effects
        });

        if (isEquipped && hasEffects) {
            // Apply effects
            console.log("WoD Equipment Effects: Applying effects");
            await this._applyItemEffects(actor, item, effects);
        } else if (!isEquipped) {
            // Remove effects
            console.log("WoD Equipment Effects: Removing effects");
            await this._removeItemEffects(actor, itemId);
        }
    }

    /**
     * Apply effects from an equipped item
     * @param {Actor} actor - The actor
     * @param {Item} item - The equipped item
     * @param {Object} effects - Effects configuration
     */
    async _applyItemEffects(actor, item, effects) {
        console.log("WoD Equipment Effects: _applyItemEffects called", {
            actorName: actor.name,
            actorId: actor.id,
            itemName: item.name,
            itemId: item.id,
            effects: effects
        });
        
        const actorId = actor.id;
        const itemId = item.id;

        // Store effect data
        if (!this.activeEffects.has(actorId)) {
            this.activeEffects.set(actorId, new Map());
        }
        this.activeEffects.get(actorId).set(itemId, effects);
        
        console.log("WoD Equipment Effects: Stored effects in activeEffects", {
            actorId: actorId,
            itemId: itemId,
            storedEffects: this.activeEffects.get(actorId).get(itemId),
            allActiveEffects: Array.from(this.activeEffects.get(actorId).keys())
        });

        // Apply each effect type (only if not null)
        if (effects.light !== null && effects.light !== undefined) {
            await this._applyLightEffect(actor, item, effects.light);
        }

        if (effects.visibility !== null && effects.visibility !== undefined) {
            await this._applyVisibilityEffect(actor, item, effects.visibility);
        }

        if (effects.sound !== null && effects.sound !== undefined) {
            await this._applySoundEffect(actor, item, effects.sound);
        }

        // Update tokens
        await this._updateActorTokens(actor);
    }

    /**
     * Remove effects from an unequipped item
     * @param {Actor} actor - The actor
     * @param {string} itemId - The item ID
     */
    async _removeItemEffects(actor, itemId) {
        console.log("WoD Equipment Effects: _removeItemEffects called", {
            actorName: actor.name,
            actorId: actor.id,
            itemId: itemId
        });
        
        const actorId = actor.id;

        if (!this.activeEffects.has(actorId)) {
            console.log("WoD Equipment Effects: No active effects for actor", {
                actorId: actorId,
                allActiveEffectsKeys: Array.from(this.activeEffects.keys())
            });
            return;
        }

        const actorEffects = this.activeEffects.get(actorId);
        console.log("WoD Equipment Effects: Actor effects map", {
            actorId: actorId,
            itemIdsInMap: Array.from(actorEffects.keys()),
            targetItemId: itemId
        });
        
        const effects = actorEffects.get(itemId);

        if (!effects) {
            console.log("WoD Equipment Effects: No effects found for item", {
                itemId: itemId,
                availableItemIds: Array.from(actorEffects.keys())
            });
            return;
        }

        console.log("WoD Equipment Effects: Removing effects", effects);

        // Remove each effect type
        if (effects.light) {
            await this._removeLightEffect(actor, itemId);
        }

        if (effects.visibility) {
            await this._removeVisibilityEffect(actor, itemId);
        }

        if (effects.sound) {
            await this._removeSoundEffect(actor, itemId);
        }

        // Remove from active effects
        actorEffects.delete(itemId);
        if (actorEffects.size === 0) {
            this.activeEffects.delete(actorId);
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
    async _applyLightEffect(actor, item, lightConfig) {
        console.log("WoD Equipment Effects: _applyLightEffect called", {
            actorName: actor.name,
            actorId: actor.id,
            itemName: item.name,
            lightConfig: lightConfig
        });
        
        if (!lightConfig || (lightConfig.dim === 0 && lightConfig.bright === 0)) {
            console.log("WoD Equipment Effects: No light to apply (dim and bright are 0)");
            return;
        }

        // Get tokens - use stored location first, then quick fallback
        let tokens = [];
        
        // Method 1: Try stored token location (most reliable and fastest)
        const storedToken = await this._getStoredToken(actor);
        if (storedToken) {
            tokens.push(storedToken);
            console.log("WoD Equipment Effects: ✓ Found stored token", {
                tokenId: storedToken.id || storedToken.document?.id,
                sceneId: storedToken.scene?.id || storedToken.sceneId || storedToken.document?.sceneId
            });
        } else {
            console.log("WoD Equipment Effects: No stored token found, trying getActiveTokens");
            // Method 2: Quick fallback - getActiveTokens (only if stored location not available)
            try {
                const activeTokens = actor.getActiveTokens(true);
                console.log("WoD Equipment Effects: getActiveTokens returned", activeTokens.length, "token(s)");
                if (activeTokens.length > 0) {
                    tokens.push(...activeTokens);
                    // Store location for future use
                    await this._updateTokenLocation(actor, activeTokens[0]);
                    console.log("WoD Equipment Effects: Stored token location for future use");
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
                                console.log("WoD Equipment Effects: Found token in stored scene, updated location");
                            }
                        } else if (scene && !game.user.isGM && !scene.testUserPermission(game.user, "LIMITED")) {
                            console.debug("WoD Equipment Effects: User does not have access to stored scene", {
                                userId: game.user.id,
                                sceneId: location.sceneId
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn("WoD Equipment Effects: getActiveTokens failed", e);
            }
        }
        
        console.log("WoD Equipment Effects: Total tokens to update:", tokens.length);
        
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
            console.log("WoD Equipment Effects: Updating token light", {
                tokenId: token.id || token.document?.id,
                tokenName: token.name || token.document?.name,
                hasDocument: !!token.document,
                hasUpdate: !!token.update,
                lightData: lightData
            });
            
            try {
                // Check permissions - only GM or actor owner can update tokens
                const tokenDoc = token.document || token;
                const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                
                if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                    console.warn("WoD Equipment Effects: User does not have permission to update this token", {
                        userId: game.user.id,
                        userName: game.user.name,
                        actorId: tokenActor.id,
                        actorName: tokenActor.name,
                        isOwner: tokenActor.isOwner
                    });
                    continue;
                }
                
                // Check if token is a Token (has .document property)
                if (token.document) {
                    // It's a Token (from getActiveTokens or scene.tokens when active)
                    await token.document.update({ light: lightData });
                    console.log("WoD Equipment Effects: ✓ Light updated via token.document.update");
                } 
                // Check if token is a TokenDocument (has .update method directly)
                else if (token.update) {
                    // It's a TokenDocument (from scene.tokens when scene is not active)
                    await token.update({ light: lightData });
                    console.log("WoD Equipment Effects: ✓ Light updated via token.update");
                } 
                // Check if token has data property (might be raw data)
                else if (token.data && token.scene) {
                    // Try to get the TokenDocument from the scene
                    const scene = game.scenes.get(token.scene.id || token.scene);
                    // CRITICAL: Verify user has access to the scene
                    if (scene && (game.user.isGM || scene.testUserPermission(game.user, "LIMITED"))) {
                        const tokenDoc = scene.tokens.get(token.id || token.data._id);
                        if (tokenDoc) {
                            // Verify permissions again for the token document
                            const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                            if (game.user.isGM || (tokenActor && tokenActor.isOwner)) {
                                await tokenDoc.update({ light: lightData });
                                console.log("WoD Equipment Effects: ✓ Light updated via scene lookup");
                            } else {
                                console.debug("WoD Equipment Effects: User does not have permission to update token via scene lookup");
                            }
                        } else {
                            console.warn("WoD Equipment Effects: TokenDocument not found in scene");
                        }
                    } else if (scene && !game.user.isGM && !scene.testUserPermission(game.user, "LIMITED")) {
                        console.debug("WoD Equipment Effects: User does not have access to scene for token update");
                    } else {
                        console.warn("WoD Equipment Effects: Scene not found");
                    }
                } else {
                    console.warn("WoD Equipment Effects: Unknown token type", {
                        hasDocument: !!token.document,
                        hasUpdate: !!token.update,
                        hasData: !!token.data,
                        hasScene: !!token.scene
                    });
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
        console.log("WoD Equipment Effects: _removeLightEffect called", {
            actorName: actor.name,
            actorId: actor.id,
            itemId: itemId
        });
        
        // Check if other equipped items provide light
        const hasOtherLight = this._hasOtherLightSource(actor, itemId);
        console.log("WoD Equipment Effects: Has other light source?", hasOtherLight);
        
        if (!hasOtherLight) {
            // Reset to default light (completely disable)
            const defaultLightData = {
                dim: 0,
                bright: 0,
                angle: 360,
                color: "#000000",
                alpha: 0.5,
                darkness: { min: 0, max: 1 }
            };
            
            let tokens = [];
            const storedToken = await this._getStoredToken(actor);
            if (storedToken) {
                tokens.push(storedToken);
                console.log("WoD Equipment Effects: Using stored token to remove light");
            } else {
                // Try getActiveTokens first
                tokens = actor.getActiveTokens(true);
                console.log("WoD Equipment Effects: Using getActiveTokens, found", tokens.length, "token(s)");
                
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
                                console.log("WoD Equipment Effects: Found token in stored scene, updated location");
                            }
                        }
                    }
                }
            }
            
            console.log("WoD Equipment Effects: Removing light from", tokens.length, "token(s)");
            
            if (tokens.length === 0) {
                // No tokens found - update prototype token so new tokens won't have light
                // CRITICAL: Only update prototype token if user has permission
                if (game.user.isGM || actor.isOwner) {
                    await actor.update({ "prototypeToken.light": defaultLightData });
                    console.log("WoD Equipment Effects: ✓ Light removed from prototype token");
                } else {
                    console.debug("WoD Equipment Effects: User does not have permission to update prototype token");
                }
            } else {
                // Update all found tokens
                for (const token of tokens) {
                    try {
                        // Check permissions - only GM or actor owner can update tokens
                        const tokenDoc = token.document || token;
                        const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                        
                        if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                            console.warn("WoD Equipment Effects: User does not have permission to update this token", {
                                userId: game.user.id,
                                userName: game.user.name,
                                actorId: tokenActor?.id,
                                actorName: tokenActor?.name,
                                isOwner: tokenActor?.isOwner
                            });
                            continue;
                        }
                        
                        // Handle both Token and TokenDocument
                        if (token.document) {
                            await token.document.update({ light: defaultLightData });
                            console.log("WoD Equipment Effects: ✓ Light removed via token.document.update");
                        } else if (token.update) {
                            await token.update({ light: defaultLightData });
                            console.log("WoD Equipment Effects: ✓ Light removed via token.update");
                        } else {
                            console.warn("WoD Equipment Effects: Cannot remove light - unknown token type");
                        }
                    } catch (error) {
                        console.error("WoD Equipment Effects: Error removing light", error);
                    }
                }
            }
        } else {
            // Recalculate light from other sources
            console.log("WoD Equipment Effects: Recalculating light from other sources");
            await this._recalculateLight(actor);
        }
    }

    /**
     * Apply visibility effect (scanner, etc.)
     * @param {Actor} actor - The actor
     * @param {Item} item - The item providing the visibility
     * @param {Object} visibilityConfig - Visibility configuration
     */
    async _applyVisibilityEffect(actor, item, visibilityConfig) {
        // Try stored token location first
        let tokens = [];
        const storedToken = await this._getStoredToken(actor);
        if (storedToken) {
            tokens.push(storedToken);
        } else {
            // Fallback to getActiveTokens
            tokens = actor.getActiveTokens(true);
        }
        
        if (tokens.length === 0) {
            console.warn("WoD Equipment Effects: No tokens found for visibility effect");
            return;
        }
        
        for (const token of tokens) {
            // Check permissions - only GM or actor owner can update tokens
            const tokenDoc = token.document || token;
            const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
            
            if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                console.warn("WoD Equipment Effects: User does not have permission to update this token");
                continue;
            }
            
            const updates = {};

            if (visibilityConfig.dimSight !== undefined) {
                updates["sight.range"] = visibilityConfig.dimSight;
            }

            if (visibilityConfig.brightSight !== undefined) {
                updates["sight.angle"] = visibilityConfig.brightSight;
            }

            if (visibilityConfig.visionMode !== undefined) {
                updates["visionMode"] = visibilityConfig.visionMode;
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
        // Check if other equipped items provide visibility
        const hasOtherVisibility = this._hasOtherVisibilitySource(actor, itemId);
        
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
                // Check permissions - only GM or actor owner can update tokens
                const tokenDoc = token.document || token;
                const tokenActor = tokenDoc.actor || (tokenDoc.actorId ? game.actors.get(tokenDoc.actorId) : null);
                
                if (!game.user.isGM && tokenActor && !tokenActor.isOwner) {
                    console.warn("WoD Equipment Effects: User does not have permission to update this token");
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
            // Recalculate visibility from other sources
            await this._recalculateVisibility(actor);
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
     * Check if actor has other light sources
     * @param {Actor} actor - The actor
     * @param {string} excludeItemId - Item ID to exclude from check
     * @returns {boolean}
     */
    _hasOtherLightSource(actor, excludeItemId) {
        const equippedItems = actor.items.filter(item => 
            item.system?.equipped && 
            item.id !== excludeItemId && 
            item.system?.equipmentEffects?.light
        );
        return equippedItems.length > 0;
    }

    /**
     * Check if actor has other visibility sources
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
     * Recalculate light from all equipped items
     * @param {Actor} actor - The actor
     */
    async _recalculateLight(actor) {
        // CRITICAL: Only recalculate if user has permission
        if (!game.user.isGM && !actor.isOwner) {
            console.debug("WoD Equipment Effects: User does not have permission to recalculate light", {
                userId: game.user.id,
                actorId: actor.id
            });
            return;
        }
        
        const equippedItems = actor.items.filter(item => 
            item.system?.equipped && 
            item.system?.equipmentEffects?.light
        );

        // Find the strongest light source (highest bright value)
        let strongestLight = null;
        let maxBright = 0;

        for (const item of equippedItems) {
            const light = item.system.equipmentEffects.light;
            if (light.bright > maxBright) {
                maxBright = light.bright;
                strongestLight = light;
            }
        }

        if (strongestLight) {
            await this._applyLightEffect(actor, equippedItems.find(i => 
                i.system.equipmentEffects.light === strongestLight
            ), strongestLight);
        }
    }

    /**
     * Recalculate visibility from all equipped items
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
     */
    async _applyActorEffects(actor) {
        if (!actor) return;
        
        // CRITICAL: Only apply effects if user has permission
        if (!game.user.isGM && !actor.isOwner) {
            console.debug("WoD Equipment Effects: User does not have permission to apply actor effects", {
                userId: game.user.id,
                actorId: actor.id
            });
            return;
        }

        const equippedItems = actor.items.filter(item => 
            item.system?.equipped && 
            item.system?.equipmentEffects &&
            Object.values(item.system.equipmentEffects).some(e => e !== null)
        );

        for (const item of equippedItems) {
            const effects = item.system.equipmentEffects;
            await this._applyItemEffects(actor, item, effects);
        }
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
