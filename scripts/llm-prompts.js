/**
 * LLM Prompts - Centralized prompt definitions for the Rulespedia system
 * Contains all prompts used by the LLM service for rule analysis and discovery
 */

console.log('LLMPrompts: File is being loaded...');

class LLMPrompts {
    /**
     * Get prompt for analyzing high TF-IDF words to identify rule-related terms
     * @param {Array} highTfidfWords - Array of high TF-IDF words with scores
     * @returns {string} Formatted prompt
     */
    static getRuleTermsAnalysisPrompt(highTfidfWords) {
        const wordsList = highTfidfWords.slice(0, 50).map(w => `${w.word} (${w.tfidf.toFixed(3)})`).join(', ');
        
        return `Analyze these high-frequency terms from a tabletop RPG rulebook and identify which ones are likely related to game rules, mechanics, or systems:

Terms: ${wordsList}

Please respond with a JSON object containing:
1. "ruleTerms": Array of terms that are clearly rule-related
2. "suggestedTerms": Array of additional terms that might be rule-related
3. "reasoning": Brief explanation of your analysis

Focus on terms related to:
- Dice mechanics (roll, dice, difficulty, success, failure)
- Game systems (rule, mechanic, system, check, test)
- Character mechanics (attribute, skill, ability, trait)
- Combat mechanics (attack, defense, damage, health)
- Other game rules (turn, action, movement, etc.)`;
    }

    /**
     * Get prompt for analyzing a chunk to determine if it contains rules
     * @param {Object} chunkData - Chunk data for analysis
     * @returns {string} Formatted prompt
     */
    static getChunkAnalysisPrompt(chunkData) {
        return `Analyze this text chunk from a tabletop RPG rulebook and determine if it contains game rules or mechanics:

Chunk ${chunkData.chunk_count}:
${chunkData.chunk}

Associated terms: ${chunkData.associatedWords.join(', ')}

Please respond with a JSON object containing:
1. "isRule": Boolean indicating if this chunk contains rules
2. "confidence": Number between 0 and 1 indicating confidence
3. "ruleName": Short name for the rule if identified
4. "ruleType": Type of rule (combat, character, dice, system, etc.)
5. "reasoning": Brief explanation of your analysis

A rule chunk typically contains:
- Specific mechanics or procedures
- Dice rolling instructions
- Success/failure conditions
- Numerical values or modifiers
- Step-by-step processes`;
    }

    /**
     * Get prompt for general text generation
     * @param {string} context - Context for the generation
     * @returns {string} Formatted prompt
     */
    static getGeneralPrompt(context) {
        return `You are an AI assistant helping with tabletop RPG rulebook analysis. 

Context: ${context}

Please provide a helpful and accurate response based on the context provided.`;
    }

    /**
     * Get prompt for rule summarization
     * @param {string} ruleText - The rule text to summarize
     * @returns {string} Formatted prompt
     */
    static getRuleSummarizationPrompt(ruleText) {
        return `Summarize this tabletop RPG rule in a clear, concise manner:

Rule Text:
${ruleText}

Please provide a summary that includes:
1. The main mechanic or procedure
2. Key conditions or requirements
3. Any important numerical values
4. The rule's purpose or context

Keep the summary under 100 words and focus on the essential information a player or GM would need to understand and use this rule.`;
    }

    /**
     * Get prompt for rule categorization
     * @param {string} ruleText - The rule text to categorize
     * @returns {string} Formatted prompt
     */
    static getRuleCategorizationPrompt(ruleText) {
        return `Categorize this tabletop RPG rule into the most appropriate category:

Rule Text:
${ruleText}

Please respond with a JSON object containing:
1. "primaryCategory": The main category (combat, character, dice, system, social, exploration, etc.)
2. "secondaryCategory": A more specific subcategory if applicable
3. "confidence": Number between 0 and 1 indicating confidence in the categorization
4. "reasoning": Brief explanation of why this category was chosen

Common categories include:
- Combat: Attacks, damage, initiative, weapons, armor
- Character: Attributes, skills, abilities, traits, advancement
- Dice: Rolling mechanics, difficulty, success/failure
- System: Core mechanics, resolution systems
- Social: Social interactions, roleplaying mechanics
- Exploration: Movement, travel, discovery mechanics`;
    }

    /**
     * Get prompt for rule clarification
     * @param {string} ruleText - The rule text to clarify
     * @param {string} question - The specific question about the rule
     * @returns {string} Formatted prompt
     */
    static getRuleClarificationPrompt(ruleText, question) {
        return `Clarify this tabletop RPG rule based on the specific question:

Rule Text:
${ruleText}

Question: ${question}

Please provide a clear, helpful answer that:
1. Directly addresses the question
2. References specific parts of the rule text
3. Explains any ambiguous or complex parts
4. Provides practical examples if helpful

If the rule text doesn't contain enough information to answer the question, please state that clearly and suggest what additional information might be needed.`;
    }
}

// Export for use in other modules
window.LLMPrompts = LLMPrompts;
console.log('LLMPrompts: File loaded and exported to window.LLMPrompts'); 