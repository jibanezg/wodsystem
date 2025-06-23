/**
 * Rulespedia Statistics Component
 * Provides comprehensive statistics for the Rulespedia system
 * Can be easily toggled on/off without affecting existing code
 */

class RulespediaStatistics {
    constructor() {
        this.enabled = true;
        this.logLevel = 'summary'; // 'summary', 'detailed', 'verbose'
        this.stats = {
            imports: [],
            ruleDiscovery: [],
            contentStore: {},
            performance: {}
        };
    }

    /**
     * Enable or disable statistics
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`RulespediaStatistics: ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set logging level
     */
    setLogLevel(level) {
        if (['summary', 'detailed', 'verbose'].includes(level)) {
            this.logLevel = level;
            console.log(`RulespediaStatistics: Log level set to ${level}`);
        }
    }

    /**
     * Log import statistics - accepts complete import results array
     */
    logImportStats(importResults, options = {}) {
        if (!this.enabled) return;

        const importStat = {
            timestamp: new Date().toISOString(),
            results: importResults,
            summary: this.calculateImportSummary(importResults),
            options: options
        };

        this.stats.imports.push(importStat);

        if (this.logLevel === 'summary') {
            this.logImportSummary(importStat.summary);
        } else if (this.logLevel === 'detailed') {
            this.logImportDetailed(importStat);
        } else if (this.logLevel === 'verbose') {
            this.logImportVerbose(importStat);
        }
    }

    /**
     * Log rule discovery statistics - accepts discovery results and rule discovery service
     */
    logRuleDiscoveryStats(discoveryResults, ruleDiscoveryService, options = {}) {
        if (!this.enabled) return;

        // Extract rule chunks from the service
        const ruleChunks = ruleDiscoveryService ? ruleDiscoveryService.getRuleChunks() : [];
        
        const discoveryStat = {
            timestamp: new Date().toISOString(),
            results: discoveryResults,
            ruleChunks: ruleChunks,
            summary: this.calculateRuleDiscoverySummary(discoveryResults, ruleChunks),
            options: options
        };

        this.stats.ruleDiscovery.push(discoveryStat);

        if (this.logLevel === 'summary') {
            this.logRuleDiscoverySummary(discoveryStat.summary);
        } else if (this.logLevel === 'detailed') {
            this.logRuleDiscoveryDetailed(discoveryStat);
        } else if (this.logLevel === 'verbose') {
            this.logRuleDiscoveryVerbose(discoveryStat);
        }
    }

    /**
     * Log content store statistics - accepts content store object
     */
    logContentStoreStats(contentStore) {
        if (!this.enabled) return;

        // Extract stats from the content store
        const storeStats = contentStore ? contentStore.getStats() : {};
        this.stats.contentStore = storeStats;

        if (this.logLevel === 'summary') {
            this.logContentStoreSummary(storeStats);
        } else if (this.logLevel === 'detailed') {
            this.logContentStoreDetailed(storeStats);
        }
    }

    /**
     * Log performance statistics
     */
    logPerformanceStats(operation, duration, details = {}) {
        if (!this.enabled) return;

        const perfStat = {
            timestamp: new Date().toISOString(),
            operation: operation,
            duration: duration,
            details: details
        };

        if (!this.stats.performance[operation]) {
            this.stats.performance[operation] = [];
        }
        this.stats.performance[operation].push(perfStat);

        if (this.logLevel !== 'verbose') {
            console.log(`RulespediaStats: ${operation} completed in ${duration.toFixed(2)}ms`);
        }
    }

    /**
     * Calculate import summary from complete results array
     */
    calculateImportSummary(importResults) {
        if (!Array.isArray(importResults)) {
            return {
                filesImported: 0,
                totalFiles: 0,
                totalChunks: 0,
                totalWords: 0,
                totalAssociations: 0,
                successRate: 0
            };
        }

        const successful = importResults.filter(r => r.success).length;
        const total = importResults.length;
        const totalChunks = importResults.reduce((sum, r) => sum + (r.chunks || 0), 0);
        const totalWords = importResults.reduce((sum, r) => sum + (r.totalWords || 0), 0);
        const totalAssociations = importResults.reduce((sum, r) => sum + (r.associations || 0), 0);

        return {
            filesImported: successful,
            totalFiles: total,
            totalChunks: totalChunks,
            totalWords: totalWords,
            totalAssociations: totalAssociations,
            successRate: total > 0 ? (successful / total * 100).toFixed(1) : 0
        };
    }

    /**
     * Calculate rule discovery summary from discovery results and rule chunks
     */
    calculateRuleDiscoverySummary(discoveryResults, ruleChunks) {
        if (!discoveryResults || !discoveryResults.success) {
            return {
                success: false,
                message: discoveryResults?.message || 'Unknown error',
                rulesFound: 0,
                avgConfidence: 0
            };
        }

        const rulesFound = discoveryResults.ruleChunks || 0;
        let avgConfidence = 0;

        if (Array.isArray(ruleChunks) && ruleChunks.length > 0) {
            const totalConfidence = ruleChunks.reduce((sum, rule) => sum + (rule.confidence || 0), 0);
            avgConfidence = totalConfidence / ruleChunks.length;
        }

        return {
            success: true,
            rulesFound: rulesFound,
            avgConfidence: avgConfidence,
            chunksAnalyzed: discoveryResults.chunkTuples || 0
        };
    }

