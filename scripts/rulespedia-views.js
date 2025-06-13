/**
 * Rulespedia Views
 * Specific view implementations for the Rulespedia system
 */

/**
 * Home View - Main landing page
 */
class HomeView extends RuleView {
    constructor() {
        super('home', 'Home', 'fas fa-home');
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/rulespedia-home.html');
    }

    onRender() {
        this.initializeSearch();
    }

    initializeSearch() {
        const searchInput = document.getElementById('semantic-search');
        const sendButton = document.getElementById('send-button');
        
        if (searchInput && sendButton) {
            // Auto-resize textarea
            const autoResize = () => {
                searchInput.style.height = 'auto';
                searchInput.style.height = Math.min(searchInput.scrollHeight, 6 * 16) + 'px';
            };
            
            searchInput.addEventListener('input', autoResize);
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.performSearch();
                }
            });
            
            sendButton.addEventListener('click', () => {
                this.performSearch();
            });
            
            autoResize();
        }
    }

    async performSearch() {
        const searchInput = document.getElementById('semantic-search');
        const query = searchInput.value.trim();
        
        if (!query) {
            ui.notifications.warn('Please enter a search query.');
            return;
        }
        
        await this.showTemplate('search-loading.html');
        
        try {
            // Get the framework instance and perform real search
            const framework = window.rulespediaFramework;
            if (!framework) {
                throw new Error('Rulespedia framework not available');
            }
            
            const result = await framework.performSemanticSearch(query);
            await this.displaySearchResult(result);
        } catch (error) {
            console.error('Search error:', error);
            await this.showTemplate('search-error.html', { message: 'Search failed: ' + error.message });
        }
    }

    async showTemplate(templateFile, context = {}) {
        const ruleContent = document.getElementById('ruleContent');
        if (!ruleContent) return;
        const path = `systems/wodsystem/templates/rulespedia/${templateFile}`;
        const response = await fetch(path);
        let html = await response.text();
        // Simple variable replacement for {{var}}
        for (const [key, value] of Object.entries(context)) {
            html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        ruleContent.innerHTML = html;
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
}

/**
 * Import View - For importing new rulebooks
 */
class ImportView extends RuleView {
    constructor() {
        super('import', 'Import Books', 'fas fa-upload');
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/rulespedia-import.html');
        this.selectedFiles = [];
    }

    onRender() {
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
            console.log('ImportView: Initializing upload...');
            this.initializeUpload();
        }, 100);
    }

    initializeUpload() {
        if (!this.container) {
            console.error('ImportView: No container available!');
            return;
        }
        
        const uploadArea = this.container.querySelector('#uploadArea');
        const importButton = this.container.querySelector('#importButton');
        const clearSelectionButton = this.container.querySelector('#clearSelection');
        
        console.log('ImportView: Found elements:', { uploadArea: !!uploadArea, importButton: !!importButton, clearSelectionButton: !!clearSelectionButton });
        
        if (uploadArea) {
            // Remove any existing event listeners to prevent duplication
            uploadArea.removeEventListener('dragover', this.handleDragOver);
            uploadArea.removeEventListener('dragleave', this.handleDragLeave);
            uploadArea.removeEventListener('drop', this.handleDrop);
            uploadArea.removeEventListener('click', this.handleUploadClick);
            
            // Bind event handlers to prevent context issues
            this.handleDragOver = (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.add('dragover');
            };
            
            this.handleDragLeave = (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('dragover');
            };
            
            this.handleDrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadArea.classList.remove('dragover');
                this.handleFiles(e.dataTransfer.files);
            };
            
            this.handleUploadClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('ImportView: Upload area clicked, opening file picker...');
                this.openFilePicker();
            };
            
            // Add event listeners
            uploadArea.addEventListener('dragover', this.handleDragOver);
            uploadArea.addEventListener('dragleave', this.handleDragLeave);
            uploadArea.addEventListener('drop', this.handleDrop);
            uploadArea.addEventListener('click', this.handleUploadClick);
            
            // Handle import button
            if (importButton) {
                importButton.removeEventListener('click', this.handleImportClick);
                this.handleImportClick = this.handleImportClick.bind(this);
                importButton.addEventListener('click', this.handleImportClick);
            }
            
            // Handle clear selection button
            if (clearSelectionButton) {
                clearSelectionButton.removeEventListener('click', this.handleClearSelection);
                this.handleClearSelection = this.handleClearSelection.bind(this);
                clearSelectionButton.addEventListener('click', this.handleClearSelection);
            }
            
            console.log('ImportView: Upload initialization complete');
        } else {
            console.error('ImportView: Upload area not found!');
        }
    }

    async openFilePicker() {
        console.log('ImportView: openFilePicker called');
        try {
            const files = await new Promise((resolve) => {
                console.log('ImportView: Creating file input...');
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf';
                input.multiple = true;
                input.style.display = 'none';
                
                input.addEventListener('change', (e) => {
                    console.log('ImportView: File input change event triggered');
                    resolve(e.target.files);
                });
                
                console.log('ImportView: Clicking file input...');
                input.click();
            });
            
            console.log('ImportView: Files selected:', files ? files.length : 0);
            if (files && files.length > 0) {
                this.handleFiles(files);
            }
        } catch (error) {
            console.error('ImportView: Error opening file picker:', error);
            ui.notifications.error('Failed to open file picker');
        }
    }

    handleFileChange(e) {
        this.handleFiles(e.target.files);
    }

    handleImportClick() {
        this.importFiles();
    }

    handleFiles(files) {
        this.selectedFiles = Array.from(files).filter(file => file.type === 'application/pdf');
        this.updateFileList();
        this.updateImportButton();
        
        // Show success message
        if (this.selectedFiles.length > 0) {
            ui.notifications.info(`Selected ${this.selectedFiles.length} PDF file(s) for import`);
        }
    }

    updateFileList() {
        const uploadArea = this.container.querySelector('#uploadArea');
        const fileList = this.container.querySelector('#fileList');
        
        if (this.selectedFiles.length > 0) {
            // Hide upload area and show file list in its place
            if (uploadArea) {
                uploadArea.style.setProperty('display', 'none', 'important');
            }
            if (fileList) {
                fileList.style.setProperty('display', 'flex', 'important');
                fileList.style.setProperty('flex', '1', 'important');
                this.loadFileItems(fileList.querySelector('.file-items'));
            }
        } else {
            // Show upload area and hide file list
            if (uploadArea) {
                uploadArea.style.setProperty('display', 'flex', 'important');
            }
            if (fileList) {
                fileList.style.setProperty('display', 'none', 'important');
            }
        }
    }

    async loadFileItems(container) {
        const path = 'systems/wodsystem/templates/rulespedia/file-item.html';
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load file item template');
            const template = await response.text();
            
            const fileItemsHTML = this.selectedFiles.map(file => {
                let html = template;
                html = html.replace(/{{fileName}}/g, file.name);
                html = html.replace(/{{fileSize}}/g, this.formatFileSize(file.size));
                return html;
            }).join('');
            
            container.innerHTML = fileItemsHTML;
        } catch (error) {
            console.error('Error loading file items:', error);
        }
    }

    updateImportButton() {
        const importButton = this.container.querySelector('#importButton');
        if (importButton) {
            importButton.disabled = this.selectedFiles.length === 0;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async importFiles() {
        if (this.selectedFiles.length === 0) return;
        
        const importButton = this.container.querySelector('#importButton');
        const importProgress = this.container.querySelector('#importProgress');
        
        if (importButton && importProgress) {
            importButton.disabled = true;
            importProgress.style.display = 'block';
            
            try {
                for (let i = 0; i < this.selectedFiles.length; i++) {
                    const file = this.selectedFiles[i];
                    await this.importFile(file, i + 1, this.selectedFiles.length);
                }
                
                ui.notifications.info(`Successfully imported ${this.selectedFiles.length} file(s)`);
                this.selectedFiles = [];
                this.updateFileList();
                this.updateImportButton();
                
            } catch (error) {
                console.error('Import error:', error);
                ui.notifications.error('Import failed: ' + error.message);
            } finally {
                importButton.disabled = false;
                importProgress.style.display = 'none';
            }
        }
    }

    async importFile(file, current, total) {
        console.log(`ImportView: Starting import of ${file.name} (${current}/${total})`);
        
        // Update progress
        const progressText = this.container.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `Processing ${file.name} (${current}/${total})...`;
        }
        
        try {
            console.log(`ImportView: Extracting text from PDF...`);
            // Extract text from PDF
            const extractedText = await this.extractTextFromPDF(file);
            console.log(`ImportView: Extracted ${extractedText.length} characters of text`);
            
            console.log(`ImportView: Splitting text into chunks...`);
            // Split text into chunks for better vector search
            const textChunks = this.splitTextIntoChunks(extractedText, file.name);
            console.log(`ImportView: Created ${textChunks.length} chunks`);
            
            console.log(`ImportView: Storing chunks in vector database...`);
            // Generate embeddings and store in vector database
            await this.storeTextInVectorDB(textChunks, file.name);
            
            console.log(`ImportView: Successfully imported ${file.name}`);
            
            return {
                success: true,
                filename: file.name,
                chunks: textChunks.length
            };
        } catch (error) {
            console.error(`ImportView: Error importing ${file.name}:`, error);
            throw new Error(`Failed to import ${file.name}: ${error.message}`);
        }
    }

    async extractTextFromPDF(file) {
        return new Promise(async (resolve, reject) => {
            try {
                // Try to load PDF.js
                try {
                    await this.loadPDFJS();
                } catch (error) {
                    console.warn('PDF.js failed to load, using fallback method:', error);
                    // Use fallback method
                    const fallbackText = await this.extractTextFallback(file);
                    resolve(fallbackText);
                    return;
                }
                
                const reader = new FileReader();
                
                reader.onload = async (e) => {
                    try {
                        const pdfjsLib = window['pdfjs-dist/build/pdf'];
                        
                        if (!pdfjsLib) {
                            throw new Error('PDF.js library not available after loading');
                        }
                        
                        const arrayBuffer = e.target.result;
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        
                        let fullText = '';
                        
                        // Extract text from each page
                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            const page = await pdf.getPage(pageNum);
                            const textContent = await page.getTextContent();
                            
                            // Combine text items
                            const pageText = textContent.items
                                .map(item => item.str)
                                .join(' ');
                            
                            fullText += pageText + '\n';
                        }
                        
                        resolve(fullText);
                    } catch (error) {
                        console.warn('PDF.js extraction failed, using fallback:', error);
                        // Try fallback method
                        const fallbackText = await this.extractTextFallback(file);
                        resolve(fallbackText);
                    }
                };
                
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsArrayBuffer(file);
                
            } catch (error) {
                reject(new Error(`PDF text extraction failed: ${error.message}`));
            }
        });
    }

    async extractTextFallback(file) {
        // Simple fallback: return filename and basic info
        // This is a placeholder - in a real implementation you might use a different PDF library
        return `PDF Document: ${file.name}\nSize: ${this.formatFileSize(file.size)}\n\n[Text extraction not available - please ensure PDF.js is loaded properly]`;
    }

    async loadPDFJS() {
        // Check if PDF.js is already loaded
        if (window['pdfjs-dist/build/pdf']) {
            return;
        }
        
        // Load PDF.js from CDN
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            
            script.onload = () => {
                // Set the worker source
                window['pdfjs-dist/build/pdf'].GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                console.log('PDF.js loaded successfully');
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load PDF.js from CDN'));
            };
            
            document.head.appendChild(script);
        });
    }

    splitTextIntoChunks(text, filename) {
        const chunks = [];
        
        // Step 1: Clean up the text
        let cleanText = text
            .replace(/\r\n/g, '\n')  // Normalize line endings
            .replace(/\r/g, '\n')    // Convert remaining carriage returns
            .replace(/\n{3,}/g, '\n\n'); // Remove excessive blank lines
        
        // Step 2: Split into sections based on common RPG book patterns
        const sections = this.splitIntoSections(cleanText);
        
        // Step 3: Process each section into chunks
        sections.forEach((section, sectionIndex) => {
            const sectionChunks = this.processSectionIntoChunks(section, filename, sectionIndex);
            chunks.push(...sectionChunks);
        });
        
        console.log(`Split "${filename}" into ${chunks.length} smart chunks`);
        return chunks;
    }
    
    splitIntoSections(text) {
        const sections = [];
        const lines = text.split('\n');
        let currentSection = { title: 'Introduction', content: [] };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if this line looks like a heading
            if (this.isHeading(line)) {
                // Save the previous section if it has content
                if (currentSection.content.length > 0) {
                    sections.push(currentSection);
                }
                
                // Start a new section
                currentSection = {
                    title: line,
                    content: []
                };
            } else if (line.length > 0) {
                // Add content to current section
                currentSection.content.push(line);
            }
        }
        
        // Add the last section
        if (currentSection.content.length > 0) {
            sections.push(currentSection);
        }
        
        return sections;
    }
    
    isHeading(line) {
        // Check if a line looks like a heading
        const headingPatterns = [
            /^[A-Z][A-Z\s]+$/,           // ALL CAPS
            /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/, // Title Case
            /^\d+\.\s+[A-Z]/,            // Numbered sections
            /^[A-Z][a-z]+:/,             // Ends with colon
            /^Chapter\s+\d+/i,           // Chapter headings
            /^Section\s+\d+/i,           // Section headings
            /^Part\s+\d+/i,              // Part headings
            /^[IVX]+\.\s+[A-Z]/,         // Roman numerals
            /^[A-Z][A-Z\s]{3,}$/         // Short ALL CAPS (3+ chars)
        ];
        
        return headingPatterns.some(pattern => pattern.test(line)) && line.length < 100;
    }
    
    processSectionIntoChunks(section, filename, sectionIndex) {
        const chunks = [];
        const content = section.content.join('\n');
        const maxChunkSize = 800; // Smaller chunks for better precision
        const overlap = 100; // Smaller overlap
        
        // If the section is small enough, keep it as one chunk
        if (content.length <= maxChunkSize) {
            chunks.push({
                text: this.formatChunkText(section.title, content),
                filename: filename,
                chunkIndex: chunks.length,
                sectionTitle: section.title,
                sectionIndex: sectionIndex
            });
            return chunks;
        }
        
        // Split large sections into smaller chunks
        let start = 0;
        while (start < content.length) {
            const end = Math.min(start + maxChunkSize, content.length);
            let chunkContent = content.substring(start, end);
            
            // Try to break at paragraph boundaries
            if (end < content.length) {
                const lastParagraph = chunkContent.lastIndexOf('\n\n');
                const lastSentence = chunkContent.lastIndexOf('. ');
                const breakPoint = Math.max(lastParagraph + 2, lastSentence + 1);
                
                if (breakPoint > start + maxChunkSize * 0.6) {
                    chunkContent = content.substring(start, breakPoint);
                    start = breakPoint - overlap;
                } else {
                    start = end - overlap;
                }
            } else {
                start = end;
            }
            
            if (chunkContent.trim()) {
                chunks.push({
                    text: this.formatChunkText(section.title, chunkContent.trim()),
                    filename: filename,
                    chunkIndex: chunks.length,
                    sectionTitle: section.title,
                    sectionIndex: sectionIndex
                });
            }
        }
        
        return chunks;
    }
    
    formatChunkText(sectionTitle, content) {
        // Format the chunk with section title for context
        if (sectionTitle && sectionTitle !== 'Introduction') {
            return `[${sectionTitle}]\n\n${content}`;
        }
        return content;
    }

    async storeTextInVectorDB(textChunks, filename) {
        console.log(`ImportView: Storing ${textChunks.length} chunks for ${filename}`);
        
        // Get the vector database manager - try multiple sources
        const vectorDB = window.rulespediaVectorDB || window.rulespediaManager?.getVectorDB();
        
        if (!vectorDB) {
            console.error('ImportView: Vector database not available');
            throw new Error('Vector database not available');
        }
        
        console.log(`ImportView: Found vector database, storing chunks...`);
        
        // Store each chunk with embeddings
        for (const chunk of textChunks) {
            try {
                console.log(`ImportView: Storing chunk ${chunk.chunkIndex} (${chunk.text.length} characters)`);
                
                // Use the correct method: addDocument
                const result = await vectorDB.addDocument(
                    `${filename}_chunk_${chunk.chunkIndex}`,
                    chunk.text,
                    {
                        filename: filename,
                        chunkIndex: chunk.chunkIndex,
                        sectionTitle: chunk.sectionTitle,
                        sectionIndex: chunk.sectionIndex,
                        source: 'pdf_import',
                        timestamp: new Date().toISOString()
                    }
                );
                
                console.log(`ImportView: Successfully stored chunk ${chunk.chunkIndex}`);
                
            } catch (error) {
                console.error(`ImportView: Error storing chunk ${chunk.chunkIndex} from ${filename}:`, error);
                // Continue with other chunks even if one fails
            }
        }
        
        console.log(`ImportView: Completed storing ${textChunks.length} chunks for ${filename}`);
    }

    handleClearSelection() {
        this.selectedFiles = [];
        this.updateFileList();
        this.updateImportButton();
        ui.notifications.info('File selection cleared');
    }
}

