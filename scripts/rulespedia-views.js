/**
 * Rulespedia Views - UI Framework Components
 * Handles rendering and user interactions for the Rulespedia system
 * Framework layer - no business logic here, no HTML templates here
 */

console.log('Rulespedia Views: Script file loaded!');

/**
 * Import View - Handles book import UI
 */
class ImportView extends RuleView {
    constructor(serviceManager = null) {
        super('import', 'Import Books', 'fas fa-upload');
        
        this.serviceManager = serviceManager;
        
        // Try to get import service from service manager first
        this.importService = null;
        if (serviceManager) {
            try {
                this.importService = serviceManager.getImportService();
                // Ensure LLM services are initialized
                serviceManager.initializeLLMServices();
            } catch (error) {
                console.warn('ImportView: Failed to get ImportService from manager:', error);
            }
        }
        
        // If no service manager or import service, try to create one directly
        if (!this.importService) {
            try {
                // Check if ContentStore is available
                if (typeof window.ContentStore === 'undefined') {
                    throw new Error('ContentStore not available');
                }
                
                // Check if ImportService is available
                if (typeof window.ImportService === 'undefined' && typeof window.RulespediaServices?.ImportService === 'undefined') {
                    throw new Error('ImportService not available');
                }
                
                const contentStore = new window.ContentStore();
                const ImportServiceClass = window.ImportService || window.RulespediaServices?.ImportService;
                this.importService = new ImportServiceClass(contentStore);
            } catch (error) {
                console.warn('ImportView: Failed to create ImportService directly:', error);
                // Don't throw here - we'll handle this gracefully in the UI
            }
        }
        
        this.bookManagementService = null;
        if (serviceManager) {
            try {
                this.bookManagementService = serviceManager.getBookManagementService();
            } catch (error) {
                console.warn('ImportView: Failed to get BookManagementService from manager:', error);
            }
        }
        
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/import-view.html');
        this.isInitialized = false;
        this.eventListeners = [];
    }

    /**
     * Called after the view is rendered
     */
    onRender() {
        // Don't clear content here - let the parent class handle template loading
        // The template will be loaded first, then we can set up event listeners
        
        // Wait a bit for the DOM to be ready, then initialize
        setTimeout(() => {
            if (!this.isInitialized) {
                this.initialize();
                this.isInitialized = true;
            }
        }, 10);
    }

    /**
     * Called when the view is activated
     */
    onActivate() {
        // Only initialize if not already done and DOM is ready
        setTimeout(() => {
            if (!this.isInitialized) {
                this.initialize();
                this.isInitialized = true;
            }
        }, 10);
    }

    /**
     * Called when the view is deactivated
     */
    onDeactivate() {
        // Clean up event listeners to prevent duplicates
        this.cleanupEventListeners();
        this.isInitialized = false;
    }

    /**
     * Clean up event listeners
     */
    cleanupEventListeners() {
        this.eventListeners.forEach(listener => {
            if (listener.element && listener.type && listener.handler) {
                listener.element.removeEventListener(listener.type, listener.handler);
            }
        });
        this.eventListeners = [];
    }

    /**
     * Add event listener with tracking
     */
    addTrackedEventListener(element, type, handler) {
        element.addEventListener(type, handler);
        this.eventListeners.push({ element, type, handler });
    }

    /**
     * Initialize event handlers
     */
    initialize() {
        this.setupFileUpload();
        this.setupImportButton();
        this.setupProgressTracking();
    }

