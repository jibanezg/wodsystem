class DebugService {
    static enabled = false;
    static levels = ['debug', 'info', 'warn', 'error'];
    static state = {
        llmStatus: null,
        chunkStats: [],
        other: {}
    };

    static enable() {
        DebugService.enabled = true;
        console.info('[DebugService] Debug logging ENABLED');
    }

    static disable() {
        DebugService.enabled = false;
        console.info('[DebugService] Debug logging DISABLED');
    }

    /**
     * Log a message if debugging is enabled
     * @param {string} message - The message to log
     * @param {string} level - Log level: debug, info, warn, error (default: info)
     * @param {string} category - Optional category/tag for the log
     * @param {...any} args - Additional arguments to log
     */
    static log(message, level = 'info', category = '', ...args) {
        if (!DebugService.enabled) return;
        if (!DebugService.levels.includes(level)) level = 'info';
        const tag = category ? `[${category}]` : '';
        const prefix = `[DebugService]${tag}`;
        switch (level) {
            case 'debug':
                console.debug(prefix, message, ...args);
                break;
            case 'info':
                console.info(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            case 'error':
                console.error(prefix, message, ...args);
                break;
            default:
                console.log(prefix, message, ...args);
        }
    }

    // Store LLM initialization/provider/model status
    static setLLMStatus(statusObj) {
        if (!DebugService.enabled) return;
        DebugService.state.llmStatus = {
            ...statusObj,
            timestamp: new Date().toISOString()
        };
    }

    // Add per-chunk analysis stats
    static addChunkStat(statObj) {
        if (!DebugService.enabled) return;
        DebugService.state.chunkStats.push({
            ...statObj,
            timestamp: new Date().toISOString()
        });
    }

    // Get a summary of all tracked debug info
    static getSummary() {
        return {
            llmStatus: DebugService.state.llmStatus,
            chunkStatsCount: DebugService.state.chunkStats.length,
            chunkStats: DebugService.state.chunkStats.slice(),
            other: { ...DebugService.state.other }
        };
    }

    // Clear all debug state
    static clear() {
        DebugService.state = {
            llmStatus: null,
            chunkStats: [],
            other: {}
        };
        DebugService.log('Debug state cleared', 'info', 'DebugService');
    }
}

window.DebugService = DebugService; 