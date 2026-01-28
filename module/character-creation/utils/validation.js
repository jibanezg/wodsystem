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
      case 'merits-flaws':
        return this.validateMeritsFlaws(wizardData.meritsFlaws);
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
    
    for (const step of steps) {
      const validation = this.validateStep(step, wizardData);
      
      if (!validation.valid) {
        return { valid: false, message: `Step ${step}: ${validation.message}` };
      }
    }
    
    return { valid: true };
  }

  /**
   * Validate concept step
   */
  validateConcept(conceptData) {
    const fields = this.config.concept.fields;
    
    for (const field of fields) {
      const value = conceptData[field.name];
      // Convert value to string for trimming, handle null/undefined
      const stringValue = value != null ? String(value) : "";
      const isEmpty = !stringValue || stringValue.trim() === "";
      
      // Check if field is required and either missing or empty string
      if (field.required && isEmpty) {
        // Get translated label (either from label or labelKey)
        let fieldLabel = field.label || field.name;
        if (!fieldLabel && field.labelKey && game?.i18n) {
          const fullKey = field.labelKey.startsWith('WODSYSTEM.') ? field.labelKey : `WODSYSTEM.${field.labelKey}`;
          fieldLabel = game.i18n.localize(fullKey);
        }
        
        let message = `${fieldLabel || field.name} is required`;
        if (game?.i18n) {
          try {
            message = game.i18n.format("WODSYSTEM.Wizard.FieldIsRequired", { field: fieldLabel || field.name });
          } catch (e) {
            // Fallback to simple message if format fails
            message = `${fieldLabel || field.name} is required`;
          }
        }
        return { valid: false, message: message };
      }
    }
    
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
      
      // Calculate spent points - ensure we only sum numeric values
      // Filter out non-numeric values, null, undefined, and ensure values are within reasonable bounds
      const spent = Object.values(abilities).reduce((sum, val) => {
        // Convert to number and validate
        const numVal = Number(val);
        // Only add if it's a valid number, not NaN, and within reasonable bounds (0-10)
        if (!isNaN(numVal) && isFinite(numVal) && numVal >= 0 && numVal <= 10) {
          return sum + numVal;
        } else {
          return sum;
        }
      }, 0);
      
      const remaining = allowedPoints - spent;
      
      details[category] = { spent, remaining, allowed: allowedPoints };
    }
    
    // Then, validate all categories
    for (const [category, abilities] of Object.entries(abilitiesData.values)) {
      const detail = details[category];
      if (!detail) continue;
      
      // Check for abilities over max - ensure value is numeric
      for (const [ability, value] of Object.entries(abilities)) {
        const numValue = Number(value);
        if (!isNaN(numValue) && isFinite(numValue) && numValue > maxAtCreation) {
          return { 
            valid: false, 
            message: `${ability} exceeds maximum (${numValue}/${maxAtCreation})`,
            abilities: details
          };
        } else if (isNaN(numValue) || !isFinite(numValue)) {
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
      const doubleCostBgs = bgConfig.doubleCost || [];
      
      // Calculate total background points spent, accounting for double cost backgrounds
      const totalBgPoints = advantagesData.backgrounds.reduce((sum, bg) => {
        const value = bg.value || 0;
        const isDoubleCost = doubleCostBgs.includes(bg.name);
        return sum + (value * (isDoubleCost ? 2 : 1));
      }, 0);
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
      let affinitySpheres = [];
      const service = game.wod?.referenceDataService;
      
      // Check for Technocrat (convention) or Mage (tradition)
      if (conceptData.convention && service?.data?.affinities) {
        // Technocrat - use reference service
        affinitySpheres = service.getAffinitySpheres(conceptData.convention, "convention");
      } else if (conceptData.tradition && service?.data?.affinities) {
        // Mage - use reference service
        affinitySpheres = service.getAffinitySpheres(conceptData.tradition, "tradition");
      } else {
        // Fallback to config (for backwards compatibility)
        const convention = conceptData.convention;
        const tradition = conceptData.tradition;
        affinitySpheres = this.config.concept?.affinitySpheres?.[convention] || 
                         this.config.concept?.affinitySpheres?.[tradition] || [];
      }
      
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
    
    // Validate lore (Demon)
    if (this.config.advantages.lore) {
      const loreConfig = this.config.advantages.lore;
      const totalLorePoints = Object.values(advantagesData.lore || {}).reduce((sum, val) => sum + (val || 0), 0);
      const loreRemaining = loreConfig.points - totalLorePoints;
      
      details.lore = { 
        spent: totalLorePoints, 
        remaining: loreRemaining, 
        allowed: loreConfig.points 
      };
      
      // Check individual lore limits
      for (const [lorePath, value] of Object.entries(advantagesData.lore || {})) {
        if (value > loreConfig.maxAtCreation) {
          return { 
            valid: false, 
            message: `${lorePath} exceeds maximum (${value}/${loreConfig.maxAtCreation})`,
            ...details
          };
        }
      }
      
      if (totalLorePoints > loreConfig.points) {
        return { 
          valid: false, 
          message: `Too many lore points spent (${totalLorePoints}/${loreConfig.points})`,
          ...details
        };
      }
      
      if (loreRemaining > 0) {
        return { 
          valid: false, 
          message: `Please spend all lore points (${loreRemaining} remaining)`,
          ...details
        };
      }
    }
    
    // Validate virtues (Mortal and Demon)
    if (this.config.advantages.virtues && this.config.advantages.virtues.points) {
      const virtuesConfig = this.config.advantages.virtues;
      const startingValue = virtuesConfig.starting || 1;
      const virtues = advantagesData.virtues || {};
      
      // Calculate total points spent on virtues (above starting value)
      const totalVirtuePoints = Object.values(virtues).reduce((sum, val) => {
        const numVal = Number(val) || startingValue;
        return sum + Math.max(0, numVal - startingValue);
      }, 0);
      
      const virtueRemaining = virtuesConfig.points - totalVirtuePoints;
      
      details.virtues = { 
        spent: totalVirtuePoints, 
        remaining: virtueRemaining, 
        allowed: virtuesConfig.points 
      };
      
      // Check individual virtue limits (max 5)
      for (const [virtueName, value] of Object.entries(virtues)) {
        const numValue = Number(value) || startingValue;
        if (numValue > 5) {
          return { 
            valid: false, 
            message: `${virtueName} exceeds maximum (${numValue}/5)`,
            ...details
          };
        }
      }
      
      if (totalVirtuePoints > virtuesConfig.points) {
        return { 
          valid: false, 
          message: `Too many virtue points spent (${totalVirtuePoints}/${virtuesConfig.points})`,
          ...details
        };
      }
      
      if (virtueRemaining > 0) {
        return { 
          valid: false, 
          message: `Please spend all virtue points (${virtueRemaining} remaining)`,
          ...details
        };
      }
    }
    
    return { valid: true, ...details };
  }

  /**
   * Validate merits & flaws step
   */
  validateMeritsFlaws(meritsFlawsData) {
    const meritPoints = meritsFlawsData.meritPoints || 0;
    const flawPoints = meritsFlawsData.flawPoints || 0;
    
    // Check if merits exceed 7 points
    if (meritPoints > 7) {
      return {
        valid: false,
        message: `Cannot exceed 7 merit points (currently ${meritPoints})`,
        balanced: false,
        needed: 0,
        meritPoints: meritPoints,
        flawPoints: flawPoints
      };
    }
    
    // Check if flaws exceed 7 points
    if (flawPoints > 7) {
      return {
        valid: false,
        message: `Cannot exceed 7 flaw points (currently ${flawPoints})`,
        balanced: false,
        needed: 0,
        meritPoints: meritPoints,
        flawPoints: flawPoints
      };
    }
    
    // If merits > flaws, must be balanced (cannot have more merits than flaws)
    if (meritPoints > flawPoints) {
      const needed = meritPoints - flawPoints;
      return {
        valid: false,
        message: `Merits must be balanced with equal or more Flaws (need ${needed} more flaw points)`,
        balanced: false,
        needed: needed
      };
    }
    
    // All good - either no merits, balanced merits/flaws, or flaws > merits (which gives freebie bonus)
    // If flaws > merits, the difference converts to freebie points
    const freebieBonus = flawPoints > meritPoints ? flawPoints - meritPoints : 0;
    const isBalanced = meritPoints === 0 || meritPoints === flawPoints || flawPoints > meritPoints;
    return {
      valid: true,
      balanced: isBalanced,
      meritPoints: meritPoints,
      flawPoints: flawPoints,
      freebieBonus: freebieBonus,
      needed: 0 // Always include needed, 0 when balanced (merits <= flaws)
    };
  }

  /**
   * Validate freebies step
   * Note: remaining should never be negative due to button disabling logic
   * If it is negative, it indicates a bug that needs to be fixed
   */
  validateFreebies(freebiesData, advantagesData = {}) {
    // freebiesData.remaining already accounts for Enlightenment spending
    // Ensure remaining is never negative (safety check - should never happen)
    const remaining = Math.max(0, freebiesData.remaining || 0);
    
    // Check if overspent (should never happen if buttons are properly disabled)
    if (remaining < 0) {
      return { 
        valid: false, 
        message: `System error: Freebie calculation issue. Please report this bug.` 
      };
    }
    
    // Validate lore limits (Demon)
    if (this.config.freebies.limits?.lore && advantagesData.lore) {
      const loreMax = this.config.freebies.limits.lore;
      for (const [lorePathId, value] of Object.entries(advantagesData.lore)) {
        if (value > loreMax) {
          return {
            valid: false,
            message: `Lore path "${lorePathId}" exceeds maximum (${value}/${loreMax})`
          };
        }
      }
    }
    
    // Validate faith limits (Demon)
    if (this.config.freebies.costs?.faith && advantagesData.faith) {
      const faithMax = 10;
      if (advantagesData.faith > faithMax) {
        return {
          valid: false,
          message: `Faith exceeds maximum (${advantagesData.faith}/${faithMax})`
        };
      }
    }
    
    // Validate virtue limits (Demon/Mortal)
    if (this.config.freebies.costs?.virtue && advantagesData.virtues) {
      const virtueMax = 5;
      for (const [virtueName, value] of Object.entries(advantagesData.virtues)) {
        if (value > virtueMax) {
          return {
            valid: false,
            message: `Virtue "${virtueName}" exceeds maximum (${value}/${virtueMax})`
          };
        }
      }
    }
    
    // Check if all points are spent (required)
    if (remaining > 0) {
      return {
        valid: false,
        message: `You must spend all freebie points (${remaining} remaining)`
      };
    }
    
    return { 
      valid: true, 
      remaining: remaining,
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