    /**
     * Setup file upload functionality
     */
    setupFileUpload() {
        // Wait a bit more for DOM to be fully ready
        setTimeout(() => {
            const fileInput = document.getElementById('fileInput');
            const uploadArea = document.getElementById('fileUploadArea');
            const selectBtn = document.querySelector('.select-files-btn');
            const selectedFiles = document.getElementById('selectedFiles');
            const selectedFilesSection = document.getElementById('selectedFilesSection');
            const startImportBtn = document.getElementById('startImport');

            if (!fileInput || !uploadArea || !selectBtn) {
                console.error('ImportView: Required elements not found for file upload setup');
                return;
            }

            // File selection button
            this.addTrackedEventListener(selectBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Use Foundry's FilePicker
                const fp = new FilePicker({
                    type: "file",
                    current: "",
                    callback: (path) => {
                        // Handle the selected file path
                        this.handleFileSelectionFromPath(path);
                    },
                    extensions: [".pdf"],
                    button: selectBtn
                });
                fp.browse();
            });

            // Also make the upload area clickable
            this.addTrackedEventListener(uploadArea, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Use Foundry's FilePicker
                const fp = new FilePicker({
                    type: "file",
                    current: "",
                    callback: (path) => {
                        // Handle the selected file path
                        this.handleFileSelectionFromPath(path);
                    },
                    extensions: [".pdf"],
                    button: uploadArea
                });
                fp.browse();
            });

            // File input change
            this.addTrackedEventListener(fileInput, 'change', (e) => {
                this.handleFileSelection(e.target.files);
            });

            // Drag and drop
            this.addTrackedEventListener(uploadArea, 'dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            this.addTrackedEventListener(uploadArea, 'dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            this.addTrackedEventListener(uploadArea, 'drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                this.handleFileSelection(e.dataTransfer.files);
            });
        }, 100);
    }

    /**
     * Handle file selection from Foundry's FilePicker path
     */
    async handleFileSelectionFromPath(path) {
        try {
            // Get the file from the path using Foundry's API
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status}`);
            }
            
            const blob = await response.blob();
            const file = new File([blob], path.split('/').pop(), { type: 'application/pdf' });
            
            this.handleFileSelection([file]);
            
        } catch (error) {
            console.error('ImportView: Error handling file from path:', error);
            this.showMessage('Error loading file. Please try again.', 'error');
        }
    }

    /**
     * Handle file selection
     */
    async handleFileSelection(files) {
        const selectedFiles = document.getElementById('selectedFiles');
        const selectedFilesSection = document.getElementById('selectedFilesSection');
        const startImportBtn = document.getElementById('startImport');
        
        // DEBUG: Check if elements exist
        if (!selectedFiles) {
            console.error('ImportView: selectedFiles element not found!');
            return;
        }
        
        if (!selectedFilesSection) {
            console.error('ImportView: selectedFilesSection element not found!');
            return;
        }
        
        if (!startImportBtn) {
            console.error('ImportView: startImport button not found!');
            return;
        }
        
        if (files.length === 0) return;

        // Filter for PDF files
        const pdfFiles = Array.from(files).filter(file => 
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        );

        if (pdfFiles.length === 0) {
            this.showMessage('Please select PDF files only.', 'error');
            return;
        }

        // Use template for file items
        try {
            const fileItemTemplate = await this.loadTemplateFile('systems/wodsystem/templates/rulespedia/file-item.html');
            const fileItemsHtml = pdfFiles.map(file => {
                return fileItemTemplate
                    .replace('{{fileName}}', file.name)
                    .replace('{{fileSize}}', this.formatFileSize(file.size));
            }).join('');
            
            selectedFiles.innerHTML = fileItemsHtml;
            selectedFilesSection.style.display = 'block';
            startImportBtn.disabled = false;
            
            // Store files for import
            this.selectedFiles = pdfFiles;
            
        } catch (error) {
            console.error('ImportView: Error loading file item template:', error);
            // Fallback to simple template
            try {
                const simpleTemplate = await this.loadTemplateFile('systems/wodsystem/templates/rulespedia/file-item-simple.html');
                const fallbackHtml = pdfFiles.map(file => {
                    return simpleTemplate
                        .replace('{{fileName}}', file.name)
                        .replace('{{fileSize}}', this.formatFileSize(file.size));
                }).join('');
                
                selectedFiles.innerHTML = fallbackHtml;
            } catch (fallbackError) {
                console.error('ImportView: Error loading fallback template:', fallbackError);
                // Ultimate fallback - just text
                selectedFiles.innerHTML = pdfFiles.map(file => 
                    `${file.name} (${this.formatFileSize(file.size)})`
                ).join('\n');
            }
            selectedFilesSection.style.display = 'block';
            startImportBtn.disabled = false;
            this.selectedFiles = pdfFiles;
        }
    }

    /**
     * Setup import button functionality
     */
    setupImportButton() {
        // Wait a bit more for DOM to be fully ready
        setTimeout(() => {
            const startImportBtn = document.getElementById('startImport');

            if (!startImportBtn) {
                console.error('ImportView: startImport button not found');
                return;
            }

            // Add click event listener
            this.addTrackedEventListener(startImportBtn, 'click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (!this.selectedFiles || this.selectedFiles.length === 0) {
                    this.showMessage('No files selected', 'warning');
                    return;
                }
                
                await this.startImport();
            });
        }, 100);
    }

    /**
     * Start the import process
     */
    async startImport() {
        if (!this.importService) {
            this.showMessage('Import service not available', 'error');
            return;
        }

        try {
            this.showImportProgress();
            
            const results = [];
            
            for (const file of this.selectedFiles) {
                await this.addToImportLog(`Starting import of ${file.name} (${this.formatFileSize(file.size)})`, 'info');
                
                const fileProgressCallback = (progress) => {
                    const percent = Math.round(progress * 100);
                    this.updateProgress(percent);
                };
                
                try {
                    const result = await this.importService.importBook(file, {
                        progressCallback: fileProgressCallback
                    });
                    
                    results.push(result);
                    await this.addToImportLog(`✓ Successfully imported ${file.name}`, 'success');
                    
                } catch (importError) {
                    await this.addToImportLog(`✗ Failed to import ${file.name}: ${importError.message}`, 'error');
                    results.push({
                        success: false,
                        filename: file.name,
                        error: importError.message
                    });
                }
            }
            
            // Ensure progress bar reaches 100% when import is complete
            this.updateProgress(100);
            
            await this.showImportResults(results);
            
        } catch (error) {
            console.error('ImportView: Import failed:', error);
            await this.addToImportLog(`Import failed: ${error.message}`, 'error');
            this.showMessage('Import failed', 'error');
        }
    }

    /**
     * Setup progress tracking
     */
    setupProgressTracking() {
        // Progress tracking is handled in the import methods
    }

    /**
     * Show import progress
     */
    showImportProgress() {
        const importProgress = document.getElementById('importProgress');
        
        if (importProgress) {
            importProgress.style.display = 'flex';
        }
    }

    /**
     * Update progress bar
     */
    updateProgress(percentage) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }
    }

    /**
     * Add message to import log
     */
    async addToImportLog(message, type = 'info') {
        const logContainer = document.getElementById('importLog');
        if (!logContainer) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${message}</span>
        `;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    /**
     * Show import results as log entries
     */
    async showImportResults(results) {
        // Add a separator line
        await this.addToImportLog('─'.repeat(40), 'info');
        await this.addToImportLog('Import Results Summary:', 'info');
        
        // Add each result as a log entry
        for (const result of results) {
            const filename = result.filename || result.name || 'Unknown';
            const status = result.success ? 'Success' : 'Failed';
            const chunks = result.chunks ? ` (${result.chunks} chunks)` : '';
            const rules = result.rulesDiscovered ? `, ${result.rulesDiscovered} rules discovered` : '';
            const error = result.error ? ` - ${result.error}` : '';
            
            const message = `${filename}: ${status}${chunks}${rules}${error}`;
            const type = result.success ? 'success' : 'error';
            
            await this.addToImportLog(message, type);
            
            // Add rule discovery details if available
            if (result.rulesDiscovered !== undefined) {
                const ruleStatus = result.ruleDiscoverySuccess ? '✓' : '⚠️';
                const ruleMessage = `  ${ruleStatus} Rule Discovery: ${result.rulesDiscovered} rules (${result.ruleDiscoveryMessage})`;
                await this.addToImportLog(ruleMessage, result.ruleDiscoverySuccess ? 'success' : 'warning');
            }
        }
        
        // Add summary
        const successful = results.filter(r => r.success).length;
        const total = results.length;
        const totalRules = results.reduce((sum, r) => sum + (r.rulesDiscovered || 0), 0);
        await this.addToImportLog(`─`.repeat(40), 'info');
        await this.addToImportLog(`Import complete: ${successful}/${total} files imported successfully`, successful > 0 ? 'success' : 'error');
        if (totalRules > 0) {
            await this.addToImportLog(`Total rules discovered: ${totalRules}`, 'success');
        }
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Show message
     */
    showMessage(message, type = 'info') {
        // Simple message display - could be enhanced with a proper notification system
        console.log(`${type.toUpperCase()}: ${message}`);
    }

    /**
     * Load a template file
     * @param {string} templatePath - Path to the template file
     */
    async loadTemplateFile(templatePath) {
        try {
            const response = await fetch(templatePath);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`ImportView: Error loading template ${templatePath}:`, error);
            throw error;
        }
    }
}

