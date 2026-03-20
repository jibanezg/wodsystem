/**
 * WoD Login Video Splash Screen
 * Plays a video when players log in, covers entire viewport, skippable with any key
 */
class LoginVideoSplash {
    constructor() {
        this.videoUrl = null;
        this.videoElement = null;
        this.overlayElement = null;
        this.isActive = false;
        this.initialize();
    }
    
    /**
     * Initialize the login splash system
     */
    initialize() {
        // Check if Foundry is ready
        if (game.ready) {
            // Foundry is already ready, show splash immediately
            this._checkAndShowSplash();
        } else {
            // Wait for Foundry to be ready
            Hooks.on('ready', () => {
                this._checkAndShowSplash();
            });
        }
    }
    
    /**
     * Check settings and show splash if conditions are met
     * @private
     */
    _checkAndShowSplash() {
        // Check settings and user permissions
        const enabled = game.settings.get('wodsystem', 'loginVideoEnabled');
        const showForGM = game.settings.get('wodsystem', 'loginVideoForGM');
        const videoUrl = game.settings.get('wodsystem', 'loginVideoUrl');
        
        if (!enabled) {
            return;
        }
        
        if (!showForGM && game.user.isGM) {
            return;
        }
        
        if (!videoUrl) {
            return;
        }
        
        // Wait a bit longer for Foundry to be fully ready
        setTimeout(() => {
            // Use the working Foundry Application approach with the correct URL
            this._showFoundrySplashApp(videoUrl);
        }, 2000); // 2 second delay
    }

    /**
     * Show the splash using Foundry Application (working method)
     * @private
     */
    _showFoundrySplashApp(videoUrl) {
        class VideoSplashApp extends Application {
            constructor(url) {
                super({
                    title: 'Login Splash',
                    template: 'systems/wodsystem/templates/apps/video-splash.hbs'
                });
                this.videoUrl = url; 
            }
            
            getData(options = {}) {
                return {
                    videoUrl: this.videoUrl
                };
            }
            
            activateListeners(html) {
                super.activateListeners(html);
                
                const video = html.find('video')[0];
                
                if (video) {
                    // Set video properties to prevent looping
                    video.loop = false;
                    video.autoplay = true;
                    video.muted = true;
                    
                    // Set video source from our instance variable
                    video.src = this.videoUrl;
                    
                    // Add event listeners for error handling
                    video.addEventListener('error', (e) => {
                        // Try fallback videos
                        this._tryFallbackVideos(video, html);
                    });
                    
                    video.addEventListener('ended', () => {
                        // Video will stay on last frame, user can dismiss with any key
                    });
                    
                    // Try to play the video
                    video.play().catch(err => {
                        // Silently handle play errors
                    });
                }
                
                const dismissHandler = (e) => {
                    e.preventDefault();
                    this.close();
                };
                
                // Use jQuery event listeners for Foundry v13
                $(document).on('keydown.dismiss', dismissHandler);
                html.on('click.dismiss', dismissHandler);
                
                // Clean up event listeners when closing
                this.close = () => {
                    $(document).off('keydown.dismiss');
                    html.off('click.dismiss');
                    super.close();
                };
            }
        }
        
        const app = new VideoSplashApp(videoUrl);
        app.render(true);
    }

    /**
     * Show the login splash video
     * @private
     */
    async _showLoginSplash() {
        // Debug logging
        console.log('WoD Login Splash | Starting splash check...');
        
        // Check settings and user permissions
        const enabled = game.settings.get('wodsystem', 'loginVideoEnabled');
        const showForGM = game.settings.get('wodsystem', 'loginVideoForGM');
        
        console.log('WoD Login Splash | Settings:', {
            enabled,
            showForGM,
            isGM: game.user.isGM,
            userId: game.user.id
        });
        
        if (!enabled) {
            console.log('WoD Login Splash | Video disabled in settings');
            return;
        }
        
        if (!showForGM && game.user.isGM) {
            console.log('WoD Login Splash | GM video disabled, skipping');
            return;
        }
        
        if (this.isActive) {
            console.log('WoD Login Splash | Already active, skipping');
            return;
        }

        // Get video URL from settings
        this.videoUrl = game.settings.get('wodsystem', 'loginVideoUrl');
        console.log('WoD Login Splash | Video URL:', this.videoUrl);
        
        // Handle local file URLs for testing (GM only)
        if (this.videoUrl.startsWith('file://') && game.user.isGM) {
            console.warn('WoD Login Splash: Using local file (GM only testing)');
        }
        
        // If no video URL configured, skip
        if (!this.videoUrl) {
            console.warn('WoD Login Splash: No video URL configured');
            return;
        }
        
        console.log('WoD Login Splash | Creating splash elements...');
        
        // Create the splash elements
        this._createSplashElements();
        
        // Show the splash
        this._showSplash();
        
        // Set up skip listeners
        this._setupSkipListeners();
        
        console.log('WoD Login Splash | Splash should now be visible');
    }

