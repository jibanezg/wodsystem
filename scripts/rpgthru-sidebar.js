/**
 * RPGThru Sidebar UI Management
 * Handles the sidebar tab and content for RPGThru integration
 */

class RpgThruSidebar {
    constructor() {
        this.originalContent = null;
        this.isInitialized = false;
        this.contentCreated = false;
        this.apiController = null;
    }

    /**
     * Initialize the RPGThru sidebar functionality
     */
    async init() {
        if (this.isInitialized) {
            console.log("WoD | RPGThru Sidebar already initialized, skipping");
            return;
        }
        
        // Load API configuration
        try {
            console.log("WoD | Starting API initialization...");
            
            // Check if global functions are available
            if (typeof loadApiConfig !== 'function') {
                throw new Error('loadApiConfig function not found. API utils not loaded.');
            }
            
            if (typeof getServiceConfig !== 'function') {
                throw new Error('getServiceConfig function not found. API utils not loaded.');
            }
            
            if (typeof DriveThruRPGController !== 'function') {
                throw new Error('DriveThruRPGController class not found. API controller not loaded.');
            }
            
            console.log("WoD | Global API functions found, loading config...");
            const config = await loadApiConfig();
            console.log("WoD | Config loaded:", config);
            
            const drivethrurpgConfig = getServiceConfig(config, 'drivethrurpg');
            console.log("WoD | DriveThruRPG config:", drivethrurpgConfig);
            
            if (!drivethrurpgConfig) {
                throw new Error('DriveThruRPG configuration not found in config file.');
            }
            
            // Initialize API controller
            console.log("WoD | Creating DriveThruRPG controller...");
            this.apiController = new DriveThruRPGController();
            this.apiController.initialize(drivethrurpgConfig);
            
            // Make controller globally available
            window.RpgThruController = this.apiController;
            
            console.log("WoD | API Controller initialized successfully and made globally available");
            console.log("WoD | Window controller check:", !!window.RpgThruController);
            
        } catch (error) {
            console.error("WoD | Failed to initialize API Controller:", error);
            console.error("WoD | Error details:", error.message);
            console.error("WoD | Available globals:", {
                loadApiConfig: typeof loadApiConfig,
                getServiceConfig: typeof getServiceConfig,
                DriveThruRPGController: typeof DriveThruRPGController,
                APIClient: typeof APIClient
            });
            
            // Create a fallback controller even if config fails
            console.log("WoD | Creating fallback controller...");
            try {
                this.apiController = new DriveThruRPGController();
                window.RpgThruController = this.apiController;
                console.log("WoD | Fallback controller created and made globally available");
                console.log("WoD | Window controller check after fallback:", !!window.RpgThruController);
            } catch (fallbackError) {
                console.error("WoD | Failed to create fallback controller:", fallbackError);
            }
        }
        
        // Initialize the sidebar with all functionality
        this.initializeSidebar();
        
        this.isInitialized = true;
        console.log("WoD | RPGThru Sidebar initialized");
    }

    /**
     * Set up event handlers for the sidebar
     */
    setupEventHandlers() {
        // Handle RPGThru tab click
        $(document).on('click', 'a[data-tab="rpgthru"]', this.handleTabClick.bind(this));
        
        // Handle clicks on other tabs to restore content
        $(document).on('click', '#sidebar-tabs a.item:not([data-tab="rpgthru"])', this.handleOtherTabClick.bind(this));
        
        // Handle connect button
        $(document).on('click', '.rpgthru-connect-btn', this.handleConnectClick.bind(this));
        
        // Handle disconnect button
        $(document).on('click', '.rpgthru-disconnect-btn', this.handleDisconnectClick.bind(this));
        
        // Handle clear API key button
        $(document).on('click', '.rpgthru-clear-api-key', this.handleClearApiKey.bind(this));
        
        // Handle API key input changes
        $(document).on('input', '#rpgthru-api-key', this.handleApiKeyInput.bind(this));
    }

    /**
     * Handle RPGThru tab click
     */
    handleTabClick(event) {
        console.log("WoD | RPGThru tab clicked - starting content creation");
        
        // Remove any existing content first - be more aggressive
        $('.rpgthru-sidebar-content').remove();
        $('.rpgthru-connect-btn').remove();
        $('.rpgthru-iframe-section').remove();
        
        // Also remove any content that might be in the sidebar
        $('#sidebar .directory-list').find('.rpgthru-sidebar-content').remove();
        
        console.log("WoD | Cleaned up existing content");
        
        // Reset the content created flag
        this.contentCreated = false;
        
        // Hide all other sidebar sections and show ours
        this.showRpgThruSection();
        this.updateTabStyling(event.currentTarget);
    }

