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
        console.log('=== BACKGROUND UPDATE DETECTED ===');
        console.log('Actor:', this.name, this.id);
        console.log('Current backgrounds:', this.system.miscellaneous?.backgrounds);
        console.log('New backgrounds:', data.system.miscellaneous.backgrounds);
        console.log('Stack trace:', new Error().stack);
        console.log('===================================');
    }
    
    // Call original update
    return originalUpdate.call(this, data, options);
};

// Also hook into preUpdate
Hooks.on('preUpdateActor', (actor, changes, options, userId) => {
    if (changes?.system?.miscellaneous?.backgrounds !== undefined) {
        console.log('=== PRE-UPDATE HOOK: BACKGROUNDS ===');
        console.log('Actor:', actor.name, actor.id);
        console.log('Before:', actor.system.miscellaneous?.backgrounds);
        console.log('Changes:', changes.system.miscellaneous.backgrounds);
        console.log('====================================');
    }
});

// Hook into updateActor to see the result
Hooks.on('updateActor', (actor, changes, options, userId) => {
    if (changes?.system?.miscellaneous?.backgrounds !== undefined) {
        console.log('=== POST-UPDATE HOOK: BACKGROUNDS ===');
        console.log('Actor:', actor.name, actor.id);
        console.log('After update:', actor.system.miscellaneous?.backgrounds);
        console.log('=====================================');
    }
});

console.log('Background debugging enabled. All background updates will be logged to console.');
console.log('To disable, run: location.reload()');