/**
 * Dashboard View - Main entry point for Rulespedia system definition
 */
class DashboardView extends RuleView {
    constructor(serviceManager) {
        super('dashboard', 'Dashboard', 'fas fa-tachometer-alt');
        this.serviceManager = serviceManager;
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/dashboard-view.html');
    }

    /**
     * Called after the view is rendered
     */
    onRender() {
        this.initializeDashboard();
    }

    /**
     * Called when the view is activated
     */
    onActivate() {
        this.initializeDashboard();
    }

    /**
     * Initialize dashboard functionality
     */
    initializeDashboard() {
        this.setupNavigationButtons();
        this.updateSystemStats();
    }

    /**
     * Setup navigation buttons to other views
     */
    setupNavigationButtons() {
        // Manage Books button
        const manageBooksBtn = document.getElementById('manageBooksBtn');
        if (manageBooksBtn) {
            this.addTrackedEventListener(manageBooksBtn, 'click', () => {
                this.navigateToView('manage');
            });
        }

        // Create Rules button
        const createRulesBtn = document.getElementById('createRulesBtn');
        if (createRulesBtn) {
            this.addTrackedEventListener(createRulesBtn, 'click', () => {
                this.navigateToView('create-rules');
            });
        }
    }

    /**
     * Navigate to a specific view
     */
    navigateToView(viewName) {
        // Trigger view change through the main Rulespedia system
        if (window.rulespedia && window.rulespedia.switchToView) {
            window.rulespedia.switchToView(viewName);
        } else {
            console.warn('DashboardView: Unable to navigate - rulespedia system not available');
        }
    }

