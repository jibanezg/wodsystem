# Style and Feature Implementation Rules

## Core Principle
**ALWAYS check existing styles and patterns BEFORE creating new ones. Work from what exists, don't create from scratch.**

## Documenting Lessons Learned
**After successfully implementing a feature or fixing a bug, document generalized lessons learned.** See `02-lessons-learned-process.md` for the process and guidelines.

## Decision Tree: Universal vs Creature-Specific

When implementing a new feature or style change, **ALWAYS** follow this decision process:

### Step 1: Determine Scope
Ask yourself:
- **Is this feature/style supposed to be applied to ALL creature types?**
  - ✅ YES → Use **generic/universal styles** (see Step 2A)
  - ❌ NO → Use **creature-specific styles** (see Step 2B)

### Step 2A: Universal Features (All Creatures)

**Location:** `styles/themes/mortal.css`

**Why:** `mortal.css` is the **base theme** that all creatures inherit from. Universal features should be defined here.

**Process:**
1. **Check existing patterns** in `styles/themes/mortal.css`:
   - Look for similar features (e.g., `.wod-roll-card` for roll displays)
   - Check CSS variable usage (`var(--wod-primary)`, `var(--wod-text)`, etc.)
   - Review existing structure and naming conventions

2. **Reuse existing styles:**
   - Use existing CSS variables (don't hardcode colors) **EXCEPT for chat messages** (see special case below)
   - Follow existing naming patterns (`.wod-*` prefix)
   - Match existing spacing, borders, and layout patterns

3. **Add to `mortal.css`:**
   - Place in appropriate section (ROLL SYSTEM, CHAT MESSAGES, etc.)
   - Use CSS variables for colors: `var(--wod-primary)`, `var(--wod-text)`, `var(--wod-background)`, etc.
   - **Exception:** Chat message styles must be global (not inside `.wod.sheet.actor`) and use hardcoded colors
   - Follow existing code style and formatting

**⚠️ Special Case - Chat Messages:**
If the feature is a **chat message** (not part of the actor sheet), it exists outside the `.wod.sheet.actor` context:
- Place styles at **root level** in `mortal.css` (not inside `.wod.sheet.actor.Mortal`)
- Use **hardcoded color values** (CSS variables from `.wod.sheet.actor` are not available)
- Reference `.wod-reference-card` patterns in `styles/reference-system.css` for styling
- See `01-chat-messages-and-foundry-hooks.md` for complete guide

**Example:**
```css
/* ✅ CORRECT - Uses existing variables and patterns */
.wod-initiative-roll {
    padding: 8px 12px;
    margin: 4px 0;
    background: rgba(255, 255, 255, 0.05);
    border-left: 3px solid var(--wod-primary);  /* Uses variable */
    border-radius: 4px;
}

/* ❌ WRONG - Hardcoded colors, doesn't use variables */
.wod-initiative-roll {
    padding: 8px 12px;
    background: #ffffff;
    border-left: 3px solid #2D5016;  /* Hardcoded color */
}
```

### Step 2B: Creature-Specific Features

**Location:** `styles/themes/[creature].css` (e.g., `technocrat.css`, `werewolf.css`)

**Why:** Creature-specific overrides go in their respective theme files.

**Process:**
1. **Check existing creature theme:**
   - Open `styles/themes/[creature].css`
   - Look for similar features or overrides
   - Check what variables are overridden for this creature

2. **Reuse existing patterns:**
   - Follow the same structure as `mortal.css` but with creature-specific variables
   - Only override what's different from the base
   - Use creature-specific CSS variables if they exist

3. **Add to creature theme:**
   - Place in the same section as the base (for consistency)
   - Override only what needs to be different
   - Document why it's different if not obvious

**Example:**
```css
/* In technocrat.css - only override what's different */
.wod-initiative-roll {
    border-left-color: var(--wod-primary);  /* Uses technocrat's blue */
    /* Other properties inherit from mortal.css */
}
```

## File Structure Reference

```
styles/
├── core/
│   └── variables.css          # Base CSS variables (rarely modify)
├── themes/
│   ├── mortal.css             # ✅ BASE - Universal styles for ALL creatures
│   ├── technocrat.css         # Technocrat-specific overrides
│   ├── werewolf.css           # Werewolf-specific overrides
│   └── [creature].css         # Other creature-specific overrides
└── mortal-sheet.css           # Shared layout (structure, not colors)
```

## Common Patterns to Reuse

### CSS Variables (Always Use These)
- `var(--wod-primary)` - Primary color (changes per creature)
- `var(--wod-text)` - Text color
- `var(--wod-background)` - Background color
- `var(--wod-accent)` - Accent color
- `var(--wod-border-main)` - Border color
- See `styles/themes/mortal.css` for full list

### Existing Style Patterns
- **Roll displays:** `.wod-roll-card`, `.wod-roll-flavor`
- **Chat messages:** `.wod-initiative-card`, `.wod-reference-card`, `.wod-approval-request`
- **Dialogs:** `.wod-dialog`, `.wod-form-group`
- **Buttons:** `.wod-button`, `.wod-button-primary`
- **Badges:** `.trait-badge`, `.modifier-badge`

### Special Case: Chat Messages
**⚠️ IMPORTANT:** Chat messages exist outside the actor sheet context. See `01-chat-messages-and-foundry-hooks.md` for detailed rules about:
- Global styles (not inside `.wod.sheet.actor`)
- Hardcoded colors (CSS variables not available)
- Foundry hooks for intercepting messages
- Hiding Foundry's default roll displays

## Checklist Before Adding Styles

- [ ] **Checked** `styles/themes/mortal.css` for existing similar styles
- [ ] **Determined** if feature is universal or creature-specific
- [ ] **Located** the correct file (mortal.css or creature.css)
- [ ] **Reused** existing CSS variables instead of hardcoding colors
- [ ] **Followed** existing naming conventions (`.wod-*` prefix)
- [ ] **Matched** existing spacing, borders, and layout patterns
- [ ] **Placed** new styles in the appropriate section
- [ ] **Documented** any creature-specific overrides if needed

## Red Flags (Don't Do This)

❌ **Creating new CSS files** without checking if styles belong in existing files
❌ **Hardcoding colors** instead of using CSS variables
❌ **Duplicating styles** that already exist
❌ **Ignoring existing patterns** and creating from scratch
❌ **Putting universal styles** in creature-specific files
❌ **Putting creature-specific styles** in mortal.css without override pattern

## Example Workflow

**Scenario:** Adding a new "Health Status" display

1. **Check scope:** Should this be visible for all creatures? → YES (universal)
2. **Check existing:** Look in `mortal.css` for similar displays (e.g., `.wod-roll-card`)
3. **Reuse pattern:** Use similar structure, spacing, and CSS variables
4. **Add to mortal.css:** Place in appropriate section, use `var(--wod-*)` variables
5. **Done:** All creatures now have the feature with their own colors

**Scenario:** Technocrat-specific "Paradox Wheel" styling

1. **Check scope:** Is this only for Technocrats? → YES (creature-specific)
2. **Check existing:** Look in `technocrat.css` for similar overrides
3. **Reuse pattern:** Follow the override pattern from mortal.css
4. **Add to technocrat.css:** Only override what's different (colors, maybe spacing)
5. **Done:** Technocrats have custom styling, others use base

## Remember

- **Mortal.css = Universal/Base** (for all creatures)
- **Creature.css = Specific Overrides** (only what's different)
- **Always check first, create second**
- **Variables over hardcoded values**
- **Patterns over new structures**
