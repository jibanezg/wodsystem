/**
 * Rulespedia Framework
 * A class-based framework for managing wizard views and event wiring
 * This framework handles ONLY view management, navigation, and event wiring
 * Business logic is handled by separate service classes
 */

/**
 * Base RuleView class that all views must extend
 */
class RuleView {
    constructor(name, title, icon = 'fas fa-folder') {
        this.name = name;
        this.title = title;
        this.icon = icon;
        this.template = null;
        this.isLoaded = false;
        this.container = null;
    }

    /**
     * Set the HTML template for this view
     * @param {string} template - HTML template string
     */
    setTemplate(template) {
        this.template = template;
    }

    /**
     * Set the template file path for this view
     * @param {string} templatePath - Path to the HTML template file
     */
    setTemplatePath(templatePath) {
        this.templatePath = templatePath;
    }

    /**
     * Load the template for this view
     */
    async loadTemplate() {
        if (this.templatePath) {
            try {
                const response = await fetch(this.templatePath);
                if (!response.ok) {
                    throw new Error(`Failed to load template: ${response.status}`);
                }
                this.template = await response.text();
                this.isLoaded = true;
            } catch (error) {
                console.error(`RuleView: Error loading template for ${this.name}:`, error);
                this.template = await this.getFallbackTemplate();
                this.isLoaded = true;
            }
        } else if (this.template) {
            this.isLoaded = true;
        } else {
            this.template = await this.getFallbackTemplate();
            this.isLoaded = true;
        }
    }

