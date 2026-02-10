import { WodTriggerConfigDialog } from "../apps/wod-trigger-config-dialog.js";
import { TriggerEventRegistry } from '../services/trigger-event-registry.js';

// Track which apps have been processed to prevent duplicate injections
const _processedApps = new WeakSet();

export function registerWodTriggerTabs() {
    
    // Global context menu interception - catch all contextmenu events
    Hooks.on('ready', () => {
        console.log('WoD Trigger Tabs | Setting up global context menu interception');
        
        // Add global context menu listener
        document.addEventListener('contextmenu', (e) => {
            // Check if this is a right-click on a scene item
            const sceneItem = e.target.closest('.directory-item.scene');
            if (sceneItem && game.user.isGM) {
                console.log('WoD Trigger Tabs | Scene right-click detected globally');
                
                // Get scene data
                const sceneId = sceneItem.dataset.entryId;
                const scene = game.scenes.get(sceneId);
                
                if (scene) {
                    console.log('WoD Trigger Tabs | Found scene:', scene.name);
                    
                    // Store the scene for later use
                    window._wodCurrentScene = scene;
                    
                    // Wait for context menu to be created
                    setTimeout(() => {
                        // Look for any context menu
                        const contextMenus = document.querySelectorAll('.context-menu, .dropdown-menu, [data-context-menu], .menu, .encounter-context-menu, .scene-context, [class*="context"]');
                        console.log('WoD Trigger Tabs | Found context menus:', contextMenus.length);
                        
                        contextMenus.forEach((menu, index) => {
                            console.log(`WoD Trigger Tabs | Menu ${index}:`, menu.className, menu.tagName);
                            
                            // Only add to the main context menu container, not individual menu items
                            if (menu.tagName === 'MENU' && menu.classList.contains('context-items')) {
                                // Check if this is a scene context menu (has Configure option)
                                if (menu.textContent.includes('Configure') || menu.textContent.includes('Generate Thumbnail')) {
                                    console.log('WoD Trigger Tabs | Found scene context menu container, adding WoD Triggers');
                                    
                                    // Add our WoD Triggers option
                                    const wodOption = document.createElement('li');
                                    wodOption.className = 'context-item';
                                    wodOption.innerHTML = `
                                        <i class="fa-solid fa-shield-halved fa-fw" style="margin-right: 8px;"></i>
                                        <span>WoD Triggers</span>
                                    `;
                                    wodOption.style.cssText = `
                                        color: #dc3545;
                                        padding: 4px 8px;
                                        cursor: pointer;
                                        display: flex;
                                        align-items: center;
                                        font-size: 12px;
                                        border-bottom: 1px solid #eee;
                                    `;
                                    wodOption.addEventListener('click', () => {
                                        console.log('WoD Trigger Tabs | WoD Triggers option clicked');
                                        const scene = window._wodCurrentScene;
                                        if (scene) {
                                            _showSceneTriggersDialog(scene);
                                        }
                                        // Close the context menu
                                        menu.remove();
                                    });
                                    
                                    // Add to the menu
                                    menu.appendChild(wodOption);
                                    console.log('WoD Trigger Tabs | WoD Triggers added to main context menu');
                                    return; // Stop after finding the right menu
                                } else {
                                    console.log(`WoD Trigger Tabs | Menu ${index} is not a scene context menu, skipping`);
                                }
                            } else {
                                console.log(`WoD Trigger Tabs | Menu ${index} is not a menu container (is ${menu.tagName}), skipping`);
                            }
                        });
                        
                        // If no suitable menu found, keep checking
                        if (contextMenus.length === 0) {
                            console.log('WoD Trigger Tabs | No context menus found yet, will keep checking...');
                            let attempts = 0;
                            const checkInterval = setInterval(() => {
                                attempts++;
                                const menus = document.querySelectorAll('.context-menu, .dropdown-menu, [data-context-menu], .menu, .encounter-context-menu, .scene-context, [class*="context"]');
                                if (menus.length > 0) {
                                    console.log(`WoD Trigger Tabs | Found ${menus.length} context menus on attempt ${attempts}`);
                                    clearInterval(checkInterval);
                                    
                                    menus.forEach((menu, index) => {
                                        if (menu.textContent.includes('Configure') || menu.textContent.includes('Generate Thumbnail')) {
                                            console.log('WoD Trigger Tabs | Adding WoD Triggers to delayed context menu');
                                            
                                            const wodOption = document.createElement('li');
                                            wodOption.className = 'context-item';
                                            wodOption.innerHTML = `
                                                <i class="fa-solid fa-shield-halved fa-fw" style="margin-right: 8px;"></i>
                                                <span>WoD Triggers</span>
                                            `;
                                            wodOption.style.cssText = `
                                                color: #dc3545;
                                                padding: 4px 8px;
                                                cursor: pointer;
                                                display: flex;
                                                align-items: center;
                                                font-size: 12px;
                                                border-bottom: 1px solid #eee;
                                            `;
                                            wodOption.addEventListener('click', () => {
                                                console.log('WoD Trigger Tabs | WoD Triggers option clicked');
                                                const scene = window._wodCurrentScene;
                                                if (scene) {
                                                    _showSceneTriggersDialog(scene);
                                                }
                                                menu.remove();
                                            });
                                            
                                            menu.appendChild(wodOption);
                                            console.log('WoD Trigger Tabs | WoD Triggers added to delayed context menu');
                                            return;
                                        }
                                    });
                                }
                                
                                if (attempts > 10) {
                                    clearInterval(checkInterval);
                                    console.log('WoD Trigger Tabs | Gave up waiting for context menu');
                                }
                            }, 50);
                        }
                    }, 100);
                }
            }
        }, true); // Use capture to catch the event early
    });
    
    // V12/V13 compatible: renderTileConfig fires for both Application and ApplicationV2
    Hooks.on('renderTileConfig', async (app, html) => {
        _handleRenderHook(app, html, 'TileConfig');
    });

    Hooks.on('renderRegionConfig', async (app, html) => {
        _handleRenderHook(app, html, 'RegionConfig');
    });

    // Wall/Door configuration support (v2 architecture) - DISABLED - using context menu instead
    // Hooks.on('renderWallConfig', async (app, html) => {
    //     // Handle Wall Config - DISABLED - using context menu approach instead
    // });

    // Add wall right-click context menu support using a different approach
    Hooks.on('canvasReady', () => {
        if (!game.user.isGM) return;
        
        // Add right-click listener to canvas for walls
        const canvas = game.canvas;
        if (!canvas) return;
        
        // Listen for right-click events on the canvas
        canvas.stage.on('rightclick', (event) => {
            // Check if we're clicking on a wall
            const wall = canvas.walls.placeables.find(w => {
                const bounds = w.getBounds();
                return event.global.x >= bounds.x && event.global.x <= bounds.x + bounds.width &&
                       event.global.y >= bounds.y && event.global.y <= bounds.y + bounds.height;
            });
            
            if (wall) {
                _showWallContextMenu(wall, event);
            }
        });
    });
    
    // Function to show wall context menu
    function _showWallContextMenu(wall, event) {
        // Create a simple context menu using Foundry's Application
        const menuItems = [
            {
                name: "WoD Triggers",
                icon: '<i class="fa-solid fa-shield-halved"></i>',
                callback: () => {
                    _showWodTriggersDialog(wall.document);
                }
            }
        ];
        
        // Create a simple dropdown menu
        const menuHtml = `
            <div class="context-menu" style="position: fixed; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 200px;">
                ${menuItems.map(item => `
                    <div class="context-item" style="padding: 8px 12px; cursor: pointer; color: #dc3545; border-bottom: 1px solid #eee;">
                        ${item.icon} ${item.name}
                    </div>
                `).join('')}
            </div>
        `;
        
        // Create and show menu
        const $menu = $(menuHtml);
        $('body').append($menu);
        
        // Position menu at mouse location
        $menu.css({
            left: event.clientX + 'px',
            top: event.clientY + 'px'
        });
        
        // Handle menu item clicks
        $menu.find('.context-item').on('click', (e) => {
            const index = $(e.currentTarget).index();
            menuItems[index].callback();
            $menu.remove();
        });
        
        // Close menu when clicking outside
        $(document).one('click', () => {
            $menu.remove();
        });
    }

    // Additional wall configuration hooks for different Foundry versions - DISABLED
    // Hooks.on('renderWallSheet', async (app, html) => {
    //     console.log('WoD Trigger Tabs | WallSheet render hook triggered for:', app.constructor.name);
    //     _handleRenderHook(app, html, 'WallSheet');
    // });

    // Hooks.on('renderDoorConfig', async (app, html) => {
    //     console.log('WoD Trigger Tabs | DoorConfig render hook triggered for:', app.constructor.name);
    //     _handleRenderHook(app, html, 'DoorConfig');
    // });

    // Hooks.on('renderDoorSheet', async (app, html) => {
    //     console.log('WoD Trigger Tabs | DoorSheet render hook triggered for:', app.constructor.name);
    //     _handleRenderHook(app, html, 'DoorSheet');
    // });

    // Generic hook to catch any wall/door related configuration dialogs - DISABLED
    // Hooks.on('renderApplication', async (app, html) => {
    //     // Check if this might be a wall/door configuration dialog
    //     const appName = app.constructor.name;
    //     const appTitle = app.options?.title || '';
    //     const appClasses = app.options?.classes || [];
        
    //     if (appName.includes('Wall') || appName.includes('Door') || 
    //         appTitle.includes('Wall') || appTitle.includes('Door') ||
    //         appClasses.some(cls => cls.includes('wall') || cls.includes('door'))) {
    //         console.log('WoD Trigger Tabs | Generic wall/door hook caught:', appName, appTitle);
    //         _handleRenderHook(app, html, appName);
    //     }
    // });

    // Scene configuration support for scene-level triggers (v2 architecture)
    Hooks.on('renderSceneConfig', async (app, html) => {
        _handleRenderHook(app, html, 'SceneConfig');
    });

    // Actor sheet support for global actor-level triggers (v2 architecture)
    Hooks.on('renderActorSheet', async (app, html) => {
        _handleRenderHook(app, html, 'ActorSheet');
    });
    
    // Additional actor sheet hooks for different Foundry versions
    Hooks.on('renderActorSheetV2', async (app, html) => {
        _handleRenderHook(app, html, 'ActorSheetV2');
    });
    
    // Try all possible actor sheet hooks
    Hooks.on('renderBaseActorSheet', async (app, html) => {
        _handleRenderHook(app, html, 'BaseActorSheet');
    });
    
    // Generic actor sheet hook for custom actor types
    Hooks.on('renderSheet', async (app, html) => {
        if (app.constructor.name.includes('Actor') || app.constructor.name.includes('Demon') || app.constructor.name.includes('Werewolf') || app.constructor.name.includes('Vampire')) {
            _handleRenderHook(app, html, 'Sheet');
        }
    });

    // ApplicationV2 in V13 may also fire these hooks with different arguments
    Hooks.on('renderDocumentSheetV2', async (app, html) => {
        const docName = app?.document?.documentName;
        if (docName === 'Tile' || docName === 'Region' || docName === 'Wall' || docName === 'Scene' || docName === 'Actor') {
            _handleRenderHook(app, html, 'DocumentSheetV2');
        }
    });
}

