/**
 * Vector Database Manager
 * Handles vector storage and similarity search for rulebook content
 */

class VectorDatabaseManager {
    constructor() {
        this.vectors = new Map();
        this.embeddingModel = null;
        this.isInitialized = false;
        this.pendingSaves = new Set();
        this.saveQueue = [];
        this.isSaving = false;
        this.saveDebounceTimer = null;
        this.saveDebounceDelay = 1000; // 1 second debounce
    }

    /**
     * Initialize the vector database
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Initialize embedding model
            await this.initializeEmbeddingModel();
            
            // Load existing vectors from storage
            await this.loadVectors();
            
            // Set up cleanup on page unload
            this.setupCleanup();
            
            this.isInitialized = true;
            console.log('VectorDatabaseManager: Initialized with write-through persistence');
        } catch (error) {
            console.error('VectorDatabaseManager: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize the embedding model
     */
    async initializeEmbeddingModel() {
        try {
            // Use the new TF-IDF model instead of the simple one
            this.embeddingModel = new TFIDFEmbeddingModel();
            await this.embeddingModel.initialize();
            
            // If we have existing vectors, train the model on them
            if (this.vectors.size > 0) {
                console.log('VectorDatabaseManager: Training TF-IDF model on existing documents...');
                await this.trainModelOnExistingDocuments();
            }
            
            console.log('VectorDatabaseManager: Embedding model initialized');
        } catch (error) {
            console.error('VectorDatabaseManager: Error initializing embedding model:', error);
            throw error;
        }
    }

    /**
     * Train the TF-IDF model on existing documents
     */
    async trainModelOnExistingDocuments() {
        try {
            // First pass: build vocabulary and document frequencies
            for (const [id, document] of this.vectors) {
                this.embeddingModel.updateVocabulary(document.content);
            }
            
            // Calculate IDF scores
            this.embeddingModel.calculateIDF();
            
            console.log(`VectorDatabaseManager: Trained model on ${this.vectors.size} documents with ${this.embeddingModel.vocabulary.size} unique words`);
        } catch (error) {
            console.error('VectorDatabaseManager: Error training model:', error);
        }
    }

    /**
     * Load vectors from storage
     */
    async loadVectors() {
        try {
            // Check if the setting exists first
            const settingExists = game.settings.settings.has('wodsystem.rulespedia-vectors');
            
            if (!settingExists) {
                console.log('VectorDatabaseManager: Setting not yet registered, starting with empty database');
                this.vectors = new Map();
                return;
            }
            
            // Load from Foundry's storage system
            const storedData = game.settings.get('wodsystem', 'rulespedia-vectors');
            
            if (storedData && storedData.vectors) {
                this.vectors = new Map(Object.entries(storedData.vectors));
                console.log(`VectorDatabaseManager: Loaded ${this.vectors.size} documents from storage`);
                
                // Check for vector length consistency
                await this.validateAndFixVectorConsistency();
                
                // Train the TF-IDF model on existing documents if needed
                if (this.embeddingModel instanceof TFIDFEmbeddingModel && this.embeddingModel.vocabulary.size === 0) {
                    console.log('VectorDatabaseManager: Training TF-IDF model on loaded documents...');
                    await this.trainModelOnExistingDocuments();
                }
            } else {
                this.vectors = new Map();
                console.log('VectorDatabaseManager: No stored vectors found, starting fresh');
            }
        } catch (error) {
            console.error('VectorDatabaseManager: Error loading vectors:', error);
            // Start with empty map if loading fails
            this.vectors = new Map();
        }
    }
    
    /**
     * Validate and fix vector consistency issues
     */
    async validateAndFixVectorConsistency() {
        if (this.vectors.size === 0) return;
        
        const expectedLength = this.embeddingModel instanceof TFIDFEmbeddingModel ? 512 : 128;
        let inconsistentVectors = 0;
        
        // Check for inconsistent vector lengths
        for (const [id, document] of this.vectors) {
            if (!document.embedding || document.embedding.length !== expectedLength) {
                inconsistentVectors++;
            }
        }
        
        if (inconsistentVectors > 0) {
            console.warn(`VectorDatabaseManager: Found ${inconsistentVectors} documents with inconsistent vector lengths. This usually happens when upgrading from the old system.`);
            console.warn('VectorDatabaseManager: Consider clearing the database and re-importing documents for best results.');
            
            // Optionally, we could automatically clear inconsistent vectors
            // For now, we'll just warn the user
        }
    }

