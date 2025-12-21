# WoD System - Theming Guide

## Overview

Each creature type in the World of Darkness system has a **unique visual identity** defined by color palettes, backgrounds, and styling. This guide explains the theming architecture and how to activate themes for new creature types.

## Architecture

### CSS Variables System

The theming system uses **CSS Custom Properties (variables)** to define colors, spacing, and visual elements. This allows:
- **Instant theme switching** - Change one variable, update entire sheet
- **Consistent structure** - Layout stays the same across creatures
- **Easy maintenance** - Update colors in one place
- **Scalability** - Add new creatures by adding new theme files

### File Structure

```
styles/
├── core/
│   └── variables.css       # Base CSS variables (default palette)
├── themes/
│   ├── mortal.css          # Mortal theme (✓ ACTIVE)
│   ├── technocrat.css      # Technocrat theme (✓ ACTIVE)
│   ├── vampire.css         # Vampire theme (future)
│   ├── werewolf.css        # Werewolf theme (future)
│   └── demon.css           # Demon theme (future)
└── mortal-sheet.css        # Shared styles for all sheets
```

## Creature Identities

### Mortal (✓ ACTIVE)
- **Identity**: Life, humanity, natural existence
- **Palette**: Forest greens, blacks, life tones
- **Primary**: `#2D5016` (forest green)
- **Feel**: Living, breathing, human vitality

### Vampire (FUTURE)
- **Identity**: Gothic, undead, bloodthirsty
- **Palette**: Blood reds, deep blacks, crimson
- **Primary**: `#8B0000` (blood red) on dark backgrounds
- **Feel**: Gothic, aristocratic, eternal night, undead

### Werewolf (FUTURE)
- **Identity**: Primal, beast, earthbound
- **Palette**: Rich browns, earth tones, fur colors
- **Primary**: `#6B4423` (leather brown)
- **Feel**: Primal, territorial, animalistic fury

### Demon (FUTURE)
- **Identity**: Infernal, corrupted, fallen angels
- **Palette**: Deep purples, burning golds, obsidian blacks
- **Primary**: `#4B0082` (indigo) with gold accents
- **Feel**: Dark majesty, twisted power, torment

### Technocrat (✓ ACTIVE)
- **Identity**: Technology, science, control
- **Palette**: Blue/Silver/Steel - corporate, clinical, precise
- **Primary**: `#4682B4` (steel blue)
- **Feel**: Enlightened science, cold technology, order

## How to Activate a Theme

### Step 1: Update system.json

Add the theme CSS file to the `styles` array:

```json
"styles": [
    "styles/core/variables.css",
    "styles/themes/mortal.css",
    "styles/themes/vampire.css",    // ADD THIS
    "styles/mortal-sheet.css"
]
```

### Step 2: Create Sheet-Specific CSS (if needed)

If the creature needs structure changes beyond color:

```css
/* styles/vampire-sheet.css */
.wod.sheet.actor.vampire {
    /* Creature-specific layout overrides */
}
```

### Step 3: Test the Theme

1. Refresh Foundry (Ctrl+Shift+R)
2. Create a new actor of that type
3. Verify colors and styling match the identity

### Step 4: Refine

Adjust CSS variables in `themes/[creature].css` to perfect the look.

## Available CSS Variables

### Colors
```css
--wod-primary              /* Main theme color */
--wod-primary-dark         /* Darker variant */
--wod-primary-light        /* Lighter variant */
--wod-bg-main              /* Main background */
--wod-bg-secondary         /* Secondary background */
--wod-border-main          /* Main borders */
--wod-text-main            /* Primary text */
--wod-danger               /* Danger/delete */
--wod-success              /* Success/add */
```

### Spacing
```css
--wod-spacing-xs to --wod-spacing-xl
--wod-radius-sm to --wod-radius-round
--wod-font-xs to --wod-font-xl
```

## Usage Examples

### Changing Primary Color
```css
.wod.sheet.actor.vampire {
    --wod-primary: #8b0000;  /* Blood red */
}
```

### Dark Theme
```css
.wod.sheet.actor.vampire {
    --wod-bg-main: #1a1a1a;
    --wod-text-main: #e0e0e0;  /* Light text on dark bg */
}
```

### Custom Accent
```css
.wod.sheet.actor.demon {
    --wod-accent-gold: #d4af37;  /* Rich gold accent */
}
```

## Workflow: "It's Identity Time for [Creature]"

When you say **"It's identity time for Demons"**, here's the process:

1. ✅ **Theme file already exists** (`styles/themes/demon.css`)
2. ✅ **Add to system.json** (activate the theme)
3. ✅ **Test in Foundry** (verify colors match creature identity)
4. ✅ **Refine** (adjust variables if needed)
5. ✅ **Document** (update this guide with final palette)

**That's it!** No need to rewrite structure or layout - just activate the theme and refine colors.

## Current Status

| Creature   | Theme File | Status     | Activated |
|------------|------------|------------|-----------|
| Mortal     | ✓          | Complete   | ✓ Yes     |
| Vampire    | ✓          | Template   | ✗ No      |
| Werewolf   | ✓          | Template   | ✗ No      |
| Demon      | ✓          | Template   | ✗ No      |

## Notes

- **Don't modify `variables.css`** directly - it's the default palette
- **Override in theme files** - each creature gets its own palette
- **Test on actual sheets** - colors look different in context
- **Consider accessibility** - ensure sufficient contrast
- **Document decisions** - explain why certain colors were chosen

---

**Ready for creature identities!** 🎨

