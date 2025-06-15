/**
 * LLM Service - Core LLM interface and common functionality
 * Uses composition to support different LLM providers
 */

console.log('LLMService: File is being loaded...');

class LLMService {
    constructor(llmProvider = null) {
        this.llmProvider = llmProvider;
        this.isInitialized = false;
        this.config = {
            maxTokens: 2048,
            temperature: 0.1
        };
        console.log('LLMService: Constructor called');
    }

    /**
     * Set the LLM provider
     * @param {Object} provider - LLM provider implementation
     */
    setProvider(provider) {
        this.llmProvider = provider;
        console.log('LLM: Provider set');
    }

    /**
     * Initialize the LLM service
     */
    async initialize() {
        if (!this.llmProvider) {
            throw new Error('No LLM provider set. Use setProvider() first.');
        }

        if (this.isInitialized) return;
        
        try {
            console.log('LLM: Initializing service...');
            await this.llmProvider.initialize();
            this.isInitialized = true;
            this.fallbackMode = false;
            console.log('LLM: Service initialized successfully');
        } catch (error) {
            console.warn('LLM: Initialization failed, using fallback mode:', error.message);
            // Set fallback mode - service will use fallback methods instead of AI
            this.isInitialized = true; // Still mark as initialized so other services can use it
            this.fallbackMode = true;
            console.log('LLM: Fallback mode enabled - AI features will use keyword-based analysis');
        }
    }

    /**
     * Generate text using the loaded model
     * @param {string} prompt - The prompt to send to the model
     * @param {Object} parameters - Optional parameters for generation
     * @param {number} parameters.maxTokens - Maximum tokens to generate (default: config.maxTokens)
     * @param {number} parameters.temperature - Temperature for generation (default: config.temperature)
     * @param {boolean} parameters.doSample - Whether to use sampling (default: true)
     * @param {number} parameters.topK - Top-k sampling parameter
     * @param {number} parameters.topP - Top-p sampling parameter
     * @param {number} parameters.repetitionPenalty - Repetition penalty
     * @returns {string} Generated text response
     */
    async generate(prompt, parameters = {}) {
        if (!this.llmProvider) {
            throw new Error('No LLM provider set. Use setProvider() first.');
        }

        if (!this.isInitialized) {
            throw new Error('LLMService not initialized. Call initialize() first.');
        }

        // If in fallback mode, use fallback generation
        if (this.fallbackMode) {
            console.log('LLM: Using fallback generation');
            return this.fallbackGeneration(prompt, parameters);
        }

        // Merge with default config
        const finalParameters = {
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            ...parameters
        };

        return await this.llmProvider.generate(prompt, finalParameters);
    }

    /**
     * Get model information and status
     */
    getStatus() {
        const baseStatus = {
            isInitialized: this.isInitialized,
            config: this.config
        };

        if (this.llmProvider && this.llmProvider.getStatus) {
            return {
                ...baseStatus,
                provider: this.llmProvider.getStatus()
            };
        }

        return baseStatus;
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration parameters
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('LLMService: Configuration updated');
    }

    /**
     * Unload model to free memory
     */
    async unload() {
        if (this.llmProvider && this.llmProvider.unload) {
            await this.llmProvider.unload();
        }
        this.isInitialized = false;
        console.log('LLMService: Unloaded');
    }

