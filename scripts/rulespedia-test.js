/**
 * Rulespedia Test Script
 * Tests the availability and functionality of Rulespedia components
 */

// Test function to check if all required classes are available
function testRulespediaComponents() {
    const testResults = {
        classes: {},
        services: {},
        views: {}
    };

    // Test class availability
    const classesToTest = [
        'ContentStore',
        'ImportService', 
        'BookManagementService',
        'RulespediaServiceManager',
        'HomeView',
        'ImportView',
        'SearchView',
        'ManageView',
        'SettingsView'
    ];

    classesToTest.forEach(className => {
        const isAvailable = typeof window[className] !== 'undefined';
        testResults.classes[className] = isAvailable;
    });

    // Test service creation
    try {
        if (window.ContentStore) {
            const contentStore = new window.ContentStore();
            testResults.services.contentStore = true;
        } else {
            testResults.services.contentStore = false;
        }
    } catch (error) {
        testResults.services.contentStore = false;
    }

    try {
        if (window.ImportService && window.ContentStore) {
            const contentStore = new window.ContentStore();
            const importService = new window.ImportService(contentStore);
            testResults.services.importService = true;
        } else {
            testResults.services.importService = false;
        }
    } catch (error) {
        testResults.services.importService = false;
    }

    try {
        if (window.BookManagementService && window.ContentStore) {
            const contentStore = new window.ContentStore();
            const bookManagementService = new window.BookManagementService(contentStore);
            testResults.services.bookManagementService = true;
        } else {
            testResults.services.bookManagementService = false;
        }
    } catch (error) {
        testResults.services.bookManagementService = false;
    }

    try {
        if (window.RulespediaServiceManager && window.ContentStore) {
            const contentStore = new window.ContentStore();
            const serviceManager = new window.RulespediaServiceManager(contentStore);
            testResults.services.serviceManager = true;
        } else {
            testResults.services.serviceManager = false;
        }
    } catch (error) {
        testResults.services.serviceManager = false;
    }

    // Test view creation
    try {
        if (window.HomeView) {
            const homeView = new window.HomeView();
            testResults.views.homeView = true;
        } else {
            testResults.views.homeView = false;
        }
    } catch (error) {
        testResults.views.homeView = false;
    }

    try {
        if (window.ImportView) {
            const importView = new window.ImportView();
            testResults.views.importView = true;
        } else {
            testResults.views.importView = false;
        }
    } catch (error) {
        testResults.views.importView = false;
    }

    try {
        if (window.SearchView) {
            const searchView = new window.SearchView();
            testResults.views.searchView = true;
        } else {
            testResults.views.searchView = false;
        }
    } catch (error) {
        testResults.views.searchView = false;
    }

    try {
        if (window.ManageView) {
            const manageView = new window.ManageView();
            testResults.views.manageView = true;
        } else {
            testResults.views.manageView = false;
        }
    } catch (error) {
        testResults.views.manageView = false;
    }

    return testResults;
}

// Export test function
if (typeof window !== 'undefined') {
    window.testRulespediaComponents = testRulespediaComponents;
} 