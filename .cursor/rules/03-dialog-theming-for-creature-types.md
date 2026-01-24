# Dialog Theming for Creature Types

## Core Principle
**When adding a new creature type, ALL dialogs must have theme-specific styles to override hardcoded colors in `foundry-dialog-override.css`.**

## The Problem

The file `styles/themes/foundry-dialog-override.css` contains **hardcoded blue colors** (`#4682B4`, `#2F4F6F`, etc.) that are applied to all dialogs by default. These colors work for Technocrat (which uses blue), but new creature types (like Mage with purple) need to override these values.

## Critical Pattern: Always Compare with Existing Creature Type

**Before implementing dialog styles for a new creature type, ALWAYS:**

1. **Check what Technocrat has** (or the most similar existing creature type)
2. **Identify all dialog elements** that need theme-specific colors
3. **Create equivalent styles** for the new creature type with their theme colors
4. **Use the same selector patterns** but with the new creature type class

## Elements That Must Be Themed

When adding a new creature type, you MUST override styles for these dialog elements:

### 1. Dialog Window Header
**Location:** `.window-header` inside the dialog window

**Problem:** `foundry-dialog-override.css` has:
```css
.app.dialog .window-header,
.window-app.dialog .window-header {
    background: linear-gradient(135deg, #4682B4 0%, #2F4F6F 100%) !important;
}
```

**Solution:** Override with creature-specific selectors:
```css
/* For Mage */
.window-app.mage.effect-manager .window-header,
.window-app.Mage.effect-manager .window-header,
.app.dialog.mage.effect-manager .window-header,
.app.dialog.Mage.effect-manager .window-header,
.window-app.mage.equipment-effects-dialog .window-header,
.window-app.Mage.equipment-effects-dialog .window-header,
.app.dialog.mage.equipment-effects-dialog .window-header,
.app.dialog.Mage.equipment-effects-dialog .window-header,
.window-app.mage.roll-dialog .window-header,
.window-app.Mage.roll-dialog .window-header,
.app.dialog.mage.roll-dialog .window-header,
.app.dialog.Mage.roll-dialog .window-header {
    background: linear-gradient(135deg, var(--wod-primary, #7B2CBF) 0%, var(--wod-primary-dark, #5A189A) 100%) !important;
}
```

**Key Points:**
- Include BOTH `.mage` (lowercase) and `.Mage` (capitalized) - Foundry may capitalize
- Include the dialog class (`.effect-manager`, `.equipment-effects-dialog`, `.roll-dialog`)
- Use `!important` to override hardcoded values
- Use CSS variables with fallback colors

### 2. Window Content Headers (h3, h4)

**Problem:** `foundry-dialog-override.css` has:
```css
.app.dialog .window-content h3,
.window-app.dialog .window-content h3 {
    background: linear-gradient(135deg, #4682B4 0%, #2F4F6F 100%) !important;
}
```

**Solution:** Override with creature-specific selectors:
```css
.app.dialog.Mage .window-content h3,
.window-app.dialog.Mage .window-content h3,
.window-app.Mage .window-content h3,
.app.dialog.mage .window-content h3,
.window-app.dialog.mage .window-content h3,
.window-app.mage .window-content h3 {
    background: linear-gradient(135deg, var(--wod-primary) 0%, var(--wod-primary-dark) 100%) !important;
    color: white !important;
}
```

### 3. Section Headers Within Dialogs

**Problem:** Section headers (like "BASIC INFORMATION", "EFFECT TYPE") use the general `.window-content h3` styles.

**Solution:** Add more specific selectors for section headers:
```css
/* Effect Manager section headers */
.app.dialog.Mage form.wod-effect-manager .effect-header-section h3,
.app.dialog.Mage form.wod-effect-manager .effect-metadata-section h3,
.app.dialog.Mage form.wod-effect-manager .effect-conditions-section h3,
.window-app.Mage .window-content form.wod-effect-manager .effect-header-section h3,
.window-app.mage .window-content form.wod-effect-manager .effect-header-section h3,
/* ... more selectors ... */
{
    background: linear-gradient(135deg, var(--wod-primary) 0%, var(--wod-primary-dark) 100%) !important;
    color: white !important;
    padding: 8px 12px !important;
    border-radius: 3px !important;
    margin: 0 0 12px 0 !important;
    text-align: center !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
}
```

