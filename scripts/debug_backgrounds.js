/**
 * Debug script to help identify why backgrounds are being lost
 * Run this in the console to log all background-related actor updates
 */

// Store original Actor update method
const originalUpdate = Actor.prototype.update;

// Override to log backgrounds updates
Actor.prototype.update = async function(data, options = {}) {
    // Check if this update affects backgrounds
    if (data?.system?.miscellaneous?.backgrounds !== undefined) {
        // Background update detected - debug logging removed
    }
    
    // Call original update
    return originalUpdate.call(this, data, options);
};

// Also hook into preUpdate
Hooks.on('preUpdateActor', (actor, changes, options, userId) => {
    if (changes?.system?.miscellaneous?.backgrounds !== undefined) {
        // Pre-update background hook - debug logging removed
    }
});

// Hook into updateActor to see the result
Hooks.on('updateActor', (actor, changes, options, userId) => {
    if (changes?.system?.miscellaneous?.backgrounds !== undefined) {
        // Post-update background hook - debug logging removed
    }
});