    /**
     * Show the RPGThru section and hide others
     */
    async showRpgThruSection() {
        console.log("WoD | showRpgThruSection called");
        
        // First, ensure our section exists
        await this.ensureRpgThruSection();
        
        // Hide all other sidebar sections
        const otherSections = $('#sidebar .sidebar-tab');
        console.log("WoD | Found", otherSections.length, "other sidebar sections to hide");
        otherSections.hide();
        
        // Show our RPGThru section
        const rpgthruSection = $('#sidebar .rpgthru-sidebar');
        console.log("WoD | Looking for RPGThru section, found:", rpgthruSection.length);
        
        if (rpgthruSection.length > 0) {
            rpgthruSection.show();
            console.log("WoD | Showing RPGThru section");
            
            // Force the section to be visible with CSS
            rpgthruSection.css({
                'display': 'flex !important',
                'visibility': 'visible !important',
                'opacity': '1 !important'
            });
        } else {
            console.log("WoD | ERROR: RPGThru section not found!");
        }
        
        this.showRpgThruContent();
    }

    /**
     * Ensure the RPGThru section exists
     */
    async ensureRpgThruSection() {
        // Check if our RPGThru section already exists
        let rpgthruSection = $('#sidebar .rpgthru-sidebar');
        if (rpgthruSection.length === 0) {
            console.log("WoD | RPGThru section doesn't exist, creating it...");
            
            // Load the section template
            try {
                const sectionTemplate = await renderTemplate('systems/wodsystem/templates/rpgthru/rpgthru-sidebar-section.html');
                rpgthruSection = $(sectionTemplate);
                
                // Add it to the sidebar
                const sidebar = $('#sidebar');
                sidebar.append(rpgthruSection);
                console.log("WoD | Created new RPGThru sidebar section");
                
                // Verify the section was added
                setTimeout(() => {
                    const verifySection = $('#sidebar .rpgthru-sidebar');
                    console.log("WoD | Verification: RPGThru section found after creation:", verifySection.length);
                }, 50);
                
            } catch (error) {
                console.error("WoD | Error creating RPGThru section:", error);
                throw error;
            }
        } else {
            console.log("WoD | RPGThru section already exists");
        }

        console.log("WoD | Creating RPGThru content in sidebar");
        
        try {
            // Mark content as created
            this.contentCreated = true;
            
            // Force visibility and proper sizing with more aggressive CSS
            const rpgthruContent = $('.rpgthru-sidebar-content');
            if (rpgthruContent.length > 0) {
                console.log("WoD | Found", rpgthruContent.length, "content instances, applying styles to first one");
                
                // Remove all but the first instance
                if (rpgthruContent.length > 1) {
                    rpgthruContent.slice(1).remove();
                    console.log("WoD | Removed duplicate content instances");
                }
                
                // Apply aggressive styling to the first instance
                rpgthruContent.first().css({
                    'display': 'block !important',
                    'visibility': 'visible !important',
                    'opacity': '1 !important',
                    'height': '100% !important',
                    'width': '100% !important',
                    'min-height': '400px !important',
                    'position': 'relative !important',
                    'z-index': '9999 !important',
                    'background': '#2b2b2b !important',
                    'padding': '20px !important',
                    'margin': '0 !important',
                    'border': 'none !important',
                    'overflow': 'visible !important',
                    'box-sizing': 'border-box !important'
                });
                
                // Also force the connect button to be visible
                const connectBtn = rpgthruContent.find('.rpgthru-connect-btn');
                if (connectBtn.length > 0) {
                    connectBtn.css({
                        'display': 'flex !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'position': 'relative !important',
                        'z-index': '10000 !important',
                        'margin': '20px auto !important'
                    });
                }
                
                // Force the connect section to be visible
                const connectSection = rpgthruContent.find('.rpgthru-connect-section');
                if (connectSection.length > 0) {
                    connectSection.css({
                        'display': 'flex !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'height': '100% !important',
                        'width': '100% !important'
                    });
                }
            }
            
            // Debug: Check what was actually created
            setTimeout(() => {
                this.debugContent();
            }, 100);
            
        } catch (error) {
            console.error("WoD | Error loading RPGThru template:", error);
        }
    }