/**
 * Manage View - For managing imported rulebooks
 */
class ManageView extends RuleView {
    constructor() {
        super('manage', 'Manage Books', 'fas fa-database');
        this.setTemplatePath('systems/wodsystem/templates/rulespedia/rulespedia-manage.html');
        this.rulebooks = [];
    }

    onRender() {
        this.loadRulebooks();
        this.setupClearDatabaseButton();
    }

    setupClearDatabaseButton() {
        const clearButton = document.getElementById('clearDatabaseButton');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.handleClearDatabase();
            });
        }
    }
    
    async handleClearDatabase() {
        const confirmed = await new Promise((resolve) => {
            new Dialog({
                title: 'Clear Database',
                content: `<p>Are you sure you want to clear the entire database? This will remove all imported rulebooks and their search data. This action cannot be undone.</p>`,
                buttons: {
                    clear: {
                        label: 'Clear Database',
                        icon: '<i class="fas fa-trash"></i>',
                        callback: () => resolve(true)
                    },
                    cancel: {
                        label: 'Cancel',
                        icon: '<i class="fas fa-times"></i>',
                        callback: () => resolve(false)
                    }
                },
                default: 'cancel',
                close: () => resolve(false)
            }).render(true);
        });
        
        if (confirmed) {
            try {
                // Get the vector database
                const vectorDB = window.rulespediaVectorDB || window.rulespediaManager?.getVectorDB();
                
                if (!vectorDB) {
                    throw new Error('Vector database not available');
                }
                
                // Clear the database
                await vectorDB.clear();
                
                // Update the UI
                this.rulebooks = [];
                this.updateBookList();
                
                ui.notifications.info('Database cleared successfully. You can now re-import your rulebooks with the improved system.');
            } catch (error) {
                console.error('Clear database error:', error);
                ui.notifications.error('Failed to clear database: ' + error.message);
            }
        }
    }

    async loadRulebooks() {
        try {
            // This would load from the actual database
            this.rulebooks = await this.mockLoadRulebooks();
            this.updateBookList();
        } catch (error) {
            console.error('Error loading rulebooks:', error);
        }
    }

    updateBookList() {
        const bookList = document.getElementById('bookList');
        if (bookList) {
            if (this.rulebooks.length > 0) {
                this.loadBookItems(bookList);
            } else {
                this.loadEmptyBookList(bookList);
            }
        }
    }

    async loadBookItems(container) {
        const path = 'systems/wodsystem/templates/rulespedia/book-item.html';
        const gridPath = 'systems/wodsystem/templates/rulespedia/book-grid.html';
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load book item template');
            const template = await response.text();
            
            const bookItemsHTML = this.rulebooks.map(book => {
                let html = template;
                html = html.replace(/{{bookName}}/g, book.name);
                html = html.replace(/{{bookFilename}}/g, book.filename);
                html = html.replace(/{{bookSize}}/g, book.size);
                html = html.replace(/{{bookDate}}/g, book.imported);
                return html;
            }).join('');
            
            const gridResponse = await fetch(gridPath);
            if (!gridResponse.ok) throw new Error('Failed to load book grid template');
            let gridTemplate = await gridResponse.text();
            gridTemplate = gridTemplate.replace(/{{bookItems}}/g, bookItemsHTML);
            
            container.innerHTML = gridTemplate;
        } catch (error) {
            console.error('Error loading book items:', error);
        }
    }

    async loadEmptyBookList(container) {
        const path = 'systems/wodsystem/templates/rulespedia/search-no-results.html';
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error('Failed to load empty book list template');
            const html = await response.text();
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading empty book list:', error);
        }
    }

    async viewBook(filename) {
        // This would open the book viewer
        ui.notifications.info(`Viewing ${filename}`);
    }

    async deleteBook(filename) {
        const confirmed = await Dialog.confirm({
            title: 'Delete Rulebook',
            content: `Are you sure you want to delete "${filename}"? This action cannot be undone.`,
            yes: 'Delete',
            no: 'Cancel'
        });
        
        if (confirmed) {
            try {
                // This would delete from the actual database
                await this.mockDeleteBook(filename);
                
                // Remove from local list
                this.rulebooks = this.rulebooks.filter(book => book.filename !== filename);
                this.updateBookList();
                
                ui.notifications.info(`Successfully deleted ${filename}`);
            } catch (error) {
                console.error('Delete error:', error);
                ui.notifications.error('Delete failed: ' + error.message);
            }
        }
    }

    // Mock methods for demonstration
    async mockLoadRulebooks() {
        await new Promise(resolve => setTimeout(resolve, 500));
        return [
            { name: 'Player\'s Handbook', filename: 'phb.pdf', size: '2.3 MB', imported: '2024-01-15' },
            { name: 'Dungeon Master\'s Guide', filename: 'dmg.pdf', size: '1.8 MB', imported: '2024-01-10' },
            { name: 'Monster Manual', filename: 'mm.pdf', size: '3.1 MB', imported: '2024-01-05' }
        ];
    }

    async mockDeleteBook(filename) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true };
    }
}

// Export for use in other modules
window.HomeView = HomeView;
window.ImportView = ImportView;
window.ManageView = ManageView; 