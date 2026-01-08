/**
 * Configuration for Character Creation Wizard
 * Defines creation rules for each actor type
 */

export const WIZARD_CONFIG = {
  // Technocrat Configuration
  Technocrat: {
    name: "Technocrat",
    label: "Technocrat Character",
    steps: [
      { id: "concept", label: "Concept & Identity", icon: "fa-user" },
      { id: "attributes", label: "Attributes", icon: "fa-dumbbell" },
      { id: "abilities", label: "Abilities", icon: "fa-brain" },
      { id: "advantages", label: "Advantages", icon: "fa-star" },
      { id: "merits-flaws", label: "Merits & Flaws", icon: "fa-balance-scale" },
      { id: "freebies", label: "Freebie Points", icon: "fa-coins" },
      { id: "review", label: "Review", icon: "fa-check-circle" }
    ],
    
    // Step 1: Concept
    concept: {
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "concept", label: "Concept", type: "text", required: true, placeholder: "e.g., Cybernetics Specialist, Reality Engineer" },
        { name: "nature", label: "Nature", type: "select", required: true, options: [
          "Architect", "Autocrat", "Bon Vivant", "Bravo", "Capitalist", "Caregiver",
          "Competitor", "Conformist", "Conniver", "Critic", "Curmudgeon", "Deviant",
          "Director", "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist",
          "Monster", "Pedagogue", "Penitent", "Perfectionist", "Rebel", "Rogue",
          "Scientist", "Survivor", "Traditionalist", "Trickster", "Visionary"
        ]},
        { name: "demeanor", label: "Demeanor", type: "select", required: true, options: [
          "Architect", "Autocrat", "Bon Vivant", "Bravo", "Capitalist", "Caregiver",
          "Competitor", "Conformist", "Conniver", "Critic", "Curmudgeon", "Deviant",
          "Director", "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist",
          "Monster", "Pedagogue", "Penitent", "Perfectionist", "Rebel", "Rogue",
          "Scientist", "Survivor", "Traditionalist", "Trickster", "Visionary"
        ]},
        { name: "convention", label: "Convention", type: "select", required: true, options: [
          "Iteration X",
          "New World Order",
          "Progenitors",
          "Syndicate",
          "Void Engineers"
        ]},
        { name: "amalgam", label: "Amalgam", type: "text", placeholder: "e.g., BioMechanics, MECHA" }
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
          "Contacts", "Cult", "Destiny", "Dream", "Enhancement", "Fame", "Influence",
          "Library", "Mentor", "Node", "Patron", "Rank", "Requisitions", "Resources",
          "Retainers", "Sanctum", "Secret Weapons", "Spies", "Status", "Wonder"
        ]
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
    label: "Mortal Character",
    steps: [
      { id: "concept", label: "Concept", icon: "fa-user" },
      { id: "attributes", label: "Attributes", icon: "fa-dumbbell" },
      { id: "abilities", label: "Abilities", icon: "fa-brain" },
      { id: "advantages", label: "Advantages", icon: "fa-star" },
      { id: "freebies", label: "Freebie Points", icon: "fa-coins" },
      { id: "review", label: "Review", icon: "fa-check-circle" }
    ],

    concept: {
      fields: [
        { name: "name", label: "Name", type: "text", required: true },
        { name: "concept", label: "Concept", type: "text", required: true },
        { name: "nature", label: "Nature", type: "select", required: true, options: [
          "Architect", "Autocrat", "Bon Vivant", "Bravo", "Capitalist", "Caregiver",
          "Competitor", "Conformist", "Conniver", "Critic", "Curmudgeon", "Deviant",
          "Director", "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist"
        ]},
        { name: "demeanor", label: "Demeanor", type: "select", required: true, options: [
          "Architect", "Autocrat", "Bon Vivant", "Bravo", "Capitalist", "Caregiver",
          "Competitor", "Conformist", "Conniver", "Critic", "Curmudgeon", "Deviant",
          "Director", "Fanatic", "Gallant", "Judge", "Loner", "Martyr", "Masochist"
        ]}
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
      numina: {
        points: 5,
        maxAtCreation: 3
      },
      willpower: {
        starting: 3
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
  }
};

/**
 * Get configuration for a specific actor type
 */
export function getWizardConfig(actorType) {
  return WIZARD_CONFIG[actorType] || null;
}

/**
 * Check if an actor type has wizard support
 */
export function hasWizardSupport(actorType) {
  return actorType in WIZARD_CONFIG;
}

