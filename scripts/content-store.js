/**
 * Content Store - Document and TF-IDF Storage
 * Stores text chunks and TF-IDF data for the new approach
 * Handles chunking, TF-IDF scoring, and content retrieval
 */

class ContentStore {
    constructor() {
        this.isInitialized = false;
        this.chunks = new Map();
        this.tfidfData = {
            vocabulary: new Map(),
            corpusStats: { totalChunks: 0, totalWords: 0 }
        };
    }

    /**
     * Initialize the content store
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Load existing content from storage
            await this.loadContent();
            
            this.isInitialized = true;
        } catch (error) {
            console.error('ContentStore: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load content from storage
     */
    async loadContent() {
        try {
            // Check if the setting exists first
            const settingExists = game.settings.settings.has('wodsystem.rulespedia-content');
            
            if (!settingExists) {
                this.chunks = new Map();
                this.tfidfData = {
                    vocabulary: new Map(),
                    corpusStats: { totalChunks: 0, totalWords: 0 }
                };
                return;
            }
            
            // Load from Foundry's storage system
            const storedData = game.settings.get('wodsystem', 'rulespedia-content');
            
            if (storedData && storedData.chunks) {
                this.chunks = new Map(Object.entries(storedData.chunks));
                this.tfidfData = storedData.tfidfData || {
                    vocabulary: new Map(),
                    corpusStats: { totalChunks: 0, totalWords: 0 }
                };
            } else {
                this.chunks = new Map();
                this.tfidfData = {
                    vocabulary: new Map(),
                    corpusStats: { totalChunks: 0, totalWords: 0 }
                };
            }
        } catch (error) {
            console.error('ContentStore: Error loading content:', error);
            this.chunks = new Map();
            this.tfidfData = {
                vocabulary: new Map(),
                corpusStats: { totalChunks: 0, totalWords: 0 }
            };
        }
    }

    /**
     * Save content to storage
     */
    async saveContent() {
        try {
            // Check if the setting exists first
            const settingExists = game.settings.settings.has('wodsystem.rulespedia-content');
            
            if (!settingExists) {
                return;
            }
            
            // Convert Map to object for storage
            const chunksObject = Object.fromEntries(this.chunks);
            
            // Save to Foundry's storage system
            await game.settings.set('wodsystem', 'rulespedia-content', {
                chunks: chunksObject,
                tfidfData: this.tfidfData,
                lastUpdated: Date.now(),
                version: '1.0'
            });
        } catch (error) {
            console.error('ContentStore: Error saving content:', error);
            throw error;
        }
    }

    /**
     * Add a document chunk to the content store
     * @param {string} id - Unique identifier for the document chunk
     * @param {string} content - Document content
     * @param {Object} metadata - Additional metadata (filename, chunk_count, etc.)
     */
    async addDocument(id, content, batch = false, metadata = {}) {
        try {
            // Store the document chunk with enhanced metadata
            this.chunks.set(id, {
                id,
                content,
                metadata: {
                    ...metadata,
                    timestamp: Date.now(),
                    contentLength: content.length,
                    wordCount: metadata.wordCount || content.split(/\s+/).filter(word => word.trim().length > 0).length,
                    // Ensure chunk_count is properly tracked
                    chunk_count: metadata.chunk_count || 0,
                    filename: metadata.filename || 'unknown',
                    sectionContext: metadata.sectionContext || 'unknown',
                    startWordIndex: metadata.startWordIndex || 0,
                    endWordIndex: metadata.endWordIndex || 0
                }
            });
            
            // Update corpus stats
            this.tfidfData.corpusStats.totalChunks = this.chunks.size;
            this.tfidfData.corpusStats.totalWords += metadata.wordCount || content.split(/\s+/).filter(word => word.trim().length > 0).length;
            
            // Queue for background persistence
            if (!batch) {
                await this.saveContent();
            }
            
            return true;
        } catch (error) {
            console.error('ContentStore: Error adding document:', error);
            throw error;
        }
    }

    /**
     * Get chunks for a specific file, ordered by chunk_count
     * @param {string} filename - Filename to get chunks for
     * @returns {Array} Array of chunks ordered by chunk_count
     */
    getChunksForFile(filename) {
        const fileChunks = [];
        
        for (const [id, chunk] of this.chunks) {
            if (chunk.metadata.filename === filename) {
                fileChunks.push({
                    chunk_count: chunk.metadata.chunk_count,
                    chunk: chunk.content,
                    metadata: chunk.metadata
                });
            }
        }
        
        // Sort by chunk_count to maintain order
        return fileChunks.sort((a, b) => a.chunk_count - b.chunk_count);
    }

    /**
     * Get all chunks ordered by chunk_count across all files
     * @returns {Array} Array of all chunks ordered by chunk_count
     */
    getAllChunksOrdered() {
        const allChunks = [];
        
        for (const [id, chunk] of this.chunks) {
            allChunks.push({
                chunk_count: chunk.metadata.chunk_count,
                chunk: chunk.content,
                metadata: chunk.metadata
            });
        }
        
        // Sort by chunk_count to maintain order
        return allChunks.sort((a, b) => a.chunk_count - b.chunk_count);
    }

