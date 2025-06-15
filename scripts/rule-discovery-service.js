/**
 * Rule Discovery Service - Implements intelligent rule discovery algorithm
 * Uses LLM to identify rule-related terms and classify chunks
 */

console.log('RuleDiscoveryService: File is being loaded...');

class RuleDiscoveryService {
    constructor(contentStore, llmService) {
        this.contentStore = contentStore;
        this.llmService = llmService;
        this.isInitialized = false;
        
        // Configuration
        this.HIGH_TFIDF_THRESHOLD = 0.7; // 70% threshold for high TF-IDF words
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
            // Note: LLM service will be initialized manually during import
            // We don't need to initialize it here
            
            this.isInitialized = true;
            console.log('RuleDiscovery: Service initialized');
        } catch (error) {
            console.error('RuleDiscovery: Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Discover rules from imported books
     * @param {string} filename - Optional filename filter
     * @returns {Object} Discovery results
     */
    async discoverRules(filename = null) {
        // Check if LLM service is initialized and ready
        if (!this.llmService) {
            throw new Error('LLM service not available');
        }
        
        if (!this.llmService.isInitialized) {
            console.warn('RuleDiscovery: LLM service not initialized, attempting to initialize...');
            try {
                await this.llmService.initialize();
            } catch (initError) {
                console.error('RuleDiscovery: Failed to initialize LLM service:', initError.message);
                throw new Error('LLM service initialization failed. Please try again.');
            }
        }

        console.log('RuleDiscovery: Starting rule discovery...');
        
        try {
            // Step 1: Get high TF-IDF words (70%+ threshold)
            const highTfidfWords = await this.getHighTfidfWords(filename);
            console.log('RuleDiscovery: Found', highTfidfWords.length, 'high TF-IDF words');
            
            // Step 2: Send to LLM for rule term analysis
            let ruleAnalysis;
            try {
                ruleAnalysis = await this.llmService.analyzeRuleTerms(highTfidfWords);
                console.log('RuleDiscovery: LLM identified', ruleAnalysis.ruleTerms.length, 'rule terms');
                console.log('RuleDiscovery: LLM suggested', ruleAnalysis.suggestedTerms.length, 'additional terms');
            } catch (llmError) {
                console.error('RuleDiscovery: LLM analysis failed:', llmError.message);
                // Use fallback analysis
                ruleAnalysis = {
                    ruleTerms: [],
                    suggestedTerms: [],
                    reasoning: 'Fallback analysis due to LLM error'
                };
            }
            
            // Step 3: Combine rule terms and suggested terms
            const allRuleTerms = this.combineRuleTerms(ruleAnalysis);
            console.log('RuleDiscovery: Total rule terms to search:', allRuleTerms.length);
            
            // Step 4: Get chunks associated with rule terms
            const ruleChunkAssociations = await this.getRuleChunkAssociations(allRuleTerms, filename);
            console.log('RuleDiscovery: Found', Object.keys(ruleChunkAssociations).length, 'rule term associations');
            
            // Step 5: Create tuple list of chunk numbers and documents
            const chunkTuples = this.createChunkTuples(ruleChunkAssociations);
            console.log('RuleDiscovery: Created', chunkTuples.length, 'chunk tuples for analysis');
            
            // Step 6: Analyze chunks with LLM and build priority queue
            const ruleChunks = await this.analyzeChunksAndBuildQueue(chunkTuples);
            console.log(`RuleDiscoveryService: Identified ${ruleChunks.length} rule chunks`);
            
            // Store results
            this.ruleChunks = ruleChunks;
            
            return {
                success: true,
                highTfidfWords: highTfidfWords.length,
                ruleTerms: ruleAnalysis.ruleTerms,
                suggestedTerms: ruleAnalysis.suggestedTerms,
                allRuleTerms: allRuleTerms,
                chunkAssociations: Object.keys(ruleChunkAssociations).length,
                chunkTuples: chunkTuples.length,
                ruleChunks: ruleChunks.length,
                reasoning: ruleAnalysis.reasoning
            };
            
        } catch (error) {
            console.error('RuleDiscoveryService: Rule discovery failed:', error);
            throw error;
        }
    }

    /**
     * Get high TF-IDF words from the content store
     * @param {string} filename - Optional filename filter
     * @returns {Array} Array of high TF-IDF words with scores
     */
    async getHighTfidfWords(filename = null) {
        const highTfidfWords = [];
        
        // Get unique files to process
        const filesToProcess = filename ? [filename] : this.contentStore.getUniqueFiles();
        console.log(`RuleDiscovery: Processing ${filesToProcess.length} files for high TF-IDF words`);
        
        for (const file of filesToProcess) {
            console.log(`RuleDiscovery: Processing file: ${file}`);
            const tfidfData = this.contentStore.getTFIDFDataForFile(file);
            
            if (!tfidfData) {
                console.log(`RuleDiscovery: No TF-IDF data found for file: ${file}`);
                continue;
            }
            
            if (!tfidfData.wordChunkAssociations) {
                console.log(`RuleDiscovery: No word-chunk associations found for file: ${file}`);
                continue;
            }
            
            console.log(`RuleDiscovery: Found ${Object.keys(tfidfData.wordChunkAssociations).length} word-chunk associations for ${file}`);
            
            // Log all word-chunk associations for this file
            console.log(`RuleDiscovery: ALL WORD-CHUNK ASSOCIATIONS FOR ${file}:`);
            const sortedWords = Object.keys(tfidfData.wordChunkAssociations).sort((a, b) => {
                const maxScoreA = Math.max(...tfidfData.wordChunkAssociations[a].map(assoc => assoc.tfidf_score));
                const maxScoreB = Math.max(...tfidfData.wordChunkAssociations[b].map(assoc => assoc.tfidf_score));
                return maxScoreB - maxScoreA; // Sort by highest score first
            });
            
            sortedWords.forEach(word => {
                const associations = tfidfData.wordChunkAssociations[word];
                const maxTfidf = Math.max(...associations.map(a => a.tfidf_score));
                const avgTfidf = associations.reduce((sum, a) => sum + a.tfidf_score, 0) / associations.length;
                
                console.log(`  "${word}": ${associations.length} chunks, max TF-IDF: ${maxTfidf.toFixed(4)}, avg TF-IDF: ${avgTfidf.toFixed(4)}`);
                
                // Check if this word meets the threshold
                if (maxTfidf >= this.HIGH_TFIDF_THRESHOLD) {
                    console.log(`    ✓ MEETS THRESHOLD (${this.HIGH_TFIDF_THRESHOLD})`);
                    highTfidfWords.push({
                        word: word,
                        tfidf: maxTfidf,
                        associations: associations.length,
                        filename: file
                    });
                } else {
                    console.log(`    ✗ BELOW THRESHOLD (${this.HIGH_TFIDF_THRESHOLD})`);
                }
                
                // Show top 3 chunks for this word
                associations.slice(0, 3).forEach(assoc => {
                    console.log(`    - Chunk ${assoc.chunk_count}: TF-IDF ${assoc.tfidf_score.toFixed(4)}, context: ${assoc.sectionContext}`);
                });
            });
            
            // Extract words with high TF-IDF scores
            for (const [word, associations] of Object.entries(tfidfData.wordChunkAssociations)) {
                if (associations.length > 0) {
                    const maxTfidf = Math.max(...associations.map(a => a.tfidf_score));
                    
                    if (maxTfidf >= this.HIGH_TFIDF_THRESHOLD) {
                        highTfidfWords.push({
                            word: word,
                            tfidf: maxTfidf,
                            associations: associations.length,
                            filename: file
                        });
                    }
                }
            }
        }
        
        console.log(`RuleDiscovery: High TF-IDF threshold: ${this.HIGH_TFIDF_THRESHOLD}`);
        console.log(`RuleDiscovery: Found ${highTfidfWords.length} words meeting threshold`);
        
        // Sort by TF-IDF score (highest first)
        const sortedHighTfidfWords = highTfidfWords.sort((a, b) => b.tfidf - a.tfidf);
        
        // Log the top words found
        console.log(`RuleDiscovery: TOP HIGH TF-IDF WORDS FOUND:`);
        sortedHighTfidfWords.slice(0, 20).forEach((wordData, index) => {
            console.log(`  ${index + 1}. "${wordData.word}": TF-IDF ${wordData.tfidf.toFixed(4)}, ${wordData.associations} chunks, file: ${wordData.filename}`);
        });
        
        return sortedHighTfidfWords;
    }

    /**
     * Combine rule terms and suggested terms
     * @param {Object} ruleAnalysis - LLM analysis result
     * @returns {Array} Combined array of rule terms
     */
    combineRuleTerms(ruleAnalysis) {
        const allTerms = new Set();
        
        // Add rule terms identified by LLM
        ruleAnalysis.ruleTerms.forEach(term => allTerms.add(term.toLowerCase()));
        
        // Add suggested terms
        ruleAnalysis.suggestedTerms.forEach(term => allTerms.add(term.toLowerCase()));
        
        // Add common rule-related terms if not already present
        const commonRuleTerms = ['rule', 'system', 'mechanic', 'dice', 'roll', 'difficulty', 'success', 'failure'];
        commonRuleTerms.forEach(term => allTerms.add(term));
        
        return Array.from(allTerms);
    }

    /**
     * Get chunk associations for rule terms
     * @param {Array} ruleTerms - Array of rule terms
     * @param {string} filename - Optional filename filter
     * @returns {Object} Word-chunk associations
     */
    async getRuleChunkAssociations(ruleTerms, filename = null) {
        return this.contentStore.getWordChunkAssociations(ruleTerms, filename);
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
        
        console.log(`RuleDiscoveryService: Analyzing ${chunkTuples.length} chunks with LLM...`);
        
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
                
                // Progress logging
                if ((i + 1) % 10 === 0 || i === chunkTuples.length - 1) {
                    console.log(`RuleDiscoveryService: Analyzed ${i + 1}/${chunkTuples.length} chunks, found ${ruleChunks.length} rules`);
                }
                
            } catch (error) {
                console.error(`RuleDiscoveryService: Error analyzing chunk ${chunkTuple.chunk_id}:`, error);
                // Continue with other chunks
            }
        }
        
        // Sort by chunk number (priority queue order)
        return ruleChunks.sort((a, b) => a.chunk_count - b.chunk_count);
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
        console.log('RuleDiscoveryService: Cleared discovered rules');
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
                highTfidfThreshold: this.HIGH_TFIDF_THRESHOLD,
                minRuleConfidence: this.MIN_RULE_CONFIDENCE
            }
        };
    }
}

// Export for use in other modules
window.RuleDiscoveryService = RuleDiscoveryService;
console.log('RuleDiscoveryService: File loaded and exported to window.RuleDiscoveryService'); 