    /**
     * Log import summary (minimal)
     */
    logImportSummary(summary) {
        console.log(`📚 Import: ${summary.filesImported}/${summary.totalFiles} files (${summary.successRate}% success)`);
        console.log(`📄 Content: ${summary.totalChunks} chunks, ${summary.totalWords.toLocaleString()} words`);
        console.log(`🔗 Associations: ${summary.totalAssociations} connections`);
    }

    /**
     * Log import detailed
     */
    logImportDetailed(importStat) {
        this.logImportSummary(importStat.summary);
        
        // Show individual file results
        if (Array.isArray(importStat.results)) {
            importStat.results.forEach(result => {
                const status = result.success ? '✓' : '✗';
                const chunks = result.chunks || 0;
                const filename = result.filename || result.name || 'Unknown';
                console.log(`  ${status} ${filename}: ${chunks} chunks`);
            });
        }
    }

    /**
     * Log import verbose
     */
    logImportVerbose(importStat) {
        this.logImportDetailed(importStat);
        
        // Show detailed chunk statistics
        if (Array.isArray(importStat.results)) {
            const chunkSizes = importStat.results
                .filter(r => r.success)
                .map(r => r.chunks || 0);
            
            if (chunkSizes.length > 0) {
                const avgChunks = chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length;
                const minChunks = Math.min(...chunkSizes);
                const maxChunks = Math.max(...chunkSizes);
                
                console.log(`📊 Chunk Stats: avg=${avgChunks.toFixed(1)}, min=${minChunks}, max=${maxChunks}`);
            }
        }
    }

    /**
     * Log rule discovery summary (minimal)
     */
    logRuleDiscoverySummary(summary) {
        if (summary.success) {
            const avgConf = Math.round(summary.avgConfidence * 100);
            console.log(`🤖 AI Rules: ${summary.rulesFound} rules found (${avgConf}% avg confidence)`);
        } else {
            console.log(`⚠️ AI Rules: ${summary.message}`);
        }
    }

    /**
     * Log rule discovery detailed
     */
    logRuleDiscoveryDetailed(discoveryStat) {
        this.logRuleDiscoverySummary(discoveryStat.summary);
        
        if (discoveryStat.summary.success && Array.isArray(discoveryStat.ruleChunks)) {
            // Show rule types distribution
            const ruleTypes = {};
            discoveryStat.ruleChunks.forEach(rule => {
                const type = rule.ruleType || 'unknown';
                ruleTypes[type] = (ruleTypes[type] || 0) + 1;
            });
            
            const typeEntries = Object.entries(ruleTypes);
            if (typeEntries.length > 0) {
                console.log(`📊 Rule Types: ${typeEntries.map(([type, count]) => `${type}:${count}`).join(', ')}`);
            }
        }
    }

    /**
     * Log rule discovery verbose
     */
    logRuleDiscoveryVerbose(discoveryStat) {
        this.logRuleDiscoveryDetailed(discoveryStat);
        
        if (discoveryStat.summary.success && Array.isArray(discoveryStat.ruleChunks)) {
            // Show top rules by confidence
            const topRules = discoveryStat.ruleChunks
                .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                .slice(0, 5);
            
            console.log(`🏆 Top Rules:`);
            topRules.forEach((rule, index) => {
                const conf = Math.round((rule.confidence || 0) * 100);
                console.log(`  ${index + 1}. ${rule.ruleName || 'Unknown'} (${conf}%)`);
            });
        }
    }

    /**
     * Log content store summary
     */
    logContentStoreSummary(storeStats) {
        console.log(`💾 Storage: ${storeStats.totalChunks || 0} chunks, ${storeStats.totalFiles || 0} files`);
    }

    /**
     * Log content store detailed
     */
    logContentStoreDetailed(storeStats) {
        this.logContentStoreSummary(storeStats);
        
        if (storeStats.files) {
            console.log(`📁 Files: ${Object.keys(storeStats.files).join(', ')}`);
        }
    }

    /**
     * Get all statistics
     */
    getAllStats() {
        return this.stats;
    }

    /**
     * Get import statistics
     */
    getImportStats() {
        return this.stats.imports;
    }

    /**
     * Get rule discovery statistics
     */
    getRuleDiscoveryStats() {
        return this.stats.ruleDiscovery;
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return this.stats.performance;
    }

    /**
     * Clear all statistics
     */
    clearStats() {
        this.stats = {
            imports: [],
            ruleDiscovery: [],
            contentStore: {},
            performance: {}
        };
        console.log('RulespediaStatistics: All statistics cleared');
    }

    /**
     * Export statistics to JSON
     */
    exportStats() {
        return JSON.stringify(this.stats, null, 2);
    }

    /**
     * Get a formatted summary report
     */
    getSummaryReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalImports: this.stats.imports.length,
            totalRuleDiscoveries: this.stats.ruleDiscovery.length,
            lastImport: this.stats.imports.length > 0 ? this.stats.imports[this.stats.imports.length - 1].summary : null,
            lastRuleDiscovery: this.stats.ruleDiscovery.length > 0 ? this.stats.ruleDiscovery[this.stats.ruleDiscovery.length - 1].summary : null,
            contentStore: this.stats.contentStore
        };

        return report;
    }
}

// Export for use in other modules
window.RulespediaStatistics = RulespediaStatistics;

// Create global instance
window.rulespediaStats = new RulespediaStatistics();

console.log('RulespediaStatistics: Component loaded and ready'); 