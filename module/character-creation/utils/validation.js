/**
 * Validation utilities for Character Creation Wizard
 */

export class WizardValidator {
  constructor(config) {
    this.config = config;
  }

  /**
   * Validate a specific step
   */
  validateStep(stepId, wizardData) {
    switch(stepId) {
      case 'concept':
        return this.validateConcept(wizardData.concept);
      case 'attributes':
        return this.validateAttributes(wizardData.attributes);
      case 'abilities':
        return this.validateAbilities(wizardData.abilities);
      case 'advantages':
        return this.validateAdvantages(wizardData.advantages, wizardData.concept);
      case 'freebies':
        return this.validateFreebies(wizardData.freebies, wizardData.advantages);
      case 'review':
        return { valid: true };
      default:
        return { valid: false, message: "Unknown step" };
    }
  }

  /**
   * Validate all steps
   */
  validateAll(wizardData) {
    // For final validation, we only check critical steps that don't change after their step
    // - Attributes/Abilities: Freebies can be spent on them after their steps
    // - Advantages: Freebies can be spent on backgrounds/spheres/willpower after this step
    // - Concept: This never changes, so we validate it
    // - Freebies: Must be fully spent, so we validate it
    const steps = ['concept', 'freebies'];
    
    console.log('🔍 validateAll - Starting validation of critical steps');
    console.log('🔍 validateAll - wizardData:', JSON.parse(JSON.stringify(wizardData)));
    
    for (const step of steps) {
      console.log(`🔍 validateAll - Validating step: ${step}`);
      const validation = this.validateStep(step, wizardData);
      console.log(`🔍 validateAll - Step ${step} result:`, validation);
      
      if (!validation.valid) {
        console.error(`🔍 validateAll - FAILED at step ${step}:`, validation.message);
        return { valid: false, message: `Step ${step}: ${validation.message}` };
      }
    }
    
    console.log('🔍 validateAll - ALL STEPS PASSED ✓');
    return { valid: true };
  }

  /**
   * Validate concept step
   */
  validateConcept(conceptData) {
    const fields = this.config.concept.fields;
    
    console.log('validateConcept called with:', conceptData);
    console.log('Required fields:', fields.filter(f => f.required).map(f => f.name));
    
    for (const field of fields) {
      const value = conceptData[field.name];
      console.log(`Checking field ${field.name}:`, {
        value: value,
        required: field.required,
        isEmpty: !value || value.trim() === ""
      });
      
      // Check if field is required and either missing or empty string
      if (field.required && (!value || value.trim() === "")) {
        console.log(`VALIDATION FAILED: ${field.label} is required`);
        return { valid: false, message: `${field.label} is required` };
      }
    }
    
    console.log('VALIDATION PASSED');
    return { valid: true };
  }

  /**
   * Validate attributes step
   */
  validateAttributes(attributesData) {
    const priorities = this.config.attributes.priorities;
    const starting = this.config.attributes.starting;
    
    // Check priority selection FIRST
    const selected = Object.values(attributesData.prioritySelection);
    if (selected.length !== 3 || selected.includes(null)) {
      return { valid: false, message: "Please assign priority to all attribute categories" };
    }
    
    // Validate unique priorities
    const uniquePriorities = [...new Set(selected)];
    if (uniquePriorities.length !== 3) {
      return { valid: false, message: "Each attribute category must have a unique priority" };
    }
    
    // Only calculate point details AFTER all priorities are assigned
    const details = {};
    
    // First, calculate details for ALL categories
    for (const [category, attrs] of Object.entries(attributesData.values)) {
      // Find priority for this category
      const priority = Object.keys(attributesData.prioritySelection)
        .find(p => attributesData.prioritySelection[p] === category);
      
      if (!priority) continue;
      
      const allowedPoints = priorities[priority];
      const spent = Object.values(attrs).reduce((sum, val) => sum + (val - starting), 0);
      const remaining = allowedPoints - spent;
      
      details[category] = { spent, remaining, allowed: allowedPoints };
    }
    
    // Then, validate all categories
    for (const [category, detail] of Object.entries(details)) {
      if (detail.spent > detail.allowed) {
        return { 
          valid: false, 
          message: `Too many points spent on ${category} attributes (${detail.spent}/${detail.allowed})`,
          attributes: details
        };
      }
      
      if (detail.remaining > 0) {
        return { 
          valid: false, 
          message: `Please spend all ${category} attribute points (${detail.remaining} remaining)`,
          attributes: details
        };
      }
    }
    
    return { valid: true, attributes: details };
  }

  /**
   * Validate abilities step
   */
  validateAbilities(abilitiesData) {
    const priorities = this.config.abilities.priorities;
    const maxAtCreation = this.config.abilities.maxAtCreation;
    
    // Check priority selection FIRST
    const selected = Object.values(abilitiesData.prioritySelection);
    if (selected.length !== 3 || selected.includes(null)) {
      return { valid: false, message: "Please assign priority to all ability categories" };
    }
    
    // Validate unique priorities
    const uniquePriorities = [...new Set(selected)];
    if (uniquePriorities.length !== 3) {
      return { valid: false, message: "Each ability category must have a unique priority" };
    }
    
    // Only calculate point details AFTER all priorities are assigned
    const details = {};
    
    // First, calculate details for ALL categories
    for (const [category, abilities] of Object.entries(abilitiesData.values)) {
      // Find priority for this category
      const priority = Object.keys(abilitiesData.prioritySelection)
        .find(p => abilitiesData.prioritySelection[p] === category);
      
      if (!priority) continue;
      
      const allowedPoints = priorities[priority];
      const spent = Object.values(abilities).reduce((sum, val) => sum + val, 0);
      const remaining = allowedPoints - spent;
      
      details[category] = { spent, remaining, allowed: allowedPoints };
    }
    
    // Then, validate all categories
    for (const [category, abilities] of Object.entries(abilitiesData.values)) {
      const detail = details[category];
      if (!detail) continue;
      
      // Check for abilities over max
      for (const [ability, value] of Object.entries(abilities)) {
        if (value > maxAtCreation) {
          return { 
            valid: false, 
            message: `${ability} exceeds maximum (${value}/${maxAtCreation})`,
            abilities: details
          };
        }
      }
      
      // Validate point allocation
      if (detail.spent > detail.allowed) {
        return { 
          valid: false, 
          message: `Too many points spent on ${category} (${detail.spent}/${detail.allowed})`,
          abilities: details
        };
      }
      
      if (detail.remaining > 0) {
        return { 
          valid: false, 
          message: `Please spend all ${category} points (${detail.remaining} remaining)`,
          abilities: details
        };
      }
    }
    
    return { valid: true, abilities: details };
  }

