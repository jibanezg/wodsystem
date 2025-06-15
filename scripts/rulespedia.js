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
if (typeof window.HomeView === 'undefined') {
    console.warn('Rulespedia: HomeView not found, creating fallback...');
    window.HomeView = class FallbackHomeView extends window.RuleView {
        constructor() {
            super('home', 'Rulespedia Home', 'fas fa-home');
            this.setTemplatePath('systems/wodsystem/templates/rulespedia/fallback-home.html');
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
        // Listen for clicks on other tab buttons
        document.addEventListener('click', (event) => {
            const tabButton = event.target.closest('#sidebar-tabs .item');
            if (tabButton && tabButton.getAttribute('data-tab') !== this.tabId) {
                // Another tab was clicked, hide our tab
                this.hideTab();
            }
        });

        // Also listen for Foundry's internal tab changes
        document.addEventListener('click', (event) => {
            if (event.target.closest('.sidebar-tab') && !event.target.closest(`[data-tab="${this.tabId}"]`)) {
                this.hideTab();
            }
        });
    }

    /**
     * Hide the Rulespedia tab
     */
    hideTab() {
        if (this.isActive) {
            const ourTab = document.querySelector(`[data-tab="${this.tabId}"]`);
            if (ourTab) {
                ourTab.classList.remove('active');
            }
            
            const ourTabButton = document.querySelector(`#sidebar-tabs [data-tab="${this.tabId}"]`);
            if (ourTabButton) {
                ourTabButton.classList.remove('active');
            }
            
            this.isActive = false;
        }
    }

    /**
     * Hide all other Foundry tabs when our tab is activated
     */
    hideOtherTabs() {
        // Hide all other sidebar tabs
        const allTabs = document.querySelectorAll('#sidebar .tab');
        allTabs.forEach(tab => {
            if (tab.getAttribute('data-tab') !== this.tabId) {
                tab.style.display = 'none';
                tab.classList.remove('active');
            }
        });
        
        // Remove active class from other tab buttons
        const allTabButtons = document.querySelectorAll('#sidebar-tabs .item');
        allTabButtons.forEach(button => {
            if (button.getAttribute('data-tab') !== this.tabId) {
                button.classList.remove('active');
            }
        });
    }

    /**
     * Add the Rulespedia tab to the sidebar
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
            
            // Hide all other tabs
            this.hideTab();
            
            // Activate our tab button
            tabButton.classList.add('active');
            
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
        
        console.log('Rulespedia: Created tab content element:', tabContent);
        console.log('Rulespedia: Tab content data-tab attribute:', tabContent.getAttribute('data-tab'));
        
        // Insert the content container directly into the sidebar
        sidebar.appendChild(tabContent);
        console.log('Rulespedia: Tab content inserted into sidebar');
        console.log('Rulespedia: Sidebar children count:', sidebar.children.length);

        // Load the template content
        this.loadTemplate(tabContent);
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
    initializeRulespedia(container) {
        this.rulespedia = new Rulespedia(container);
        this.rulespedia.init();
        
        // Set global reference for other modules to use
        window.rulespediaManager = this.rulespedia;
    }

    /**
     * Activate the Rulespedia tab
     */
    async activateTab() {
        console.log('Rulespedia: Activating tab...');
        console.log('Rulespedia: Tab ID:', this.tabId);
        
        // Hide all other tabs first
        this.hideOtherTabs();
        
        // Show the tab content - be more specific to avoid selecting the tab button
        const tabContent = document.querySelector(`section[data-tab="${this.tabId}"], .sidebar-tab[data-tab="${this.tabId}"]`);
        console.log('Rulespedia: Found tab content element:', tabContent);
        
        if (tabContent) {
            console.log('Rulespedia: Tab content element classes:', tabContent.className);
            console.log('Rulespedia: Tab content element parent:', tabContent.parentElement);
            
            // Show the tab content
            tabContent.style.display = 'flex';
            tabContent.classList.add('active');
            
            console.log('Rulespedia: Tab content activated');
            
            // Check if there's any content inside
            console.log('Rulespedia: Tab content innerHTML length:', tabContent.innerHTML.length);
            console.log('Rulespedia: Tab content children:', tabContent.children);
        } else {
            console.error('Rulespedia: Tab content not found!');
            
            // Let's see what elements exist with similar attributes
            const allElements = document.querySelectorAll('[data-tab], .rulespedia-sidebar, .tab');
            console.log('Rulespedia: All potential tab elements:', allElements);
        }
        
        // Set active state
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
            
            // Load the home view by default using the framework
            this.framework.loadView('home').then(() => {
                console.log('Rulespedia: Home view loaded successfully');
            }).catch(error => {
                console.error('Rulespedia: Error loading home view:', error);
                // Fallback to import view if home fails
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
        console.log('Rulespedia: Setting up view navigation event listeners');
        
        // Handle action button clicks for navigation
        document.addEventListener('click', (event) => {
            console.log('Rulespedia: Click event detected on:', event.target);
            
            const target = event.target.closest('[data-view]');
            console.log('Rulespedia: Found data-view target:', target);
            
            if (target && this.framework) {
                event.preventDefault();
                event.stopPropagation();
                
                const viewName = target.getAttribute('data-view');
                console.log('Rulespedia: Navigating to view:', viewName);
                
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