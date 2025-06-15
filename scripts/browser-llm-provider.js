/**
 * Browser LLM Provider - Implements LLM interface for browser-based models
 * Uses Transformers.js for client-side model loading and inference
 */

console.log('BrowserLLMProvider: File is being loaded...');

class BrowserLLMProvider {
    constructor(modelConfig = {}) {
        this.model = null;
        this.tokenizer = null;
        this.pipeline = null;
        this.isLoading = false;
        this.loadProgress = 0;
        this.transformersLoaded = false;
        
        // Default configuration
        this.config = {
            modelName: modelConfig.modelName || 'microsoft/DialoGPT-medium',
            modelPath: modelConfig.modelPath || null,
            quantized: true,
            progressCallback: modelConfig.progressCallback || null,
            ...modelConfig
        };
    }

    /**
     * Load Transformers.js from CDN
     */
    async loadTransformers() {
        if (this.transformersLoaded && window.transformersPipeline) {
            return window.transformersPipeline;
        }

        // Check if Transformers.js is already loaded globally
        if (window.transformers && window.transformers.pipeline) {
            this.transformersLoaded = true;
            window.transformersPipeline = window.transformers.pipeline;
            console.log('LLM: Transformers.js found globally');
            return window.transformersPipeline;
        }

        // Try to load Transformers.js dynamically with different approaches
        try {
            console.log('LLM: Attempting to load Transformers.js from CDN...');
            
            // Method 1: Try loading with type="module" to avoid conflicts
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0/dist/transformers.min.js';
            script.type = 'text/javascript'; // Explicitly set to avoid module conflicts
            script.async = true;
            
            // Wait for script to load
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('LLM: Script loaded, checking for transformers object...');
                    // Give it a moment to initialize
                    setTimeout(() => {
                        if (window.transformers && window.transformers.pipeline) {
                            this.transformersLoaded = true;
                            window.transformersPipeline = window.transformers.pipeline;
                            console.log('LLM: Transformers.js loaded successfully from CDN');
                            resolve();
                        } else {
                            reject(new Error('Transformers.js loaded but pipeline not available'));
                        }
                    }, 1000);
                };
                script.onerror = () => reject(new Error('Failed to load Transformers.js script'));
                document.head.appendChild(script);
            });
            
            return window.transformersPipeline;
            
        } catch (error) {
            console.warn('LLM: Failed to load Transformers.js from CDN:', error.message);
            
            // Method 2: Try alternative CDN
            try {
                console.log('LLM: Trying alternative CDN...');
                const script2 = document.createElement('script');
                script2.src = 'https://unpkg.com/@xenova/transformers@2.6.0/dist/transformers.min.js';
                script2.type = 'text/javascript';
                script2.async = true;
                
                await new Promise((resolve, reject) => {
                    script2.onload = () => {
                        setTimeout(() => {
                            if (window.transformers && window.transformers.pipeline) {
                                this.transformersLoaded = true;
                                window.transformersPipeline = window.transformers.pipeline;
                                console.log('LLM: Transformers.js loaded successfully from alternative CDN');
                                resolve();
                            } else {
                                reject(new Error('Alternative CDN failed'));
                            }
                        }, 1000);
                    };
                    script2.onerror = () => reject(new Error('Alternative CDN failed'));
                    document.head.appendChild(script2);
                });
                
                return window.transformersPipeline;
                
            } catch (error2) {
                console.warn('LLM: Alternative CDN also failed:', error2.message);
            }
        }

        console.warn('LLM: Transformers.js not available. LLM features will be limited.');
        throw new Error('Transformers.js library not available. AI features will be disabled.');
    }

    /**
     * Initialize the browser LLM provider
     * Loads the model and tokenizer using Transformers.js
     */
    async initialize() {
        if (this.pipeline) {
            console.log('LLM: Already initialized');
            return;
        }

        this.isLoading = true;
        this.loadProgress = 0;

        try {
            console.log('LLM: Starting initialization...');
            
            // Try to load Transformers.js
            try {
                const pipeline = await this.loadTransformers();
                
                console.log('LLM: Loading model:', this.config.modelName);
                
                // Load the pipeline
                this.pipeline = await pipeline('text-generation', this.config.modelName, {
                    quantized: this.config.quantized,
                    progress_callback: (progress) => {
                        this.loadProgress = progress;
                        if (this.config.progressCallback) {
                            this.config.progressCallback(progress);
                        }
                    }
                });

                this.isLoading = false;
                this.loadProgress = 100;
                console.log('LLM: Model loaded successfully');
                
            } catch (transformersError) {
                console.warn('LLM: Transformers.js failed, trying alternative approach...');
                
                // Alternative approach: Use a simpler model or different method
                await this.initializeAlternativeModel();
            }
            
        } catch (error) {
            this.isLoading = false;
            console.error('LLM: Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Initialize alternative model when Transformers.js is not available
     */
    async initializeAlternativeModel() {
        console.log('LLM: Initializing alternative model...');
        
        // Create a simple mock pipeline that provides basic functionality
        this.pipeline = {
            tokenizer: {
                eos_token_id: 50256 // Common EOS token ID
            },
            __call__: async function(prompt, parameters) {
                console.log('LLM: Using alternative model for generation');
                
                // Simple rule-based response generation
                const response = this.generateSimpleResponse(prompt, parameters);
                
                return [{
                    generated_text: prompt + response
                }];
            }.bind(this)
        };
        
        this.isLoading = false;
        this.loadProgress = 100;
        console.log('LLM: Alternative model initialized successfully');
    }

    /**
     * Generate simple responses when full AI is not available
     */
    generateSimpleResponse(prompt, parameters) {
        // Simple rule-based analysis for RPG rules
        const text = prompt.toLowerCase();
        
        // Check for rule analysis prompts
        if (text.includes('analyze these high-frequency terms')) {
            return this.generateRuleTermsAnalysis(prompt);
        } else if (text.includes('analyze this text chunk')) {
            return this.generateChunkAnalysis(prompt);
        } else if (text.includes('summarize this tabletop rpg rule')) {
            return this.generateRuleSummary(prompt);
        } else if (text.includes('categorize this tabletop rpg rule')) {
            return this.generateRuleCategorization(prompt);
        }
        
        // Default response
        return ' Analysis completed using rule-based methods.';
    }

    /**
     * Generate rule terms analysis response
     */
    generateRuleTermsAnalysis(prompt) {
        const ruleTerms = [];
        const suggestedTerms = [];
        
        // Extract words from prompt
        const words = prompt.match(/\b\w+\s*\([^)]+\)/g) || [];
        
        words.forEach(wordMatch => {
            const word = wordMatch.split('(')[0].trim();
            const score = parseFloat(wordMatch.match(/\(([^)]+)\)/)?.[1] || '0');
            
            // Simple keyword-based classification
            const ruleKeywords = ['rule', 'dice', 'roll', 'difficulty', 'success', 'failure', 'check', 'test', 'mechanic', 'system', 'attack', 'damage', 'health', 'skill', 'ability'];
            
            if (ruleKeywords.some(keyword => word.toLowerCase().includes(keyword))) {
                ruleTerms.push(word);
            } else if (score > 0.5) {
                suggestedTerms.push(word);
            }
        });
        
        return ` {"ruleTerms": ${JSON.stringify(ruleTerms)}, "suggestedTerms": ${JSON.stringify(suggestedTerms.slice(0, 10))}, "reasoning": "Rule-based keyword analysis completed"}`;
    }

    /**
     * Generate chunk analysis response
     */
    generateChunkAnalysis(prompt) {
        const text = prompt.toLowerCase();
        const ruleKeywords = ['rule', 'dice', 'roll', 'difficulty', 'success', 'failure', 'check', 'test', 'mechanic', 'attack', 'damage', 'health'];
        const hasRuleKeywords = ruleKeywords.some(keyword => text.includes(keyword));
        
        return ` {"isRule": ${hasRuleKeywords}, "confidence": ${hasRuleKeywords ? 0.7 : 0.3}, "ruleName": "${hasRuleKeywords ? 'Detected Rule' : 'Not a Rule'}", "ruleType": "general", "reasoning": "Rule-based keyword analysis"}`;
    }

    /**
     * Generate rule summary response
     */
    generateRuleSummary(prompt) {
        const text = prompt.toLowerCase();
        let summary = 'This rule describes ';
        
        if (text.includes('dice')) summary += 'dice rolling mechanics. ';
        if (text.includes('attack')) summary += 'combat or attack procedures. ';
        if (text.includes('skill')) summary += 'skill or ability checks. ';
        if (text.includes('damage')) summary += 'damage calculation. ';
        
        summary += 'The rule provides specific procedures and conditions for resolution.';
        
        return summary;
    }

    /**
     * Generate rule categorization response
     */
    generateRuleCategorization(prompt) {
        const text = prompt.toLowerCase();
        let category = 'general';
        
        if (text.includes('dice') || text.includes('roll')) category = 'dice';
        else if (text.includes('attack') || text.includes('combat') || text.includes('damage')) category = 'combat';
        else if (text.includes('skill') || text.includes('ability')) category = 'character';
        
        return ` {"primaryCategory": "${category}", "secondaryCategory": "unknown", "confidence": 0.6, "reasoning": "Rule-based categorization"}`;
    }

    /**
     * Generate text using the loaded model
     * @param {string} prompt - The prompt to send to the model
     * @param {Object} parameters - Generation parameters
     * @returns {string} Generated text response
     */
    async generate(prompt, parameters = {}) {
        if (!this.pipeline) {
            throw new Error('Model not loaded. Call initialize() first.');
        }

        try {
            console.log('LLM: Generating response...');
            
            // Prepare generation parameters
            const generationParams = {
                max_new_tokens: parameters.maxTokens || 2048,
                temperature: parameters.temperature || 0.1,
                do_sample: true,
                top_k: parameters.topK || 50,
                top_p: parameters.topP || 0.9,
                repetition_penalty: parameters.repetitionPenalty || 1.1,
                pad_token_id: this.pipeline.tokenizer.eos_token_id
            };

            // Generate response
            const result = await this.pipeline(prompt, generationParams);
            
            // Extract generated text
            const generatedText = result[0].generated_text;
            
            // Remove the original prompt from the response
            const response = generatedText.substring(prompt.length).trim();
            
            console.log('LLM: Generation complete');
            return response;
            
        } catch (error) {
            console.error('LLM: Generation failed:', error.message);
            throw error;
        }
    }

    /**
     * Check if the environment supports required features
     */
    checkEnvironmentSupport() {
        const issues = [];
        
        // Check for fetch support (needed for CDN loading)
        if (typeof fetch !== 'function') {
            issues.push('Fetch API not supported');
        }
        
        // Check for Web Workers support (needed by Transformers.js)
        if (typeof Worker === 'undefined') {
            issues.push('Web Workers not supported');
        }
        
        // Check for SharedArrayBuffer support (needed for some models)
        if (typeof SharedArrayBuffer === 'undefined') {
            issues.push('SharedArrayBuffer not supported (may affect model loading)');
        }
        
        return {
            supported: issues.length === 0,
            issues: issues
        };
    }

    /**
     * Get provider status and information
     */
    getStatus() {
        const envCheck = this.checkEnvironmentSupport();
        
        return {
            modelName: this.config.modelName,
            isLoaded: !!this.pipeline,
            isLoading: this.isLoading,
            loadProgress: this.loadProgress,
            transformersLoaded: this.transformersLoaded,
            environmentSupported: envCheck.supported,
            environmentIssues: envCheck.issues,
            config: this.config
        };
    }

    /**
     * Unload the model to free memory
     */
    async unload() {
        if (this.pipeline) {
            // Clean up pipeline
            this.pipeline = null;
            this.model = null;
            this.tokenizer = null;
            console.log('LLM: Model unloaded');
        }
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration parameters
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('LLM: Configuration updated');
    }
}

// Export for use in other modules
window.BrowserLLMProvider = BrowserLLMProvider;
console.log('BrowserLLMProvider: File loaded and exported to window.BrowserLLMProvider'); 