    /**
     * Analyze high TF-IDF words to identify rule-related terms
     * @param {Array} highTfidfWords - Array of high TF-IDF words with scores
     * @returns {Object} Analysis result with rule terms and suggested terms
     */
    async analyzeRuleTerms(highTfidfWords) {
        if (this.fallbackMode) {
            console.log('LLM: Using fallback analysis for rule terms');
            return this.fallbackRuleAnalysis(highTfidfWords);
        }

        if (!this.isInitialized) {
            throw new Error('LLMService not initialized');
        }

        try {
            console.log('LLM: Analyzing rule terms from', highTfidfWords.length, 'high TF-IDF words');
            
            // Get prompt from LLMPrompts
            const prompt = LLMPrompts.getRuleTermsAnalysisPrompt(highTfidfWords);

            const response = await this.generate(prompt, {
                maxTokens: 500,
                temperature: 0.1
            });

            // Try to parse JSON response
            try {
                const analysis = JSON.parse(response);
                console.log('LLM: Rule term analysis complete -', analysis.ruleTerms?.length || 0, 'rule terms,', analysis.suggestedTerms?.length || 0, 'suggested terms');
                return {
                    ruleTerms: analysis.ruleTerms || [],
                    suggestedTerms: analysis.suggestedTerms || [],
                    reasoning: analysis.reasoning || 'Analysis completed'
                };
            } catch (parseError) {
                console.warn('LLM: Failed to parse JSON response, using fallback analysis');
                return this.fallbackRuleAnalysis(highTfidfWords);
            }

        } catch (error) {
            console.error('LLM: Rule term analysis failed:', error.message);
            return this.fallbackRuleAnalysis(highTfidfWords);
        }
    }

    /**
     * Analyze a chunk to determine if it contains rules
     * @param {Object} chunkData - Chunk data for analysis
     * @returns {Object} Analysis result with rule classification
     */
    async analyzeChunkForRules(chunkData) {
        if (this.fallbackMode) {
            console.log('LLM: Using fallback analysis for chunk');
            return this.fallbackChunkAnalysis(chunkData);
        }

        if (!this.isInitialized) {
            throw new Error('LLMService not initialized');
        }

        try {
            console.log('LLM: Analyzing chunk for rules...');
            
            // Get prompt from LLMPrompts
            const prompt = LLMPrompts.getChunkAnalysisPrompt(chunkData);

            const response = await this.generate(prompt, {
                maxTokens: 300,
                temperature: 0.1
            });

            // Try to parse JSON response
            try {
                const analysis = JSON.parse(response);
                console.log('LLM: Chunk analysis complete -', analysis.isRule ? 'Rule detected' : 'Not a rule', 'confidence:', Math.round(analysis.confidence * 100) + '%');
                return {
                    isRule: analysis.isRule || false,
                    confidence: analysis.confidence || 0.5,
                    ruleName: analysis.ruleName || 'Unknown Rule',
                    ruleType: analysis.ruleType || 'general',
                    reasoning: analysis.reasoning || 'Analysis completed'
                };
            } catch (parseError) {
                console.warn('LLM: Failed to parse JSON response, using fallback analysis');
                return this.fallbackChunkAnalysis(chunkData);
            }

        } catch (error) {
            console.error('LLM: Chunk analysis failed:', error.message);
            return this.fallbackChunkAnalysis(chunkData);
        }
    }

    /**
     * Summarize a rule
     * @param {string} ruleText - The rule text to summarize
     * @returns {string} Summarized rule
     */
    async summarizeRule(ruleText) {
        if (!this.isInitialized) {
            throw new Error('LLMService not initialized');
        }

        try {
            console.log('LLM: Summarizing rule...');
            const prompt = LLMPrompts.getRuleSummarizationPrompt(ruleText);
            const summary = await this.generate(prompt, {
                maxTokens: 200,
                temperature: 0.1
            });
            console.log('LLM: Rule summarization complete');
            return summary;
        } catch (error) {
            console.error('LLM: Rule summarization failed:', error.message);
            return 'Unable to summarize rule at this time.';
        }
    }

    /**
     * Categorize a rule
     * @param {string} ruleText - The rule text to categorize
     * @returns {Object} Categorization result
     */
    async categorizeRule(ruleText) {
        if (!this.isInitialized) {
            throw new Error('LLMService not initialized');
        }

        try {
            const prompt = LLMPrompts.getRuleCategorizationPrompt(ruleText);
            const response = await this.generate(prompt, {
                maxTokens: 200,
                temperature: 0.1
            });

            try {
                return JSON.parse(response);
            } catch (parseError) {
                console.warn('LLMService: Failed to parse categorization response');
                return {
                    primaryCategory: 'general',
                    secondaryCategory: 'unknown',
                    confidence: 0.5,
                    reasoning: 'Fallback categorization'
                };
            }
        } catch (error) {
            console.error('LLMService: Rule categorization failed:', error);
            return {
                primaryCategory: 'general',
                secondaryCategory: 'unknown',
                confidence: 0.5,
                reasoning: 'Error during categorization'
            };
        }
    }

