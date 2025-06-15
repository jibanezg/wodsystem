/**
 * LLM Service Test Script
 * Use this to test if the LLM service is working properly
 */

class LLMTest {
    constructor() {
        this.llmService = null;
        this.browserProvider = null;
    }

    /**
     * Run all tests
     */
    async runTests() {
        console.log('=== LLM Service Test Suite ===');
        
        try {
            await this.testEnvironment();
            await this.testTransformersLoading();
            await this.testLLMService();
            await this.testModelLoading();
            await this.testGeneration();
            
            console.log('✅ All tests passed! LLM service is working correctly.');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error('Please check the setup guide: LLM_SETUP.md');
        }
    }

    /**
     * Test environment compatibility
     */
    async testEnvironment() {
        console.log('Testing environment compatibility...');
        
        const issues = [];
        
        if (typeof fetch !== 'function') {
            issues.push('Fetch API not supported');
        }
        
        if (typeof Worker === 'undefined') {
            issues.push('Web Workers not supported');
        }
        
        if (typeof SharedArrayBuffer === 'undefined') {
            issues.push('SharedArrayBuffer not supported (warning only)');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ Environment issues found:', issues);
        } else {
            console.log('✅ Environment is compatible');
        }
    }

    /**
     * Test Transformers.js loading
     */
    async testTransformersLoading() {
        console.log('Testing Transformers.js loading...');
        
        if (window.transformers && window.transformers.pipeline) {
            console.log('✅ Transformers.js is loaded globally');
            return;
        }
        
        if (window.transformersPipeline) {
            console.log('✅ Transformers.js pipeline is available');
            return;
        }
        
        throw new Error('Transformers.js not found. Please add the script tag to your HTML.');
    }

    /**
     * Test LLM service creation
     */
    async testLLMService() {
        console.log('Testing LLM service creation...');
        
        if (typeof window.LLMService === 'undefined') {
            throw new Error('LLMService not found. Make sure llm-service.js is loaded.');
        }
        
        this.llmService = new window.LLMService();
        console.log('✅ LLM service created successfully');
    }

    /**
     * Test browser provider creation
     */
    async testBrowserProvider() {
        console.log('Testing browser provider creation...');
        
        if (typeof window.BrowserLLMProvider === 'undefined') {
            throw new Error('BrowserLLMProvider not found. Make sure llm-browser-integration.js is loaded.');
        }
        
        this.browserProvider = new window.BrowserLLMProvider({
            modelName: 'microsoft/DialoGPT-medium',
            quantized: true,
            progressCallback: (progress) => {
                console.log(`Model loading progress: ${Math.round(progress * 100)}%`);
            }
        });
        
        this.llmService.setProvider(this.browserProvider);
        console.log('✅ Browser provider created and set');
    }

    /**
     * Test model loading
     */
    async testModelLoading() {
        console.log('Testing model loading...');
        
        await this.testBrowserProvider();
        
        console.log('Loading model (this may take a few minutes on first run)...');
        await this.llmService.initialize();
        
        console.log('✅ Model loaded successfully');
    }

    /**
     * Test text generation
     */
    async testGeneration() {
        console.log('Testing text generation...');
        
        const testPrompt = "Hello, how are you?";
        const response = await this.llmService.generate(testPrompt, {
            maxTokens: 50,
            temperature: 0.1
        });
        
        console.log('✅ Text generation successful');
        console.log('Test prompt:', testPrompt);
        console.log('Model response:', response);
    }

    /**
     * Get service status
     */
    getStatus() {
        if (!this.llmService) {
            return { error: 'LLM service not initialized' };
        }
        
        return this.llmService.getStatus();
    }
}

// Export for use in console
window.LLMTest = LLMTest;

// Auto-run test if called directly
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LLMTest;
} else {
    // Auto-run in browser
    console.log('LLM Test script loaded. Run: new LLMTest().runTests() to test the LLM service.');
} 