    /**
     * Update system statistics display
     */
    async updateSystemStats() {
        const statsContainer = document.getElementById('systemStats');
        if (!statsContainer) return;

        try {
            let stats = {
                booksImported: 0,
                totalChunks: 0,
                rulesDiscovered: 0,
                systemName: 'No System Defined'
            };

            // Get book management service for stats
            if (this.serviceManager) {
                const bookManagementService = this.serviceManager.getBookManagementService();
                if (bookManagementService) {
                    const bookStats = await bookManagementService.getBookStats();
                    stats.booksImported = bookStats.totalBooks || 0;
                    stats.totalChunks = bookStats.totalChunks || 0;
                }

                // Get rule discovery service for rule stats
                const ruleDiscoveryService = this.serviceManager.getRuleDiscoveryService();
                if (ruleDiscoveryService) {
                    const ruleStats = ruleDiscoveryService.getRuleStats();
                    stats.rulesDiscovered = ruleStats.totalRules || 0;
                }
            }

            // Update the stats display using template
            const statsHTML = await window.templateLoader.renderTemplate('systems/wodsystem/templates/rulespedia/dashboard-stats.html', {
                booksImported: stats.booksImported,
                totalChunks: stats.totalChunks,
                rulesDiscovered: stats.rulesDiscovered,
                systemRules: '-'
            });

            statsContainer.innerHTML = statsHTML;

        } catch (error) {
            console.error('DashboardView: Error updating stats:', error);
            statsContainer.innerHTML = '<div class="error">Unable to load system statistics</div>';
        }
    }
}

/**
 * Search View - Handles search UI
 */
class SearchView extends RuleView {
    constructor(serviceManager) {
        super('search', 'Search Rules', 'fas fa-search');
        this.serviceManager = serviceManager;
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/search-view.html');
    }

    /**
     * Called after the view is rendered
     */
    onRender() {
        // Initialize any view-specific logic here
    }

    /**
     * Called when the view is activated
     */
    onActivate() {
        // Initialize any activation logic here
    }
}

/**
 * Manage View - Handles book management UI
 */
