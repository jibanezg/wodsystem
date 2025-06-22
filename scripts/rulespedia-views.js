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
            
            // Try to run rule discovery if LLM is available
            try {
                const llmInitialized = await this.initializeLLMService();
                if (llmInitialized) {
                    await this.addToImportLog('Running rule discovery analysis...', 'info');
                    await this.runRuleDiscovery();
                }
            } catch (ruleError) {
                await this.addToImportLog(`Rule discovery failed: ${ruleError.message}`, 'warning');
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
     * Initialize LLM service for rule discovery
     */
    async initializeLLMService() {
        if (!this.serviceManager) {
            console.warn('ImportView: No service manager available - LLM features will be disabled');
            return false;
        }
        
        try {
            // Get LLM service (this will trigger lazy initialization)
            const llmService = this.serviceManager.getLLMService();
            
            // Check if TensorFlowLLMProvider is available
            if (typeof TensorFlowLLMProvider === 'undefined') {
                console.warn('ImportView: TensorFlowLLMProvider not available - using fallback mode');
                return false;
            }
            
            // Create TensorFlow LLM provider
            const tensorflowProvider = new TensorFlowLLMProvider({
                modelName: 'pattern-recognition',
                useQuantized: true,
                progressCallback: (progress) => {
                    const percent = Math.round(progress * 100);
                    this.addToImportLog(`Loading TensorFlow model: ${percent}%`, 'info');
                }
            });
            
            // Set the provider
            llmService.setProvider(tensorflowProvider);
            
            // Initialize the service and wait for it to be ready
            await llmService.initialize();
            
            return true;
        } catch (error) {
            console.warn('ImportView: LLM service initialization failed:', error);
            return false;
        }
    }

    /**
     * Run rule discovery on imported content
     */
    async runRuleDiscovery() {
        try {
            // Get rule discovery service (this will trigger lazy initialization)
            const ruleDiscoveryService = this.serviceManager.getRuleDiscoveryService();
            
            // Update progress to show rule discovery is starting
            this.updateProgress(90);
            this.addToImportLog('Starting AI rule discovery...', 'info');
            
            // Run discovery on all imported books with progress updates
            const discoveryResults = await ruleDiscoveryService.analyzeRuleChunks();
            
            // Update progress to show rule discovery is complete
            this.updateProgress(95);
            
            // Get the actual rule chunks array
            const ruleChunks = ruleDiscoveryService.getRuleChunks();
            
            this.addToImportLog(`✓ Rule discovery complete: ${discoveryResults.ruleChunks} rules found`, 'success');
            
        } catch (error) {
            console.error('Rule discovery failed:', error);
            this.addToImportLog(`✗ Rule discovery failed: ${error.message}`, 'error');
            // Don't throw - rule discovery failure shouldn't stop the import
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
            const error = result.error ? ` - ${result.error}` : '';
            
            const message = `${filename}: ${status}${chunks}${error}`;
            const type = result.success ? 'success' : 'error';
            
            await this.addToImportLog(message, type);
        }
        
        // Add summary
        const successful = results.filter(r => r.success).length;
        const total = results.length;
        await this.addToImportLog(`─`.repeat(40), 'info');
        await this.addToImportLog(`Import complete: ${successful}/${total} files imported successfully`, successful > 0 ? 'success' : 'error');
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
     * Test function to manually show selected files (for debugging)
     */
    testShowSelectedFiles() {
        const selectedFiles = document.getElementById('selectedFiles');
        if (!selectedFiles) {
            console.error('ImportView: selectedFiles element not found');
            return;
        }
        
        // Use template for test content
        try {
            const testFile = {
                name: 'TEST FILE.pdf',
                size: 1258291 // 1.2 MB in bytes
            };
            
            this.loadTemplateFile('systems/wodsystem/templates/rulespedia/file-item.html')
                .then(template => {
                    const testHtml = template
                        .replace('{{fileName}}', testFile.name)
                        .replace('{{fileSize}}', this.formatFileSize(testFile.size));
                    
                    selectedFiles.innerHTML = testHtml;
                })
                .catch(error => {
                    console.error('ImportView: Error loading template for test:', error);
                    // Fallback to simple template
                    this.loadTemplateFile('systems/wodsystem/templates/rulespedia/file-item-simple.html')
                        .then(simpleTemplate => {
                            const testHtml = simpleTemplate
                                .replace('{{fileName}}', testFile.name)
                                .replace('{{fileSize}}', this.formatFileSize(testFile.size));
                            selectedFiles.innerHTML = testHtml;
                        })
                        .catch(fallbackError => {
                            console.error('ImportView: Error loading fallback template:', fallbackError);
                            // Ultimate fallback - just text
                            selectedFiles.innerHTML = `${testFile.name} (${this.formatFileSize(testFile.size)})`;
                        });
                });
        } catch (error) {
            console.error('ImportView: Error in test function:', error);
        }
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
 * Home View - Handles home page UI
 */
class HomeView extends RuleView {
    constructor() {
        super('home', 'Home', 'fas fa-home');
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/home-view.html');
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

// Export for use in other modules
window.HomeView = HomeView;
window.ImportView = ImportView;
window.SearchView = SearchView;
window.ManageView = ManageView;
window.SettingsView = SettingsView;

// Make test function available globally for debugging
window.testShowSelectedFiles = function() {
    // Find the current import view instance
    const importView = window.rulespediaImportView;
    if (importView && importView.testShowSelectedFiles) {
        importView.testShowSelectedFiles();
    } else {
        console.error('ImportView instance not found or test function not available');
    }
};