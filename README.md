# World of Darkness System for Foundry VTT

A Foundry VTT system for running World of Darkness games, supporting Mortal, Vampire, Demon, and other creature types with a flexible hierarchical trait system.

## Project Structure

```
wodsystem/
├── wodsystem.js                 # Main system entry point
├── system.json                  # System metadata and compatibility
├── template.json               # Hierarchical trait definitions
├── module/
│   ├── actor/
│   │   ├── data/
│   │   │   └── wod-actor.js    # Actor data model and lifecycle
│   │   ├── scripts/
│   │   │   └── trait-factory.js # Hierarchical trait creation
│   │   └── template/
│   │       ├── mortal-sheet.js # Mortal character sheet class
│   │       ├── mortal-sheet.html # Mortal sheet template
│   │       └── mortal-sheet.css # Mortal sheet styles
│   └── templates/
│       └── mortal-sheet.html   # Template file (Foundry requirement)
└── styles/
    └── mortal-sheet.css        # Global styles (Foundry requirement)
```

## Key Features

### Hierarchical Trait System
- **`template.json`**: Contains hierarchical trait definitions
- **Base Traits**: Mortal abilities serve as the foundation
- **Inheritance**: All creatures inherit from base traits
- **Additions**: Each creature type can add new abilities
- **Replacements**: Each creature type can replace existing traits
- **Universal Health**: All creatures have the same base health levels

### Template-Driven Architecture
- **Dynamic Initialization**: Properties are automatically created from template.json
- **No Hardcoded Structures**: All trait structures come from the template
- **Single Source of Truth**: Template.json defines everything
- **Extensible**: Adding new properties requires only template changes

### Dynamic Trait Creation
- **Single Method**: `createTraits(actor, category, properties)` handles all trait types
- **Flexible Categories**: Can create any trait category dynamically
- **Clean API**: No redundant convenience methods
- **Future-Proof**: No need to add new methods for new trait types

### Actor System
- **`module/actor/data/wod-actor.js`**: Handles actor data and lifecycle
- **`module/actor/scripts/trait-factory.js`**: Creates traits using inheritance
- **Automatic Trait Resolution**: Handles complex trait hierarchies

### Character Sheets
- **`module/actor/template/mortal-sheet.js`**: Mortal character sheet implementation
- **Dot-based Interface**: For attributes and abilities
- **Responsive Design**: Compact layout

## Hierarchical Trait System

The system uses a three-tier approach:

### 1. Base Traits (Mortal Foundation)
```json
{
    "baseTraits": {
        "attributes": { /* Physical, Social, Mental */ },
        "abilities": { /* Talents, Skills, Knowledges */ },
        "advantages": {
            "backgrounds": { /* Allies, Contacts, Resources, etc. */ },
            "virtues": { /* Conscience, Self-Control, Courage */ },
            "numina": { /* Supernatural abilities */ }
        },
        "miscellaneous": {
            "humanity": { /* Humanity rating */ },
            "willpower": { /* Willpower pool */ },
            "health": { /* Universal base health (7 levels) */ },
            "merits": [],
            "flaws": []
        }
    }
}
```

### 2. Creature-Specific Additions
```json
{
    "Vampire": {
        "traits": {
            "inherit": "baseTraits",
            "add": {
                "advantages": {
                    "numina": {
                        "Disciplines": { /* Vampire disciplines */ }
                    }
                },
                "miscellaneous": {
                    "blood": { /* Blood pool */ }
                }
            }
        }
    }
}
```

### 3. Creature-Specific Replacements
```json
{
    "Demon": {
        "traits": {
            "inherit": "baseTraits",
            "replace": {
                "miscellaneous": {
                    "willpower": { "permanent": 5, "temporary": 5 }
                }
            }
        }
    }
}
```

## Adding New Creature Types

To add a new creature type (e.g., Werewolf):

1. **Add to actor types** in `template.json`:
```json
{
    "Actor": {
        "types": ["Mortal", "Vampire", "Demon", "Werewolf"]
    }
}
```

2. **Define creature traits** in `template.json`:
```json
{
    "Werewolf": {
        "name": "Werewolf",
        "label": "Werewolf",
        "traits": {
            "inherit": "baseTraits",
            "add": {
                "advantages": {
                    "numina": {
                        "Gifts": { /* Werewolf gifts */ }
                    }
                },
                "miscellaneous": {
                    "rage": { "current": 5, "maximum": 5 }
                }
            }
        }
    }
}
```

