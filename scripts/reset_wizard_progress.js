/**
 * Console script to reset wizard progress for a character
 * 
 * Usage in browser console:
 * 1. Select the actor you want to reset
 * 2. Copy and paste this entire script into the console
 * 3. Press Enter
 * 
 * Or use the function directly:
 * resetWizardProgress(actor)
 */

async function resetWizardProgress(actor = null) {
  // Get the actor to reset
  if (!actor) {
    // Try to get the currently selected actor
    const selected = canvas.tokens?.controlled?.[0]?.actor || 
                     game.actors?.get(game.user?.character?.id) ||
                     Array.from(game.actors?.values() || [])[0];
    
    if (!selected) {
      console.error("No actor found. Please select a token or provide an actor ID or name.");
            return;
    }
    actor = selected;
  }
  
  if (typeof actor === 'string') {
    const searchValue = actor;
    // Try as ID first
    actor = game.actors.get(searchValue);
    
    // If not found, try to find by name (case-insensitive)
    if (!actor) {
      actor = Array.from(game.actors.values()).find(a => 
        a.name && a.name.toLowerCase() === searchValue.toLowerCase()
      );
    }
    
    // If still not found, try partial name match
    if (!actor) {
      const searchName = searchValue.toLowerCase();
      actor = Array.from(game.actors.values()).find(a => 
        a.name && a.name.toLowerCase().includes(searchName)
      );
    }
  }
  
  if (!actor) {
    console.error("Actor not found!");
        return;
  }
  
    
  try {
    // Clear the wizard progress flag
    await actor.unsetFlag('wodsystem', 'wizardProgress');
    
    // Optionally, you can also reset specific wizard-related data if needed
    // This is commented out by default - uncomment if you want to reset these too
    
    // Reset freebies data if it exists in system data
    // const updateData = {
    //   "system.miscellaneous.freebies": {
    //     remaining: 0,
    //     spent: {}
    //   }
    // };
    // await actor.update(updateData);
    // console.log("✓ Reset freebies data");
    
  } catch (error) {
    console.error("Error resetting wizard progress:", error);
  }
}

// Auto-run if an actor is selected
const selectedActor = canvas?.tokens?.controlled?.[0]?.actor || 
                     Array.from(game.actors?.values() || []).find(a => a.type === "Demon");
                     
if (selectedActor) {
  resetWizardProgress(selectedActor);
} else {
  }

// Make function available globally
window.resetWizardProgress = resetWizardProgress;