class ManageView extends RuleView {
    constructor(serviceManager) {
        super('manage', 'Manage Books', 'fas fa-database');
        this.serviceManager = serviceManager;
        this.bookManagementService = serviceManager ? serviceManager.getBookManagementService() : null;
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/manage-view.html');
    }

    /**
     * Called after the view is rendered
     */
    onRender() {
        this.initialize();
    }

    /**
     * Called when the view is activated
     */
    onActivate() {
        // Initialize event handlers when view becomes active
        this.initialize();
    }

    /**
     * Initialize event handlers
     */
    initialize() {
        // Additional initialization logic if needed
    }
}

/**
 * Settings View - Handles settings UI
 */
class SettingsView extends RuleView {
    constructor() {
        super('settings', 'Settings', 'fas fa-cog');
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/settings-view.html');
    }

    /**
     * Called after the view is rendered
     */
    onRender() {
        // Initialize any view-specific logic here
    }

    /**
     * Called when the view is activated
     */
    onActivate() {
        // Initialize any activation logic here
    }
}

/**
 * Create Rules View - Visual rule definition interface
 */
class CreateRulesView extends RuleView {
    constructor(serviceManager) {
        super('create-rules', 'Create Rules', 'fas fa-magic');
        this.serviceManager = serviceManager;
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/create-rules-view.html');
        
        // Rule definition state
        this.currentRule = {
            name: '',
            type: 'general',
            description: '',
            components: [],
            source: 'manual' // 'manual' or 'extracted'
        };
        
        this.ruleComponents = [];
        this.extractedRules = [];
    }

    /**
     * Called after the view is rendered
     */
    onRender() {
        this.initializeRuleBuilder();
    }

    /**
     * Called when the view is activated
     */
    onActivate() {
        this.initializeRuleBuilder();
    }

    /**
     * Initialize the rule builder interface
     */
    initializeRuleBuilder() {
        this.setupRuleForm();
        this.setupComponentBuilder();
        this.setupExtractionOptions();
        this.loadExtractedRules();
    }

    /**
     * Setup the main rule form
     */
    setupRuleForm() {
        // Rule name input
        const ruleNameInput = document.getElementById('ruleName');
        if (ruleNameInput) {
            this.addTrackedEventListener(ruleNameInput, 'input', (e) => {
                this.currentRule.name = e.target.value;
                this.updateRulePreview();
            });
        }

        // Rule type selector
        const ruleTypeSelect = document.getElementById('ruleType');
        if (ruleTypeSelect) {
            this.addTrackedEventListener(ruleTypeSelect, 'change', (e) => {
                this.currentRule.type = e.target.value;
                this.updateRulePreview();
            });
        }

        // Rule description textarea
        const ruleDescriptionTextarea = document.getElementById('ruleDescription');
        if (ruleDescriptionTextarea) {
            this.addTrackedEventListener(ruleDescriptionTextarea, 'input', (e) => {
                this.currentRule.description = e.target.value;
                this.updateRulePreview();
            });
        }

        // Save rule button
        const saveRuleBtn = document.getElementById('saveRuleBtn');
        if (saveRuleBtn) {
            this.addTrackedEventListener(saveRuleBtn, 'click', () => {
                this.saveRule();
            });
        }

        // Clear rule button
        const clearRuleBtn = document.getElementById('clearRuleBtn');
        if (clearRuleBtn) {
            this.addTrackedEventListener(clearRuleBtn, 'click', async () => {
                await this.clearRule();
            });
        }
    }

    /**
     * Setup the component builder interface
     */
    setupComponentBuilder() {
        // Add component buttons
        const addInputBtn = document.getElementById('addInputBtn');
        if (addInputBtn) {
            this.addTrackedEventListener(addInputBtn, 'click', async () => {
                await this.addComponent('input');
            });
        }

        const addRollBtn = document.getElementById('addRollBtn');
        if (addRollBtn) {
            this.addTrackedEventListener(addRollBtn, 'click', async () => {
                await this.addComponent('roll');
            });
        }

        const addConditionBtn = document.getElementById('addConditionBtn');
        if (addConditionBtn) {
            this.addTrackedEventListener(addConditionBtn, 'click', async () => {
                await this.addComponent('condition');
            });
        }

        const addOutputBtn = document.getElementById('addOutputBtn');
        if (addOutputBtn) {
            this.addTrackedEventListener(addOutputBtn, 'click', async () => {
                await this.addComponent('output');
            });
        }
    }

