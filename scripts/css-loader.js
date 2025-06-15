/**
 * CSS Loader Utility for Foundry VTT
 * Loads external CSS files and injects them into the DOM
 */

class CSSLoader {
    static async loadCSS(cssPath) {
        try {
            const response = await fetch(cssPath);
            if (!response.ok) {
                throw new Error(`Failed to load CSS: ${response.status} ${response.statusText}`);
            }
            
            const cssText = await response.text();
            
            // Create a style element
            const styleElement = document.createElement('style');
            styleElement.id = `css-loader-${cssPath.replace(/[^a-zA-Z0-9]/g, '-')}`;
            styleElement.textContent = cssText;
            
            // Add to head
            document.head.appendChild(styleElement);
            
            return true;
        } catch (error) {
            console.error(`CSS Loader | Failed to load ${cssPath}:`, error);
            return false;
        }
    }
    
    static async loadMultipleCSS(cssPaths) {
        const results = [];
        for (const path of cssPaths) {
            const success = await this.loadCSS(path);
            results.push({ path, success });
        }
        return results;
    }
}

// Export for use in other modules
window.CSSLoader = CSSLoader;

/**
 * Rulespedia CSS Loader
 * Loads the main Rulespedia CSS file
 */

class RulespediaCSSLoader {
    constructor() {
        this.cssFiles = [
            'systems/wodsystem/styles/rulespedia/rulespedia.css'
        ];
        this.loadedFiles = new Set();
    }

    /**
     * Load all CSS files
     */
    async loadAllCSS() {
        try {
            const loadPromises = this.cssFiles.map(file => this.loadCSSFile(file));
            await Promise.all(loadPromises);
        } catch (error) {
            console.error('RulespediaCSSLoader: Error loading CSS files:', error);
        }
    }

    /**
     * Load a single CSS file
     */
    async loadCSSFile(filePath) {
        if (this.loadedFiles.has(filePath)) {
            return;
        }

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}: ${response.status}`);
            }

            const cssText = await response.text();
            
            // Create a style element and inject the CSS
            const style = document.createElement('style');
            const styleId = `rulespedia-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
            style.id = styleId;
            style.textContent = cssText;
            document.head.appendChild(style);
            
            this.loadedFiles.add(filePath);
            
        } catch (error) {
            console.error(`RulespediaCSSLoader: Error loading ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Load a specific CSS file (for dynamic loading)
     */
    async loadSpecificCSS(filePath) {
        return await this.loadCSSFile(filePath);
    }

    /**
     * Unload a CSS file
     */
    unloadCSS(filePath) {
        const styleId = `rulespedia-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const styleElement = document.getElementById(styleId);
        
        if (styleElement) {
            styleElement.remove();
            this.loadedFiles.delete(filePath);
        }
    }

    /**
     * Check if a CSS file is loaded
     */
    isLoaded(filePath) {
        return this.loadedFiles.has(filePath);
    }

    /**
     * Get list of loaded files
     */
    getLoadedFiles() {
        return Array.from(this.loadedFiles);
    }
}

// Create global instance immediately
window.RulespediaCSSLoader = RulespediaCSSLoader;
window.rulespediaCSSLoader = new RulespediaCSSLoader();

// Auto-load CSS when the script is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (window.rulespediaCSSLoader) {
        window.rulespediaCSSLoader.loadAllCSS();
    } else {
        window.rulespediaCSSLoader = new window.RulespediaCSSLoader();
        window.rulespediaCSSLoader.loadAllCSS();
    }
}); 