    /**
     * Clarify a rule based on a specific question
     * @param {string} ruleText - The rule text to clarify
     * @param {string} question - The specific question about the rule
     * @returns {string} Clarification response
     */
    async clarifyRule(ruleText, question) {
        if (!this.isInitialized) {
            throw new Error('LLMService not initialized');
        }

        try {
            const prompt = LLMPrompts.getRuleClarificationPrompt(ruleText, question);
            return await this.generate(prompt, {
                maxTokens: 400,
                temperature: 0.1
            });
        } catch (error) {
            console.error('LLMService: Rule clarification failed:', error);
            return 'Unable to clarify rule at this time.';
        }
    }

    /**
     * Fallback generation when LLM is not available
     * @param {string} prompt - The prompt to analyze
     * @param {Object} parameters - Generation parameters
     * @returns {string} Fallback response
     */
    fallbackGeneration(prompt, parameters = {}) {
        // Simple keyword-based response generation
        const lowerPrompt = prompt.toLowerCase();
        
        if (lowerPrompt.includes('rule') || lowerPrompt.includes('mechanic')) {
            return JSON.stringify({
                ruleTerms: ['rule', 'mechanic', 'system'],
                suggestedTerms: ['dice', 'roll', 'difficulty'],
                reasoning: 'Fallback keyword analysis identified basic rule terms'
            });
        }
        
        if (lowerPrompt.includes('chunk') || lowerPrompt.includes('text')) {
            return JSON.stringify({
                isRule: false,
                confidence: 0.3,
                ruleName: 'Unknown',
                ruleType: 'general',
                reasoning: 'Fallback analysis - insufficient confidence to classify as rule'
            });
        }
        
        return JSON.stringify({
            response: 'Fallback response - AI features not available',
            reasoning: 'Using keyword-based analysis due to AI service unavailability'
        });
    }

    /**
     * Fallback rule analysis when LLM fails
     * @param {Array} highTfidfWords - Array of high TF-IDF words
     * @returns {Object} Fallback analysis result
     */
    fallbackRuleAnalysis(highTfidfWords) {
        const ruleTerms = [];
        const suggestedTerms = [];
        
        // Simple keyword-based analysis
        const ruleKeywords = ['rule', 'dice', 'roll', 'difficulty', 'success', 'failure', 'check', 'test', 'mechanic', 'system'];
        
        highTfidfWords.forEach(wordData => {
            const word = wordData.word.toLowerCase();
            if (ruleKeywords.some(keyword => word.includes(keyword))) {
                ruleTerms.push(wordData.word);
            } else if (word.length > 3 && wordData.tfidf > 0.5) {
                suggestedTerms.push(wordData.word);
            }
        });

        return {
            ruleTerms: ruleTerms,
            suggestedTerms: suggestedTerms.slice(0, 10),
            reasoning: 'Fallback keyword-based analysis'
        };
    }

    /**
     * Fallback chunk analysis when LLM fails
     * @param {Object} chunkData - Chunk data
     * @returns {Object} Fallback analysis result
     */
    fallbackChunkAnalysis(chunkData) {
        const text = chunkData.chunk.toLowerCase();
        const ruleKeywords = ['rule', 'dice', 'roll', 'difficulty', 'success', 'failure', 'check', 'test', 'mechanic'];
        const hasRuleKeywords = ruleKeywords.some(keyword => text.includes(keyword));
        
        return {
            isRule: hasRuleKeywords,
            confidence: hasRuleKeywords ? 0.6 : 0.3,
            ruleName: hasRuleKeywords ? 'Detected Rule' : 'Not a Rule',
            ruleType: 'general',
            reasoning: 'Fallback keyword-based analysis'
        };
    }
}

// Export for use in other modules
try {
    window.LLMService = LLMService;
    console.log('LLMService: File loaded and exported to window.LLMService');
} catch (error) {
    console.error('LLMService: Failed to export to window:', error);
} 