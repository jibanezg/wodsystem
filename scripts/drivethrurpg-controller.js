/**
 * DriveThruRPG Controller
 * Business logic for DriveThruRPG API operations
 */
class DriveThruRPGController {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        this.client = null;
        this.config = null;
    }

    /**
     * Initialize the controller
     * @param {Object} config - API configuration object
     */
    initialize(config) {
        this.config = config;
        this.client = new APIClient(config);
        if (this.apiKey) {
            this.client.setApiKey(this.apiKey);
        }
        console.log('DriveThruRPG Controller: Initialized');
    }

    /**
     * Set the API key
     * @param {string} apiKey - DriveThruRPG API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        if (this.client) {
            this.client.setApiKey(apiKey);
        }
    }

    /**
     * Authenticate with DriveThruRPG
     * @returns {Promise<Object>} Authentication response
     */
    async authenticate() {
        this._ensureInitialized();
        return await this.client.authenticate();
    }

    /**
     * Get products using vBeta API endpoint
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Products
     */
    async getProducts(options = {}) {
        this._ensureInitialized();

        const vBetaConfig = this.config.endpoints.vBeta;
        const endpointConfig = vBetaConfig.orderProducts;
        
        // Load pagination defaults from config
        const paginationDefaults = endpointConfig.pagination || { page: 1, pageSize: 15 };
        
        // Merge pagination defaults with provided options
        const queryParams = {
            page: paginationDefaults.page,
            pageSize: paginationDefaults.pageSize,
            ...options
        };
        
        const url = `${this.config.baseUrl}${endpointConfig.path}`;
        
        try {
            console.log('DriveThruRPG Controller: Trying vBeta products endpoint');
            return await this.client.get(url, queryParams);
        } catch (error) {
            console.warn('DriveThruRPG Controller: vBeta endpoint failed, trying v1 endpoint:', error.message);
            
            // Try v1 endpoint as fallback
            const v1Config = this.config.endpoints.v1;
            if (v1Config && v1Config.customerProducts) {
                const v1Url = `${v1Config.baseUrl}${v1Config.customerProducts.path}`;
                // Replace {customerId} placeholder with actual customer ID from token
                const customerId = this.getCustomerIdFromToken();
                const finalUrl = v1Url.replace('{customerId}', customerId);
                
                console.log('DriveThruRPG Controller: Trying v1 products endpoint:', finalUrl);
                return await this.client.get(finalUrl, queryParams);
            }
            
            throw error;
        }
    }

    /**
     * Extract customer ID from JWT token
     * @returns {string|null} Customer ID
     */
    getCustomerIdFromToken() {
        if (!this.client || !this.client.token) {
            return null;
        }
        
        try {
            // Decode JWT token to get customer ID
            const tokenParts = this.client.token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                return payload.customerId || null;
            }
        } catch (error) {
            console.error('DriveThruRPG Controller: Error decoding token:', error);
        }
        
        return null;
    }

    /**
     * Get authentication status
     * @returns {Object} Status information
     */
    getAuthStatus() {
        if (!this.client) {
            return {
                hasApiKey: !!this.apiKey,
                hasToken: false,
                hasValidToken: false,
                tokenExpiry: null,
                isExpired: true,
                initialized: false
            };
        }
        return {
            ...this.client.getAuthStatus(),
            initialized: true
        };
    }

    /**
     * Clear authentication data
     */
    clearAuth() {
        if (this.client) {
            this.client.clearAuth();
        }
    }

    /**
     * Ensure controller is initialized
     * @private
     */
    _ensureInitialized() {
        if (!this.client) {
            throw new Error('Controller not initialized. Call initialize() first.');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DriveThruRPGController;
} else if (typeof window !== 'undefined') {
    window.DriveThruRPGController = DriveThruRPGController;
} 