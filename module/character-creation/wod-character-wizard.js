/**
 * Character Creation Wizard for World of Darkness
 * Multi-step wizard for creating characters following WoD creation rules
 */

import { getWizardConfig } from './wizard-config.js';
import { WizardValidator } from './utils/validation.js';
import { i18n } from '../../module/helpers/i18n.js';

export class WodCharacterWizard extends FormApplication {
  constructor(actor, options = {}) {
    // Set title in options if not provided, using i18n if available
    if (!options.title && game?.i18n) {
      options.title = game.i18n.localize("WODSYSTEM.Wizard.CharacterCreationWizard");
    }
    
    super(actor, options);
    
    this.actor = actor;
    this.actorType = actor.type;
    this.config = getWizardConfig(this.actorType);
    
    if (!this.config) {
      throw new Error(`No wizard configuration found for actor type: ${this.actorType}`);
    }
    
    // Check permissions
    if (!this.actor.isOwner) {
      const message = game?.i18n?.localize("WODSYSTEM.Wizard.NoPermissionEditCharacter") || "You don't have permission to edit this character. Wizard will be read-only.";
      ui.notifications.warn(message);
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
      title: "Character Creation Wizard" // Static title, will be overridden in constructor if i18n is available
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

      // Step 5: Merits & Flaws
      meritsFlaws: {
        merits: [],
        flaws: [],
        meritPoints: 0,
        flawPoints: 0,
        freebieBonus: 0  // Flaws without merits convert to freebie points
      },

      // Step 6: Freebies
      freebies: {
        spent: {},
        remaining: this.config.freebies.total,
        baselines: null // Will be set when first entering freebies step
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

    // console.log('🎯 INITIALIZED ABILITY VALUES:', abilityValues);
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
      // console.log('🎯 INITIALIZED SPHERE VALUES:', spheres);
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
      ui.notifications.warn(i18n('WODSYSTEM.Wizard.UnableToSaveProgress'));
    }
  }

  /**
   * Get data for template rendering
   */
  async getData() {
    const data = super.getData();
    
    const step = this.config.steps[this.currentStep];
    
    // Adjust freebies.remaining if entering for the first time after Enlightenment spending or if merits/flaws changed
    if (step.id === 'freebies') {
      const enlightenmentSpent = this.wizardData.advantages.freebiesSpent || 0;
      const freebieBonus = this.wizardData.meritsFlaws.freebieBonus || 0;
      const baseFreebiesTotalWithBonus = this.config.freebies.total + freebieBonus;
      
      // Check if any freebies have been spent in the freebies step itself
      const freebiesSpentInStep = Object.values(this.wizardData.freebies.spent || {}).reduce((sum, val) => sum + (val || 0), 0);
      
      // Recalculate if no freebies have been spent in this step yet (allows for changes to merits/flaws)
      if (freebiesSpentInStep === 0) {
        // console.log(`💰 getData - Calculating freebies: ${this.config.freebies.total} + ${freebieBonus} (flaws) - ${enlightenmentSpent} (enlightenment) = ${baseFreebiesTotalWithBonus - enlightenmentSpent}`);
        this.wizardData.freebies.remaining = baseFreebiesTotalWithBonus - enlightenmentSpent;
        
        // Capture baseline values when first entering freebies step
        // These represent what was set in previous steps and cannot be reduced below
        if (!this.wizardData.freebies.baselines) {
          this.wizardData.freebies.baselines = {
            attributes: JSON.parse(JSON.stringify(this.wizardData.attributes.values)),
            abilities: JSON.parse(JSON.stringify(this.wizardData.abilities.values)),
            backgrounds: this.wizardData.advantages.backgrounds.map(bg => ({
              name: bg.name,
              value: bg.value || 0
            })),
            spheres: JSON.parse(JSON.stringify(this.wizardData.advantages.spheres)),
            willpower: 0 // Willpower starts at 0 in freebies
          };
          // console.log('💰 Captured baselines:', this.wizardData.freebies.baselines);
        }
      } else {
        // console.log(`💰 getData - Freebies step, already spent ${freebiesSpentInStep} in this step, remaining: ${this.wizardData.freebies.remaining}`);
      }
    }
    
    const validation = this._validateCurrentStep();
    
    // Load backgrounds from ReferenceDataService
    let backgroundsList = [];
    const service = game.wod?.referenceDataService;
    if ((step.id === 'advantages' || step.id === 'freebies') && service && service.initialized) {
      backgroundsList = service.getBackgroundsList(this.actorType);
    } else if ((step.id === 'advantages' || step.id === 'freebies') && window.referenceDataService) {
      // Fallback to old service if new one not available
      backgroundsList = await window.referenceDataService.getBackgrounds(this.actorType);
    }
    
    
    // Calculate actual freebie total including bonus from merits/flaws
    const freebieBonus = this.wizardData.meritsFlaws?.freebieBonus || 0;
    const actualFreebieTotal = this.config.freebies.total + freebieBonus;
    
    // Translate config labels for display
    const translatedConfig = this._translateConfig(this.config);
    
    return {
      actor: this.actor,
      actorType: this.actorType,
      config: translatedConfig,
      currentStep: this.currentStep,
      totalSteps: this.config.steps.length,
      step: this._translateStep(step),
      stepId: step.id,
      wizardData: this.wizardData,
      validation: validation,
      backgroundsList: backgroundsList, // List from ReferenceDataService
      isFirstStep: this.currentStep === 0,
      isLastStep: this.currentStep === this.config.steps.length - 1,
      progressPercent: Math.round((this.currentStep / (this.config.steps.length - 1)) * 100),
      actualFreebieTotal: actualFreebieTotal, // Base + bonus from flaws
      freebieBonus: freebieBonus
    };
  }

  /**
   * Translate step object (labelKey -> label)
   */
  _translateStep(step) {
    if (!step) return step;
    const translated = { ...step };
    if (step.labelKey) {
      // Add WODSYSTEM prefix if not present
      const fullKey = step.labelKey.startsWith('WODSYSTEM.') ? step.labelKey : `WODSYSTEM.${step.labelKey}`;
      translated.label = game?.i18n?.localize(fullKey) || step.labelKey;
    }
    return translated;
  }

  /**
   * Translate config object recursively (labelKey -> label, placeholderKey -> placeholder)
   * IMPORTANT: This creates a shallow copy and only translates labels, preserving all other properties
   */
  _translateConfig(config) {
    if (!config) return config;
    
    // Create a shallow copy to avoid modifying the original
    // We only need to copy the properties we're modifying (label, steps, concept)
    const translated = { ...config };
    
    // Translate main label
    if (config.labelKey) {
      const fullKey = config.labelKey.startsWith('WODSYSTEM.') ? config.labelKey : `WODSYSTEM.${config.labelKey}`;
      translated.label = game?.i18n?.localize(fullKey) || config.labelKey;
    }
    
    // Translate steps (preserve all step properties)
    if (config.steps && Array.isArray(config.steps)) {
      translated.steps = config.steps.map(step => {
        const translatedStep = { ...step };
        if (step.labelKey) {
          const fullKey = step.labelKey.startsWith('WODSYSTEM.') ? step.labelKey : `WODSYSTEM.${step.labelKey}`;
          translatedStep.label = game?.i18n?.localize(fullKey) || step.labelKey;
        }
        return translatedStep;
      });
    }
    
    // Translate concept fields (preserve all field properties)
    if (config.concept && config.concept.fields && Array.isArray(config.concept.fields)) {
      translated.concept = {
        ...config.concept,
        fields: config.concept.fields.map(field => {
          const translatedField = { ...field };
          if (field.labelKey) {
            const fullKey = field.labelKey.startsWith('WODSYSTEM.') ? field.labelKey : `WODSYSTEM.${field.labelKey}`;
            translatedField.label = game?.i18n?.localize(fullKey) || field.labelKey;
          }
          if (field.placeholderKey) {
            const fullKey = field.placeholderKey.startsWith('WODSYSTEM.') ? field.placeholderKey : `WODSYSTEM.${field.placeholderKey}`;
            translatedField.placeholder = game?.i18n?.localize(fullKey) || field.placeholderKey;
          }
          return translatedField;
        })
      };
    }
    
    // All other properties (attributes, abilities, advantages, freebies, etc.) are preserved as-is
    return translated;
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
      case 'merits-flaws':
        this._activateMeritsFlawsListeners(html);
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
      // console.log('📜 SCROLL DEBUG - AT EVENT TIME:', scrollPosAtEvent);
      
      const category = event.currentTarget.dataset.category;  // e.g., "physical"
      const newPriority = event.currentTarget.value;          // e.g., "primary"
      
      // console.log('🔄 Priority change EVENT:', {category, newPriority});
      // console.log('🔄 Event target:', event.currentTarget);
      // console.log('🔄 Dataset:', event.currentTarget.dataset);
      // console.log('🔄 Value:', event.currentTarget.value);
      // console.log('🔄 Before:', JSON.parse(JSON.stringify(this.wizardData.attributes.prioritySelection)));
      
      if (!newPriority) {
        // console.log('🔄 Clearing category from all priorities (newPriority is empty)');
        // Clear this category from all priorities if deselecting
        for (const priority of ['primary', 'secondary', 'tertiary']) {
          if (this.wizardData.attributes.prioritySelection[priority] === category) {
            // console.log(`🔄 Clearing ${priority} (was ${category})`);
            this.wizardData.attributes.prioritySelection[priority] = null;
          }
        }
      } else {
        // console.log('🔄 Assigning new priority...');
        // Step 1: Clear this category from any priority it currently has
        for (const priority of ['primary', 'secondary', 'tertiary']) {
          if (this.wizardData.attributes.prioritySelection[priority] === category) {
            // console.log(`🔄 Step 1: Clearing ${priority} because it was assigned to ${category}`);
            this.wizardData.attributes.prioritySelection[priority] = null;
          }
        }
        
        // Step 2: Clear the new priority from any category that has it
        const oldCategory = this.wizardData.attributes.prioritySelection[newPriority];
        if (oldCategory) {
          // console.log(`🔄 Step 2: Clearing ${newPriority} (was ${oldCategory})`);
          this.wizardData.attributes.prioritySelection[newPriority] = null;
        }
        
        // Step 3: Assign the new priority to this category
        // console.log(`🔄 Step 3: Assigning ${newPriority} = ${category}`);
        this.wizardData.attributes.prioritySelection[newPriority] = category;
      }
      
      // console.log('🔄 After:', JSON.parse(JSON.stringify(this.wizardData.attributes.prioritySelection)));
      
      // Save progress
      await this._saveProgress();
      
      // Check if we need to do a full render (when structure changes)
      const selected = Object.values(this.wizardData.attributes.prioritySelection).filter(v => v !== null);
      const needsRender = selected.length === 3 && !this.element.find('.attribute-list:visible').length;
      
      if (needsRender) {
        // First time all 3 priorities are set - need full render to create controls
        // console.log('🔄 Structure changed, doing full render');
        
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
        // console.log('🔄 Just updating dropdowns, no render');
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
      // console.log('🔄 Initial dropdown restoration for attributes');
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
        
        // console.log(`📋 Initial restore: ${category} -> ${selectedPriority}`);
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
      // console.log('📜 ABILITIES SCROLL - AT EVENT TIME:', scrollPosAtEvent);
      
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
      
      // console.log('🔄 ABILITIES - Selected priorities:', selected.length);
      // console.log('🔄 ABILITIES - Trackers found:', this.element.find('.ability-category .points-tracker').length);
      // console.log('🔄 ABILITIES - Needs render:', needsRender);
      
      if (needsRender) {
        // First time all 3 priorities are set - need full render to create controls
        // console.log('🔄 ABILITIES - Structure changed, doing full render');
        
        // Store scroll and focus
        const scrollElement = this.element.find('.window-content')[0];
        const scrollPos = scrollElement ? scrollElement.scrollTop : 0;
        // console.log('📜 ABILITIES - Saving scroll position:', scrollPos);
        const activeElement = document.activeElement;
        if (activeElement) activeElement.blur();
        
        await this.render();
        
        // Restore scroll aggressively with multiple attempts
        const newScrollElement = this.element.find('.window-content')[0];
        if (newScrollElement) {
          const forceScroll = () => {
            newScrollElement.scrollTop = scrollPos;
            // console.log('📜 ABILITIES - Forced scroll to:', scrollPos, 'actual:', newScrollElement.scrollTop);
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
        // console.log('🔄 ABILITIES - Just updating dropdowns, no render');
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
      // console.log('🔘 SECONDARY ABILITY CLICK - Increase button clicked');
      const $item = $(event.currentTarget).closest('.ability-item.secondary');
      const index = parseInt($item.data('index'));
      const $section = $item.closest('.secondary-abilities');
      const category = $section.data('category');
      // console.log(`🔘 SECONDARY ABILITY CLICK - category: ${category}, index: ${index}`);
      await this._modifySecondaryAbility(category, index, 1);
    });

    html.on('click', '.ability-item.secondary .ability-decrease', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      // console.log('🔘 SECONDARY ABILITY CLICK - Decrease button clicked');
      const $item = $(event.currentTarget).closest('.ability-item.secondary');
      const index = parseInt($item.data('index'));
      const $section = $item.closest('.secondary-abilities');
      const category = $section.data('category');
      // console.log(`🔘 SECONDARY ABILITY CLICK - category: ${category}, index: ${index}`);
      await this._modifySecondaryAbility(category, index, -1);
    });

    // Add secondary ability
    html.find('.add-secondary').click(async (event) => {
      const category = event.currentTarget.dataset.category;
      await this._addSecondaryAbility(category);
    });
    
    // Restore dropdown values on initial load
    setTimeout(() => {
      // console.log('🔄 Initial dropdown restoration for abilities');
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
        
        // console.log(`📋 Initial restore: ${category} -> ${selectedPriority}`);
        $(select).val(selectedPriority);
      });
    }, 0);
    
    // Debug: Check how many secondary ability buttons exist
    // console.log(`🔘 SECONDARY ABILITY LISTENERS - Found ${html.find('.ability-item.secondary .ability-increase').length} increase buttons`);
    // console.log(`🔘 SECONDARY ABILITY LISTENERS - Found ${html.find('.ability-item.secondary .ability-decrease').length} decrease buttons`);
  }

