/**
 * TrieNode - Node structure for the Trie
 */
class TrieNode {
    constructor() {
        this.children = new Map();
        this.items = new Set();
        this.isEndOfWord = false;
    }
}

/**
 * Trie - Prefix tree for efficient text search
 * Used for searching merits, flaws, abilities, and other reference data
 */
export class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    /**
     * Insert a word into the trie with associated item
     * @param {string} word - The word to index
     * @param {object} item - The item to associate with this word
     */
    insert(word, item) {
        if (!word || typeof word !== 'string') return;
        
        let node = this.root;
        const normalizedWord = word.toLowerCase().trim();
        
        for (const char of normalizedWord) {
            if (!node.children.has(char)) {
                node.children.set(char, new TrieNode());
            }
            node = node.children.get(char);
        }
        
        node.isEndOfWord = true;
        node.items.add(item);
    }

    /**
     * Search for items matching a prefix
     * @param {string} prefix - The search prefix
     * @returns {Array} Array of matching items
     */
    search(prefix) {
        if (!prefix || typeof prefix !== 'string') return [];
        
        let node = this.root;
        const normalizedPrefix = prefix.toLowerCase().trim();
        
        // Navigate to the prefix node
        for (const char of normalizedPrefix) {
            if (!node.children.has(char)) {
                return [];
            }
            node = node.children.get(char);
        }
        
        // Collect all items from this node and its descendants
        return this._collectAllItems(node);
    }

    /**
     * Recursively collect all items from a node and its descendants
     * @param {TrieNode} node - Starting node
     * @returns {Array} Array of unique items
     * @private
     */
    _collectAllItems(node) {
        let results = new Set(node.items);
        
        for (const child of node.children.values()) {
            const childResults = this._collectAllItems(child);
            childResults.forEach(item => results.add(item));
        }
        
        return Array.from(results);
    }

    /**
     * Clear all data from the trie
     */
    clear() {
        this.root = new TrieNode();
    }
}

