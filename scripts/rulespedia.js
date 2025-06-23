console.log('Rulespedia: Script file loaded!');

// Fallback ViewManager if the main one is not available
if (typeof window.ViewManager === 'undefined') {
    console.warn('Rulespedia: ViewManager not found, creating fallback...');
    window.ViewManager = class FallbackViewManager {
        constructor() {
            this.views = new Map();
            this.currentView = null;
            this.viewContainer = null;
        }
        
        registerView(view) {
            this.views.set(view.name, view);
        }
        
        getView(name) {
            return this.views.get(name);
        }
        
        async navigateToView(viewName) {
            const view = this.getView(viewName);
            if (!view) {
                console.error('Rulespedia: View not found:', viewName);
                return false;
            }
            
            // Simple navigation
            const allViews = document.querySelectorAll('.rulespedia-view');
            allViews.forEach(viewElement => {
                viewElement.classList.remove('active');
            });
            
            const targetViewElement = document.querySelector(`[data-view="${viewName}"]`);
            if (targetViewElement) {
                targetViewElement.classList.add('active');
                this.viewContainer = targetViewElement.querySelector('.view-content');
                
                if (this.viewContainer && view.render) {
                    await view.render(this.viewContainer);
                }
                
                this.currentView = view;
                return true;
            }
            return false;
        }
        
        getCurrentView() {
            return this.currentView;
        }
    };
}

// Fallback RuleView if the main one is not available
if (typeof window.RuleView === 'undefined') {
    console.warn('Rulespedia: RuleView not found, creating fallback...');
    window.RuleView = class FallbackRuleView {
        constructor(name, title, icon = 'fas fa-folder') {
            this.name = name;
            this.title = title;
            this.icon = icon;
            this.template = null;
            this.isLoaded = false;
            this.container = null;
        }
        
        setTemplate(template) {
            this.template = template;
        }
        
        async render(container) {
            if (this.template) {
                container.innerHTML = this.template;
                this.container = container;
            }
        }
        
        onRender() {}
        onActivate() {}
        onDeactivate() {}
        
        getBreadcrumbData() {
            return { name: this.name, title: this.title, icon: this.icon };
        }
    };
}

// Fallback view classes if the main ones are not available
if (typeof window.DashboardView === 'undefined') {
    console.warn('Rulespedia: DashboardView not found, creating fallback...');
    window.DashboardView = class FallbackDashboardView extends window.RuleView {
        constructor() {
            super('dashboard', 'Rulespedia Dashboard', 'fas fa-tachometer-alt');
            this.setTemplatePath('systems/wodsystem/templates/rulespedia/fallback-dashboard.html');
        }
    };
}

if (typeof window.ImportView === 'undefined') {
    console.warn('Rulespedia: ImportView not found, creating fallback...');
    window.ImportView = class FallbackImportView extends window.RuleView {
        constructor() {
            super('import', 'Import Books', 'fas fa-upload');
            this.setTemplatePath('systems/wodsystem/templates/rulespedia/fallback-import.html');
        }
    };
}

if (typeof window.ManageView === 'undefined') {
    console.warn('Rulespedia: ManageView not found, creating fallback...');
    window.ManageView = class FallbackManageView extends window.RuleView {
        constructor() {
            super('manage', 'Manage Books', 'fas fa-cog');
            this.setTemplatePath('systems/wodsystem/templates/rulespedia/fallback-manage.html');
        }
    };
}

if (typeof window.SettingsView === 'undefined') {
    console.warn('Rulespedia: SettingsView not found, creating fallback...');
    window.SettingsView = class FallbackSettingsView extends window.RuleView {
        constructor() {
            super('settings', 'Settings', 'fas fa-sliders-h');
            this.setTemplatePath('systems/wodsystem/templates/rulespedia/fallback-settings.html');
        }
    };
}

/**
 * Rulespedia Tab Module
 * Adds a comprehensive rules encyclopedia tab to the Foundry sidebar
 */

class RulespediaTab {
    constructor() {
        this.tabId = 'rulespedia';
        this.tabName = 'Rulespedia';
        this.tabIcon = 'fas fa-book';
        this.template = 'systems/wodsystem/templates/rulespedia/rulespedia-tab.html';
        this.isActive = false;
        this.rulespedia = null;
    }

    /**
     * Initialize the Rulespedia tab
     */
    static init() {
        const rulespediaTab = new RulespediaTab();
        rulespediaTab.registerTab();
        return rulespediaTab;
    }