    /**
     * Setup extraction options
     */
    setupExtractionOptions() {
        // Auto-extract button
        const autoExtractBtn = document.getElementById('autoExtractBtn');
        if (autoExtractBtn) {
            this.addTrackedEventListener(autoExtractBtn, 'click', () => {
                this.autoExtractRules();
            });
        }

        // Manual extract button
        const manualExtractBtn = document.getElementById('manualExtractBtn');
        if (manualExtractBtn) {
            this.addTrackedEventListener(manualExtractBtn, 'click', () => {
                this.manualExtractRules();
            });
        }
    }

    /**
     * Add a component to the current rule
     */
    async addComponent(componentType) {
        const component = {
            id: Date.now() + Math.random(),
            type: componentType,
            config: this.getDefaultConfig(componentType)
        };

        this.currentRule.components.push(component);
        await this.renderComponent(component);
        await this.updateRulePreview();
    }

    /**
     * Get default configuration for a component type
     */
    getDefaultConfig(componentType) {
        switch (componentType) {
            case 'input':
                return {
                    name: '',
                    type: 'text',
                    required: true,
                    defaultValue: '',
                    validation: ''
                };
            case 'roll':
                return {
                    dice: 'd20',
                    modifier: 0,
                    target: 'variable',
                    targetValue: '',
                    successType: 'above'
                };
            case 'condition':
                return {
                    operator: 'equals',
                    leftOperand: '',
                    rightOperand: '',
                    action: 'continue'
                };
            case 'output':
                return {
                    type: 'text',
                    content: '',
                    target: 'result'
                };
            default:
                return {};
        }
    }

    /**
     * Render a component in the components list
     */
    async renderComponent(component) {
        const componentsContainer = document.getElementById('ruleComponents');
        if (!componentsContainer) return;

        try {
            // Load component wrapper template
            const componentWrapperTemplate = await window.templateLoader.loadTemplate('systems/wodsystem/templates/rulespedia/rule-component.html');
            
            // Get component configuration HTML
            const componentConfigHTML = await this.getComponentConfigHTML(component);
            
            // Render the component wrapper
            const componentHTML = window.templateLoader.renderString(componentWrapperTemplate, {
                componentTypeLabel: this.getComponentTypeLabel(component.type),
                componentId: component.id,
                componentConfigHTML: componentConfigHTML
            });

            const componentElement = document.createElement('div');
            componentElement.className = 'rule-component';
            componentElement.id = `component-${component.id}`;
            componentElement.innerHTML = componentHTML;

            componentsContainer.appendChild(componentElement);
        } catch (error) {
            console.error('CreateRulesView: Error rendering component:', error);
            // Fallback to simple component
            const fallbackElement = document.createElement('div');
            fallbackElement.className = 'rule-component';
            fallbackElement.id = `component-${component.id}`;
            fallbackElement.innerHTML = `
                <div class="component-header">
                    <span class="component-type">${this.getComponentTypeLabel(component.type)}</span>
                    <button class="remove-component" onclick="this.removeComponent('${component.id}')">×</button>
                </div>
                <div class="component-config">
                    <p>Error loading component configuration</p>
                </div>
            `;
            componentsContainer.appendChild(fallbackElement);
        }
    }

    /**
     * Get component type label
     */
    getComponentTypeLabel(type) {
        const labels = {
            'input': '📥 Input',
            'roll': '🎲 Roll',
            'condition': '🔀 Condition',
            'output': '📤 Output'
        };
        return labels[type] || type;
    }

