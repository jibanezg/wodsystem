/**
 * LLM Prompts - Centralized prompt definitions for the Rulespedia system
 * Contains all prompts used by the LLM service for rule analysis and discovery
 */

console.log('LLMPrompts: File is being loaded...');

class LLMPrompts {
    /**
     * Get prompt for chunk analysis
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
}

// Export for use in other modules
window.LLMPrompts = LLMPrompts;
console.log('LLMPrompts: File loaded and exported to window.LLMPrompts'); 