/**
 * Configuration for Character Creation Wizard
 * Defines creation rules for each actor type
 * Note: Labels are now stored in i18n files and translated dynamically
 */

/**
 * Complete list of Nature/Demeanor archetypes
 */
export const ARCHETYPES = [
  "Activist", "Architect", "Artist", "Benefactor", "Bon Vivant", "Caregiver",
  "Conformist", "Contrary", "Crusader", "Director", "Entertainer", "Guardian",
  "Hacker", "Heretic", "Idealist", "Innovator", "Kid", "Loner", "Machine",
  "Mad Scientist", "Martyr", "Mentor", "Monster", "Prophet", "Romantic",
  "Rogue", "Sensualist", "Survivor", "Traditionalist", "Trickster", "Tycoon",
  "Vigilante", "Visionary", "Zealot"
].sort(); // Sort alphabetically for easier selection

/**
 * Banned archetypes for Earthbound (from earthbound-banned-archtypes.md)
 * Note: "Child" in the file maps to "Kid" in ARCHETYPES
 * "Gallant", "Penitent", "Thrill-Seeker" are not in ARCHETYPES list
 */
export const EARTHBOUND_BANNED_ARCHETYPES = [
  "Bon Vivant",
  "Caregiver",
  "Kid", // File says "Child" but ARCHETYPES has "Kid"
  "Conformist",
  "Martyr"
];

/**
 * Demon Houses (from houses.md)
 */
export const HOUSES = [
  "Devil",
  "Fiend",
  "Devourer",
  "Malefactor",
  "Scourge",
  "Slayer",
  "Defiler"
].sort(); // Sort alphabetically for easier selection

/**
 * Get archetypes filtered by actor type
 * @param {string} actorType - Actor type to get archetypes for
 * @returns {Array} Filtered array of archetype names
 */
export function getArchetypesForActorType(actorType) {
  if (actorType === "Earthbound") {
    return ARCHETYPES.filter(arch => !EARTHBOUND_BANNED_ARCHETYPES.includes(arch));
  }
  return ARCHETYPES;
}

