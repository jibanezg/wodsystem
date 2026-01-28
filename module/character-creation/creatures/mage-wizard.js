/**
 * Mage Character Creation Wizard
 * Extends MortalWizard with Mage-specific functionality:
 * - Spheres
 * - Enlightenment (Arete)
 * - Tradition, Cabal, Essence
 */

import { MortalWizard } from '../base/mortal-wizard.js';
import { i18n } from '../../../module/helpers/i18n.js';

export class MageWizard extends MortalWizard {
  /**
   * Initialize wizard data structure (Mage-specific additions)
   */
  _initializeWizardData() {
    const baseData = super._initializeWizardData();
    
    // Add Mage-specific concept fields
    baseData.concept.tradition = "";
    baseData.concept.cabal = "";
    baseData.concept.essence = "";
    
    // Add Mage-specific advantages
    baseData.advantages.spheres = this._initializeSpheres();
    baseData.advantages.enlightenment = this.config.advantages?.enlightenment?.starting || 1;
    baseData.advantages.freebiesSpent = 0;  // Track freebies spent on Enlightenment
    
    return baseData;
  }

  /**
   * Initialize sphere values
   */
  _initializeSpheres() {
    const spheres = {};
    
    // Initialize spheres for Mage
    if (this.config.advantages?.spheres?.available) {
      // spheres.available is an object like { correspondence: "Data", entropy: "Entropy", ... }
      for (const sphereKey in this.config.advantages.spheres.available) {
        spheres[sphereKey] = 0;
      }
    }
    
    return spheres;
  }

  /**
   * Initialize ability values from actor data (Mage uses M20 order)
   */
  _initializeAbilityValues() {
    // Get abilities from actor's system data
    const actorAbilities = this.actor.system.abilities || {};
    
    // M20 ability order (from template.json baseTraits.abilities)
    const m20AbilityOrder = {
      skills: ["Crafts", "Drive", "Etiquette", "Firearms", "Martial Arts", "Meditation", "Melee", "Research", "Stealth", "Survival", "Technology"],
      talents: ["Alertness", "Art", "Athletics", "Awareness", "Brawl", "Empathy", "Expression", "Intimidation", "Leadership", "Streetwise", "Subterfuge"],
      knowledges: ["Academics", "Computer", "Cosmology", "Enigmas", "Esoterica", "Investigation", "Law", "Medicine", "Occult", "Politics", "Science"]
    };
    
    const abilityValues = {
      talents: {},
      skills: {},
      knowledges: {}
    };
    
    // Initialize each category with abilities in M20 order
    for (const category of this.config.abilities.categories) {
      const categoryAbilities = actorAbilities[category] || {};
      
      if (m20AbilityOrder[category]) {
        // Use M20 order for Mage
        for (const abilityName of m20AbilityOrder[category]) {
          const rawValue = categoryAbilities[abilityName];
          if (rawValue !== undefined) {
            const numValue = Number(rawValue);
            if (!isNaN(numValue) && isFinite(numValue) && numValue >= 0 && numValue <= 10) {
              abilityValues[category][abilityName] = numValue;
            } else {
              abilityValues[category][abilityName] = (this.config.abilities.starting || 0);
            }
          } else {
            abilityValues[category][abilityName] = (this.config.abilities.starting || 0);
          }
        }
        
        // Add any additional abilities not in the M20 list (secondary/custom abilities)
        for (const abilityName in categoryAbilities) {
          if (!abilityValues[category][abilityName] && abilityValues[category][abilityName] !== 0) {
            const rawValue = categoryAbilities[abilityName];
            const numValue = Number(rawValue);
            if (!isNaN(numValue) && isFinite(numValue) && numValue >= 0 && numValue <= 10) {
              abilityValues[category][abilityName] = numValue;
            } else {
            }
          }
        }
      }
    }
    
    return abilityValues;
  }

