/**
 * Rule Discovery Service - Simplified for post-import analysis
 * Analyzes chunks that contain rule-relevant words to identify actual rules
 */

console.log('RuleDiscoveryService: File is being loaded...');

class RuleDiscoveryService {
    constructor(contentStore, llmService) {
        this.contentStore = contentStore;
        this.llmService = llmService;
        this.isInitialized = false;
        
        // Configuration
        this.MIN_RULE_CONFIDENCE = 0.6; // Minimum confidence for rule classification
        
        // Priority queue for rule chunks (ordered by chunk number)
        this.ruleChunks = [];
    }

    /**
     * Initialize the rule discovery service
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            this.isInitialized = true;
        } catch (error) {
            console.error('RuleDiscovery: Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Analyze chunks that contain rule-relevant words to identify actual rules
     * @param {string} filename - Optional filename filter
     * @returns {Object} Analysis results
     */
    async analyzeRuleChunks(filename = null) {
        // Check if LLM service is available
        if (!this.llmService) {
            console.warn('RuleDiscovery: LLM service not available, skipping rule discovery');
            return {
                success: false,
                message: 'LLM service not available',
                chunkAssociations: 0,
                chunkTuples: 0,
                ruleChunks: 0
            };
        }
        
        // Check if LLM service is initialized and ready
        if (!this.llmService.isInitialized) {
            console.warn('RuleDiscovery: LLM service not initialized, attempting to initialize...');
            try {
                await this.llmService.initialize();
            } catch (initError) {
                console.warn('RuleDiscovery: Failed to initialize LLM service:', initError.message);
                return {
                    success: false,
                    message: 'LLM service initialization failed',
                    chunkAssociations: 0,
                    chunkTuples: 0,
                    ruleChunks: 0
                };
            }
        }
        
        // Check if LLM service has a provider
        if (!this.llmService.llmProvider) {
            console.warn('RuleDiscovery: LLM service has no provider, skipping rule discovery');
            return {
                success: false,
                message: 'LLM service has no provider',
                chunkAssociations: 0,
                chunkTuples: 0,
                ruleChunks: 0
            };
        }
        
        try {
            // Step 1: Get chunks that contain rule-relevant words
            const ruleChunkAssociations = await this.getRuleChunkAssociations(filename);
            
            // Step 2: Create tuple list of chunk numbers and documents
            const chunkTuples = this.createChunkTuples(ruleChunkAssociations);
            
            // Step 3: Analyze chunks with LLM and build priority queue
            const ruleChunks = await this.analyzeChunksAndBuildQueue(chunkTuples);
            
            // Store results
            this.ruleChunks = ruleChunks;
            
            return {
                success: true,
                chunkAssociations: Object.keys(ruleChunkAssociations).length,
                chunkTuples: chunkTuples.length,
                ruleChunks: ruleChunks.length
            };
            
        } catch (error) {
            console.error('RuleDiscoveryService: Rule chunk analysis failed:', error);
            return {
                success: false,
                message: error.message,
                chunkAssociations: 0,
                chunkTuples: 0,
                ruleChunks: 0
            };
        }
    }

    /**
     * Get chunks associated with rule-relevant words from the content store
     * @param {string} filename - Optional filename filter
     * @returns {Object} Word-chunk associations for rule-relevant words
     */
    async getRuleChunkAssociations(filename = null) {
        const ruleChunkAssociations = {};
        
        // Get unique files to process
        const filesToProcess = filename ? [filename] : this.contentStore.getUniqueFiles();
        
        for (const file of filesToProcess) {
            const tfidfData = this.contentStore.getTFIDFDataForFile(file);
            
            if (!tfidfData || !tfidfData.wordChunkAssociations) {
                continue;
            }
            
            // All word-chunk associations in the store are already for rule-relevant words
            // (since we only store associations for rule-relevant words during import)
            for (const [word, associations] of Object.entries(tfidfData.wordChunkAssociations)) {
                if (associations.length > 0) {
                    ruleChunkAssociations[word] = associations;
                }
            }
        }
        
        return ruleChunkAssociations;
    }

    /**
     * Create tuple list of chunk numbers and documents
     * @param {Object} ruleChunkAssociations - Word-chunk associations
     * @returns {Array} Array of chunk tuples
     */
    createChunkTuples(ruleChunkAssociations) {
        const chunkMap = new Map(); // chunk_id -> chunk data
        
        // Collect all unique chunks from associations
        for (const [word, associations] of Object.entries(ruleChunkAssociations)) {
            for (const association of associations) {
                if (!chunkMap.has(association.chunk_id)) {
                    chunkMap.set(association.chunk_id, {
                        chunk_id: association.chunk_id,
                        chunk_count: association.chunk_count,
                        sectionContext: association.sectionContext,
                        tfidf_score: association.tfidf_score,
                        confidence: association.confidence,
                        associatedWords: []
                    });
                }
                
                // Add this word to the chunk's associated words
                const chunkData = chunkMap.get(association.chunk_id);
                chunkData.associatedWords.push(word);
            }
        }
        
        // Convert to array and sort by chunk number
        return Array.from(chunkMap.values()).sort((a, b) => a.chunk_count - b.chunk_count);
    }

