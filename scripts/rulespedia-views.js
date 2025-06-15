/**
 * Rulespedia Views - UI Framework Components
 * Handles rendering and user interactions for the Rulespedia system
 * Framework layer - no business logic here, no HTML templates here
 */

/**
 * Import View - Handles book import UI
 */
class ImportView extends RuleView {
    constructor(serviceManager) {
        super('import', 'Import Books', 'fas fa-upload');
        this.serviceManager = serviceManager;
        this.importService = serviceManager ? serviceManager.getImportService() : null;
        this.bookManagementService = serviceManager ? serviceManager.getBookManagementService() : null;
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
        console.log('ImportView: Setting up file upload functionality');
        
        // Wait a bit more for DOM to be fully ready
        setTimeout(() => {
            const fileInput = document.getElementById('fileInput');
            const uploadArea = document.getElementById('fileUploadArea');
            const selectBtn = document.querySelector('.select-files-btn');
            const selectedFiles = document.getElementById('selectedFiles');
            const selectedFilesSection = document.getElementById('selectedFilesSection');
            const startImportBtn = document.getElementById('startImport');

            console.log('ImportView: Found elements:', {
                fileInput: !!fileInput,
                uploadArea: !!uploadArea,
                selectBtn: !!selectBtn,
                selectedFiles: !!selectedFiles,
                selectedFilesSection: !!selectedFilesSection,
                startImportBtn: !!startImportBtn
            });

            if (!fileInput || !uploadArea || !selectBtn) {
                console.error('ImportView: Required elements not found for file upload setup', {
                    fileInput: !!fileInput,
                    uploadArea: !!uploadArea,
                    selectBtn: !!selectBtn
                });
                return;
            }

            // File selection button
            this.addTrackedEventListener(selectBtn, 'click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('ImportView: Select files button clicked');
                
                // Use Foundry's FilePicker
                const fp = new FilePicker({
                    type: "file",
                    current: "",
                    callback: (path) => {
                        console.log('ImportView: FilePicker callback with path:', path);
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
                console.log('ImportView: Upload area clicked');
                
                // Use Foundry's FilePicker
                const fp = new FilePicker({
                    type: "file",
                    current: "",
                    callback: (path) => {
                        console.log('ImportView: Upload area FilePicker callback with path:', path);
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
                console.log('ImportView: File input changed, files:', e.target.files);
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
                console.log('ImportView: Files dropped:', e.dataTransfer.files);
                this.handleFileSelection(e.dataTransfer.files);
            });
            
            console.log('ImportView: File upload setup complete');
        }, 100);
    }

    /**
     * Handle file selection from Foundry's FilePicker path
     */
    async handleFileSelectionFromPath(path) {
        console.log('ImportView: Handling file selection from path:', path);
        
        try {
            // Get the file from the path using Foundry's API
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status}`);
            }
            
            const blob = await response.blob();
            const file = new File([blob], path.split('/').pop(), { type: 'application/pdf' });
            
            console.log('ImportView: Created file from path:', file);
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
        
        console.log('ImportView: File selection triggered', { 
            totalFiles: files.length,
            selectedFilesElement: !!selectedFiles,
            selectedFilesSection: !!selectedFilesSection,
            startImportBtn: !!startImportBtn
        });
        
        // DEBUG: Check if elements exist
        if (!selectedFiles) {
            console.error('ImportView: selectedFiles element not found!');
            console.log('All elements with "selected" in id:', document.querySelectorAll('[id*="selected"]'));
            console.log('All elements with "file" in id:', document.querySelectorAll('[id*="file"]'));
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
        
        console.log('ImportView: PDF files filtered', { 
            pdfFilesCount: pdfFiles.length,
            pdfFiles: pdfFiles.map(f => ({ name: f.name, size: f.size }))
        });

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
            
            console.log('ImportView: Generated file items HTML', { 
                htmlLength: fileItemsHtml.length,
                fileItemsCount: pdfFiles.length
            });
            
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
     * Setup import button
     */
    setupImportButton() {
        // Wait a bit more for DOM to be fully ready
        setTimeout(() => {
            const startImportBtn = document.getElementById('startImport');
            
            if (!startImportBtn) {
                console.error('ImportView: Start import button not found');
                return;
            }
            
            this.addTrackedEventListener(startImportBtn, 'click', async () => {
                if (!this.selectedFiles || this.selectedFiles.length === 0) {
                    this.showMessage('Please select files to import.', 'error');
                    return;
                }

                await this.startImport();
            });
        }, 50);
    }

    /**
     * Start the import process
     */
    async startImport() {
        if (!this.importService) {
            this.showMessage('Import service not available. Please refresh the page.', 'error');
            return;
        }

        try {
            this.showImportProgress();
            this.clearImportLog();
            
            // Initialize progress tracking
            let currentProgress = 0;
            const totalSteps = this.selectedFiles.length + 2; // +2 for LLM init and rule discovery
            let currentStep = 0;
            
            // Step 1: Try to initialize LLM Service (optional)
            this.addToImportLog('Checking LLM service availability...', 'info');
            this.updateProgress(5); // 5% for starting
            let llmAvailable = false;
            try {
                await this.initializeLLMService();
                llmAvailable = true;
                this.addToImportLog('✓ LLM service ready', 'success');
            } catch (error) {
                console.warn('LLM service not available, proceeding without AI features:', error.message);
                this.addToImportLog('⚠ LLM service not available - proceeding with basic import (no AI rule discovery)', 'warning');
            }
            
            currentStep++;
            currentProgress = (currentStep / totalSteps) * 90; // Reserve 10% for rule discovery
            this.updateProgress(currentProgress);
            
            const results = [];
            
            // Step 2: Import books
            for (let i = 0; i < this.selectedFiles.length; i++) {
                const file = this.selectedFiles[i];
                
                // Update progress for starting this file
                const fileStartProgress = currentProgress + (i / this.selectedFiles.length) * 70; // 70% for file imports
                this.updateProgress(fileStartProgress);
                this.addToImportLog(`Importing ${file.name}...`);
                
                try {
                    // Create a progress callback for this file
                    const fileProgressCallback = (progress) => {
                        // Map file progress from 0-100% to the file's allocated range
                        const fileProgress = fileStartProgress + (progress * 70 / this.selectedFiles.length);
                        this.updateProgress(fileProgress);
                    };
                    
                    const result = await this.importService.importBook(file, { progressCallback: fileProgressCallback });
                    results.push(result);
                    this.addToImportLog(`✓ Successfully imported ${file.name} (${result.chunks} chunks)`);
                } catch (error) {
                    console.error(`Import failed for ${file.name}:`, error);
                    this.addToImportLog(`✗ Failed to import ${file.name}: ${error.message}`, 'error');
                    results.push({
                        success: false,
                        filename: file.name,
                        error: error.message
                    });
                }
            }
            
            // Step 3: Run rule discovery if we have successful imports and LLM is available
            const successfulImports = results.filter(r => r.success);
            if (successfulImports.length > 0 && llmAvailable) {
                this.updateProgress(90); // 90% for starting rule discovery
                this.addToImportLog('Starting AI rule discovery...', 'info');
                await this.runRuleDiscovery();
            } else if (successfulImports.length > 0) {
                this.addToImportLog('✓ Import complete - books are ready for manual search', 'success');
            }
            
            this.updateProgress(100);
            await this.showImportResults(results);
            
        } catch (error) {
            console.error('Import process failed:', error);
            this.addToImportLog(`Import process failed: ${error.message}`, 'error');
        }
    }

    /**
     * Initialize LLM Service with TensorFlow provider
     */
    async initializeLLMService() {
        try {
            if (!this.serviceManager) {
                throw new Error('Service manager not available');
            }

            // Get LLM service (this will trigger lazy initialization)
            const llmService = this.serviceManager.getLLMService();
            
            // Check if TensorFlowLLMProvider is available
            if (typeof TensorFlowLLMProvider === 'undefined') {
                throw new Error('TensorFlowLLMProvider not available - tensorflow-llm-provider.js may not be loaded');
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
            
            // Double-check that the service is actually initialized
            if (!llmService.isInitialized) {
                throw new Error('LLM service failed to initialize properly');
            }
            
            // Check if service is in fallback mode
            if (llmService.fallbackMode) {
                this.addToImportLog('✓ LLM service initialized in fallback mode (keyword-based analysis)', 'warning');
            } else {
                this.addToImportLog('✓ LLM service initialized successfully with TensorFlow pattern recognition', 'success');
            }
            
            // Test the service to make sure it's working
            try {
                const testResponse = await llmService.generate('test', { maxTokens: 10 });
                if (!testResponse) {
                    throw new Error('LLM service test failed - no response generated');
                }
                this.addToImportLog('✓ LLM service test successful', 'success');
            } catch (testError) {
                console.warn('LLM service test failed:', testError.message);
                this.addToImportLog('⚠ LLM service test failed, but continuing with import', 'warning');
            }
            
        } catch (error) {
            console.error('Failed to initialize LLM service:', error);
            this.addToImportLog(`✗ LLM service initialization failed: ${error.message}`, 'error');
            throw error;
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
            const discoveryResults = await ruleDiscoveryService.discoverRules();
            
            // Update progress to show rule discovery is complete
            this.updateProgress(95);
            
            // Get the actual rule chunks array
            const ruleChunks = ruleDiscoveryService.getRuleChunks();
            
            this.addToImportLog(`✓ Rule discovery complete: ${discoveryResults.ruleChunks} rules found`, 'success');
            
            // Log some discovered rules for user feedback
            const topRules = ruleChunks.slice(0, 5);
            if (topRules.length > 0) {
                this.addToImportLog('Top discovered rules:', 'info');
                topRules.forEach((rule, index) => {
                    this.addToImportLog(`  ${index + 1}. ${rule.ruleName} (confidence: ${Math.round(rule.confidence * 100)}%)`, 'info');
                });
            }
            
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
        const importLog = document.getElementById('importLog');
        if (!importLog) return;

        try {
            // Simple fallback using template
            try {
                const logTemplate = await this.loadTemplateFile('systems/wodsystem/templates/rulespedia/log-entry.html');
                const timestamp = new Date().toLocaleTimeString();
                const logEntry = logTemplate
                    .replace('{{type}}', type)
                    .replace('{{timestamp}}', timestamp)
                    .replace('{{message}}', message);
                importLog.insertAdjacentHTML('beforeend', logEntry);
                importLog.scrollTop = importLog.scrollHeight;
            } catch (fallbackError) {
                console.error('Error loading log template:', fallbackError);
                // Ultimate fallback - just text
                const timestamp = new Date().toLocaleTimeString();
                importLog.insertAdjacentHTML('beforeend', `[${timestamp}] ${message}\n`);
                importLog.scrollTop = importLog.scrollHeight;
            }
        } catch (error) {
            console.error('Error adding to import log:', error);
            // Simple fallback using template
            try {
                const logTemplate = await this.loadTemplateFile('systems/wodsystem/templates/rulespedia/log-entry.html');
                const timestamp = new Date().toLocaleTimeString();
                const logEntry = logTemplate
                    .replace('{{type}}', type)
                    .replace('{{timestamp}}', timestamp)
                    .replace('{{message}}', message);
                importLog.insertAdjacentHTML('beforeend', logEntry);
                importLog.scrollTop = importLog.scrollHeight;
            } catch (fallbackError) {
                console.error('Error loading log template:', fallbackError);
                // Ultimate fallback - just text
                const timestamp = new Date().toLocaleTimeString();
                importLog.insertAdjacentHTML('beforeend', `[${timestamp}] ${message}\n`);
                importLog.scrollTop = importLog.scrollHeight;
            }
        }
    }

    /**
     * Clear import log
     */
    clearImportLog() {
        const importLog = document.getElementById('importLog');
        if (importLog) {
            importLog.innerHTML = '';
        }
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
        
        console.log('ImportView: Testing manual display of selected files');
        
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
                    console.log('ImportView: Test content added using template');
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

// Export for use in other modules
window.ImportView = ImportView;
window.SearchView = SearchView;
window.ManageView = ManageView;

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