  /**
   * Load saved progress from actor flags (Mage-specific additions)
   */
  _loadProgress() {
    super._loadProgress();
    
    // Load saved progress
    const saved = this.actor.getFlag('wodsystem', 'wizardProgress');
    if (saved) {
      // Ensure all spheres are initialized with at least 0
      if (this.config.advantages?.spheres?.available) {
        for (const sphereKey in this.config.advantages.spheres.available) {
          if (this.wizardData.advantages.spheres[sphereKey] === undefined) {
            this.wizardData.advantages.spheres[sphereKey] = 0;
          }
        }
      }
      
      // Adjust freebies if needed based on enlightenment spending
      const enlightenmentSpent = this.wizardData.advantages.freebiesSpent || 0;
      
      // If remaining equals total AND enlightenment was spent, this is the first adjustment
      if (this.wizardData.freebies.remaining === this.config.freebies.total && enlightenmentSpent > 0) {
        this.wizardData.freebies.remaining = this.config.freebies.total - enlightenmentSpent;
      }
    }
    
    // Mage-specific concept fields
    if (!this.wizardData.concept.tradition && this.actor.system?.identity?.tradition) {
      this.wizardData.concept.tradition = this.actor.system.identity.tradition;
    }
    if (!this.wizardData.concept.cabal && this.actor.system?.identity?.cabal) {
      this.wizardData.concept.cabal = this.actor.system.identity.cabal;
    }
    if (!this.wizardData.concept.essence && this.actor.system?.identity?.essence) {
      this.wizardData.concept.essence = this.actor.system.identity.essence;
    }
  }

  /**
   * Get data for template rendering (Mage-specific additions)
   */
  async getData() {
    const data = await super.getData();
    
    const step = this.config.steps[this.currentStep];
    
    // Adjust freebies.remaining if entering for the first time after Enlightenment spending
    if (step.id === 'freebies') {
      const enlightenmentSpent = this.wizardData.advantages.freebiesSpent || 0;
      const freebieBonus = this.wizardData.meritsFlaws.freebieBonus || 0;
      const baseFreebiesTotalWithBonus = this.config.freebies.total + freebieBonus;
      
      // Check if any freebies have been spent in the freebies step itself
      const freebiesSpentInStep = Object.values(this.wizardData.freebies.spent || {}).reduce((sum, val) => sum + (val || 0), 0);
      
      // Capture baseline values when first entering freebies step
      if (!this.wizardData.freebies.baselines) {
        this.wizardData.freebies.baselines = {
          attributes: JSON.parse(JSON.stringify(this.wizardData.attributes.values)),
          abilities: JSON.parse(JSON.stringify(this.wizardData.abilities.values)),
          backgrounds: this.wizardData.advantages.backgrounds.map(bg => ({
            name: bg.name,
            value: bg.value || 0
          })),
          spheres: JSON.parse(JSON.stringify(this.wizardData.advantages.spheres)),
          willpower: 0
        };
      }
      
      // Always recalculate remaining from scratch to ensure accuracy
      this._recalculateFreebiesRemaining();
    }
    
    return data;
  }

  /**
   * Step: Concept listeners (Mage-specific additions)
   */
  _activateConceptListeners(html) {
    super._activateConceptListeners(html);
    
    // Mage-specific concept fields (tradition, cabal, essence) are handled by base class
    // No additional listeners needed beyond what base class provides
  }

  /**
   * Step: Advantages listeners (Mage-specific additions)
   */
  _activateAdvantagesListeners(html) {
    super._activateAdvantagesListeners(html);
    
    // Enlightenment increase/decrease
    html.find('.enlightenment-increase').click(async (event) => {
      await this._modifyEnlightenment(1);
    });

    html.find('.enlightenment-decrease').click(async (event) => {
      await this._modifyEnlightenment(-1);
    });

    // Sphere increase/decrease
    html.find('.sphere-increase[data-sphere]').click(async (event) => {
      const sphere = event.currentTarget.dataset.sphere;
      await this._modifySphere(sphere, 1);
    });
    
    html.find('.sphere-decrease[data-sphere]').click(async (event) => {
      const sphere = event.currentTarget.dataset.sphere;
      await this._modifySphere(sphere, -1);
    });
  }