    /**
     * Get component configuration HTML
     */
    async getComponentConfigHTML(component) {
        try {
            switch (component.type) {
                case 'input':
                    return await window.templateLoader.renderTemplate('systems/wodsystem/templates/rulespedia/component-input.html', {
                        componentId: component.id,
                        name: component.config.name || '',
                        textSelected: component.config.type === 'text',
                        numberSelected: component.config.type === 'number',
                        selectSelected: component.config.type === 'select'
                    });
                    
                case 'roll':
                    return await window.templateLoader.renderTemplate('systems/wodsystem/templates/rulespedia/component-roll.html', {
                        componentId: component.id,
                        dice: component.config.dice || '',
                        modifier: component.config.modifier || 0
                    });
                    
                case 'condition':
                    return await window.templateLoader.renderTemplate('systems/wodsystem/templates/rulespedia/component-condition.html', {
                        componentId: component.id,
                        equalsSelected: component.config.operator === 'equals',
                        greaterSelected: component.config.operator === 'greater',
                        lessSelected: component.config.operator === 'less',
                        leftOperand: component.config.leftOperand || '',
                        rightOperand: component.config.rightOperand || ''
                    });
                    
                case 'output':
                    return await window.templateLoader.renderTemplate('systems/wodsystem/templates/rulespedia/component-output.html', {
                        componentId: component.id,
                        textSelected: component.config.type === 'text',
                        numberSelected: component.config.type === 'number',
                        booleanSelected: component.config.type === 'boolean',
                        content: component.config.content || ''
                    });
                    
                default:
                    return '<p>Unknown component type</p>';
            }
        } catch (error) {
            console.error('CreateRulesView: Error loading component config template:', error);
            return '<p>Error loading component configuration</p>';
        }
    }

    /**
     * Update component configuration
     */
    async updateComponentConfig(componentId, key, value) {
        const component = this.currentRule.components.find(c => c.id === componentId);
        if (component) {
            component.config[key] = value;
            await this.updateRulePreview();
        }
    }

    /**
     * Remove a component
     */
    async removeComponent(componentId) {
        this.currentRule.components = this.currentRule.components.filter(c => c.id !== componentId);
        const componentElement = document.getElementById(`component-${componentId}`);
        if (componentElement) {
            componentElement.remove();
        }
        await this.updateRulePreview();
    }

    /**
     * Update the rule preview
     */
    async updateRulePreview() {
        const previewContainer = document.getElementById('rulePreview');
        if (!previewContainer) return;

        try {
            const jsonOutput = JSON.stringify(this.currentRule, null, 2);
            
            const previewHTML = await window.templateLoader.renderTemplate('systems/wodsystem/templates/rulespedia/rule-preview.html', {
                jsonOutput: jsonOutput
            });
            
            previewContainer.innerHTML = previewHTML;
        } catch (error) {
            console.error('CreateRulesView: Error updating rule preview:', error);
            // Fallback to simple preview
            const jsonOutput = JSON.stringify(this.currentRule, null, 2);
            previewContainer.innerHTML = `
                <div class="preview-header">
                    <h4>Rule JSON Preview</h4>
                </div>
                <pre><code>${jsonOutput}</code></pre>
            `;
        }
    }

    /**
     * Save the current rule
     */
    async saveRule() {
        if (!this.currentRule.name.trim()) {
            this.showMessage('Please enter a rule name', 'error');
            return;
        }

        if (this.currentRule.components.length === 0) {
            this.showMessage('Please add at least one component', 'error');
            return;
        }

        try {
            // Here you would save the rule to your system
            // For now, we'll just show a success message
            this.showMessage(`Rule "${this.currentRule.name}" saved successfully!`, 'success');
            
            // Clear the form for the next rule
            await this.clearRule();
            
        } catch (error) {
            console.error('Error saving rule:', error);
            this.showMessage('Error saving rule: ' + error.message, 'error');
        }
    }

    /**
     * Clear the current rule
     */
    async clearRule() {
        this.currentRule = {
            name: '',
            type: 'general',
            description: '',
            components: [],
            source: 'manual'
        };

        // Clear form fields
        const ruleNameInput = document.getElementById('ruleName');
        if (ruleNameInput) ruleNameInput.value = '';

        const ruleTypeSelect = document.getElementById('ruleType');
        if (ruleTypeSelect) ruleTypeSelect.value = 'general';

        const ruleDescriptionTextarea = document.getElementById('ruleDescription');
        if (ruleDescriptionTextarea) ruleDescriptionTextarea.value = '';

        // Clear components
        const componentsContainer = document.getElementById('ruleComponents');
        if (componentsContainer) componentsContainer.innerHTML = '';

        await this.updateRulePreview();
    }