function _handleRenderHook(app, html, source) {
    const doc = app.document || app.object;
    if (!doc) return;

    // Normalize html to jQuery - in V13 ApplicationV2, html may be an HTMLElement
    let $html;
    if (html instanceof jQuery) {
        $html = html;
    } else if (html instanceof HTMLElement) {
        $html = $(html);
    } else if (app.element instanceof HTMLElement) {
        $html = $(app.element);
    } else if (app.element instanceof jQuery) {
        $html = app.element;
    } else {
        return;
    }

    // Use different approaches based on the source
    setTimeout(() => {
        if (source === 'ActorSheet' || source === 'ActorSheetV2' || source === 'BaseActorSheet' || source === 'Sheet') {
            // For actor sheets, use the original context menu approach
            _injectWodTriggersTab(app, $html, doc).catch(() => {});
        } else if (source === 'TileConfig' || source === 'RegionConfig' || source === 'SceneConfig') {
            // For these configuration dialogs, use the new tab approach
            _addWodTriggersTabToConfigDialog(app, $html, doc);
        }
        // Wall/Door sources are excluded - they use context menu approach instead
    }, 50);
}

async function _injectWodTriggersTab(app, html, doc) {
    // Check if user is GM
    if (!game.user.isGM) return;

    // Detect document type using the registry
    const registry = TriggerEventRegistry.getInstance();
    const documentType = registry.detectDocumentType(doc);
    
    // For scene documents, use sceneTriggers flag instead of triggers
    const flagPath = documentType === 'scene' ? 'sceneTriggers' : 'triggers';
    
    // Try multiple selectors for tab navigation (V12 Application vs V13 ApplicationV2)
    const navSelectors = [
        'nav.sheet-tabs',
        'nav.tabs',
        'nav[data-group]',
        'nav[role="tablist"]',
        '.tabs[data-group]',
        '[data-application-part="tabs"]',
        // Token config specific selectors
        '.tabbed-navigation',
        '.tab-navigation',
        '.tab-list',
        'ul.tabs',
        'ol.tabs'
    ];
    let nav = null;
    for (const sel of navSelectors) {
        const found = html.find(sel).first();
        if (found.length) {
            nav = found;
            break;
        }
    }

    // Find existing tab panels to determine content root
    const tabSelectors = [
        'div.tab[data-group]',
        'section.tab[data-group]',
        'article.tab[data-group]',
        '[data-tab][data-group]',
        '.tab[data-tab]'
    ];
    let existingTab = null;
    for (const sel of tabSelectors) {
        const found = html.find(sel).first();
        if (found.length) {
            existingTab = found;
            break;
        }
    }

    // Determine content root
    let contentRoot = null;
    if (existingTab?.length) {
        contentRoot = existingTab.parent();
    } else {
        // Try multiple selectors for content root
        const bodySelectors = [
            'section.sheet-body', 
            '.sheet-body', 
            'section.content', 
            'div.content', 
            '.window-content',
            // Actor sheet specific selectors
            '.sheet-content',
            '.actor-sheet',
            '.window-content',
            'form',
            '.form-group'
        ];
        for (const sel of bodySelectors) {
            const found = html.find(sel).first();
            if (found.length) {
                contentRoot = found;
                break;
            }
        }
    }

    // Check if we found both nav and content root
    if (!nav?.length || !contentRoot?.length) {
        // For actor sheets, create a second row of GM-only tabs
        if (!nav?.length && contentRoot?.length && docName === 'Actor') {
        
        // Create GM-only tab navigation as second row
        const gmTabNav = $(`
            <nav class="sheet-tabs gm-tabs" data-group="gm-tools" style="border-top: 1px solid #ccc; margin-top: 4px; padding-top: 4px;">
                <a class="tab" data-tab="wod-triggers" data-group="gm-tools">
                    <i class="fa-solid fa-shield-halved"></i> WoD Triggers (GM)
                </a>
            </nav>
        `);
        
        // Insert after existing tabs or at the beginning of content
        const existingTabs = html.find('nav.sheet-tabs').first();
        if (existingTabs.length) {
            existingTabs.after(gmTabNav);
        } else {
            contentRoot.before(gmTabNav);
        }
        
        nav = gmTabNav;
    }
    
    // Aggressive fallback for actor sheets - create entire structure if needed
    if (!nav?.length && !contentRoot?.length && docName === 'Actor') {
        
        // Create complete tab structure
        const tabStructure = $(`
            <nav class="sheet-tabs" data-group="sheet">
                <a class="tab" data-tab="wod-triggers" data-group="sheet">
                    <i class="fas fa-bolt"></i> WoD Triggers
                </a>
            </nav>
            <section class="sheet-body" data-tab="wod-triggers" data-group="sheet">
                <div class="wod-triggers-content">
                    <p>WoD Triggers will be loaded here...</p>
                </div>
            </section>
        `);
        
        // Append to the main content
        html.append(tabStructure);
        nav = tabStructure.find('nav');
        contentRoot = tabStructure.find('section.sheet-body');
    }
    
        return;
    }

    const group = nav.attr('data-group') || existingTab?.attr('data-group') || 'sheet';

    // Avoid double injection
    if (html.find('[data-tab="wod-triggers"]').length) return;

    // Determine nav item element type (a or button based on existing items)
    const existingNavItem = nav.find('a.item, button.item').first();
    const navItemTag = existingNavItem.prop('tagName')?.toLowerCase() || 'a';
    const navItemClass = existingNavItem.attr('class') || 'item';

    // Add GM context menu instead of tab
    const gmContextMenu = $(`
        <div class="wod-gm-context-menu" style="display: none; position: fixed; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 200px;">
            <div class="wod-context-item" data-action="wod-triggers" style="padding: 8px 12px; cursor: pointer; color: #dc3545; border-bottom: 1px solid #eee;">
                <i class="fa-solid fa-shield-halved"></i> WoD Triggers
            </div>
        </div>
    `);
    
    html.append(gmContextMenu);
    
    // Handle right-click context menu
    html.on('contextmenu.wodGM', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (game.user.isGM) {
            // Position menu at mouse location
            gmContextMenu.css({
                left: e.clientX + 'px',
                top: e.clientY + 'px'
            }).show();
        }
    });
    
    // Handle menu item clicks
    gmContextMenu.on('click', '.wod-context-item', (e) => {
        e.stopPropagation();
        const action = $(e.currentTarget).data('action');
        
        if (action === 'wod-triggers') {
            // Show trigger content - create a temporary tab or dialog
            _showWodTriggersContent(app, html, doc);
        }
        
        gmContextMenu.hide();
    });
}