    /**
     * Add a document to the vector database (write-through)
     * @param {string} id - Unique identifier for the document
     * @param {string} content - Document content
     * @param {Object} metadata - Additional metadata
     */
    async addDocument(id, content, metadata = {}) {
        try {
            if (!this.embeddingModel) {
                throw new Error('Embedding model not initialized');
            }

            // Train the model on this new document
            if (this.embeddingModel instanceof TFIDFEmbeddingModel) {
                this.embeddingModel.updateVocabulary(content);
            }

            // Generate embedding for the content
            const embedding = await this.embeddingModel.embed(content);
            
            // Store the document with its embedding in memory (immediate)
            this.vectors.set(id, {
                id,
                content,
                embedding,
                metadata,
                timestamp: Date.now()
            });

            // Queue for background persistence (non-blocking)
            this.queueForPersistence(id);
            
            return true;
        } catch (error) {
            console.error('VectorDatabaseManager: Error adding document:', error);
            throw error;
        }
    }

    /**
     * Queue a document for background persistence
     * @param {string} id - Document ID to queue
     */
    queueForPersistence(id) {
        this.pendingSaves.add(id);
        
        // Clear existing debounce timer
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        
        // Set new debounce timer
        this.saveDebounceTimer = setTimeout(() => {
            this.performBackgroundSave();
        }, this.saveDebounceDelay);
    }

    /**
     * Perform background save of pending documents
     */
    async performBackgroundSave() {
        if (this.isSaving || this.pendingSaves.size === 0) {
            return;
        }

        this.isSaving = true;
        
        try {
            // Check if the setting exists first
            const settingExists = game.settings.settings.has('wodsystem.rulespedia-vectors');
            
            if (!settingExists) {
                console.log('VectorDatabaseManager: Setting not yet registered, skipping save');
                this.pendingSaves.clear();
                return;
            }
            
            // Get all pending documents
            const documentsToSave = {};
            for (const id of this.pendingSaves) {
                const document = this.vectors.get(id);
                if (document) {
                    documentsToSave[id] = document;
                }
            }

            // Convert to storage format
            const vectorsObject = Object.fromEntries(this.vectors);
            
            // Save to Foundry's storage system
            await game.settings.set('wodsystem', 'rulespedia-vectors', {
                vectors: vectorsObject,
                lastUpdated: Date.now(),
                version: '1.0'
            });
            
            // Clear pending saves
            this.pendingSaves.clear();
            
            console.log(`VectorDatabaseManager: Background save completed - ${Object.keys(documentsToSave).length} documents persisted`);
            
        } catch (error) {
            console.error('VectorDatabaseManager: Background save failed:', error);
            // Don't clear pending saves on error - they'll be retried
        } finally {
            this.isSaving = false;
            
            // If there are still pending saves, schedule another save
            if (this.pendingSaves.size > 0) {
                setTimeout(() => {
                    this.performBackgroundSave();
                }, this.saveDebounceDelay);
            }
        }
    }

    /**
     * Force immediate save of all pending documents
     */
    async forceSave() {
        if (this.pendingSaves.size > 0) {
            console.log(`VectorDatabaseManager: Force saving ${this.pendingSaves.size} pending documents`);
            await this.performBackgroundSave();
        }
    }

