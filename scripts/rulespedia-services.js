/** * Rulespedia Services - Core service implementations
 * Provides search, import, and book management functionality
 */

// Debug: Check what LLM services are available when this file loads
console.log('RulespediaServices: File loading - checking for LLM services...');
console.log('RulespediaServices: window.LLMService:', typeof window.LLMService);
console.log('RulespediaServices: window.RuleDiscoveryService:', typeof window.RuleDiscoveryService);
console.log('RulespediaServices: window.BrowserLLMProvider:', typeof window.BrowserLLMProvider);
console.log('RulespediaServices: window.LLMPrompts:', typeof window.LLMPrompts);

/**
 * Rule Words Manager - Extensible system for managing RPG rule terminology
 * Supports multiple game systems and automatic game detection
 */
class RuleWordsManager {
    constructor() {
        // Game-specific rule word sets
        this.registry = {
            // Common RPG terms (always included)
            common: [
                'rule', 'dice', 'roll', 'difficulty', 'success', 'failure', 
                'check', 'test', 'mechanic', 'system', 'attack', 'damage', 'health',
                'skill', 'ability', 'attribute', 'trait', 'modifier', 'bonus', 'penalty',
                'resolution', 'target', 'threshold', 'advantage', 'disadvantage', 'critical',
                'fumble', 'resistance', 'immunity', 'vulnerability', 'initiative', 'turn',
                'action', 'reaction', 'movement', 'range', 'area', 'duration', 'concentration',
                'saving', 'throw', 'armor', 'class', 'defense', 'evasion', 'dodge', 'parry',
                'block', 'counter', 'riposte', 'feint', 'grapple', 'shove', 'trip', 'disarm',
                'overrun', 'tumble', 'charge', 'withdraw', 'retreat', 'surrender', 'morale',
                'fear', 'panic', 'rout', 'rally', 'inspire', 'leadership', 'command', 'tactics',
                'strategy', 'formation', 'flank', 'rear', 'surround', 'ambush', 'stealth',
                'concealment', 'cover', 'terrain', 'environment', 'weather', 'lighting',
                'visibility', 'obscurement', 'fog', 'smoke', 'darkness', 'blindness',
                'deafness', 'silence', 'paralysis', 'petrification', 'poison', 'disease',
                'curse', 'blessing', 'enchantment', 'magic', 'spell', 'ritual', 'incantation',
                'component', 'material', 'somatic', 'verbal', 'focus', 'cost', 'casting',
                'effect', 'save', 'resistance'
            ],
            
            // World of Darkness specific terms
            worldOfDarkness: [
                'vampire', 'werewolf', 'mage', 'changeling', 'wraith', 'mummy', 'promethean',
                'blood', 'rage', 'gnosis', 'banality', 'shadow', 'pathos', 'azoth', 'torment',
                'generation', 'clan', 'tribe', 'tradition', 'seeming', 'kith', 'lineage',
                'disciplines', 'gifts', 'spheres', 'arts', 'realms', 'arcanoi', 'refinements',
                'auspice', 'breed', 'totem', 'pack', 'caern', 'node', 'chantry', 'freehold',
                'shadowlands', 'underworld', 'pandemonium', 'high umbra', 'middle umbra',
                'low umbra', 'dreaming', 'banality', 'glamour', 'chimerical', 'banal',
                'fae', 'sidhe', 'sluagh', 'boggan', 'nocker', 'pooka', 'redcap', 'satyr',
                'troll', 'eshu', 'nunnehi', 'inanimae', 'thallain', 'adhene', 'gallain'
            ],
            
            // D&D/Pathfinder specific terms
            dndPathfinder: [
                'spell', 'magic', 'casting', 'component', 'material', 'somatic', 'verbal',
                'focus', 'ritual', 'incantation', 'class', 'race', 'level', 'experience',
                'proficiency', 'advantage', 'disadvantage', 'inspiration', 'hit points',
                'armor class', 'saving throw', 'ability score', 'skill check', 'attack roll',
                'damage roll', 'critical hit', 'critical miss', 'natural 20', 'natural 1',
                'spell slot', 'spell level', 'cantrip', 'concentration', 'spell save dc',
                'spell attack bonus', 'magic item', 'artifact', 'legendary', 'rare', 'uncommon',
                'common', 'attunement', 'charges', 'recharge', 'legendary resistance',
                'legendary action', 'lair action', 'regional effect', 'mythic', 'epic'
            ],
            
            // Generic combat terms
            combat: [
                'initiative', 'turn', 'action', 'reaction', 'movement', 'range', 'area',
                'distance', 'flank', 'cover', 'concealment', 'stealth', 'ambush', 'charge',
                'withdraw', 'retreat', 'surrender', 'morale', 'fear', 'panic', 'rout',
                'rally', 'inspire', 'leadership', 'command', 'tactics', 'strategy',
                'formation', 'flank', 'rear', 'surround', 'overrun', 'tumble', 'grapple',
                'shove', 'trip', 'disarm', 'parry', 'block', 'counter', 'riposte', 'feint'
            ]
        };
        
        // Game detection patterns
        this.detectionPatterns = {
            worldOfDarkness: [
                'vampire', 'werewolf', 'mage', 'changeling', 'wraith', 'mummy', 'promethean',
                'white wolf', 'world of darkness', 'blood', 'rage', 'gnosis', 'banality',
                'shadow', 'pathos', 'generation', 'clan', 'tribe', 'tradition', 'seeming',
                'kith', 'disciplines', 'gifts', 'spheres', 'arts', 'realms', 'arcanoi'
            ],
            dndPathfinder: [
                'dungeons', 'dragons', 'pathfinder', 'd&d', 'd20', 'spell', 'class', 'race',
                'level', 'experience', 'proficiency', 'advantage', 'disadvantage', 'hit points',
                'armor class', 'saving throw', 'ability score', 'skill check', 'attack roll',
                'damage roll', 'critical hit', 'natural 20', 'natural 1', 'spell slot'
            ]
        };
    }
    
    /**
     * Get all relevant rule words for a specific document
     * @param {string} documentText - The document text to analyze
     * @returns {Array} Array of rule-relevant words
     */
    getRuleWordsForDocument(documentText) {
        const detectedGames = this.detectGames(documentText);
        const relevantWordSets = ['common']; // Always include common
        
        // Add detected game-specific word sets
        detectedGames.forEach(game => {
            if (this.registry[game]) {
                relevantWordSets.push(game);
            }
        });
        
        // Combine all relevant word sets
        const allRuleWords = new Set();
        relevantWordSets.forEach(setName => {
            this.registry[setName].forEach(word => allRuleWords.add(word));
        });
        
        return Array.from(allRuleWords);
    }
    