// NEW: Function to add WoD Triggers tab to configuration dialogs
function _addWodTriggersTabToConfigDialog(app, html, doc) {
    
    // Check if user is GM
    if (!game.user.isGM) {
        return;
    }

    // Detect document type using the registry
    const registry = TriggerEventRegistry.getInstance();
    const documentType = registry.detectDocumentType(doc);
    
    // For scene documents, use sceneTriggers flag instead of triggers
    const flagPath = documentType === 'scene' ? 'sceneTriggers' : 'triggers';
    
    // Try multiple selectors for tab navigation
    const navSelectors = [
        'nav.sheet-tabs',
        'nav.tabs',
        'nav[data-group]',
        'nav[role="tablist"]',
        '.tabs[data-group]',
        '[data-application-part="tabs"]',
        // Tile config specific selectors
        '.tabbed-navigation',
        '.tab-navigation',
        '.tab-list',
        'ul.tabs',
        'ol.tabs'
    ];
    
    let nav = null;
    for (const sel of navSelectors) {
        const found = html.find(sel).first();
        if (found.length) {
            nav = found;
            break;
        }
    }

    // Find existing tab panels to determine content root
    const tabSelectors = [
        'div.tab[data-group]',
        'section.tab[data-group]',
        'article.tab[data-group]',
        '[data-tab][data-group]',
        '.tab[data-tab]'
    ];
    let existingTab = null;
    for (const sel of tabSelectors) {
        const found = html.find(sel).first();
        if (found.length) {
            existingTab = found;
            break;
        }
    }

    // Determine content root
    let contentRoot = null;
    if (existingTab?.length) {
        contentRoot = existingTab.parent();
    } else {
        // Try multiple selectors for content root
        const bodySelectors = [
            'section.sheet-body', 
            '.sheet-body', 
            'section.content', 
            'div.content', 
            '.window-content',
            // Config dialog specific selectors
            '.form-content',
            '.window-content',
            'form',
            '.form-group'
        ];
        for (const sel of bodySelectors) {
            const found = html.find(sel).first();
            if (found.length) {
                contentRoot = found;
                break;
            }
        }
    }

    // Check if we found both nav and content root
    if (!nav?.length || !contentRoot?.length) {
        console.warn('WoD Trigger Tabs | Could not find suitable nav or content root for config dialog');
        
        // For Wall Config, we need to create our own tab structure since it doesn't have tabs
        _createWallConfigTabStructure(app, html, doc);
        return;
    }

    // Avoid double injection - check for existing WoD Triggers tabs
    const existingWodTabs = html.find('[data-tab="wod-triggers"]');
    if (existingWodTabs.length) {
        return;
    }

    // Determine nav item element type
    const existingNavItem = nav.find('a.item, button.item').first();
    const navItemTag = existingNavItem.prop('tagName')?.toLowerCase() || 'a';
    const navItemClass = existingNavItem.attr('class') || 'item';

    // Add WoD Triggers tab to existing navigation
    const wodTab = $(`
        <${navItemTag} class="${navItemClass}" data-tab="wod-triggers" data-group="${nav.attr('data-group') || 'sheet'}" style="color: #dc3545; margin-left: 8px;">
            <i class="fa-solid fa-shield-halved"></i> WoD Triggers
        </${navItemTag}>
    `);
    
    nav.append(wodTab);
    
    // Add click handler for the new tab
    wodTab.off('click.wodConfigTab').on('click.wodConfigTab', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        
        // Deactivate all tabs in this group
        const group = nav.attr('data-group') || 'sheet';
        html.find(`[data-tab][data-group="${group}"]`).removeClass('active');
        html.find(`.tab[data-group="${group}"]`).removeClass('active');
        
        // Activate our tab
        wodTab.addClass('active');
        html.find(`.tab[data-tab="wod-triggers"][data-group="${group}"]`).addClass('active');
        
    });
    
    // Add tab content
    const triggers = doc.getFlag('wodsystem', flagPath) || [];
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    
    if (typeof renderFn !== 'function') {
        console.error('WoD Trigger Tabs | No renderTemplate function available');
        return;
    }

    const templateData = { 
        triggers: Array.isArray(triggers) ? triggers : [],
        documentType: documentType,
        documentTypeLabel: registry?.getDocumentType(documentType)?.label || documentType,
        supportsProximity: registry?.getDocumentType(documentType)?.supportsProximity || false
    };

    renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        templateData
    ).then(rendered => {
        const tabContent = $(`
            <div class="tab" data-tab="wod-triggers" data-group="${nav.attr('data-group') || 'sheet'}">
                <div class="wod-triggers-content">
                    ${rendered}
                </div>
            </div>
        `);

        contentRoot.append(tabContent);

        // Store dialog reference for event listeners
        const dialogElement = $(app.element);
        // Store the config dialog (app) as the dialogRef - this is the tile/region/wall config dialog
        dialogElement.data('dialogRef', app);

        // Attach event listeners for the new tab content
        _attachConfigDialogEventListeners(tabContent, app, doc);

    }).catch(error => {
        console.error('WoD Trigger Tabs | Error rendering tab content:', error);
    });
}

// NEW: Function to create custom tab structure for Wall Config dialogs
function _createWallConfigTabStructure(app, html, doc) {

    
    // Check if user is GM
    if (!game.user.isGM) {
        return;
    }

    // Target the correct container - Wall Config uses a different structure
    let formContent = html.find('section.window-content').first();
    
    // If no window-content found, try the form element directly
    if (!formContent.length) {
        formContent = html.find('form').first();
    }
    
    // Last resort - find any scrollable content
    if (!formContent.length) {
        formContent = html.find('.standard-form.scrollable').parent();
    }
    
    if (!formContent.length) {
        return;
    }
    

    // Check if tabs already exist to prevent duplicates - clean up any existing WoD tabs
    const existingTabs = formContent.find('.sheet-tabs[data-group="wall-config"]');
    const existingWoDTabContent = formContent.find('.tab[data-tab="wod-triggers"][data-group="wall-config"]');
    
    if (existingTabs.length && existingWoDTabContent.length) {
        return;
    }
    
    // Clean up any orphaned WoD tab content without proper navigation
    if (existingWoDTabContent.length && !existingTabs.length) {
        existingWoDTabContent.remove();
    }

    // Capture the original scrollable content BEFORE we modify anything
    const scrollableContent = html.find('.standard-form.scrollable').first();
    const originalContent = scrollableContent.html() || formContent.html();

    // Create tab navigation with proper Foundry styling
    const tabNav = $(`
        <nav class="sheet-tabs tabs" data-group="wall-config">
            <a class="tab active" data-tab="wall-basic" data-group="wall-config">
                <i class="fa-solid fa-block-brick"></i> Wall Settings
            </a>
            <a class="tab" data-tab="wod-triggers" data-group="wall-config">
                <i class="fa-solid fa-shield-halved"></i> WoD Triggers
            </a>
        </nav>
    `);

    // Create the basic tab with the original content
    const basicTab = $(`
        <div class="tab active" data-tab="wall-basic" data-group="wall-config">
            ${originalContent}
        </div>
    `);

    // Add the WoD Triggers tab (hidden by default) - content will be loaded asynchronously
    const wodTriggersTab = $(`
        <div class="tab" data-tab="wod-triggers" data-group="wall-config" style="display: none;">
            <div class="wod-triggers-content">
                <div class="loading-placeholder">
                    <p>Loading WoD Triggers...</p>
                </div>
            </div>
        </div>
    `);

    // Clear the container and rebuild with proper tab structure
    formContent.empty();
    
    // Add elements in correct order
    formContent.append(tabNav);
    formContent.append(basicTab);
    formContent.append(wodTriggersTab);
    

    // Set up event listeners for tab switching - use Foundry's built-in tab system
    tabNav.find('a.tab').off('click.wodWallTab').on('click.wodWallTab', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const clickedTab = $(ev.currentTarget);
        const tabName = clickedTab.data('tab');
        
        
        // Simple tab switching - hide all, show selected
        formContent.find('.tab[data-group="wall-config"]').hide();
        formContent.find(`.tab[data-tab="${tabName}"][data-group="wall-config"]`).show();
        
        // Update active states
        tabNav.find('a.tab').removeClass('active');
        clickedTab.addClass('active');
    });

    // Add WoD Triggers tab content
    const registry = TriggerEventRegistry.getInstance();
    const documentType = 'wall';
    const triggers = doc.getFlag('wodsystem', 'triggers') || [];
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;

    if (typeof renderFn !== 'function') {
        console.error('WoD Trigger Tabs | No renderTemplate function available');
        return;
    }

    const templateData = { 
        triggers: Array.isArray(triggers) ? triggers : [],
        documentType: documentType,
        documentTypeLabel: registry?.getDocumentType(documentType)?.label || documentType,
        supportsProximity: registry?.getDocumentType(documentType)?.supportsProximity || false
    };

    renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        templateData
    ).then(rendered => {
        // Update the existing WoD Triggers tab content instead of creating a new one
        const wodTabContent = wodTriggersTab.find('.wod-triggers-content');
        wodTabContent.html(rendered);
        
        
        // Attach event listeners for WoD Triggers content
        _attachConfigDialogEventListeners(wodTriggersTab, app, doc);
        
    }).catch(error => {
        console.error('WoD Trigger Tabs | Error rendering WoD Triggers tab content:', error);
    });
}

