console.log('Rulespedia: Script file loaded!');

// Debug: Check if framework classes are available
console.log('Rulespedia: Checking framework availability...');
console.log('Rulespedia: ViewManager available:', typeof window.ViewManager);
console.log('Rulespedia: RuleView available:', typeof window.RuleView);
console.log('Rulespedia: HomeView available:', typeof window.HomeView);

// Fallback ViewManager if the main one is not available
if (typeof window.ViewManager === 'undefined') {
    console.warn('Rulespedia: ViewManager not found, creating fallback...');
    window.ViewManager = class FallbackViewManager {
        constructor() {
            this.views = new Map();
            this.currentView = null;
            this.viewContainer = null;
            console.log('Rulespedia: Using fallback ViewManager');
        }
        
        registerView(view) {
            console.log('Rulespedia: Fallback ViewManager registering view:', view.name);
            this.views.set(view.name, view);
        }
        
        getView(name) {
            return this.views.get(name);
        }
        
        async navigateToView(viewName) {
            console.log('Rulespedia: Fallback ViewManager navigating to:', viewName);
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
                console.log('Rulespedia: Fallback RuleView rendered:', this.name);
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
        console.log('Rulespedia: Initializing tab...');
        const rulespediaTab = new RulespediaTab();
        rulespediaTab.registerTab();
        return rulespediaTab;
    }

    /**
     * Register the tab with Foundry's sidebar
     */
    registerTab() {
        console.log('Rulespedia: Registering tab...');
        // Wait for the sidebar to be ready
        Hooks.once('ready', () => {
            console.log('Rulespedia: Ready hook triggered, adding tab...');
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
            console.log('Rulespedia: Tab hidden');
        }
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
        tabButton.addEventListener('click', (event) => {
            event.preventDefault();
            
            // Hide all other tabs first
            const allTabs = document.querySelectorAll('.sidebar-tab');
            allTabs.forEach(tab => {
                tab.classList.remove('active');
                tab.style.display = 'none';
            });
            
            // Remove active class from all tab buttons
            const allTabButtons = document.querySelectorAll('#sidebar-tabs .item');
            allTabButtons.forEach(button => {
                button.classList.remove('active');
            });
            
            // Show our tab
            const ourTab = document.querySelector(`[data-tab="${this.tabId}"]`);
            if (ourTab) {
                ourTab.classList.add('active');
                ourTab.style.display = 'flex';
            }
            
            // Activate our tab button
            tabButton.classList.add('active');
            
            this.activateTab();
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
        tabContent.style.position = 'relative'; // For debug positioning
        
        // Insert the content container directly into the sidebar
        sidebar.appendChild(tabContent);

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
    activateTab() {
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
        
        // Initialize the framework
        this.framework = new RulespediaFramework();
        
        // Set global reference for other modules to use
        window.rulespediaFramework = this.framework;
        
        // Load the home view using the framework
        this.framework.loadView('home').then(() => {
            // Initialize search functionality after view is loaded
            this.initializeSearch();
        }).catch(error => {
            console.error('Rulespedia: Error loading home view:', error);
        });
    }

    // Initialize search functionality and event listeners
    initializeSearch() {
        const searchInput = document.getElementById('semantic-search');
        const sendButton = document.getElementById('send-button');
        
        if (searchInput && sendButton) {
            // Auto-resize textarea
            const autoResize = () => {
                searchInput.style.height = 'auto';
                searchInput.style.height = Math.min(searchInput.scrollHeight, 6 * 16) + 'px'; // Max 6 lines
            };
            
            // Handle input events
            searchInput.addEventListener('input', autoResize);
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.performSearch();
                }
            });
            
            // Handle send button click
            sendButton.addEventListener('click', () => {
                this.performSearch();
            });
            
            // Initial resize
            autoResize();
        }

        // Handle view navigation
        this.setupViewNavigation();
    }

    // Setup view navigation event listeners
    setupViewNavigation() {
        // Handle action button clicks
        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-view]');
            if (target && this.framework) {
                event.preventDefault();
                event.stopPropagation();
                
                const viewName = target.getAttribute('data-view');
                
                this.framework.loadView(viewName).then(() => {
                    // Re-initialize search functionality for the new view
                    setTimeout(() => {
                        this.initializeSearch();
                    }, 100);
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
                    // Re-initialize search functionality for the new view
                    setTimeout(() => {
                        this.initializeSearch();
                    }, 100);
                }).catch(error => {
                    console.error('Rulespedia: Error navigating back:', error);
                });
            }
        });
    }

    // Perform semantic search
    async performSearch() {
        const searchInput = document.getElementById('semantic-search');
        const query = searchInput.value.trim();
        
        if (!query) {
            ui.notifications.warn('Please enter a search query.');
            return;
        }
        
        // Show loading state
        this.showLoadingState();
        
        try {
            // Call the search function from the framework
            const result = await this.framework.performSemanticSearch(query);
            this.displaySearchResult(result);
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed: ' + error.message);
        }
    }
}

/**
 * Main Rulespedia class using the new framework
 */
class Rulespedia {
    constructor(container) {
        this.container = container;
        this.viewManager = null;
        this.vectorDB = null;
        this.embeddingModel = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Initialize vector database
            await this.initializeVectorDB();
            
            // Initialize embedding model
            await this.initializeEmbeddingModel();
            
            // Register views
            this.registerViews();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Rulespedia: Initialization failed:', error);
        }
    }

    registerViews() {
        // Views are registered by the framework
    }

    async initializeVectorDB() {
        if (window.VectorDatabaseManager) {
            this.vectorDB = new window.VectorDatabaseManager();
            await this.vectorDB.initialize();
        }
    }

    async initializeEmbeddingModel() {
        if (this.vectorDB && this.vectorDB.embeddingModel) {
            this.embeddingModel = this.vectorDB.embeddingModel;
        }
    }

    setupEventListeners() {
        // Event listeners are set up by the framework
    }

    handleSearch() {
        // Search is handled by the tab class
    }

    async navigateToView(viewName) {
        if (this.viewManager) {
            return await this.viewManager.navigateToView(viewName);
        }
        return false;
    }

    getViewManager() {
        return this.viewManager;
    }

    getVectorDB() {
        return this.vectorDB;
    }

    getEmbeddingModel() {
        return this.embeddingModel;
    }
}

// Initialize the Rulespedia tab when the module loads
RulespediaTab.init();

// Make the main classes available globally
window.RulespediaTab = RulespediaTab;
window.Rulespedia = Rulespedia;
window.rulespediaManager = null; // Will be set when Rulespedia instance is created 