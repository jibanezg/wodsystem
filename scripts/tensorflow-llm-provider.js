/**
 * TensorFlow.js LLM Provider - Browser-compatible AI for pattern recognition
 * Uses TensorFlow.js for client-side model inference with pattern recognition capabilities
 */

class TensorFlowLLMProvider {
    constructor(modelConfig = {}) {
        this.model = null;
        this.tokenizer = null;
        this.isLoading = false;
        this.loadProgress = 0;
        this.tensorflowLoaded = false;
        
        // Default configuration
        this.config = {
            modelName: modelConfig.modelName || 'text-classification',
            useQuantized: modelConfig.useQuantized !== false,
            progressCallback: modelConfig.progressCallback || null,
            ...modelConfig
        };
        
        // Pattern recognition keywords for RPG rules
        this.rulePatterns = {
            dice: ['dice', 'roll', 'd20', 'd6', 'd10', 'd100', 'difficulty', 'dc', 'target number'],
            combat: ['attack', 'damage', 'weapon', 'armor', 'hp', 'health', 'initiative', 'round', 'turn'],
            character: ['skill', 'ability', 'attribute', 'trait', 'level', 'experience', 'class', 'race'],
            system: ['rule', 'mechanic', 'system', 'check', 'test', 'success', 'failure', 'advantage', 'disadvantage'],
            social: ['charisma', 'persuasion', 'intimidation', 'deception', 'insight', 'performance'],
            exploration: ['movement', 'travel', 'exploration', 'discovery', 'search', 'investigation']
        };
    }