// NEW: Event listeners for config dialogs (shared with main dialog system)
function _attachConfigDialogEventListeners($content, app, doc) {
    // DEBUG: Log what app and dialogRef we're working with
    
    const dialogElement = $(app.element);
    const dialogRef = dialogElement.data('dialogRef') || app;
    
    
    // Check if WoD Triggers tab already exists
    const existingTab = dialogRef.element.querySelectorAll('[data-tab]').length;
    
    // Prevent double attachment by checking if already attached
    if ($content.data('wod-listeners-attached')) {
        return;
    }
    $content.data('wod-listeners-attached', true);
    
    // Edit trigger buttons
    $content.find('button[data-action="edit-trigger"]').off('click.wodConfig').on('click.wodConfig', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const triggerId = ev.currentTarget.dataset.triggerId;
        if (!triggerId) return;
        
        import('../apps/wod-trigger-config-dialog.js').then(module => {
            const DialogClass = module.WodTriggerConfigDialog || module.default;
            if (DialogClass) {
                const configDialog = new DialogClass(doc, triggerId, { 
                    onClose: () => _refreshConfigDialogContent(dialogRef, doc)
                });
                configDialog.render(true);
            }
        });
    });
    
    // Add trigger button
    $content.find('.wod-add-trigger-btn, button[data-action="add-trigger"]').off('click.wodConfig').on('click.wodConfig', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        
        import('../apps/wod-trigger-config-dialog.js').then(module => {
            const DialogClass = module.WodTriggerConfigDialog || module.default;
            if (DialogClass) {
                const configDialog = new DialogClass(doc, null, { 
                    onClose: () => _refreshConfigDialogContent(dialogRef, doc)
                });
                configDialog.render(true);
            }
        });
    });
    
    // Delete trigger buttons
    $content.find('button[data-action="delete-trigger"]').off('click.wodConfig').on('click.wodConfig', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const triggerId = ev.currentTarget.dataset.triggerId;
        
        if (!triggerId) return;
        
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        
        // Check if we have corrupted triggers that need cleanup
        const hasCorruptedTriggers = triggers.some(t => typeof t?.id === 'object');
        if (hasCorruptedTriggers) {
            const cleanedTriggers = triggers.map(trigger => {
                if (typeof trigger.id === 'object') {
                    return {
                        ...trigger,
                        id: foundry.utils.randomID()
                    };
                }
                return trigger;
            });
            
            await doc.setFlag('wodsystem', 'triggers', cleanedTriggers);
            
            // Refresh and return - the trigger will have a proper ID now
            _refreshConfigDialogContent(dialogRef, doc);
            return;
        }
        
        const next = Array.isArray(triggers) ? triggers.filter(t => t?.id !== triggerId) : [];
        await doc.setFlag('wodsystem', 'triggers', next);
        
        // Refresh the dialog content
        _refreshConfigDialogContent(dialogRef, doc);
    });
}

// NEW: Event listeners for config dialogs ONLY (no tab injection)
function _attachConfigDialogEventListenersOnly($content, dialogRef, doc) {
    
    // Prevent double attachment by checking if already attached
    if ($content.data('wod-listeners-attached')) {
        return;
    }
    $content.data('wod-listeners-attached', true);
    
    // Edit trigger buttons
    $content.find('button[data-action="edit-trigger"]').off('click.wodConfig').on('click.wodConfig', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const triggerId = ev.currentTarget.dataset.triggerId;
        if (!triggerId) return;
        
        import('../apps/wod-trigger-config-dialog.js').then(module => {
            const DialogClass = module.WodTriggerConfigDialog || module.default;
            if (DialogClass) {
                const configDialog = new DialogClass(doc, triggerId, { 
                    onClose: () => _refreshConfigDialogContent(dialogRef, doc)
                });
                configDialog.render(true);
            }
        });
    });
    
    // Add trigger button
    $content.find('.wod-add-trigger-btn, button[data-action="add-trigger"]').off('click.wodConfig').on('click.wodConfig', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        
        import('../apps/wod-trigger-config-dialog.js').then(module => {
            const DialogClass = module.WodTriggerConfigDialog || module.default;
            if (DialogClass) {
                const configDialog = new DialogClass(doc, null, { 
                    onClose: () => _refreshConfigDialogContent(dialogRef, doc)
                });
                configDialog.render(true);
            }
        });
    });
    
    // Delete trigger buttons
    $content.find('button[data-action="delete-trigger"]').off('click.wodConfig').on('click.wodConfig', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const triggerId = ev.currentTarget.dataset.triggerId;
        
        if (!triggerId) return;
        
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        
        // Check if we have corrupted triggers that need cleanup
        const hasCorruptedTriggers = triggers.some(t => typeof t?.id === 'object');
        if (hasCorruptedTriggers) {
            const cleanedTriggers = triggers.map(trigger => {
                if (typeof trigger.id === 'object') {
                    return {
                        ...trigger,
                        id: foundry.utils.randomID()
                    };
                }
                return trigger;
            });
            
            await doc.setFlag('wodsystem', 'triggers', cleanedTriggers);
            
            // Refresh and return - the trigger will have a proper ID now
            _refreshConfigDialogContent(dialogRef, doc);
            return;
        }
        
        const next = Array.isArray(triggers) ? triggers.filter(t => t?.id !== triggerId) : [];
        await doc.setFlag('wodsystem', 'triggers', next);
        
        // Refresh the dialog content
        _refreshConfigDialogContent(dialogRef, doc);
    });
}

// NEW: Refresh function for config dialogs
function _refreshConfigDialogContent(dialogRef, doc) {
    // Safety check - make sure dialogRef and its element still exist
    if (!dialogRef || !dialogRef.element) {
        console.warn('WoD Trigger Tabs | dialogRef or element no longer exists, skipping refresh');
        return;
    }
    
    // DEBUG: Log which dialog we're targeting
    
    // Check if this is a wall dialog - if so, use the wall-specific refresh method
    if (doc.documentName === 'Wall') {
        _refreshWallTriggersContent($(dialogRef.element), doc);
        return;
    }
    
    // Original actor refresh logic continues below...
    const triggers = doc.getFlag('wodsystem', 'triggers') || [];
    const registry = TriggerEventRegistry.getInstance();
    const documentType = registry.detectDocumentType(doc);
    
    const templateData = {
        triggers: triggers,
        documentType: documentType,
        documentTypeLabel: registry?.getDocumentType(documentType)?.label || documentType,
        supportsProximity: registry?.getDocumentType(documentType)?.supportsProximity || false
    };
    
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    
    renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        templateData
    ).then(rendered => {
        console.log('WoD Trigger Tabs | Rendered content length:', rendered.length);
        console.log('WoD Trigger Tabs | Rendered content preview:', rendered.substring(0, 200));
        
        // Double check that dialogRef still exists before trying to use it
        if (!dialogRef || !dialogRef.element) {
            console.warn('WoD Trigger Tabs | dialogRef disappeared during render, skipping content update');
            return;
        }
        
        const $content = $(dialogRef.element).find('.wod-triggers-content');
        if ($content.length) {
            // Clear the attachment flag before replacing content
            $content.removeData('wod-listeners-attached');
            $content.html(rendered);
            
            // Re-attach event listeners for the new content ONLY (no tab injection)
            _attachConfigDialogEventListenersOnly($content, dialogRef, doc);
            
        } else {
            console.warn('WoD Trigger Tabs | Could not find .wod-triggers-content element');
        }
    }).catch(error => {
        console.error('WoD Trigger Tabs | Error refreshing config content:', error);
    });
}

