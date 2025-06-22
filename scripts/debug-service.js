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

    // Handle all LLM generate events (call from LLMService)
    static llmGenerateEvent({ prompt, parameters, response, error, eventType }) {
        if (!DebugService.enabled) return;
        // eventType: 'call', 'response', 'error', 'fallback'
        switch (eventType) {
            case 'call':
                DebugService.log('LLM generate called', 'debug', 'LLM', { prompt, parameters });
                break;
            case 'response':
                DebugService.log('LLM raw response', 'debug', 'LLM', response);
                DebugService.addChunkStat({
                    type: 'llmResponse', prompt, parameters, response
                });
                break;
            case 'error':
                DebugService.log('LLM generate error', 'error', 'LLM', error);
                DebugService.addChunkStat({
                    type: 'llmError', prompt, parameters, error: error?.message, errorStack: error?.stack });
                break;
            case 'fallback':
                DebugService.log('Fallback generation used (fallbackMode active)', 'warn', 'LLM');
                DebugService.addChunkStat({ type: 'fallbackGeneration', prompt, parameters });
                break;
            default:
                DebugService.log('Unknown LLM generate event', 'warn', 'LLM', { eventType, prompt, parameters, response, error });
        }
    }

    // Handle all TensorFlow LLM provider events (call from TensorFlowLLMProvider)
    static tensorflowEvent({ eventType, message, data, error }) {
        if (!DebugService.enabled) return;
        // eventType: 'init_start', 'tf_load', 'tf_loaded', 'model_create', 'model_created', 'init_complete', 'init_failed'
        switch (eventType) {
            case 'init_start':
                DebugService.log('TensorFlowLLMProvider: Starting initialization', 'debug', 'TensorFlow');
                break;
            case 'tf_load':
                DebugService.log('TensorFlowLLMProvider: Loading TensorFlow.js library', 'debug', 'TensorFlow');
                break;
            case 'tf_loaded':
                DebugService.log('TensorFlowLLMProvider: TensorFlow.js loaded successfully', 'debug', 'TensorFlow', data);
                break;
            case 'tf_already_loaded':
                DebugService.log('TensorFlowLLMProvider: TensorFlow.js already loaded', 'debug', 'TensorFlow');
                break;
            case 'tf_global':
                DebugService.log('TensorFlowLLMProvider: TensorFlow.js found globally', 'debug', 'TensorFlow');
                break;
            case 'tf_cdn_success':
                DebugService.log('TensorFlowLLMProvider: TensorFlow.js loaded from CDN successfully', 'debug', 'TensorFlow');
                break;
            case 'tf_cdn_failed':
                DebugService.log('TensorFlowLLMProvider: Failed to load TensorFlow.js from CDN', 'error', 'TensorFlow', error);
                break;
            case 'tf_object_missing':
                DebugService.log('TensorFlowLLMProvider: TensorFlow.js loaded but tf object not available', 'error', 'TensorFlow', error);
                break;
            case 'model_create':
                DebugService.log('TensorFlowLLMProvider: Creating pattern recognition model', 'debug', 'TensorFlow');
                break;
            case 'model_created':
                DebugService.log('TensorFlowLLMProvider: Model created successfully', 'debug', 'TensorFlow', data);
                break;
            case 'init_complete':
                DebugService.log('TensorFlowLLMProvider: Initialization completed successfully', 'debug', 'TensorFlow');
                break;
            case 'init_failed':
                DebugService.log('TensorFlowLLMProvider: Initialization failed', 'error', 'TensorFlow', error);
                break;
            case 'model_exists':
                DebugService.log('TensorFlowLLMProvider: Model already exists, skipping initialization', 'debug', 'TensorFlow');
                break;
            case 'model_not_loaded':
                DebugService.log('TensorFlowLLMProvider: Model not loaded when generate() called', 'error', 'TensorFlow', error);
                DebugService.log('TensorFlowLLMProvider: Model state', 'debug', 'TensorFlow', data);
                break;
            default:
                DebugService.log('Unknown TensorFlow event', 'warn', 'TensorFlow', { eventType, message, data, error });
        }
    }
}

window.DebugService = DebugService; 