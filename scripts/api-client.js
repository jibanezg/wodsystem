/**
 * API Client
 * Handles HTTP requests with authentication support
 */
class APIClient {
    constructor(config) {
        this.config = config;
        this.token = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.apiKey = null;
    }

    /**
     * Set the API key for authentication
     * @param {string} apiKey - The API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.clearAuth();
    }

    /**
     * Clear stored authentication data
     */
    clearAuth() {
        this.token = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Check if we have a valid token
     * @returns {boolean} True if token exists and is not expired
     */
    hasValidToken() {
        if (!this.token || !this.tokenExpiry) return false;
        return Date.now() < (this.tokenExpiry - this.config.tokenExpiryBuffer);
    }

    /**
     * Authenticate with the API
     * @returns {Promise<Object>} Authentication response
     */
    async authenticate() {
        if (!this.apiKey) {
            throw new Error('API key is required for authentication');
        }

        const authConfig = this.config.auth;
        // Send application key as query parameter in URL (matching C# implementation)
        const url = `${this.config.baseUrl}${authConfig.endpoint}?${authConfig.paramName}=${encodeURIComponent(this.apiKey)}`;
        
        const requestOptions = {
            method: authConfig.method,
            body: JSON.stringify({}), // Empty JSON body as in C# code
            requireAuth: false
        };

        try {
            const response = await this.request(url, requestOptions);

            // Check if response contains an error
            if (response.error) {
                console.error('API Client: Authentication response contains error:', response.error);
                throw new Error(`Authentication failed: ${response.error.message || 'Unknown error'}`);
            }

            // Check if we have the required token
            if (!response.token) {
                console.error('API Client: No token in authentication response:', response);
                throw new Error('Authentication failed: No token received');
            }

            // Store tokens
            this.token = response.token;
            this.refreshToken = response.refreshToken;
            this.tokenExpiry = Date.now() + (60 * 60 * 1000); // 1 hour from now
            
            // If we have a refreshTokenTTL, use it for more accurate expiry
            if (response.refreshTokenTTL) {
                this.tokenExpiry = response.refreshTokenTTL * 1000; // Convert to milliseconds
                console.log('API Client: Using refreshTokenTTL for expiry:', new Date(this.tokenExpiry));
            }

            console.log('API Client: Authentication successful');
            console.log('API Client: Auth response:', response);
            console.log('API Client: Auth response keys:', Object.keys(response));
            console.log('API Client: Token stored:', this.token ? 'Yes' : 'No');
            console.log('API Client: Token length:', this.token ? this.token.length : 0);
            if (response.error) {
                console.log('API Client: Error details:', response.error);
            }
            return response;
        } catch (error) {
            console.error('API Client: Authentication failed:', error);
            throw error;
        }
    }

    /**
     * Ensure we have a valid token, authenticate if needed
     * @returns {Promise<void>}
     */
    async ensureAuthenticated() {
        if (!this.hasValidToken()) {
            await this.authenticate();
        }
    }

    /**
     * Make a generic HTTP request
     * @param {string} url - Full URL
     * @param {Object} options - Request options
     * @returns {Promise<Object>} Response data
     */
    async request(url, options = {}) {
        const {
            method = 'GET',
            headers = {},
            body = null,
            params = null,
            requireAuth = true
        } = options;

        // Add authentication if required
        if (requireAuth) {
            await this.ensureAuthenticated();
            const authConfig = this.config.auth;
            
            // Use token directly without Bearer prefix (matching C# implementation)
            if (this.token) {
                headers[authConfig.tokenHeader] = this.token;
                console.log('API Client: Adding auth header (token only):', this.token);
            }
        }

        // Merge default headers
        const finalHeaders = {
            ...this.config.defaultHeaders,
            ...headers
        };

        // Add query parameters to URL
        let finalUrl = url;
        if (params) {
            const urlObj = new URL(url);
            for (const [key, value] of params.entries()) {
                urlObj.searchParams.append(key, value);
            }
            finalUrl = urlObj.toString();
        }

        // For testing, try direct request first (works with CORS extensions)
        try {
            console.log(`API Client: Trying direct ${method} request to ${finalUrl}`);
            
            const response = await fetch(finalUrl, {
                method,
                headers: finalHeaders,
                body: body ? JSON.stringify(body) : null
            });

            if (!response.ok) {
                // Try to get the error response body for debugging
                let errorBody = '';
                try {
                    errorBody = await response.text();
                    console.error(`API Client: HTTP ${response.status} response body:`, errorBody);
                } catch (e) {
                    console.error(`API Client: Could not read error response body:`, e);
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
            }

            // Handle different response types
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (directError) {
            console.warn(`API Client: Direct request failed:`, directError.message);
            
            // If direct request fails, try CORS proxies (but they may not work with auth headers)
            const proxyServices = [
                'https://corsproxy.io/?',
                'https://api.allorigins.win/raw?url=',
                'https://thingproxy.freeboard.io/fetch/'
            ];

            let lastError = directError;

            for (const proxyUrl of proxyServices) {
                try {
                    const corsProxyUrl = `${proxyUrl}${encodeURIComponent(finalUrl)}`;
                    console.log(`API Client: Trying ${method} request to ${finalUrl} via ${proxyUrl}`);
                    
                    const response = await fetch(corsProxyUrl, {
                        method,
                        headers: finalHeaders,
                        body: body ? JSON.stringify(body) : null
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    // Handle different response types
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return await response.json();
                    } else {
                        return await response.text();
                    }
                } catch (error) {
                    console.warn(`API Client: Proxy ${proxyUrl} failed:`, error.message);
                    lastError = error;
                    continue; // Try next proxy
                }
            }

            // All methods failed
            console.error(`API Client: All request methods failed for ${method} ${finalUrl}`);
            throw lastError;
        }
    }

    /**
     * GET request
     * @param {string} url - Full URL
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Response data
     */
    async get(url, params = {}) {
        return await this.request(url, {
            method: 'GET',
            params: new URLSearchParams(params)
        });
    }

    /**
     * POST request
     * @param {string} url - Full URL
     * @param {Object} body - Request body
     * @returns {Promise<Object>} Response data
     */
    async post(url, body = {}) {
        return await this.request(url, {
            method: 'POST',
            body
        });
    }

    /**
     * Get authentication status
     * @returns {Object} Status information
     */
    getAuthStatus() {
        return {
            hasApiKey: !!this.apiKey,
            hasToken: !!this.token,
            hasValidToken: this.hasValidToken(),
            tokenExpiry: this.tokenExpiry,
            isExpired: this.tokenExpiry ? Date.now() >= this.tokenExpiry : true
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
} else if (typeof window !== 'undefined') {
    window.APIClient = APIClient;
} 