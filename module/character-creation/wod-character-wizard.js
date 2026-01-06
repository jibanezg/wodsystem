/**
 * Character Creation Wizard for World of Darkness
 * Multi-step wizard for creating characters following WoD creation rules
 */

import { getWizardConfig } from './wizard-config.js';
import { WizardValidator } from './utils/validation.js';

export class WodCharacterWizard extends FormApplication {
  constructor(actor, options = {}) {
    super(actor, options);
    
    this.actor = actor;
    this.actorType = actor.type;
    this.config = getWizardConfig(this.actorType);
    
    if (!this.config) {
      throw new Error(`No wizard configuration found for actor type: ${this.actorType}`);
    }
    
    // Check permissions
    if (!this.actor.isOwner) {
      ui.notifications.warn("You don't have permission to edit this character. Wizard will be read-only.");
    }
    
    // Wizard state
    this.currentStep = 0;
    this.wizardData = this._initializeWizardData();
    this.validator = new WizardValidator(this.config);
    
    // Load saved progress if exists
    this._loadProgress();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wod-system", "character-wizard"],
      template: "systems/wodsystem/templates/apps/character-wizard.html",
      width: 800,
      height: 700,
      resizable: true,
      closeOnSubmit: false,
      submitOnClose: false,
      submitOnChange: false,
      title: "Character Creation Wizard"
    });
  }

  /**
   * Initialize wizard data structure
   */
  _initializeWizardData() {
    return {
      // Step 1: Concept
      concept: {
        name: "",
        concept: "",
        nature: "",
        demeanor: "",
        convention: "",
        amalgam: ""
      },

      // Step 2: Attributes
      attributes: {
        prioritySelection: { primary: null, secondary: null, tertiary: null },
        values: {
          physical: { Strength: 1, Dexterity: 1, Stamina: 1 },
          social: { Charisma: 1, Manipulation: 1, Appearance: 1 },
          mental: { Perception: 1, Intelligence: 1, Wits: 1 }
        }
      },

      // Step 3: Abilities
      abilities: {
        prioritySelection: { primary: null, secondary: null, tertiary: null },
        values: this._initializeAbilityValues(),
        secondary: {
          talents: [],
          skills: [],
          knowledges: []
        }
      },

      // Step 4: Advantages
      advantages: {
        backgrounds: [],
        spheres: this._initializeSpheres(),
        numina: {},
        enlightenment: this.config.advantages?.enlightenment?.starting || 1,
        freebiesSpent: 0  // Track freebies spent on Enlightenment
      },

      // Step 5: Freebies
      freebies: {
        spent: {},
        remaining: this.config.freebies.total
      }
    };
  }

  /**
   * Initialize ability values from actor data
   */
  _initializeAbilityValues() {
    const abilityValues = {
      talents: {},
      skills: {},
      knowledges: {}
    };

    // Get abilities from actor's system data
    const actorAbilities = this.actor.system.abilities || {};
    
    // Initialize each category with 0 for all abilities
    for (const category of this.config.abilities.categories) {
      const categoryAbilities = actorAbilities[category] || {};
      for (const abilityName in categoryAbilities) {
        abilityValues[category][abilityName] = this.config.abilities.starting || 0;
      }
    }

    console.log('🎯 INITIALIZED ABILITY VALUES:', abilityValues);
    return abilityValues;
  }

  /**
   * Initialize sphere values
   */
  _initializeSpheres() {
    const spheres = {};
    
    // Only initialize spheres for Technocrat
    if (this.actorType === "Technocrat" && this.config.advantages?.spheres?.available) {
      // spheres.available is an object like { correspondence: "Data", entropy: "Entropy", ... }
      for (const sphereKey in this.config.advantages.spheres.available) {
        spheres[sphereKey] = 0;
      }
      console.log('🎯 INITIALIZED SPHERE VALUES:', spheres);
    }
    
    return spheres;
  }

  /**
   * Load saved progress from actor flags
   */
  _loadProgress() {
    const saved = this.actor.getFlag('wodsystem', 'wizardProgress');
    if (saved) {
      this.currentStep = saved.currentStep || 0;
      this.wizardData = foundry.utils.mergeObject(this.wizardData, saved.data || {});
      
      // Ensure all spheres are initialized with at least 0
      if (this.actorType === "Technocrat" && this.config.advantages?.spheres?.available) {
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
  }

  /**
   * Save progress to actor flags
   */
  async _saveProgress() {
    // Check if user has permission to update the actor
    if (!this.actor.isOwner) {
      console.warn('WodCharacterWizard | User lacks permission to save progress');
      return;
    }
    
    try {
      await this.actor.setFlag('wodsystem', 'wizardProgress', {
        currentStep: this.currentStep,
        data: this.wizardData
      });
    } catch (error) {
      console.error('WodCharacterWizard | Error saving progress:', error);
      ui.notifications.warn("Unable to save wizard progress. You may not have permission to edit this character.");
    }
  }

  /**
   * Get data for template rendering
   */
  async getData() {
    const data = super.getData();
    
    const step = this.config.steps[this.currentStep];
    
    // Adjust freebies.remaining if entering for the first time after Enlightenment spending
    if (step.id === 'freebies') {
      const enlightenmentSpent = this.wizardData.advantages.freebiesSpent || 0;
      
      // Only adjust if remaining equals total (meaning no freebies have been spent yet in this step)
      if (this.wizardData.freebies.remaining === this.config.freebies.total && enlightenmentSpent > 0) {
        console.log(`💰 getData - First time in Freebies, adjusting for Enlightenment: ${this.config.freebies.total} - ${enlightenmentSpent} = ${this.config.freebies.total - enlightenmentSpent}`);
        this.wizardData.freebies.remaining = this.config.freebies.total - enlightenmentSpent;
      } else {
        console.log(`💰 getData - Freebies step, remaining: ${this.wizardData.freebies.remaining}, enlightenment: ${enlightenmentSpent}`);
      }
    }
    
    const validation = this._validateCurrentStep();
    
    // Load backgrounds from ReferenceDataService (same as character sheet)
    let backgroundsList = [];
    if ((step.id === 'advantages' || step.id === 'freebies') && window.referenceDataService) {
      backgroundsList = await window.referenceDataService.getBackgrounds(this.actorType);
    }
    
    
    
    return {
      actor: this.actor,
      actorType: this.actorType,
      config: this.config,
      currentStep: this.currentStep,
      totalSteps: this.config.steps.length,
      step: step,
      stepId: step.id,
      wizardData: this.wizardData,
      validation: validation,
      backgroundsList: backgroundsList, // List from ReferenceDataService
      isFirstStep: this.currentStep === 0,
      isLastStep: this.currentStep === this.config.steps.length - 1,
      progressPercent: Math.round((this.currentStep / (this.config.steps.length - 1)) * 100)
    };
  }

  /**
   * Validate current step
   */
  _validateCurrentStep() {
    const stepId = this.config.steps[this.currentStep].id;
    const result = this.validator.validateStep(stepId, this.wizardData);
    return result;
  }

  /**
   * Activate listeners for wizard controls
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Navigation buttons
    html.find('.wizard-next').click(this._onNext.bind(this));
    html.find('.wizard-prev').click(this._onPrevious.bind(this));
    html.find('.wizard-finish').click(this._onFinish.bind(this));
    html.find('.wizard-cancel').click(this._onCancel.bind(this));

    // Step-specific listeners
    this._activateStepListeners(html);

    // Apply initial validation state
    this._updateNavigationButtons(html);

    // Auto-save on changes
    html.find('input, select, textarea').on('change', () => {
      this._saveProgress();
    });
  }

  /**
   * Activate listeners specific to current step
   */
  _activateStepListeners(html) {
    const stepId = this.config.steps[this.currentStep].id;

    switch(stepId) {
      case 'concept':
        this._activateConceptListeners(html);
        break;
      case 'attributes':
        this._activateAttributesListeners(html);
        break;
      case 'abilities':
        this._activateAbilitiesListeners(html);
        break;
      case 'advantages':
        this._activateAdvantagesListeners(html);
        break;
      case 'freebies':
        this._activateFreebiesListeners(html);
        break;
      case 'review':
        this._activateReviewListeners(html);
        break;
    }
  }

  /**
   * Step: Concept listeners
   */
  _activateConceptListeners(html) {
    // Text inputs and textareas - only update data on input (no re-render to avoid clearing while typing)
    html.find('input[type="text"][name^="concept."], textarea[name^="concept."]').on('input', (event) => {
      const field = event.currentTarget.name.split('.')[1];
      this.wizardData.concept[field] = event.currentTarget.value;
      
      // Update validation state without full re-render
      this._updateNavigationButtons(html);
    });
    
    // Select inputs - also don't re-render, just update validation
    html.find('select[name^="concept."]').on('change', async (event) => {
      const field = event.currentTarget.name.split('.')[1];
      this.wizardData.concept[field] = event.currentTarget.value;
      
      // Update validation state without full re-render
      this._updateNavigationButtons(html);
      
      // Save progress
      await this._saveProgress();
    });
    
    // Save progress when text fields lose focus
    html.find('input[type="text"][name^="concept."], textarea[name^="concept."]').on('blur', async (event) => {
      await this._saveProgress();
    });
  }

  /**
   * Step: Attributes listeners
   */
  _activateAttributesListeners(html) {
    // Priority selection - needs re-render to update point allocations
    html.find('.priority-select').on('change', async (event) => {
      // Prevent default scrolling behavior
      event.preventDefault();
      
      // Capture scroll position IMMEDIATELY
      const scrollElement = this.element.find('.window-content');
      const scrollPosAtEvent = scrollElement.scrollTop();
      console.log('📜 SCROLL DEBUG - AT EVENT TIME:', scrollPosAtEvent);
      
      const category = event.currentTarget.dataset.category;  // e.g., "physical"
      const newPriority = event.currentTarget.value;          // e.g., "primary"
      
      console.log('🔄 Priority change EVENT:', {category, newPriority});
      console.log('🔄 Event target:', event.currentTarget);
      console.log('🔄 Dataset:', event.currentTarget.dataset);
      console.log('🔄 Value:', event.currentTarget.value);
      console.log('🔄 Before:', JSON.parse(JSON.stringify(this.wizardData.attributes.prioritySelection)));
      
      if (!newPriority) {
        console.log('🔄 Clearing category from all priorities (newPriority is empty)');
        // Clear this category from all priorities if deselecting
        for (const priority of ['primary', 'secondary', 'tertiary']) {
          if (this.wizardData.attributes.prioritySelection[priority] === category) {
            console.log(`🔄 Clearing ${priority} (was ${category})`);
            this.wizardData.attributes.prioritySelection[priority] = null;
          }
        }
      } else {
        console.log('🔄 Assigning new priority...');
        // Step 1: Clear this category from any priority it currently has
        for (const priority of ['primary', 'secondary', 'tertiary']) {
          if (this.wizardData.attributes.prioritySelection[priority] === category) {
            console.log(`🔄 Step 1: Clearing ${priority} because it was assigned to ${category}`);
            this.wizardData.attributes.prioritySelection[priority] = null;
          }
        }
        
        // Step 2: Clear the new priority from any category that has it
        const oldCategory = this.wizardData.attributes.prioritySelection[newPriority];
        if (oldCategory) {
          console.log(`🔄 Step 2: Clearing ${newPriority} (was ${oldCategory})`);
          this.wizardData.attributes.prioritySelection[newPriority] = null;
        }
        
        // Step 3: Assign the new priority to this category
        console.log(`🔄 Step 3: Assigning ${newPriority} = ${category}`);
        this.wizardData.attributes.prioritySelection[newPriority] = category;
      }
      
      console.log('🔄 After:', JSON.parse(JSON.stringify(this.wizardData.attributes.prioritySelection)));
      
      // Save progress
      await this._saveProgress();
      
      // Check if we need to do a full render (when structure changes)
      const selected = Object.values(this.wizardData.attributes.prioritySelection).filter(v => v !== null);
      const needsRender = selected.length === 3 && !this.element.find('.attribute-list:visible').length;
      
      if (needsRender) {
        // First time all 3 priorities are set - need full render to create controls
        console.log('🔄 Structure changed, doing full render');
        
        // Store scroll and focus
        const scrollElement = this.element.find('.window-content')[0];
        const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
        const activeElement = document.activeElement;
        if (activeElement) activeElement.blur();
        
        await this.render();
        
        // Restore scroll aggressively
        const newScrollElement = this.element.find('.window-content')[0];
        if (newScrollElement) {
          newScrollElement.scrollTop = scrollPos;
          requestAnimationFrame(() => {
            newScrollElement.scrollTop = scrollPos;
          });
        }
      } else {
        // Just update dropdown values, no render needed
        console.log('🔄 Just updating dropdowns, no render');
        const html = this.element;
        html.find('.priority-select').each((i, select) => {
          const category = $(select).data('category');
          let selectedPriority = '';
          
          for (const [priority, cat] of Object.entries(this.wizardData.attributes.prioritySelection)) {
            if (cat === category) {
              selectedPriority = priority;
              break;
            }
          }
          
          $(select).val(selectedPriority);
        });
      }
      
      // Update navigation buttons
      this._updateNavigationButtons(this.element);
    });

    // Attribute increase/decrease
    html.find('.attr-increase').click(async (event) => {
      const category = event.currentTarget.dataset.category;
      const attr = event.currentTarget.dataset.attr;
      await this._modifyAttribute(category, attr, 1);
    });

    html.find('.attr-decrease').click(async (event) => {
      const category = event.currentTarget.dataset.category;
      const attr = event.currentTarget.dataset.attr;
      await this._modifyAttribute(category, attr, -1);
    });
    
    // Restore dropdown values on initial load
    setTimeout(() => {
      console.log('🔄 Initial dropdown restoration for attributes');
      html.find('.priority-select').each((i, select) => {
        const category = $(select).data('category');
        let selectedPriority = '';
        
        // Find which priority this category has
        for (const [priority, cat] of Object.entries(this.wizardData.attributes.prioritySelection)) {
          if (cat === category) {
            selectedPriority = priority;
            break;
          }
        }
        
        console.log(`📋 Initial restore: ${category} -> ${selectedPriority}`);
        $(select).val(selectedPriority);
      });
    }, 0);
  }

  /**
   * Step: Abilities listeners
   */
  _activateAbilitiesListeners(html) {
    // Priority selection - needs re-render to update point allocations
    html.find('.priority-select').on('change', async (event) => {
      // Prevent default scrolling behavior
      event.preventDefault();
      
      // Capture scroll position IMMEDIATELY
      const scrollElement = this.element.find('.window-content');
      const scrollPosAtEvent = scrollElement.scrollTop();
      console.log('📜 ABILITIES SCROLL - AT EVENT TIME:', scrollPosAtEvent);
      
      const category = event.currentTarget.dataset.category;  // e.g., "talents"
      const newPriority = event.currentTarget.value;          // e.g., "primary"
      
      if (!newPriority) {
        // Clear this category from all priorities if deselecting
        for (const priority of ['primary', 'secondary', 'tertiary']) {
          if (this.wizardData.abilities.prioritySelection[priority] === category) {
            this.wizardData.abilities.prioritySelection[priority] = null;
          }
        }
      } else {
        // Step 1: Clear this category from any priority it currently has
        for (const priority of ['primary', 'secondary', 'tertiary']) {
          if (this.wizardData.abilities.prioritySelection[priority] === category) {
            this.wizardData.abilities.prioritySelection[priority] = null;
          }
        }
        
        // Step 2: Clear the new priority from any category that has it
        // (This prevents two categories from having the same priority)
        if (this.wizardData.abilities.prioritySelection[newPriority]) {
          this.wizardData.abilities.prioritySelection[newPriority] = null;
        }
        
        // Step 3: Assign the new priority to this category
        this.wizardData.abilities.prioritySelection[newPriority] = category;
      }
      
      // Save progress
      await this._saveProgress();
      
      // Check if we need to do a full render (when structure changes)
      const prioritySelection = this.wizardData.abilities.prioritySelection;
      const selected = Object.values(prioritySelection).filter(v => v !== null);
      const needsRender = selected.length === 3 && this.element.find('.ability-category .points-tracker').length === 0;
      
      console.log('🔄 ABILITIES - Selected priorities:', selected.length);
      console.log('🔄 ABILITIES - Trackers found:', this.element.find('.ability-category .points-tracker').length);
      console.log('🔄 ABILITIES - Needs render:', needsRender);
      
      if (needsRender) {
        // First time all 3 priorities are set - need full render to create controls
        console.log('🔄 ABILITIES - Structure changed, doing full render');
        
        // Store scroll and focus
        const scrollElement = this.element.find('.window-content')[0];
        const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
        console.log('📜 ABILITIES - Saving scroll position:', scrollPos);
        const activeElement = document.activeElement;
        if (activeElement) activeElement.blur();
        
        await this.render();
        
        // Restore scroll aggressively with multiple attempts
        const newScrollElement = this.element.find('.window-content')[0];
        if (newScrollElement) {
          const forceScroll = () => {
            newScrollElement.scrollTop = scrollPos;
            console.log('📜 ABILITIES - Forced scroll to:', scrollPos, 'actual:', newScrollElement.scrollTop);
          };
          
          forceScroll();
          requestAnimationFrame(() => {
            forceScroll();
            requestAnimationFrame(forceScroll);
          });
          setTimeout(forceScroll, 50);
          setTimeout(forceScroll, 100);
        }
        
        // Force update the dropdown values after render
        setTimeout(() => {
          const html = this.element;
          html.find('.priority-select').each((i, select) => {
            const category = $(select).data('category');
            let selectedPriority = '';
            for (const [priority, cat] of Object.entries(this.wizardData.abilities.prioritySelection)) {
              if (cat === category) {
                selectedPriority = priority;
                break;
              }
            }
            $(select).val(selectedPriority);
          });
        }, 0);
      } else {
        // Just update dropdown values, no render needed
        console.log('🔄 ABILITIES - Just updating dropdowns, no render');
        const html = this.element;
        html.find('.priority-select').each((i, select) => {
          const category = $(select).data('category');
          let selectedPriority = '';
          
          for (const [priority, cat] of Object.entries(this.wizardData.abilities.prioritySelection)) {
            if (cat === category) {
              selectedPriority = priority;
              break;
            }
          }
          
          $(select).val(selectedPriority);
        });
      }
      
      // Update navigation buttons
      this._updateNavigationButtons(this.element);
    });

    // Ability increase/decrease (primary abilities)
    html.find('.ability-item:not(.secondary) .ability-increase').click(async (event) => {
      const category = event.currentTarget.dataset.category;
      const ability = event.currentTarget.dataset.ability;
      await this._modifyAbility(category, ability, 1);
    });

    html.find('.ability-item:not(.secondary) .ability-decrease').click(async (event) => {
      const category = event.currentTarget.dataset.category;
      const ability = event.currentTarget.dataset.ability;
      await this._modifyAbility(category, ability, -1);
    });

    // Secondary ability name input - use 'input' event to avoid clearing while typing
    html.find('.ability-name-input').on('input', (event) => {
      const $item = $(event.currentTarget).closest('.ability-item.secondary');
      const index = parseInt($item.data('index'));
      const $section = $(event.currentTarget).closest('.secondary-abilities');
      const category = $section.data('category');
      const value = event.currentTarget.value;
      
      if (this.wizardData.abilities.secondary[category] && this.wizardData.abilities.secondary[category][index]) {
        this.wizardData.abilities.secondary[category][index].name = value;
      }
    });
    
    // Save progress when secondary ability name loses focus
    html.find('.ability-name-input').on('blur', async (event) => {
      await this._saveProgress();
    });

    // Secondary ability increase/decrease - using event delegation
    html.on('click', '.ability-item.secondary .ability-increase', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('🔘 SECONDARY ABILITY CLICK - Increase button clicked');
      const $item = $(event.currentTarget).closest('.ability-item.secondary');
      const index = parseInt($item.data('index'));
      const $section = $item.closest('.secondary-abilities');
      const category = $section.data('category');
      console.log(`🔘 SECONDARY ABILITY CLICK - category: ${category}, index: ${index}`);
      await this._modifySecondaryAbility(category, index, 1);
    });

    html.on('click', '.ability-item.secondary .ability-decrease', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('🔘 SECONDARY ABILITY CLICK - Decrease button clicked');
      const $item = $(event.currentTarget).closest('.ability-item.secondary');
      const index = parseInt($item.data('index'));
      const $section = $item.closest('.secondary-abilities');
      const category = $section.data('category');
      console.log(`🔘 SECONDARY ABILITY CLICK - category: ${category}, index: ${index}`);
      await this._modifySecondaryAbility(category, index, -1);
    });

    // Add secondary ability
    html.find('.add-secondary').click(async (event) => {
      const category = event.currentTarget.dataset.category;
      await this._addSecondaryAbility(category);
    });
    
    // Restore dropdown values on initial load
    setTimeout(() => {
      console.log('🔄 Initial dropdown restoration for abilities');
      html.find('.priority-select').each((i, select) => {
        const category = $(select).data('category');
        let selectedPriority = '';
        
        // Find which priority this category has
        for (const [priority, cat] of Object.entries(this.wizardData.abilities.prioritySelection)) {
          if (cat === category) {
            selectedPriority = priority;
            break;
          }
        }
        
        console.log(`📋 Initial restore: ${category} -> ${selectedPriority}`);
        $(select).val(selectedPriority);
      });
    }, 0);
    
    // Debug: Check how many secondary ability buttons exist
    console.log(`🔘 SECONDARY ABILITY LISTENERS - Found ${html.find('.ability-item.secondary .ability-increase').length} increase buttons`);
    console.log(`🔘 SECONDARY ABILITY LISTENERS - Found ${html.find('.ability-item.secondary .ability-decrease').length} decrease buttons`);
  }

  /**
   * Step: Advantages listeners
   */
  _activateAdvantagesListeners(html) {
    // Add background
    html.find('.add-background').click(async () => {
      await this._addBackground();
    });

    // Remove background
    html.find('.remove-background').click(async (event) => {
      event.preventDefault();
      document.activeElement?.blur();
      
      const scrollElement = this.element.find('.window-content')[0];
      const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
      
      const index = parseInt(event.currentTarget.dataset.index);
      this.wizardData.advantages.backgrounds.splice(index, 1);
      await this._saveProgress();
      await this.render();
      
      // Aggressively restore scroll position
      requestAnimationFrame(() => {
        const newScrollElement = this.element.find('.window-content')[0];
        if (newScrollElement) {
          newScrollElement.scrollTop = scrollPos;
          setTimeout(() => {
            newScrollElement.scrollTop = scrollPos;
          }, 0);
          setTimeout(() => {
            newScrollElement.scrollTop = scrollPos;
          }, 50);
        }
      });
    });

    // Background selection
    html.find('.background-select').on('change', async (event) => {
      event.preventDefault();
      document.activeElement?.blur();
      
      const scrollElement = this.element.find('.window-content')[0];
      const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
      
      const index = parseInt(event.currentTarget.dataset.index);
      const value = event.currentTarget.value;
      
      if (this.wizardData.advantages.backgrounds[index]) {
        this.wizardData.advantages.backgrounds[index].name = value;
        await this._saveProgress();
        await this.render();
        
        // Aggressively restore scroll position
        requestAnimationFrame(() => {
          const newScrollElement = this.element.find('.window-content')[0];
          if (newScrollElement) {
            newScrollElement.scrollTop = scrollPos;
            setTimeout(() => {
              newScrollElement.scrollTop = scrollPos;
            }, 0);
            setTimeout(() => {
              newScrollElement.scrollTop = scrollPos;
            }, 50);
          }
        });
        
        // Force update the background select dropdowns after render
        setTimeout(() => {
          const html = this.element;
          html.find('.background-select').each((i, select) => {
            const idx = parseInt($(select).data('index'));
            const bgName = this.wizardData.advantages.backgrounds[idx]?.name || '';
            $(select).val(bgName);
          });
        }, 0);
      }
    });

    // Background increase/decrease
    html.find('.bg-increase').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      await this._modifyBackground(index, 1);
    });

    html.find('.bg-decrease').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      await this._modifyBackground(index, -1);
    });

    // Enlightenment increase/decrease (Technocrat only)
    html.find('.enlightenment-increase').click(async (event) => {
      await this._modifyEnlightenment(1);
    });

    html.find('.enlightenment-decrease').click(async (event) => {
      await this._modifyEnlightenment(-1);
    });

    // Sphere increase/decrease
    const sphereIncreaseButtons = html.find('.sphere-increase');
    const sphereDecreaseButtons = html.find('.sphere-decrease');
    
    sphereIncreaseButtons.click(async (event) => {
      const sphere = event.currentTarget.dataset.sphere;
      await this._modifySphere(sphere, 1);
    });

    sphereDecreaseButtons.click(async (event) => {
      const sphere = event.currentTarget.dataset.sphere;
      await this._modifySphere(sphere, -1);
    });
  }

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
                ui.notifications.warn(`Cannot add more sphere points. Maximum ${this.config.advantages.spheres.points} total sphere points allowed.`);
                return;
            }
            
            // Check individual sphere limit (can't exceed enlightenment)
            if (current >= enlightenment) {
                ui.notifications.warn(`${sphere} cannot exceed your Enlightenment (${enlightenment}). Increase Enlightenment to add more dots.`);
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
        ui.notifications.warn(`Enlightenment is already at maximum (${max}).`);
        return;
      }
      const freebiesAvailable = freebiesTotal - freebiesSpent;
      if (freebiesAvailable < cost) {
        ui.notifications.warn(`Not enough Freebie Points. Need ${cost}, have ${freebiesAvailable}.`);
        return;
      }
    }
    
    // If decreasing, check if we're at starting value
    if (delta < 0 && current <= starting) {
      ui.notifications.warn(`Enlightenment cannot go below starting value (${starting}).`);
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
        ui.notifications.warn(`Cannot reduce Enlightenment to ${newValue}. The following spheres exceed this limit: ${problemSpheres}`);
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
   * Step: Freebies listeners
   */
  _activateFreebiesListeners(html) {
    // Freebie spending
    html.find('.freebie-increase').click(async (event) => {
      const type = event.currentTarget.dataset.type;
      const target = event.currentTarget.dataset.target;
      const bgName = event.currentTarget.dataset.bgName; // For backgrounds
      await this._spendFreebie(type, target, 1, bgName);
    });

    html.find('.freebie-decrease').click(async (event) => {
      const type = event.currentTarget.dataset.type;
      const target = event.currentTarget.dataset.target;
      const bgName = event.currentTarget.dataset.bgName; // For backgrounds
      await this._spendFreebie(type, target, -1, bgName);
    });
  }

  /**
   * Step: Review listeners
   */
  _activateReviewListeners(html) {
    // Jump to specific step
    html.find('.review-edit-step').click((event) => {
      const step = parseInt(event.currentTarget.dataset.step);
      this.currentStep = step;
      this.render();
    });
  }

  /**
   * Modify attribute value
   */
  async _modifyAttribute(category, attr, delta) {
    const current = this.wizardData.attributes.values[category][attr];
    const newValue = Math.max(1, Math.min(5, current + delta));
    
    // Check if we have points available
    const validation = this._validateCurrentStep();
    if (delta > 0 && validation.attributes?.[category]?.remaining <= 0) {
      ui.notifications.warn(`No more points available for ${category} attributes.`);
      return;
    }
    
    this.wizardData.attributes.values[category][attr] = newValue;
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly without full render to avoid scroll
    const html = this.element;
    
    // Update the value display
    const valueSpan = html.find(`.attr-value`).filter((i, el) => {
      const item = $(el).closest('.attribute-item');
      const nameSpan = item.find('.attr-name').text();
      return nameSpan === attr;
    });
    valueSpan.text(newValue);
    
    // Update the dots using the helper
    const dotsDiv = valueSpan.closest('.attribute-item').find('.attr-dots');
    const dotsHtml = Handlebars.helpers.renderDots(newValue, 5);
    dotsDiv.html(dotsHtml.toString());
    
    // Update button states
    const item = valueSpan.closest('.attribute-item');
    item.find('.attr-decrease').prop('disabled', newValue === 1);
    item.find('.attr-increase').prop('disabled', newValue === 5);
    
    // Update points tracker
    const newValidation = this._validateCurrentStep();
    if (newValidation.attributes?.[category]) {
      const tracker = html.find(`.attribute-category:has(h4:contains("${category.charAt(0).toUpperCase() + category.slice(1)}"))`).find('.points-tracker');
      const detail = newValidation.attributes[category];
      tracker.find('.spent').text(detail.spent);
      tracker.find('.remaining').text(detail.remaining);
      if (detail.remaining > 0) {
        tracker.find('.remaining').parent().show();
      } else {
        tracker.find('.remaining').parent().hide();
      }
    }
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Modify ability value
   */
  async _modifyAbility(category, ability, delta) {
    if (!this.wizardData.abilities.values[category][ability]) {
      this.wizardData.abilities.values[category][ability] = 0;
    }
    
    const current = this.wizardData.abilities.values[category][ability];
    const max = this.config.abilities.maxAtCreation;
    const newValue = Math.max(0, Math.min(max, current + delta));
    
    // Check if we have points available
    const validation = this._validateCurrentStep();
    if (delta > 0 && validation.abilities?.[category]?.remaining <= 0) {
      ui.notifications.warn(`No more points available for ${category}.`);
      return;
    }
    
    this.wizardData.abilities.values[category][ability] = newValue;
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly without full render to avoid scroll
    const html = this.element;
    
    // Find the specific ability item
    const abilityItems = html.find('.ability-item');
    let targetItem = null;
    abilityItems.each((i, item) => {
      const $item = $(item);
      const nameSpan = $item.find('.ability-name').text().trim();
      if (nameSpan === ability) {
        targetItem = $item;
        return false; // break
      }
    });
    
    if (targetItem) {
      // Update the value display
      targetItem.find('.ability-value').text(newValue);
      
      // Update the dots using the helper
      const dotsDiv = targetItem.find('.ability-dots');
      const dotsHtml = Handlebars.helpers.renderDots(newValue, max);
      dotsDiv.html(dotsHtml.toString());
      
      // Update button states
      targetItem.find('.ability-decrease').prop('disabled', newValue === 0);
      targetItem.find('.ability-increase').prop('disabled', newValue === max);
    }
    
    // Update points tracker
    const newValidation = this._validateCurrentStep();
    if (newValidation.abilities?.[category]) {
      const categoryDiv = html.find('.ability-category').filter((i, el) => {
        return $(el).find('h4').text().toLowerCase().includes(category.toLowerCase());
      });
      
      const tracker = categoryDiv.find('.points-tracker');
      const detail = newValidation.abilities[category];
      tracker.find('.spent').text(detail.spent);
      tracker.find('.remaining').text(detail.remaining);
      if (detail.remaining > 0) {
        tracker.find('.remaining').parent().show();
      } else {
        tracker.find('.remaining').parent().hide();
      }
    }
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Add secondary ability
   */
  async _addSecondaryAbility(category) {
    const name = prompt(`Enter new ${category} ability name:`);
    if (!name) return;
    
    const scrollElement = this.element.find('.window-content')[0];
    const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
    
    this.wizardData.abilities.secondary[category].push({
      name: name,
      value: 0
    });
    
    await this._saveProgress();
    await this.render();
    
    // Aggressively restore scroll position
    requestAnimationFrame(() => {
      const newScrollElement = this.element.find('.window-content')[0];
      if (newScrollElement) {
        newScrollElement.scrollTop = scrollPos;
        setTimeout(() => {
          newScrollElement.scrollTop = scrollPos;
        }, 0);
        setTimeout(() => {
          newScrollElement.scrollTop = scrollPos;
        }, 50);
      }
    });
  }

  /**
   * Modify secondary ability value
   */
  async _modifySecondaryAbility(category, index, delta) {
    if (!this.wizardData.abilities.secondary[category] || !this.wizardData.abilities.secondary[category][index]) {
      return;
    }
    
    const secondary = this.wizardData.abilities.secondary[category][index];
    const current = secondary.value || 0;
    const max = this.config.abilities.maxAtCreation;
    const newValue = Math.max(0, Math.min(max, current + delta));
    
    // Check if we have points available
    const validation = this._validateCurrentStep();
    const priority = Object.keys(this.wizardData.abilities.prioritySelection)
      .find(p => this.wizardData.abilities.prioritySelection[p] === category);
    
    if (delta > 0 && validation.abilities?.[category]?.remaining <= 0) {
      ui.notifications.warn(`No more points available for ${category}.`);
      return;
    }
    
    this.wizardData.abilities.secondary[category][index].value = newValue;
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly without full render to avoid scroll
    const html = this.element;
    
    // Find the specific secondary ability item using data-category and data-index
    const targetItem = html.find(`.secondary-abilities[data-category="${category}"] .ability-item.secondary[data-index="${index}"]`);
    
    if (targetItem.length) {
      console.log(`🔄 SECONDARY ABILITY UPDATE - ${category}[${index}]: ${current} -> ${newValue}`);
      
      // Update the value display
      targetItem.find('.ability-value').text(newValue);
      
      // Update the dots using the helper
      const dotsDiv = targetItem.find('.ability-dots');
      const dotsHtml = Handlebars.helpers.renderDots(newValue, max);
      console.log(`🔄 SECONDARY ABILITY UPDATE - Dots HTML:`, dotsHtml.toString());
      dotsDiv.html(dotsHtml.toString());
      
      // Update button states
      targetItem.find('.ability-decrease').prop('disabled', newValue === 0);
      targetItem.find('.ability-increase').prop('disabled', newValue === max);
    } else {
      console.error(`🔄 SECONDARY ABILITY UPDATE - Could not find item for ${category}[${index}]`);
    }
    
    // Update points tracker
    const newValidation = this._validateCurrentStep();
    if (newValidation.abilities?.[category]) {
      const categoryDiv = html.find('.ability-category').filter((i, el) => {
        return $(el).find('h4').text().toLowerCase().includes(category.toLowerCase());
      });
      
      const tracker = categoryDiv.find('.points-tracker');
      const detail = newValidation.abilities[category];
      tracker.find('.spent').text(detail.spent);
      tracker.find('.remaining').text(detail.remaining);
    }
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Add background
   */
  async _addBackground() {
    const scrollElement = this.element.find('.window-content')[0];
    const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
    
    this.wizardData.advantages.backgrounds.push({
      name: "",
      value: 0
    });
    
    await this._saveProgress();
    await this.render();
    
    // Aggressively restore scroll position
    requestAnimationFrame(() => {
      const newScrollElement = this.element.find('.window-content')[0];
      if (newScrollElement) {
        newScrollElement.scrollTop = scrollPos;
        setTimeout(() => {
          newScrollElement.scrollTop = scrollPos;
        }, 0);
        setTimeout(() => {
          newScrollElement.scrollTop = scrollPos;
        }, 50);
      }
    });
  }

  /**
   * Modify sphere value
   */
  /**
   * Modify background value
   */
  async _modifyBackground(index, delta) {
    const background = this.wizardData.advantages.backgrounds[index];
    if (!background) return;
    
    const current = background.value || 0;
    const max = this.config.advantages.backgrounds.maxPerBackground;
    const newValue = Math.max(0, Math.min(max, current + delta));
    
    // Check if we have points available
    const validation = this._validateCurrentStep();
    if (delta > 0 && validation.backgrounds?.remaining <= 0) {
      ui.notifications.warn("No more background points available.");
      return;
    }
    
    this.wizardData.advantages.backgrounds[index].value = newValue;
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly without full render to avoid scroll
    const html = this.element;
    
    // Find the specific background item
    const bgItem = html.find(`.background-item:has(.background-select[data-index="${index}"])`);
    
    if (bgItem.length) {
      console.log(`🔄 BACKGROUND UPDATE - [${index}] ${background.name}: ${current} -> ${newValue}`);
      
      // Update the value display
      bgItem.find('.bg-value').text(newValue);
      
      // Update the dots using the helper
      const dotsDiv = bgItem.find('.background-dots');
      const dotsHtml = Handlebars.helpers.renderDots(newValue, max);
      dotsDiv.html(dotsHtml.toString());
      
      // Update button states
      bgItem.find('.bg-decrease').prop('disabled', newValue === 0);
      bgItem.find('.bg-increase').prop('disabled', newValue === max);
    }
    
    // Update points tracker and all buttons based on remaining points
    const newValidation = this._validateCurrentStep();
    if (newValidation.backgrounds) {
      const tracker = html.find('.advantage-section:has(h4:contains("Backgrounds")) .points-tracker');
      tracker.find('.spent').text(newValidation.backgrounds.spent);
      tracker.find('.remaining').text(newValidation.backgrounds.remaining);
      if (newValidation.backgrounds.remaining > 0) {
        tracker.find('.remaining').parent().show();
      } else {
        tracker.find('.remaining').parent().hide();
      }
      
      // Enable/disable all increase buttons based on remaining points
      const noPointsLeft = newValidation.backgrounds.remaining <= 0;
      html.find('.bg-increase').each((i, btn) => {
        const $btn = $(btn);
        const bgIndex = parseInt($btn.data('index'));
        const bg = this.wizardData.advantages.backgrounds[bgIndex];
        const currentValue = bg?.value || 0;
        const atMax = currentValue >= max;
        $btn.prop('disabled', atMax || noPointsLeft);
      });
    }
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Spend freebie point
   */
  async _spendFreebie(type, target, delta, bgName = null) {
    const cost = this.config.freebies.costs[type];
    const change = cost * delta;
    
    if (delta > 0 && this.wizardData.freebies.remaining < cost) {
      ui.notifications.warn("Not enough freebie points.");
      return;
    }
    
    let valueChanged = false;
    let newValue = 0;
    
    // Apply change based on type
    switch(type) {
      case 'attribute':
        const [attrCat, attrName] = target.split('.');
        const attrCurrent = this.wizardData.attributes.values[attrCat][attrName];
        const attrNew = Math.max(1, Math.min(5, attrCurrent + delta));
        if (attrNew !== attrCurrent) {
          this.wizardData.attributes.values[attrCat][attrName] = attrNew;
          this.wizardData.freebies.remaining -= change;
          valueChanged = true;
          newValue = attrNew;
        }
        break;
        
      case 'ability':
        const [abCat, abName] = target.split('.');
        const abCurrent = this.wizardData.abilities.values[abCat][abName] || 0;
        const abNew = Math.max(0, Math.min(5, abCurrent + delta));
        if (abNew !== abCurrent) {
          this.wizardData.abilities.values[abCat][abName] = abNew;
          this.wizardData.freebies.remaining -= change;
          valueChanged = true;
          newValue = abNew;
        }
        break;
        
      case 'background':
        let bgIndex = parseInt(target);
        let bgCreated = false;
        
        // If background doesn't exist yet (bgIndex = -1), create it
        if (bgIndex === -1 && bgName && delta > 0) {
          this.wizardData.advantages.backgrounds.push({
            name: bgName,
            value: 0
          });
          bgIndex = this.wizardData.advantages.backgrounds.length - 1;
          bgCreated = true;
        }
        
        // Only proceed if we have a valid index
        if (bgIndex >= 0 && bgIndex < this.wizardData.advantages.backgrounds.length) {
          const bgCurrent = this.wizardData.advantages.backgrounds[bgIndex].value;
          const bgNew = Math.max(0, Math.min(5, bgCurrent + delta));
          if (bgNew !== bgCurrent) {
            this.wizardData.advantages.backgrounds[bgIndex].value = bgNew;
            this.wizardData.freebies.remaining -= change;
            valueChanged = true;
            newValue = bgNew;
            
            // If we just created a new background, we need to do a full render
            // to update all the data-target indices
            if (bgCreated) {
              await this._saveProgress();
              this.render();
              return;
            }
          }
        }
        break;
        
      case 'sphere':
        const sphereCurrent = this.wizardData.advantages.spheres[target] || 0;
        const enlightenment = this.wizardData.advantages.enlightenment || this.config.advantages.enlightenment.starting;
        const sphereNew = Math.max(0, Math.min(enlightenment, sphereCurrent + delta));
        if (sphereNew !== sphereCurrent) {
          this.wizardData.advantages.spheres[target] = sphereNew;
          this.wizardData.freebies.remaining -= change;
          valueChanged = true;
          newValue = sphereNew;
        } else if (delta > 0 && sphereCurrent >= enlightenment) {
          ui.notifications.warn(`Cannot increase sphere above your Enlightenment (${enlightenment}).`);
          return;
        }
        break;
        
      case 'willpower':
        // Track willpower spending separately
        if (!this.wizardData.freebies.spent.willpower) {
          this.wizardData.freebies.spent.willpower = 0;
        }
        const wpNew = Math.max(0, this.wizardData.freebies.spent.willpower + delta);
        if (wpNew !== this.wizardData.freebies.spent.willpower) {
          this.wizardData.freebies.spent.willpower = wpNew;
          this.wizardData.freebies.remaining -= change;
          valueChanged = true;
          newValue = this.config.advantages.willpower.starting + wpNew;
        }
        break;
    }
    
    if (!valueChanged) return;
    
    // Save progress
    await this._saveProgress();
    
    // Update DOM directly instead of full render
    const html = this.element;
    
    // Find the specific item and update it
    const button = html.find(`button[data-type="${type}"][data-target="${target}"]`).first();
    const freebieItem = button.closest('.freebie-item');
    
    if (freebieItem.length) {
      // Update the current value display
      freebieItem.find('.item-current').text(newValue);
      
      // Update button states
      if (type === 'attribute') {
        freebieItem.find('.freebie-decrease').prop('disabled', newValue === 1);
        freebieItem.find('.freebie-increase').prop('disabled', newValue === 5);
      } else if (type === 'ability') {
        freebieItem.find('.freebie-decrease').prop('disabled', newValue === 0);
        freebieItem.find('.freebie-increase').prop('disabled', newValue === 5);
      } else if (type === 'background') {
        freebieItem.find('.freebie-decrease').prop('disabled', newValue === 0);
        freebieItem.find('.freebie-increase').prop('disabled', newValue === 5);
      } else if (type === 'sphere') {
        const enlightenment = this.wizardData.advantages.enlightenment || this.config.advantages.enlightenment.starting;
        freebieItem.find('.freebie-decrease').prop('disabled', newValue === 0);
        freebieItem.find('.freebie-increase').prop('disabled', newValue >= enlightenment);
      }
    } else if (type === 'willpower') {
      // Willpower has different structure
      const wpSection = html.find('.willpower-freebie');
      wpSection.find('strong').text(newValue);
      wpSection.find('.freebie-decrease').prop('disabled', this.wizardData.freebies.spent.willpower === 0);
      wpSection.find('.freebie-increase').prop('disabled', this.wizardData.freebies.spent.willpower >= 10);
    }
    
    // Update freebies remaining counter (format: Remaining / Total)
    html.find('.freebies-remaining .value').text(`${this.wizardData.freebies.remaining} / ${this.config.freebies.total}`);
    
    // Update all increase buttons based on remaining freebies and current values
    html.find('.freebie-increase').each((i, btn) => {
      const $btn = $(btn);
      const btnType = $btn.data('type');
      const btnTarget = $btn.data('target');
      const btnCost = this.config.freebies.costs[btnType];
      
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
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Navigate to next step
   */
  async _onNext(event) {
    event.preventDefault();
    
    // Validate current step
    const validation = this._validateCurrentStep();
    if (!validation.valid) {
      ui.notifications.error(validation.message || "Please complete all required fields before continuing.");
      return;
    }
    
    // Move to next step
    if (this.currentStep < this.config.steps.length - 1) {
      this.currentStep++;
      await this._saveProgress();
      this.render();
    }
  }

  /**
   * Navigate to previous step
   */
  async _onPrevious(event) {
    event.preventDefault();
    
    if (this.currentStep > 0) {
      this.currentStep--;
      await this._saveProgress();
      this.render();
    }
  }

  /**
   * Update navigation buttons without full re-render
   */
  _updateNavigationButtons(html) {
    const validation = this._validateCurrentStep();
    const nextButton = html.find('.wizard-next');
    const finishButton = html.find('.wizard-finish');
    
    // Debug logging
    console.log('Validation result:', validation);
    console.log('Current step data:', this.wizardData[this.config.steps[this.currentStep].id]);
    
    if (validation.valid) {
      nextButton.prop('disabled', false).removeClass('disabled');
      finishButton.prop('disabled', false).removeClass('disabled');
    } else {
      nextButton.prop('disabled', true).addClass('disabled');
      finishButton.prop('disabled', true).addClass('disabled');
    }
    
    // Update validation message
    const validationContainer = html.find('.wizard-validation');
    if (validation.valid) {
      validationContainer.html('<i class="fas fa-check-circle"></i> Ready to continue');
    } else {
      validationContainer.html(`<i class="fas fa-exclamation-triangle"></i> ${validation.message}`);
    }
  }

  /**
   * Finish wizard and apply to actor
   */
  async _onFinish(event) {
    event.preventDefault();
    
    // Check permissions
    if (!this.actor.isOwner) {
      ui.notifications.error("You don't have permission to edit this character.");
      return;
    }
    
    // Final validation
    const validation = this.validator.validateAll(this.wizardData);
    console.log('🏁 FINISH - Final validation:', validation);
    if (!validation.valid) {
      ui.notifications.error(`Character creation incomplete: ${validation.message}`);
      console.error('🏁 FINISH - Validation failed:', validation);
      return;
    }
    
    // Confirm
    const confirm = await Dialog.confirm({
      title: "Finish Character Creation",
      content: "<p>Are you sure you want to finalize this character? This will apply all changes and mark the character as created.</p>",
      yes: () => true,
      no: () => false
    });
    
    if (!confirm) return;
    
    try {
      // Apply to actor
      await this._applyToActor();
      
      // Mark as created
      await this.actor.update({ "system.isCreated": true });
      
      // Clear wizard progress
      await this.actor.unsetFlag('wodsystem', 'wizardProgress');
      
      // Force re-render the actor sheet to show all changes
      this.actor.sheet?.render(true);
      
      ui.notifications.info("Character creation complete!");
      this.close();
    } catch (error) {
      console.error('WodCharacterWizard | Error finalizing character:', error);
      ui.notifications.error("Failed to finalize character. You may not have permission to edit this character.");
    }
  }

  /**
   * Cancel wizard
   */
  async _onCancel(event) {
    event.preventDefault();
    
    const confirm = await Dialog.confirm({
      title: "Cancel Character Creation",
      content: "<p>Are you sure you want to cancel? Your progress will be saved and you can continue later.</p>",
      yes: () => true,
      no: () => false
    });
    
    if (confirm) {
      await this._saveProgress();
      this.close();
    }
  }

  /**
   * Apply wizard data to actor
   */
  async _applyToActor() {
    console.log('🎯 APPLY TO ACTOR - Starting...');
    
    const updateData = {};
    
    // Step 1: Concept
    updateData["system.identity.name"] = this.wizardData.concept.name;
    updateData["system.identity.concept"] = this.wizardData.concept.concept;
    updateData["system.identity.nature"] = this.wizardData.concept.nature;
    updateData["system.identity.demeanor"] = this.wizardData.concept.demeanor;
    
    if (this.actorType === "Technocrat") {
      updateData["system.identity.convention"] = this.wizardData.concept.convention;
      updateData["system.identity.amalgam"] = this.wizardData.concept.amalgam;
    }
    
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
    if (this.actorType === "Technocrat") {
      // Enlightenment (Arete)
      const enlightenment = this.wizardData.advantages.enlightenment || this.config.advantages.enlightenment.starting;
      updateData["system.advantages.enlightenment.current"] = enlightenment;
      
      // Spheres
      for (const [sphere, value] of Object.entries(this.wizardData.advantages.spheres)) {
        if (value > 0) {
          updateData[`system.spheres.${sphere}.rating`] = value;
        }
      }
    }
    
    // Backgrounds - filter out backgrounds with no name or value
    console.log('🎯 BACKGROUNDS CHECK - Raw array:', JSON.stringify(this.wizardData.advantages.backgrounds));
    
    const validBackgrounds = this.wizardData.advantages.backgrounds.filter(bg => {
      const isValid = bg.name && bg.name.trim() !== "" && bg.value > 0;
      if (!isValid) {
        console.log('🎯 BACKGROUNDS - Filtering out invalid:', bg);
      }
      return isValid;
    });
    
    console.log('🎯 BACKGROUNDS CHECK - Valid backgrounds:', JSON.stringify(validBackgrounds));
    
    // Always set backgrounds (even if empty array) to ensure initialization
    updateData["system.miscellaneous.backgrounds"] = validBackgrounds;
    console.log('🎯 BACKGROUNDS - Setting', validBackgrounds.length, 'backgrounds to system.miscellaneous.backgrounds');
    
    // Willpower (base + freebies)
    const baseWillpower = this.config.advantages.willpower.starting;
    const freebieWillpower = this.wizardData.freebies.spent.willpower || 0;
    const totalWillpower = baseWillpower + freebieWillpower;
    updateData["system.miscellaneous.willpower.permanent"] = totalWillpower;
    updateData["system.miscellaneous.willpower.temporary"] = totalWillpower;
    
    console.log('🎯 WILLPOWER - Base:', baseWillpower, 'Freebies:', freebieWillpower, 'Total:', totalWillpower);
    
    // Apply update
    await this.actor.update(updateData);
    
    console.log('🎯 APPLY TO ACTOR - Update complete. Backgrounds applied:', updateData["system.miscellaneous.backgrounds"]);
  }

  /**
   * Update on form submit
   */
  async _updateObject(event, formData) {
    // Handle form data if needed
    await this._saveProgress();
  }
}

