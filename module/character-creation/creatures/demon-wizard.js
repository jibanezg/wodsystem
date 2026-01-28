/**
 * Demon Character Creation Wizard
 * Extends MortalWizard with Demon-specific functionality:
 * - Lore paths
 * - Faith and Torment
 * - House and Apocalyptic Form selection
 */

import { MortalWizard } from '../base/mortal-wizard.js';
import { i18n } from '../../helpers/i18n.js';

export class DemonWizard extends MortalWizard {
  /**
   * Initialize wizard data structure (Demon-specific additions)
   */
  _initializeWizardData() {
    const baseData = super._initializeWizardData();
    
    // Add Demon-specific concept fields
    baseData.concept.house = "";
    baseData.concept.apocalypticForm = "";
    
    // Add Demon-specific advantages
    baseData.advantages.lore = this._initializeLore();
    baseData.advantages.faith = this.config.advantages?.faith?.starting || 3;  // Demon: starting Faith is 3
    baseData.advantages.torment = this.config.advantages?.torment?.starting || 0;
    
    return baseData;
  }

  /**
   * Initialize lore paths for Demon
   */
  _initializeLore() {
    const lore = {};
    
    // Initialize lore paths for Demon from actor data if available
    if (this.actor.system?.lore) {
      // Load existing lore paths from actor
      for (const [lorePathId, loreData] of Object.entries(this.actor.system.lore)) {
        if (loreData && typeof loreData === 'object' && 'rating' in loreData) {
          lore[lorePathId] = loreData.rating || 0;
        }
      }
    }
    
    return lore;
  }

  /**
   * Load saved progress from actor flags (Demon-specific additions)
   */
  _loadProgress() {
    super._loadProgress();
    
    // CRITICAL: Ensure Faith is always at least the starting value (3)
    // This fixes bad saved progress that might have faith < 3
    const startingFaith = this.config.advantages?.faith?.starting || 3;
    if (!this.wizardData.advantages.faith || this.wizardData.advantages.faith < startingFaith) {
      this.wizardData.advantages.faith = startingFaith;
    }
    
    // Demon/Earthbound specific fields
    // Concept fields
    if (!this.wizardData.concept.house && this.actor.system?.identity?.house) {
      this.wizardData.concept.house = this.actor.system.identity.house;
    }
    if (!this.wizardData.concept.apocalypticForm && this.actor.system?.apocalypticForm) {
      this.wizardData.concept.apocalypticForm = this.actor.system.apocalypticForm;
    }
    
    // Advantages: Lore paths
    if (this.actor.system?.lore) {
      for (const [lorePathId, loreData] of Object.entries(this.actor.system.lore)) {
        if (loreData && typeof loreData === 'object' && 'rating' in loreData) {
          if (!this.wizardData.advantages.lore[lorePathId]) {
            this.wizardData.advantages.lore[lorePathId] = loreData.rating || 0;
          }
        }
      }
    }
    
    // Advantages: Faith
    if (this.actor.system?.advantages?.faith?.current !== undefined) {
      // Only load actor data if it's valid (>= starting value), otherwise use starting value
      const actorFaith = this.actor.system.advantages.faith.current;
      const startingFaith = this.config.advantages?.faith?.starting || 3;
      if (actorFaith >= startingFaith) {
        this.wizardData.advantages.faith = actorFaith;
      } else {
        // Actor has invalid/low faith value, use starting value
        this.wizardData.advantages.faith = startingFaith;
      }
    }
    
    // Advantages: Torment
    // If house is selected, set torment based on house, otherwise use actor data
    if (this.wizardData.concept?.house && game.wod?.gameDataService) {
      const initialTorment = game.wod.gameDataService.getInitialTormentForHouse(this.wizardData.concept.house);
      if (initialTorment > 0) {
        this.wizardData.advantages.torment = initialTorment;
      }
    } else if (this.actor.system?.advantages?.torment?.current !== undefined) {
      if (!this.wizardData.advantages.torment || this.wizardData.advantages.torment === this.config.advantages?.torment?.starting) {
        this.wizardData.advantages.torment = this.actor.system.advantages.torment.temporary || this.actor.system.advantages.torment.current || 0;
      }
    }
  }

