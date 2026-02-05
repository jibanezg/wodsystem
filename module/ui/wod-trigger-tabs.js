import { WodTriggerConfigDialog } from "../apps/wod-trigger-config-dialog.js";

export function registerWodTriggerTabs() {
    // V12/V13 compatible: renderTileConfig fires for both Application and ApplicationV2
    Hooks.on('renderTileConfig', async (app, html) => {
        _handleRenderHook(app, html, 'TileConfig');
    });

    Hooks.on('renderRegionConfig', async (app, html) => {
        _handleRenderHook(app, html, 'RegionConfig');
    });

    // ApplicationV2 in V13 may also fire these hooks with different arguments
    Hooks.on('renderDocumentSheetV2', async (app, html) => {
        if (app?.document?.documentName === 'Tile' || app?.document?.documentName === 'Region') {
            _handleRenderHook(app, html, 'DocumentSheetV2');
        }
    });

    // Add hooks to handle tab visibility after re-renders
    Hooks.on('renderTileConfig', (app, html) => {
        setTimeout(() => {
            _ensureWodTriggersTabVisible(app, html);
        }, 100);
    });

    Hooks.on('renderRegionConfig', (app, html) => {
        setTimeout(() => {
            _ensureWodTriggersTabVisible(app, html);
        }, 100);
    });

    Hooks.on('renderDocumentSheetV2', (app, html) => {
        if (app?.document?.documentName === 'Tile' || app?.document?.documentName === 'Region') {
            setTimeout(() => {
                _ensureWodTriggersTabVisible(app, html);
            }, 100);
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
        console.warn(`WoD Trigger Tabs | Could not get jQuery element from ${source}`, { html, app });
        return;
    }

    for (const delay of [0, 50, 200]) {
        setTimeout(() => {
            _injectWodTriggersTab(app, $html, doc).catch(error => {
                console.error(`WoD Trigger Tabs | Failed injecting ${source} tab`, error);
            });
        }, delay);
    }
}

async function _injectWodTriggersTab(app, html, doc) {
    // Try multiple selectors for tab navigation (V12 Application vs V13 ApplicationV2)
    const navSelectors = [
        'nav.sheet-tabs',
        'nav.tabs',
        'nav[data-group]',
        'nav[role="tablist"]',
        '.tabs[data-group]',
        '[data-application-part="tabs"]'
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
        const bodySelectors = ['section.sheet-body', '.sheet-body', 'section.content', 'div.content', '.window-content'];
        for (const sel of bodySelectors) {
            const found = html.find(sel).first();
            if (found.length) {
                contentRoot = found;
                break;
            }
        }
    }

    if (!nav?.length || !contentRoot?.length) {
        console.warn('WoD Trigger Tabs | Could not find tab navigation/content root', {
            doc: doc?.id,
            navFound: !!nav?.length,
            contentRootFound: !!contentRoot?.length,
            htmlClasses: html.attr?.('class'),
            htmlChildren: html.children?.()?.length
        });
        return;
    }

    const group = nav.attr('data-group') || existingTab?.attr('data-group') || 'sheet';

    // Avoid double injection
    if (html.find('[data-tab="wod-triggers"]').length) return;

    // Determine nav item element type (a or button based on existing items)
    const existingNavItem = nav.find('[data-tab]').first();
    const navItemTag = existingNavItem.prop('tagName')?.toLowerCase() || 'a';
    const navItemClass = existingNavItem.attr('class') || 'item';

    nav.append(`<${navItemTag} class="${navItemClass}" data-tab="wod-triggers" data-group="${group}">WoD Triggers</${navItemTag}>`);
    const navItem = nav.find('[data-tab="wod-triggers"]').last();

    const triggers = doc.getFlag('wodsystem', 'triggers') || [];
    const renderFn = foundry?.applications?.handlebars?.renderTemplate || globalThis.renderTemplate;
    if (typeof renderFn !== 'function') {
        throw new Error('No renderTemplate function available');
    }

    const rendered = await renderFn(
        'systems/wodsystem/templates/apps/wod-triggers-tab.html',
        { triggers: Array.isArray(triggers) ? triggers : [] }
    );

    contentRoot.append(`<div class="tab" data-group="${group}" data-tab="wod-triggers">${rendered}</div>`);
    const tabEl = contentRoot.find('div.tab[data-tab="wod-triggers"]').last();

    // Re-bind existing tab controller so our newly added tab is clickable
    try {
        if (Array.isArray(app._tabs)) {
            for (const t of app._tabs) {
                if (t?.bind) t.bind(html[0]);
            }
        } else if (app._tabs?.bind) {
            app._tabs.bind(html[0]);
        }
    } catch (error) {
        console.warn('WoD Trigger Tabs | Could not rebind tabs', error);
    }

    // Fallback: manual activation if tab controller doesn't pick up the new tab
    navItem.off('click.wodTriggersFallback').on('click.wodTriggersFallback', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        // Try ApplicationV2 changeTab method first (V13)
        try {
            if (typeof app.changeTab === 'function') {
                app.changeTab('wod-triggers', group);
                return;
            }
        } catch (e) {
            // continue
        }

        // Try V12 tabs controller
        try {
            const maybeTabs = app._tabs;
            if (Array.isArray(maybeTabs)) {
                const t = maybeTabs.find(x => x?.group === group || x?.options?.group === group) || maybeTabs[0];
                if (t?.activate) {
                    t.activate('wod-triggers');
                    return;
                }
            } else if (maybeTabs?.activate) {
                maybeTabs.activate('wod-triggers');
                return;
            }
        } catch (e) {
            // continue to DOM fallback
        }

        // Pure DOM fallback - deactivate all tabs in group, activate ours
        const allNavItems = nav.find(`[data-tab][data-group="${group}"], [data-tab]:not([data-group])`);
        allNavItems.removeClass('active');
        navItem.addClass('active');

        const allTabs = contentRoot.find(`.tab[data-group="${group}"], .tab[data-tab]`);
        allTabs.removeClass('active');
        tabEl.addClass('active');
    });

    _activateWodTriggersListeners(app, html, doc);
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

function _activateWodTriggersListeners(app, html, doc) {
    // Find the tab content - try multiple selectors for compatibility
    let tab = html.find('[data-tab="wod-triggers"]').last();
    if (!tab.length) {
        tab = html.find('.wod-triggers-list').closest('.tab');
    }
    if (!tab.length) {
        tab = html.find('.wod-triggers-list');
    }
    if (!tab.length) {
        console.warn('WoD Trigger Tabs | Could not find triggers tab content');
        return;
    }

    // Add trigger button
    tab.find('button[data-action="add-trigger"]').off('click.wodTriggers').on('click.wodTriggers', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const dialog = new WodTriggerConfigDialog(doc, null, { onClose: () => app.render(false) });
        dialog.render(true);
    });

    // Edit trigger buttons
    tab.find('button[data-action="edit-trigger"]').off('click.wodTriggers').on('click.wodTriggers', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const triggerId = ev.currentTarget.dataset.triggerId;
        if (!triggerId) return;
        const dialog = new WodTriggerConfigDialog(doc, triggerId, { onClose: () => app.render(false) });
        dialog.render(true);
    });

    // Delete trigger buttons
    tab.find('button[data-action="delete-trigger"]').off('click.wodTriggers').on('click.wodTriggers', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const triggerId = ev.currentTarget.dataset.triggerId;
        if (!triggerId) return;
        
        const triggers = doc.getFlag('wodsystem', 'triggers') || [];
        const next = Array.isArray(triggers) ? triggers.filter(t => t?.id !== triggerId) : [];
        await doc.setFlag('wodsystem', 'triggers', next);
        app.render(false);
    });
}