    /**
     * Create the DOM elements for the splash screen
     * @private
     */
    _createSplashElements() {
        // Create overlay container
        this.overlayElement = document.createElement('div');
        this.overlayElement.id = 'wod-login-splash';
        this.overlayElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #000;
            z-index: 99999;
            display: none;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        // Create video element
        this.videoElement = document.createElement('video');
        this.videoElement.style.cssText = `
            max-width: 100vw;
            max-height: 100vh;
            object-fit: contain;
        `;
        this.videoElement.autoplay = true;
        this.videoElement.muted = true; // Autoplay usually requires muted
        this.videoElement.src = this.videoUrl;

        // Create skip hint
        const skipHint = document.createElement('div');
        skipHint.style.cssText = `
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 18px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            background: rgba(0,0,0,0.5);
            padding: 10px 20px;
            border-radius: 25px;
            pointer-events: none;
            animation: pulse 2s infinite;
        `;
        skipHint.textContent = 'Press any key to skip';

        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        // Assemble the overlay
        this.overlayElement.appendChild(this.videoElement);
        this.overlayElement.appendChild(skipHint);
        
        // Try to append to Foundry's UI layer first
        const foundryUI = document.querySelector('#ui') || document.querySelector('#actors') || document.querySelector('#sidebar');
        if (foundryUI) {
            foundryUI.appendChild(this.overlayElement);
            console.log('WoD Login Splash | Added to Foundry UI container');
        } else {
            document.body.appendChild(this.overlayElement);
            console.log('WoD Login Splash | Added to document body');
        }
    }

    /**
     * Show the splash screen with fade-in effect
     * @private
     */
    _showSplash() {
        this.isActive = true;
        this.overlayElement.style.display = 'flex';
        this.overlayElement.style.opacity = '0';
        
        console.log('WoD Login Splash | Overlay element:', this.overlayElement);
        console.log('WoD Login Splash | Video element:', this.videoElement);
        console.log('WoD Login Splash | Overlay styles:', {
            display: this.overlayElement.style.display,
            opacity: this.overlayElement.style.opacity,
            zIndex: this.overlayElement.style.zIndex,
            position: this.overlayElement.style.position
        });
        
        // Fade in
        requestAnimationFrame(() => {
            this.overlayElement.style.transition = 'opacity 0.5s ease-in';
            this.overlayElement.style.opacity = '1';
            console.log('WoD Login Splash | Fading in...');
        });

        // Auto-hide when video ends
        this.videoElement.addEventListener('ended', () => {
            console.log('WoD Login Splash | Video ended, hiding splash');
            this._hideSplash();
        });

        // Handle video errors
        this.videoElement.addEventListener('error', (e) => {
            console.error('WoD Login Splash: Video failed to load:', e);
            console.log('WoD Login Splash | Video error details:', {
                error: this.videoElement.error,
                src: this.videoElement.src,
                networkState: this.videoElement.networkState,
                readyState: this.videoElement.readyState
            });
            this._hideSplash();
        });
        
        // Add video load success listener
        this.videoElement.addEventListener('loadeddata', () => {
            console.log('WoD Login Splash | Video loaded successfully');
        });
        
        // Add video playing listener
        this.videoElement.addEventListener('playing', () => {
            console.log('WoD Login Splash | Video started playing');
        });
    }

    /**
     * Set up event listeners for skipping
     * @private
     */
    _setupSkipListeners() {
        const skipHandler = (e) => {
            if (!this.isActive) return;
            
            // Prevent any default behavior
            e.preventDefault();
            e.stopPropagation();
            
            this._hideSplash();
        };

        // Listen for any key press
        document.addEventListener('keydown', skipHandler);
        
        // Also listen for mouse click/touch as alternative skip
        this.overlayElement.addEventListener('click', skipHandler);
        this.overlayElement.addEventListener('touchstart', skipHandler);

        // Store handler reference for cleanup
        this._skipHandler = skipHandler;
    }

    /**
     * Hide the splash screen with fade-out effect
     * @private
     */
    _hideSplash() {
        if (!this.isActive) return;

        this.isActive = false;
        this.overlayElement.style.transition = 'opacity 0.5s ease-out';
        this.overlayElement.style.opacity = '0';

        // Remove from DOM after fade out
        setTimeout(() => {
            if (this.overlayElement && this.overlayElement.parentNode) {
                this.overlayElement.parentNode.removeChild(this.overlayElement);
            }
            
            // Clean up event listeners
            if (this._skipHandler) {
                document.removeEventListener('keydown', this._skipHandler);
                this.overlayElement.removeEventListener('click', this._skipHandler);
                this.overlayElement.removeEventListener('touchstart', this._skipHandler);
            }
            
            // Clean up references
            this.videoElement = null;
            this.overlayElement = null;
            this._skipHandler = null;
        }, 500);
    }