    /**
     * Load extracted rules from imported books
     */
    async loadExtractedRules() {
        const extractedRulesContainer = document.getElementById('extractedRules');
        if (!extractedRulesContainer) return;

        try {
            if (this.serviceManager) {
                const ruleDiscoveryService = this.serviceManager.getRuleDiscoveryService();
                if (ruleDiscoveryService) {
                    const ruleChunks = ruleDiscoveryService.getRuleChunks();
                    
                    if (ruleChunks.length === 0) {
                        extractedRulesContainer.innerHTML = '<p class="no-rules">No rules extracted yet. Import some books first!</p>';
                        return;
                    }

                    const rulesHTML = await Promise.all(ruleChunks.map(async (rule, index) => {
                        try {
                            const ruleItemHTML = await window.templateLoader.renderTemplate('systems/wodsystem/templates/rulespedia/extracted-rule-item.html', {
                                ruleName: rule.ruleName || `Rule ${index + 1}`,
                                confidencePercent: Math.round(rule.confidence * 100),
                                ruleType: rule.ruleType || 'general',
                                rulePreview: rule.chunk.substring(0, 100) + '...'
                            });
                            
                            return `<div class="extracted-rule" onclick="this.selectExtractedRule(${index})">${ruleItemHTML}</div>`;
                        } catch (error) {
                            console.error('CreateRulesView: Error rendering extracted rule item:', error);
                            // Fallback to simple rule item
                            return `
                                <div class="extracted-rule" onclick="this.selectExtractedRule(${index})">
                                    <div class="rule-header">
                                        <span class="rule-name">${rule.ruleName || `Rule ${index + 1}`}</span>
                                        <span class="rule-confidence">${Math.round(rule.confidence * 100)}%</span>
                                    </div>
                                    <div class="rule-type">${rule.ruleType || 'general'}</div>
                                    <div class="rule-preview">${rule.chunk.substring(0, 100)}...</div>
                                </div>
                            `;
                        }
                    }));

                    extractedRulesContainer.innerHTML = rulesHTML.join('');
                }
            }
        } catch (error) {
            console.error('Error loading extracted rules:', error);
            extractedRulesContainer.innerHTML = '<p class="error">Error loading extracted rules</p>';
        }
    }

    /**
     * Select an extracted rule for use
     */
    async selectExtractedRule(index) {
        if (this.serviceManager) {
            const ruleDiscoveryService = this.serviceManager.getRuleDiscoveryService();
            if (ruleDiscoveryService) {
                const ruleChunks = ruleDiscoveryService.getRuleChunks();
                const selectedRule = ruleChunks[index];
                
                if (selectedRule) {
                    // Populate the form with extracted rule data
                    this.currentRule.name = selectedRule.ruleName || `Extracted Rule ${index + 1}`;
                    this.currentRule.type = selectedRule.ruleType || 'general';
                    this.currentRule.description = selectedRule.chunk;
                    this.currentRule.source = 'extracted';
                    
                    // Update form fields
                    const ruleNameInput = document.getElementById('ruleName');
                    if (ruleNameInput) ruleNameInput.value = this.currentRule.name;

                    const ruleTypeSelect = document.getElementById('ruleType');
                    if (ruleTypeSelect) ruleTypeSelect.value = this.currentRule.type;

                    const ruleDescriptionTextarea = document.getElementById('ruleDescription');
                    if (ruleDescriptionTextarea) ruleDescriptionTextarea.value = this.currentRule.description;

                    await this.updateRulePreview();
                    this.showMessage(`Selected extracted rule: ${this.currentRule.name}`, 'info');
                }
            }
        }
    }

    /**
     * Auto-extract rules from imported books
     */
    async autoExtractRules() {
        this.showMessage('Auto-extraction feature coming soon!', 'info');
        // This would use LLM to automatically generate rule components from extracted content
    }

    /**
     * Manual extract rules with user guidance
     */
    async manualExtractRules() {
        this.showMessage('Manual extraction feature coming soon!', 'info');
        // This would provide a guided interface for extracting rules from specific content
    }
}

// Export for use in other modules
window.DashboardView = DashboardView;
window.CreateRulesView = CreateRulesView;
window.ImportView = ImportView;
window.SearchView = SearchView;
window.ManageView = ManageView;
window.SettingsView = SettingsView;