3. **Create character sheet** (if needed):
   - `module/actor/template/werewolf-sheet.js`
   - `module/actor/template/werewolf-sheet.html`
   - `module/actor/template/werewolf-sheet.css`

4. **Register the sheet** in `wodsystem.js`:
```javascript
Actors.registerSheet("wodsystem", WerewolfSheet, {
    types: ["Werewolf"],
    makeDefault: true
});
```

## TraitFactory Integration

The TraitFactory automatically:
- **Loads template data** from `template.json`
- **Dynamically initializes** all properties found in the template
- **Inherits base traits** for all creatures
- **Applies additions** (new abilities, powers, etc.)
- **Applies replacements** (overwrites existing values)
- **Deep merges** complex nested structures
- **Handles any creature type** without code changes

### Dynamic Initialization Benefits

✅ **No Hardcoded Structures**: All properties come from template.json  
✅ **Automatic Property Creation**: Adding new properties requires only template changes  
✅ **Single Source of Truth**: Template.json defines all trait structures  
✅ **Future-Proof**: New creature types automatically get all base properties  

### Dynamic Trait Creation Benefits

✅ **Single Method**: `createTraits(actor, category, properties)` handles everything  
✅ **Flexible Categories**: Can create any trait category dynamically  
✅ **Clean API**: No redundant convenience methods  
✅ **Future-Proof**: No need to add new methods for new trait types  

#### Usage Examples:

```javascript
// Single method handles all trait categories
await factory.createTraits(actor, "attributes", attributes);
await factory.createTraits(actor, "abilities", abilities);
await factory.createTraits(actor, "advantages", advantages);
await factory.createTraits(actor, "miscellaneous", miscellaneous);
await factory.createTraits(actor, "custom", customTraits);
await factory.createTraits(actor, "reputation", reputationData);
```

## Example Creature Types

### Mortal
- Inherits all base traits
- No additions or replacements
- Base health: 7 levels
- Advantages: Backgrounds, Virtues, Numina (empty)
- Miscellaneous: Humanity, Willpower, Health, Merits, Flaws

### Vampire
- Inherits base traits (including 7 health levels)
- Adds: Animalism talent, Vampiric Lore skill, Disciplines (in numina), Blood pool
- No health replacement (same base health as mortal)
- Advantages: Backgrounds, Virtues, Numina (with Disciplines)

### Demon
- Inherits base traits (including 7 health levels)
- Adds: Demonic Presence, Infernal Lore, Corruption, Hellish Secrets, Powers (in numina), Essence
- Replaces: Willpower (5 permanent instead of 3)
- No health replacement (same base health as mortal)
- Advantages: Backgrounds, Virtues, Numina (with Powers)

## Trait Organization

### Advantages
- **Backgrounds**: Social connections, resources, status (Allies, Contacts, Resources, etc.)
- **Virtues**: Moral compass (Conscience, Self-Control, Courage)
- **Numina**: Supernatural abilities (Disciplines for Vampires, Powers for Demons, etc.)

### Miscellaneous
- **Humanity**: Moral standing and connection to human nature
- **Willpower**: Mental fortitude and determination
- **Health**: Physical well-being and damage capacity
- **Merits**: Positive character traits and advantages
- **Flaws**: Negative character traits and disadvantages

## Health System Notes

- **Universal Base Health**: All creatures start with 7 health levels
- **Supernatural Forms**: Additional health comes from powers, transformations, or effects
- **Template Consistency**: Base templates never modify health levels
- **Game Mechanics**: Health modifications happen through gameplay, not templates

## Development Notes

- **Foundry v11 Compatible**: Uses ActorSheet instead of ActorSheetV2
- **Hierarchical Design**: Flexible inheritance system
- **Single Source of Truth**: All definitions in template.json
- **Extensible**: Easy to add new creature types
- **Deep Merging**: Handles complex nested trait structures
- **Universal Health**: Consistent base health across all creatures
- **Organized Traits**: Clear separation between advantages and miscellaneous traits
- **Template-Driven**: No hardcoded structures in code
- **Dynamic Creation**: Single method handles all trait categories
- **Clean API**: No redundant methods or complexity

## Future Enhancements

- [ ] Werewolf character support
- [ ] Mage character support
- [ ] Changeling character support
- [ ] Mummy character support
- [ ] Disciplines and supernatural abilities
- [ ] Combat system integration
- [ ] Dice rolling system
- [ ] Supernatural form transformations 