async function _showWodTriggersContent(app, html, doc) {
    const flagPath = 'triggers';
    const registry = game.wodsystem?.triggerRegistry;
    const documentType = doc.documentName || doc.constructor.name;
    
    const triggers = doc.getFlag('wodsystem', 'triggers') || [];
    
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    if (typeof renderFn !== 'function') {
        throw new Error('No renderTemplate function available');
    }

    // Get document type info for display
    const docTypeInfo = registry?.getDocumentType?.(documentType);
    
    const templateData = { 
        triggers: Array.isArray(triggers) ? triggers : [],
        documentType: documentType,
        documentTypeLabel: docTypeInfo?.label || documentType,
        supportsProximity: docTypeInfo?.supportsProximity || false
    };
    
    
    renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        templateData
    ).then(rendered => {

        // Create a professional Foundry-style dialog
        const dialogContent = `
            <style>
            .wod-triggers-container {
                padding: 0;
            }
            .wod-triggers-container .wod-add-trigger-container {
                text-align: center;
                margin-bottom: 20px;
            }
            .wod-triggers-container .wod-add-trigger-btn {
                background: linear-gradient(to bottom, #4cae4c, #449d44);
                color: white;
                border: 1px solid #3d8b3d;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                text-shadow: 0 1px 0 rgba(0,0,0,0.2);
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                position: relative;
            }
            .wod-triggers-container .wod-add-trigger-btn:hover {
                background: linear-gradient(to bottom, #5cb85c, #4cae4c);
                border-color: #398439;
                box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                transform: scale(1.1);
            }
            .wod-triggers-container .wod-add-trigger-btn:active {
                background: linear-gradient(to bottom, #449d44, #3d8b3d);
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                transform: scale(0.95);
            }
            .wod-triggers-container .wod-add-trigger-btn i {
                margin: 0;
            }
            .wod-triggers-content {
                padding: 0 15px 15px;
                max-height: 400px;
                overflow-y: auto;
            }
            .wod-triggers-list {
                min-height: 200px;
            }
            .wod-triggers-list .notes {
                text-align: center;
                color: #6c757d;
                font-style: italic;
                margin: 20px 0;
                padding: 20px;
                background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
                border-radius: 6px;
                border: 1px solid #dee2e6;
                font-size: 14px;
            }
            .triggers-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            .triggers-table th {
                background: linear-gradient(to bottom, #f5f5f5, #e9e9e9);
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
                font-weight: bold;
                font-size: 12px;
                color: #4b5358;
            }
            .triggers-table td {
                border: 1px solid #ddd;
                padding: 8px;
                font-size: 12px;
            }
            .triggers-table tr:hover {
                background: #f5f5f5;
            }
            .trigger-controls button {
                margin: 0 2px;
                padding: 4px 8px;
                font-size: 11px;
                border-radius: 2px;
            }
            </style>
            <div class="wod-triggers-container">
                <div class="wod-triggers-content">
                    <div class="wod-add-trigger-container">
                        <button type="button" class="wod-add-trigger-btn">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    ${rendered.replace(/<button[^>]*data-action="add-trigger"[^>]*>.*?<\/button>/g, '')}
                </div>
            </div>
        `;

        const dialog = new Dialog({
            title: `🛡️ WoD Triggers - ${doc.name}`,
            content: dialogContent,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Close',
                    callback: () => {}
                }
            },
            default: 'close'
        });
        
        dialog.render(true);
        
        // Wait for dialog to be fully rendered before accessing elements
        setTimeout(() => {
            const dialogElement = $(dialog.element);
            
            if (!dialogElement.length) {
                return;
            }
            // Try multiple selectors to find the button
            let button = dialogElement.find('.wod-add-trigger-btn');
            
            if (button.length === 0) {
                // Try finding in the dialog content
                button = dialogElement.find('.dialog-content .wod-add-trigger-btn');
            }
            
            if (button.length === 0) {
                // Try finding by type and content
                button = dialogElement.find('button[type="button"]:contains("Add Trigger")');
            }
            
            if (button.length === 0) {
                // Try finding any button with add-trigger class or data-action
                button = dialogElement.find('button').filter(function() {
                    return $(this).hasClass('wod-add-trigger-btn') || 
                           $(this).data('action') === 'add-trigger' ||
                           $(this).text().includes('Add Trigger');
                });
            }
            
            
            // Find the add trigger button
            const $button = dialogElement.find('.wod-add-trigger-btn');
            
            // Button is now styled with CSS, just ensure it's clickable
            $button.css({
                'pointer-events': 'auto',
                'z-index': '9999'
            });
            
            // Store dialog reference for event listeners
            dialogElement.data('dialogRef', dialog);
            
            // Try direct DOM event listener
            $button[0].addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                // Open trigger configuration dialog
                
                // Import the config dialog module
                import('../apps/wod-trigger-config-dialog.js').then(module => {
                    
                    const DialogClass = module.WodTriggerConfigDialog || module.default;
                    
                    if (DialogClass) {
                        const configDialog = new DialogClass(doc, null, {
                            documentType: documentType,
                            documentTypeLabel: docTypeInfo?.label || documentType,
                            supportsProximity: docTypeInfo?.supportsProximity || false,
                            onClose: () => {
                                // Refresh the main dialog when config is closed
                                const dialogRef = dialogElement.data('dialogRef');
                                refreshDialogContent(dialogRef);
                            }
                        });
                        configDialog.render(true);
                        // Don't close this dialog - let user stay in the trigger list
                    } else {
                        console.warn('WoD Trigger Tabs | No WoDTriggerConfigDialog found in module');
                        ui.notifications.warn('Trigger configuration dialog not available');
                    }
                }).catch(error => {
                    console.error('WoD Trigger Tabs | Error importing trigger config dialog:', error);
                    ui.notifications.error('Failed to load trigger configuration dialog');
                });
            });
            
            // Attach event listeners for edit and delete buttons
            attachEventListeners(dialogElement);
        }, 100);
        
    }).catch(error => {
        console.error('WoD Trigger Tabs | Error rendering template:', error);
        ui.notifications.error('Could not render trigger content: ' + error.message);
    });
    
    // Create refresh function to update dialog content
    function refreshDialogContent(dialogRef) {
        // Get fresh trigger data
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        const templateData = {
            triggers: triggers,
            hasTriggers: triggers.length > 0,
            isEmpty: triggers.length === 0
        };
        
        // Re-render the template
        renderFn(
            'systems/wodsystem/templates/apps/wod-triggers-tab.html',
            templateData
        ).then(rendered => {
            // Update the content area with fresh data
            const $content = $(dialogRef.element).find('.wod-triggers-content');
            if ($content.length) {
                $content.html(rendered.replace(/<button[^>]*data-action="add-trigger"[^>]*>.*?<\/button>/g, ''));
                
                // Re-attach event listeners for the new content
                attachEventListeners($(dialogRef.element));
                
            }
        }).catch(error => {
            console.error('WoD Trigger Tabs | Error refreshing content:', error);
        });
    }
    
    // Function to attach event listeners
    function attachEventListeners(dialogEl) {
        const $content = dialogEl.find('.wod-triggers-content');
        const dialogRef = dialogEl.data('dialogRef');
        
        // Clear all existing event listeners to prevent conflicts
        $content.find('button[data-action="edit-trigger"]').off('click.wodDialog');
        $content.find('button[data-action="delete-trigger"]').off('click.wodDialog');
        
        // Edit trigger buttons
        $content.find('button[data-action="edit-trigger"]').on('click.wodDialog', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const triggerId = ev.currentTarget.dataset.triggerId;
            if (!triggerId) return;
            import('../apps/wod-trigger-config-dialog.js').then(module => {
                const DialogClass = module.WoDTriggerConfigDialog || module.default;
                if (DialogClass) {
                    const configDialog = new DialogClass(doc, triggerId, { 
                        onClose: refreshDialogContent
                    });
                    configDialog.render(true);
                }
            });
        });
        
        // Delete trigger buttons
        $content.find('button[data-action="delete-trigger"]').on('click.wodDialog', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const triggerId = ev.currentTarget.dataset.triggerId;
            
            if (!triggerId) return;
            
            const triggers = doc.getFlag('wodsystem', 'triggers') || [];
            
            // Check if we have corrupted triggers that need cleanup
            const hasCorruptedTriggers = triggers.some(t => typeof t?.id === 'object');
            if (hasCorruptedTriggers) {
                    const cleanedTriggers = triggers.map(trigger => {
                    if (typeof trigger.id === 'object') {
                            return {
                            ...trigger,
                            id: foundry.utils.randomID()
                        };
                    }
                    return trigger;
                });
                
                await doc.setFlag('wodsystem', 'triggers', cleanedTriggers);
                    
                // Refresh and return - the trigger will have a proper ID now
                refreshDialogContent(dialogRef);
                return;
            }
            
            const next = Array.isArray(triggers) ? triggers.filter(t => t?.id !== triggerId) : [];
            await doc.setFlag('wodsystem', 'triggers', next);
            
            // Refresh the dialog content
            refreshDialogContent(dialogRef);
        });
    }
}