    /**
     * Register the tab with Foundry's sidebar
     */
    registerTab() {
        // Wait for the sidebar to be ready
        Hooks.once('ready', () => {
            // Add a small delay to ensure sidebar is fully rendered
            setTimeout(() => {
                this.addTabToSidebar();
                this.setupTabSwitching();
            }, 1000);
        });
    }

    /**
     * Setup tab switching to handle when other tabs are clicked
     */
    setupTabSwitching() {
        // Listen for clicks on other tab buttons to properly switch tabs
        document.addEventListener('click', (event) => {
            const tabButton = event.target.closest('#sidebar-tabs .item');
            if (tabButton && tabButton.getAttribute('data-tab') !== this.tabId) {
                // Another tab was clicked, hide our tab content
                const tabContent = document.querySelector(`section[data-tab="${this.tabId}"], .sidebar-tab[data-tab="${this.tabId}"]`);
                if (tabContent) {
                    tabContent.style.display = 'none';
                    tabContent.classList.remove('active');
                }
                
                // Remove active class from our tab button
                const ourTabButton = document.querySelector(`#sidebar-tabs [data-tab="${this.tabId}"]`);
                if (ourTabButton) {
                    ourTabButton.classList.remove('active');
                }
                
                // Show the clicked tab's content
                const clickedTabId = tabButton.getAttribute('data-tab');
                const clickedTabContent = document.querySelector(`section[data-tab="${clickedTabId}"], .sidebar-tab[data-tab="${clickedTabId}"]`);
                if (clickedTabContent) {
                    clickedTabContent.style.display = 'flex';
                    clickedTabContent.classList.add('active');
                }
                
                // Add active class to the clicked tab button
                tabButton.classList.add('active');
                
                this.isActive = false;
            }
        });
    }