    /**
     * Search for similar documents with hybrid approach
     * @param {string} query - Search query
     * @param {number} limit - Maximum number of results
     * @param {number} threshold - Similarity threshold
     */
    async search(query, limit = 5, threshold = 0.7) {
        try {
            if (!this.embeddingModel) {
                throw new Error('Embedding model not initialized');
            }

            // Generate embedding for the query
            const queryEmbedding = await this.embeddingModel.embed(query);
            const queryVectorLength = queryEmbedding.length;
            
            // Extract keywords from query for hybrid search
            const queryKeywords = this.extractKeywords(query);
            
            // Calculate similarities with hybrid scoring
            const similarities = [];
            
            for (const [id, document] of this.vectors) {
                // Check if document embedding has the same length as query embedding
                if (!document.embedding || document.embedding.length !== queryVectorLength) {
                    console.warn(`VectorDatabaseManager: Skipping document ${id} - vector length mismatch (expected ${queryVectorLength}, got ${document.embedding ? document.embedding.length : 'undefined'})`);
                    continue;
                }
                
                // Semantic similarity (TF-IDF based)
                const semanticSimilarity = this.calculateCosineSimilarity(queryEmbedding, document.embedding);
                
                // Keyword matching score
                const keywordScore = this.calculateKeywordScore(queryKeywords, document.content);
                
                // Hybrid score: combine semantic and keyword matching
                const hybridScore = (semanticSimilarity * 0.7) + (keywordScore * 0.3);
                
                if (hybridScore >= threshold) {
                    similarities.push({
                        id,
                        document,
                        semanticSimilarity,
                        keywordScore,
                        similarity: hybridScore
                    });
                }
            }
            
            // Sort by hybrid similarity (highest first)
            similarities.sort((a, b) => b.similarity - a.similarity);
            
            // Return top results
            return similarities.slice(0, limit);
        } catch (error) {
            console.error('VectorDatabaseManager: Error searching:', error);
            throw error;
        }
    }
    
    /**
     * Extract important keywords from query
     */
    extractKeywords(query) {
        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(' ')
            .filter(word => word.length > 2)
            .filter(word => !this.isStopWord(word));
        
        return [...new Set(words)]; // Remove duplicates
    }
    