    /**
     * Get fallback template when main template fails
     */
    async getFallbackTemplate() {
        try {
            const path = 'systems/wodsystem/templates/rulespedia/error.html';
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load fallback template: ${response.status}`);
            }
            let template = await response.text();
            
            // Replace with generic error message
            template = template
                .replace('{{type}}', 'fallback')
                .replace('{{title}}', 'Template Error')
                .replace('{{message}}', 'Failed to load view template')
                .replace('{{details}}', 'Please check your template files.');
            
            return template;
        } catch (error) {
            console.error('RuleView: Error loading fallback template:', error);
            try {
                const ultimatePath = 'systems/wodsystem/templates/rulespedia/error.html';
                const response = await fetch(ultimatePath);
                if (!response.ok) {
                    throw new Error(`Failed to load ultimate fallback: ${response.status}`);
                }
                let template = await response.text();
                
                template = template
                    .replace('{{type}}', 'ultimate')
                    .replace('{{title}}', 'Critical Error')
                    .replace('{{message}}', 'Failed to load any template')
                    .replace('{{details}}', 'System may be corrupted.');
                
                return template;
            } catch (ultimateError) {
                console.error('RuleView: Critical template loading failure:', ultimateError);
                return '<div class="error critical">Critical template loading failure</div>';
            }
        }
    }

    /**
     * Render the view
     * @param {HTMLElement} container - Container to render into
     */
    async render(container) {
        if (!this.isLoaded) {
            await this.loadTemplate();
        }

        if (this.template) {
            container.innerHTML = this.template;
            this.container = container;
            this.onRender();
        } else {
            console.error(`RuleView: No template available for ${this.name}`);
            // Use error template instead of inline styles
            try {
                const errorTemplate = await this.loadTemplate('systems/wodsystem/templates/rulespedia/error.html');
                const errorHtml = errorTemplate
                    .replace('{{type}}', 'template')
                    .replace('{{title}}', 'Template Error')
                    .replace('{{message}}', `No template available for ${this.name}`)
                    .replace('{{details}}', 'Please check your template files.');
                container.innerHTML = errorHtml;
            } catch (error) {
                console.error('RuleView: Error loading error template:', error);
                // Ultimate fallback - just text
                container.textContent = `No template available for ${this.name}`;
            }
        }
    }

    /**
     * Called after the view is rendered
     * Override this in subclasses to add view-specific logic
     */
    onRender() {
        // Override in subclasses
    }

    /**
     * Called when the view is activated
     * Override this in subclasses to add activation logic
     */
    onActivate() {
        // Override in subclasses
    }

    /**
     * Called when the view is deactivated
     * Override this in subclasses to add cleanup logic
     */
    onDeactivate() {
        // Override in subclasses
    }

    /**
     * Get breadcrumb data for this view
     */
    getBreadcrumbData() {
        return {
            name: this.name,
            title: this.title,
            icon: this.icon
        };
    }
}

/**
 * View Manager - Handles registration and management of views
 */
class ViewManager {
    constructor() {
        this.views = new Map();
        this.currentView = null;
        this.viewContainer = null;
    }

    /**
     * Register a view
     * @param {RuleView} view - The view to register
     */
    registerView(view) {
        if (!(view instanceof RuleView)) {
            throw new Error('View must extend RuleView class');
        }

        this.views.set(view.name, view);
    }

    /**
     * Get a view by name
     * @param {string} name - View name
     */
    getView(name) {
        return this.views.get(name);
    }

    /**
     * Navigate to a view
     * @param {string} viewName - Name of the view to navigate to
     */
    async navigateToView(viewName) {
        const view = this.getView(viewName);
        if (!view) {
            console.error(`ViewManager: View ${viewName} not found`);
            return false;
        }

        // Prevent recursive navigation
        if (this.currentView && this.currentView.name === viewName) {
            return true;
        }

        // Deactivate current view
        if (this.currentView) {
            this.currentView.onDeactivate();
        }

        // Hide all view containers
        const allViews = document.querySelectorAll('.rulespedia-view');
        allViews.forEach(viewElement => {
            viewElement.classList.remove('active');
            viewElement.style.display = 'none';
        });

        // Show target view container
        const targetViewElement = document.querySelector(`.rulespedia-view[data-view="${viewName}"]`);
        if (targetViewElement) {
            targetViewElement.classList.add('active');
            targetViewElement.style.display = 'block';
            this.viewContainer = targetViewElement.querySelector('.view-content');
            
            if (this.viewContainer) {
                // Render the view
                await view.render(this.viewContainer);
                view.onActivate();
                
                this.currentView = view;
                return true;
            } else {
                console.error(`ViewManager: No content container found for view ${viewName}`);
                return false;
            }
        } else {
            console.error(`ViewManager: View container not found for ${viewName}`);
            return false;
        }
    }

    /**
     * Get breadcrumb HTML for a view
     * @param {string} viewName - Name of the view
     * @param {string} parentView - Parent view name
     */
    async getBreadcrumbHTML(viewName, parentView = 'home') {
        const view = this.getView(viewName);
        if (!view) {
            return '';
        }

        const breadcrumbData = view.getBreadcrumbData();
        
        // Load breadcrumb template
        const template = await this.loadBreadcrumbTemplate('systems/wodsystem/templates/rulespedia/breadcrumb.html', {
            currentView: breadcrumbData,
            parentView: parentView
        });
        
        return template;
    }

    /**
     * Load breadcrumb template
     * @param {string} templateFile - Template file path
     * @param {Object} context - Template context
     */
    async loadBreadcrumbTemplate(templateFile, context = {}) {
        try {
            const response = await fetch(templateFile);
            if (!response.ok) {
                throw new Error(`Failed to load breadcrumb template: ${response.status}`);
            }
            let template = await response.text();
            
            // Simple template replacement
            Object.keys(context).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                template = template.replace(regex, context[key]);
            });
            
            return template;
        } catch (error) {
            console.error('ViewManager: Error loading breadcrumb template:', error);
            return '';
        }
    }

    /**
     * Get all registered views
     */
    getAllViews() {
        return Array.from(this.views.values());
    }

    /**
     * Get current view
     */
    getCurrentView() {
        return this.currentView;
    }
}

/**
 * Rulespedia Framework - Main application class
 * Handles ONLY view management, navigation, and event wiring
 */
class RulespediaFramework {
    constructor(serviceManager = null) {
        this.serviceManager = serviceManager;
        this.viewManager = new ViewManager();
        this.eventHandlers = new Map();
        this.initializeViews();
    }

    /**
     * Set the service manager (can be called after initialization)
     * @param {Object} serviceManager - The service manager instance
     */
    setServiceManager(serviceManager) {
        this.serviceManager = serviceManager;
        console.log('RulespediaFramework: Service manager set');
    }

    /**
     * Initialize all views
     */
    initializeViews() {
        // Check if the actual view classes are available, otherwise use fallbacks
        if (typeof window.HomeView !== 'undefined' && window.HomeView.name !== 'FallbackHomeView') {
            const homeView = new window.HomeView();
            this.viewManager.registerView(homeView);
        } else {
            const homeView = new RuleView('home', 'Home', 'fas fa-home');
            homeView.setTemplatePath('systems/wodsystem/templates/rulespedia/home-view.html');
            this.viewManager.registerView(homeView);
        }
        
        if (typeof window.SearchView !== 'undefined' && window.SearchView.name !== 'FallbackSearchView') {
            const searchView = new window.SearchView(this.serviceManager);
            this.viewManager.registerView(searchView);
        } else {
            const searchView = new RuleView('search', 'Search Rules', 'fas fa-search');
            searchView.setTemplatePath('systems/wodsystem/templates/rulespedia/search-view.html');
            this.viewManager.registerView(searchView);
        }
        
        if (typeof window.ImportView !== 'undefined' && window.ImportView.name !== 'FallbackImportView') {
            // Pass service manager to ImportView if available
            const importView = new window.ImportView(this.serviceManager);
            this.viewManager.registerView(importView);
            
            // Store global reference for debugging
            window.rulespediaImportView = importView;
        } else {
            const importView = new RuleView('import', 'Import Books', 'fas fa-upload');
            importView.setTemplatePath('systems/wodsystem/templates/rulespedia/import-view.html');
            this.viewManager.registerView(importView);
        }
        
        if (typeof window.ManageView !== 'undefined' && window.ManageView.name !== 'FallbackManageView') {
            const manageView = new window.ManageView();
            this.viewManager.registerView(manageView);
        } else {
            const manageView = new RuleView('manage', 'Manage Books', 'fas fa-database');
            manageView.setTemplatePath('systems/wodsystem/templates/rulespedia/manage-view.html');
            this.viewManager.registerView(manageView);
        }
        
        if (typeof window.SettingsView !== 'undefined' && window.SettingsView.name !== 'FallbackSettingsView') {
            const settingsView = new window.SettingsView();
            this.viewManager.registerView(settingsView);
        } else {
            const settingsView = new RuleView('settings', 'Settings', 'fas fa-cog');
            settingsView.setTemplatePath('systems/wodsystem/templates/rulespedia/settings-view.html');
            this.viewManager.registerView(settingsView);
        }
    }

    /**
     * Load a view by name
     * @param {string} viewName - Name of the view to load
     */
    async loadView(viewName) {
        return await this.viewManager.navigateToView(viewName);
    }

    /**
     * Get current view
     */
    getCurrentView() {
        return this.viewManager.getCurrentView();
    }

    /**
     * Register an event handler
     * @param {string} eventName - Name of the event
     * @param {Function} handler - Event handler function
     */
    registerEventHandler(eventName, handler) {
        this.eventHandlers.set(eventName, handler);
    }

    /**
     * Trigger an event
     * @param {string} eventName - Name of the event to trigger
     * @param {*} data - Event data
     */
    async triggerEvent(eventName, data = {}) {
        const handler = this.eventHandlers.get(eventName);
        if (handler) {
            try {
                return await handler(data);
            } catch (error) {
                console.error(`RulespediaFramework: Error in event handler for ${eventName}:`, error);
                throw error;
            }
        } else {
            console.warn(`RulespediaFramework: No handler registered for event: ${eventName}`);
        }
    }

    /**
     * Get the view manager
     */
    getViewManager() {
        return this.viewManager;
    }
}

// Export for use in other modules
window.RuleView = RuleView;
window.ViewManager = ViewManager;
window.RulespediaFramework = RulespediaFramework; 