export const WIZARD_CONFIG = {
  // Technocrat Configuration
  Technocrat: {
    name: "Technocrat",
    labelKey: "Wizard.TechnocratCharacter", // i18n key instead of hardcoded string
    steps: [
      { id: "concept", labelKey: "Wizard.StepConceptIdentity", icon: "fa-user" },
      { id: "attributes", labelKey: "Wizard.StepAttributes", icon: "fa-dumbbell" },
      { id: "abilities", labelKey: "Wizard.StepAbilities", icon: "fa-brain" },
      { id: "advantages", labelKey: "Wizard.StepAdvantages", icon: "fa-star" },
      { id: "merits-flaws", labelKey: "Wizard.StepMeritsFlaws", icon: "fa-balance-scale" },
      { id: "freebies", labelKey: "Wizard.StepFreebies", icon: "fa-coins" },
      { id: "review", labelKey: "Wizard.StepReview", icon: "fa-check-circle" }
    ],
    
    // Step 1: Concept
    concept: {
      fields: [
        { name: "name", labelKey: "Wizard.FieldName", type: "text", required: true },
        { name: "concept", labelKey: "Wizard.FieldConcept", type: "text", required: true, placeholderKey: "Wizard.PlaceholderConcept" },
        { name: "nature", labelKey: "Wizard.FieldNature", type: "select", required: true, options: ARCHETYPES },
        { name: "demeanor", labelKey: "Wizard.FieldDemeanor", type: "select", required: true, options: ARCHETYPES },
        { name: "convention", labelKey: "Wizard.FieldConvention", type: "select", required: true, options: [
          "Iteration X",
          "New World Order",
          "Progenitors",
          "Syndicate",
          "Void Engineers"
        ]},
        { name: "amalgam", labelKey: "Wizard.FieldAmalgam", type: "text", placeholderKey: "Wizard.PlaceholderAmalgam" },
        { name: "eidolon", labelKey: "Wizard.FieldEidolon", type: "text", placeholderKey: "Wizard.PlaceholderEidolon" }
      ],
      // Convention affinity spheres (at least 1 point must be in an affinity sphere)
      affinitySpheres: {
        "Iteration X": ["forces", "matter", "time"],
        "New World Order": ["mind", "correspondence"],
        "Progenitors": ["life", "prime"],
        "Syndicate": ["entropy", "mind", "prime"],
        "Void Engineers": ["spirit", "correspondence", "forces"]
      }
    },

    // Step 2: Attributes
    attributes: {
      priorities: {
        primary: 7,
        secondary: 5,
        tertiary: 3
      },
      categories: ["physical", "social", "mental"],
      starting: 1, // Each attribute starts at 1
      maxAtCreation: 5
    },

    // Step 3: Abilities
    abilities: {
      priorities: {
        primary: 13,
        secondary: 9,
        tertiary: 5
      },
      categories: ["talents", "skills", "knowledges"],
      starting: 0,
      maxAtCreation: 3,
      allowSecondary: true
    },

    // Step 4: Advantages
    advantages: {
      backgrounds: {
        points: 7,
        maxPerBackground: 5,
        available: [
          "Allies", "Alternate Identity", "Arcane", "Avatar", "Backup", "Certification",
          "Contacts", "Cult", "Destiny", "Device", "Dream", "Enhancement", "Fame", "Influence",
          "Library", "Mentor", "Node", "Patron", "Rank", "Requisitions", "Resources",
          "Retainers", "Sanctum", "Secret Weapons", "Spies", "Status", "Wonder"
        ],
        // Backgrounds that cost 2 points per dot instead of 1
        doubleCost: ["Enhancement", "Device"]
      },
      spheres: {
        points: 6,
        maxAtCreation: 3,
        available: {
          correspondence: "Data",
          entropy: "Entropy",
          forces: "Forces",
          life: "Life",
          matter: "Matter",
          mind: "Mind",
          prime: "Primal Utility",
          spirit: "Dimensional Science",
          time: "Time"
        }
      },
      enlightenment: {
        starting: 1,
        cannotModify: true
      },
      willpower: {
        starting: 5  // Mages/Technocrats start with 5 Willpower (Mortals start with 3)
      }
    },

    // Step 5: Freebie Points
    freebies: {
      total: 15,
      costs: {
        attribute: 5,
        ability: 2,
        background: 1,
        sphere: 7,
        enlightenment: 4,
        willpower: 1
      },
      limits: {
        attribute: 5,
        ability: 5,
        sphere: 3,
        enlightenment: 3
      }
    }
  },

  // Mortal Configuration (simpler)
  Mortal: {
    name: "Mortal",
    labelKey: "Wizard.MortalCharacter", // i18n key instead of hardcoded string
    steps: [
      { id: "concept", labelKey: "Wizard.StepConcept", icon: "fa-user" },
      { id: "attributes", labelKey: "Wizard.StepAttributes", icon: "fa-dumbbell" },
      { id: "abilities", labelKey: "Wizard.StepAbilities", icon: "fa-brain" },
      { id: "advantages", labelKey: "Wizard.StepAdvantages", icon: "fa-star" },
      { id: "freebies", labelKey: "Wizard.StepFreebies", icon: "fa-coins" },
      { id: "review", labelKey: "Wizard.StepReview", icon: "fa-check-circle" }
    ],

    concept: {
      fields: [
        { name: "name", labelKey: "Wizard.FieldName", type: "text", required: true },
        { name: "concept", labelKey: "Wizard.FieldConcept", type: "text", required: true },
        { name: "nature", labelKey: "Wizard.FieldNature", type: "select", required: true, options: ARCHETYPES },
        { name: "demeanor", labelKey: "Wizard.FieldDemeanor", type: "select", required: true, options: ARCHETYPES }
      ]
    },

    attributes: {
      priorities: { primary: 7, secondary: 5, tertiary: 3 },
      categories: ["physical", "social", "mental"],
      starting: 1,
      maxAtCreation: 5
    },

    abilities: {
      priorities: { primary: 13, secondary: 9, tertiary: 5 },
      categories: ["talents", "skills", "knowledges"],
      starting: 0,
      maxAtCreation: 3,
      allowSecondary: true
    },

    advantages: {
      backgrounds: {
        points: 5,
        maxPerBackground: 5,
        available: [
          "Allies", "Contacts", "Fame", "Influence", "Mentor", "Resources", "Status"
        ]
      },
      virtues: {
        starting: 1,  // All virtues start at 1 (like attributes), willpower = sum of virtues
        available: ["Conscience", "Self-Control", "Courage"]
      },
      numina: {
        points: 5,
        maxAtCreation: 3
      },
      willpower: {
        starting: 1  // Equals Courage virtue (starts at 1)
      }
    },

    freebies: {
      total: 21,
      costs: {
        attribute: 5,
        ability: 2,
        background: 1,
        numina: 3,
        willpower: 1
      },
      limits: {
        attribute: 5,
        ability: 5,
        numina: 5
      }
    }
  },

  // Mage Configuration
  Mage: {
    name: "Mage",
    labelKey: "Wizard.MageCharacter",
    steps: [
      { id: "concept", labelKey: "Wizard.StepConceptIdentity", icon: "fa-user" },
      { id: "attributes", labelKey: "Wizard.StepAttributes", icon: "fa-dumbbell" },
      { id: "abilities", labelKey: "Wizard.StepAbilities", icon: "fa-brain" },
      { id: "advantages", labelKey: "Wizard.StepAdvantages", icon: "fa-star" },
      { id: "merits-flaws", labelKey: "Wizard.StepMeritsFlaws", icon: "fa-balance-scale" },
      { id: "freebies", labelKey: "Wizard.StepFreebies", icon: "fa-coins" },
      { id: "review", labelKey: "Wizard.StepReview", icon: "fa-check-circle" }
    ],
    
    // Step 1: Concept
    concept: {
      fields: [
        { name: "name", labelKey: "Wizard.FieldName", type: "text", required: true },
        { name: "concept", labelKey: "Wizard.FieldConcept", type: "text", required: true, placeholderKey: "Wizard.PlaceholderConcept" },
        { name: "nature", labelKey: "Wizard.FieldNature", type: "select", required: true, options: ARCHETYPES },
        { name: "demeanor", labelKey: "Wizard.FieldDemeanor", type: "select", required: true, options: ARCHETYPES },
        { name: "tradition", labelKey: "Wizard.FieldTradition", type: "select", required: true, options: [
          "Akashic Brotherhood",
          "Celestial Chorus",
          "Cult of Ecstasy",
          "Dreamspeakers",
          "Euthanatos",
          "Order of Hermes",
          "Sons of Ether",
          "Verbena",
          "Virtual Adepts"
        ]},
        { name: "cabal", labelKey: "Wizard.FieldCabal", type: "text", placeholderKey: "Wizard.PlaceholderCabal" },
        { name: "essence", labelKey: "Wizard.FieldEssence", type: "text", placeholderKey: "Wizard.PlaceholderEssence" }
      ],
      // Tradition affinity spheres (at least 1 point must be in an affinity sphere)
      // Note: These are kept for backwards compatibility, but validation uses affinities.json
      affinitySpheres: {
        "Akashic Brotherhood": ["mind", "life"],
        "Celestial Chorus": ["prime", "forces", "spirit"],
        "Cult of Ecstasy": ["time", "life", "mind"],
        "Dreamspeakers": ["spirit", "forces", "life", "matter"],
        "Euthanatos": ["entropy", "life", "spirit"],
        "Order of Hermes": ["forces"],
        "Sons of Ether": ["matter", "forces", "prime"],
        "Verbena": ["life", "forces"],
        "Virtual Adepts": ["correspondence", "forces"]
      }
    },

    // Step 2: Attributes
    attributes: {
      priorities: {
        primary: 7,
        secondary: 5,
        tertiary: 3
      },
      categories: ["physical", "social", "mental"],
      starting: 1,
      maxAtCreation: 5
    },

    // Step 3: Abilities
    abilities: {
      priorities: {
        primary: 13,
        secondary: 9,
        tertiary: 5
      },
      categories: ["talents", "skills", "knowledges"],
      starting: 0,
      maxAtCreation: 3,
      allowSecondary: true
    },

    // Step 4: Advantages
    advantages: {
      backgrounds: {
        points: 7,
        maxPerBackground: 5,
        available: [
          "Allies", "Alternate Identity", "Arcane", "Avatar", "Backup", "Certification",
          "Contacts", "Cult", "Destiny", "Device", "Dream", "Enhancement", "Fame", "Influence",
          "Library", "Mentor", "Node", "Patron", "Rank", "Requisitions", "Resources",
          "Retainers", "Sanctum", "Secret Weapons", "Spies", "Status", "Wonder"
        ],
        // Backgrounds that cost 2 points per dot instead of 1
        doubleCost: ["Enhancement", "Device"]
      },
      spheres: {
        points: 6,
        maxAtCreation: 3,
        available: {
          correspondence: "Correspondence",
          entropy: "Entropy",
          forces: "Forces",
          life: "Life",
          matter: "Matter",
          mind: "Mind",
          prime: "Prime",
          spirit: "Spirit",
          time: "Time"
        }
      },
      enlightenment: {
        starting: 1,
        cannotModify: true
      },
      willpower: {
        starting: 5  // Mages start with 5 Willpower
      }
    },

    // Step 5: Freebie Points
    freebies: {
      total: 15,
      costs: {
        attribute: 5,
        ability: 2,
        background: 1,
        sphere: 7,
        enlightenment: 4,
        willpower: 1
      },
      limits: {
        attribute: 5,
        ability: 5,
        sphere: 3,
        enlightenment: 3
      }
    }
  },

  // Demon Configuration
  Demon: {
    name: "Demon",
    labelKey: "Wizard.DemonCharacter",
    steps: [
      { id: "concept", labelKey: "Wizard.StepConceptIdentity", icon: "fa-user" },
      { id: "attributes", labelKey: "Wizard.StepAttributes", icon: "fa-dumbbell" },
      { id: "abilities", labelKey: "Wizard.StepAbilities", icon: "fa-brain" },
      { id: "advantages", labelKey: "Wizard.StepAdvantages", icon: "fa-star" },
      { id: "merits-flaws", labelKey: "Wizard.StepMeritsFlaws", icon: "fa-balance-scale" },
      { id: "freebies", labelKey: "Wizard.StepFreebies", icon: "fa-coins" },
      { id: "review", labelKey: "Wizard.StepReview", icon: "fa-check-circle" }
    ],
    
    // Step 1: Concept
    concept: {
      fields: [
        { name: "name", labelKey: "Wizard.FieldName", type: "text", required: true },
        { name: "concept", labelKey: "Wizard.FieldConcept", type: "text", required: true, placeholderKey: "Wizard.PlaceholderConcept" },
        { name: "nature", labelKey: "Wizard.FieldNature", type: "select", required: true, options: getArchetypesForActorType("Demon") },
        { name: "demeanor", labelKey: "Wizard.FieldDemeanor", type: "select", required: true, options: getArchetypesForActorType("Demon") },
        { name: "house", labelKey: "Wizard.FieldHouse", type: "select", required: false, options: HOUSES },
        { name: "apocalypticForm", labelKey: "Wizard.FieldApocalypticForm", type: "select", required: false, options: [], visible: false } // Hidden by default, shown only when house is selected
      ]
    },

    // Step 2: Attributes
    attributes: {
      priorities: {
        primary: 7,
        secondary: 5,
        tertiary: 3
      },
      categories: ["physical", "social", "mental"],
      starting: 1,
      maxAtCreation: 5
    },

    // Step 3: Abilities
    abilities: {
      priorities: {
        primary: 13,
        secondary: 9,
        tertiary: 5
      },
      categories: ["talents", "skills", "knowledges"],
      starting: 0,
      maxAtCreation: 3,
      allowSecondary: true
    },

    // Step 4: Advantages
    advantages: {
      backgrounds: {
        points: 5,  // Demon: 5 background points (not 7)
        maxPerBackground: 5,
        available: [
          "Allies", "Contacts", "Eminence", "Fame", "Followers", 
          "Influence", "Legacy", "Mentor", "Pacts", "Paragon", "Resources"
        ]
        // Note: Demon backgrounds do NOT have double cost (unlike Mage/Technocrat)
        // Demon backgrounds from creation_rules.md: Allies, Contacts, Eminence, Fame, Followers, Influence, Legacy, Mentor, Pacts, Paragon, Resources
      },
      virtues: {
        starting: 1,  // All virtues start at 1 (like attributes)
        points: 3,    // 3 points to distribute among virtues (in addition to starting 1)
        available: ["Conscience", "Self-Control", "Courage"]
      },
      lore: {
        points: 3,  // Demon: 3 lore points (not 6)
        maxAtCreation: 3,
        available: {} // Will be populated dynamically from D20 lore paths
      },
      faith: {
        starting: 3,  // Demon: starting Faith is 3 (not 1)
        permanent: 3,
        cannotModify: false  // Faith CAN be modified with freebies
      },
      torment: {
        starting: 0,  // Torment is based on demonic House (set during finishing touches)
        cannotModify: true
      },
      willpower: {
        starting: 0  // Willpower = sum of two highest Virtues (calculated, not fixed)
      }
    },

    // Step 5: Freebie Points
    freebies: {
      total: 15,
      costs: {
        attribute: 5,
        ability: 2,
        background: 1,
        lore: 7,     // Lore costs 7 per dot
        faith: 6,    // Demon: Faith costs 6 per dot (not 4)
        virtue: 2,   // Demon: Virtue costs 2 per dot
        willpower: 1
      },
      limits: {
        attribute: 5,
        ability: 5,
        lore: 5,  // Lore paths can go up to 5 dots (normal maximum), not limited to 3 during freebies
        faith: 10,  // Faith can be increased up to 10 dots with freebies
        virtue: 5    // Virtues can be increased up to 5
      }
    }
  }
};

/**
 * Get configuration for a specific actor type
 */
export function getWizardConfig(actorType) {
  // NPC types don't have wizard support
  if (actorType && actorType.endsWith('-NPC')) {
    return null;
  }
  return WIZARD_CONFIG[actorType] || null;
}

/**
 * Check if an actor type has wizard support
 */
export function hasWizardSupport(actorType) {
  return actorType in WIZARD_CONFIG;
}