    /**
     * Check if a word is a stop word (common words to ignore)
     */
    isStopWord(word) {
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'
        ]);
        return stopWords.has(word);
    }
    
    /**
     * Calculate keyword matching score
     */
    calculateKeywordScore(queryKeywords, documentContent) {
        if (queryKeywords.length === 0) return 0;
        
        const docWords = documentContent.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(' ')
            .filter(word => word.length > 2);
        
        const docWordSet = new Set(docWords);
        let matches = 0;
        
        queryKeywords.forEach(keyword => {
            if (docWordSet.has(keyword)) {
                matches++;
            }
        });
        
        return matches / queryKeywords.length; // Normalize by number of keywords
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} vectorA - First vector
     * @param {Array} vectorB - Second vector
     */
    calculateCosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Get a document by ID
     * @param {string} id - Document ID
     */
    getDocument(id) {
        return this.vectors.get(id);
    }

    /**
     * Remove a document from the database (write-through)
     * @param {string} id - Document ID
     */
    async removeDocument(id) {
        try {
            const removed = this.vectors.delete(id);
            
            if (removed) {
                // Remove from pending saves if it was queued
                this.pendingSaves.delete(id);
                
                // Queue a background save to persist the removal
                this.queueForPersistence('__removal__' + Date.now());
            }
            
            return removed;
        } catch (error) {
            console.error('VectorDatabaseManager: Error removing document:', error);
            throw error;
        }
    }

    /**
     * Clear all documents from the database and reset the model (write-through)
     */
    async clear() {
        try {
            console.log('VectorDatabaseManager: Starting complete database clear...');
            
            // Clear all vectors from memory
            this.vectors.clear();
            this.pendingSaves.clear();
            
            // Reset the TF-IDF model if it exists
            if (this.embeddingModel instanceof TFIDFEmbeddingModel) {
                this.embeddingModel.vocabulary.clear();
                this.embeddingModel.idfScores.clear();
                this.embeddingModel.totalDocuments = 0;
                this.embeddingModel.wordIndex = 0;
                console.log('VectorDatabaseManager: TF-IDF model vocabulary cleared');
            }
            
            // Clear the stored data from Foundry's settings
            const settingExists = game.settings.settings.has('wodsystem.rulespedia-vectors');
            if (settingExists) {
                await game.settings.set('wodsystem', 'rulespedia-vectors', null);
                console.log('VectorDatabaseManager: Stored settings cleared');
            }
            
            // Force a save to persist the empty state
            await this.forceSave();
            
            console.log('VectorDatabaseManager: Database completely cleared and reset');
            
            // Verify the clear worked
            const verifyData = game.settings.get('wodsystem', 'rulespedia-vectors');
            if (verifyData === null || verifyData === undefined) {
                console.log('VectorDatabaseManager: Clear verification successful - no stored data found');
            } else {
                console.warn('VectorDatabaseManager: Clear verification failed - data still exists');
            }
            
        } catch (error) {
            console.error('VectorDatabaseManager: Error clearing database:', error);
            throw error;
        }
    }

    /**
     * Get database statistics including persistence info
     */
    getStats() {
        return {
            totalDocuments: this.vectors.size,
            pendingSaves: this.pendingSaves.size,
            isSaving: this.isSaving,
            isInitialized: this.isInitialized,
            hasEmbeddingModel: !!this.embeddingModel
        };
    }

    /**
     * Save vectors to persistent storage
     */
    async saveVectors() {
        try {
            // Check if the setting exists first
            const settingExists = game.settings.settings.has('wodsystem.rulespedia-vectors');
            
            if (!settingExists) {
                console.log('VectorDatabaseManager: Setting not yet registered, skipping save');
                return;
            }
            
            // Convert Map to object for storage
            const vectorsObject = Object.fromEntries(this.vectors);
            
            // Save to Foundry's storage system
            await game.settings.set('wodsystem', 'rulespedia-vectors', {
                vectors: vectorsObject,
                lastUpdated: Date.now(),
                version: '1.0'
            });
            
            console.log(`VectorDatabaseManager: Saved ${this.vectors.size} documents to storage`);
        } catch (error) {
            console.error('VectorDatabaseManager: Error saving vectors:', error);
            throw error;
        }
    }

    /**
     * Set up cleanup handlers for page unload
     */
    setupCleanup() {
        // Force save on page unload
        window.addEventListener('beforeunload', () => {
            if (this.pendingSaves.size > 0) {
                console.log(`VectorDatabaseManager: Force saving ${this.pendingSaves.size} documents before unload`);
                this.forceSave();
            }
        });

        // Also save when Foundry is shutting down
        Hooks.on('closeApplication', () => {
            if (this.pendingSaves.size > 0) {
                console.log(`VectorDatabaseManager: Force saving ${this.pendingSaves.size} documents on Foundry close`);
                this.forceSave();
            }
        });
    }

    /**
     * Debug method to inspect database contents
     */
    debugDatabase() {
        console.log('=== VECTOR DATABASE DEBUG ===');
        console.log(`Total documents: ${this.vectors.size}`);
        console.log(`Embedding model: ${this.embeddingModel ? this.embeddingModel.constructor.name : 'None'}`);
        console.log(`Expected vector length: ${this.embeddingModel instanceof TFIDFEmbeddingModel ? 512 : 128}`);
        
        if (this.embeddingModel instanceof TFIDFEmbeddingModel) {
            console.log(`TF-IDF vocabulary size: ${this.embeddingModel.vocabulary.size}`);
            console.log(`TF-IDF total documents: ${this.embeddingModel.totalDocuments}`);
        }
        
        console.log('\n=== DOCUMENT SAMPLES ===');
        let count = 0;
        for (const [id, document] of this.vectors) {
            if (count >= 5) break; // Show first 5 documents
            
            console.log(`\nDocument ${count + 1}:`);
            console.log(`  ID: ${id}`);
            console.log(`  Filename: ${document.metadata?.filename || 'Unknown'}`);
            console.log(`  Vector length: ${document.embedding ? document.embedding.length : 'None'}`);
            console.log(`  Content preview: ${document.content.substring(0, 100)}...`);
            console.log(`  Timestamp: ${new Date(document.timestamp).toLocaleString()}`);
            
            count++;
        }
        
        if (this.vectors.size > 5) {
            console.log(`\n... and ${this.vectors.size - 5} more documents`);
        }
        
        console.log('\n=== SEARCH TEST ===');
        // Test a simple search
        this.testSearch('disciplines').then(results => {
            console.log(`Test search for "disciplines" returned ${results.length} results`);
            if (results.length > 0) {
                console.log('Top result:', results[0].document.content.substring(0, 200) + '...');
            }
        }).catch(error => {
            console.error('Test search failed:', error);
        });
        
        console.log('=== END DEBUG ===');
    }
    
    /**
     * Test search method for debugging
     */
    async testSearch(query) {
        try {
            if (!this.embeddingModel) {
                console.log('No embedding model available');
                return [];
            }

            const queryEmbedding = await this.embeddingModel.embed(query);
            const queryVectorLength = queryEmbedding.length;
            
            console.log(`Test search - Query vector length: ${queryVectorLength}`);
            
            const results = [];
            let skippedCount = 0;
            
            for (const [id, document] of this.vectors) {
                if (!document.embedding || document.embedding.length !== queryVectorLength) {
                    skippedCount++;
                    continue;
                }
                
                const similarity = this.calculateCosineSimilarity(queryEmbedding, document.embedding);
                const keywordScore = this.calculateKeywordScore([query], document.content);
                const hybridScore = (similarity * 0.7) + (keywordScore * 0.3);
                
                results.push({
                    id,
                    document,
                    similarity: hybridScore
                });
            }
            
            console.log(`Test search - Skipped ${skippedCount} documents due to vector length mismatch`);
            console.log(`Test search - Found ${results.length} compatible documents`);
            
            results.sort((a, b) => b.similarity - a.similarity);
            return results.slice(0, 3); // Return top 3 for debugging
            
        } catch (error) {
            console.error('Test search error:', error);
            return [];
        }
    }
}