    /**
     * Analyze chunks with LLM and build priority queue
     * @param {Array} chunkTuples - Array of chunk tuples
     * @returns {Array} Priority queue of rule chunks
     */
    async analyzeChunksAndBuildQueue(chunkTuples) {
        const ruleChunks = [];
        
        for (let i = 0; i < chunkTuples.length; i++) {
            const chunkTuple = chunkTuples[i];
            
            try {
                // Get the actual chunk content
                const chunk = this.contentStore.chunks.get(chunkTuple.chunk_id);
                if (!chunk) {
                    console.warn(`RuleDiscoveryService: Chunk ${chunkTuple.chunk_id} not found, skipping`);
                    continue;
                }
                
                // Prepare chunk object for LLM analysis
                const chunkForAnalysis = {
                    chunk_count: chunkTuple.chunk_count,
                    chunk_id: chunkTuple.chunk_id,
                    sectionContext: chunkTuple.sectionContext,
                    chunk: chunk.content,
                    associatedWords: chunkTuple.associatedWords
                };
                
                // Analyze with LLM
                const analysis = await this.llmService.analyzeChunkForRules(chunkForAnalysis);
                
                // Add to priority queue if it's a rule with sufficient confidence
                if (analysis.isRule && analysis.confidence >= this.MIN_RULE_CONFIDENCE) {
                    ruleChunks.push({
                        ...analysis,
                        chunk: chunk.content,
                        metadata: chunk.metadata,
                        associatedWords: chunkTuple.associatedWords,
                        tfidf_score: chunkTuple.tfidf_score
                    });
                }
                
            } catch (error) {
                console.warn(`RuleDiscoveryService: Error analyzing chunk ${chunkTuple.chunk_id}:`, error);
                continue;
            }
        }
        
        return ruleChunks;
    }

    /**
     * Get discovered rule chunks
     * @returns {Array} Priority queue of rule chunks
     */
    getRuleChunks() {
        return this.ruleChunks;
    }

    /**
     * Get rule chunks by type
     * @param {string} ruleType - Type of rule (combat, magic, social, etc.)
     * @returns {Array} Filtered rule chunks
     */
    getRuleChunksByType(ruleType) {
        return this.ruleChunks.filter(chunk => chunk.ruleType === ruleType);
    }

    /**
     * Get rule chunks by confidence threshold
     * @param {number} minConfidence - Minimum confidence threshold
     * @returns {Array} Filtered rule chunks
     */
    getRuleChunksByConfidence(minConfidence) {
        return this.ruleChunks.filter(chunk => chunk.confidence >= minConfidence);
    }

    /**
     * Get rule statistics
     * @returns {Object} Statistics about discovered rules
     */
    getRuleStats() {
        const stats = {
            totalRules: this.ruleChunks.length,
            byType: {},
            byConfidence: {
                high: 0,    // 0.8+
                medium: 0,  // 0.6-0.8
                low: 0      // <0.6
            },
            averageConfidence: 0
        };
        
        if (this.ruleChunks.length === 0) {
            return stats;
        }
        
        // Calculate statistics
        let totalConfidence = 0;
        
        for (const chunk of this.ruleChunks) {
            // By type
            const type = chunk.ruleType || 'other';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            // By confidence
            if (chunk.confidence >= 0.8) {
                stats.byConfidence.high++;
            } else if (chunk.confidence >= 0.6) {
                stats.byConfidence.medium++;
            } else {
                stats.byConfidence.low++;
            }
            
            totalConfidence += chunk.confidence;
        }
        
        stats.averageConfidence = totalConfidence / this.ruleChunks.length;
        
        return stats;
    }

    /**
     * Clear discovered rules
     */
    clearRules() {
        this.ruleChunks = [];
    }

    /**
     * Get service status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            ruleChunksCount: this.ruleChunks.length,
            config: {
                minRuleConfidence: this.MIN_RULE_CONFIDENCE
            }
        };
    }
}

// Export for use in other modules
window.RuleDiscoveryService = RuleDiscoveryService;
console.log('RuleDiscoveryService: File loaded and exported to window.RuleDiscoveryService'); 