function _ensureWodTriggersTabVisible(app, html) {
    const doc = app.document || app.object;
    if (!doc) return;

    // Normalize html to jQuery
    let $html;
    if (html instanceof jQuery) {
        $html = html;
    } else if (html instanceof HTMLElement) {
        $html = $(html);
    } else if (app.element instanceof HTMLElement) {
        $html = $(app.element);
    } else if (app.element instanceof jQuery) {
        $html = app.element;
    } else {
        return;
    }

    // Check if WoD triggers tab exists and is active
    const wodTab = $html.find('[data-tab="wod-triggers"]');
    const wodNav = $html.find('[data-tab="wod-triggers"][data-group]');
    
    if (wodNav.hasClass('active') && (!wodTab.length || !wodTab.children().length)) {
        // Tab is active but content is missing, re-inject it
        _injectTabContent(app, $html, doc);
    }
    
    // Re-activate listeners if tab is active
    if (wodNav.hasClass('active') && wodTab.length) {
        _activateWodTriggersListeners(app, $html, doc);
    }
}


    
    

async function _injectTabContent(app, html, doc) {
    const triggers = doc.getFlag('wodsystem', 'triggers') || [];
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    if (typeof renderFn !== 'function') return;

    try {
        const rendered = await renderFn(
            'systems/wodsystem/templates/apps/wod-triggers-tab.html',
            { triggers: Array.isArray(triggers) ? triggers : [] }
        );

        // Find content root and append the tab content
        const existingTab = html.find('.tab[data-tab]').first();
        const contentRoot = existingTab.length ? existingTab.parent() : html.find('.sheet-body, .window-content').first();
        
        // Remove any existing wod-triggers tab to prevent duplicates
        html.find('[data-tab="wod-triggers"]').remove();
        
        if (contentRoot && contentRoot.length) {
            contentRoot.append(`<div class="tab" data-group="sheet" data-tab="wod-triggers">${rendered}</div>`);
        }
    } catch (error) {
        console.error('WoD Trigger Tabs | Failed to re-inject tab content:', error);
    }
}

// Function to show WoD Triggers dialog for walls (similar to actor context menu approach)
function _showWodTriggersDialog(wall) {
    
    // For walls, show the trigger list dialog first (like actors do)
    _showWallTriggersContent(wall);
}

// Wall-specific version of _showWodTriggersContent for walls
async function _showWallTriggersContent(wall) {
    const flagPath = 'triggers';
    const registry = game.wodsystem?.triggerRegistry;
    const documentType = 'wall'; // Fixed for walls
    
    const triggers = wall.getFlag('wodsystem', 'triggers') || [];
    
    // Debug: Check trigger IDs for corruption
    triggers.forEach((trigger, index) => {
        console.log(`WoD Trigger Tabs | Wall trigger ${index}:`, trigger);
        console.log(`WoD Trigger Tabs | Wall trigger ${index} ID:`, trigger.id);
        console.log(`WoD Trigger Tabs | Wall trigger ${index} ID type:`, typeof trigger.id);
        if (typeof trigger.id === 'object') {
            console.warn(`WoD Trigger Tabs | CORRUPTED TRIGGER ID DETECTED - fixing...`);
            trigger.id = foundry.utils.randomID();
            console.log(`WoD Trigger Tabs | Fixed trigger ID to:`, trigger.id);
        }
    });
    
    // Save fixed triggers if any were corrupted
    if (triggers.some(t => typeof t.id === 'object')) {
        const fixedTriggers = triggers.map(trigger => {
            if (typeof trigger.id === 'object') {
                trigger.id = foundry.utils.randomID();
            }
            return trigger;
        });
        wall.setFlag('wodsystem', 'triggers', fixedTriggers);
    }
    
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    if (typeof renderFn !== 'function') {
        throw new Error('No renderTemplate function available');
    }

    // Get document type info for display
    const docTypeInfo = registry?.getDocumentType?.(documentType);
    
    const templateData = { 
        triggers: Array.isArray(triggers) ? triggers : [],
        documentType: documentType,
        documentTypeLabel: docTypeInfo?.label || documentType,
        supportsProximity: docTypeInfo?.supportsProximity || false
    };
    
    renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        templateData
    ).then(rendered => {

        // Create a professional Foundry-style dialog for walls
        const dialogContent = `
            <style>
            .wod-triggers-container {
                padding: 0;
            }
            .wod-triggers-container .wod-add-trigger-container {
                text-align: center;
                margin-bottom: 20px;
            }
            .wod-triggers-container .wod-add-trigger-btn {
                background: linear-gradient(to bottom, #4cae4c, #449d44);
                color: white;
                border: 1px solid #3d8b3d;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                text-shadow: 0 1px 0 rgba(0,0,0,0.2);
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                position: relative;
            }
            .wod-triggers-container .wod-add-trigger-btn:hover {
                background: linear-gradient(to bottom, #5cb85c, #4cae4c);
                border-color: #398439;
                box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                transform: scale(1.1);
            }
            .wod-triggers-container .wod-add-trigger-btn:active {
                background: linear-gradient(to bottom, #449d44, #3d8b3d);
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                transform: scale(0.95);
            }
            .wod-triggers-container .wod-add-trigger-btn i {
                margin: 0;
            }
            .wod-triggers-content {
                padding: 0 15px 15px;
                max-height: 400px;
                overflow-y: auto;
            }
            .wod-triggers-list {
                min-height: 200px;
            }
            .wod-triggers-list .notes {
                text-align: center;
                color: #6c757d;
                font-style: italic;
                margin: 20px 0;
                padding: 20px;
                background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
                border-radius: 6px;
                border: 1px solid #dee2e6;
                font-size: 14px;
            }
            .triggers-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            .triggers-table th {
                background: linear-gradient(to bottom, #f5f5f5, #e9e9e9);
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
                font-weight: bold;
                font-size: 12px;
                color: #4b5358;
            }
            .triggers-table td {
                border: 1px solid #ddd;
                padding: 8px;
                font-size: 12px;
            }
            .triggers-table tr:hover {
                background: #f5f5f5;
            }
            .trigger-controls button {
                margin: 0 2px;
                padding: 4px 8px;
                font-size: 11px;
                border-radius: 2px;
            }
            </style>
            <div class="wod-triggers-container">
                <div class="wod-triggers-content">
                    <div class="wod-add-trigger-container">
                        <button type="button" class="wod-add-trigger-btn">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    ${rendered.replace(/<button[^>]*data-action="add-trigger"[^>]*>.*?<\/button>/g, '')}
                </div>
            </div>
        `;

        const dialog = new Dialog({
            title: `🛡️ WoD Triggers - Wall ${wall.id.substring(-4)}`,
            content: dialogContent,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Close',
                    callback: () => {}
                }
            },
            default: 'close'
        });
        
        dialog.render(true);
        
        // Wait for dialog to be fully rendered before accessing elements
        setTimeout(() => {
            const dialogElement = $(dialog.element);
            
            if (!dialogElement.length) {
                console.warn('WoD Trigger Tabs | Wall dialog element not found after timeout');
                return;
            }
            
            // Find the add trigger button
            const $button = dialogElement.find('.wod-add-trigger-btn');
            
            // Button is now styled with CSS, just ensure it's clickable
            $button.css({
                'pointer-events': 'auto',
                'z-index': '9999'
            });
            
            // Store dialog reference for event listeners
            dialogElement.data('dialogRef', dialog);
            dialogElement.data('wallDocument', wall);
            
            // Add click listener for add trigger button
            $button.off('click.wallTrigger').on('click.wallTrigger', (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                // Store dialog reference for the onClose callback
                const dialogRef = dialog;
                
                // Open the trigger config dialog for this wall
                const triggerDialog = new WodTriggerConfigDialog(wall, null, {
                    title: `Add Trigger - Wall ${wall.id.substring(-4)}`,
                    documentType: 'wall',
                    onClose: () => {
                        // Use the same refresh pattern as actors
                        _refreshConfigDialogContent(dialogRef, wall);
                    }
                });
                
                triggerDialog.render(true);
            });
            
            // Attach event listeners for existing triggers
            _attachWallTriggerEventListeners(dialogElement, wall);
            
        }, 100);
    }).catch(error => {
        console.error('WoD Trigger Tabs | Error rendering wall triggers content:', error);
    });
}

