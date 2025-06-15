/**
 * Rulespedia Services - Core service implementations
 * Provides search, import, and book management functionality
 */

// Debug: Check what LLM services are available when this file loads
console.log('RulespediaServices: File loading - checking for LLM services...');
console.log('RulespediaServices: window.LLMService:', typeof window.LLMService);
console.log('RulespediaServices: window.RuleDiscoveryService:', typeof window.RuleDiscoveryService);
console.log('RulespediaServices: window.BrowserLLMProvider:', typeof window.BrowserLLMProvider);
console.log('RulespediaServices: window.LLMPrompts:', typeof window.LLMPrompts);

/**
 * Rulespedia Services
 * Business logic layer for Rulespedia functionality
 * Handles search, import, book management, and other business operations
 */

/**
 * Search Service - Handles all search-related operations
 */
class SearchService {
    constructor(contentStore) {
        this.contentStore = contentStore;
    }

    /**
     * Perform semantic search using the content store
     * @param {string} query - Search query
     * @param {Object} options - Search options
     */
    async performSearch(query, options = {}) {
        try {
            if (!this.contentStore) {
                throw new Error('Content store not available');
            }

            // TODO: Implement with new TF-IDF approach
            // For now, return placeholder
            return {
                content: `Search functionality will be implemented with the new approach. Query: "${query}"`,
                source: 'Placeholder',
                confidence: 0.0,
                type: 'placeholder'
            };
        } catch (error) {
            console.error('SearchService: Search error:', error);
            throw error;
        }
    }

    /**
     * Format search results for display
     * @param {Array} results - Search results
     * @param {string} query - Original query
     */
    formatSearchResults(results, query) {
        // TODO: Implement with new approach
        return `Search results formatting will be implemented with the new approach.`;
    }
}

/**
 * Import Service - Handles book import operations
 */