  /**
   * Modify sphere value
   */
  async _modifySphere(sphere, delta) {
    if (!this.wizardData.advantages.spheres[sphere]) {
      this.wizardData.advantages.spheres[sphere] = 0;
    }
    
    const current = this.wizardData.advantages.spheres[sphere];
    const enlightenment = this.wizardData.advantages.enlightenment || this.config.advantages.enlightenment.starting;
    
    // Check if we have points available BEFORE modifying
    const totalSpherePoints = Object.values(this.wizardData.advantages.spheres).reduce((sum, val) => sum + val, 0);
    
    // If increasing, check limits
    if (delta > 0) {
      // Check total limit (6 points max)
      if (totalSpherePoints >= this.config.advantages.spheres.points) {
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotAddMoreSpherePoints', {max: this.config.advantages.spheres.points}));
        return;
      }
      
      // Check individual sphere limit (can't exceed enlightenment)
      if (current >= enlightenment) {
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.SphereCannotExceedEnlightenment', {sphere: sphere, enlightenment: enlightenment}));
        return;
      }
    }
    
    // Calculate new value (limited by enlightenment)
    const newValue = Math.max(0, Math.min(enlightenment, current + delta));
    
    this.wizardData.advantages.spheres[sphere] = newValue;
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly without full render to avoid scroll
    const html = this.element;
    
    // Find the specific sphere item using data-sphere attribute
    const increaseBtn = html.find(`.sphere-increase[data-sphere="${sphere}"]`);
    const sphereItem = increaseBtn.closest('.sphere-item');
    
    if (sphereItem.length) {
      // Update the value display
      sphereItem.find('.sphere-value').text(newValue);
      
      // Update the dots using the helper (max = enlightenment)
      const dotsDiv = sphereItem.find('.sphere-dots');
      const dotsHtml = Handlebars.helpers.renderDots(newValue, enlightenment);
      dotsDiv.html(dotsHtml.toString());
      
      // Update button states for this specific sphere
      sphereItem.find('.sphere-decrease').prop('disabled', newValue === 0);
      sphereItem.find('.sphere-increase').prop('disabled', newValue >= enlightenment);
    }
    
    // Update points tracker and all buttons based on remaining points
    const newValidation = this._validateCurrentStep();
    if (newValidation.spheres) {
      const tracker = html.find('.advantage-section:has(h4:contains("Spheres")) .points-tracker');
      tracker.find('.spent').text(newValidation.spheres.spent);
      tracker.find('.remaining').text(newValidation.spheres.remaining);
      if (newValidation.spheres.remaining > 0) {
        tracker.find('.remaining').parent().show();
      } else {
        tracker.find('.remaining').parent().hide();
      }
      
      // Enable/disable all increase buttons based on remaining points AND enlightenment
      const noPointsLeft = newValidation.spheres.remaining <= 0;
      html.find('.sphere-increase').each((i, btn) => {
        const $btn = $(btn);
        const sphereKey = $btn.data('sphere');
        const currentValue = this.wizardData.advantages.spheres[sphereKey] || 0;
        const atMax = currentValue >= enlightenment;
        $btn.prop('disabled', atMax || noPointsLeft);
      });
    }
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Modify enlightenment value (using freebie points)
   */
  async _modifyEnlightenment(delta) {
    const current = this.wizardData.advantages.enlightenment;
    const starting = this.config.advantages.enlightenment.starting;
    const max = this.config.freebies.limits.enlightenment;
    const cost = this.config.freebies.costs.enlightenment;
    const freebiesTotal = this.config.freebies.total;
    const freebiesSpent = this.wizardData.advantages.freebiesSpent || 0;
    
    // If increasing, check if we have freebies available and aren't at max
    if (delta > 0) {
      if (current >= max) {
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.EnlightenmentAtMaximum', {max: max}));
        return;
      }
      const freebiesAvailable = freebiesTotal - freebiesSpent;
      if (freebiesAvailable < cost) {
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.NotEnoughFreebiePoints', {cost: cost, available: freebiesAvailable}));
        return;
      }
    }
    
    // If decreasing, check if we're at starting value
    if (delta < 0 && current <= starting) {
      ui.notifications.warn(i18n('WODSYSTEM.Wizard.EnlightenmentCannotGoBelow', {starting: starting}));
      return;
    }
    
    // Calculate new value
    const newValue = Math.max(starting, Math.min(max, current + delta));
    const freebiesDelta = delta * cost;
    
    // Check if reducing enlightenment would invalidate current sphere points
    if (delta < 0) {
      // Find the maximum value in any single sphere
      const maxSphereValue = Math.max(0, ...Object.values(this.wizardData.advantages.spheres));
      if (maxSphereValue > newValue) {
        // Find which sphere(s) have this max value
        const problemSpheres = Object.entries(this.wizardData.advantages.spheres)
          .filter(([_, value]) => value > newValue)
          .map(([sphere, value]) => `${this.config.advantages.spheres.available[sphere]} (${value})`)
          .join(', ');
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotReduceEnlightenment', {newValue: newValue, spheres: problemSpheres}));
        return;
      }
    }
    
    // Update values
    this.wizardData.advantages.enlightenment = newValue;
    this.wizardData.advantages.freebiesSpent = Math.max(0, freebiesSpent + freebiesDelta);
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly without full render to avoid scroll
    const html = this.element;
    
    // Update enlightenment display
    html.find('.enlightenment-value').text(newValue);
    html.find('.freebies-value').text(this.wizardData.advantages.freebiesSpent);
    
    // Update enlightenment buttons
    html.find('.enlightenment-decrease').prop('disabled', newValue === starting);
    const freebiesRemaining = freebiesTotal - this.wizardData.advantages.freebiesSpent;
    html.find('.enlightenment-increase').prop('disabled', newValue === max || freebiesRemaining < cost);
    
    // Update sphere limit note
    html.find('.sphere-limit-note strong').text(newValue);
    
    // Re-validate spheres and update sphere buttons
    const validation = this._validateCurrentStep();
    
    // Update tracker if spheres validation exists
    if (validation.spheres) {
      const tracker = html.find('.advantage-section:has(h4:contains("Spheres")) .points-tracker');
      tracker.find('.spent').text(validation.spheres.spent);
      tracker.find('.remaining').text(validation.spheres.remaining);
      if (validation.spheres.remaining > 0) {
        tracker.find('.remaining').parent().show();
      } else {
        tracker.find('.remaining').parent().hide();
      }
    }
    
    // ALWAYS update all sphere buttons and dots based on new enlightenment
    const totalSpherePoints = Object.values(this.wizardData.advantages.spheres).reduce((sum, val) => sum + val, 0);
    const noPointsLeft = totalSpherePoints >= this.config.advantages.spheres.points;
    
    html.find('.sphere-increase').each((i, btn) => {
      const $btn = $(btn);
      const sphereKey = $btn.data('sphere');
      const currentValue = this.wizardData.advantages.spheres[sphereKey] || 0;
      // Each sphere is limited by enlightenment
      const atMax = currentValue >= newValue;
      $btn.prop('disabled', atMax || noPointsLeft);
    });
    
    // Also update the sphere dots display to reflect new max (enlightenment)
    html.find('.sphere-item').each((i, item) => {
      const $item = $(item);
      const sphereKey = $item.data('sphere-key');
      const currentValue = this.wizardData.advantages.spheres[sphereKey] || 0;
      const dotsDiv = $item.find('.sphere-dots');
      const dotsHtml = Handlebars.helpers.renderDots(currentValue, newValue);
      dotsDiv.html(dotsHtml.toString());
    });
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Update freebie button states (Mage-specific: adds sphere handling)
   */
  _updateFreebiesButtonStates(html) {
    const baselines = this.wizardData.freebies.baselines;
    if (!baselines) return;
    
    // Update all decrease buttons based on baseline values
    html.find('.freebie-decrease').each((i, btn) => {
      const $btn = $(btn);
      const btnType = $btn.data('type');
      const btnTarget = $btn.data('target');
      let atBaseline = false;
      
      if (btnType === 'attribute') {
        const [cat, attr] = btnTarget.split('.');
        const currentValue = this.wizardData.attributes.values[cat][attr];
        const baselineValue = baselines.attributes[cat][attr];
        atBaseline = currentValue <= baselineValue;
      } else if (btnType === 'ability') {
        const [cat, ability] = btnTarget.split('.');
        const currentValue = this.wizardData.abilities.values[cat][ability] || 0;
        const baselineValue = baselines.abilities[cat][ability] || 0;
        atBaseline = currentValue <= baselineValue;
      } else if (btnType === 'background') {
        const bgIndex = parseInt(btnTarget);
        const bg = this.wizardData.advantages.backgrounds[bgIndex];
        if (bg) {
          const currentValue = bg.value || 0;
          const baselineBg = baselines.backgrounds.find(b => b.name === bg.name);
          const baselineValue = baselineBg?.value || 0;
          atBaseline = currentValue <= baselineValue;
        } else {
          atBaseline = true; // No background, disable
        }
      } else if (btnType === 'sphere') {
        const currentValue = this.wizardData.advantages.spheres[btnTarget] || 0;
        const baselineValue = baselines.spheres[btnTarget] || 0;
        atBaseline = currentValue <= baselineValue;
      } else if (btnType === 'willpower') {
        const currentSpent = this.wizardData.freebies.spent.willpower || 0;
        atBaseline = currentSpent <= 0; // Can't go below 0 willpower spent
      }
      
      // Disable if at or below baseline
      $btn.prop('disabled', atBaseline);
    });
  }

  /**
   * Recalculate freebie points remaining from scratch (Mage-specific additions)
   */
  _recalculateFreebiesRemaining() {
    const baselines = this.wizardData.freebies.baselines;
    if (!baselines) return; // Can't recalculate without baselines
    
    const freebieBonus = this.wizardData.meritsFlaws?.freebieBonus || 0;
    const baseTotal = this.config.freebies.total + freebieBonus;
    const enlightenmentSpent = this.wizardData.advantages.freebiesSpent || 0;
    
    let totalSpent = enlightenmentSpent; // Start with enlightenment spending
    
    // Calculate spent on attributes
    for (const [cat, attrs] of Object.entries(this.wizardData.attributes.values)) {
      for (const [attrName, currentValue] of Object.entries(attrs)) {
        const baselineValue = baselines.attributes[cat][attrName] || 1;
        const spent = Math.max(0, currentValue - baselineValue);
        if (spent > 0) {
          totalSpent += spent * this.config.freebies.costs.attribute;
        }
      }
    }
    
    // Calculate spent on abilities
    for (const [cat, abilities] of Object.entries(this.wizardData.abilities.values)) {
      for (const [abilityName, currentValue] of Object.entries(abilities)) {
        const baselineValue = baselines.abilities[cat][abilityName] || 0;
        const spent = Math.max(0, currentValue - baselineValue);
        if (spent > 0) {
          totalSpent += spent * this.config.freebies.costs.ability;
        }
      }
    }
    
    // Calculate spent on backgrounds
    const doubleCostBgs = this.config.advantages.backgrounds.doubleCost || [];
    for (const bg of this.wizardData.advantages.backgrounds) {
      const baselineBg = baselines.backgrounds.find(b => b.name === bg.name);
      const baselineValue = baselineBg?.value || 0;
      const currentValue = bg.value || 0;
      const spent = Math.max(0, currentValue - baselineValue);
      if (spent > 0) {
        let cost = this.config.freebies.costs.background;
        if (doubleCostBgs.includes(bg.name)) {
          cost = cost * 2;
        }
        totalSpent += spent * cost;
      }
    }
    
    // Calculate spent on spheres
    for (const [sphereKey, currentValue] of Object.entries(this.wizardData.advantages.spheres || {})) {
      const baselineValue = baselines.spheres[sphereKey] || 0;
      const spent = Math.max(0, currentValue - baselineValue);
      if (spent > 0) {
        totalSpent += spent * this.config.freebies.costs.sphere;
      }
    }
    
    // Calculate spent on willpower
    const willpowerSpent = this.wizardData.freebies.spent.willpower || 0;
    if (willpowerSpent > 0) {
      totalSpent += willpowerSpent * this.config.freebies.costs.willpower;
    }
    
    // Update remaining - ensure it never goes negative (shouldn't happen, but safety check)
    this.wizardData.freebies.remaining = Math.max(0, baseTotal - totalSpent);
  }

  /**
   * Spend freebie points (Mage-specific: adds sphere handling)
   */
  async _spendFreebie(type, target, delta, bgName = null) {
    // Handle sphere type in freebies step
    if (type === 'sphere') {
      const sphereCurrent = this.wizardData.advantages.spheres[target] || 0;
      const enlightenment = this.wizardData.advantages.enlightenment || this.config.advantages.enlightenment.starting;
      const baselines = this.wizardData.freebies.baselines;
      const sphereBaseline = baselines?.spheres[target] || 0;
      const sphereNew = Math.max(sphereBaseline, Math.min(enlightenment, sphereCurrent + delta));
      
      if (sphereNew !== sphereCurrent) {
        this.wizardData.advantages.spheres[target] = sphereNew;
        
        // Recalculate freebies remaining from scratch to ensure accuracy
        this._recalculateFreebiesRemaining();
        
        // Save progress
        await this._saveProgress();
        
        // Update DOM directly instead of full render
        const html = this.element;
        
        // Find the specific item and update it
        const button = html.find(`button[data-type="${type}"][data-target="${target}"]`).first();
        const freebieItem = button.closest('.freebie-item');
        
        if (freebieItem.length) {
          // Update the current value display
          freebieItem.find('.item-current').text(sphereNew);
          
          // Update button states
          freebieItem.find('.freebie-decrease').prop('disabled', sphereNew === 0);
          freebieItem.find('.freebie-increase').prop('disabled', sphereNew >= enlightenment);
        }
        
        // Update freebies remaining counter
        const freebieBonus = this.wizardData.meritsFlaws?.freebieBonus || 0;
        const actualTotal = this.config.freebies.total + freebieBonus;
        html.find('.freebies-remaining .value').text(`${this.wizardData.freebies.remaining} / ${actualTotal}`);
        
        // Update all increase buttons based on remaining freebies and current values
        const doubleCostBgs = this.config.advantages.backgrounds.doubleCost || [];
        html.find('.freebie-increase').each((i, btn) => {
          const $btn = $(btn);
          const btnType = $btn.data('type');
          const btnTarget = $btn.data('target');
          let btnCost = this.config.freebies.costs[btnType];
          
          // For backgrounds, check if it's a double cost background
          if (btnType === 'background') {
            const bgIndex = parseInt(btnTarget);
            let bgName = this.wizardData.advantages.backgrounds[bgIndex]?.name;
            if (!bgName) {
              bgName = $btn.data('bg-name') || $btn.attr('data-bg-name');
            }
            if (bgName && doubleCostBgs.includes(bgName)) {
              btnCost = btnCost * 2;
            }
          }
          
          // Check if we have enough freebies
          const notEnoughFreebies = this.wizardData.freebies.remaining < btnCost;
          
          // Check if item is at maximum value
          let atMaxValue = false;
          
          if (btnType === 'attribute') {
            const [cat, attr] = btnTarget.split('.');
            const currentValue = this.wizardData.attributes.values[cat][attr];
            atMaxValue = currentValue >= 5;
          } else if (btnType === 'ability') {
            const [cat, ability] = btnTarget.split('.');
            const currentValue = this.wizardData.abilities.values[cat][ability] || 0;
            atMaxValue = currentValue >= 5;
          } else if (btnType === 'background') {
            const bgIndex = parseInt(btnTarget);
            const currentValue = this.wizardData.advantages.backgrounds[bgIndex]?.value || 0;
            atMaxValue = currentValue >= 5;
          } else if (btnType === 'sphere') {
            const enlightenment = this.wizardData.advantages.enlightenment || this.config.advantages.enlightenment.starting;
            const currentValue = this.wizardData.advantages.spheres[btnTarget] || 0;
            atMaxValue = currentValue >= enlightenment;
          } else if (btnType === 'willpower') {
            atMaxValue = this.wizardData.freebies.spent.willpower >= 10;
          }
          
          // Enable or disable based on both conditions
          $btn.prop('disabled', notEnoughFreebies || atMaxValue);
        });
        
        // Update decrease button states based on baselines
        this._updateFreebiesButtonStates(html);
        
        // Update navigation buttons
        this._updateNavigationButtons(html);
        
        return;
      } else if (delta > 0 && sphereCurrent >= enlightenment) {
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotIncreaseSphereAboveEnlightenment', {enlightenment: enlightenment}));
        return;
      }
    }
    
    // For all other types, call parent implementation
    await super._spendFreebie(type, target, delta, bgName);
  }

  /**
   * Apply wizard data to actor (Mage-specific additions)
   */
  async _applyToActor() {
    // Build base updateData (replicate parent logic but add Mage-specific fields)
    const updateData = {};
    
    // Step 1: Concept (add Mage-specific fields)
    updateData["system.identity.name"] = this.wizardData.concept.name ?? "";
    updateData["system.identity.concept"] = this.wizardData.concept.concept ?? "";
    updateData["system.identity.nature"] = this.wizardData.concept.nature ?? "";
    updateData["system.identity.demeanor"] = this.wizardData.concept.demeanor ?? "";
    
    // Mage-specific concept fields
    updateData["system.identity.tradition"] = this.wizardData.concept.tradition ?? "";
    updateData["system.identity.cabal"] = this.wizardData.concept.cabal ?? "";
    updateData["system.identity.essence"] = this.wizardData.concept.essence ?? "";
    
    // Step 2: Attributes
    for (const [category, attrs] of Object.entries(this.wizardData.attributes.values)) {
      for (const [attr, value] of Object.entries(attrs)) {
        updateData[`system.attributes.${category}.${attr}`] = value;
      }
    }
    
    // Step 3: Abilities
    for (const [category, abilities] of Object.entries(this.wizardData.abilities.values)) {
      for (const [ability, value] of Object.entries(abilities)) {
        if (value > 0) {
          updateData[`system.abilities.${category}.${ability}`] = value;
        }
      }
    }
    
    // Secondary abilities
    for (const [category, secondaries] of Object.entries(this.wizardData.abilities.secondary)) {
      if (secondaries.length > 0) {
        updateData[`system.secondaryAbilities.${category}`] = secondaries;
      }
    }
    
    // Step 4: Advantages
    // Enlightenment (Arete)
    const enlightenment = this.wizardData.advantages.enlightenment || this.config.advantages.enlightenment.starting;
    updateData["system.advantages.enlightenment.current"] = enlightenment;
    
    // Spheres
    for (const [sphere, value] of Object.entries(this.wizardData.advantages.spheres)) {
      if (value > 0) {
        updateData[`system.spheres.${sphere}.rating`] = value;
      }
    }
    
    // Backgrounds
    const validBackgrounds = this.wizardData.advantages.backgrounds.filter(bg => {
      return bg.name && bg.name.trim() !== "" && bg.value > 0;
    }).map(bg => {
      return {
        id: bg.id || foundry.utils.randomID(),
        name: bg.name,
        value: bg.value
      };
    });
    updateData["system.miscellaneous.backgrounds"] = validBackgrounds;
    
    // Willpower calculation - For Mage, use base + freebies
    const baseWillpower = this.config.advantages.willpower.starting;
    const freebieWillpower = this.wizardData.freebies.spent.willpower || 0;
    const totalWillpower = baseWillpower + freebieWillpower;
    updateData["system.miscellaneous.willpower.permanent"] = totalWillpower;
    updateData["system.miscellaneous.willpower.temporary"] = totalWillpower;
    
    // Step 5: Merits & Flaws
    const validMerits = (this.wizardData.meritsFlaws.merits || []).filter(m => 
      m && m.name && m.name.trim() !== "" && m.value > 0
    );
    const validFlaws = (this.wizardData.meritsFlaws.flaws || []).filter(f => 
      f && f.name && f.name.trim() !== "" && f.value > 0
    );
    updateData["system.miscellaneous.merits"] = validMerits;
    updateData["system.miscellaneous.flaws"] = validFlaws;
    
    // Apply all updates in one go
    await this.actor.update(updateData);
  }
}