    /**
     * Load the RPGThru sidebar template
     */
    async loadTemplate() {
        try {
            const template = await renderTemplate('systems/wodsystem/templates/rpgthru/rpgthru-sidebar-section.html');
            return template;
        } catch (error) {
            console.error("WoD | Error loading template:", error);
            // Fallback to fallback template if main template loading fails
            return this.getFallbackTemplate();
        }
    }

    /**
     * Load fallback template if main template fails
     */
    async getFallbackTemplate() {
        try {
            const fallbackTemplate = await renderTemplate('systems/wodsystem/templates/rpgthru/rpgthru-sidebar-fallback.html');
            return fallbackTemplate;
        } catch (error) {
            console.error("WoD | Error loading fallback template:", error);
            // Last resort: return minimal HTML
            return '<div class="rpgthru-sidebar-content"><p>Error loading RPGThru content</p></div>';
        }
    }

    /**
     * Handle connect button click
     */
    handleConnectClick(event) {
        console.log("WoD | Connect button clicked");
        
        const apiKey = $('#rpgthru-api-key').val().trim();
        
        if (!apiKey) {
            ui.notifications.warn("Please enter your DriveThruRPG API key");
            return;
        }
        
        // Save the API key
        if (typeof RpgThruSettings !== 'undefined') {
            RpgThruSettings.setApiKey(apiKey);
            console.log("WoD | API key saved to settings");
        }
        
        // Check if controller is available
        let controller = window.RpgThruController;
        if (!controller && this.apiController) {
            console.log("WoD | Using local API controller instance");
            controller = this.apiController;
        }
        
        console.log("WoD | Controller availability check:", {
            windowController: !!window.RpgThruController,
            localController: !!this.apiController,
            finalController: !!controller
        });
        
        if (!controller) {
            console.error("WoD | RpgThruController not available");
            console.error("WoD | Available globals:", {
                loadApiConfig: typeof loadApiConfig,
                getServiceConfig: typeof getServiceConfig,
                DriveThruRPGController: typeof DriveThruRPGController,
                APIClient: typeof APIClient,
                windowRpgThruController: typeof window.RpgThruController
            });
            ui.notifications.error("RPGThru controller not available. Please refresh the page.");
            return;
        }
        
        console.log("WoD | Attempting to connect to DriveThruRPG...");
        
        // Show loading state
        const $btn = $(event.currentTarget);
        const originalText = $btn.html();
        $btn.html('<i class="fas fa-spinner fa-spin"></i> Connecting...');
        $btn.prop('disabled', true);
        
        // Authenticate with DriveThruRPG
        controller.setApiKey(apiKey);
        controller.authenticate()
            .then(response => {
                console.log("WoD | Authentication successful:", response);
                ui.notifications.info("Successfully connected to DriveThruRPG!");
                
                // Update UI to show connected state
                this.showConnectedState();
                
                // Fetch user's products
                return controller.getProducts();
            })
            .then(products => {
                console.log("WoD | Products fetched:", products);
                if (products && products.length > 0) {
                    ui.notifications.info(`Found ${products.length} products in your library`);
                } else {
                    ui.notifications.warn("No products found in your DriveThruRPG library");
                }
            })
            .catch(error => {
                console.error("WoD | Connection failed:", error);
                
                // Check if it's a CORS or proxy error
                if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('CORS proxies failed'))) {
                    ui.notifications.error("CORS Error: DriveThruRPG API doesn't allow direct browser access. Solutions: 1) Install 'CORS Unblock' browser extension, 2) Use a different browser, 3) Contact DriveThruRPG for API access.");
                } else if (error.message && error.message.includes('403')) {
                    ui.notifications.error("Access Denied: The API key may be invalid or the service may be temporarily unavailable. Please check your API key and try again.");
                } else {
                    ui.notifications.error(`Failed to connect: ${error.message || 'Unknown error'}`);
                }
            })
            .finally(() => {
                // Restore button state
                $btn.html(originalText);
                $btn.prop('disabled', false);
            });
    }

    /**
     * Show connected state in the UI
     */
    showConnectedState() {
        const $btn = $('.rpgthru-connect-btn');
        $btn.html('<i class="fas fa-check"></i> Connected to DriveThruRPG');
        $btn.css('background', '#28a745');
        $btn.prop('disabled', true);
        
        // Add a disconnect button
        if (!$('.rpgthru-disconnect-btn').length) {
            $btn.after('<button class="rpgthru-disconnect-btn"><i class="fas fa-unlink"></i> Disconnect</button>');
        }
    }

    /**
     * Show disconnected state in the UI
     */
    showDisconnectedState() {
        const $btn = $('.rpgthru-connect-btn');
        $btn.html('<i class="fas fa-plug"></i> Connect to DriveThruRPG');
        $btn.css('background', '#8b0000');
        $btn.prop('disabled', false);
        
        // Remove disconnect button
        $('.rpgthru-disconnect-btn').remove();
    }

    /**
     * Handle disconnect button click
     */
    handleDisconnectClick(event) {
        console.log("WoD | Disconnect button clicked");
        
        // Clear the API key
        if (typeof RpgThruSettings !== 'undefined') {
            RpgThruSettings.setApiKey('');
        }
        
        // Update UI
        this.showDisconnectedState();
        this.updateApiKeyStatus(false, "Disconnected");
        
        ui.notifications.info("Disconnected from DriveThruRPG");
    }

    /**
     * Handle clicks on other tabs
     */
    handleOtherTabClick(event) {
        const clickedTab = $(event.currentTarget);
        const tabName = clickedTab.data('tab');
        
        console.log("WoD | Other tab clicked:", tabName);
        
        // Hide our RPGThru section
        $('#sidebar .rpgthru-sidebar').hide();
        
        // Show the appropriate section for the clicked tab
        if (tabName) {
            const targetSection = $(`#sidebar .${tabName}-sidebar`);
            if (targetSection.length > 0) {
                targetSection.show();
                console.log("WoD | Showing section for tab:", tabName);
            }
        }
        
        // Reset our content created flag
        this.contentCreated = false;
    }

    /**
     * Restore the original sidebar content
     */
    restoreOriginalContent() {
        // Hide our RPGThru section when other tabs are clicked
        const rpgthruSection = $('#sidebar .rpgthru-sidebar');
        if (rpgthruSection.length > 0) {
            rpgthruSection.hide();
        }
        
        // Reset our content created flag
        this.contentCreated = false;
    }

    /**
     * Update tab styling
     */
    updateTabStyling(clickedTab) {
        $('#sidebar-tabs a.item').removeClass('active');
        $(clickedTab).addClass('active');
    }

    /**
     * Debug content creation - FOCUSED ON CONNECT BUTTON VISIBILITY
     */
    debugContent() {
        console.log("=== WoD | CONNECT BUTTON DEBUGGING ===");
        
        const sidebar = $('#sidebar');
        const rpgthruContent = $('.rpgthru-sidebar-content');
        const connectButton = $('.rpgthru-connect-btn');
        
        console.log("1. Sidebar found:", sidebar.length > 0);
        console.log("2. RPGThru content found:", rpgthruContent.length);
        console.log("3. Connect button found:", connectButton.length);
        
        if (rpgthruContent.length > 0) {
            const content = rpgthruContent.first();
            console.log("4. RPGThru content visible:", content.is(':visible'));
            console.log("5. RPGThru content display:", content.css('display'));
            console.log("6. RPGThru content height:", content.height());
            console.log("7. RPGThru content width:", content.width());
            if (content[0]) {
                console.log("8. RPGThru content computed style:", window.getComputedStyle(content[0]).display);
            }
            console.log("9. RPGThru content parent:", content.parent().prop('tagName'), content.parent().attr('class'));
            console.log("10. RPGThru content HTML:", content.html().substring(0, 200) + "...");
        }
        
        if (connectButton.length > 0) {
            const btn = connectButton.first();
            console.log("11. Connect button visible:", btn.is(':visible'));
            console.log("12. Connect button display:", btn.css('display'));
            console.log("13. Connect button parent visible:", btn.parent().is(':visible'));
            if (btn[0]) {
                console.log("14. Connect button computed style:", window.getComputedStyle(btn[0]).display);
            }
            console.log("15. Connect button parent:", btn.parent().prop('tagName'), btn.parent().attr('class'));
        }
        
        if (sidebar.length > 0) {
            console.log("16. Sidebar HTML length:", sidebar.html().length);
            console.log("17. Sidebar children:", sidebar.children().length);
            console.log("18. Sidebar children classes:", sidebar.children().map(function() { return this.className; }).get());
        }
        console.log("=== END DEBUGGING ===");
    }

    /**
     * Show RPGThru content in the sidebar
     */
    async showRpgThruContent() {
        // Prevent multiple content creation
        if (this.contentCreated) {
            console.log("WoD | Content already created, skipping");
            return;
        }

        console.log("WoD | Creating RPGThru content in sidebar");
        
        try {
            // Mark content as created
            this.contentCreated = true;
            
            // Force visibility and proper sizing with more aggressive CSS
            const rpgthruContent = $('.rpgthru-sidebar-content');
            if (rpgthruContent.length > 0) {
                console.log("WoD | Found", rpgthruContent.length, "content instances, applying styles to first one");
                
                // Remove all but the first instance
                if (rpgthruContent.length > 1) {
                    rpgthruContent.slice(1).remove();
                    console.log("WoD | Removed duplicate content instances");
                }
                
                // Apply aggressive styling to the first instance
                rpgthruContent.first().css({
                    'display': 'block !important',
                    'visibility': 'visible !important',
                    'opacity': '1 !important',
                    'height': '100% !important',
                    'width': '100% !important',
                    'min-height': '400px !important',
                    'position': 'relative !important',
                    'z-index': '9999 !important',
                    'background': '#2b2b2b !important',
                    'padding': '20px !important',
                    'margin': '0 !important',
                    'border': 'none !important',
                    'overflow': 'visible !important',
                    'box-sizing': 'border-box !important'
                });
                
                // Also force the connect button to be visible
                const connectBtn = rpgthruContent.find('.rpgthru-connect-btn');
                if (connectBtn.length > 0) {
                    connectBtn.css({
                        'display': 'flex !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'position': 'relative !important',
                        'z-index': '10000 !important',
                        'margin': '20px auto !important'
                    });
                }
                
                // Force the connect section to be visible
                const connectSection = rpgthruContent.find('.rpgthru-connect-section');
                if (connectSection.length > 0) {
                    connectSection.css({
                        'display': 'flex !important',
                        'visibility': 'visible !important',
                        'opacity': '1 !important',
                        'height': '100% !important',
                        'width': '100% !important'
                    });
                }
            }
            
            // Debug: Check what was actually created
            setTimeout(() => {
                this.debugContent();
            }, 100);
            
        } catch (error) {
            console.error("WoD | Error loading RPGThru template:", error);
        }
    }

    /**
     * Handle clear API key button
     */
    handleClearApiKey(event) {
        console.log("WoD | Clear API key button clicked");
        
        // Clear the input field
        $('#rpgthru-api-key').val('');
        
        // Clear from settings
        if (typeof RpgThruSettings !== 'undefined') {
            RpgThruSettings.setApiKey('');
            console.log("WoD | API key cleared from settings");
        }
        
        // Update status
        this.updateApiKeyStatus(false, "API key cleared");
        
        ui.notifications.info("API key cleared");
    }

    /**
     * Handle API key input changes
     */
    handleApiKeyInput(event) {
        console.log("WoD | API key input changed");
    }

    /**
     * Initialize the sidebar content
     */
    initializeSidebar() {
        console.log("WoD | Initializing RPGThru sidebar...");
        
        // Load the template
        this.loadTemplate();
        
        // Set up event handlers
        this.setupEventHandlers();
        
        // Load stored API key
        this.loadStoredApiKey();
        
        console.log("WoD | RPGThru sidebar initialized successfully");
    }

    /**
     * Load the stored API key into the input field
     */
    loadStoredApiKey() {
        try {
            // Check if RpgThruSettings is available
            if (typeof RpgThruSettings !== 'undefined') {
                const apiKey = RpgThruSettings.getApiKey();
                if (apiKey) {
                    $('#rpgthru-api-key').val(apiKey);
                    this.updateApiKeyStatus(true, "API key loaded");
                    console.log("WoD | Loaded stored API key");
                } else {
                    this.updateApiKeyStatus(false, "No API key stored");
                    console.log("WoD | No stored API key found");
                }
            } else {
                console.warn("WoD | RpgThruSettings not available");
                this.updateApiKeyStatus(false, "Settings not available");
            }
        } catch (error) {
            console.error("WoD | Error loading stored API key:", error);
            this.updateApiKeyStatus(false, "Error loading API key");
        }
    }

    /**
     * Update the API key status display
     */
    updateApiKeyStatus(hasKey, message) {
        const indicator = $('.rpgthru-api-key-indicator');
        const text = $('.rpgthru-api-key-text');
        
        if (hasKey) {
            indicator.html('<i class="fas fa-check-circle" style="color: green;"></i>');
            text.text(message);
        } else {
            indicator.html('<i class="fas fa-exclamation-circle" style="color: orange;"></i>');
            text.text(message);
        }
    }
}

// Export the class
export { RpgThruSidebar }; 