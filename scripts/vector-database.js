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
     * Get store statistics
     */
    getStats() {
        return {
            totalChunks: this.chunks.size,
            totalWords: this.tfidfData.corpusStats.totalWords,
            vocabularySize: this.tfidfData.vocabulary.size,
            isInitialized: this.isInitialized
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
}

// Export for use in other modules
window.ContentStore = ContentStore;
  