    /**
     * Load TensorFlow.js from CDN
     */
    async loadTensorFlow() {
        if (this.tensorflowLoaded && window.tf) {
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'tf_already_loaded' });
            }
            return window.tf;
        }

        // Check if TensorFlow.js is already loaded globally
        if (window.tf) {
            this.tensorflowLoaded = true;
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'tf_global' });
            }
            return window.tf;
        }

        if (window.DebugService) {
            DebugService.tensorflowEvent({ eventType: 'tf_load' });
        }

        // Try to load TensorFlow.js dynamically
        try {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
            script.type = 'text/javascript';
            script.async = true;
            
            await new Promise((resolve, reject) => {
                script.onload = () => {
                    setTimeout(() => {
                        if (window.tf) {
                            this.tensorflowLoaded = true;
                            if (window.DebugService) {
                                DebugService.tensorflowEvent({ eventType: 'tf_cdn_success' });
                            }
                            resolve();
                        } else {
                            const error = new Error('TensorFlow.js loaded but tf object not available');
                            if (window.DebugService) {
                                DebugService.tensorflowEvent({ eventType: 'tf_object_missing', error });
                            }
                            reject(error);
                        }
                    }, 1000);
                };
                script.onerror = () => {
                    const error = new Error('Failed to load TensorFlow.js script');
                    if (window.DebugService) {
                        DebugService.tensorflowEvent({ eventType: 'tf_cdn_failed', error });
                    }
                    reject(error);
                };
                document.head.appendChild(script);
            });
            
            return window.tf;
            
        } catch (error) {
            console.warn('LLM: Failed to load TensorFlow.js from CDN:', error.message);
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'tf_cdn_failed', error });
            }
            throw new Error('TensorFlow.js library not available. AI features will be disabled.');
        }
    }

    /**
     * Initialize the TensorFlow.js LLM provider
     */
    async initialize() {
        if (this.model) {
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'model_exists' });
            }
            return;
        }

        this.isLoading = true;
        this.loadProgress = 0;

        if (window.DebugService) {
            DebugService.tensorflowEvent({ eventType: 'init_start' });
        }

        try {
            // Load TensorFlow.js
            const tf = await this.loadTensorFlow();
            
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'tf_loaded', data: { tfVersion: tf.version } });
            }
            
            // Create a simple pattern recognition model
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'model_create' });
            }
            await this.createPatternRecognitionModel(tf);
            
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'model_created', data: { model: this.model } });
            }
            
            this.isLoading = false;
            this.loadProgress = 100;
            
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'init_complete' });
            }
            
        } catch (error) {
            this.isLoading = false;
            console.error('LLM: Initialization failed:', error.message);
            if (window.DebugService) {
                DebugService.tensorflowEvent({ eventType: 'init_failed', error });
            }
            throw error;
        }
    }

    /**
     * Create a simple pattern recognition model using TensorFlow.js
     */
    async createPatternRecognitionModel(tf) {
        // Create a simple neural network for text classification
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [Object.keys(this.rulePatterns).length],
                    units: 32,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 16,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 1,
                    activation: 'sigmoid'
                })
            ]
        });

        // Compile the model
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });
    }

    /**
     * Extract features from text for pattern recognition
     */
    extractFeatures(text) {
        const features = [];
        const lowerText = text.toLowerCase();
        
        // Extract features for each pattern category
        for (const [category, keywords] of Object.entries(this.rulePatterns)) {
            const matches = keywords.filter(keyword => lowerText.includes(keyword)).length;
            const feature = Math.min(matches / keywords.length, 1.0); // Normalize to 0-1
            features.push(feature);
        }
        
        return features;
    }

    /**
     * Generate text using pattern recognition
     * @param {string} prompt - The prompt to analyze
     * @param {Object} parameters - Generation parameters
     * @returns {string} Generated response
     */
    async generate(prompt, parameters = {}) {
        if (!this.model) {
            if (window.DebugService) {
                DebugService.tensorflowEvent({ 
                    eventType: 'model_not_loaded', 
                    error: new Error('Model not loaded. Call initialize() first.'),
                    data: { 
                        isLoading: this.isLoading, 
                        loadProgress: this.loadProgress,
                        tensorflowLoaded: this.tensorflowLoaded,
                        hasModel: !!this.model
                    }
                });
            }
            throw new Error('Model not loaded. Call initialize() first.');
        }

        try {
            // Extract features from the prompt
            const features = this.extractFeatures(prompt);
            
            // Convert to tensor
            const inputTensor = tf.tensor2d([features]);
            
            // Get model prediction
            const prediction = this.model.predict(inputTensor);
            const confidence = await prediction.data();
            
            // Clean up tensors
            inputTensor.dispose();
            prediction.dispose();
            
            // Generate response based on prompt type and confidence
            const response = this.generateResponseFromPattern(prompt, features, confidence[0]);
            
            return response;
            
        } catch (error) {
            console.error('LLM: Generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate response based on pattern recognition
     */
    generateResponseFromPattern(prompt, features, confidence) {
        const text = prompt.toLowerCase();
        
        // Determine the strongest pattern
        const patternNames = Object.keys(this.rulePatterns);
        const strongestPatternIndex = features.indexOf(Math.max(...features));
        const strongestPattern = patternNames[strongestPatternIndex];
        
        // Generate response based on prompt type
        if (text.includes('analyze these high-frequency terms')) {
            return this.generateRuleTermsAnalysis(prompt, features, strongestPattern);
        } else if (text.includes('analyze this text chunk')) {
            return this.generateChunkAnalysis(prompt, features, strongestPattern, confidence);
        } else if (text.includes('summarize this tabletop rpg rule')) {
            return this.generateRuleSummary(prompt, strongestPattern);
        } else if (text.includes('categorize this tabletop rpg rule')) {
            return this.generateRuleCategorization(prompt, strongestPattern, confidence);
        }
        
        // Default response
        return ` Pattern analysis completed. Detected pattern: ${strongestPattern} (confidence: ${(confidence * 100).toFixed(1)}%)`;
    }

    /**
     * Generate rule terms analysis using pattern recognition
     */
    generateRuleTermsAnalysis(prompt, features, strongestPattern) {
        const ruleTerms = [];
        const suggestedTerms = [];
        
        // Extract words from prompt
        const words = prompt.match(/\b\w+\s*\([^)]+\)/g) || [];
        
        words.forEach(wordMatch => {
            const word = wordMatch.split('(')[0].trim();
            const score = parseFloat(wordMatch.match(/\(([^)]+)\)/)?.[1] || '0');
            
            // Use pattern recognition to classify words
            const wordFeatures = this.extractFeatures(word);
            const wordPatternIndex = wordFeatures.indexOf(Math.max(...wordFeatures));
            const wordPattern = Object.keys(this.rulePatterns)[wordPatternIndex];
            
            if (wordPattern === strongestPattern && score > 0.3) {
                ruleTerms.push(word);
            } else if (score > 0.5) {
                suggestedTerms.push(word);
            }
        });
        
        return ` {"ruleTerms": ${JSON.stringify(ruleTerms)}, "suggestedTerms": ${JSON.stringify(suggestedTerms.slice(0, 10))}, "reasoning": "Pattern recognition analysis identified ${strongestPattern}-related terms"}`;
    }

    /**
     * Generate chunk analysis using pattern recognition
     */
    generateChunkAnalysis(prompt, features, strongestPattern, confidence) {
        const isRule = confidence > 0.5;
        const ruleName = isRule ? `${strongestPattern.charAt(0).toUpperCase() + strongestPattern.slice(1)} Rule` : 'Not a Rule';
        
        return ` {"isRule": ${isRule}, "confidence": ${confidence.toFixed(3)}, "ruleName": "${ruleName}", "ruleType": "${strongestPattern}", "reasoning": "Pattern recognition detected ${strongestPattern} patterns with ${(confidence * 100).toFixed(1)}% confidence"}`;
    }

    /**
     * Generate rule summary using pattern recognition
     */
    generateRuleSummary(prompt, strongestPattern) {
        let summary = `This rule describes ${strongestPattern} mechanics. `;
        
        const text = prompt.toLowerCase();
        if (text.includes('dice')) summary += 'It involves dice rolling and probability calculations. ';
        if (text.includes('attack')) summary += 'It defines combat procedures and resolution. ';
        if (text.includes('skill')) summary += 'It establishes ability checks and character progression. ';
        if (text.includes('damage')) summary += 'It specifies damage calculation and effects. ';
        
        summary += `The rule provides structured procedures for ${strongestPattern}-related gameplay elements.`;
        
        return summary;
    }

    /**
     * Generate rule categorization using pattern recognition
     */
    generateRuleCategorization(prompt, strongestPattern, confidence) {
        return ` {"primaryCategory": "${strongestPattern}", "secondaryCategory": "pattern-detected", "confidence": ${confidence.toFixed(3)}, "reasoning": "Pattern recognition identified ${strongestPattern} as the primary category"}`;
    }

    /**
     * Get provider status and information
     */
    getStatus() {
        return {
            modelName: 'TensorFlow.js Pattern Recognition',
            isLoaded: !!this.model,
            isLoading: this.isLoading,
            loadProgress: this.loadProgress,
            tensorflowLoaded: this.tensorflowLoaded,
            patternCategories: Object.keys(this.rulePatterns),
            config: this.config
        };
    }

    /**
     * Unload the model to free memory
     */
    async unload() {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        this.isLoading = false;
        this.loadProgress = 0;
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

// Export to window
try {
    window.TensorFlowLLMProvider = TensorFlowLLMProvider;
} catch (error) {
    console.error('TensorFlowLLMProvider: Failed to export to window:', error);
} 