  /**
   * Get data for template rendering (Demon-specific additions)
   */
  async getData() {
    const data = await super.getData();
    
    const step = this.config.steps[this.currentStep];
    
    // Load apocalyptic forms for Demon concept step (filtered by house if selected)
    let apocalypticFormsList = [];
    const service = game.wod?.referenceDataService;
    if (step.id === 'concept' && service && service.initialized) {
      const selectedHouse = this.wizardData.concept?.house;
      apocalypticFormsList = service.getApocalypticFormsList(selectedHouse || null);
    }
    
    // Populate apocalyptic form options dynamically if available
    // Only show apocalyptic form field if a house is selected
    if (step.id === 'concept') {
      const apocalypticFormField = data.config.concept?.fields?.find(f => f.name === 'apocalypticForm');
      if (apocalypticFormField) {
        const selectedHouse = this.wizardData.concept?.house;
        // CRITICAL: Always start hidden - will be shown by _updateApocalypticFormDropdown when house is selected
        apocalypticFormField.visible = false;
        apocalypticFormField.options = [];
        
        // Only populate if house is selected AND forms are available
        // But keep visible = false - the _updateApocalypticFormDropdown will handle showing it
        if (selectedHouse && apocalypticFormsList && apocalypticFormsList.length > 0) {
          apocalypticFormField.options = apocalypticFormsList;
        }
      }
    }
    
    // Load lore paths for Demon advantages step and freebies step
    let lorePathsList = [];
    if ((step.id === 'advantages' || step.id === 'freebies') && service && service.initialized) {
      const allLorePaths = service.getLorePaths();
      // Filter by house if selected, otherwise show all
      const selectedHouse = this.wizardData.concept?.house;
      if (selectedHouse) {
        lorePathsList = allLorePaths.filter(lore => 
          lore && lore.house && lore.house.toLowerCase() === selectedHouse.toLowerCase()
        );
      } else {
        lorePathsList = allLorePaths;
      }
      // Sort by name for display
      lorePathsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    data.lorePathsList = lorePathsList;
    
    // Capture baseline values when first entering freebies step (Demon-specific)
    if (step.id === 'freebies') {
      // Ensure freebies object exists
      if (!this.wizardData.freebies) {
        this.wizardData.freebies = { baselines: null, remaining: 0, spent: {} };
      }
      
      // CRITICAL: Only set baselines if they don't exist yet (first time entering freebies step)
      // This ensures baselines represent values BEFORE any freebie spending
      const baselinesJustSet = !this.wizardData.freebies.baselines;
      
      // Ensure baselines exist (parent may have set them, but we need to add Demon-specific ones)
      if (!this.wizardData.freebies.baselines) {
        this.wizardData.freebies.baselines = {
          attributes: JSON.parse(JSON.stringify(this.wizardData.attributes.values)),
          abilities: JSON.parse(JSON.stringify(this.wizardData.abilities.values)),
          backgrounds: this.wizardData.advantages.backgrounds.map(bg => ({
            name: bg.name,
            value: bg.value || 0
          })),
          virtues: this.config.advantages?.virtues ? JSON.parse(JSON.stringify(this.wizardData.advantages.virtues || {})) : {},
          willpower: 0
        };
      }
      
      // Add Demon-specific baselines (lore and faith) if not already set
      // Note: baselines is now guaranteed to be an object (not null) after the check above
      if (!this.wizardData.freebies.baselines.lore) {
        this.wizardData.freebies.baselines.lore = JSON.parse(JSON.stringify(this.wizardData.advantages.lore || {}));
      }
      if (this.wizardData.freebies.baselines.faith === undefined) {
        // CRITICAL: Baseline should ALWAYS be the starting value (3), not the current value
        // Also CRITICAL: Ensure wizardData.advantages.faith is at least the starting value
        // This prevents the initial 3 Faith from costing freebies, even if saved progress or actor data has wrong values
        const startingFaith = this.config.advantages?.faith?.starting || 3;
        
        // Force faith to be at least the starting value (fixes bad saved progress or actor data)
        if (!this.wizardData.advantages.faith || this.wizardData.advantages.faith < startingFaith) {
          this.wizardData.advantages.faith = startingFaith;
        }
        
        // Baseline is ALWAYS the starting value, never the current value
        this.wizardData.freebies.baselines.faith = startingFaith;
      } else {
        // FIX: If baseline was incorrectly set in a previous session, fix it now
        // Baseline should ALWAYS be the starting value (3), never anything else
        const startingFaith = this.config.advantages?.faith?.starting || 3;
        if (this.wizardData.freebies.baselines.faith !== startingFaith) {
          // Baseline was wrong - fix it and adjust freebie calculation
          const oldBaseline = this.wizardData.freebies.baselines.faith;
          this.wizardData.freebies.baselines.faith = startingFaith;
          
          // If current faith is less than starting, fix it (shouldn't cost freebies)
          if (!this.wizardData.advantages.faith || this.wizardData.advantages.faith < startingFaith) {
            this.wizardData.advantages.faith = startingFaith;
          }
        }
      }
      
      // Always recalculate remaining from scratch to ensure accuracy
      // This will correctly calculate based on current values vs baselines
      this._recalculateFreebiesRemaining();
    }
    
    return data;
  }

  /**
   * Recalculate freebie points remaining (Demon-specific: includes lore and faith)
   */
  _recalculateFreebiesRemaining() {
    const baselines = this.wizardData.freebies.baselines;
    if (!baselines) return; // Can't recalculate without baselines
    
    const freebieBonus = this.wizardData.meritsFlaws?.freebieBonus || 0;
    const baseTotal = this.config.freebies.total + freebieBonus;
    
    let totalSpent = 0;
    
    // Calculate spent on attributes
    for (const [cat, attrs] of Object.entries(this.wizardData.attributes.values)) {
      if (!baselines.attributes || !baselines.attributes[cat]) continue;
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
      if (!baselines.abilities || !baselines.abilities[cat]) continue;
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
    
    // Calculate spent on willpower
    const willpowerSpent = this.wizardData.freebies.spent.willpower || 0;
    if (willpowerSpent > 0) {
      totalSpent += willpowerSpent * this.config.freebies.costs.willpower;
    }
    
    // Calculate spent on virtues (Mortal and Demon)
    if (this.config.freebies.costs.virtue && this.wizardData.advantages.virtues) {
      const virtuesBaseline = baselines.virtues || {};
      const startingValue = this.config.advantages?.virtues?.starting || 1;
      for (const [virtueName, currentValue] of Object.entries(this.wizardData.advantages.virtues)) {
        const baselineValue = virtuesBaseline[virtueName] || startingValue;
        const spent = Math.max(0, currentValue - baselineValue);
        if (spent > 0) {
          totalSpent += spent * this.config.freebies.costs.virtue;
        }
      }
    }
    
    // Calculate spent on lore (Demon-specific)
    if (this.config.freebies.costs.lore && this.wizardData.advantages.lore) {
      const loreBaseline = baselines.lore || {};
      for (const [lorePathId, currentValue] of Object.entries(this.wizardData.advantages.lore)) {
        const baselineValue = loreBaseline[lorePathId] || 0;
        const spent = Math.max(0, currentValue - baselineValue);
        if (spent > 0) {
          totalSpent += spent * this.config.freebies.costs.lore;
        }
      }
    }
    
    // Calculate spent on faith (Demon-specific)
    if (this.config.freebies.costs.faith) {
      const faithBaseline = baselines.faith || this.config.advantages?.faith?.starting || 3;
      const currentFaith = this.wizardData.advantages.faith || faithBaseline;
      const faithSpent = Math.max(0, currentFaith - faithBaseline);
      if (faithSpent > 0) {
        totalSpent += faithSpent * this.config.freebies.costs.faith;
      }
    }
    
    // Update remaining - ensure it never goes negative (shouldn't happen, but safety check)
    this.wizardData.freebies.remaining = Math.max(0, baseTotal - totalSpent);
  }

  /**
   * Spend freebie point (Demon-specific: handles lore, faith)
   */
  async _spendFreebie(type, target, delta, bgName = null) {
    // Handle Demon-specific types (lore and faith only - virtues handled by parent)
    if (type === 'lore' || type === 'faith') {
      const baselines = this.wizardData.freebies.baselines;
      let cost = this.config.freebies.costs[type];
      const change = cost * delta;
      
      // Prevent spending if not enough freebies available
      if (delta > 0 && this.wizardData.freebies.remaining < cost) {
        ui.notifications.warn(game.i18n.localize('WODSYSTEM.Wizard.NotEnoughFreebiePointsGeneric'));
        return;
      }
      
      // Check baseline values for decrease operations
      if (delta < 0 && baselines) {
        let atBaseline = false;
        
        if (type === 'lore') {
          const lorePathId = target;
          const currentValue = this.wizardData.advantages.lore?.[lorePathId] || 0;
          const baselineValue = baselines?.lore?.[lorePathId] || 0;
          atBaseline = currentValue <= baselineValue;
        } else if (type === 'faith') {
          const currentFaith = this.wizardData.advantages.faith || this.config.advantages?.faith?.starting || 3;
          const baselineFaith = baselines?.faith || this.config.advantages?.faith?.starting || 3;
          atBaseline = currentFaith <= baselineFaith;
        } else if (type === 'virtue') {
          const virtueName = target;
          const currentValue = this.wizardData.advantages.virtues?.[virtueName] || this.config.advantages?.virtues?.starting || 1;
          const baselineValue = baselines?.virtues?.[virtueName] || this.config.advantages?.virtues?.starting || 1;
          atBaseline = currentValue <= baselineValue;
        }
        
        if (atBaseline) {
          ui.notifications.warn(game.i18n.localize('WODSYSTEM.Wizard.CannotDecreaseBelowPrevious'));
          return;
        }
      }
      
      let valueChanged = false;
      let newValue = 0;
      
      // Apply change based on type
      if (type === 'lore') {
        const lorePathId = target;
        if (!this.wizardData.advantages.lore) {
          this.wizardData.advantages.lore = {};
        }
        const loreCurrent = this.wizardData.advantages.lore[lorePathId] || 0;
        const loreBaseline = baselines?.lore?.[lorePathId] || 0;
        const loreMax = this.config.freebies.limits?.lore || 3;
        const loreNew = Math.max(loreBaseline, Math.min(loreMax, loreCurrent + delta));
        if (loreNew !== loreCurrent) {
          this.wizardData.advantages.lore[lorePathId] = loreNew;
          valueChanged = true;
          newValue = loreNew;
        }
      } else if (type === 'faith') {
        const faithBaseline = baselines?.faith || this.config.advantages?.faith?.starting || 3;
        const faithCurrent = this.wizardData.advantages.faith || faithBaseline;
        const faithMax = 10;
        const faithNew = Math.max(faithBaseline, Math.min(faithMax, faithCurrent + delta));
        if (faithNew !== faithCurrent) {
          this.wizardData.advantages.faith = faithNew;
          valueChanged = true;
          newValue = faithNew;
        }
      }
      
      if (!valueChanged) return;
      
      // Recalculate freebies remaining
      this._recalculateFreebiesRemaining();
      
      // Save progress
      await this._saveProgress();
      
      // Update DOM directly
      const html = this.element;
      
      if (type === 'lore') {
        const loreItem = html.find(`.freebie-item:has(button[data-type="lore"][data-target="${target}"])`);
        if (loreItem.length) {
          loreItem.find('.item-current').text(`${i18n('WODSYSTEM.Wizard.Current')}: ${newValue}`);
          const loreMax = this.config.freebies.limits?.lore || 3;
          const baselineValue = this.wizardData.freebies.baselines?.lore?.[target] || 0;
          loreItem.find('.freebie-decrease').prop('disabled', newValue <= baselineValue);
          loreItem.find('.freebie-increase').prop('disabled', newValue >= loreMax);
        }
      } else if (type === 'faith') {
        const faithItem = html.find(`.freebie-item:has(button[data-type="faith"][data-target="faith"])`);
        if (faithItem.length) {
          faithItem.find('.item-current').text(`${i18n('WODSYSTEM.Wizard.Current')}: ${newValue}`);
          const baselineFaith = this.wizardData.freebies.baselines?.faith || this.config.advantages?.faith?.starting || 3;
          faithItem.find('.freebie-decrease').prop('disabled', newValue <= baselineFaith);
          faithItem.find('.freebie-increase').prop('disabled', newValue >= 10);
        }
      }
      
      // Update freebies remaining counter
      const freebieBonus = this.wizardData.meritsFlaws?.freebieBonus || 0;
      const actualTotal = this.config.freebies.total + freebieBonus;
      html.find('.freebies-remaining .value').text(`${this.wizardData.freebies.remaining} / ${actualTotal}`);
      
      // Update all increase buttons based on remaining freebies (only lore and faith here)
      html.find('.freebie-increase').each((i, btn) => {
        const $btn = $(btn);
        const btnType = $btn.data('type');
        const btnTarget = $btn.data('target');
        
        // Only update lore and faith buttons in this Demon-specific handler
        if (btnType === 'lore') {
          const lorePathId = btnTarget;
          const currentValue = this.wizardData.advantages.lore?.[lorePathId] || 0;
          const loreMax = this.config.freebies.limits?.lore || 3;
          const btnCost = this.config.freebies.costs.lore;
          const notEnoughFreebies = this.wizardData.freebies.remaining < btnCost;
          const atMaxValue = currentValue >= loreMax;
          $btn.prop('disabled', notEnoughFreebies || atMaxValue);
        } else if (btnType === 'faith') {
          const currentFaith = this.wizardData.advantages.faith || this.config.advantages?.faith?.starting || 3;
          const btnCost = this.config.freebies.costs.faith;
          const notEnoughFreebies = this.wizardData.freebies.remaining < btnCost;
          const atMaxValue = currentFaith >= 10;
          $btn.prop('disabled', notEnoughFreebies || atMaxValue);
        }
      });
      
      // Update decrease button states
      this._updateFreebiesButtonStates(html);
      
      // Update navigation buttons
      this._updateNavigationButtons(html);
      
      return;
    }
    
    // For non-Demon types, call parent
    return super._spendFreebie(type, target, delta, bgName);
  }

  /**
   * Update freebie button states (Demon-specific: includes lore, faith)
   */
  _updateFreebiesButtonStates(html) {
    super._updateFreebiesButtonStates(html);
    
    const baselines = this.wizardData.freebies.baselines;
    if (!baselines) return;
    
    // Update Demon-specific decrease buttons
    html.find('.freebie-decrease').each((i, btn) => {
      const $btn = $(btn);
      const btnType = $btn.data('type');
      const btnTarget = $btn.data('target');
      let atBaseline = false;
      
      if (btnType === 'lore') {
        const lorePathId = btnTarget;
        const currentValue = this.wizardData.advantages.lore?.[lorePathId] || 0;
        const baselineValue = baselines.lore?.[lorePathId] || 0;
        atBaseline = currentValue <= baselineValue;
      } else if (btnType === 'faith') {
        const currentFaith = this.wizardData.advantages.faith || this.config.advantages?.faith?.starting || 3;
        const baselineFaith = baselines.faith || this.config.advantages?.faith?.starting || 3;
        atBaseline = currentFaith <= baselineFaith;
      }
      
      if (atBaseline) {
        $btn.prop('disabled', true);
      }
    });
    
    // Update Demon-specific increase buttons
    html.find('.freebie-increase').each((i, btn) => {
      const $btn = $(btn);
      const btnType = $btn.data('type');
      const btnTarget = $btn.data('target');
      let btnCost = this.config.freebies.costs[btnType];
      
      const notEnoughFreebies = this.wizardData.freebies.remaining < btnCost;
      let atMaxValue = false;
      
      if (btnType === 'lore') {
        const lorePathId = btnTarget;
        const currentValue = this.wizardData.advantages.lore?.[lorePathId] || 0;
        const loreMax = this.config.freebies.limits?.lore || 3;
        atMaxValue = currentValue >= loreMax;
      } else if (btnType === 'faith') {
        const currentFaith = this.wizardData.advantages.faith || this.config.advantages?.faith?.starting || 3;
        atMaxValue = currentFaith >= 10;
      }
      
      if (notEnoughFreebies || atMaxValue) {
        $btn.prop('disabled', true);
      }
    });
  }

  /**
   * Step: Concept listeners (Demon-specific additions)
   */
  _activateConceptListeners(html) {
    super._activateConceptListeners(html);
    
    // Demon-specific: Update apocalyptic form dropdown when house changes
    html.find('select[name="concept.house"]').on('change', async (event) => {
      const selectedHouse = $(event.target).val();
      this.wizardData.concept.house = selectedHouse;
      
      // Clear apocalyptic form selection when house changes
      this.wizardData.concept.apocalypticForm = '';
      
      // Update torment based on house selection
      if (selectedHouse && game.wod?.gameDataService) {
        const initialTorment = game.wod.gameDataService.getInitialTormentForHouse(selectedHouse);
        if (initialTorment > 0) {
          this.wizardData.advantages.torment = initialTorment;
          // Re-render to update the display if we're on the advantages step
          if (this.currentStep === 'advantages') {
            await this.render();
          }
        }
      }
      
      // Update the dropdown (this will show/hide based on house selection)
      await this._updateApocalypticFormDropdown(html);
    });
    
    // Demon-specific: Update apocalyptic form dropdown when house changes
    const apocalypticFormGroup = html.find('.form-group.apocalyptic-form-field');
    
    if (apocalypticFormGroup.length) {
      // CRITICAL: Force hide initially - template should add 'hidden' class but ensure it's there
      apocalypticFormGroup.addClass('hidden');
      apocalypticFormGroup.removeClass('apocalyptic-form-visible');
      // Also force via inline style as ultimate backup
      apocalypticFormGroup.css('display', 'none');
    } else {
      // Try alternative selectors
      const altSelect = html.find('select[name="concept.apocalypticForm"]');
      if (altSelect.length) {
        const parent = altSelect.closest('.form-group');
        if (parent.length) {
          parent.addClass('hidden').addClass('apocalyptic-form-field');
          parent.css('display', 'none');
        }
      }
    }
    
    // If house is already selected, show the field
    const selectedHouse = this.wizardData.concept?.house;
    if (selectedHouse) {
      this._updateApocalypticFormDropdown(html).catch(err => {
      });
    }
  }

  /**
   * Update apocalyptic form dropdown based on selected house (Demon only)
   */
  async _updateApocalypticFormDropdown(html) {
    const service = game.wod?.referenceDataService;
    if (!service || !service.initialized) {
      return;
    }
    
    const selectedHouse = this.wizardData.concept?.house;
    
    const apocalypticFormSelect = html.find('select[name="concept.apocalypticForm"]');
    const apocalypticFormGroup = apocalypticFormSelect.closest('.form-group');
    
    if (!apocalypticFormSelect.length || !apocalypticFormGroup.length) {
      return;
    }
    
    if (selectedHouse) {
      // Get filtered apocalyptic forms for this house
      const forms = service.getApocalypticFormsList(selectedHouse);

      // Show the field by removing the 'hidden' class and adding 'apocalyptic-form-visible'
      apocalypticFormGroup.removeClass('hidden');
      apocalypticFormGroup.addClass('apocalyptic-form-visible');
      apocalypticFormGroup.css('display', 'flex'); // Match the form-group default
      
      // Also show the label
      const label = apocalypticFormGroup.find('label');
      if (label.length) {
        label.css('display', 'block');
      }
      
      // Clear and repopulate options
      apocalypticFormSelect.empty();
      const selectLabel = game.i18n.localize('WODSYSTEM.Wizard.SelectLabel') || '-- Select';
      const fieldLabel = game.i18n.localize('WODSYSTEM.Wizard.FieldApocalypticForm') || 'Apocalyptic Form';
      apocalypticFormSelect.append(`<option value="">${selectLabel} ${fieldLabel} --</option>`);
      
      if (forms && forms.length > 0) {
        forms.forEach(formName => {
          const currentValue = this.wizardData.concept?.apocalypticForm || '';
          const selected = currentValue === formName ? 'selected' : '';
          apocalypticFormSelect.append(`<option value="${formName}" ${selected}>${formName}</option>`);
        });
      } else {
      }
    } else {
      // Hide the field by adding the 'hidden' class and removing 'apocalyptic-form-visible'
      apocalypticFormGroup.addClass('hidden');
      apocalypticFormGroup.removeClass('apocalyptic-form-visible');
      apocalypticFormGroup.css('display', 'none');
      
      // Also hide the label
      const label = apocalypticFormGroup.find('label');
      if (label.length) {
        label.css('display', 'none');
      }
      
      apocalypticFormSelect.empty();
      const selectLabel = game.i18n.localize('WODSYSTEM.Wizard.SelectLabel') || '-- Select';
      const fieldLabel = game.i18n.localize('WODSYSTEM.Wizard.FieldApocalypticForm') || 'Apocalyptic Form';
      apocalypticFormSelect.append(`<option value="">${selectLabel} ${fieldLabel} --</option>`);
    }
  }

  /**
   * Step: Advantages listeners (Demon-specific additions)
   */
  _activateAdvantagesListeners(html) {
    super._activateAdvantagesListeners(html);
    
    // Lore path listeners for Demon advantages step
    html.find('.lore-increase[data-lore]').click(async (event) => {
      const lorePathId = event.currentTarget.dataset.lore;
      await this._modifyLore(lorePathId, 1);
    });
    
    html.find('.lore-decrease[data-lore]').click(async (event) => {
      const lorePathId = event.currentTarget.dataset.lore;
      await this._modifyLore(lorePathId, -1);
    });
  }

  /**
   * Modify lore path rating (Demon-specific)
   * @param {string} lorePathId - Lore path ID
   * @param {number} delta - Change amount (+1 or -1)
   */
  async _modifyLore(lorePathId, delta) {
    if (!lorePathId) return;
    
    // Initialize lore object if it doesn't exist
    if (!this.wizardData.advantages.lore) {
      this.wizardData.advantages.lore = {};
    }
    
    const currentValue = this.wizardData.advantages.lore[lorePathId] || 0;
    const maxValue = this.config.advantages.lore.maxAtCreation || 3;
    const newValue = Math.max(0, Math.min(maxValue, currentValue + delta));
    
    if (newValue === 0) {
      delete this.wizardData.advantages.lore[lorePathId];
    } else {
      this.wizardData.advantages.lore[lorePathId] = newValue;
    }
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly without full render to avoid scroll
    const html = this.element;
    
    // Find the specific lore item
    const increaseBtn = html.find(`.lore-increase[data-lore="${lorePathId}"]`);
    const loreItem = increaseBtn.closest('.sphere-item');
    
    if (loreItem.length) {
      // Update the value display
      loreItem.find('.sphere-value').text(newValue);
      
      // Update the dots using the helper (max = maxAtCreation)
      const dotsDiv = loreItem.find('.sphere-dots');
      const dotsHtml = Handlebars.helpers.renderDots(newValue, maxValue);
      dotsDiv.html(dotsHtml.toString());
      
      // Update button states for this specific lore path
      loreItem.find('.lore-decrease').prop('disabled', newValue === 0);
      loreItem.find('.lore-increase').prop('disabled', newValue >= maxValue);
    }
    
    // Update points tracker and all buttons based on remaining points
    const newValidation = this._validateCurrentStep();
    if (newValidation.lore) {
      const tracker = html.find('.advantage-section:has(h4:contains("Lore")) .points-tracker');
      if (tracker.length) {
        tracker.find('.spent').text(newValidation.lore.spent);
        tracker.find('.allowed').text(newValidation.lore.allowed);
        const remainingSpan = tracker.find('.remaining');
        if (newValidation.lore.remaining > 0) {
          remainingSpan.text(`(${newValidation.lore.remaining} ${game.i18n.localize('WODSYSTEM.Wizard.Remaining')})`);
          remainingSpan.parent().show();
        } else {
          remainingSpan.parent().hide();
        }
      }
      
      // Enable/disable all increase buttons based on remaining points
      const noPointsLeft = newValidation.lore.remaining <= 0;
      html.find('.lore-increase').each((i, btn) => {
        const $btn = $(btn);
        const loreId = $btn.data('lore');
        const currentValue = this.wizardData.advantages.lore[loreId] || 0;
        const atMax = currentValue >= maxValue;
        $btn.prop('disabled', atMax || noPointsLeft);
      });
    }
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Apply wizard data to actor (Demon-specific additions)
   * Overrides parent to add Demon-specific fields to the same update
   */
  async _applyToActor() {
    // Build base updateData (replicate parent logic but don't apply yet)
    const updateData = {};
    
    // Step 1: Concept (add Demon-specific fields)
    updateData["system.identity.name"] = this.wizardData.concept.name ?? "";
    updateData["system.identity.concept"] = this.wizardData.concept.concept ?? "";
    updateData["system.identity.nature"] = this.wizardData.concept.nature ?? "";
    updateData["system.identity.demeanor"] = this.wizardData.concept.demeanor ?? "";
    
    // Demon-specific concept fields
    updateData["system.identity.house"] = this.wizardData.concept.house ?? "";
    updateData["system.apocalypticForm"] = this.wizardData.concept.apocalypticForm ?? "";
    
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
    // Virtues (Mortal and Demon)
    if (this.config.advantages?.virtues) {
      const virtues = {};
      for (const virtueName of this.config.advantages.virtues.available || []) {
        virtues[virtueName] = this.wizardData.advantages.virtues[virtueName] || this.config.advantages.virtues.starting || 1;
      }
      updateData["system.advantages.virtues"] = virtues;
    }
    
    // Demon-specific advantages
    // Lore paths
    const lorePaths = {};
    for (const [lorePathId, rating] of Object.entries(this.wizardData.advantages.lore || {})) {
      if (rating > 0) {
        lorePaths[lorePathId] = { rating: rating };
      }
    }
    updateData["system.lore"] = lorePaths;
    
    // Faith
    const faith = this.wizardData.advantages.faith || this.config.advantages?.faith?.starting || 3;  // Demon: starting Faith is 3
    updateData["system.advantages.faith.temporary"] = faith;
    updateData["system.advantages.faith.permanent"] = faith;
    
    // Torment
    const torment = this.wizardData.advantages.torment || this.config.advantages?.torment?.starting || 0;
    updateData["system.advantages.torment.temporary"] = torment;
    updateData["system.advantages.torment.permanent"] = torment;
    
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
    
    // Willpower calculation - For Demon: willpower = sum of two highest Virtues
    const virtues = this.wizardData.advantages.virtues || {};
    const virtueValues = Object.values(virtues).map(v => Number(v) || 0).sort((a, b) => b - a);
    const twoHighest = virtueValues.slice(0, 2);
    let totalWillpower = (twoHighest[0] || 0) + (twoHighest[1] || 0);
    // Add freebie willpower if any
    const freebieWillpower = this.wizardData.freebies.spent.willpower || 0;
    totalWillpower += freebieWillpower;
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
