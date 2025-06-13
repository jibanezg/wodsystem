/**
 * Rulespedia Framework
 * A class-based framework for managing wizard views
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
     * Load the template from file
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
     * Get fallback template if loading fails
     */
    async getFallbackTemplate() {
        // Load the fallback template from the external HTML file
        const path = 'systems/wodsystem/templates/rulespedia/error-template.html';
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load fallback template');
            return await response.text();
        } catch (e) {
            // As a last resort, return a minimal error message
            return 'Template Error: Failed to load template.';
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
        });

        // Show target view container
        const targetViewElement = document.querySelector(`.rulespedia-view[data-view="${viewName}"]`);
        if (targetViewElement) {
            targetViewElement.classList.add('active');
            this.viewContainer = targetViewElement.querySelector('.view-content');
            
            if (this.viewContainer) {
                // Render the view
                await view.render(this.viewContainer);
                view.onActivate();
                
                this.currentView = view;
                return true;
            } else {
                console.error(`ViewManager: View content container not found for ${viewName}`);
                return false;
            }
        } else {
            console.error(`ViewManager: View container for ${viewName} not found`);
            return false;
        }
    }

    /**
     * Get breadcrumb HTML for a view
     * @param {string} viewName - Name of the view
     * @param {string} parentView - Parent view name (optional)
     */
    async getBreadcrumbHTML(viewName, parentView = 'home') {
        const view = this.getView(viewName);
        if (!view) return '';

        const breadcrumbData = view.getBreadcrumbData();
        
        if (parentView === 'home') {
            return await this.loadBreadcrumbTemplate('breadcrumb-simple.html', {
                viewName: breadcrumbData.name,
                viewIcon: breadcrumbData.icon,
                viewTitle: breadcrumbData.title
            });
        } else {
            const parentViewData = this.getView(parentView)?.getBreadcrumbData();
            return await this.loadBreadcrumbTemplate('breadcrumb-nested.html', {
                parentView: parentView,
                parentIcon: parentViewData?.icon || 'fas fa-folder',
                parentTitle: parentViewData?.title || parentView,
                viewName: breadcrumbData.name,
                viewIcon: breadcrumbData.icon,
                viewTitle: breadcrumbData.title
            });
        }
    }

    async loadBreadcrumbTemplate(templateFile, context = {}) {
        const path = `systems/wodsystem/templates/rulespedia/${templateFile}`;
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load breadcrumb template');
            let html = await response.text();
            // Simple variable replacement for {{var}}
            for (const [key, value] of Object.entries(context)) {
                html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
            return html;
        } catch (e) {
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
 */
class RulespediaFramework {
    constructor() {
        this.viewManager = new ViewManager();
        this.initializeViews();
    }

    /**
     * Initialize all views
     */
    initializeViews() {
        // Check if the actual view classes are available, otherwise use fallbacks
        if (typeof window.HomeView !== 'undefined' && window.HomeView.name !== 'FallbackHomeView') {
            console.log('RulespediaFramework: Using actual HomeView class');
            const homeView = new window.HomeView();
            this.viewManager.registerView(homeView);
        } else {
            console.log('RulespediaFramework: Using fallback HomeView');
            const homeView = new RuleView('home', 'Home', 'fas fa-home');
            homeView.setTemplatePath('systems/wodsystem/templates/rulespedia/rulespedia-home.html');
            this.viewManager.registerView(homeView);
        }
        
        if (typeof window.ImportView !== 'undefined' && window.ImportView.name !== 'FallbackImportView') {
            console.log('RulespediaFramework: Using actual ImportView class');
            const importView = new window.ImportView();
            this.viewManager.registerView(importView);
        } else {
            console.log('RulespediaFramework: Using fallback ImportView');
            const importView = new RuleView('import', 'Import Books', 'fas fa-upload');
            importView.setTemplatePath('systems/wodsystem/templates/rulespedia/rulespedia-import.html');
            this.viewManager.registerView(importView);
        }
        
        if (typeof window.ManageView !== 'undefined' && window.ManageView.name !== 'FallbackManageView') {
            console.log('RulespediaFramework: Using actual ManageView class');
            const manageView = new window.ManageView();
            this.viewManager.registerView(manageView);
        } else {
            console.log('RulespediaFramework: Using fallback ManageView');
            const manageView = new RuleView('manage', 'Manage Books', 'fas fa-database');
            manageView.setTemplatePath('systems/wodsystem/templates/rulespedia/rulespedia-manage.html');
            this.viewManager.registerView(manageView);
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
     * Perform semantic search using the vector database
     * @param {string} query - Search query
     */
    async performSemanticSearch(query) {
        try {
            // Get the vector database from the global reference
            const vectorDB = window.rulespediaVectorDB || window.rulespediaManager?.getVectorDB();
            
            if (!vectorDB) {
                throw new Error('Vector database not available');
            }
            
            // Perform the search with multiple results
            const results = await vectorDB.search(query, 5, 0.1); // Much lower threshold for more results
            
            if (results.length === 0) {
                return {
                    content: `No results found for: "${query}". Try a different search term or import more rulebooks.`,
                    source: 'No matches',
                    confidence: 0.0,
                    type: 'no_results'
                };
            }
            
            // Format multiple results
            if (results.length === 1) {
                // Single result
                const result = results[0];
                return {
                    content: result.document.content,
                    source: result.document.metadata.filename || 'Unknown source',
                    confidence: result.similarity,
                    metadata: result.document.metadata,
                    type: 'single_result'
                };
            } else {
                // Multiple results - format them nicely
                const formattedResults = results.map((result, index) => {
                    const content = result.document.content.length > 300 
                        ? result.document.content.substring(0, 300) + '...'
                        : result.document.content;
                    
                    return {
                        rank: index + 1,
                        content: content,
                        source: result.document.metadata.filename || 'Unknown source',
                        confidence: result.similarity,
                        semanticScore: result.semanticSimilarity,
                        keywordScore: result.keywordScore,
                        metadata: result.document.metadata
                    };
                });
                
                return {
                    content: this.formatMultipleResults(formattedResults, query),
                    source: `${results.length} results found`,
                    confidence: results[0].similarity,
                    results: formattedResults,
                    type: 'multiple_results'
                };
            }
            
        } catch (error) {
            console.error('RulespediaFramework: Search error:', error);
            return {
                content: `Search failed: ${error.message}. Please try again.`,
                source: 'Error',
                confidence: 0.0,
                type: 'error'
            };
        }
    }
    
    /**
     * Format multiple search results for display
     */
    formatMultipleResults(results, query) {
        let formatted = `<h4>Found ${results.length} results for "${query}":</h4>\n\n`;
        
        results.forEach((result, index) => {
            formatted += `<div class="search-result-item">\n`;
            formatted += `<h5>${result.rank}. ${result.source}</h5>\n`;
            formatted += `<p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(1)}% `;
            formatted += `(Semantic: ${(result.semanticScore * 100).toFixed(1)}%, Keywords: ${(result.keywordScore * 100).toFixed(1)}%)</p>\n`;
            formatted += `<div class="result-content">${result.content}</div>\n`;
            formatted += `</div>\n\n`;
        });
        
        return formatted;
    }

    /**
     * Import a rulebook (placeholder for now)
     * @param {File} file - File to import
     */
    async importRulebook(file) {
        // Simulate import delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return {
            success: true,
            message: `Successfully imported ${file.name}`,
            filename: file.name
        };
    }

    /**
     * Get list of imported rulebooks (placeholder for now)
     */
    async getImportedRulebooks() {
        // Return mock data for now
        return [
            { name: 'Player\'s Handbook', filename: 'phb.pdf', size: '2.3 MB', imported: '2024-01-15' },
            { name: 'Dungeon Master\'s Guide', filename: 'dmg.pdf', size: '1.8 MB', imported: '2024-01-10' },
            { name: 'Monster Manual', filename: 'mm.pdf', size: '3.1 MB', imported: '2024-01-05' }
        ];
    }

    /**
     * Delete a rulebook (placeholder for now)
     * @param {string} filename - Filename to delete
     */
    async deleteRulebook(filename) {
        // Simulate delete delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            success: true,
            message: `Successfully deleted ${filename}`
        };
    }
}

// Export for use in other modules
window.RuleView = RuleView;
window.ViewManager = ViewManager;
window.RulespediaFramework = RulespediaFramework; 