**Key Points:**
- Include `.window-content` in the selector chain for higher specificity
- Include both form-level and window-level selectors
- Match the structure of existing creature type styles

### 4. Dialog Buttons (Save, Cancel, etc.)

**Problem:** `foundry-dialog-override.css` has:
```css
form.wod-effect-manager .save-effect,
form.wod-equipment-effects-dialog .dialog-buttons .save-effect {
    background: #28a745 !important;  /* Green */
}
```

**Solution:** Override with creature-specific selectors:
```css
.window-app.Mage form.wod-effect-manager .save-effect,
.window-app.mage form.wod-effect-manager .save-effect,
form.wod-effect-manager.mage .save-effect,
.app.dialog.Mage form.wod-effect-manager .save-effect,
.app.dialog.mage form.wod-effect-manager .save-effect {
    background: var(--wod-primary) !important;
    color: white !important;
}
```

### 5. Interactive Elements (Chips, Badges, etc.)

**Problem:** Elements like trait chips, total pool values, etc. have hardcoded blue colors.

**Solution:** Override with creature-specific selectors:
```css
.app.dialog.Mage .trait-chip,
.window-app.dialog.Mage .trait-chip,
.window-app.Mage form.wod-roll-dialog .trait-chip {
    background: linear-gradient(135deg, var(--wod-primary) 0%, var(--wod-primary-dark) 100%) !important;
}

.app.dialog.Mage .total-pool strong,
.window-app.dialog.Mage .total-pool strong,
.window-app.Mage form.wod-roll-dialog .total-pool strong {
    color: var(--wod-primary) !important;
}
```

## Dialogs That Need Theming

When adding a new creature type, check and theme these dialogs:

1. **Effect Manager** (`wod-effect-manager`)
   - Window header
   - Section headers (effect-header-section, effect-metadata-section, effect-conditions-section)
   - Buttons (save-effect, cancel-effect, add-modifier-row)
   - Input focus states

2. **Equipment Effects Dialog** (`wod-equipment-effects-dialog`)
   - Window header
   - Effect header section h3
   - Tabs container
   - Active tab
   - Form labels
   - Effect section background
   - Buttons (save-effect, cancel-effect, file-picker-group button)
   - Intensity slider thumb
   - Input focus states

3. **Roll Dialog** (`wod-roll-dialog`)
   - Window header
   - Pool summary h3
   - Roll config h3
   - Trait chips
   - Total pool strong
   - Active effects section h4
   - Effects category labels
   - Effect item optional borders
   - Buttons (roll-button, cancel-button)

4. **ST Approval Dialog** (`wod-st-approval-dialog`)
   - Window header
   - Buttons (approve-button, deny-button)

## Process for Adding Dialog Theming

### Step 1: Identify All Dialogs
- List all dialogs that the creature type will use
- Check `module/apps/` for dialog classes
- Check `templates/apps/` for dialog templates

### Step 2: Compare with Existing Creature Type
- Open the existing creature type's CSS file (e.g., `technocrat.css`)
- Find all dialog-related styles
- Note the selector patterns used
- Note which elements are styled

### Step 3: Check foundry-dialog-override.css
- Search for hardcoded colors (`#4682B4`, `#2F4F6F`, `#28a745`, etc.)
- Identify which elements use these colors
- Note the selector patterns

### Step 4: Create Override Styles
- Copy the selector patterns from Technocrat (or existing creature type)
- Replace creature type class (e.g., `.technocrat` → `.mage`)
- Replace colors (e.g., blue → purple for Mage)
- Add `!important` to override hardcoded values
- Include BOTH `.mage` and `.Mage` variants
- Include dialog-specific classes (`.effect-manager`, `.equipment-effects-dialog`, etc.)

### Step 5: Test Each Dialog
- Open each dialog for the new creature type
- Verify all elements use the correct theme colors
- Check window header, section headers, buttons, inputs, etc.
- Compare side-by-side with existing creature type if possible

## Selector Specificity Strategy

**Problem:** Hardcoded styles in `foundry-dialog-override.css` use `!important`, so your overrides must be MORE specific.

**Solution:** Build selector chains that are more specific:

