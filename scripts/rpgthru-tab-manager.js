/**
 * RPGThru Tab Manager
 * Handles adding the RPGThru tab to the Foundry sidebar
 */

class RpgThruTabManager {
    constructor() {
        this.isTabAdded = false;
    }

    /**
     * Add the RPGThru tab to the sidebar
     */
    async addTabToSidebar(html) {
        // Check if RPGThru tab already exists
        const existingTab = html.find('a[data-tab="rpgthru"]');
        
        // If tab already exists, just check positioning
        if (existingTab.length > 0) {
            this.checkTabPosition(html);
            return;
        }
        
        // Find the tabs container
        const tabsContainer = this.findTabsContainer(html);
        if (!tabsContainer || tabsContainer.length === 0) {
            console.log("WoD | ERROR: Could not find sidebar tabs container");
            return;
        }
        
        // Create and add the RPGThru tab
        await this.createAndAddTab(tabsContainer);
    }

    /**
     * Find the tabs container in the HTML
     */
    findTabsContainer(html) {
        const possibleSelectors = [
            '#sidebar-tabs .directory-tabs',
            '.sidebar-tabs',
            '#sidebar-tabs',
            '.directory-tabs',
            'nav.sidebar-tabs'
        ];
        
        let tabsContainer = null;
        for (const selector of possibleSelectors) {
            tabsContainer = html.find(selector);
            if (tabsContainer.length > 0) {
                break;
            }
        }
        
        return tabsContainer;
    }

    /**
     * Create and add the RPGThru tab
     */
    async createAndAddTab(tabsContainer) {
        try {
            // Load the tab template with full system path
            const tabTemplate = await renderTemplate('systems/wodsystem/templates/rpgthru/rpgthru-tab.html');
            const rpgthruTab = $(tabTemplate);
            
            // Insert after the Compendiums tab
            const compendiumsTab = tabsContainer.find('a[data-tab="compendium"]');
            if (compendiumsTab.length > 0) {
                compendiumsTab.after(rpgthruTab);
            } else {
                // Fallback: insert after the first tab
                tabsContainer.find('a.item').first().after(rpgthruTab);
            }
            
            this.isTabAdded = true;
            console.log("WoD | RPGThru tab added to sidebar");
        } catch (error) {
            console.error("WoD | Error loading tab template:", error);
            // Fallback: try to load fallback template
            try {
                const fallbackTemplate = await renderTemplate('systems/wodsystem/templates/rpgthru/rpgthru-tab-fallback.html');
                const fallbackTab = $(fallbackTemplate);
                
                const compendiumsTab = tabsContainer.find('a[data-tab="compendium"]');
                if (compendiumsTab.length > 0) {
                    compendiumsTab.after(fallbackTab);
                } else {
                    tabsContainer.find('a.item').first().after(fallbackTab);
                }
                
                this.isTabAdded = true;
                console.log("WoD | RPGThru tab added to sidebar (fallback template)");
            } catch (fallbackError) {
                console.error("WoD | Error loading fallback template:", fallbackError);
                // Last resort: create minimal tab
                const minimalTab = $('<a class="item" data-tab="rpgthru">RPGThru</a>');
                
                const compendiumsTab = tabsContainer.find('a[data-tab="compendium"]');
                if (compendiumsTab.length > 0) {
                    compendiumsTab.after(minimalTab);
                } else {
                    tabsContainer.find('a.item').first().after(minimalTab);
                }
                
                this.isTabAdded = true;
                console.log("WoD | RPGThru tab added to sidebar (minimal fallback)");
            }
        }
    }

    /**
     * Check if the RPGThru tab is properly positioned
     */
    checkTabPosition(html) {
        const tabsContainer = this.findTabsContainer(html);
        if (!tabsContainer) return;
        
        const compendiumsTab = tabsContainer.find('a[data-tab="compendium"]');
        const rpgthruTab = tabsContainer.find('a[data-tab="rpgthru"]');
        
        if (compendiumsTab.length > 0 && rpgthruTab.length > 0) {
            const compendiumsIndex = compendiumsTab.index();
            const rpgthruIndex = rpgthruTab.index();
            
            // If RPGThru tab is not right after Compendiums, reposition it
            if (rpgthruIndex !== compendiumsIndex + 1) {
                rpgthruTab.detach();
                compendiumsTab.after(rpgthruTab);
            }
        }
    }

    /**
     * Check if the tab has been added
     */
    isTabAdded() {
        return this.isTabAdded;
    }
}

// Export the class
export { RpgThruTabManager }; 