    /**
     * Add the tab to the sidebar
     */
    addTabToSidebar() {
        // Find the sidebar
        const sidebar = document.querySelector('#sidebar');
        if (!sidebar) {
            console.error('Rulespedia: Sidebar not found!');
            return;
        }

        // Create tab button first
        const tabButton = document.createElement('a');
        tabButton.className = 'item';
        tabButton.setAttribute('data-tab', this.tabId);
        tabButton.setAttribute('aria-label', 'Rulespedia');
        tabButton.setAttribute('aria-controls', this.tabId);
        tabButton.setAttribute('role', 'tab');
        tabButton.setAttribute('data-tooltip', 'Rulespedia');
        
        // Create icon element
        const icon = document.createElement('i');
        icon.className = this.tabIcon;
        tabButton.appendChild(icon);

        // Add click handler
        tabButton.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            // Remove active class from all other tab buttons
            const allTabButtons = document.querySelectorAll('#sidebar-tabs .item');
            allTabButtons.forEach(btn => {
                if (btn.getAttribute('data-tab') !== this.tabId) {
                    btn.classList.remove('active');
                }
            });
            
            // Hide all other tab content first to prevent overlap
            const allTabContent = document.querySelectorAll('.sidebar-tab, section[data-tab]');
            allTabContent.forEach(tab => {
                if (tab.getAttribute('data-tab') !== this.tabId) {
                    tab.style.display = 'none';
                    tab.classList.remove('active');
                }
            });
            
            // Show our tab content
            const tabContent = document.querySelector(`section[data-tab="${this.tabId}"], .sidebar-tab[data-tab="${this.tabId}"]`);
            if (tabContent) {
                tabContent.style.display = 'flex';
                tabContent.classList.add('active');
            }
            
            // Add active class to our tab button for visual highlight
            tabButton.classList.add('active');
            
            // Call our activation
            await this.activateTab();
        });

        // Find the tabs list
        const tabsList = sidebar.querySelector('#sidebar-tabs');
        if (tabsList) {
            // Find the compendium tab to insert before it
            const compendiumTab = tabsList.querySelector('[data-tab="compendium"]');
            if (compendiumTab) {
                // Insert before the compendium tab
                tabsList.insertBefore(tabButton, compendiumTab);
            } else {
                // Fallback: append to the end if compendium tab not found
                tabsList.appendChild(tabButton);
            }
        } else {
            console.warn('Rulespedia: Tabs list not found');
        }

        // Create tab content container - use the same structure as other Foundry tabs
        const tabContent = document.createElement('section');
        tabContent.className = 'tab sidebar-tab rulespedia-sidebar directory flexcol';
        tabContent.setAttribute('data-tab', this.tabId);
        tabContent.style.display = 'none'; // Keep hidden until user clicks
        
        // Insert the content container directly into the sidebar
        sidebar.appendChild(tabContent);

        // Load the template content
        this.loadTemplate(tabContent);
    }

    /**
     * Hide the Rulespedia tab - Let Foundry handle this
     */
    hideTab() {
        // Let Foundry handle tab hiding - don't interfere
        this.isActive = false;
    }

    /**
     * Load the HTML template into the tab
     */
    async loadTemplate(container) {
        try {
            const response = await fetch(this.template);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.status}`);
            }
            
            const html = await response.text();
            container.innerHTML = html;
            
            // Initialize the Rulespedia interface
            this.initializeRulespedia(container);
            
        } catch (error) {
            console.error('Rulespedia: Error loading template:', error);
            await this.showErrorTemplate(container, error.message);
        }
    }

    async showErrorTemplate(container, errorMessage) {
        const path = 'systems/wodsystem/templates/rulespedia/error-loading.html';
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load error template');
            let html = await response.text();
            html = html.replace(/{{errorMessage}}/g, errorMessage);
            container.innerHTML = html;
        } catch (e) {
            const ultimatePath = 'systems/wodsystem/templates/rulespedia/error-ultimate.html';
            try {
                const response = await fetch(ultimatePath);
                if (!response.ok) throw new Error('Failed to load ultimate error template');
                container.innerHTML = await response.text();
            } catch (e2) {
                container.innerHTML = 'Error Loading Rulespedia: Failed to load the interface.';
            }
        }
    }

    async showLoadingState() {
        await this.showTemplate('search-loading.html');
    }

    async displaySearchResult(result) {
        if (result && result.content) {
            await this.showTemplate('search-result.html', {
                content: result.content,
                source: result.source || ''
            });
        } else {
            await this.showTemplate('search-no-results.html');
        }
    }

    async showError(message) {
        await this.showTemplate('search-error.html', { message });
    }

    async showTemplate(templateFile, context = {}) {
        const ruleContent = document.getElementById('ruleContent');
        if (!ruleContent) return;
        const path = `systems/wodsystem/templates/rulespedia/${templateFile}`;
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load template');
            let html = await response.text();
            // Simple variable replacement for {{var}}
            for (const [key, value] of Object.entries(context)) {
                html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
            ruleContent.innerHTML = html;
        } catch (error) {
            console.error('Error loading template:', error);
        }
    }

    /**
     * Initialize the Rulespedia interface
     */
    async initializeRulespedia(container) {
        try {
            this.rulespedia = new Rulespedia(container);
            await this.rulespedia.init();
            
            // Make the instance available globally for navigation
            window.rulespedia = this.rulespedia;
            
            console.log('Rulespedia: Initialized successfully');
        } catch (error) {
            console.error('Rulespedia: Failed to initialize:', error);
            await this.showErrorTemplate(container, 'Failed to initialize Rulespedia system');
        }
    }

    /**
     * Activate the Rulespedia tab
     */
    async activateTab() {
        // Let Foundry handle tab display - just set our state
        this.isActive = true;

        // Check if CSS is loaded
        if (window.rulespediaCSSLoader) {
            // CSS loader is available, CSS should be loaded
        } else {
            console.warn('Rulespedia: CSS Loader not found! Attempting to create one...');
            
            // Try to create the CSS loader if the class exists
            if (window.RulespediaCSSLoader) {
                window.rulespediaCSSLoader = new window.RulespediaCSSLoader();
                window.rulespediaCSSLoader.loadAllCSS().catch(error => {
                    console.error('Rulespedia: Error loading CSS after creation:', error);
                });
            } else {
                console.error('Rulespedia: RulespediaCSSLoader class not found either!');
            }
        }
        
        // Use the existing framework from the Rulespedia instance
        if (this.rulespedia && this.rulespedia.getFramework()) {
            this.framework = this.rulespedia.getFramework();
            
            // Set global reference for other modules to use
            window.rulespediaFramework = this.framework;
            
            // Set up view navigation event listeners
            this.setupViewNavigation();
            
            // Load the dashboard view by default using the framework
            this.framework.loadView('dashboard').then(() => {
                console.log('Rulespedia: Dashboard view loaded successfully');
            }).catch(error => {
                console.error('Rulespedia: Error loading dashboard view:', error);
                // Fallback to import view if dashboard fails
                this.framework.loadView('import').then(() => {
                    console.log('Rulespedia: Import view loaded as fallback');
                }).catch(fallbackError => {
                    console.error('Rulespedia: Error loading fallback import view:', fallbackError);
                });
            });
        } else {
            console.error('Rulespedia: Framework not available from Rulespedia instance');
        }
    }

    // Initialize search functionality and event listeners
    initializeSearch() {
        // This method is no longer needed since we removed the search functionality
        console.log('Rulespedia: Search functionality removed');
    }

    // Setup view navigation event listeners
    setupViewNavigation() {
        // Handle action button clicks for navigation
        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-view]');
            if (target && this.framework) {
                event.preventDefault();
                event.stopPropagation();
                
                const viewName = target.getAttribute('data-view');
                this.framework.loadView(viewName).then(() => {
                    console.log(`Rulespedia: Navigated to ${viewName} view`);
                }).catch(error => {
                    console.error('Rulespedia: Error navigating to view:', error);
                });
            }
        });

        // Handle back button clicks
        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-back]');
            if (target && this.framework) {
                event.preventDefault();
                event.stopPropagation();
                
                const backView = target.getAttribute('data-back');
                
                this.framework.loadView(backView).then(() => {
                    console.log(`Rulespedia: Navigated back to ${backView} view`);
                }).catch(error => {
                    console.error('Rulespedia: Error navigating back:', error);
                });
            }
        });
    }
}

/**
 * Main Rulespedia class using the new framework and service layer
 */
class Rulespedia {
    constructor(container) {
        this.container = container;
        this.viewManager = null;
        this.contentStore = null;
        this.serviceManager = null;
        this.framework = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Initialize content store
            await this.initializeContentStore();
            
            // Initialize service manager
            await this.initializeServiceManager();
            
            // Initialize framework
            await this.initializeFramework();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Rulespedia: Initialization failed:', error);
        }
    }

    async initializeContentStore() {
        if (window.ContentStore) {
            this.contentStore = new window.ContentStore();
            await this.contentStore.initialize();
        }
    }

    async initializeServiceManager() {
        if (window.RulespediaServiceManager && this.contentStore) {
            this.serviceManager = new window.RulespediaServiceManager(this.contentStore);
            await this.serviceManager.initialize();
            
            // Set global reference for other modules to use
            window.rulespediaServiceManager = this.serviceManager;
        }
    }

    async initializeFramework() {
        if (window.RulespediaFramework) {
            // Pass service manager to framework
            this.framework = new window.RulespediaFramework(this.serviceManager);
            
            // Register event handlers with the framework
            this.registerEventHandlers();
        }
    }

    registerEventHandlers() {
        if (!this.framework || !this.serviceManager) return;

        // Register search event handler
        this.framework.registerEventHandler('search', async (data) => {
            const searchService = this.serviceManager.getSearchService();
            return await searchService.performSearch(data.query, data.options);
        });

        // Register import event handler
        this.framework.registerEventHandler('import', async (data) => {
            const importService = this.serviceManager.getImportService();
            return await importService.importBook(data.file, data.options);
        });

        // Register get books event handler
        this.framework.registerEventHandler('getBooks', async (data) => {
            const importService = this.serviceManager.getImportService();
            return await importService.getImportedBooks();
        });

        // Register delete book event handler
        this.framework.registerEventHandler('deleteBook', async (data) => {
            const importService = this.serviceManager.getImportService();
            return await importService.deleteBook(data.filename);
        });

        // Register get stats event handler
        this.framework.registerEventHandler('getStats', async (data) => {
            const bookManagementService = this.serviceManager.getBookManagementService();
            return await bookManagementService.getBookStats();
        });

        // Register clear books event handler
        this.framework.registerEventHandler('clearBooks', async (data) => {
            const bookManagementService = this.serviceManager.getBookManagementService();
            return await bookManagementService.clearAllBooks();
        });
    }

    setupEventListeners() {
        // Event listeners are set up by the framework
    }

    async navigateToView(viewName) {
        if (this.framework) {
            return await this.framework.loadView(viewName);
        }
        return false;
    }

    /**
     * Switch to a specific view (alias for navigateToView)
     */
    async switchToView(viewName) {
        return await this.navigateToView(viewName);
    }

    getViewManager() {
        return this.framework?.getViewManager();
    }

    getContentStore() {
        return this.contentStore;
    }

    getServiceManager() {
        return this.serviceManager;
    }

    getFramework() {
        return this.framework;
    }
}

// Initialize the Rulespedia tab when the module loads
RulespediaTab.init();

// Make the main classes available globally
window.RulespediaTab = RulespediaTab;
window.Rulespedia = Rulespedia;
window.rulespediaManager = null; // Will be set when Rulespedia instance is created 