    /**
     * Get store statistics with enhanced information
     */
    getStats() {
        const chunks = Array.from(this.chunks.values());
        const totalWords = chunks.reduce((sum, chunk) => sum + chunk.metadata.wordCount, 0);
        const avgChunkSize = chunks.length > 0 ? Math.round(totalWords / chunks.length) : 0;
        
        // Get unique files
        const uniqueFiles = new Set(chunks.map(chunk => chunk.metadata.filename));
        
        return {
            totalChunks: this.chunks.size,
            totalWords: totalWords,
            averageChunkSize: avgChunkSize,
            uniqueFiles: uniqueFiles.size,
            vocabularySize: this.tfidfData.vocabulary.size,
            isInitialized: this.isInitialized,
            files: Array.from(uniqueFiles)
        };
    }

    /**
     * Clear all content
     */
    async clear() {
        try {
            this.chunks.clear();
            this.tfidfData.vocabulary.clear();
            this.tfidfData.corpusStats = { totalChunks: 0, totalWords: 0 };
            await this.saveContent();
        } catch (error) {
            console.error('ContentStore: Error clearing content:', error);
            throw error;
        }
    }

    /**
     * Get TF-IDF data for a specific file
     * @param {string} filename - Filename to get TF-IDF data for
     * @returns {Object|null} TF-IDF data or null if not found
     */
    getTFIDFDataForFile(filename) {
        try {
            const tfidfChunkId = `${filename}_tfidf_data`;
            const tfidfChunk = this.chunks.get(tfidfChunkId);
            
            if (tfidfChunk) {
                return JSON.parse(tfidfChunk.content);
            }
            
            return null;
        } catch (error) {
            console.error('ContentStore: Error getting TF-IDF data:', error);
            return null;
        }
    }

    /**
     * Get word-chunk associations for specific words
     * @param {Array} words - Array of words to get associations for
     * @param {string} filename - Optional filename filter
     * @returns {Object} Word-chunk associations
     */
    getWordChunkAssociations(words, filename = null) {
        try {
            const associations = {};
            
            // If no specific filename, search all files
            const filesToSearch = filename ? [filename] : this.getUniqueFiles();
            
            for (const file of filesToSearch) {
                const tfidfData = this.getTFIDFDataForFile(file);
                if (tfidfData && tfidfData.wordChunkAssociations) {
                    for (const word of words) {
                        const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
                        if (tfidfData.wordChunkAssociations[normalizedWord]) {
                            if (!associations[normalizedWord]) {
                                associations[normalizedWord] = [];
                            }
                            associations[normalizedWord].push(...tfidfData.wordChunkAssociations[normalizedWord]);
                        }
                    }
                }
            }
            
            // Sort associations by TF-IDF score (highest first)
            for (const word in associations) {
                associations[word].sort((a, b) => b.tfidf_score - a.tfidf_score);
            }
            
            return associations;
        } catch (error) {
            console.error('ContentStore: Error getting word-chunk associations:', error);
            return {};
        }
    }

    /**
     * Get unique files in the content store
     * @returns {Array} Array of unique filenames
     */
    getUniqueFiles() {
        const uniqueFiles = new Set();
        
        for (const [id, chunk] of this.chunks) {
            if (chunk.metadata.filename && chunk.metadata.filename !== 'unknown') {
                uniqueFiles.add(chunk.metadata.filename);
            }
        }
        
        return Array.from(uniqueFiles);
    }

    /**
     * Get chunks by chunk IDs
     * @param {Array} chunkIds - Array of chunk IDs to retrieve
     * @returns {Array} Array of chunks ordered by chunk_count
     */
    getChunksByIds(chunkIds) {
        const chunks = [];
        
        for (const chunkId of chunkIds) {
            const chunk = this.chunks.get(chunkId);
            if (chunk) {
                chunks.push({
                    chunk_count: chunk.metadata.chunk_count,
                    chunk: chunk.content,
                    metadata: chunk.metadata
                });
            }
        }
        
        // Sort by chunk_count to maintain order
        return chunks.sort((a, b) => a.chunk_count - b.chunk_count);
    }

    /**
     * Search for chunks containing specific words with TF-IDF scoring
     * @param {Array} searchWords - Array of words to search for
     * @param {string} filename - Optional filename filter
     * @param {number} minConfidence - Minimum confidence threshold (default: 0.5)
     * @returns {Array} Array of relevant chunks with confidence scores
     */
    searchChunksByWords(searchWords, filename = null, minConfidence = 0.5) {
        try {
            const associations = this.getWordChunkAssociations(searchWords, filename);
            const chunkScores = new Map();
            
            // Aggregate scores for each chunk
            for (const word in associations) {
                for (const association of associations[word]) {
                    const chunkId = association.chunk_id;
                    const currentScore = chunkScores.get(chunkId) || 0;
                    chunkScores.set(chunkId, currentScore + association.confidence);
                }
            }
            
            // Get chunks and calculate final confidence
            const results = [];
            for (const [chunkId, totalScore] of chunkScores) {
                const confidence = Math.min(totalScore / searchWords.length, 1.0);
                
                if (confidence >= minConfidence) {
                    const chunk = this.chunks.get(chunkId);
                    if (chunk) {
                        results.push({
                            chunk_count: chunk.metadata.chunk_count,
                            chunk: chunk.content,
                            metadata: chunk.metadata,
                            confidence: confidence,
                            totalScore: totalScore,
                            matchingWords: searchWords.length
                        });
                    }
                }
            }
            
            // Sort by confidence (highest first)
            return results.sort((a, b) => b.confidence - a.confidence);
        } catch (error) {
            console.error('ContentStore: Error searching chunks by words:', error);
            return [];
        }
    }
}

// Export for use in other modules
window.ContentStore = ContentStore;
  