// Wall-specific version of event listeners
function _attachWallTriggerEventListeners(dialogElement, wall) {
    const $content = dialogElement.find('.wod-triggers-content');
    
    // Add click listeners for trigger controls
    $content.off('click.wallTrigger').on('click.wallTrigger', '[data-action]', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const action = $(event.currentTarget).data('action');
        const triggerId = $(event.currentTarget).data('trigger-id');
        
        if (action === 'edit-trigger' && triggerId) {
            // Store dialog reference for the onClose callback
            const dialogRef = $content.closest('.app.window-app').data('dialogRef');
            
            const triggerDialog = new WodTriggerConfigDialog(wall, triggerId, {
                title: `Edit Trigger - Wall ${wall.id.substring(-4)}`,
                documentType: 'wall',
                onClose: () => {
                    // Use the same refresh pattern as actors
                    _refreshConfigDialogContent(dialogRef, wall);
                }
            });
            triggerDialog.render(true);
        } else if (action === 'delete-trigger' && triggerId) {
            // Handle trigger deletion
            const triggers = wall.getFlag('wodsystem', 'triggers') || [];
            const next = Array.isArray(triggers) ? triggers.filter(t => t?.id !== triggerId) : [];
            
            await wall.setFlag('wodsystem', 'triggers', next);
            
            // Refresh the dialog content instead of creating a new one
            const existingDialog = $content.closest('.app.window-app');
            if (existingDialog.length) {
                // Re-render the content in the existing dialog
                _refreshWallTriggersContent(existingDialog, wall);
            } else {
                // Fallback: create new dialog if we can't find the existing one
                _showWallTriggersContent(wall);
            }
        }
    });
}

// Refresh function for existing wall trigger dialog
async function _refreshWallTriggersContent(dialogElement, wall) {
    
    const triggers = wall.getFlag('wodsystem', 'triggers') || [];
    
    // Debug: Check trigger IDs for corruption
    triggers.forEach((trigger, index) => {
        if (typeof trigger.id === 'object') {
            trigger.id = foundry.utils.randomID();
        }
    });
    
    // Save fixed triggers if any were corrupted
    if (triggers.some(t => typeof t.id === 'object')) {
        const fixedTriggers = triggers.map(trigger => {
            if (typeof trigger.id === 'object') {
                trigger.id = foundry.utils.randomID();
            }
            return trigger;
        });
        wall.setFlag('wodsystem', 'triggers', fixedTriggers);
    }
    
    const registry = game.wodsystem?.triggerRegistry;
    const documentType = 'wall';
    
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    if (typeof renderFn !== 'function') {
        throw new Error('No renderTemplate function available');
    }

    // Get document type info for display
    const docTypeInfo = registry?.getDocumentType?.(documentType);
    
    const templateData = { 
        triggers: Array.isArray(triggers) ? triggers : [],
        documentType: documentType,
        documentTypeLabel: docTypeInfo?.label || documentType,
        supportsProximity: docTypeInfo?.supportsProximity || false
    };
    
    renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        templateData
    ).then(rendered => {
        // Update only the content area, not the entire dialog
        const $content = dialogElement.find('.wod-triggers-content');
        if ($content.length) {
            // Clear the attachment flag before replacing content
            $content.removeData('wod-listeners-attached');
            
            // Preserve the original add trigger button structure
            const $addButtonContainer = $content.find('.wod-add-trigger-container');
            
            // Update the content area with fresh data - remove the template's add button
            $content.html(rendered.replace(/<button[^>]*data-action="add-trigger"[^>]*>.*?<\/button>/g, ''));
            
            // Restore the original add trigger button if it existed
            if ($addButtonContainer.length) {
                // Prepend the original button structure back
                $content.prepend($addButtonContainer);
            }
            
            // Re-attach event listeners for the refreshed content
            _attachWallTriggerEventListeners(dialogElement, wall);
            
            // Re-attach the native event listener for the green + button
            const $addButton = dialogElement.find('.wod-add-trigger-btn');
            if ($addButton.length) {
                // Remove any existing listeners to prevent duplicates
                $addButton.off('click.wallAdd').off('click');
                
                // Attach the native event listener for the green + button
                $addButton[0].addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // Store dialog reference for the onClose callback
                    const dialogRef = dialogElement.closest('.app.window-app').data('dialogRef') || dialog;
                    
                    // Open the trigger config dialog for this wall
                    import('../apps/wod-trigger-config-dialog.js').then(module => {
                        const DialogClass = module.WodTriggerConfigDialog || module.default;
                        if (DialogClass) {
                            const triggerDialog = new DialogClass(wall, null, {
                                title: `Add Trigger - Wall ${wall.id.substring(-4)}`,
                                documentType: 'wall',
                                onClose: () => {
                                    // Use the same refresh pattern as actors
                                    _refreshConfigDialogContent(dialogRef, wall);
                                }
                            });
                            triggerDialog.render(true);
                        }
                    });
                });
            }
        } else {
            console.warn('WoD Trigger Tabs | Could not find .wod-triggers-content element for refresh');
        }
    }).catch(error => {
        console.error('WoD Trigger Tabs | Error refreshing wall triggers content:', error);
    });
}

// Add scene context menu support
function _addSceneContextMenu(app, html, data) {
    if (!game.user.isGM) return;
    
    // Ensure html is a jQuery object
    const $html = html instanceof jQuery ? html : $(html);
    
    // Add right-click context menu to scene items
    $html.find('.scene').on('contextmenu.wodSceneTriggers', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get scene ID from the element
        const sceneElement = $(e.currentTarget);
        const sceneId = sceneElement.data('sceneId') || sceneElement.attr('data-scene-id');
        
        if (!sceneId) return;
        
        const scene = game.scenes.get(sceneId);
        if (!scene) return;
        
        // Create context menu
        _showSceneContextMenu(scene, e);
    });
}

// Function to show scene context menu
function _showSceneContextMenu(scene, event) {
    // Don't create our own menu - add to existing Foundry context menu
    // We'll hook into Foundry's context menu system instead
    
    // For now, let's trigger the existing context menu and add our option
    // This is a temporary approach - we need to find the right way to extend Foundry's menu
    
    // Create a simple dropdown menu that appears alongside the existing one
    const menuItems = [
        {
            name: "WoD Triggers",
            icon: '<i class="fa-solid fa-shield-halved"></i>',
            action: () => {
                _showSceneTriggersDialog(scene);
            }
        }
    ];
    
    // Create a simple dropdown menu positioned slightly offset from mouse
    const menuHtml = `
        <div class="context-menu wod-scene-menu" style="position: fixed; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 1000; min-width: 200px;">
            ${menuItems.map(item => `
                <div class="context-item" style="padding: 8px 12px; cursor: pointer; color: #dc3545; border-bottom: 1px solid #eee;">
                    ${item.icon} ${item.name}
                </div>
            `).join('')}
        </div>
    `;
    
    // Add menu to body and position it slightly offset from mouse
    const $menu = $(menuHtml);
    $('body').append($menu);
    
    // Position menu slightly offset from mouse to avoid overlap
    $menu.css({
        left: (event.clientX + 10) + 'px',
        top: (event.clientY + 10) + 'px'
    });
    
    // Handle menu item clicks
    $menu.find('.context-item').on('click', (e) => {
        e.stopPropagation();
        const index = $(e.currentTarget).index();
        menuItems[index].action();
        $menu.remove();
    });
    
    // Remove menu when clicking elsewhere
    $(document).on('click.wodSceneMenu', () => {
        $menu.remove();
        $(document).off('click.wodSceneMenu');
    });
    
    // Prevent menu from going off-screen
    const menuRect = $menu[0].getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        $menu.css('left', (event.clientX - menuRect.width - 10) + 'px');
    }
    if (menuRect.bottom > window.innerHeight) {
        $menu.css('top', (event.clientY - menuRect.height - 10) + 'px');
    }
    
    // Also trigger the original Foundry context menu
    setTimeout(() => {
        // Trigger the original context menu by simulating a right-click without our handler
        const originalEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
            button: 2
        });
        
        // Temporarily remove our handler to prevent infinite loop
        $(event.currentTarget).off('contextmenu.wodSceneTriggers');
        
        // Trigger the original context menu
        event.currentTarget.dispatchEvent(originalEvent);
        
        // Re-add our handler after a delay
        setTimeout(() => {
            $(event.currentTarget).on('contextmenu.wodSceneTriggers', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const sceneElement = $(e.currentTarget);
                const sceneId = sceneElement.data('entryId') || sceneElement.data('sceneId') || sceneElement.attr('data-entry-id') || sceneElement.attr('data-scene-id') || sceneElement.attr('data-document-id') || sceneElement.attr('id')?.replace('scene-', '') || sceneElement.attr('id')?.replace('scene-', '');
                const scene = game.scenes.get(sceneId);
                if (scene) {
                    _showSceneContextMenu(scene, e);
                }
            });
        }, 100);
    }, 50);
}

