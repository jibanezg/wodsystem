# WoD System - Styles Architecture

## Quick Start

### "It's identity time for [Creature]!"

When you want to give a creature type its unique visual identity:

1. **Open** `styles/themes/[creature].css` (already created!)
2. **Activate** by adding to `system.json` styles array
3. **Refine** colors if needed
4. **Done!** The creature now has its own look

## Structure

```
styles/
├── core/
│   └── variables.css       # Base CSS variables
├── themes/
│   ├── mortal.css          # ✓ ACTIVE - Life greens
│   ├── technocrat.css      # ✓ ACTIVE - Tech blue/silver/steel
│   ├── vampire.css         # Template - Gothic reds/blacks
│   ├── werewolf.css        # Template - Earth browns
│   └── demon.css           # Template - Infernal purples/golds
└── mortal-sheet.css        # Shared layout for all sheets
```

## How It Works

1. **CSS Variables** define colors: `--wod-primary: #800000;`
2. **Theme files** override variables per creature
3. **No structure changes** - only colors change
4. **Easy to extend** - add new creature = add new theme

## Example: Activating Vampire Theme

### Step 1: system.json
```json
"styles": [
    "styles/core/variables.css",
    "styles/themes/mortal.css",
    "styles/themes/vampire.css",  // ADD THIS
    "styles/mortal-sheet.css"
]
```

### Step 2: Refresh
Press `Ctrl+Shift+R` in Foundry

### Step 3: Done!
Vampire sheets now have gothic red/black theme

## Theme Identities

| Creature   | Colors                      | Identity                    |
|------------|-----------------------------|-----------------------------|
| Mortal     | Greens, blacks              | Life, humanity, vitality    |
| Technocrat | Blue, silver, steel         | Technology, science, control|
| Vampire    | Reds, blacks, silver        | Gothic, undead, blood       |
| Werewolf   | Browns, earth tones         | Primal, beast, territorial  |
| Demon      | Purples, golds, blacks      | Infernal, corrupted, fallen |

## Full Documentation

See [THEMING_GUIDE.md](../../THEMING_GUIDE.md) for complete details.

