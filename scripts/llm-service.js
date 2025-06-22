/**
 * LLM Service - Core LLM interface and common functionality
 * Uses composition to support different LLM providers
 */

class LLMService {
    constructor(llmProvider = null) {
        this.llmProvider = llmProvider;
        this.isInitialized = false;
        this.config = {
            maxTokens: 2048,
            temperature: 0.1
        };
    }

    /**
     * Set the LLM provider
     * @param {Object} provider - LLM provider implementation
     */
    setProvider(provider) {
        this.llmProvider = provider;
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
            await this.llmProvider.initialize();
            this.isInitialized = true;
            this.fallbackMode = false;
        } catch (error) {
            console.warn('LLM: Initialization failed, using fallback mode:', error.message);
            // Set fallback mode - service will use fallback methods instead of AI
            this.isInitialized = true; // Still mark as initialized so other services can use it
            this.fallbackMode = true;
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
    }

    /**
     * Unload model to free memory
     */
    async unload() {
        if (this.llmProvider && this.llmProvider.unload) {
            await this.llmProvider.unload();
        }
        this.isInitialized = false;
    }

    /**
     * Analyze high TF-IDF words to identify rule-related terms
     * @param {Array} highTfidfWords - Array of high TF-IDF words with scores
     * @returns {Object} Analysis result with rule terms and suggested terms
     */
    async analyzeRuleTerms(highTfidfWords) {
        if (this.fallbackMode) {
            return this.fallbackRuleAnalysis(highTfidfWords);
        }

        if (!this.isInitialized) {
            throw new Error('LLMService not initialized');
        }

        try {
            // Get prompt from LLMPrompts
            const prompt = LLMPrompts.getRuleTermsAnalysisPrompt(highTfidfWords);

            const response = await this.generate(prompt, {
                maxTokens: 500,
                temperature: 0.1
            });

            // Try to parse JSON response
            try {
                const analysis = JSON.parse(response);
                return {
                    ruleTerms: analysis.ruleTerms || [],
                    suggestedTerms: analysis.suggestedTerms || [],
                    reasoning: analysis.reasoning || 'Analysis completed'
                };
            } catch (parseError) {
                return this.fallbackRuleAnalysis(highTfidfWords);
            }

        } catch (error) {
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
            return this.fallbackChunkAnalysis(chunkData);
        }

        if (!this.isInitialized) {
            throw new Error('LLMService not initialized');
        }

        try {
            // Get prompt from LLMPrompts
            const prompt = LLMPrompts.getChunkAnalysisPrompt(chunkData);

            const response = await this.generate(prompt, {
                maxTokens: 300,
                temperature: 0.1
            });

            // Try to parse JSON response
            try {
                const analysis = JSON.parse(response);
                return {
                    isRule: analysis.isRule || false,
                    confidence: analysis.confidence || 0.5,
                    ruleName: analysis.ruleName || 'Unknown Rule',
                    ruleType: analysis.ruleType || 'general',
                    reasoning: analysis.reasoning || 'Analysis completed'
                };
            } catch (parseError) {
                return this.fallbackChunkAnalysis(chunkData);
            }

        } catch (error) {
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
            const prompt = LLMPrompts.getRuleSummarizationPrompt(ruleText);
            const summary = await this.generate(prompt, {
                maxTokens: 200,
                temperature: 0.1
            });
            return summary;
        } catch (error) {
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
                return {
                    primaryCategory: 'general',
                    secondaryCategory: 'unknown',
                    confidence: 0.5,
                    reasoning: 'Fallback categorization'
                };
            }
        } catch (error) {
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

    /**
     * Get rule-relevant words for RPG systems
     * @returns {Array} Array of rule-relevant words
     */
    async getRuleRelevantWords() {
        if (this.fallbackMode) {
            return this.fallbackRuleRelevantWords();
        }

        if (!this.isInitialized) {
            console.warn('LLM: Service not initialized, using fallback words');
            return this.fallbackRuleRelevantWords();
        }

        if (!this.llmProvider) {
            console.warn('LLM: No provider set, using fallback words');
            return this.fallbackRuleRelevantWords();
        }

        try {
            console.log('LLM: Getting rule-relevant words...');
            
            const prompt = `You are an expert on tabletop roleplaying games (TTRPGs). I need you to provide a comprehensive list of words that are commonly used in RPG rulebooks and game mechanics.

CRITICAL REQUIREMENTS:
1. Return ONLY a JSON array of strings
2. Include ONLY words that are actually used in RPG rules and mechanics
3. Focus on game-specific terminology, not general words
4. Include words from various RPG systems (D&D, Pathfinder, World of Darkness, etc.)

REQUIRED CATEGORIES (include multiple words from each):
- Dice mechanics: dice, roll, d20, d6, d10, difficulty, target, success, failure, critical, fumble, advantage, disadvantage
- Character mechanics: attribute, skill, ability, trait, level, experience, class, race, background, proficiency
- Combat mechanics: attack, damage, hit, miss, armor, defense, initiative, turn, action, bonus, penalty, modifier
- Game systems: rule, mechanic, system, check, test, save, throw, resistance, immunity, vulnerability
- Magic/spells: spell, magic, casting, component, material, somatic, verbal, focus, ritual, incantation
- Status effects: condition, stunned, paralyzed, poisoned, charmed, frightened, blinded, deafened
- Movement/tactics: movement, range, area, distance, flank, cover, concealment, stealth, ambush
- Equipment: weapon, armor, shield, item, gear, equipment, tool, implement, focus

EXAMPLE RESPONSE FORMAT:
["dice", "roll", "d20", "difficulty", "target", "success", "failure", "critical", "advantage", "disadvantage", "attribute", "skill", "ability", "level", "class", "attack", "damage", "armor", "initiative", "action", "bonus", "penalty", "modifier", "rule", "mechanic", "check", "save", "spell", "magic", "casting", "condition", "movement", "range", "weapon", "equipment"]

DO NOT include general words like "pattern", "analysis", "completed", "detected", "confidence", "system" (unless referring to game systems specifically). Only include RPG-specific terminology.`;

            const response = await this.generate(prompt, {
                maxTokens: 500,
                temperature: 0.1
            });

            console.log('LLM: Raw response:', response);

            // Try to parse JSON response with multiple fallback strategies
            let words = null;
            
            // Strategy 1: Direct JSON parse
            try {
                const parsed = JSON.parse(response);
                if (Array.isArray(parsed)) {
                    words = parsed;
                }
            } catch (parseError) {
                console.log('LLM: Direct JSON parse failed, trying extraction...');
            }

            // Strategy 2: Extract JSON from text response
            if (!words) {
                try {
                    const jsonMatch = response.match(/\[.*\]/s);
                    if (jsonMatch) {
                        const extracted = JSON.parse(jsonMatch[0]);
                        if (Array.isArray(extracted)) {
                            words = extracted;
                        }
                    }
                } catch (extractError) {
                    console.log('LLM: JSON extraction failed, trying text parsing...');
                }
            }

            // Strategy 3: Parse comma-separated words from text
            if (!words) {
                try {
                    // Look for patterns like "word1, word2, word3" or "word1 word2 word3"
                    const wordPattern = /["']?([a-zA-Z][a-zA-Z0-9_-]*)["']?/g;
                    const matches = response.match(wordPattern);
                    if (matches && matches.length > 5) {
                        words = matches.map(match => match.replace(/["']/g, '')).filter(word => word.length > 2);
                    }
                } catch (textError) {
                    console.log('LLM: Text parsing failed...');
                }
            }

            // Strategy 4: Extract words from markdown or formatted text
            if (!words) {
                try {
                    // Remove markdown formatting and extract words
                    const cleanText = response.replace(/[*`#\-]/g, ' ').replace(/\n/g, ' ');
                    const wordMatches = cleanText.match(/\b[a-zA-Z][a-zA-Z0-9_-]*\b/g);
                    if (wordMatches && wordMatches.length > 5) {
                        words = wordMatches.filter(word => word.length > 2);
                    }
                } catch (markdownError) {
                    console.log('LLM: Markdown parsing failed...');
                }
            }

            if (words && words.length > 0) {
                // Validate that we got meaningful RPG words
                const validRPGWords = this.validateRPGWords(words);
                
                if (validRPGWords.length >= 20) {
                    console.log('LLM: Retrieved', validRPGWords.length, 'valid rule-relevant words');
                    return validRPGWords;
                } else {
                    console.warn('LLM: Retrieved words are not RPG-related enough, using fallback words');
                    return this.fallbackRuleRelevantWords();
                }
            } else {
                console.warn('LLM: Failed to parse response, using fallback words');
                return this.fallbackRuleRelevantWords();
            }

        } catch (error) {
            console.error('LLM: Failed to get rule-relevant words:', error.message);
            return this.fallbackRuleRelevantWords();
        }
    }

    /**
     * Fallback rule-relevant words when LLM is not available
     * @returns {Array} Array of fallback rule-relevant words
     */
    fallbackRuleRelevantWords() {
        return [
            'rule', 'dice', 'roll', 'difficulty', 'success', 'failure', 'check', 'test', 'mechanic', 'system',
            'attack', 'damage', 'health', 'skill', 'ability', 'attribute', 'trait', 'modifier', 'bonus', 'penalty',
            'resolution', 'target', 'threshold', 'advantage', 'disadvantage', 'critical', 'fumble', 'resistance',
            'immunity', 'vulnerability', 'initiative', 'turn', 'action', 'reaction', 'movement', 'range', 'area',
            'duration', 'concentration', 'saving', 'throw', 'armor', 'class', 'defense', 'evasion', 'dodge',
            'parry', 'block', 'counter', 'riposte', 'feint', 'grapple', 'shove', 'trip', 'disarm', 'overrun',
            'tumble', 'charge', 'withdraw', 'retreat', 'surrender', 'morale', 'fear', 'panic', 'rout', 'rally',
            'inspire', 'leadership', 'command', 'tactics', 'strategy', 'formation', 'flank', 'rear', 'surround',
            'ambush', 'stealth', 'concealment', 'cover', 'terrain', 'environment', 'weather', 'lighting',
            'visibility', 'obscurement', 'fog', 'smoke', 'darkness', 'blindness', 'deafness', 'silence',
            'paralysis', 'petrification', 'poison', 'disease', 'curse', 'blessing', 'enchantment', 'magic',
            'spell', 'ritual', 'incantation', 'component', 'material', 'somatic', 'verbal', 'focus', 'cost',
            'casting', 'concentration', 'duration', 'range', 'area', 'target', 'effect', 'save', 'resistance'
        ];
    }

    /**
     * Validate RPG-related words
     * @param {Array} words - Array of words to validate
     * @returns {Array} Validated RPG-related words
     */
    validateRPGWords(words) {
        const validRPGWords = [];
        
        // Comprehensive list of RPG-related keywords to validate against
        const rpgKeywords = [
            // Dice mechanics
            'dice', 'roll', 'd20', 'd6', 'd10', 'd12', 'd8', 'd4', 'd100', 'difficulty', 'target', 'success', 'failure', 'critical', 'fumble', 'advantage', 'disadvantage',
            
            // Character mechanics
            'attribute', 'skill', 'ability', 'trait', 'level', 'experience', 'class', 'race', 'background', 'proficiency', 'character', 'player', 'npc',
            
            // Combat mechanics
            'attack', 'damage', 'hit', 'miss', 'armor', 'defense', 'initiative', 'turn', 'action', 'bonus', 'penalty', 'modifier', 'combat', 'weapon', 'shield',
            
            // Game systems
            'rule', 'mechanic', 'system', 'check', 'test', 'save', 'throw', 'resistance', 'immunity', 'vulnerability', 'game', 'play',
            
            // Magic/spells
            'spell', 'magic', 'casting', 'component', 'material', 'somatic', 'verbal', 'focus', 'ritual', 'incantation', 'magical', 'enchantment',
            
            // Status effects
            'condition', 'stunned', 'paralyzed', 'poisoned', 'charmed', 'frightened', 'blinded', 'deafened', 'status', 'effect',
            
            // Movement/tactics
            'movement', 'range', 'area', 'distance', 'flank', 'cover', 'concealment', 'stealth', 'ambush', 'tactics', 'strategy',
            
            // Equipment
            'item', 'gear', 'equipment', 'tool', 'implement', 'focus', 'weapon', 'armor', 'shield',
            
            // Common RPG terms
            'campaign', 'adventure', 'quest', 'mission', 'objective', 'goal', 'reward', 'treasure', 'loot', 'gold', 'currency'
        ];
        
        words.forEach(word => {
            const lowerWord = word.toLowerCase();
            // Check if the word contains any RPG-related keywords
            if (rpgKeywords.some(keyword => lowerWord.includes(keyword) || keyword.includes(lowerWord))) {
                validRPGWords.push(word);
            }
        });

        return validRPGWords;
    }
}

// Export for use in other modules
try {
    window.LLMService = LLMService;
} catch (error) {
    console.error('LLMService: Failed to export to window:', error);
} 