  /**
   * Validate advantages step
   * @param {Object} advantagesData - The advantages data
   * @param {string} convention - The character's convention (for affinity spheres)
   * @param {Object} conceptData - The concept data (to get convention for affinity spheres)
   */
  validateAdvantages(advantagesData, conceptData = {}) {
    const details = {};
    
    // Validate backgrounds
    if (this.config.advantages.backgrounds) {
      const bgConfig = this.config.advantages.backgrounds;
      const totalBgPoints = advantagesData.backgrounds.reduce((sum, bg) => sum + (bg.value || 0), 0);
      const bgRemaining = bgConfig.points - totalBgPoints;
      
      details.backgrounds = { spent: totalBgPoints, remaining: bgRemaining, allowed: bgConfig.points };
      
      // Check individual background limits
      for (const bg of advantagesData.backgrounds) {
        if (bg.value > bgConfig.maxPerBackground) {
          return { 
            valid: false, 
            message: `${bg.name} exceeds maximum (${bg.value}/${bgConfig.maxPerBackground})`,
            ...details
          };
        }
      }
      
      if (totalBgPoints > bgConfig.points) {
        return { 
          valid: false, 
          message: `Too many background points spent (${totalBgPoints}/${bgConfig.points})`,
          ...details
        };
      }
      
      if (bgRemaining > 0) {
        return { 
          valid: false, 
          message: `Please spend all background points (${bgRemaining} remaining)`,
          ...details
        };
      }
    }
    
    // Validate spheres (Technocrat)
    if (this.config.advantages.spheres) {
      const sphereConfig = this.config.advantages.spheres;
      const totalSpherePoints = Object.values(advantagesData.spheres).reduce((sum, val) => sum + val, 0);
      const enlightenment = advantagesData.enlightenment || this.config.advantages.enlightenment.starting;
      
      // Rule 1: Total sphere points cannot exceed config limit (6)
      const sphereRemaining = sphereConfig.points - totalSpherePoints;
      
      details.spheres = { 
        spent: totalSpherePoints, 
        remaining: sphereRemaining, 
        allowed: sphereConfig.points 
      };
      
      // Check individual sphere limits - each sphere limited by enlightenment
      for (const [sphere, value] of Object.entries(advantagesData.spheres)) {
        if (value > enlightenment) {
          return { 
            valid: false, 
            message: `${sphere} (${value}) cannot exceed your Enlightenment (${enlightenment})`,
            ...details
          };
        }
      }
      
      if (totalSpherePoints > sphereConfig.points) {
        return { 
          valid: false, 
          message: `Too many sphere points spent (${totalSpherePoints}/${sphereConfig.points})`,
          ...details
        };
      }
      
      // Rule 2: At least 1 point must be in an affinity sphere
      const convention = conceptData.convention;
      const affinitySpheres = this.config.concept?.affinitySpheres?.[convention] || [];
      
      if (affinitySpheres.length > 0 && totalSpherePoints > 0) {
        const affinityPoints = affinitySpheres.reduce((sum, sphere) => {
          return sum + (advantagesData.spheres[sphere] || 0);
        }, 0);
        
        if (affinityPoints === 0) {
          const affinityNames = affinitySpheres.map(s => sphereConfig.available[s] || s).join(', ');
          return {
            valid: false,
            message: `Must have at least 1 point in an affinity sphere (${affinityNames})`,
            ...details
          };
        }
      }
      
      if (sphereRemaining > 0) {
        return { 
          valid: false, 
          message: `Please spend all sphere points (${sphereRemaining} remaining)`,
          ...details
        };
      }
    }
    
    return { valid: true, ...details };
  }

  /**
   * Validate freebies step
   */
  validateFreebies(freebiesData, advantagesData = {}) {
    // freebiesData.remaining already accounts for Enlightenment spending
    
    // Check if overspent
    if (freebiesData.remaining < 0) {
      return { 
        valid: false, 
        message: `You've overspent freebie points by ${Math.abs(freebiesData.remaining)}` 
      };
    }
    
    // Check if all points are spent (required)
    if (freebiesData.remaining > 0) {
      return {
        valid: false,
        message: `You must spend all freebie points (${freebiesData.remaining} remaining)`
      };
    }
    
    return { 
      valid: true, 
      remaining: freebiesData.remaining,
      total: this.config.freebies.total
    };
  }

  /**
   * Calculate points spent in a category
   */
  calculateSpent(values, starting = 0) {
    return Object.values(values).reduce((sum, val) => sum + Math.max(0, val - starting), 0);
  }

  /**
   * Calculate points remaining
   */
  calculateRemaining(allowed, spent) {
    return allowed - spent;
  }
}