/**
 * Simple Embedding Model
 * A basic implementation for demonstration purposes
 */
class SimpleEmbeddingModel {
    constructor() {
        this.isInitialized = false;
        this.vectorSize = 128; // Small vector size for demo
    }

    /**
     * Initialize the embedding model
     */
    async initialize() {
        try {
            // In a real implementation, this would load a proper embedding model
            // For now, we'll use a simple hash-based approach
            this.isInitialized = true;
        } catch (error) {
            console.error('SimpleEmbeddingModel: Error initializing:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for text
     * @param {string} text - Text to embed
     */
    async embed(text) {
        try {
            if (!this.isInitialized) {
                throw new Error('Embedding model not initialized');
            }

            // Simple hash-based embedding for demonstration
            // In a real implementation, this would use a proper embedding model
            const embedding = new Array(this.vectorSize).fill(0);
            
            // Create a simple hash-based vector
            for (let i = 0; i < text.length; i++) {
                const charCode = text.charCodeAt(i);
                const index = charCode % this.vectorSize;
                embedding[index] += 1;
            }
            
            // Normalize the vector
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                for (let i = 0; i < embedding.length; i++) {
                    embedding[i] /= magnitude;
                }
            }
            
            return embedding;
        } catch (error) {
            console.error('SimpleEmbeddingModel: Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Get model information
     */
    getInfo() {
        return {
            name: 'Simple Hash-Based Embedding',
            vectorSize: this.vectorSize,
            isInitialized: this.isInitialized
        };
    }
}

/**
 * TF-IDF Embedding Model
 * A more sophisticated approach that understands word importance
 */
class TFIDFEmbeddingModel {
    constructor() {
        this.isInitialized = false;
        this.vectorSize = 512; // Larger vector for better representation
        this.vocabulary = new Map(); // Word to index mapping
        this.idfScores = new Map(); // Inverse document frequency scores
        this.totalDocuments = 0;
        this.wordIndex = 0;
    }

    /**
     * Initialize the embedding model
     */
    async initialize() {
        try {
            this.isInitialized = true;
            console.log('TFIDFEmbeddingModel: Initialized with TF-IDF approach');
        } catch (error) {
            console.error('TFIDFEmbeddingModel: Error initializing:', error);
            throw error;
        }
    }

    /**
     * Preprocess text for better understanding
     */
    preprocessText(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation but keep spaces
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .split(' ')
            .filter(word => word.length > 2); // Remove very short words
    }

    /**
     * Extract important terms from text
     */
    extractTerms(text) {
        const words = this.preprocessText(text);
        const termFreq = new Map();
        
        // Count word frequencies
        words.forEach(word => {
            termFreq.set(word, (termFreq.get(word) || 0) + 1);
        });
        
        // Calculate TF (Term Frequency)
        const maxFreq = Math.max(...termFreq.values());
        const tf = new Map();
        termFreq.forEach((count, word) => {
            tf.set(word, count / maxFreq);
        });
        
        return { words, tf, termFreq };
    }

    /**
     * Update vocabulary and IDF scores with new document
     */
    updateVocabulary(text) {
        const { words, termFreq } = this.extractTerms(text);
        
        // Add new words to vocabulary
        words.forEach(word => {
            if (!this.vocabulary.has(word)) {
                this.vocabulary.set(word, this.wordIndex++);
            }
        });
        
        // Update document frequency
        const uniqueWords = new Set(words);
        uniqueWords.forEach(word => {
            this.idfScores.set(word, (this.idfScores.get(word) || 0) + 1);
        });
        
        this.totalDocuments++;
    }

    /**
     * Calculate IDF scores for all words
     */
    calculateIDF() {
        this.idfScores.forEach((docFreq, word) => {
            this.idfScores.set(word, Math.log(this.totalDocuments / docFreq));
        });
    }

    /**
     * Generate embedding for text using TF-IDF
     */
    async embed(text) {
        try {
            if (!this.isInitialized) {
                throw new Error('Embedding model not initialized');
            }

            // Extract terms and calculate TF
            const { tf } = this.extractTerms(text);
            
            // Create vector
            const embedding = new Array(this.vectorSize).fill(0);
            
            // Calculate TF-IDF for each word
            tf.forEach((tfScore, word) => {
                const wordIndex = this.vocabulary.get(word);
                if (wordIndex !== undefined && wordIndex < this.vectorSize) {
                    const idfScore = this.idfScores.get(word) || 0;
                    const tfidfScore = tfScore * idfScore;
                    embedding[wordIndex] = tfidfScore;
                }
            });
            
            // Normalize the vector
            const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
            if (magnitude > 0) {
                for (let i = 0; i < embedding.length; i++) {
                    embedding[i] /= magnitude;
                }
            }
            
            return embedding;
        } catch (error) {
            console.error('TFIDFEmbeddingModel: Error generating embedding:', error);
            throw error;
        }
    }

    /**
     * Get model information
     */
    getInfo() {
        return {
            name: 'TF-IDF Embedding Model',
            vectorSize: this.vectorSize,
            vocabularySize: this.vocabulary.size,
            totalDocuments: this.totalDocuments,
            isInitialized: this.isInitialized
        };
    }
}

// Export for use in other modules
window.VectorDatabaseManager = VectorDatabaseManager;
window.SimpleEmbeddingModel = SimpleEmbeddingModel;
window.TFIDFEmbeddingModel = TFIDFEmbeddingModel;

// Add debug function to global scope for easy access
window.debugRulespediaDatabase = function() {
    const vectorDB = window.rulespediaVectorDB || window.rulespediaManager?.getVectorDB();
    if (vectorDB) {
        vectorDB.debugDatabase();
    } else {
        console.error('Vector database not available. Make sure Rulespedia is initialized.');
    }
};

// Add aggressive clear function for debugging
window.clearRulespediaDatabase = async function() {
    console.log('=== AGGRESSIVE DATABASE CLEAR ===');
    
    try {
        // Clear from memory
        if (window.rulespediaVectorDB) {
            window.rulespediaVectorDB.vectors.clear();
            window.rulespediaVectorDB.pendingSaves.clear();
            console.log('Memory cleared');
        }
        
        // Clear from settings
        if (game.settings.settings.has('wodsystem.rulespedia-vectors')) {
            await game.settings.set('wodsystem', 'rulespedia-vectors', null);
            console.log('Settings cleared');
        }
        
        // Reset model
        if (window.rulespediaVectorDB && window.rulespediaVectorDB.embeddingModel) {
            if (window.rulespediaVectorDB.embeddingModel instanceof TFIDFEmbeddingModel) {
                window.rulespediaVectorDB.embeddingModel.vocabulary.clear();
                window.rulespediaVectorDB.embeddingModel.idfScores.clear();
                window.rulespediaVectorDB.embeddingModel.totalDocuments = 0;
                window.rulespediaVectorDB.embeddingModel.wordIndex = 0;
                console.log('Model reset');
            }
        }
        
        // Force reload
        location.reload();
        
    } catch (error) {
        console.error('Aggressive clear failed:', error);
    }
}; 