class ImportService {
    constructor(contentStore) {
        this.contentStore = contentStore;
        
        // Token-based chunking configuration
        this.TARGET_CHUNK_SIZE = 2000; // words
        this.MIN_CHUNK_SIZE = 1000; // words
        this.MAX_CHUNK_SIZE = 3000; // words
        this.OVERLAP_SIZE = 200; // words for context continuity
        
        // TF-IDF configuration
        this.TFIDF_THRESHOLD = 0.7; // Minimum confidence threshold for word-chunk associations
        this.STOP_WORDS = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
            'mine', 'yours', 'his', 'hers', 'ours', 'theirs',
            'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom',
            'as', 'so', 'than', 'too', 'very', 'just', 'now', 'then', 'here', 'there',
            'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'
        ]);
    }

    /**
     * Import a rulebook
     * @param {File} file - File to import
     * @param {Object} options - Import options
     */
    async importBook(file, options = {}) {
        const progressCallback = options.progressCallback || (() => {});
        
        try {
            console.log(`ImportService: Starting import of ${file.name}`);
            console.log(`ImportService: File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
            
            progressCallback(0.1); // 10% - Starting
            
            // Extract text from PDF
            const extractedText = await this.extractTextFromPDF(file, progressCallback);
            console.log(`ImportService: Extracted ${extractedText.length} characters of text`);
            console.log(`ImportService: Extracted ${extractedText.split(/\s+/).filter(w => w.trim().length > 0).length} words`);
            
            progressCallback(0.25); // 25% - Text extraction complete
            
            // Step 1: Pre-process text and calculate IDF
            const processedData = this.preprocessTextAndCalculateIDF(extractedText, file.name);
            console.log(`ImportService: Pre-processed text and calculated IDF for ${processedData.uniqueWords.size} unique words`);
            
            progressCallback(0.35); // 35% - Text processing complete
            
            // Step 2: Split text into token-based chunks with progress tracking
            const chunkingProgressCallback = (chunkProgress) => {
                // Map chunking progress from 35% to 60% (25% of total progress)
                const overallProgress = 0.35 + (chunkProgress * 0.25);
                progressCallback(overallProgress);
            };
            
            const textChunks = this.splitTextIntoTokenChunks(extractedText, file.name, chunkingProgressCallback);
            console.log(`ImportService: Created ${textChunks.length} token-based chunks`);
            
            progressCallback(0.65); // 65% - Chunking complete
            
            // Step 3: Calculate TF-IDF and create word-chunk associations
            const tfidfData = this.calculateTFIDFAndAssociations(textChunks, processedData.idfScores);
            console.log(`ImportService: Calculated TF-IDF and created ${Object.keys(tfidfData.wordChunkAssociations).length} word-chunk associations`);
            
            progressCallback(0.85); // 85% - TF-IDF calculation complete
            
            // Log chunk statistics
            const totalWords = textChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
            const avgChunkSize = Math.round(totalWords / textChunks.length);
            const minChunkSize = Math.min(...textChunks.map(c => c.wordCount));
            const maxChunkSize = Math.max(...textChunks.map(c => c.wordCount));
            
            console.log(`ImportService: Chunk statistics:`);
            console.log(`  Total words: ${totalWords.toLocaleString()}`);
            console.log(`  Average chunk size: ${avgChunkSize} words`);
            console.log(`  Min chunk size: ${minChunkSize} words`);
            console.log(`  Max chunk size: ${maxChunkSize} words`);
            console.log(`  Target chunk size: ${this.TARGET_CHUNK_SIZE} words`);
            
            // Store chunks and TF-IDF data in content store
            await this.storeTextInContentStore(textChunks, file.name, tfidfData);
            
            progressCallback(1.0); // 100% - Complete
            
            return {
                success: true,
                message: `Successfully imported ${file.name}`,
                filename: file.name,
                chunks: textChunks.length,
                totalWords: totalWords,
                averageChunkSize: avgChunkSize,
                minChunkSize: minChunkSize,
                maxChunkSize: maxChunkSize,
                uniqueWords: processedData.uniqueWords.size,
                wordChunkAssociations: Object.keys(tfidfData.wordChunkAssociations).length
            };
        } catch (error) {
            console.error('ImportService: Import error:', error);
            throw error;
        }
    }

    /**
     * Extract text from PDF file
     */
    async extractTextFromPDF(file, progressCallback = () => {}) {
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
                        
                        console.log(`PDF loaded: ${pdf.numPages} pages`);
                        
                        let fullText = '';
                        let pageStats = [];
                        
                        // Extract text from each page with improved handling
                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            try {
                                const page = await pdf.getPage(pageNum);
                                const textContent = await page.getTextContent();
                                
                                // Improved text extraction that handles complex layouts
                                const pageText = this.extractTextFromPage(textContent, pageNum);
                                
                                if (pageText.trim()) {
                                    fullText += `\n--- PAGE ${pageNum} ---\n${pageText}\n`;
                                    
                                    pageStats.push({
                                        page: pageNum,
                                        textLength: pageText.length,
                                        hasContent: pageText.trim().length > 0
                                    });
                                } else {
                                    pageStats.push({
                                        page: pageNum,
                                        textLength: 0,
                                        hasContent: false
                                    });
                                }
                                
                                // Update progress for each page
                                const pageProgress = 0.1 + (pageNum / pdf.numPages) * 0.2; // 10-30% for text extraction
                                progressCallback(pageProgress);
                                
                                // Log progress every 10 pages
                                if (pageNum % 10 === 0) {
                                    console.log(`Extracted page ${pageNum}/${pdf.numPages}`);
                                }
                                
                            } catch (pageError) {
                                console.warn(`Error extracting page ${pageNum}:`, pageError);
                                pageStats.push({
                                    page: pageNum,
                                    textLength: 0,
                                    hasContent: false,
                                    error: pageError.message
                                });
                            }
                        }
                        
                        // Log extraction statistics
                        const totalPages = pdf.numPages;
                        const pagesWithContent = pageStats.filter(p => p.hasContent).length;
                        const totalTextLength = fullText.length;
                        
                        console.log(`PDF extraction complete:`);
                        console.log(`  Total pages: ${totalPages}`);
                        console.log(`  Pages with content: ${pagesWithContent}`);
                        console.log(`  Total text length: ${totalTextLength.toLocaleString()} characters`);
                        console.log(`  Average text per page: ${Math.round(totalTextLength / totalPages)} characters`);
                        
                        if (pagesWithContent < totalPages * 0.5) {
                            console.warn(`⚠️  Warning: Only ${pagesWithContent}/${totalPages} pages have content. This may indicate extraction issues.`);
                        }
                        
                        if (totalTextLength < 10000) {
                            console.warn(`⚠️  Warning: Very little text extracted (${totalTextLength} chars). This may indicate a problem with the PDF or extraction.`);
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

    /**
     * Improved text extraction from a single page
     */
    extractTextFromPage(textContent, pageNum) {
        try {
            // Sort text items by position (top to bottom, left to right)
            const sortedItems = textContent.items.sort((a, b) => {
                // Primary sort: by y position (top to bottom)
                const yDiff = b.transform[5] - a.transform[5];
                if (Math.abs(yDiff) > 5) return yDiff;
                
                // Secondary sort: by x position (left to right)
                return a.transform[4] - b.transform[4];
            });
            
            let pageText = '';
            let currentLine = '';
            let lastY = null;
            let lastX = null;
            
            for (const item of sortedItems) {
                const text = item.str;
                const x = item.transform[4];
                const y = item.transform[5];
                
                // Skip empty text
                if (!text || text.trim() === '') continue;
                
                // Check if this is a new line (significant Y difference)
                const isNewLine = lastY === null || Math.abs(y - lastY) > 10;
                
                // Check if this is a new word (significant X difference)
                const isNewWord = lastX === null || (x - lastX) > 20;
                
                if (isNewLine) {
                    // Start a new line
                    if (currentLine.trim()) {
                        pageText += currentLine.trim() + '\n';
                    }
                    currentLine = text;
                } else if (isNewWord) {
                    // Add space between words
                    currentLine += ' ' + text;
                } else {
                    // Same word, just append
                    currentLine += text;
                }
                
                lastY = y;
                lastX = x + (item.width || 0);
            }
            
            // Add the last line
            if (currentLine.trim()) {
                pageText += currentLine.trim() + '\n';
            }
            
            return pageText;
            
        } catch (error) {
            console.error(`Error extracting text from page ${pageNum}:`, error);
            return '';
        }
    }

    /**
     * Clean extracted text
     */
    cleanExtractedText(text) {
        return text
            .replace(/\r\n/g, '\n')  // Normalize line endings
            .replace(/\r/g, '\n')    // Convert remaining carriage returns
            .replace(/\n{3,}/g, '\n\n') // Remove excessive blank lines
            .trim();
    }

    /**
     * Fallback text extraction method
     */
    async extractTextFallback(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // Simple text extraction as fallback
                    const text = e.target.result;
                    resolve(this.cleanExtractedText(text));
                } catch (error) {
                    reject(new Error('Fallback text extraction failed'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Load PDF.js library
     */
    async loadPDFJS() {
        if (window['pdfjs-dist/build/pdf']) {
            return;
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                // Set worker path
                window['pdfjs-dist/build/pdf'].GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js'));
            document.head.appendChild(script);
        });
    }

    /**
     * Split text into token-based chunks with sequential numbering
     * @param {string} text - Full text to chunk
     * @param {string} filename - Source filename
     * @param {Function} progressCallback - Optional progress callback
     * @returns {Array} Array of chunk objects with sequential numbering
     */
    splitTextIntoTokenChunks(text, filename, progressCallback = () => {}) {
        console.log(`ImportService: Starting token-based chunking for ${filename}`);
        
        // Clean the text first
        let cleanText = this.cleanExtractedText(text);
        
        // Split into words for token-based chunking
        const words = cleanText.split(/\s+/).filter(word => word.trim().length > 0);
        console.log(`ImportService: Total words to chunk: ${words.length.toLocaleString()}`);
        
        // Get section boundaries for context preservation
        const sectionBoundaries = this.getSectionBoundaries(cleanText);
        console.log(`ImportService: Found ${sectionBoundaries.length} section boundaries`);
        
        const chunks = [];
        let currentChunkCount = 0;
        let startWordIndex = 0;
        
        // Estimate total chunks for progress calculation
        const estimatedTotalChunks = Math.ceil(words.length / this.TARGET_CHUNK_SIZE);
        console.log(`ImportService: Estimated ${estimatedTotalChunks} chunks to create`);
        
        // Token-based chunking across the entire document
        while (startWordIndex < words.length) {
            // Calculate optimal chunk size
            const targetSize = this.getOptimalChunkSize(words.length - startWordIndex);
            const endWordIndex = Math.min(startWordIndex + targetSize, words.length);
            
            // Extract words for this chunk
            const chunkWords = words.slice(startWordIndex, endWordIndex);
            let chunkContent = chunkWords.join(' ');
            
            // Try to break at natural boundaries
            if (endWordIndex < words.length) {
                const adjustedEndIndex = this.findNaturalBreakPoint(
                    words, 
                    startWordIndex, 
                    endWordIndex,
                    targetSize
                );
                
                chunkContent = words.slice(startWordIndex, adjustedEndIndex).join(' ');
                startWordIndex = adjustedEndIndex - this.OVERLAP_SIZE;
            } else {
                startWordIndex = endWordIndex;
            }
            
            // Get section context for this chunk
            const sectionContext = this.getSectionContextForChunk(
                startWordIndex, 
                Math.min(startWordIndex + targetSize, words.length),
                sectionBoundaries,
                cleanText
            );
            
            // Create chunk with sequential numbering
            currentChunkCount++;
            chunks.push({
                chunk_count: currentChunkCount,
                chunk: this.formatChunkText(sectionContext, chunkContent),
                filename: filename,
                sectionContext: sectionContext,
                wordCount: chunkContent.split(/\s+/).filter(w => w.trim().length > 0).length,
                startWordIndex: startWordIndex,
                endWordIndex: Math.min(startWordIndex + targetSize, words.length)
            });
            
            // Update progress every 10 chunks or when we have a good estimate
            if (currentChunkCount % 10 === 0 || currentChunkCount === estimatedTotalChunks) {
                const chunkProgress = Math.min(currentChunkCount / estimatedTotalChunks, 1.0);
                progressCallback(chunkProgress);
            }
        }
        
        // Final progress update
        progressCallback(1.0);
        
        console.log(`ImportService: Created ${chunks.length} token-based chunks for ${filename}`);
        console.log(`ImportService: Average chunk size: ${Math.round(chunks.reduce((sum, c) => sum + c.wordCount, 0) / chunks.length)} words`);
        
        return chunks;
    }

    /**
     * Get section boundaries for context preservation
     * @param {string} text - Full text
     * @returns {Array} Array of section boundary objects
     */
    getSectionBoundaries(text) {
        const boundaries = [];
        const lines = text.split('\n');
        let currentWordIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.length === 0) {
                currentWordIndex += 1; // Account for newline
                continue;
            }
            
            // Check if this line is a heading
            if (this.isHeading(line)) {
                boundaries.push({
                    title: line,
                    startWordIndex: currentWordIndex,
                    lineIndex: i
                });
            }
            
            // Count words in this line
            const wordsInLine = line.split(/\s+/).filter(word => word.trim().length > 0).length;
            currentWordIndex += wordsInLine + 1; // +1 for newline
        }
        
        return boundaries;
    }

    /**
     * Get section context for a chunk
     * @param {number} startWordIndex - Start word index
     * @param {number} endWordIndex - End word index
     * @param {Array} sectionBoundaries - Section boundaries
     * @param {string} fullText - Full text
     * @returns {string} Section context
     */
    getSectionContextForChunk(startWordIndex, endWordIndex, sectionBoundaries, fullText) {
        // Find the section that contains most of this chunk
        let bestSection = null;
        let maxOverlap = 0;
        
        for (let i = 0; i < sectionBoundaries.length; i++) {
            const section = sectionBoundaries[i];
            const nextSection = sectionBoundaries[i + 1];
            
            const sectionStart = section.startWordIndex;
            const sectionEnd = nextSection ? nextSection.startWordIndex : Infinity;
            
            // Calculate overlap between chunk and section
            const overlapStart = Math.max(startWordIndex, sectionStart);
            const overlapEnd = Math.min(endWordIndex, sectionEnd);
            const overlap = Math.max(0, overlapEnd - overlapStart);
            
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestSection = section;
            }
        }
        
        return bestSection ? bestSection.title : 'Introduction';
    }

    /**
     * Get optimal chunk size based on remaining content
     * @param {number} remainingWords - Number of words remaining
     * @returns {number} Optimal chunk size in words
     */
    getOptimalChunkSize(remainingWords) {
        if (remainingWords <= this.MAX_CHUNK_SIZE) {
            return remainingWords;
        }
        
        // Add some randomness to avoid uniform chunk sizes
        const baseSize = this.TARGET_CHUNK_SIZE;
        const variation = Math.floor(Math.random() * 400) - 200; // ±200 words
        const optimalSize = Math.max(this.MIN_CHUNK_SIZE, baseSize + variation);
        
        return Math.min(optimalSize, this.MAX_CHUNK_SIZE);
    }

    /**
     * Find natural break point for chunking
     * @param {Array} words - Array of words
     * @param {number} startIndex - Start index
     * @param {number} endIndex - End index
     * @param {number} targetSize - Target chunk size
     * @returns {number} Adjusted end index
     */
    findNaturalBreakPoint(words, startIndex, endIndex, targetSize) {
        // Look for paragraph breaks first
        for (let i = endIndex - 1; i > startIndex + targetSize * 0.7; i--) {
            if (words[i] === '\n\n' || words[i] === '\n') {
                return i;
            }
        }
        
        // Look for sentence endings
        for (let i = endIndex - 1; i > startIndex + targetSize * 0.6; i--) {
            if (words[i].endsWith('.') || words[i].endsWith('!') || words[i].endsWith('?')) {
                return i + 1;
            }
        }
        
        // Look for clause breaks
        for (let i = endIndex - 1; i > startIndex + targetSize * 0.5; i--) {
            if (words[i].endsWith(',') || words[i].endsWith(';') || words[i].endsWith(':')) {
                return i + 1;
            }
        }
        
        // Default to target size
        return Math.min(startIndex + targetSize, endIndex);
    }

    /**
     * Format chunk text with section context
     * @param {string} sectionContext - Section context
     * @param {string} content - Chunk content
     * @returns {string} Formatted chunk text
     */
    formatChunkText(sectionContext, content) {
        if (sectionContext && sectionContext !== 'Introduction') {
            return `[Section: ${sectionContext}]\n\n${content}`;
        }
        return content;
    }

    /**
     * Store text chunks in content store
     */
    async storeTextInContentStore(textChunks, filename, tfidfData) {
        console.log(`ImportService: Storing ${textChunks.length} chunks for ${filename}`);
        
        if (!this.contentStore) {
            console.error('ImportService: Content store not available');
            throw new Error('Content store not available');
        }
        
        console.log(`ImportService: Found content store, storing chunks...`);
        
        // Store each chunk
        for (const chunk of textChunks) {
            try {
                console.log(`ImportService: Storing chunk ${chunk.chunk_count} (${chunk.chunk.length} characters, ${chunk.wordCount} words)`);
                
                // Use the correct method: addDocument
                const result = await this.contentStore.addDocument(
                    `${filename}_chunk_${chunk.chunk_count}`,
                    chunk.chunk,
                    {
                        filename: filename,
                        chunk_count: chunk.chunk_count,
                        sectionContext: chunk.sectionContext,
                        wordCount: chunk.wordCount,
                        startWordIndex: chunk.startWordIndex,
                        endWordIndex: chunk.endWordIndex
                    }
                );
                
                console.log(`ImportService: Successfully stored chunk ${chunk.chunk_count}`);
                
            } catch (error) {
                console.error(`ImportService: Error storing chunk ${chunk.chunk_count} from ${filename}:`, error);
                // Continue with other chunks even if one fails
            }
        }
        
        // Store TF-IDF data
        await this.contentStore.addDocument(
            `${filename}_tfidf_data`,
            JSON.stringify(tfidfData),
            {
                filename: filename,
                chunk_count: 'tfidf_data',
                sectionContext: 'TF-IDF Data',
                wordCount: Object.keys(tfidfData.wordChunkAssociations).length,
                startWordIndex: 0,
                endWordIndex: Object.keys(tfidfData.wordChunkAssociations).length - 1
            }
        );
        
        console.log(`ImportService: Completed storing all chunks for ${filename}`);
    }

    /**
     * Get list of imported books
     */
    async getImportedBooks() {
        try {
            // TODO: Implement with new approach
            return [];
        } catch (error) {
            console.error('ImportService: Error getting imported books:', error);
            throw error;
        }
    }

    /**
     * Delete an imported book
     * @param {string} filename - Filename to delete
     */
    async deleteBook(filename) {
        try {
            // TODO: Implement with new approach
            return {
                success: true,
                message: `Delete functionality will be implemented with the new approach. File: ${filename}`
            };
        } catch (error) {
            console.error('ImportService: Delete error:', error);
            throw error;
        }
    }

    /**
     * Check if a line is a heading
     */
    isHeading(line) {
        // Generic heading detection for any type of document
        const headingPatterns = [
            // Chapter patterns
            /^Chapter\s+\d+/i,
            /^CHAPTER\s+\d+/,
            /^Part\s+\d+/i,
            /^PART\s+\d+/,
            
            // Section patterns
            /^Section\s+\d+/i,
            /^SECTION\s+\d+/,
            
            // All caps headings (common in many documents)
            /^[A-Z][A-Z\s]{3,}$/,
            
            // Numbered headings
            /^\d+\.\s+[A-Z]/,
            /^\d+\)\s+[A-Z]/,
            
            // Short, bold-looking headings
            /^[A-Z][a-z]+$/,
            
            // Headings with colons
            /^[A-Z][^:]*:$/,
            
            // Headings that are alone on a line and look important
            /^[A-Z][a-zA-Z\s]{2,20}$/
        ];
        
        // Check if line matches any heading pattern
        for (const pattern of headingPatterns) {
            if (pattern.test(line)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Pre-process text and calculate IDF scores
     * @param {string} text - Raw extracted text
     * @param {string} filename - Source filename
     * @returns {Object} Processed data with clean text, unique words, and IDF scores
     */
    preprocessTextAndCalculateIDF(text, filename) {
        console.log(`ImportService: Pre-processing text for ${filename}`);
        
        // Clean the text
        let cleanText = this.cleanExtractedText(text);
        
        // Tokenize and normalize words
        const words = this.tokenizeAndNormalize(cleanText);
        console.log(`ImportService: Tokenized ${words.length} words`);
        
        // Remove stop words
        const filteredWords = words.filter(word => !this.STOP_WORDS.has(word));
        console.log(`ImportService: After stop word removal: ${filteredWords.length} words`);
        
        // Get unique words
        const uniqueWords = new Set(filteredWords);
        console.log(`ImportService: Unique words: ${uniqueWords.size}`);
        
        // Calculate IDF scores
        const idfScores = this.calculateIDFScores(filteredWords, uniqueWords);
        
        return {
            cleanText: cleanText,
            words: filteredWords,
            uniqueWords: uniqueWords,
            idfScores: idfScores
        };
    }

    /**
     * Tokenize and normalize words
     * @param {string} text - Text to tokenize
     * @returns {Array} Array of normalized words
     */
    tokenizeAndNormalize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .split(/\s+/)
            .filter(word => word.trim().length > 0)
            .map(word => this.normalizeWord(word));
    }

    /**
     * Normalize a word (basic stemming)
     * @param {string} word - Word to normalize
     * @returns {string} Normalized word
     */
    normalizeWord(word) {
        // Basic stemming: remove common suffixes
        const suffixes = ['s', 'es', 'ed', 'ing', 'ly', 'er', 'est'];
        
        for (const suffix of suffixes) {
            if (word.endsWith(suffix) && word.length > suffix.length + 2) {
                word = word.slice(0, -suffix.length);
                break;
            }
        }
        
        return word;
    }

    /**
     * Calculate IDF scores for all unique words
     * @param {Array} words - All words in the corpus
     * @param {Set} uniqueWords - Set of unique words
     * @returns {Map} Map of word to IDF score
     */
    calculateIDFScores(words, uniqueWords) {
        console.log(`ImportService: Calculating IDF scores for ${uniqueWords.size} unique words`);
        
        const idfScores = new Map();
        const totalWords = words.length;
        
        // Count word frequencies
        const wordFrequencies = new Map();
        for (const word of words) {
            wordFrequencies.set(word, (wordFrequencies.get(word) || 0) + 1);
        }
        
        // Calculate IDF for each unique word
        for (const word of uniqueWords) {
            const frequency = wordFrequencies.get(word) || 0;
            const idf = Math.log(totalWords / frequency);
            idfScores.set(word, idf);
        }
        
        console.log(`ImportService: IDF calculation complete. Sample scores:`);
        const sampleWords = Array.from(uniqueWords).slice(0, 5);
        sampleWords.forEach(word => {
            console.log(`  "${word}": ${idfScores.get(word).toFixed(3)}`);
        });
        
        return idfScores;
    }

    /**
     * Calculate TF-IDF scores and create word-chunk associations
     * @param {Array} chunks - Array of text chunks
     * @param {Map} idfScores - IDF scores for all words
     * @returns {Object} TF-IDF data and word-chunk associations
     */
    calculateTFIDFAndAssociations(chunks, idfScores) {
        console.log(`ImportService: Calculating TF-IDF scores for ${chunks.length} chunks`);
        
        const wordChunkAssociations = {};
        const chunkTFIDFScores = [];
        
        // Process each chunk
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            const chunkWords = this.tokenizeAndNormalize(chunk.chunk);
            const filteredChunkWords = chunkWords.filter(word => !this.STOP_WORDS.has(word));
            
            // Calculate TF for each word in this chunk
            const wordFrequencies = new Map();
            for (const word of filteredChunkWords) {
                wordFrequencies.set(word, (wordFrequencies.get(word) || 0) + 1);
            }
            
            const chunkScores = {};
            const totalWordsInChunk = filteredChunkWords.length;
            
            // Calculate TF-IDF for each word in this chunk
            for (const [word, frequency] of wordFrequencies) {
                const tf = frequency / totalWordsInChunk;
                const idf = idfScores.get(word) || 0;
                const tfidf = tf * idf;
                
                chunkScores[word] = {
                    tf: tf,
                    idf: idf,
                    tfidf: tfidf,
                    frequency: frequency
                };
                
                // Check if this word-chunk association meets the threshold
                if (tfidf >= this.TFIDF_THRESHOLD) {
                    if (!wordChunkAssociations[word]) {
                        wordChunkAssociations[word] = [];
                    }
                    
                    wordChunkAssociations[word].push({
                        chunk_count: chunk.chunk_count,
                        chunk_id: `${chunk.filename}_chunk_${chunk.chunk_count}`,
                        tfidf_score: tfidf,
                        confidence: Math.min(tfidf, 1.0), // Normalize to 0-1
                        sectionContext: chunk.sectionContext
                    });
                }
            }
            
            chunkTFIDFScores.push({
                chunk_count: chunk.chunk_count,
                scores: chunkScores
            });
        }
        
        // Sort word-chunk associations by TF-IDF score (highest first)
        for (const word in wordChunkAssociations) {
            wordChunkAssociations[word].sort((a, b) => b.tfidf_score - a.tfidf_score);
        }
        
        // COMPREHENSIVE LOGGING - Show all word-chunk associations
        console.log(`ImportService: TF-IDF calculation complete.`);
        console.log(`ImportService: TF-IDF threshold: ${this.TFIDF_THRESHOLD}`);
        console.log(`ImportService: Total word-chunk associations found: ${Object.keys(wordChunkAssociations).length}`);
        
        // Log all word-chunk associations with their scores
        console.log(`ImportService: ALL WORD-CHUNK ASSOCIATIONS:`);
        const sortedWords = Object.keys(wordChunkAssociations).sort((a, b) => {
            const maxScoreA = Math.max(...wordChunkAssociations[a].map(assoc => assoc.tfidf_score));
            const maxScoreB = Math.max(...wordChunkAssociations[b].map(assoc => assoc.tfidf_score));
            return maxScoreB - maxScoreA; // Sort by highest score first
        });
        
        sortedWords.forEach(word => {
            const associations = wordChunkAssociations[word];
            const maxScore = Math.max(...associations.map(assoc => assoc.tfidf_score));
            const avgScore = associations.reduce((sum, assoc) => sum + assoc.tfidf_score, 0) / associations.length;
            console.log(`  "${word}": ${associations.length} chunks, max score: ${maxScore.toFixed(4)}, avg score: ${avgScore.toFixed(4)}`);
            
            // Show top 3 chunks for this word
            associations.slice(0, 3).forEach(assoc => {
                console.log(`    - Chunk ${assoc.chunk_count}: score ${assoc.tfidf_score.toFixed(4)}, context: ${assoc.sectionContext}`);
            });
        });
        
        // Log sample chunk scores for debugging
        console.log(`ImportService: SAMPLE CHUNK SCORES (first 3 chunks):`);
        chunkTFIDFScores.slice(0, 3).forEach(chunkScore => {
            console.log(`  Chunk ${chunkScore.chunk_count}:`);
            const sortedScores = Object.entries(chunkScore.scores)
                .sort((a, b) => b[1].tfidf - a[1].tfidf)
                .slice(0, 10); // Top 10 words
            
            sortedScores.forEach(([word, score]) => {
                console.log(`    "${word}": TF=${score.tf.toFixed(4)}, IDF=${score.idf.toFixed(4)}, TF-IDF=${score.tfidf.toFixed(4)}, freq=${score.frequency}`);
            });
        });
        
        // Log IDF score statistics
        console.log(`ImportService: IDF SCORE STATISTICS:`);
        const idfValues = Array.from(idfScores.values());
        const maxIdf = Math.max(...idfValues);
        const minIdf = Math.min(...idfValues);
        const avgIdf = idfValues.reduce((sum, val) => sum + val, 0) / idfValues.length;
        console.log(`  Max IDF: ${maxIdf.toFixed(4)}`);
        console.log(`  Min IDF: ${minIdf.toFixed(4)}`);
        console.log(`  Avg IDF: ${avgIdf.toFixed(4)}`);
        
        // Show top 20 IDF scores
        const topIdfWords = Array.from(idfScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        console.log(`  Top 20 IDF scores:`);
        topIdfWords.forEach(([word, idf]) => {
            console.log(`    "${word}": ${idf.toFixed(4)}`);
        });
        
        return {
            wordChunkAssociations: wordChunkAssociations,
            chunkTFIDFScores: chunkTFIDFScores,
            idfScores: Object.fromEntries(idfScores)
        };
    }
}

/**
 * Book Management Service - Handles book-related operations
 */
class BookManagementService {
    constructor(contentStore) {
        this.contentStore = contentStore;
    }

    /**
     * Get book statistics
     */
    async getBookStats() {
        try {
            if (!this.contentStore) {
                return { 
                    totalBooks: 0, 
                    totalChunks: 0, 
                    totalWords: 0,
                    averageChunkSize: 0,
                    isInitialized: false 
                };
            }

            const stats = this.contentStore.getStats();
            return {
                totalBooks: stats.uniqueFiles,
                totalChunks: stats.totalChunks,
                totalWords: stats.totalWords,
                averageChunkSize: stats.averageChunkSize,
                isInitialized: stats.isInitialized,
                files: stats.files
            };
        } catch (error) {
            console.error('BookManagementService: Error getting stats:', error);
            throw error;
        }
    }

    /**
     * Get chunks for a specific book
     * @param {string} filename - Filename to get chunks for
     * @returns {Array} Array of chunks ordered by chunk_count
     */
    async getBookChunks(filename) {
        try {
            if (!this.contentStore) {
                return [];
            }

            return this.contentStore.getChunksForFile(filename);
        } catch (error) {
            console.error('BookManagementService: Error getting book chunks:', error);
            throw error;
        }
    }

    /**
     * Get all chunks ordered by chunk_count
     * @returns {Array} Array of all chunks ordered by chunk_count
     */
    async getAllChunksOrdered() {
        try {
            if (!this.contentStore) {
                return [];
            }

            return this.contentStore.getAllChunksOrdered();
        } catch (error) {
            console.error('BookManagementService: Error getting all chunks:', error);
            throw error;
        }
    }

    /**
     * Clear all books
     */
    async clearAllBooks() {
        try {
            if (this.contentStore) {
                await this.contentStore.clear();
            }
            return { success: true, message: 'All books cleared successfully' };
        } catch (error) {
            console.error('BookManagementService: Error clearing books:', error);
            throw error;
        }
    }
}

/**
 * Rulespedia Service Manager - Main service coordinator
 */
class RulespediaServiceManager {
    constructor(contentStore) {
        this.contentStore = contentStore;
        this.searchService = new SearchService(contentStore);
        this.importService = new ImportService(contentStore);
        this.bookManagementService = new BookManagementService(contentStore);
        
        // Initialize LLM and Rule Discovery services lazily
        this.llmService = null;
        this.ruleDiscoveryService = null;
        this.llmServicesInitialized = false;
        
        console.log('RulespediaServiceManager: Core services initialized');
    }

    /**
     * Initialize LLM services lazily
     */
    initializeLLMServices() {
        if (this.llmServicesInitialized) {
            return;
        }

        console.log('RulespediaServiceManager: Initializing LLM services...');
        console.log('RulespediaServiceManager: window.LLMService available:', typeof window.LLMService !== 'undefined');
        console.log('RulespediaServiceManager: window.RuleDiscoveryService available:', typeof window.RuleDiscoveryService !== 'undefined');
        console.log('RulespediaServiceManager: window.BrowserLLMProvider available:', typeof window.BrowserLLMProvider !== 'undefined');
        console.log('RulespediaServiceManager: window.LLMPrompts available:', typeof window.LLMPrompts !== 'undefined');
        
        // Check if LLM service is available
        if (typeof window.LLMService !== 'undefined') {
            try {
                console.log('RulespediaServiceManager: Creating LLM service...');
                this.llmService = new window.LLMService();
                console.log('RulespediaServiceManager: LLM service created successfully');
                
                // Check if Rule Discovery service is also available
                if (typeof window.RuleDiscoveryService !== 'undefined') {
                    console.log('RulespediaServiceManager: Creating rule discovery service...');
                    this.ruleDiscoveryService = new window.RuleDiscoveryService(this.contentStore, this.llmService);
                    console.log('RulespediaServiceManager: Rule discovery service created successfully');
                } else {
                    console.warn('RulespediaServiceManager: RuleDiscoveryService not available, rule discovery features will be disabled');
                }
                
                this.llmServicesInitialized = true;
                console.log('RulespediaServiceManager: LLM services initialized successfully');
                
            } catch (error) {
                console.warn('RulespediaServiceManager: Failed to initialize LLMService:', error.message);
                console.error('RulespediaServiceManager: Full error:', error);
                this.llmService = null;
                this.llmServicesInitialized = true; // Mark as initialized to avoid repeated attempts
            }
        } else {
            console.warn('RulespediaServiceManager: LLMService not available, LLM features will be disabled');
            console.log('RulespediaServiceManager: Available window objects:', Object.keys(window).filter(key => key.includes('LLM') || key.includes('Rule') || key.includes('Browser')));
            this.llmServicesInitialized = true; // Mark as initialized to avoid repeated attempts
        }
    }

    /**
     * Get search service
     */
    getSearchService() {
        return this.searchService;
    }

    /**
     * Get import service
     */
    getImportService() {
        return this.importService;
    }

    /**
     * Get book management service
     */
    getBookManagementService() {
        return this.bookManagementService;
    }

    /**
     * Get LLM service
     */
    getLLMService() {
        // Initialize LLM services if not already done
        this.initializeLLMServices();
        
        if (!this.llmService) {
            throw new Error('LLMService not available. LLM features are disabled. To enable AI features, ensure llm-service.js and related files are loaded.');
        }
        
        // Check if LLM service is in fallback mode
        if (this.llmService.fallbackMode) {
            console.log('RulespediaServiceManager: LLM service is in fallback mode - using keyword-based analysis');
        }
        
        return this.llmService;
    }

    /**
     * Get rule discovery service
     */
    getRuleDiscoveryService() {
        // Initialize LLM services if not already done
        this.initializeLLMServices();
        
        if (!this.ruleDiscoveryService) {
            throw new Error('RuleDiscoveryService not available. AI rule discovery features are disabled. To enable AI features, ensure rule-discovery-service.js and related files are loaded.');
        }
        return this.ruleDiscoveryService;
    }

    /**
     * Initialize services
     */
    async initialize() {
        try {
            // Initialize content store if not already done
            if (this.contentStore && !this.contentStore.isInitialized) {
                await this.contentStore.initialize();
            }
            
            // Note: LLM and Rule Discovery services will be initialized manually during import
            // This allows for better control over when the LLM model is loaded
            
            console.log('RulespediaServiceManager: Core services initialized successfully');
        } catch (error) {
            console.error('RulespediaServiceManager: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Get all service statuses
     */
    getServiceStatuses() {
        return {
            contentStore: this.contentStore ? this.contentStore.getStats() : null,
            searchService: this.searchService ? { initialized: true } : null,
            importService: this.importService ? { initialized: true } : null,
            bookManagementService: this.bookManagementService ? { initialized: true } : null,
            llmService: this.llmService ? this.llmService.getStatus() : null,
            ruleDiscoveryService: this.ruleDiscoveryService ? this.ruleDiscoveryService.getStatus() : null
        };
    }
}

// Export for use in other modules
window.SearchService = SearchService;
window.ImportService = ImportService;
window.BookManagementService = BookManagementService;
window.RulespediaServiceManager = RulespediaServiceManager; 