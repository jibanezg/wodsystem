/**
 * API Utilities
 * Simple utilities for API operations
 */

/**
 * Load API configuration from JSON file
 * @param {string} configPath - Path to the configuration file
 * @returns {Promise<Object>} Configuration object
 */
async function loadApiConfig(configPath = 'systems/wodsystem/config/api-config.json') {
    try {
        console.log('API Utils: Loading config from:', configPath);
        const response = await fetch(configPath);
        console.log('API Utils: Response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
        }
        
        const config = await response.json();
        console.log('API Utils: Configuration loaded successfully:', config);
        return config;
    } catch (error) {
        console.error('API Utils: Failed to load configuration:', error);
        
        // Return a fallback config if file loading fails
        console.log('API Utils: Using fallback configuration');
        return {
            "drivethrurpg": {
                "baseUrl": "https://api.drivethrurpg.com/api/vBeta",
                "timeout": 30000,
                "tokenExpiryBuffer": 300000,
                "defaultHeaders": {
                    "Content-Type": "application/json"
                },
                "auth": {
                    "endpoint": "/auth_key",
                    "method": "POST",
                    "paramName": "applicationKey",
                    "tokenHeader": "Authorization",
                    "tokenPrefix": "Bearer"
                },
                "endpoints": {
                    "vBeta": {
                        "orderProducts": {
                            "path": "/order_products",
                            "method": "GET",
                            "pagination": {
                                "page": 1,
                                "pageSize": 15
                            }
                        }
                    }
                }
            }
        };
    }
}

/**
 * Get service configuration from loaded config
 * @param {Object} config - Full configuration object
 * @param {string} serviceName - Name of the service (e.g., 'drivethrurpg')
 * @returns {Object|null} Service configuration
 */
function getServiceConfig(config, serviceName) {
    return config[serviceName] || null;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { loadApiConfig, getServiceConfig };
} else if (typeof window !== 'undefined') {
    window.loadApiConfig = loadApiConfig;
    window.getServiceConfig = getServiceConfig;
} 