```css
/* ❌ NOT SPECIFIC ENOUGH - won't override */
.window-app.mage .window-header {
    background: var(--wod-primary) !important;
}

/* ✅ SPECIFIC ENOUGH - includes dialog class */
.window-app.mage.effect-manager .window-header,
.window-app.Mage.effect-manager .window-header {
    background: linear-gradient(135deg, var(--wod-primary) 0%, var(--wod-primary-dark) 100%) !important;
}
```

**Key Points:**
- Include the dialog class (`.effect-manager`, `.equipment-effects-dialog`, etc.)
- Include both lowercase and capitalized creature type
- Include both `.app.dialog` and `.window-app` variants
- Include `.window-content` in the chain when targeting content elements
- Use `!important` to match the specificity of hardcoded styles

## Common Patterns

### Pattern 1: Window Header
```css
.window-app.[creature].effect-manager .window-header,
.window-app.[Creature].effect-manager .window-header,
.app.dialog.[creature].effect-manager .window-header,
.app.dialog.[Creature].effect-manager .window-header {
    background: linear-gradient(135deg, var(--wod-primary) 0%, var(--wod-primary-dark) 100%) !important;
}
```

### Pattern 2: Section Headers
```css
.app.dialog.[Creature] form.wod-effect-manager .effect-header-section h3,
.window-app.[Creature] .window-content form.wod-effect-manager .effect-header-section h3,
.app.dialog.[creature] form.wod-effect-manager .effect-header-section h3,
.window-app.[creature] .window-content form.wod-effect-manager .effect-header-section h3 {
    background: linear-gradient(135deg, var(--wod-primary) 0%, var(--wod-primary-dark) 100%) !important;
    color: white !important;
    /* ... other styles ... */
}
```

### Pattern 3: Buttons
```css
.window-app.[Creature] form.wod-effect-manager .save-effect,
.window-app.[creature] form.wod-effect-manager .save-effect,
form.wod-effect-manager.[creature] .save-effect,
.app.dialog.[Creature] form.wod-effect-manager .save-effect,
.app.dialog.[creature] form.wod-effect-manager .save-effect {
    background: var(--wod-primary) !important;
    color: white !important;
}
```

## Checklist for Adding New Creature Type Dialog Theming

- [ ] **Identified** all dialogs used by the creature type
- [ ] **Compared** with existing creature type (Technocrat) to see what's styled
- [ ] **Checked** `foundry-dialog-override.css` for hardcoded colors
- [ ] **Created** window header overrides for each dialog type
- [ ] **Created** window-content h3 and h4 overrides
- [ ] **Created** section header overrides (effect-header-section, etc.)
- [ ] **Created** button overrides (save-effect, cancel-effect, etc.)
- [ ] **Created** interactive element overrides (trait-chip, total-pool, etc.)
- [ ] **Used** both `.creature` and `.Creature` variants (lowercase and capitalized)
- [ ] **Used** both `.app.dialog` and `.window-app` variants
- [ ] **Included** dialog-specific classes (`.effect-manager`, `.equipment-effects-dialog`, etc.)
- [ ] **Added** `!important` to override hardcoded values
- [ ] **Used** CSS variables with fallback colors
- [ ] **Tested** each dialog to verify all elements use correct theme colors
- [ ] **Compared** side-by-side with existing creature type if possible

## Red Flags (Don't Do This)

❌ **Forgetting to theme dialogs** - assuming they'll automatically use creature colors
❌ **Only using lowercase** creature type class - Foundry may capitalize
❌ **Not including dialog class** in selectors - won't be specific enough
❌ **Not using `!important`** - hardcoded styles will win
❌ **Not checking foundry-dialog-override.css** - missing hardcoded colors
❌ **Not comparing with existing creature type** - missing elements that need theming
❌ **Only theming one dialog** - all dialogs need theme-specific styles

## Remember

- **foundry-dialog-override.css has hardcoded blue colors** - must override for new creature types
- **Always compare with Technocrat** (or most similar existing creature type)
- **Use very specific selectors** with dialog classes included
- **Include both `.creature` and `.Creature`** variants
- **Test each dialog individually** - don't assume they all work
- **Use `!important`** to match hardcoded style specificity
- **Document lessons learned** if new patterns emerge
