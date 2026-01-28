/**
 * Character Creation Wizard Factory
 * Creates the appropriate wizard class based on actor type
 */

import { MortalWizard } from './base/mortal-wizard.js';

// Import creature-specific wizards
import { DemonWizard } from './creatures/demon-wizard.js';
import { MageWizard } from './creatures/mage-wizard.js';
import { TechnocratWizard } from './creatures/technocrat-wizard.js';

/**
 * Map actor types to wizard classes
 */
const WIZARD_CLASSES = {
  'Mortal': MortalWizard,
  'Demon': DemonWizard,
  'Mage': MageWizard,
  'Technocrat': TechnocratWizard,
};

/**
 * Character Creation Wizard Factory
 * Creates the appropriate wizard instance based on actor type
 * 
 * This class acts as both a factory (static create method) and a constructor
 * for backward compatibility with existing code that uses `new WodCharacterWizard(actor)`.
 */
export class WodCharacterWizard {
  /**
   * Create a wizard instance for the given actor
   * @param {Actor} actor - The actor to create a wizard for
   * @param {Object} options - Options to pass to the wizard
   * @returns {MortalWizard|MageWizard|TechnocratWizard|DemonWizard} The appropriate wizard instance
   */
  static create(actor, options = {}) {
    if (!actor) {
      throw new Error("WodCharacterWizard.create: actor is required");
    }
    
    const actorType = actor.type;
    if (!actorType) {
      throw new Error("WodCharacterWizard.create: actor.type is required");
    }
    
    const WizardClass = WIZARD_CLASSES[actorType];
    
    if (!WizardClass) {
      throw new Error(`No wizard class found for actor type: ${actorType}. Available types: ${Object.keys(WIZARD_CLASSES).join(', ')}`);
    }
    
    try {
      const wizard = new WizardClass(actor, options);
      return wizard;
    } catch (error) {
      console.error('Error creating wizard instance:', error);
      throw error;
    }
  }
  
  /**
   * Constructor for backward compatibility
   * Delegates to the appropriate wizard class based on actor type
   * 
   * Note: In JavaScript, if a constructor returns an object, that object is used
   * instead of `this`, allowing us to return the appropriate wizard instance.
   */
  constructor(actor, options = {}) {
    // Use the factory to create the appropriate wizard instance
    try {
      return WodCharacterWizard.create(actor, options);
    } catch (error) {
      throw error;
    }
  }
}