// Function to show WoD Triggers dialog for scenes
function _showSceneTriggersDialog(scene) {
    
    // Show the trigger list dialog first (like actors do)
    _showSceneTriggersContent(scene);
}

// Function to show scene triggers content
function _showSceneTriggersContent(scene) {
    const triggers = scene.getFlag('wodsystem', 'sceneTriggers') || [];
    const registry = TriggerEventRegistry.getInstance();
    const documentType = 'scene';
    
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    if (typeof renderFn !== 'function') {
        throw new Error('No renderTemplate function available');
    }

    // Get document type info for display
    const docTypeInfo = registry.getDocumentType(documentType);
    
    const templateData = {
        documentType: documentType,
        docTypeInfo: docTypeInfo,
        triggers: triggers,
        documentName: scene.name,
        documentId: scene.id,
        isGM: game.user.isGM
    };

    renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        templateData
    ).then(rendered => {
        // Create a professional Foundry-style dialog for scenes
        const dialogContent = `
            <style>
                .wod-triggers-dialog .trigger-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                .wod-triggers-dialog .trigger-item {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px;
                    margin-bottom: 10px;
                    background: #f9f9f9;
                }
                .wod-triggers-dialog .trigger-item:hover {
                    background: #f0f0f0;
                }
                .wod-triggers-dialog .no-triggers {
                    text-align: center;
                    color: #666;
                    font-style: italic;
                    padding: 20px;
                }
                .wod-triggers-dialog .add-trigger-btn {
                    background: #28a745;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                    margin-top: 10px;
                }
                .wod-triggers-dialog .add-trigger-btn:hover {
                    background: #218838;
                }
            </style>
            <div class="wod-triggers-dialog">
                <h2>WoD Triggers - ${scene.name}</h2>
                <div class="trigger-list">
                    ${rendered}
                </div>
                <button type="button" class="add-trigger-btn">
                    <i class="fas fa-plus"></i> Add Trigger
                </button>
            </div>
        `;

        const dialog = new Dialog({
            title: `WoD Triggers - ${scene.name}`,
            content: dialogContent,
            buttons: {
                close: {
                    label: "Close",
                    callback: () => {}
                }
            },
            default: "close"
        });

        dialog.render(true);

        // Add click listener for add trigger button
        const $button = $(dialog.element).find('.add-trigger-btn');
        $button.off('click.sceneTrigger').on('click.sceneTrigger', (event) => {
            event.preventDefault();
            event.stopPropagation();

            // Open the trigger config dialog for this scene
            import('../apps/wod-trigger-config-dialog.js').then(module => {
                const DialogClass = module.WodTriggerConfigDialog || module.default;
                if (DialogClass) {
                    const triggerDialog = new DialogClass(scene, null, {
                        title: `Add Trigger - ${scene.name}`,
                        documentType: 'scene',
                        onClose: () => {
                            // Refresh the dialog content
                            _showSceneTriggersContent(scene);
                            dialog.render(false);
                        }
                    });
                    triggerDialog.render(true);
                }
            });
        });

        // Add click listeners for trigger actions
        $(dialog.element).find('.trigger-action').off('click.sceneTriggerAction').on('click.sceneTriggerAction', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const action = $(event.currentTarget).data('action');
            const triggerId = $(event.currentTarget).data('triggerId');
            
            if (action === 'edit-trigger' && triggerId) {
                // Handle trigger editing
                import('../apps/wod-trigger-config-dialog.js').then(module => {
                    const DialogClass = module.WodTriggerConfigDialog || module.default;
                    if (DialogClass) {
                        const triggerDialog = new DialogClass(scene, triggerId, {
                            title: `Edit Trigger - ${scene.name}`,
                            documentType: 'scene',
                            onClose: () => {
                                // Refresh the dialog content
                                _showSceneTriggersContent(scene);
                                dialog.render(false);
                            }
                        });
                        triggerDialog.render(true);
                    }
                });
            } else if (action === 'delete-trigger' && triggerId) {
                // Handle trigger deletion
                const triggers = scene.getFlag('wodsystem', 'sceneTriggers') || [];
                const next = Array.isArray(triggers) ? triggers.filter(t => t?.id !== triggerId) : [];
                
                scene.setFlag('wodsystem', 'sceneTriggers', next).then(() => {
                    // Refresh the dialog content
                    _showSceneTriggersContent(scene);
                    dialog.render(false);
                });
            }
        });
    }).catch(error => {
        console.error('WoD Trigger Tabs | Error rendering scene triggers content:', error);
        ui.notifications.error('Failed to load scene triggers content');
    });
}

// Fallback function to add context menu directly to DOM
function _addSceneContextMenuFallback(sceneDirectoryElement) {
    if (!game.user.isGM) return;
    
    console.log('WoD Trigger Tabs | Adding fallback context menu to scene directory');
    
    // Convert to jQuery if needed
    const $sceneDirectory = $(sceneDirectoryElement);
    
    // Debug: Log what's actually in the scene directory
    console.log('WoD Trigger Tabs | Scene directory HTML structure:');
    console.log($sceneDirectory.html());
    
    // Try multiple selectors for scene items
    const sceneSelectors = [
        '.scene',
        '.directory-item',
        '.list-item',
        '[data-scene-id]',
        '[data-entity="scene"]',
        'li[data-document-id]',
        'li',
        'div',
        'a'
    ];
    
    let $sceneItems = $();
    let workingSelector = '';
    for (const selector of sceneSelectors) {
        $sceneItems = $sceneDirectory.find(selector);
        if ($sceneItems.length > 0) {
            console.log(`WoD Trigger Tabs | Found ${$sceneItems.length} items with selector: ${selector}`);
            workingSelector = selector;
            
            // Log details of first few items
            $sceneItems.slice(0, 3).each((index, el) => {
                console.log(`WoD Trigger Tabs | Item ${index} (${selector}):`, {
                    tagName: el.tagName,
                    className: el.className,
                    id: el.id,
                    textContent: el.textContent?.substring(0, 50),
                    dataSceneId: $(el).data('scene-id'),
                    dataDocumentId: $(el).data('document-id'),
                    dataEntity: $(el).data('entity')
                });
            });
            break;
        }
    }
    
    if ($sceneItems.length === 0) {
        console.warn('WoD Trigger Tabs | No scene items found with any selector');
        return;
    }
    
    // Add right-click context menu to ALL found items
    $sceneItems.off('contextmenu.wodSceneTriggers').on('contextmenu.wodSceneTriggers', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('WoD Trigger Tabs | Scene right-click detected on:', e.currentTarget);
        console.log('WoD Trigger Tabs | Working selector was:', workingSelector);
        
        // Get scene ID from the element
        const sceneElement = $(e.currentTarget);
        const sceneId = sceneElement.data('entryId') ||           // Foundry uses data-entry-id
                        sceneElement.data('sceneId') || 
                        sceneElement.attr('data-entry-id') ||     // Foundry uses data-entry-id
                        sceneElement.attr('data-scene-id') || 
                        sceneElement.attr('data-document-id') ||
                        sceneElement.attr('id')?.replace('scene-', '') ||
                        sceneElement.attr('id')?.replace('scene-', '');
        
        console.log('WoD Trigger Tabs | Scene ID:', sceneId);
        console.log('WoD Trigger Tabs | Scene element data:', sceneElement.data());
        
        // Safely get attributes
        const attributes = {};
        try {
            for (const attr of e.currentTarget.attributes) {
                attributes[attr.name] = attr.value;
            }
            console.log('WoD Trigger Tabs | Scene element attributes:', attributes);
        } catch (error) {
            console.warn('WoD Trigger Tabs | Error getting attributes:', error);
        }
        
        if (!sceneId) {
            console.warn('WoD Trigger Tabs | Could not extract scene ID from element');
            // Try to get scene from text content as last resort
            const sceneName = sceneElement.text().trim();
            console.log('WoD Trigger Tabs | Trying to find scene by name:', sceneName);
            const scene = game.scenes.find(s => s.name === sceneName);
            if (scene) {
                console.log('WoD Trigger Tabs | Found scene by name:', scene.name);
                _showSceneContextMenu(scene, e);
            }
            return;
        }
        
        const scene = game.scenes.get(sceneId);
        if (!scene) {
            console.warn('WoD Trigger Tabs | Could not find scene with ID:', sceneId);
            return;
        }
        
        console.log('WoD Trigger Tabs | Found scene:', scene.name);
        
        // Create context menu
        _showSceneContextMenu(scene, e);
    });
    
    console.log('WoD Trigger Tabs | Fallback context menu attached to', $sceneItems.length, 'elements');
}