  /**
   * Step: Advantages listeners
   */
  _activateAdvantagesListeners(html) {
    const service = game.wod.referenceDataService;
    
    // Add background
    html.find('.add-background').click(async () => {
      await this._addBackground();
    });

    // Remove background
    html.find('.remove-background').click(async (event) => {
      event.preventDefault();
      document.activeElement?.blur();
      
      const index = parseInt(event.currentTarget.dataset.index);
      this.wizardData.advantages.backgrounds.splice(index, 1);
      await this._saveProgress();
      
      // Remove DOM element
      $(event.currentTarget).closest('.background-item').remove();
      
      // Reindex remaining items
      html.find('.background-item').each((i, item) => {
        const $item = $(item);
        $item.find('.background-select').attr('data-index', i);
        $item.find('.bg-increase').attr('data-index', i);
        $item.find('.bg-decrease').attr('data-index', i);
        $item.find('.remove-background').attr('data-index', i);
      });
      
      // Update validation and buttons
      const validation = this._validateCurrentStep();
      if (validation.backgrounds) {
        const tracker = html.find('.advantage-section:has(h4:contains("Backgrounds")) .points-tracker');
        tracker.find('.spent').text(validation.backgrounds.spent);
        tracker.find('.remaining').text(validation.backgrounds.remaining);
      }
      this._updateNavigationButtons(html);
    });

    // Background selection
    html.find('.background-select').on('change', async (event) => {
      event.preventDefault();
      document.activeElement?.blur();
      
      const index = parseInt(event.currentTarget.dataset.index);
      const value = event.currentTarget.value;
      
      if (this.wizardData.advantages.backgrounds[index]) {
        this.wizardData.advantages.backgrounds[index].name = value;
        await this._saveProgress();
        
        // Update reference button visibility
        const $item = $(event.currentTarget).closest('.background-item');
        const $refBtn = $item.find('.background-reference-btn');
        
        if (value && service && service.initialized) {
          const background = service.getBackgroundByName(value);
          if (background) {
            $refBtn.show().data('background', background);
            $item.attr('data-background-name', value);
          } else {
            $refBtn.hide().removeData('background');
          }
        } else {
          $refBtn.hide().removeData('background');
        }
      }
    });

    // Background reference buttons
    html.find('.step-advantages .background-reference-btn').click((event) => {
      event.preventDefault();
      event.stopPropagation();
      
      const $button = $(event.currentTarget);
      const backgroundName = $button.attr('data-background-name');
      
      // console.log('Background reference button clicked in advantages step:', backgroundName);
      
      if (backgroundName && service && service.initialized) {
        const background = service.getBackgroundByName(backgroundName);
        // console.log('Found background data:', background);
        if (background) {
          // Toggle tooltip on click
          const existingTooltip = $('.wod-reference-tooltip');
          if (existingTooltip.length) {
            this._hideReferenceTooltip();
          } else {
            this._showBackgroundTooltip(event, background);
          }
        }
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
   * Step: Merits & Flaws listeners
   */
  _activateMeritsFlawsListeners(html) {
    const service = game.wod?.referenceDataService;
    
    // Hide tooltip when clicking anywhere else in the wizard
    html.find('.step-merits-flaws').on('click', (event) => {
      // Don't hide if clicking on a reference button or the tooltip itself
      if (!$(event.target).closest('.wizard-merit-reference-btn, .wizard-flaw-reference-btn, .wod-reference-tooltip').length) {
        this._hideReferenceTooltip();
      }
    });
    
    // Add Merit
    html.find('.add-item[data-type="merit"]').click(async () => {
      this.wizardData.meritsFlaws.merits.push({ name: "", value: 0 });
      await this._saveProgress();
      
      // Re-render only the merits section instead of full wizard
      const service = game.wod?.referenceDataService;
      const meritsContainer = html.find('.merit-list');
      const newIndex = this.wizardData.meritsFlaws.merits.length - 1;
      const newItem = $(`
        <div class="merit-flaw-item">
          <div class="name-input-container">
            <input type="text" class="wizard-merit-name" data-index="${newIndex}" value="" placeholder="${i18n('WODSYSTEM.Wizard.MeritName')}" />
            <a class="wizard-merit-reference-btn" data-index="${newIndex}" title="${i18n('WODSYSTEM.Wizard.ViewMeritDetails')}">
              <i class="fas fa-book-open"></i>
            </a>
          </div>
          <div class="value-controls">
            <button type="button" class="value-decrease" data-type="merit" data-index="${newIndex}" disabled>
              <i class="fas fa-minus"></i>
            </button>
            <span class="value-display">0</span>
            <button type="button" class="value-increase" data-type="merit" data-index="${newIndex}">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="dots-display">
            ${Handlebars.helpers.renderDots(0, 7).toString()}
          </div>
          <button type="button" class="remove-item" data-type="merit" data-index="${newIndex}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `);
      
      meritsContainer.find('.add-item').before(newItem);
      this._attachMeritFlawItemListeners(newItem, 'merit', newIndex, service);
    });
    
    // Add Flaw
    html.find('.add-item[data-type="flaw"]').click(async () => {
      this.wizardData.meritsFlaws.flaws.push({ name: "", value: 0 });
      await this._saveProgress();
      
      // Re-render only the flaws section instead of full wizard
      const service = game.wod?.referenceDataService;
      const flawsContainer = html.find('.flaw-list');
      const newIndex = this.wizardData.meritsFlaws.flaws.length - 1;
      const newItem = $(`
        <div class="merit-flaw-item">
          <div class="name-input-container">
            <input type="text" class="wizard-flaw-name" data-index="${newIndex}" value="" placeholder="${i18n('WODSYSTEM.Wizard.FlawName')}" />
            <a class="wizard-flaw-reference-btn" data-index="${newIndex}" title="${i18n('WODSYSTEM.Wizard.ViewFlawDetails')}">
              <i class="fas fa-book-open"></i>
            </a>
          </div>
          <div class="value-controls">
            <button type="button" class="value-decrease" data-type="flaw" data-index="${newIndex}" disabled>
              <i class="fas fa-minus"></i>
            </button>
            <span class="value-display">0</span>
            <button type="button" class="value-increase" data-type="flaw" data-index="${newIndex}">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="dots-display">
            ${Handlebars.helpers.renderDots(0, 7).toString()}
          </div>
          <button type="button" class="remove-item" data-type="flaw" data-index="${newIndex}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `);
      
      flawsContainer.find('.add-item').before(newItem);
      this._attachMeritFlawItemListeners(newItem, 'flaw', newIndex, service);
    });
    
    // Remove Merit
    html.find('.remove-item[data-type="merit"]').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      this.wizardData.meritsFlaws.merits.splice(index, 1);
      this._recalculateMeritsFlaws();
      await this._saveProgress();
      
      // Remove the DOM element and reindex remaining items
      $(event.currentTarget).closest('.merit-flaw-item').remove();
      html.find('.merit-flaw-item').each((i, item) => {
        const $item = $(item);
        if ($item.find('.wizard-merit-name').length) {
          $item.find('.wizard-merit-name').attr('data-index', i);
          $item.find('.wizard-merit-reference-btn').attr('data-index', i);
          $item.find('.value-decrease[data-type="merit"]').attr('data-index', i);
          $item.find('.value-increase[data-type="merit"]').attr('data-index', i);
          $item.find('.remove-item[data-type="merit"]').attr('data-index', i);
        }
      });
      
      this._updateMeritsFlawsUI(html);
    });
    
    // Remove Flaw
    html.find('.remove-item[data-type="flaw"]').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      this.wizardData.meritsFlaws.flaws.splice(index, 1);
      this._recalculateMeritsFlaws();
      await this._saveProgress();
      
      // Remove the DOM element and reindex remaining items
      $(event.currentTarget).closest('.merit-flaw-item').remove();
      html.find('.merit-flaw-item').each((i, item) => {
        const $item = $(item);
        if ($item.find('.wizard-flaw-name').length) {
          $item.find('.wizard-flaw-name').attr('data-index', i);
          $item.find('.wizard-flaw-reference-btn').attr('data-index', i);
          $item.find('.value-decrease[data-type="flaw"]').attr('data-index', i);
          $item.find('.value-increase[data-type="flaw"]').attr('data-index', i);
          $item.find('.remove-item[data-type="flaw"]').attr('data-index', i);
        }
      });
      
      this._updateMeritsFlawsUI(html);
    });
    
    // Increase/Decrease Merit value
    html.find('.value-increase[data-type="merit"], .value-decrease[data-type="merit"]').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      const isIncrease = event.currentTarget.classList.contains('value-increase');
      
      if (this.wizardData.meritsFlaws.merits[index]) {
        const current = this.wizardData.meritsFlaws.merits[index].value || 0;
        const newValue = Math.max(0, Math.min(7, current + (isIncrease ? 1 : -1)));
        
        if (isIncrease) {
          const totalMerits = this.wizardData.meritsFlaws.merits.reduce((sum, m) => sum + (m.value || 0), 0);
          if (totalMerits >= 7) {
            ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotExceed7MeritPoints'));
            return;
          }
        }
        
        this.wizardData.meritsFlaws.merits[index].value = newValue;
        this._recalculateMeritsFlaws();
        await this._saveProgress();
        this._updateMeritsFlawsUI(html);
      }
    });
    
    // Increase/Decrease Flaw value
    html.find('.value-increase[data-type="flaw"], .value-decrease[data-type="flaw"]').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      const isIncrease = event.currentTarget.classList.contains('value-increase');
      
      if (this.wizardData.meritsFlaws.flaws[index]) {
        const current = this.wizardData.meritsFlaws.flaws[index].value || 0;
        const newValue = Math.max(0, Math.min(7, current + (isIncrease ? 1 : -1)));
        
        if (isIncrease) {
          const totalFlaws = this.wizardData.meritsFlaws.flaws.reduce((sum, f) => sum + (f.value || 0), 0);
          if (totalFlaws >= 7) {
            ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotExceed7FlawPoints'));
            return;
          }
        }
        
        this.wizardData.meritsFlaws.flaws[index].value = newValue;
        this._recalculateMeritsFlaws();
        await this._saveProgress();
        this._updateMeritsFlawsUI(html);
      }
    });
    
    // Hide tooltip when clicking on input fields
    html.find('.wizard-merit-name, .wizard-flaw-name').on('click', () => {
      this._hideReferenceTooltip();
    });
    
    // Merit/Flaw name inputs
    html.find('.wizard-merit-name, .wizard-flaw-name').on('input', (event) => {
      const input = event.currentTarget;
      const index = parseInt(input.dataset.index);
      const query = input.value.trim();
      const isMerit = input.classList.contains('wizard-merit-name');
      const category = isMerit ? 'Merit' : 'Flaw';
      
      if (isMerit && this.wizardData.meritsFlaws.merits[index]) {
        this.wizardData.meritsFlaws.merits[index].name = input.value;
      } else if (!isMerit && this.wizardData.meritsFlaws.flaws[index]) {
        this.wizardData.meritsFlaws.flaws[index].name = input.value;
      }
      
      const $button = $(input).siblings(isMerit ? '.wizard-merit-reference-btn' : '.wizard-flaw-reference-btn');
      if (service && service.initialized && query) {
        const reference = service.getByName(query, category);
        if (reference) {
          $button.addClass('has-reference');
          $button.data('reference', reference);
        } else {
          $button.removeClass('has-reference');
          $button.removeData('reference');
        }
      }
      
      if (query.length >= 2 && service && service.initialized) {
        const results = service.search(query, { category, actorType: this.actorType }).slice(0, 10);
        if (results.length > 0) {
          this._showWizardAutocomplete(input, results, category, index);
        } else {
          this._hideWizardAutocomplete();
        }
      } else {
        this._hideWizardAutocomplete();
      }
    });
    
    html.find('.wizard-merit-name, .wizard-flaw-name').on('blur', async () => {
      await this._saveProgress();
      setTimeout(() => {
        this._hideWizardAutocomplete();
        this._hideReferenceTooltip();
      }, 200);
    });
    
    // Update reference button visibility and data for existing items
    html.find('.wizard-merit-name, .wizard-flaw-name').each((idx, element) => {
      const $input = $(element);
      const isMerit = element.classList.contains('wizard-merit-name');
      const category = isMerit ? 'Merit' : 'Flaw';
      const name = $input.val()?.trim();
      
      const $button = $input.siblings(isMerit ? '.wizard-merit-reference-btn' : '.wizard-flaw-reference-btn');
      
      if (name && service && service.initialized) {
        const reference = service.getByName(name, category);
        if (reference) {
          $button.addClass('has-reference');
          $button.data('reference', reference);
        } else {
          $button.removeClass('has-reference');
          $button.removeData('reference');
        }
      }
    });
    
    // Reference button click - show tooltip on click (not hover)
    html.find('.wizard-merit-reference-btn, .wizard-flaw-reference-btn').click((event) => {
      event.preventDefault();
      event.stopPropagation();
      
      const $button = $(event.currentTarget);
      const reference = $button.data('reference');
      
      if (reference) {
        // Toggle tooltip on click
        const existingTooltip = $('.wod-reference-tooltip');
        if (existingTooltip.length) {
          this._hideReferenceTooltip();
        } else {
          this._showReferenceTooltip(event, reference);
        }
      }
    });
  }
  
  _attachMeritFlawItemListeners($item, type, index, service) {
    const html = this.element;
    const isMerit = type === 'merit';
    const category = isMerit ? 'Merit' : 'Flaw';
    
    // Value controls
    $item.find(`.value-increase[data-type="${type}"]`).click(async () => {
      const current = isMerit ? this.wizardData.meritsFlaws.merits[index].value : this.wizardData.meritsFlaws.flaws[index].value;
      const newValue = Math.min(7, (current || 0) + 1);
      
      const totalPoints = (isMerit ? this.wizardData.meritsFlaws.merits : this.wizardData.meritsFlaws.flaws).reduce((sum, item) => sum + (item.value || 0), 0);
      if (totalPoints >= 7) {
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotExceed7Points', {type: type}));
        return;
      }
      
      if (isMerit) {
        this.wizardData.meritsFlaws.merits[index].value = newValue;
      } else {
        this.wizardData.meritsFlaws.flaws[index].value = newValue;
      }
      
      this._recalculateMeritsFlaws();
      await this._saveProgress();
      
      $item.find('.value-display').text(newValue);
      $item.find('.dots-display').html(Handlebars.helpers.renderDots(newValue, 7).toString());
      $item.find('.value-decrease').prop('disabled', newValue === 0);
      $item.find('.value-increase').prop('disabled', newValue === 7);
      
      this._updateMeritsFlawsUI(html);
    });
    
    $item.find(`.value-decrease[data-type="${type}"]`).click(async () => {
      const current = isMerit ? this.wizardData.meritsFlaws.merits[index].value : this.wizardData.meritsFlaws.flaws[index].value;
      const newValue = Math.max(0, (current || 0) - 1);
      
      if (isMerit) {
        this.wizardData.meritsFlaws.merits[index].value = newValue;
      } else {
        this.wizardData.meritsFlaws.flaws[index].value = newValue;
      }
      
      this._recalculateMeritsFlaws();
      await this._saveProgress();
      
      $item.find('.value-display').text(newValue);
      $item.find('.dots-display').html(Handlebars.helpers.renderDots(newValue, 7).toString());
      $item.find('.value-decrease').prop('disabled', newValue === 0);
      $item.find('.value-increase').prop('disabled', newValue === 7);
      
      this._updateMeritsFlawsUI(html);
    });
    
    // Remove button
    $item.find(`.remove-item[data-type="${type}"]`).click(async () => {
      if (isMerit) {
        this.wizardData.meritsFlaws.merits.splice(index, 1);
      } else {
        this.wizardData.meritsFlaws.flaws.splice(index, 1);
      }
      this._recalculateMeritsFlaws();
      await this._saveProgress();
      
      $item.remove();
      
      // Reindex remaining items
      html.find('.merit-flaw-item').each((i, item) => {
        const $otherItem = $(item);
        const nameClass = isMerit ? '.wizard-merit-name' : '.wizard-flaw-name';
        if ($otherItem.find(nameClass).length) {
          $otherItem.find(nameClass).attr('data-index', i);
          $otherItem.find(isMerit ? '.wizard-merit-reference-btn' : '.wizard-flaw-reference-btn').attr('data-index', i);
          $otherItem.find(`.value-decrease[data-type="${type}"]`).attr('data-index', i);
          $otherItem.find(`.value-increase[data-type="${type}"]`).attr('data-index', i);
          $otherItem.find(`.remove-item[data-type="${type}"]`).attr('data-index', i);
        }
      });
      
      this._updateMeritsFlawsUI(html);
    });
    
    // Name input
    const $input = $item.find(isMerit ? '.wizard-merit-name' : '.wizard-flaw-name');
    
    // Hide tooltip when clicking on input field
    $input.on('click', () => {
      this._hideReferenceTooltip();
    });
    
    $input.on('input', (event) => {
      const query = event.currentTarget.value.trim();
      
      if (isMerit) {
        this.wizardData.meritsFlaws.merits[index].name = event.currentTarget.value;
      } else {
        this.wizardData.meritsFlaws.flaws[index].name = event.currentTarget.value;
      }
      
      const $button = $input.siblings(isMerit ? '.wizard-merit-reference-btn' : '.wizard-flaw-reference-btn');
      if (service && service.initialized && query) {
        const reference = service.getByName(query, category);
        if (reference) {
          $button.addClass('has-reference');
          $button.data('reference', reference);
        } else {
          $button.removeClass('has-reference');
          $button.removeData('reference');
        }
      }
      
      if (query.length >= 2 && service && service.initialized) {
        const results = service.search(query, { category, actorType: this.actorType }).slice(0, 10);
        if (results.length > 0) {
          this._showWizardAutocomplete(event.currentTarget, results, category, index);
        } else {
          this._hideWizardAutocomplete();
        }
      } else {
        this._hideWizardAutocomplete();
      }
    });
    
    $input.on('blur', async () => {
      await this._saveProgress();
      setTimeout(() => {
        this._hideWizardAutocomplete();
        this._hideReferenceTooltip();
      }, 200);
    });
    
    // Reference button - show tooltip on click
    const $refButton = $item.find(isMerit ? '.wizard-merit-reference-btn' : '.wizard-flaw-reference-btn');
    $refButton.click((event) => {
      event.preventDefault();
      event.stopPropagation();
      
      const $button = $(event.currentTarget);
      const reference = $button.data('reference');
      
      if (reference) {
        // Toggle tooltip on click
        const existingTooltip = $('.wod-reference-tooltip');
        if (existingTooltip.length) {
          this._hideReferenceTooltip();
        } else {
          this._showReferenceTooltip(event, reference);
        }
      }
    });
  }
  
  _recalculateMeritsFlaws() {
    const meritPoints = this.wizardData.meritsFlaws.merits.reduce((sum, m) => sum + (m.value || 0), 0);
    const flawPoints = this.wizardData.meritsFlaws.flaws.reduce((sum, f) => sum + (f.value || 0), 0);
    
    this.wizardData.meritsFlaws.meritPoints = meritPoints;
    this.wizardData.meritsFlaws.flawPoints = flawPoints;
    this.wizardData.meritsFlaws.freebieBonus = meritPoints === 0 ? flawPoints : 0;
  }
  
  _updateMeritsFlawsUI(html) {
    html.find('.merits-total').text(this.wizardData.meritsFlaws.meritPoints);
    html.find('.flaws-total').text(this.wizardData.meritsFlaws.flawPoints);
    
    const balanced = this.wizardData.meritsFlaws.meritPoints === 0 || 
                     this.wizardData.meritsFlaws.meritPoints === this.wizardData.meritsFlaws.flawPoints;
    html.find('.balance-status').toggleClass('balanced', balanced).toggleClass('unbalanced', !balanced);
    
    // Update merit dots and values
    this.wizardData.meritsFlaws.merits.forEach((merit, index) => {
      const $item = html.find(`.merit-flaw-item`).filter((i, el) => {
        return $(el).find('.wizard-merit-name').data('index') === index;
      });
      if ($item.length) {
        const value = merit.value || 0;
        $item.find('.value-display').text(value);
        $item.find('.dots-display').html(Handlebars.helpers.renderDots(value, 7).toString());
        $item.find('.value-decrease').prop('disabled', value === 0);
        $item.find('.value-increase').prop('disabled', value === 7);
      }
    });
    
    // Update flaw dots and values
    this.wizardData.meritsFlaws.flaws.forEach((flaw, index) => {
      const $item = html.find(`.merit-flaw-item`).filter((i, el) => {
        return $(el).find('.wizard-flaw-name').data('index') === index;
      });
      if ($item.length) {
        const value = flaw.value || 0;
        $item.find('.value-display').text(value);
        $item.find('.dots-display').html(Handlebars.helpers.renderDots(value, 7).toString());
        $item.find('.value-decrease').prop('disabled', value === 0);
        $item.find('.value-increase').prop('disabled', value === 7);
      }
    });
    
    this._updateNavigationButtons(html);
  }
  
  _showWizardAutocomplete(input, results, category, index) {
    this._hideWizardAutocomplete();
    
    const $input = $(input);
    const inputPos = $input.offset();
    const $dropdown = $('<div class="wod-autocomplete-dropdown"></div>');
    $dropdown.css({
      position: 'fixed',
      top: inputPos.top + $input.outerHeight() + 2,
      left: inputPos.left,
      minWidth: Math.max($input.outerWidth(), 300) + 'px',  // Ensure minimum width
      maxHeight: '200px',
      zIndex: 100000
    });
    
    results.forEach((result) => {
      const $item = $(`<div class="autocomplete-item"><span class="autocomplete-name">${result.name}</span><span class="autocomplete-meta">${result.costDescription} pt</span></div>`);
      $item.on('mousedown', async (e) => {
        e.preventDefault();
        await this._selectWizardAutocomplete(input, result, category, index);
      });
      $dropdown.append($item);
    });
    
    $('body').append($dropdown);
    this._wizardAutocompleteDropdown = $dropdown;
  }
  
  _hideWizardAutocomplete() {
    if (this._wizardAutocompleteDropdown) {
      this._wizardAutocompleteDropdown.remove();
      this._wizardAutocompleteDropdown = null;
    }
  }
  
  async _selectWizardAutocomplete(input, result, category, index) {
    this._hideWizardAutocomplete();
    
    const costs = Array.isArray(result.cost) ? result.cost : [result.cost];
    let selectedValue = costs.length === 1 ? costs[0] : await this._showCostSelectionDialog(result.name, costs, category);
    if (!selectedValue) return;
    
    // Update data
    if (category === 'Merit' && this.wizardData.meritsFlaws.merits[index]) {
      this.wizardData.meritsFlaws.merits[index].name = result.name;
      this.wizardData.meritsFlaws.merits[index].value = selectedValue;
    } else if (category === 'Flaw' && this.wizardData.meritsFlaws.flaws[index]) {
      this.wizardData.meritsFlaws.flaws[index].name = result.name;
      this.wizardData.meritsFlaws.flaws[index].value = selectedValue;
    }
    
    this._recalculateMeritsFlaws();
    await this._saveProgress();
    
    // Update DOM without full render
    const $input = $(input);
    $input.val(result.name);
    
    // Find the item container
    const $item = $input.closest('.merit-flaw-item');
    
    // Update value display
    $item.find('.value-display').text(selectedValue);
    
    // Update dots
    const dotsHtml = Handlebars.helpers.renderDots(selectedValue, 7);
    $item.find('.dots-display').html(dotsHtml.toString());
    
    // Update buttons
    $item.find('.value-decrease').prop('disabled', selectedValue === 0);
    $item.find('.value-increase').prop('disabled', selectedValue === 7);
    
    // Update reference button
    const service = game.wod?.referenceDataService;
    if (service && service.initialized) {
      const reference = service.getByName(result.name, category);
      const $button = $input.siblings(category === 'Merit' ? '.wizard-merit-reference-btn' : '.wizard-flaw-reference-btn');
      if (reference) {
        $button.addClass('has-reference');
        $button.data('reference', reference);
      }
    }
    
    // Update UI totals
    this._updateMeritsFlawsUI(this.element);
    
    ui.notifications.info(i18n('WODSYSTEM.Notifications.SelectedWithPoints', {name: result.name, value: selectedValue}));
  }
  
  async _showCostSelectionDialog(name, costs, category) {
    return new Promise((resolve) => {
      const color = category === 'Merit' ? '#4CAF50' : '#f44336';
      let resolved = false;
      const safeResolve = (value) => { 
        if (!resolved) { 
          resolved = true; 
          resolve(value); 
        } 
      };
      
      // Shorter title to avoid horizontal scroll
      const shortTitle = i18n('WODSYSTEM.CostSelection.SelectCost');
      
      const content = `
        <div style="padding: 8px;">
          <p style="margin: 0 0 10px 0; font-size: 0.9em; line-height: 1.3;">
            <strong style="display: block; margin-bottom: 6px; font-size: 0.95em;">${name}</strong>
            <span style="font-size: 0.85em; color: #666;">Select point value:</span>
          </p>
          <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; margin: 0;">
            ${costs.map(cost => `<button type="button" class="cost-option-btn" data-cost="${cost}" style="padding: 4px 10px; font-size: 0.85em; font-weight: 600; background: ${color}; color: white; border: none; border-radius: 2px; cursor: pointer; min-width: 35px; transition: opacity 0.2s;">${cost} pt</button>`).join('')}
          </div>
        </div>`;
      
      const dialog = new Dialog({
        title: shortTitle,
        content: content,
        buttons: { 
          cancel: { 
            icon: '<i class="fas fa-times"></i>', 
            label: i18n('WODSYSTEM.Common.Cancel'), 
            callback: () => safeResolve(null) 
          } 
        },
        default: "cancel",
        render: (html) => {
          html.find('.cost-option-btn').click((e) => { 
            const cost = parseInt(e.currentTarget.dataset.cost);
            safeResolve(cost);
            dialog.close();  // Explicitly close the dialog
          });
          html.find('.cost-option-btn').hover(
            function() { $(this).css('opacity', '0.8'); }, 
            function() { $(this).css('opacity', '1'); }
          );
          
          // Remove the "Close " text from the close button
          setTimeout(() => {
            const closeButton = html.closest('.app').find('.header-button.close')[0];
            if (closeButton) {
              // Remove all text nodes, keep only the icon
              Array.from(closeButton.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                  node.remove();
                }
              });
            }
          }, 0);
        },
        close: () => safeResolve(null)
      }, { 
        width: 280,
        height: "auto",
        resizable: false,
        classes: ["dialog", "wod-cost-selection-dialog"]
      }).render(true);
    });
  }
  
  async _postReferenceToChat(reference) {
    const service = game.wod?.referenceDataService;
    if (!service) return;
    const html = await renderTemplate('systems/wodsystem/templates/chat/reference-card.html', { reference });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: html, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
  }

  /**
   * Show tooltip for merit/flaw reference
   * @param {Event} event - The hover event
   * @param {object} reference - The reference data
   * @private
   */
  _showReferenceTooltip(event, reference) {
    this._hideReferenceTooltip(); // Remove any existing tooltip
    
    const service = game.wod?.referenceDataService;
    if (!service) return;
    
    // Create tooltip element
    const tooltip = $('<div class="wod-reference-tooltip"></div>');
    tooltip.html(service.generateTooltipHTML(reference));
    
    // Store reference data on the tooltip for the chat button
    tooltip.data('reference', reference);
    
    // Add to body with visibility hidden to measure
    tooltip.css({ 
      visibility: 'hidden', 
      display: 'block',
      position: 'fixed',  // Use fixed positioning relative to viewport
      pointerEvents: 'auto'  // Enable click events
    });
    $('body').append(tooltip);
    
    // Add click handler for post-to-chat button
    tooltip.find('.post-to-chat-btn').on('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ref = tooltip.data('reference');
      if (ref) {
        await this._postReferenceToChat(ref);
        this._hideReferenceTooltip();
      }
    });
    
    // Prevent tooltip from closing when clicking inside it
    tooltip.on('click', (e) => {
      e.stopPropagation();
    });
    
    // Get dimensions
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = tooltip.outerWidth();
    const tooltipHeight = tooltip.outerHeight();
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    
    // Calculate left position (prevent overflow)
    let left = rect.left;
    if (left + tooltipWidth > windowWidth - 10) {
      left = windowWidth - tooltipWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }
    
    // Calculate top position - show above the element
    let top = rect.top - tooltipHeight - 10;
    
    // If it goes off the top of the screen, position below instead
    if (top < 10) {
      top = rect.bottom + 10;
      // If it goes off the bottom too, just clamp to top
      if (top + tooltipHeight > windowHeight - 10) {
        top = 10;
      }
    }
    
    // Apply final position and make visible
    tooltip.css({
      position: 'fixed',
      top: top + 'px',
      left: left + 'px',
      maxWidth: '400px',
      maxHeight: (windowHeight - 20) + 'px',  // Limit height to viewport
      overflowY: 'auto',  // Allow scrolling if content is too long
      visibility: 'visible',
      display: 'none',
      pointerEvents: 'auto'  // Enable click events
    });
    
    // Fade in
    tooltip.fadeIn(200);
    
    // Close tooltip when clicking outside (use setTimeout to prevent immediate closure)
    setTimeout(() => {
      $(document).one('click', () => {
        this._hideReferenceTooltip();
      });
    }, 100);
  }
  
  /**
   * Hide reference tooltip
   * @private
   */
  _hideReferenceTooltip() {
    $('.wod-reference-tooltip').fadeOut(100, function() {
      $(this).remove();
    });
  }

  /**
   * Show tooltip for background reference
   * @param {Event} event - The click event
   * @param {object} background - The background data
   * @private
   */
  _showBackgroundTooltip(event, background) {
    this._hideReferenceTooltip(); // Remove any existing tooltip
    
    const service = game.wod?.referenceDataService;
    if (!service) return;
    
    // Create tooltip element
    const tooltip = $('<div class="wod-reference-tooltip"></div>');
    tooltip.html(service.generateBackgroundTooltipHTML(background));
    
    // Add to body with visibility hidden to measure
    tooltip.css({ 
      visibility: 'hidden', 
      display: 'block',
      position: 'fixed'
    });
    $('body').append(tooltip);
    
    // Get dimensions
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = tooltip.outerWidth();
    const tooltipHeight = tooltip.outerHeight();
    const windowWidth = $(window).width();
    const windowHeight = $(window).height();
    
    // Calculate left position (prevent overflow)
    let left = rect.left;
    if (left + tooltipWidth > windowWidth - 10) {
      left = windowWidth - tooltipWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }
    
    // Calculate top position - show above the element
    let top = rect.top - tooltipHeight - 10;
    
    // If it goes off the top of the screen, position below instead
    if (top < 10) {
      top = rect.bottom + 10;
      // If it goes off the bottom too, just clamp to top
      if (top + tooltipHeight > windowHeight - 10) {
        top = 10;
      }
    }
    
    // Apply final position and make visible
    tooltip.css({
      position: 'fixed',
      top: top + 'px',
      left: left + 'px',
      maxWidth: '500px',
      maxHeight: '400px',
      overflowY: 'auto',
      visibility: 'visible',
      display: 'none',
      pointerEvents: 'auto'
    });
    
    // Fade in
    tooltip.fadeIn(200);
    
    // Add click handler to the chat button only
    tooltip.find('.post-to-chat-btn').click((e) => {
      e.stopPropagation();
      this._postBackgroundToChat(background);
      this._hideReferenceTooltip();
    });
    
    // Prevent tooltip from closing when clicking inside it
    tooltip.on('click', (e) => {
      e.stopPropagation();
    });
    
    // Close tooltip when clicking outside (use setTimeout to prevent immediate closure)
    setTimeout(() => {
      $(document).one('click', () => {
        this._hideReferenceTooltip();
      });
    }, 100);
  }

  /**
   * Post background reference to chat
   * @param {object} background - The background data
   * @private
   */
  async _postBackgroundToChat(background) {
    const html = await renderTemplate('systems/wodsystem/templates/chat/background-reference-card.html', { background });
    await ChatMessage.create({ 
      speaker: ChatMessage.getSpeaker({ actor: this.actor }), 
      content: html, 
      style: CONST.CHAT_MESSAGE_STYLES.OTHER 
    });
  }

  /**
   * Step: Freebies listeners
   */
  _activateFreebiesListeners(html) {
    const service = game.wod.referenceDataService;
    
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
    
    // Background reference buttons in freebies step
    html.find('.background-reference-btn').click((event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Read background name from button's data-background-name attribute
      const $button = $(event.currentTarget);
      const backgroundName = $button.attr('data-background-name');
      
      // console.log('Background reference button clicked in freebies step:', backgroundName);
      
      if (backgroundName && service && service.initialized) {
        const background = service.getBackgroundByName(backgroundName);
        // console.log('Found background data:', background);
        if (background) {
          // Toggle tooltip on click
          const existingTooltip = $('.wod-reference-tooltip');
          if (existingTooltip.length) {
            this._hideReferenceTooltip();
          } else {
            this._showBackgroundTooltip(event, background);
          }
        }
      }
    });
    
    // Initial update of decrease button states based on baselines
    this._updateFreebiesButtonStates(html);
  }
  
  /**
   * Update freebie button states (separate method for reuse)
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
      ui.notifications.warn(i18n('WODSYSTEM.Wizard.NoMorePointsAvailableAttributes', {category: category}));
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
    
    this.wizardData.abilities.secondary[category].push({
      name: name,
      value: 0
    });
    
    await this._saveProgress();
    
    // Create new secondary ability DOM element
    const newIndex = this.wizardData.abilities.secondary[category].length - 1;
    const maxValue = this.config.abilities.maxAtCreation;
    
    const newItem = $(`
      <div class="ability-item secondary" data-index="${newIndex}">
        <input type="text" 
               class="ability-name-input" 
               value="${name}" 
               placeholder="${i18n('WODSYSTEM.Wizard.AbilityName')}">
        <div class="ability-controls">
          <button type="button" class="ability-decrease" data-index="${newIndex}" disabled>
            <i class="fas fa-minus"></i>
          </button>
          <span class="ability-value">0</span>
          <button type="button" class="ability-increase" data-index="${newIndex}">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="ability-dots">
          ${Handlebars.helpers.renderDots(0, maxValue).toString()}
        </div>
      </div>
    `);
    
    // Add to DOM
    const html = this.element;
    const secondaryContainer = html.find(`.secondary-abilities[data-category="${category}"]`);
    secondaryContainer.find('.add-secondary').before(newItem);
    
    // Re-attach listeners for abilities step
    this._activateAbilitiesListeners(html);
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
      // console.log(`🔄 SECONDARY ABILITY UPDATE - ${category}[${index}]: ${current} -> ${newValue}`);
      
      // Update the value display
      targetItem.find('.ability-value').text(newValue);
      
      // Update the dots using the helper
      const dotsDiv = targetItem.find('.ability-dots');
      const dotsHtml = Handlebars.helpers.renderDots(newValue, max);
      // console.log(`🔄 SECONDARY ABILITY UPDATE - Dots HTML:`, dotsHtml.toString());
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
    this.wizardData.advantages.backgrounds.push({
      name: "",
      value: 0
    });
    
    await this._saveProgress();
    
    // Get backgrounds list
    const service = game.wod?.referenceDataService;
    const backgroundsList = service && service.initialized ? service.getBackgroundsList(this.actorType) : [];
    const newIndex = this.wizardData.advantages.backgrounds.length - 1;
    const maxValue = this.config.advantages.backgrounds.maxPerBackground;
    
    // Build dropdown options
    let optionsHTML = '<option value="">-- Select Background --</option>';
    backgroundsList.forEach(bg => {
      optionsHTML += `<option value="${bg}">${bg}</option>`;
    });
    
    // Create new background item
    const newItem = $(`
      <div class="background-item" data-background-name="">
        <select class="background-select" data-index="${newIndex}">
          ${optionsHTML}
        </select>
        <button type="button" class="background-reference-btn" data-background-name="" title="${i18n('WODSYSTEM.Wizard.ViewDetails')}" style="display: none;">
          <i class="fas fa-book"></i>
        </button>
        <div class="background-controls">
          <button type="button" class="bg-decrease" data-index="${newIndex}" disabled>
            <i class="fas fa-minus"></i>
          </button>
          <span class="bg-value">0</span>
          <button type="button" class="bg-increase" data-index="${newIndex}">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="background-dots">
          ${Handlebars.helpers.renderDots(0, maxValue).toString()}
        </div>
        <button type="button" class="remove-background" data-index="${newIndex}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `);
    
    // Add to DOM
    const html = this.element;
    const bgList = html.find('.backgrounds-list');
    bgList.append(newItem);
    
    // Attach listeners ONLY to the new item
    newItem.find('.background-select').on('change', async (event) => {
      event.preventDefault();
      document.activeElement?.blur();
      
      const index = parseInt(event.currentTarget.dataset.index);
      const value = event.currentTarget.value;
      
      if (this.wizardData.advantages.backgrounds[index]) {
        this.wizardData.advantages.backgrounds[index].name = value;
        await this._saveProgress();
        
        // Update reference button visibility
        const $refBtn = newItem.find('.background-reference-btn');
        
        if (value && service && service.initialized) {
          const background = service.getBackgroundByName(value);
          if (background) {
            $refBtn.show().data('background', background).attr('data-background-name', value).attr('title', i18n('WODSYSTEM.Wizard.ViewBackgroundDetails', {name: value}));
            newItem.attr('data-background-name', value);
          } else {
            $refBtn.hide().removeData('background').attr('data-background-name', '');
          }
        } else {
          $refBtn.hide().removeData('background').attr('data-background-name', '');
        }
      }
    });
    
    newItem.find('.background-reference-btn').click((event) => {
      event.preventDefault();
      event.stopPropagation();
      
      const $button = $(event.currentTarget);
      const background = $button.data('background');
      
      if (background) {
        // Toggle tooltip on click
        const existingTooltip = $('.wod-reference-tooltip');
        if (existingTooltip.length) {
          this._hideReferenceTooltip();
        } else {
          this._showBackgroundTooltip(event, background);
        }
      }
    });
    
    newItem.find('.bg-increase').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      await this._modifyBackground(index, 1);
    });
    
    newItem.find('.bg-decrease').click(async (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      await this._modifyBackground(index, -1);
    });
    
    newItem.find('.remove-background').click(async (event) => {
      event.preventDefault();
      document.activeElement?.blur();
      
      const index = parseInt(event.currentTarget.dataset.index);
      this.wizardData.advantages.backgrounds.splice(index, 1);
      await this._saveProgress();
      
      // Remove DOM element
      $(event.currentTarget).closest('.background-item').remove();
      
      // Reindex remaining items
      html.find('.background-item').each((i, item) => {
        const $item = $(item);
        $item.find('.background-select').attr('data-index', i);
        $item.find('.bg-increase').attr('data-index', i);
        $item.find('.bg-decrease').attr('data-index', i);
        $item.find('.remove-background').attr('data-index', i);
      });
      
      // Update validation and buttons
      const validation = this._validateCurrentStep();
      if (validation.backgrounds) {
        const tracker = html.find('.advantage-section:has(h4:contains("Backgrounds")) .points-tracker');
        tracker.find('.spent').text(validation.backgrounds.spent);
        tracker.find('.remaining').text(validation.backgrounds.remaining);
      }
      this._updateNavigationButtons(html);
    });
    
    newItem.find('.background-select').on('change', async (event) => {
      event.preventDefault();
      document.activeElement?.blur();
      
      const index = parseInt(event.currentTarget.dataset.index);
      const value = event.currentTarget.value;
      
      if (this.wizardData.advantages.backgrounds[index]) {
        this.wizardData.advantages.backgrounds[index].name = value;
        await this._saveProgress();
      }
    });
    
    // Update validation display and button states
    const validation = this._validateCurrentStep();
    if (validation.backgrounds) {
      const tracker = html.find('.advantage-section:has(h4:contains("Backgrounds")) .points-tracker');
      tracker.find('.spent').text(validation.backgrounds.spent);
      tracker.find('.remaining').text(validation.backgrounds.remaining);
      
      // Update all background increase button states based on remaining points
      const doubleCostBgs = this.config.advantages.backgrounds.doubleCost || [];
      const max = this.config.advantages.backgrounds.maxPerBackground;
      html.find('.bg-increase').each((i, btn) => {
        const $btn = $(btn);
        const bgIndex = parseInt($btn.data('index'));
        const bg = this.wizardData.advantages.backgrounds[bgIndex];
        const currentValue = bg?.value || 0;
        const atMax = currentValue >= max;
        const bgCostPerDot = doubleCostBgs.includes(bg?.name) ? 2 : 1;
        const notEnoughPoints = validation.backgrounds.remaining < bgCostPerDot;
        $btn.prop('disabled', atMax || notEnoughPoints);
      });
    }
    
    this._updateNavigationButtons(html);
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
    
    // Check if this is a double cost background
    const doubleCostBgs = this.config.advantages.backgrounds.doubleCost || [];
    const isDoubleCost = doubleCostBgs.includes(background.name);
    const costPerDot = isDoubleCost ? 2 : 1;
    
    // Check if we have enough points available
    const validation = this._validateCurrentStep();
    if (delta > 0 && validation.backgrounds?.remaining < costPerDot) {
      ui.notifications.warn(i18n('WODSYSTEM.Wizard.NotEnoughBackgroundPoints', {
        name: background.name,
        cost: costPerDot,
        plural: costPerDot > 1 ? 's' : ''
      }));
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
      // console.log(`🔄 BACKGROUND UPDATE - [${index}] ${background.name}: ${current} -> ${newValue}`);
      
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
      const doubleCostBgs = this.config.advantages.backgrounds.doubleCost || [];
      html.find('.bg-increase').each((i, btn) => {
        const $btn = $(btn);
        const bgIndex = parseInt($btn.data('index'));
        const bg = this.wizardData.advantages.backgrounds[bgIndex];
        const currentValue = bg?.value || 0;
        const atMax = currentValue >= max;
        const bgCostPerDot = doubleCostBgs.includes(bg?.name) ? 2 : 1;
        const notEnoughPoints = newValidation.backgrounds.remaining < bgCostPerDot;
        $btn.prop('disabled', atMax || notEnoughPoints);
      });
    }
    
    // Update navigation buttons
    this._updateNavigationButtons(html);
  }

  /**
   * Recalculate freebie points remaining from scratch
   * This ensures accuracy by calculating from current values rather than tracking incrementally
   */
  _recalculateFreebiesRemaining() {
    const baselines = this.wizardData.freebies.baselines;
    if (!baselines) return; // Can't recalculate without baselines
    
    const freebieBonus = this.wizardData.meritsFlaws?.freebieBonus || 0;
    const enlightenmentSpent = this.wizardData.advantages.freebiesSpent || 0;
    const baseTotal = this.config.freebies.total + freebieBonus;
    
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
    for (const [sphereName, currentValue] of Object.entries(this.wizardData.advantages.spheres)) {
      const baselineValue = baselines.spheres[sphereName] || 0;
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
    
    // Update remaining
    this.wizardData.freebies.remaining = baseTotal - totalSpent;
  }

  /**
   * Spend freebie point
   */
  async _spendFreebie(type, target, delta, bgName = null) {
    let cost = this.config.freebies.costs[type];
    
    // For backgrounds, check if it's a double cost background
    if (type === 'background') {
      const doubleCostBgs = this.config.advantages.backgrounds.doubleCost || [];
      const bgIndex = parseInt(target);
      let actualBgName = bgName;
      
      // If modifying existing background, get its name
      if (bgIndex >= 0 && bgIndex < this.wizardData.advantages.backgrounds.length) {
        actualBgName = this.wizardData.advantages.backgrounds[bgIndex].name;
      }
      
      // Double the cost if it's a double cost background
      if (actualBgName && doubleCostBgs.includes(actualBgName)) {
        cost = cost * 2; // 1 * 2 = 2 freebie points per dot
      }
    }
    
    const change = cost * delta;
    
    if (delta > 0 && this.wizardData.freebies.remaining < cost) {
      ui.notifications.warn(i18n('WODSYSTEM.Wizard.NotEnoughFreebiePointsGeneric'));
      return;
    }
    
    // Check baseline values for decrease operations
    const baselines = this.wizardData.freebies.baselines;
    if (delta < 0 && baselines) {
      let atBaseline = false;
      
      if (type === 'attribute') {
        const [cat, attr] = target.split('.');
        const currentValue = this.wizardData.attributes.values[cat][attr];
        const baselineValue = baselines.attributes[cat][attr];
        atBaseline = currentValue <= baselineValue;
      } else if (type === 'ability') {
        const [cat, ability] = target.split('.');
        const currentValue = this.wizardData.abilities.values[cat][ability] || 0;
        const baselineValue = baselines.abilities[cat][ability] || 0;
        atBaseline = currentValue <= baselineValue;
      } else if (type === 'background') {
        const bgIndex = parseInt(target);
        const bg = this.wizardData.advantages.backgrounds[bgIndex];
        if (bg) {
          const currentValue = bg.value || 0;
          const baselineBg = baselines.backgrounds.find(b => b.name === bg.name);
          const baselineValue = baselineBg?.value || 0;
          atBaseline = currentValue <= baselineValue;
        } else {
          atBaseline = true;
        }
      } else if (type === 'sphere') {
        const currentValue = this.wizardData.advantages.spheres[target] || 0;
        const baselineValue = baselines.spheres[target] || 0;
        atBaseline = currentValue <= baselineValue;
      } else if (type === 'willpower') {
        const currentSpent = this.wizardData.freebies.spent.willpower || 0;
        atBaseline = currentSpent <= 0;
      }
      
      if (atBaseline) {
        ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotDecreaseBelowPrevious'));
        return;
      }
    }
    
    let valueChanged = false;
    let newValue = 0;
    
    // Apply change based on type
    switch(type) {
      case 'attribute':
        const [attrCat, attrName] = target.split('.');
        const attrCurrent = this.wizardData.attributes.values[attrCat][attrName];
        const attrBaseline = baselines?.attributes[attrCat][attrName] || 1;
        const attrNew = Math.max(attrBaseline, Math.min(5, attrCurrent + delta));
        if (attrNew !== attrCurrent) {
          this.wizardData.attributes.values[attrCat][attrName] = attrNew;
          valueChanged = true;
          newValue = attrNew;
        }
        break;
        
      case 'ability':
        const [abCat, abName] = target.split('.');
        const abCurrent = this.wizardData.abilities.values[abCat][abName] || 0;
        const abBaseline = baselines?.abilities[abCat][abName] || 0;
        const abNew = Math.max(abBaseline, Math.min(5, abCurrent + delta));
        if (abNew !== abCurrent) {
          this.wizardData.abilities.values[abCat][abName] = abNew;
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
          const bg = this.wizardData.advantages.backgrounds[bgIndex];
          const baselineBg = baselines?.backgrounds.find(b => b.name === bg.name);
          const bgBaseline = baselineBg?.value || 0;
          const bgNew = Math.max(bgBaseline, Math.min(5, bgCurrent + delta));
          if (bgNew !== bgCurrent) {
            this.wizardData.advantages.backgrounds[bgIndex].value = bgNew;
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
        const sphereBaseline = baselines?.spheres[target] || 0;
        const sphereNew = Math.max(sphereBaseline, Math.min(enlightenment, sphereCurrent + delta));
        if (sphereNew !== sphereCurrent) {
          this.wizardData.advantages.spheres[target] = sphereNew;
          valueChanged = true;
          newValue = sphereNew;
        } else if (delta > 0 && sphereCurrent >= enlightenment) {
          ui.notifications.warn(i18n('WODSYSTEM.Wizard.CannotIncreaseSphereAboveEnlightenment', {enlightenment: enlightenment}));
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
          valueChanged = true;
          newValue = this.config.advantages.willpower.starting + wpNew;
        }
        break;
    }
    
    if (!valueChanged) return;
    
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
        const bgName = this.wizardData.advantages.backgrounds[bgIndex]?.name;
        if (bgName && doubleCostBgs.includes(bgName)) {
          btnCost = btnCost * 2; // Double the cost
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
  }

  /**
   * Navigate to next step
   */
  async _onNext(event) {
    event.preventDefault();
    
    // Validate current step
    const validation = this._validateCurrentStep();
    if (!validation.valid) {
      ui.notifications.error(validation.message || i18n('WODSYSTEM.Wizard.PleaseCompleteRequiredFields'));
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
    // console.log('Validation result:', validation);
    // console.log('Current step data:', this.wizardData[this.config.steps[this.currentStep].id]);
    
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
      validationContainer.html(`<i class="fas fa-check-circle"></i> ${i18n('WODSYSTEM.Wizard.ReadyToContinue')}`);
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
      ui.notifications.error(i18n('WODSYSTEM.Wizard.NoPermissionToEdit'));
      return;
    }
    
    // Final validation
    const validation = this.validator.validateAll(this.wizardData);
    // console.log('🏁 FINISH - Final validation:', validation);
    if (!validation.valid) {
      ui.notifications.error(i18n('WODSYSTEM.Wizard.CharacterCreationIncomplete', {message: validation.message}));
      console.error('🏁 FINISH - Validation failed:', validation);
      return;
    }
    
    // Confirm
    const confirm = await Dialog.confirm({
      title: i18n('WODSYSTEM.Wizard.FinishCharacterCreation'),
      content: `<p>${i18n('WODSYSTEM.Wizard.ConfirmFinishCreation')}</p>`,
      yes: () => true,
      no: () => false
    });
    
    if (!confirm) return;
    
    try {
      // Apply to actor
      await this._applyToActor();
      
      // Set initial Quintessence based on Avatar/Genius background
      const backgrounds = this.actor.system.miscellaneous?.backgrounds || [];
      const avatarOrGenius = backgrounds.find(bg => 
        bg.name === 'Avatar' || bg.name === 'Genius'
      );
      const startingQuintessence = avatarOrGenius ? (avatarOrGenius.value || 0) : 0;
      
      // Mark as created and set starting Quintessence
      await this.actor.update({ 
        "system.isCreated": true,
        "system.advantages.primalEnergy.current": startingQuintessence
      });
      
      // Clear wizard progress
      await this.actor.unsetFlag('wodsystem', 'wizardProgress');
      
      // Force re-render the actor sheet to show all changes
      this.actor.sheet?.render(true);
      
      ui.notifications.info(i18n('WODSYSTEM.Wizard.CharacterCreationComplete'));
      this.close();
    } catch (error) {
      console.error('WodCharacterWizard | Error finalizing character:', error);
      ui.notifications.error(i18n('WODSYSTEM.Wizard.FailedToFinalize'));
    }
  }

  /**
   * Cancel wizard
   */
  async _onCancel(event) {
    event.preventDefault();
    
    const confirm = await Dialog.confirm({
      title: i18n('WODSYSTEM.Wizard.CancelCharacterCreation'),
      content: `<p>${i18n('WODSYSTEM.Wizard.ConfirmCancelCreation')}</p>`,
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
    // console.log('🎯 APPLY TO ACTOR - Starting...');
    
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
    // console.log('🎯 BACKGROUNDS CHECK - Raw array:', JSON.stringify(this.wizardData.advantages.backgrounds));
    
    const validBackgrounds = this.wizardData.advantages.backgrounds.filter(bg => {
      const isValid = bg.name && bg.name.trim() !== "" && bg.value > 0;
      if (!isValid) {
        // console.log('🎯 BACKGROUNDS - Filtering out invalid:', bg);
      }
      return isValid;
    });
    
    // console.log('🎯 BACKGROUNDS CHECK - Valid backgrounds:', JSON.stringify(validBackgrounds));
    
    // Always set backgrounds (even if empty array) to ensure initialization
    updateData["system.miscellaneous.backgrounds"] = validBackgrounds;
    // console.log('🎯 BACKGROUNDS - Setting', validBackgrounds.length, 'backgrounds to system.miscellaneous.backgrounds');
    
    // Willpower (base + freebies)
    const baseWillpower = this.config.advantages.willpower.starting;
    const freebieWillpower = this.wizardData.freebies.spent.willpower || 0;
    const totalWillpower = baseWillpower + freebieWillpower;
    updateData["system.miscellaneous.willpower.permanent"] = totalWillpower;
    updateData["system.miscellaneous.willpower.temporary"] = totalWillpower;
    
    // console.log('🎯 WILLPOWER - Base:', baseWillpower, 'Freebies:', freebieWillpower, 'Total:', totalWillpower);
    
    // Apply update
    await this.actor.update(updateData);
    
    // console.log('🎯 APPLY TO ACTOR - Update complete. Backgrounds applied:', updateData["system.miscellaneous.backgrounds"]);
  }

  /**
   * Update on form submit
   */
  async _updateObject(event, formData) {
    // Handle form data if needed
    await this._saveProgress();
  }
}