    /**
     * Detect games from document content
     * @param {string} documentText - The document text to analyze
     * @returns {Array} Array of detected game names
     */
    detectGames(documentText) {
        const detectedGames = [];
        const lowerText = documentText.toLowerCase();
        
        Object.entries(this.detectionPatterns).forEach(([game, patterns]) => {
            const matchCount = patterns.filter(pattern => 
                lowerText.includes(pattern.toLowerCase())
            ).length;
            
            if (matchCount >= 2) { // Require at least 2 matches
                detectedGames.push(game);
            }
        });
        
        return detectedGames;
    }
    
    /**
     * Easy extension method - add new rule word set
     * @param {string} categoryName - Name of the category
     * @param {Array} words - Array of words for this category
     */
    addRuleWordSet(categoryName, words) {
        this.registry[categoryName] = words;
    }
    
    /**
     * Easy extension method - add new detection patterns
     * @param {string} gameName - Name of the game
     * @param {Array} patterns - Array of detection patterns
     */
    addDetectionPatterns(gameName, patterns) {
        this.detectionPatterns[gameName] = patterns;
    }
    
    /**
     * Get all available rule word categories
     * @returns {Array} Array of category names
     */
    getAvailableCategories() {
        return Object.keys(this.registry);
    }
    
    /**
     * Get rule words for a specific category
     * @param {string} categoryName - Name of the category
     * @returns {Array} Array of words for this category
     */
    getRuleWordsForCategory(categoryName) {
        return this.registry[categoryName] || [];
    }
}

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
    constructor(contentStore, serviceManager = null) {
        this.contentStore = contentStore;
        this.serviceManager = serviceManager;
        
        // Initialize the Rule Words Manager
        this.ruleWordsManager = new RuleWordsManager();
        
        // Token-based chunking configuration
        this.TARGET_CHUNK_SIZE = 2000; // words
        this.MIN_CHUNK_SIZE = 100; // words
        this.MAX_CHUNK_SIZE = 3000; // words
        this.OVERLAP_SIZE = 500; // words for context continuity
        
        // TF-IDF configuration
        this.TFIDF_THRESHOLD = 0.05; // Minimum confidence threshold for word-chunk associations
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
            progressCallback(0.05); // 5% - Starting
            
            // Load Porter Stemmer library
            try {
                await this.loadPorterStemmer();
            } catch (error) {
                console.warn('ImportService: Failed to load Porter Stemmer, using fallback normalization');
            }
            
            progressCallback(0.1); // 10% - Libraries loaded
            
            // Extract text from PDF
            const extractedText = await this.extractTextFromPDF(file, progressCallback);
            
            progressCallback(0.15); // 15% - Text extraction complete
            
            // Step 1: Pre-process text and calculate IDF
            const processedData = this.preprocessTextAndCalculateIDF(extractedText, file.name);
            
            progressCallback(0.25); // 25% - Text processing complete
            
            // Step 2: Split text into token-based chunks with progress tracking
            const chunkingProgressCallback = (chunkProgress) => {
                // Map chunking progress from 25% to 50% (25% of total progress)
                const overallProgress = 0.25 + (chunkProgress * 0.25);
                progressCallback(overallProgress);
            };
            
            const textChunks = this.splitTextIntoTokenChunks(extractedText, file.name, chunkingProgressCallback);
            
            progressCallback(0.55); // 55% - Chunking complete
            
            // Step 2.5: Validate chunk quality and filter out low-quality chunks
            const qualityChunks = this.validateChunkQuality(textChunks);
            
            if (qualityChunks.length === 0) {
                throw new Error('No quality chunks found after filtering. The PDF may not contain rule content or the extraction needs improvement.');
            }
            
            // Step 3: Get rule-relevant words using RuleWordsManager
            let ruleRelevantWords = [];
            try {
                // Use RuleWordsManager to get rule-relevant words based on document content
                ruleRelevantWords = this.ruleWordsManager.getRuleWordsForDocument(extractedText);
                
                // Get rule-relevant words from RuleWordsManager
                const ruleWordsManager = new RuleWordsManager();
                ruleRelevantWords = ruleWordsManager.getRuleWordsForDocument(extractedText);
                
                // Try to get additional words from LLM if available
                if (this.serviceManager?.getLLMService()) {
                    try {
                        const llmService = this.serviceManager.getLLMService();
                        if (llmService) {
                            const llmWords = await llmService.getRuleRelevantWords();
                            
                            // Combine and deduplicate
                            const allWords = [...ruleRelevantWords, ...llmWords];
                            ruleRelevantWords = [...new Set(allWords)];
                        }
                    } catch (error) {
                        console.warn('ImportService: LLM word generation failed, using RuleWordsManager only:', error);
                    }
                }
            } catch (error) {
                console.warn('ImportService: Failed to get rule-relevant words, using fallback:', error);
                // Fallback to basic rule words
                ruleRelevantWords = [
                    'rule', 'dice', 'roll', 'difficulty', 'success', 'failure', 'check', 'test', 'mechanic', 'system',
                    'attack', 'damage', 'health', 'skill', 'ability', 'attribute', 'trait', 'modifier', 'bonus', 'penalty'
                ];
            }
            
            progressCallback(0.6); // 60% - Rule-relevant words obtained
            
            // Step 4: Calculate TF-IDF and create word-chunk associations for rule-relevant words only
            const tfidfData = this.calculateTFIDFAndAssociations(qualityChunks, processedData.idfScores, ruleRelevantWords);
            
            progressCallback(0.65); // 65% - TF-IDF calculation complete
            
            // Log chunk statistics
            const totalWords = qualityChunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
            const avgChunkSize = Math.round(totalWords / qualityChunks.length);
            const minChunkSize = Math.min(...qualityChunks.map(c => c.wordCount));
            const maxChunkSize = Math.max(...qualityChunks.map(c => c.wordCount));
            
            // Step 5: Store in content store
            const chunkingStoringProgressCallback = (chunkProgress) => {
                // Map storing progress from 65% to 95% (30% of total progress)
                const overallProgress = 0.65 + (chunkProgress * 0.30);
                progressCallback(overallProgress);
            };
            
            await this.storeTextInContentStore(qualityChunks, file.name, tfidfData, chunkingStoringProgressCallback);
            
            progressCallback(0.95); // 95% - Storage complete
            
            // Step 6: Analyze chunks for rules (optional) - make it non-blocking
            try {
                if (typeof window.RuleDiscoveryService !== 'undefined') {
                    // Use the service manager's rule discovery service instead of creating a new instance
                    const ruleDiscoveryService = this.serviceManager?.getRuleDiscoveryService();
                    if (ruleDiscoveryService) {
                        // Make rule discovery non-blocking - don't await it
                        ruleDiscoveryService.analyzeRuleChunks(file.name).then(result => {
                            if (!result.success) {
                                console.warn('ImportService: Rule discovery analysis failed:', result.message);
                            }
                        }).catch(error => {
                            console.warn('ImportService: Rule discovery analysis failed:', error);
                        });
                    }
                }
            } catch (error) {
                console.warn('ImportService: Rule discovery analysis failed:', error);
            }
            
            progressCallback(1.0); // 100% - Complete
            
            return {
                success: true,
                filename: file.name,
                chunks: qualityChunks.length,
                totalWords: totalWords,
                associations: Object.keys(tfidfData.wordChunkAssociations).length,
                message: `Successfully imported ${file.name} with ${qualityChunks.length} chunks and ${Object.keys(tfidfData.wordChunkAssociations).length} word associations`
            };
            
        } catch (error) {
            console.error('ImportService: Import failed:', error);
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
            
            for (const item of sortedItems) {
                const text = item.str;
                const y = item.transform[5];
                
                // Skip empty text
                if (!text || text.trim() === '') continue;
                
                // Check if this is a new line (significant Y difference)
                const isNewLine = lastY === null || Math.abs(y - lastY) > 10;
                
                if (isNewLine) {
                    // Start a new line
                    if (currentLine.trim()) {
                        pageText += currentLine.trim() + '\n';
                    }
                    currentLine = text;
                } else {
                    // Same line - add the text element
                    currentLine += text;
                }
                
                // Add space after each text element unless it ends with punctuation
                if (!/[.!?,;:]$/.test(text)) {
                    currentLine += ' ';
                }
                
                lastY = y;
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
     * Clean extracted text from PDF
     * @param {string} text - Raw extracted text
     * @returns {string} Cleaned text
     */
    cleanExtractedText(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // Remove common PDF artifacts and metadata, but preserve structure
        const metadataPatterns = [
            // Page numbers and section numbers (but keep them if they're part of headings)
            /\b(?:page|p\.?)\s*\d+/gi,
            /\b(?:section|sec\.?)\s*\d+/gi,
            /\b(?:chapter|chap\.?)\s*\d+/gi,
            /\b(?:part|pt\.?)\s*\d+/gi,
            
            // Common metadata words (but be more careful)
            /\b(?:credits?|copyright|all rights reserved|published by|written by|edited by|art by|layout by)\b/gi,
            
            // Common PDF artifacts
            /\b(?:e|kstatikos|mutuality|unmutuality)\b/gi,
            
            // Single letters and very short fragments (but preserve them in context)
            /\b[a-zA-Z]\b/g,
            
            // Multiple consecutive spaces (but preserve single spaces)
            /[ \t]+/g,
            
            // Multiple consecutive newlines (but preserve single newlines)
            /\n\s*\n\s*\n+/g
        ];
        
        // Apply cleaning patterns more carefully
        metadataPatterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, ' ');
        });
        
        // Remove lines that are mostly numbers or very short, but preserve structure
        const lines = cleaned.split('\n');
        const filteredLines = lines.filter(line => {
            const trimmed = line.trim();
            if (trimmed.length === 0) return false;
            
            // Remove lines that are mostly numbers (but keep page numbers in context)
            const words = trimmed.split(/\s+/);
            const numberWords = words.filter(word => /^\d+$/.test(word));
            if (numberWords.length > words.length * 0.7) return false; // More lenient threshold
            
            // Remove very short lines (likely headers or artifacts)
            if (trimmed.length < 5 && words.length < 2) return false; // More lenient
            
            return true;
        });
        
        cleaned = filteredLines.join('\n');
        
        // Final cleanup - preserve line breaks
        cleaned = cleaned
            .replace(/[ \t]+/g, ' ') // Normalize spaces but preserve newlines
            .replace(/\n\s*\n/g, '\n\n') // Normalize multiple line breaks to double line breaks
            .trim();
        
        return cleaned;
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
     * Split text into token-based chunks with section-based grouping
     * @param {string} text - Text to split
     * @param {string} filename - Filename for chunk identification
     * @param {Function} progressCallback - Progress callback function
     * @returns {Array} Array of text chunks
     */
    splitTextIntoTokenChunks(text, filename, progressCallback = () => {}) {
        // Clean the text first
        let cleanText = this.cleanExtractedText(text);
        
        // Split into words for token-based chunking
        const words = cleanText.split(/\s+/).filter(word => word.trim().length > 0);
        
        // Get section boundaries for context preservation
        const sectionBoundaries = this.getSectionBoundaries(cleanText);
        
        const chunks = [];
        let currentChunkCount = 0;
        let startWordIndex = 0;
        
        // Track chunks by section for section-based grouping
        const sectionChunks = new Map(); // sectionTitle -> array of chunks
        
        // Estimate total chunks for progress calculation
        const estimatedTotalChunks = Math.ceil(words.length / this.TARGET_CHUNK_SIZE);
        
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
            
            // Create chunk with section-based grouping
            currentChunkCount++;
            
            // Initialize section tracking if needed
            if (!sectionChunks.has(sectionContext)) {
                sectionChunks.set(sectionContext, []);
            }
            
            // Add chunk to its section
            const sectionChunkArray = sectionChunks.get(sectionContext);
            const sectionChunkIndex = sectionChunkArray.length + 1; // 1-based index within section
            
            const chunk = {
                chunk_count: currentChunkCount, // Keep for backward compatibility
                section_id: sectionContext, // Section identifier
                section_chunk_index: sectionChunkIndex, // Position within section
                section_total_chunks: 0, // Will be updated after all chunks are created
                chunk: this.formatChunkText(sectionContext, chunkContent),
                filename: filename,
                sectionContext: sectionContext,
                wordCount: chunkContent.split(/\s+/).filter(w => w.trim().length > 0).length,
                startWordIndex: startWordIndex,
                endWordIndex: Math.min(startWordIndex + targetSize, words.length)
            };
            
            sectionChunkArray.push(chunk);
            chunks.push(chunk);
            
            // Update progress every 10 chunks or when we have a good estimate
            if (currentChunkCount % 10 === 0 || currentChunkCount === estimatedTotalChunks) {
                const chunkProgress = Math.min(currentChunkCount / estimatedTotalChunks, 1.0);
                progressCallback(chunkProgress);
            }
        }
        
        // Update section_total_chunks for all chunks
        for (const [sectionTitle, sectionChunkArray] of sectionChunks) {
            const totalChunksInSection = sectionChunkArray.length;
            for (const chunk of sectionChunkArray) {
                chunk.section_total_chunks = totalChunksInSection;
            }
        }
        
        // Final progress update
        progressCallback(1.0);
        
        return chunks;
    }

    /**
     * Get section boundaries for context preservation
     * @param {string} text - Full text
     * @returns {Array} Array of section boundary objects
     */
    getSectionBoundaries(text) {
        // First, try to detect table of contents
        const tocSections = this.detectTableOfContents(text);
        
        if (tocSections.length > 0) {
            return this.convertTOCToBoundaries(tocSections, text);
        }
        
        // Fallback to heading detection if no TOC found
        const headingBoundaries = this.detectHeadingsInText(text);
        return headingBoundaries;
    }
    
    /**
     * Convert TOC sections to word-based boundaries
     * @param {Array} tocSections - TOC sections with page numbers
     * @param {string} text - Full text
     * @returns {Array} Array of section boundary objects
     */
    convertTOCToBoundaries(tocSections, text) {
        const boundaries = [];
        const lines = text.split('\n');
        let currentWordIndex = 0;
        
        // Find page markers in the text
        const pageMarkers = this.findPageMarkers(lines);
        
        if (pageMarkers.length > 0) {
            // Use actual page markers
            for (const tocSection of tocSections) {
                // Find the page marker for this section
                const pageMarker = pageMarkers.find(marker => marker.pageNumber === tocSection.pageNumber);
                
                if (pageMarker) {
                    boundaries.push({
                        title: tocSection.title,
                        startWordIndex: pageMarker.wordIndex,
                        lineIndex: pageMarker.lineIndex,
                        pageNumber: tocSection.pageNumber
                    });
                } else {
                    console.warn(`ImportService: Could not find page ${tocSection.pageNumber} for section "${tocSection.title}"`);
                }
            }
        } else {
            // Fallback: estimate page positions based on TOC order
            const estimatedBoundaries = this.estimatePagePositions(tocSections, text);
            boundaries.push(...estimatedBoundaries);
        }
        
        return boundaries;
    }
    
    /**
     * Estimate page positions when page markers aren't available
     * @param {Array} tocSections - TOC sections with page numbers
     * @param {string} text - Full text
     * @returns {Array} Array of estimated section boundary objects
     */
    estimatePagePositions(tocSections, text) {
        const boundaries = [];
        const lines = text.split('\n');
        const totalLines = lines.length;
        
        // Sort TOC sections by page number
        const sortedSections = [...tocSections].sort((a, b) => a.pageNumber - b.pageNumber);
        
        for (let i = 0; i < sortedSections.length; i++) {
            const section = sortedSections[i];
            const nextSection = sortedSections[i + 1];
            
            // Estimate position based on page number ratio
            let estimatedLineIndex;
            if (nextSection) {
                // Estimate position between current and next page
                const pageRange = nextSection.pageNumber - section.pageNumber;
                const lineRange = totalLines;
                const estimatedRatio = (section.pageNumber - sortedSections[0].pageNumber) / (sortedSections[sortedSections.length - 1].pageNumber - sortedSections[0].pageNumber);
                estimatedLineIndex = Math.floor(estimatedRatio * lineRange);
            } else {
                // Last section - estimate near the end
                estimatedLineIndex = Math.floor(totalLines * 0.9);
            }
            
            // Calculate word index for this line
            let wordIndex = 0;
            for (let j = 0; j < estimatedLineIndex && j < lines.length; j++) {
                const wordsInLine = lines[j].split(/\s+/).filter(word => word.trim().length > 0).length;
                wordIndex += wordsInLine + 1; // +1 for newline
            }
            
            boundaries.push({
                title: section.title,
                startWordIndex: wordIndex,
                lineIndex: estimatedLineIndex,
                pageNumber: section.pageNumber,
                estimated: true
            });
        }
        
        return boundaries;
    }
    
    /**
     * Find page markers in the text
     * @param {Array} lines - Array of text lines
     * @returns {Array} Array of page marker objects
     */
    findPageMarkers(lines) {
        const pageMarkers = [];
        let currentWordIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for various page number patterns
            const pagePatterns = [
                // Just a number on its own line
                /^(\d+)$/,
                // Page X format
                /^page\s+(\d+)$/i,
                /^p\.?\s*(\d+)$/i,
                // Number with dots or dashes
                /^[.\-]*(\d+)[.\-]*$/,
                // Number at end of line
                /^.*\s+(\d+)$/,
                // Number at beginning of line
                /^(\d+)\s+.*$/,
                // Number in brackets or parentheses
                /^[\[\(](\d+)[\]\)]$/,
                /^.*[\[\(](\d+)[\]\)].*$/
            ];
            
            for (const pattern of pagePatterns) {
                const pageMatch = line.match(pattern);
                if (pageMatch) {
                    const pageNumber = parseInt(pageMatch[1]);
                    if (pageNumber >= 1 && pageNumber <= 1000) {
                        // Check if this looks like a real page marker (not part of content)
                        const isLikelyPageMarker = this.isLikelyPageMarker(line, pageNumber);
                        if (isLikelyPageMarker) {
                            pageMarkers.push({
                                pageNumber: pageNumber,
                                wordIndex: currentWordIndex,
                                lineIndex: i,
                                line: line
                            });
                            break; // Don't match multiple patterns for the same line
                        }
                    }
                }
            }
            
            // Count words in this line
            const wordsInLine = line.split(/\s+/).filter(word => word.trim().length > 0).length;
            currentWordIndex += wordsInLine + 1; // +1 for newline
        }
        
        return pageMarkers;
    }
    
    /**
     * Check if a line is likely to be a page marker
     * @param {string} line - Line to check
     * @param {number} pageNumber - Page number found
     * @returns {boolean} True if likely a page marker
     */
    isLikelyPageMarker(line, pageNumber) {
        const trimmed = line.trim();
        
        // If it's just the number, it's likely a page marker
        if (trimmed === pageNumber.toString()) {
            return true;
        }
        
        // If it's "Page X" or "p. X", it's likely a page marker
        if (/^page\s+\d+$/i.test(trimmed) || /^p\.?\s*\d+$/i.test(trimmed)) {
            return true;
        }
        
        // If it's mostly dots/dashes with a number, it's likely a page marker
        if (/^[.\-]*\d+[.\-]*$/.test(trimmed)) {
            return true;
        }
        
        // If it's a number in brackets/parentheses, it's likely a page marker
        if (/^[\[\(]\d+[\]\)]$/.test(trimmed)) {
            return true;
        }
        
        // If the line is very short and contains the page number prominently, it might be a page marker
        if (trimmed.length < 20 && trimmed.includes(pageNumber.toString())) {
            // Check if the page number is at the end or beginning
            if (trimmed.endsWith(pageNumber.toString()) || trimmed.startsWith(pageNumber.toString())) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Detect headings in text to create section boundaries
     * @param {string} text - Full text to analyze
     * @returns {Array} Array of section boundary objects
     */
    detectHeadingsInText(text) {
        const lines = text.split('\n');
        const boundaries = [];
        let currentWordIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (line.length === 0) {
                currentWordIndex += 1; // +1 for newline
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
        
        if (boundaries.length === 0) {
            console.warn('ImportService: No section boundaries found! All chunks will default to "Introduction"');
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
    async storeTextInContentStore(textChunks, filename, tfidfData, progressCallback) {
        if (!this.contentStore) {
            console.error('ImportService: Content store not available');
            throw new Error('Content store not available');
        }
        
        // Store each chunk
        for (const chunk of textChunks) {
            try {
                // Use the correct method: addDocument with metadata as fourth parameter
                const result = await this.contentStore.addDocument(
                    `${filename}_chunk_${chunk.chunk_count}`,
                    chunk.chunk,
                    true, // batch parameter - don't save after each chunk
                    {
                        filename: filename,
                        chunk_count: chunk.chunk_count,
                        sectionContext: chunk.sectionContext,
                        wordCount: chunk.wordCount,
                        startWordIndex: chunk.startWordIndex,
                        endWordIndex: chunk.endWordIndex
                    }
                );
                if (chunk.chunk_count % 10 === 0 || chunk.chunk_count === textChunks.length) {
                    const chunkProgress = Math.min(chunk.chunk_count / textChunks.length, 1.0);
                    progressCallback(chunkProgress);
                }
                
            } catch (error) {
                console.error(`ImportService: Error storing chunk ${chunk.chunk_count} from ${filename}:`, error);
                // Continue with other chunks even if one fails
            }
        }
        
        // Store TF-IDF data - make it non-blocking
        try {
            await this.contentStore.addDocument(
                `${filename}_tfidf_data`,
                JSON.stringify(tfidfData),
                true, // batch parameter - don't save immediately
                {
                    filename: filename,
                    chunk_count: 'tfidf_data',
                    sectionContext: 'TF-IDF Data',
                    wordCount: Object.keys(tfidfData.wordChunkAssociations).length,
                    startWordIndex: 0,
                    endWordIndex: Object.keys(tfidfData.wordChunkAssociations).length - 1
                }
            );
        } catch (error) {
            console.error('ImportService: Error storing TF-IDF data:', error);
            // Continue even if TF-IDF storage fails
        }
        
        // Save all data in background - don't await this
        this.contentStore.saveContent().catch(error => {
            console.error('ImportService: Error saving content to storage:', error);
        });
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
     * @param {string} line - Line to check
     * @returns {boolean} True if this is a heading
     */
    isHeading(line) {
        // Structural heading patterns for RPG rulebooks
        const headingPatterns = [
            // Chapter patterns
            /^Chapter\s+\d+/i,
            /^CHAPTER\s+\d+/,
            /^Part\s+\d+/i,
            /^PART\s+\d+/,
            
            // Section patterns
            /^Section\s+\d+/i,
            /^SECTION\s+\d+/,
            
            // Numbered headings
            /^\d+\.\s+[A-Z]/,
            /^\d+\)\s+[A-Z]/,
            
            // Headings with colons
            /^[A-Z][^:]*:$/,
            
            // Headings that are alone on a line and look important
            /^[A-Z][a-zA-Z\s]{2,20}$/,
            
            // Page headers (often in all caps)
            /^[A-Z\s]{5,}$/
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
        // Clean the text
        let cleanText = this.cleanExtractedText(text);
        
        // Tokenize and normalize words
        const words = this.tokenizeAndNormalize(cleanText);
        
        // Remove stop words
        const filteredWords = words.filter(word => !this.STOP_WORDS.has(word));
        
        // Get unique words
        const uniqueWords = new Set(filteredWords);
        
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
     * Normalize a word using Porter Stemmer library
     * @param {string} word - Word to normalize
     * @returns {string} Normalized word
     */
    normalizeWord(word) {
        // Use the actual porter-stemmer library
        if (typeof window.stemmer !== 'undefined') {
            return window.stemmer(word);
        }
        
        // Fallback to basic normalization if library not loaded
        return word.toLowerCase();
    }

    /**
     * Load Porter Stemmer library
     */
    async loadPorterStemmer() {
        if (window.stemmer) {
            return; // Already loaded
        }
        
        const stemmerUrls = [
            'https://unpkg.com/porter-stemmer@2.0.1/porter-stemmer.js',
            'https://cdn.jsdelivr.net/npm/porter-stemmer@2.0.1/porter-stemmer.js',
            'https://unpkg.com/porter-stemmer@2.0.1/src/porter-stemmer.js',
            'https://cdn.jsdelivr.net/npm/porter-stemmer@2.0.1/src/porter-stemmer.js',
            'https://cdn.jsdelivr.net/npm/compromise@14.10.0/builds/compromise.min.js'
        ];
        
        for (const url of stemmerUrls) {
            try {
                await this.loadScriptFromCDN(url);
                
                if (window.stemmer) {
                    return;
                }
                
                // For compromise.js, set up the stemmer function
                if (window.nlp && !window.stemmer) {
                    window.stemmer = function(word) {
                        return window.nlp(word).normalize().out('root');
                    };
                    return;
                }
            } catch (error) {
                continue;
            }
        }
        
        // If all CDN sources fail, implement local stemmer
        this.implementFallbackStemmer();
    }
    
    /**
     * Load script from CDN
     */
    loadScriptFromCDN(cdnUrl) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = cdnUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load from ${cdnUrl}`));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Implement a simple fallback stemmer
     */
    implementFallbackStemmer() {
        // Simple Porter Stemmer implementation for common English suffixes
        window.stemmer = function(word) {
            if (word.length < 3) return word;
            
            // Convert to lowercase
            word = word.toLowerCase();
            
            // Step 1: Remove common plural and past tense endings
            if (word.endsWith('ies')) {
                word = word.slice(0, -3) + 'y';
            } else if (word.endsWith('ied')) {
                word = word.slice(0, -3) + 'y';
            } else if (word.endsWith('ing')) {
                word = word.slice(0, -3);
            } else if (word.endsWith('ed')) {
                word = word.slice(0, -2);
            } else if (word.endsWith('s')) {
                word = word.slice(0, -1);
            }
            
            // Step 2: Remove common suffixes
            const suffixes = ['er', 'est', 'ly', 'ful', 'less', 'ness', 'ment', 'tion', 'sion', 'al', 'able', 'ible'];
            for (const suffix of suffixes) {
                if (word.endsWith(suffix) && word.length > suffix.length + 2) {
                    word = word.slice(0, -suffix.length);
                    break;
                }
            }
            
            // Step 3: Remove common prefixes
            const prefixes = ['un', 're', 'in', 'im', 'il', 'ir', 'dis', 'en', 'em'];
            for (const prefix of prefixes) {
                if (word.startsWith(prefix) && word.length > prefix.length + 2) {
                    word = word.slice(prefix.length);
                    break;
                }
            }
            
            return word;
        };
        
        console.log('ImportService: Fallback stemmer implemented');
    }

    /**
     * Calculate IDF scores for all unique words
     * @param {Array} words - All words in the corpus
     * @param {Set} uniqueWords - Set of unique words
     * @returns {Map} Map of word to IDF score
     */
    calculateIDFScores(words, uniqueWords) {
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
        
        return idfScores;
    }

    /**
     * Calculate TF-IDF scores and create word-chunk associations for rule-relevant words only
     * @param {Array} chunks - Array of text chunks
     * @param {Map} idfScores - IDF scores for all words
     * @param {Array} ruleRelevantWords - Array of rule-relevant words
     * @returns {Object} TF-IDF data and word-chunk associations
     */
    calculateTFIDFAndAssociations(chunks, idfScores, ruleRelevantWords) {
        const wordChunkAssociations = {};
        const chunkTFIDFScores = [];
        
        // === DEBUGGING: Check stemmer availability ===
        // Normalize rule-relevant words (apply stemming to match processed words)
        const normalizedRuleWords = new Set(ruleRelevantWords.map(word => this.normalizeWord(word)));
        
        // Process each chunk
        let totalChunksProcessed = 0;
        let chunksWithRuleWords = 0;
        
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
            let chunkHasRuleWords = false;
            
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
                
                // Only create associations for rule-relevant words that meet the threshold
                if (normalizedRuleWords.has(word) && tfidf >= this.TFIDF_THRESHOLD) {
                    if (!wordChunkAssociations[word]) {
                        wordChunkAssociations[word] = [];
                    }
                    
                    wordChunkAssociations[word].push({
                        chunk_count: chunk.chunk_count,
                        chunk_id: `${chunk.filename}_chunk_${chunk.chunk_count}`,
                        section_id: chunk.section_id,
                        section_chunk_index: chunk.section_chunk_index,
                        section_total_chunks: chunk.section_total_chunks,
                        tfidf_score: tfidf,
                        confidence: Math.min(tfidf, 1.0), // Normalize to 0-1
                        sectionContext: chunk.sectionContext
                    });
                    
                    chunkHasRuleWords = true;
                }
            }
            
            if (chunkHasRuleWords) {
                chunksWithRuleWords++;
            }
            
            chunkTFIDFScores.push({
                chunk_count: chunk.chunk_count,
                scores: chunkScores
            });
            
            totalChunksProcessed++;
        }
        
        // Sort word-chunk associations by TF-IDF score (highest first)
        for (const word in wordChunkAssociations) {
            wordChunkAssociations[word].sort((a, b) => b.tfidf_score - a.tfidf_score);
        }
        
        return {
            wordChunkAssociations: wordChunkAssociations,
            chunkTFIDFScores: chunkTFIDFScores,
            idfScores: Object.fromEntries(idfScores),
            ruleRelevantWords: ruleRelevantWords
        };
    }

    /**
     * Validate chunk quality and filter out low-quality chunks
     * @param {Array} chunks - Array of text chunks
     * @returns {Array} Filtered array of quality chunks
     */
    validateChunkQuality(chunks) {
        const qualityChunks = [];
        let filteredCount = 0;
        
        for (const chunk of chunks) {
            const words = chunk.chunk.split(/\s+/).filter(word => word.trim().length > 0);
            
            // Skip chunks with too few words
            if (words.length < 50) {
                filteredCount++;
                continue;
            }
            
            // Calculate meaningful word ratio (words longer than 2 characters)
            const meaningfulWords = words.filter(word => word.length > 2);
            const meaningfulRatio = meaningfulWords.length / words.length;
            
            // Skip chunks with low meaningful word ratio
            if (meaningfulRatio < 0.3) {
                filteredCount++;
                continue;
            }
            
            // Check for rule-relevant words in the chunk
            const chunkLower = chunk.chunk.toLowerCase();
            const hasRuleWords = this.ruleWordsManager.registry.common.some(word => 
                chunkLower.includes(word.toLowerCase())
            );
            
            // Skip chunks that don't contain any rule-relevant words
            if (!hasRuleWords) {
                filteredCount++;
                continue;
            }
            
            qualityChunks.push(chunk);
        }
        
        return qualityChunks;
    }

    /**
     * Find related chunks within the same section
     * @param {string} filename - Filename to search in
     * @param {string} sectionId - Section identifier
     * @param {number} currentChunkIndex - Current chunk's section index
     * @param {number} maxDistance - Maximum distance to search (default: 3)
     * @returns {Array} Array of related chunks
     */
    findRelatedChunksInSection(filename, sectionId, currentChunkIndex, maxDistance = 3) {
        try {
            if (!this.contentStore) {
                return [];
            }

            const chunks = this.contentStore.getChunksForFile(filename);
            const relatedChunks = [];

            for (const chunk of chunks) {
                // Check if chunk is in the same section
                if (chunk.section_id === sectionId) {
                    const distance = Math.abs(chunk.section_chunk_index - currentChunkIndex);
                    
                    // Include chunks within the specified distance
                    if (distance <= maxDistance && distance > 0) {
                        relatedChunks.push({
                            ...chunk,
                            distance: distance,
                            is_adjacent: distance === 1
                        });
                    }
                }
            }

            // Sort by distance (closest first)
            relatedChunks.sort((a, b) => a.distance - b.distance);

            return relatedChunks;
        } catch (error) {
            console.error('ImportService: Error finding related chunks:', error);
            return [];
        }
    }

    /**
     * Find all chunks in a specific section
     * @param {string} filename - Filename to search in
     * @param {string} sectionId - Section identifier
     * @returns {Array} Array of chunks in the section, ordered by section_chunk_index
     */
    findChunksInSection(filename, sectionId) {
        try {
            if (!this.contentStore) {
                return [];
            }

            const chunks = this.contentStore.getChunksForFile(filename);
            const sectionChunks = chunks
                .filter(chunk => chunk.section_id === sectionId)
                .sort((a, b) => a.section_chunk_index - b.section_chunk_index);

            return sectionChunks;
        } catch (error) {
            console.error('ImportService: Error finding chunks in section:', error);
            return [];
        }
    }

    /**
     * Get section statistics for a file
     * @param {string} filename - Filename to analyze
     * @returns {Object} Section statistics
     */
    getSectionStatistics(filename) {
        try {
            if (!this.contentStore) {
                return { sections: [], totalChunks: 0 };
            }

            const chunks = this.contentStore.getChunksForFile(filename);
            const sectionStats = new Map();

            for (const chunk of chunks) {
                const sectionId = chunk.section_id || 'Unknown';
                
                if (!sectionStats.has(sectionId)) {
                    sectionStats.set(sectionId, {
                        section_id: sectionId,
                        chunk_count: 0,
                        total_words: 0,
                        first_chunk: chunk.chunk_count,
                        last_chunk: chunk.chunk_count
                    });
                }

                const stats = sectionStats.get(sectionId);
                stats.chunk_count++;
                stats.total_words += chunk.wordCount || 0;
                stats.last_chunk = chunk.chunk_count;
            }

            const sections = Array.from(sectionStats.values())
                .sort((a, b) => a.first_chunk - b.first_chunk);

            return {
                sections: sections,
                totalChunks: chunks.length,
                totalSections: sections.length
            };
        } catch (error) {
            console.error('ImportService: Error getting section statistics:', error);
            return { sections: [], totalChunks: 0 };
        }
    }

    /**
     * Detect and parse table of contents to create section boundaries
     * @param {string} text - Full text to analyze
     * @returns {Array} Array of section boundary objects with page numbers
     */
    detectTableOfContents(text) {
        const lines = text.split('\n');
        const tocSections = [];
        let inTOC = false;
        let tocStartLine = -1;
        let tocEndLine = -1;
        
        // Find TOC boundaries
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for TOC start patterns
            if (!inTOC && this.isTOCStart(line)) {
                inTOC = true;
                tocStartLine = i;
                continue;
            }
            
            // Look for TOC end patterns
            if (inTOC && this.isTOCEnd(line)) {
                tocEndLine = i;
                    break;
                }
            }
            
        if (tocStartLine === -1) {
            return [];
        }
        
        if (tocEndLine === -1) {
            tocEndLine = lines.length; // TOC goes to end of document
        }
        
        return tocSections;
    }
    
    /**
     * Check if a line indicates the start of table of contents
     * @param {string} line - Line to check
     * @returns {boolean} True if this is TOC start
     */
    isTOCStart(line) {
        const tocStartPatterns = [
            /^table\s+of\s+contents/i,
            /^contents/i,
            /^table\s+des\s+matières/i,
            /^inhaltsverzeichnis/i,
            /^indice/i,
            /^índice/i,
            /^目录/i,
            /^目次/i
        ];
        
        return tocStartPatterns.some(pattern => pattern.test(line));
    }
    
    /**
     * Check if a line indicates the end of table of contents
     * @param {string} line - Line to check
     * @returns {boolean} True if this is TOC end
     */
    isTOCEnd(line) {
        const tocEndPatterns = [
            /^chapter\s+\d+/i,
            /^part\s+\d+/i,
            /^section\s+\d+/i,
            /^introduction/i,
            /^preface/i,
            /^foreword/i,
            /^acknowledgments/i,
            /^about\s+the\s+author/i
        ];
        
        return tocEndPatterns.some(pattern => pattern.test(line));
    }
    
    /**
     * Parse a single TOC entry line
     * @param {string} line - TOC line to parse
     * @returns {Object|null} Parsed TOC entry or null if not a valid entry
     */
    parseTOCEntry(line) {
        // Common TOC patterns
        const tocPatterns = [
            // "Chapter 1: Introduction ................ 15"
            /^(.+?)\s*[.\s]*(\d+)$/,
            // "Chapter 1: Introduction 15"
            /^(.+?)\s+(\d+)$/,
            // "Introduction ................ 15"
            /^(.+?)\s*[.\s]*(\d+)$/,
            // "1. Introduction 15"
            /^\d+\.\s*(.+?)\s+(\d+)$/,
            // "1) Introduction 15"
            /^\d+\)\s*(.+?)\s+(\d+)$/
        ];
        
        for (const pattern of tocPatterns) {
            const match = line.match(pattern);
            if (match) {
                const title = match[1].trim();
                const pageNumber = parseInt(match[2]);
                
                // Skip if title is too short or page number is invalid
                if (title.length < 3 || pageNumber < 1 || pageNumber > 1000) {
                    continue;
                }
                
                return {
                    title: title,
                    pageNumber: pageNumber,
                    line: line
                };
            }
        }
        
        return null;
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

    /**
     * Get section statistics for all books
     * @returns {Object} Section statistics for all books
     */
    async getSectionStatistics() {
        try {
            if (!this.contentStore) {
                return { books: {} };
            }

            const files = this.contentStore.getUniqueFiles();
            const bookStats = {};

            for (const filename of files) {
                const importService = new ImportService(this.contentStore);
                bookStats[filename] = importService.getSectionStatistics(filename);
            }

            return { books: bookStats };
        } catch (error) {
            console.error('BookManagementService: Error getting section statistics:', error);
            throw error;
        }
    }

    /**
     * Find related chunks within the same section
     * @param {string} filename - Filename to search in
     * @param {string} sectionId - Section identifier
     * @param {number} currentChunkIndex - Current chunk's section index
     * @param {number} maxDistance - Maximum distance to search
     * @returns {Array} Array of related chunks
     */
    async findRelatedChunksInSection(filename, sectionId, currentChunkIndex, maxDistance = 3) {
        try {
            if (!this.contentStore) {
                return [];
            }

            const importService = new ImportService(this.contentStore);
            return importService.findRelatedChunksInSection(filename, sectionId, currentChunkIndex, maxDistance);
        } catch (error) {
            console.error('BookManagementService: Error finding related chunks:', error);
            throw error;
        }
    }

    /**
     * Find all chunks in a specific section
     * @param {string} filename - Filename to search in
     * @param {string} sectionId - Section identifier
     * @returns {Array} Array of chunks in the section
     */
    async findChunksInSection(filename, sectionId) {
        try {
            if (!this.contentStore) {
                return [];
            }

            const importService = new ImportService(this.contentStore);
            return importService.findChunksInSection(filename, sectionId);
        } catch (error) {
            console.error('BookManagementService: Error finding chunks in section:', error);
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
        this.importService = new ImportService(contentStore, this);
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

        // Check if LLM service is available
        if (typeof window.LLMService !== 'undefined') {
            try {
                this.llmService = new window.LLMService();
                
                // Try to set up a provider - check for available providers
                let provider = null;
                
                // Check for TensorFlow LLM provider
                if (typeof window.TensorFlowLLMProvider !== 'undefined') {
                    try {
                        provider = new window.TensorFlowLLMProvider();
                    } catch (error) {
                        console.warn('RulespediaServiceManager: Failed to create TensorFlowLLMProvider:', error.message);
                    }
                }
                
                // Check for Browser LLM provider as fallback
                if (!provider && typeof window.BrowserLLMProvider !== 'undefined') {
                    try {
                        provider = new window.BrowserLLMProvider();
                    } catch (error) {
                        console.warn('RulespediaServiceManager: Failed to create BrowserLLMProvider:', error.message);
                    }
                }
                
                // Set the provider if we found one
                if (provider) {
                    this.llmService.setProvider(provider);
                    // Initialize the service
                    this.llmService.initialize().catch(error => {
                        console.warn('RulespediaServiceManager: LLM service initialization failed:', error.message);
                    });
                } else {
                    console.warn('RulespediaServiceManager: No LLM provider available, LLM features will be disabled');
                }
                
                // Check if Rule Discovery service is also available
                if (typeof window.RuleDiscoveryService !== 'undefined') {
                    this.ruleDiscoveryService = new window.RuleDiscoveryService(this.contentStore, this.llmService);
                } else {
                    console.warn('RulespediaServiceManager: RuleDiscoveryService not available, rule discovery features will be disabled');
                }
                
                this.llmServicesInitialized = true;
                
            } catch (error) {
                console.warn('RulespediaServiceManager: Failed to initialize LLMService:', error.message);
                this.llmService = null;
                this.llmServicesInitialized = true; // Mark as initialized to avoid repeated attempts
            }
        } else {
            console.warn('RulespediaServiceManager: LLMService not available, LLM features will be disabled');
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
            console.warn('RulespediaServiceManager: LLMService not available. LLM features are disabled. To enable AI features, ensure llm-service.js and related files are loaded.');
            return null;
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
            console.warn('RulespediaServiceManager: RuleDiscoveryService not available. AI rule discovery features are disabled. To enable AI features, ensure rule-discovery-service.js and related files are loaded.');
            return null;
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

/**
 * Book Management Service - Handles book management operations
 */
class BookManagementService {
    constructor(contentStore) {
        this.contentStore = contentStore;
    }

    /**
     * Get book statistics
     * @returns {Object} Book statistics
     */
    async getBookStats() {
        try {
            if (!this.contentStore) {
                return { books: [], totalChunks: 0, totalFiles: 0 };
            }

            const files = this.contentStore.getUniqueFiles();
            const bookStats = [];

            for (const filename of files) {
                const chunks = this.contentStore.getChunksForFile(filename);
                const totalWords = chunks.reduce((sum, chunk) => sum + (chunk.wordCount || 0), 0);
                
                bookStats.push({
                    filename: filename,
                    chunks: chunks.length,
                    totalWords: totalWords,
                    importedAt: chunks[0]?.importedAt || new Date().toISOString()
                });
            }

            const totalChunks = bookStats.reduce((sum, book) => sum + book.chunks, 0);
            const totalWords = bookStats.reduce((sum, book) => sum + book.totalWords, 0);

            return {
                books: bookStats,
                totalChunks: totalChunks,
                totalFiles: files.length,
                totalWords: totalWords
            };
        } catch (error) {
            console.error('BookManagementService: Error getting book stats:', error);
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

    /**
     * Get section statistics for all books
     * @returns {Object} Section statistics for all books
     */
    async getSectionStatistics() {
        try {
            if (!this.contentStore) {
                return { books: {} };
            }

            const files = this.contentStore.getUniqueFiles();
            const bookStats = {};

            for (const filename of files) {
                const importService = new ImportService(this.contentStore);
                bookStats[filename] = importService.getSectionStatistics(filename);
            }

            return { books: bookStats };
        } catch (error) {
            console.error('BookManagementService: Error getting section statistics:', error);
            throw error;
        }
    }

    /**
     * Find related chunks within the same section
     * @param {string} filename - Filename to search in
     * @param {string} sectionId - Section identifier
     * @param {number} currentChunkIndex - Current chunk's section index
     * @param {number} maxDistance - Maximum distance to search
     * @returns {Array} Array of related chunks
     */
    async findRelatedChunksInSection(filename, sectionId, currentChunkIndex, maxDistance = 3) {
        try {
            if (!this.contentStore) {
                return [];
            }

            const importService = new ImportService(this.contentStore);
            return importService.findRelatedChunksInSection(filename, sectionId, currentChunkIndex, maxDistance);
        } catch (error) {
            console.error('BookManagementService: Error finding related chunks:', error);
            throw error;
        }
    }

    /**
     * Find all chunks in a specific section
     * @param {string} filename - Filename to search in
     * @param {string} sectionId - Section identifier
     * @returns {Array} Array of chunks in the section
     */
    async findChunksInSection(filename, sectionId) {
        try {
            if (!this.contentStore) {
                return [];
            }

            const importService = new ImportService(this.contentStore);
            return importService.findChunksInSection(filename, sectionId);
        } catch (error) {
            console.error('BookManagementService: Error finding chunks in section:', error);
            throw error;
        }
    }
}

// Export for use in other modules
try {
    if (typeof window !== 'undefined') {
        // Export to namespace
        window.RulespediaServices = {
            SearchService,
            ImportService,
            BookManagementService,
            RulespediaServiceManager,
            RuleWordsManager
        };
        
        // Also export individual classes for direct access
        window.SearchService = SearchService;
        window.ImportService = ImportService;
        window.BookManagementService = BookManagementService;
        window.RulespediaServiceManager = RulespediaServiceManager;
        window.RuleWordsManager = RuleWordsManager;
        
        console.log('RulespediaServices: All services exported to window.RulespediaServices and individual window properties');
    }
} catch (error) {
    console.error('RulespediaServices: Failed to export to window:', error);
    // Try to export individual services even if some fail
    try {
        if (typeof window !== 'undefined') {
            window.RulespediaServices = {};
            
            if (typeof SearchService !== 'undefined') {
                window.RulespediaServices.SearchService = SearchService;
                window.SearchService = SearchService;
            }
            if (typeof ImportService !== 'undefined') {
                window.RulespediaServices.ImportService = ImportService;
                window.ImportService = ImportService;
            }
            if (typeof BookManagementService !== 'undefined') {
                window.RulespediaServices.BookManagementService = BookManagementService;
                window.BookManagementService = BookManagementService;
            }
            if (typeof RulespediaServiceManager !== 'undefined') {
                window.RulespediaServices.RulespediaServiceManager = RulespediaServiceManager;
                window.RulespediaServiceManager = RulespediaServiceManager;
            }
            if (typeof RuleWordsManager !== 'undefined') {
                window.RulespediaServices.RuleWordsManager = RuleWordsManager;
                window.RuleWordsManager = RuleWordsManager;
            }
            
            console.log('RulespediaServices: Partial services exported to window.RulespediaServices and individual window properties');
        }
    } catch (partialError) {
        console.error('RulespediaServices: Failed to export even partial services:', partialError);
    }
} 
