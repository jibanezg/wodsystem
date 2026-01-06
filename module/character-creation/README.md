# Character Creation Wizard

A comprehensive, step-by-step character creation system for World of Darkness characters.

## Features

### 🎯 **Guided Creation Process**
- 6-step wizard guiding players through character creation
- Automatic point calculation and validation
- Real-time feedback on available points
- Progress saving (can close and continue later)

### 📋 **Creation Steps**

1. **Concept & Identity**
   - Name, Concept, Nature, Demeanor
   - Convention/Amalgam (for Technocrats)
   
2. **Attributes**
   - Priority selection (7/5/3 points)
   - Physical, Social, Mental categories
   - Visual dot representation
   
3. **Abilities**
   - Priority selection (13/9/5 points)
   - Talents, Skills, Knowledges
   - Custom secondary abilities support
   
4. **Advantages**
   - Backgrounds (7 points for Technocrats, 5 for Mortals)
   - Spheres (6 points, Technocrats only)
   - Starting Willpower & Enlightenment
   
5. **Freebie Points**
   - 15 points for Technocrats, 21 for Mortals
   - Variable costs per trait type
   - Flexible spending (not required to spend all)
   
6. **Review**
   - Complete character summary
   - Edit any step before finalizing
   - One-click finalization

### ✨ **Key Benefits**

- **User-Friendly**: No need to read extensive rule books
- **Error Prevention**: Automatic validation prevents invalid characters
- **Progress Tracking**: Visual progress bar and step indicators
- **Flexible**: Can edit previous steps at any time
- **Generic Design**: Easy to extend to other WoD creature types

## Supported Actor Types

Currently supported:
- ✅ **Technocrat** (fully featured)
- ✅ **Mortal** (fully featured)

Easy to add:
- Vampire
- Werewolf
- Mage
- Changeling
- Demon
- Hunter

## Usage

### For Players

1. Create a new Actor (Technocrat or Mortal type)
2. Open the actor sheet
3. Click the **"Start Character Creation Wizard"** button in the header
4. Follow the 6-step process
5. Review and finalize your character

### For GMs

The wizard button only appears for:
- New characters (`isCreated = false`)
- Supported actor types

To reset a character and allow re-creation:
```javascript
actor.update({ "system.isCreated": false });
```

## Configuration

### Adding New Actor Types

To add wizard support for a new actor type:

1. Edit `wizard-config.js`
2. Add configuration for your actor type:

```javascript
export const WIZARD_CONFIG = {
  YourActorType: {
    name: "YourActorType",
    label: "Your Actor Type Character",
    steps: [ /* ... */ ],
    concept: { /* ... */ },
    attributes: { /* ... */ },
    abilities: { /* ... */ },
    advantages: { /* ... */ },
    freebies: { /* ... */ }
  }
};
```

3. Register in `wod-actor-sheet.js`:
```javascript
context.hasWizardSupport = ['Mortal', 'Technocrat', 'YourActorType'].includes(this.actor.type);
```

### Customizing Rules

All creation rules are defined in `wizard-config.js`:

- **Point Allocation**: Modify `priorities` for each step
- **Maximum Values**: Change `maxAtCreation` limits
- **Freebie Costs**: Adjust `costs` per trait type
- **Available Options**: Update dropdown lists (Natures, Backgrounds, etc.)

## Architecture

```
module/character-creation/
├── wod-character-wizard.js      # Main wizard application
├── wizard-config.js             # Configuration for each actor type
├── utils/
│   └── validation.js            # Point validation logic
└── README.md                    # This file

templates/apps/
├── character-wizard.html        # Main wizard template
└── wizard-steps/
    ├── step-concept.html
    ├── step-attributes.html
    ├── step-abilities.html
    ├── step-advantages.html
    ├── step-freebies.html
    └── step-review.html

styles/
└── character-wizard.css         # Wizard UI styles
```

## Technical Details

### Data Storage

**Progress Saving:**
```javascript
actor.flags.wodsystem.wizardProgress = {
  currentStep: number,
  data: { /* wizard state */ }
};
```

**Completion Flag:**
```javascript
actor.system.isCreated = true;
```

### Key Classes

**WodCharacterWizard** - Main wizard FormApplication
- Manages wizard state
- Handles step navigation
- Validates input
- Applies final changes to actor

**WizardValidator** - Validation utility
- Per-step validation
- Point calculation
- Limit enforcement

### Integration Points

**wodsystem.js**
- Imports wizard
- Preloads templates
- Registers globally

**wod-actor-sheet.js**
- Displays wizard button
- Launches wizard
- Provides actor data

**template.json**
- `system.isCreated` flag
- Actor data structure

## Future Enhancements

Potential improvements:
- [ ] Import from character builder JSON
- [ ] Export character to PDF
- [ ] Pre-made archetypes/templates
- [ ] Random character generation
- [ ] Experience-based progression wizard
- [ ] Multi-language support

## Troubleshooting

**Wizard button doesn't appear:**
- Check `actor.system.isCreated` is `false`
- Verify actor type is supported

**Validation errors:**
- Ensure all required fields are filled
- Check point allocation is complete
- Review console for specific errors

**Progress not saving:**
- Check actor flags permission
- Verify wodsystem namespace

## Credits

Created for the World of Darkness System for Foundry VTT.

Following Mage: The Ascension 20th Anniversary Edition rules,
adaptable to all World of Darkness game lines.