    /**
     * Public method to manually trigger the splash (for testing or events)
     * @param {string} videoUrl - Optional custom video URL
     */
    async playSplash(videoUrl = null) {
        console.log('WoD Login Splash | Manual trigger called with URL:', videoUrl);
        
        if (videoUrl) {
            this.videoUrl = videoUrl;
        }
        
        if (this.isActive) {
            console.log('WoD Login Splash | Hiding existing splash first');
            this._hideSplash(); // Hide existing if showing
            await new Promise(resolve => setTimeout(resolve, 600)); // Wait for hide animation
        }
        
        console.log('WoD Login Splash | Starting manual splash');
        await this._showLoginSplash();
    }
}

// Create and export singleton instance
export const loginVideoSplash = new LoginVideoSplash();

// Add global access for testing
Hooks.on('ready', () => {
    game.wod = game.wod || {};
    game.wod.loginVideoSplash = loginVideoSplash;
    
    // Test functions for manual testing
    window.testLoginSplash = () => {
        console.log('Testing login splash...');
        if (game.wod?.loginVideoSplash) {
            game.wod.loginVideoSplash._showLoginSplash();
        } else {
            console.error('Login splash system not loaded');
        }
    };
    
    window.testFoundrySplash = (url) => {
        console.log('Testing Foundry Application splash...');
        if (game.wod?.loginVideoSplash) {
            game.wod.loginVideoSplash._showFoundrySplashApp(url || 'https://i.imgur.com/4kODPwu.mp4');
        } else {
            console.error('Login splash system not loaded');
        }
    };
    
    // Reset function to allow testing again
    window.resetLoginSplash = () => {
        console.log('Resetting login splash flag for testing...');
        if (game.wod) {
            game.wod.loginVideoShown = false;
            console.log('WoD Login Splash | Reset complete - video will show on next reload/trigger');
        }
    };
    
    // Add console command for testing
    window.testOverlay = () => {
        console.log('Testing overlay visibility...');
        const testDiv = document.createElement('div');
        testDiv.id = 'wod-test-overlay';
        testDiv.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff) !important;
            z-index: 999999 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            color: white !important;
            font-size: 48px !important;
            font-family: Arial, sans-serif !important;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8) !important;
            border: 10px solid yellow !important;
            box-sizing: border-box !important;
        `;
        testDiv.innerHTML = '⚠️ TEST OVERLAY ⚠️<br>Press any key to dismiss';
        document.body.appendChild(testDiv);
        
        // Force to front
        setTimeout(() => {
            testDiv.style.zIndex = '999999';
            document.body.appendChild(testDiv); // Re-append to bring to front
        }, 100);
        
        const dismissHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            testDiv.remove();
            document.removeEventListener('keydown', dismissHandler);
            testDiv.removeEventListener('click', dismissHandler);
            console.log('Test overlay dismissed');
        };
        
        document.addEventListener('keydown', dismissHandler);
        testDiv.addEventListener('click', dismissHandler);
        
        console.log('Test overlay created - should be VERY visible rainbow screen');
    };
    
    // Add Foundry Application-based splash as fallback
    window.testFoundrySplash = (url) => {
        console.log('Testing Foundry Application splash...');
        
        class VideoSplashApp extends Application {
            constructor(videoUrl) {
                super({
                    title: 'Login Splash',
                    template: 'systems/wodsystem/templates/apps/video-splash.hbs'
                });
                this.videoUrl = videoUrl;
            }
            
            getData(options = {}) {
                return {
                    videoUrl: this.videoUrl
                };
            }
            
            activateListeners(html) {
                super.activateListeners(html);
                
                const dismissHandler = (e) => {
                    e.preventDefault();
                    this.close();
                };
                
                // Use jQuery event listeners for Foundry v13
                $(document).on('keydown.dismiss', dismissHandler);
                html.on('click.dismiss', dismissHandler);
                
                // Auto-dismiss after video ends
                const video = html.find('video')[0];
                if (video) {
                    video.addEventListener('ended', () => {
                        $(document).off('keydown.dismiss');
                        html.off('click.dismiss');
                        this.close();
                    });
                }
                
                // Clean up event listeners when closing
                this.close = () => {
                    $(document).off('keydown.dismiss');
                    html.off('click.dismiss');
                    super.close();
                };
            }
        }
        
        const app = new VideoSplashApp(url);
        app.render(true);
    };
    
    console.log('WoD Login Splash | Use window.testFoundrySplash() for Foundry app test');
});
