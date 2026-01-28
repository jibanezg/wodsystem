# Creature Type Implementation Checklist

## Core Principle
**When adding a new creature type, ALL required steps must be completed, including localization keys in BOTH language files.**

## Critical Pattern: Always Add Localization Keys

**When adding a new actor type, you MUST add localization keys in TWO places:**

1. **WODSYSTEM section** - For general creature type references
2. **TYPES.Actor section** - For Foundry's actor type system (CRITICAL - prevents "TYPES.Actor.CreatureName" display errors)

## Required Steps Checklist

When implementing a new creature type, follow this checklist in order:

### 1. Template Data Model (`template.json`)
- [ ] Add creature type to `Actor.types` array
- [ ] Add creature type definition to `Actor.creatureTypes` object
- [ ] Define all required traits, attributes, and advantages
- [ ] Add NPC variant if needed (e.g., `Creature-NPC`)

### 2. Localization Files (CRITICAL - DO NOT SKIP)
- [ ] Add creature type to `WODSYSTEM` section in `lang/en.json`
- [ ] Add creature type to `TYPES.Actor` section in `lang/en.json`
- [ ] Add creature type to `WODSYSTEM` section in `lang/es.json` (or other language files)
- [ ] Add creature type to `TYPES.Actor` section in `lang/es.json` (or other language files)
- [ ] Add NPC variant to `TYPES.Actor` if applicable
- [ ] Add all creature-specific UI labels (Faith, Torment, Lore, etc.)

**Pattern for TYPES.Actor:**
```json
"TYPES": {
  "Actor": {
    "CreatureName": "Creature Name",
    "CreatureName-NPC": "Creature Name (NPC)"
  }
}
```

### 3. Character Sheet Implementation
- [ ] Create character sheet class (`module/actor/template/[creature]-sheet.js`)
- [ ] Create HTML template (`templates/actor/[creature]-sheet.html`)
- [ ] Create required partials (header, advantages, etc.)
- [ ] **Preload ALL partials in `wodsystem.js`** - Add all partial paths to `loadTemplates()` call (CRITICAL - sheet won't render without this!)
- [ ] **Verify all template files exist** - Use `Test-Path` or file explorer to confirm all referenced templates/partials exist
- [ ] Register sheet in `wodsystem.js`
- [ ] **Add temporary console logging** - Add logs to `defaultOptions()`, `_render()`, `getData()`, and `activateListeners()` for debugging (remove after verification)

### 4. CSS Theming
- [ ] Create theme CSS file (`styles/themes/[creature].css`)
- [ ] Define color palette and CSS variables
- [ ] Theme ALL dialogs (see `03-dialog-theming-for-creature-types.md`)
- [ ] **Add chat message theming** - Add CSS for `.chat-message.actor-type-[creature]` in `mortal.css` (CRITICAL - prevents default Foundry styling)
- [ ] **Add hook to apply actor-type class** - Add `renderChatMessageHTML` hook in `wodsystem.js` to add `actor-type-[creature]` class to chat messages
- [ ] Add theme to `system.json` styles array

### 5. Wizard Support (if applicable)
- [ ] Add wizard configuration to `wizard-config.js`
- [ ] Update wizard step templates if needed
- [ ] Update `hasWizardSupport` in `wod-actor-sheet.js`

### 6. NPC Handling
- [ ] Update `getActorTypes` hook in `wodsystem.js` to filter NPC types
- [ ] Add disposition selector if needed
- [ ] Configure NPC-specific behavior

### 7. Reference Data Integration
- [ ] Update `ReferenceDataService` to load creature-specific data
- [ ] Implement filtering by `availableTo` property
- [ ] Add tooltip generation methods if needed
- [ ] Implement "Post to Chat" functionality

### 8. System Integration
- [ ] Filter abilities, merits/flaws, backgrounds by `availableTo`
- [ ] Update any creature-specific validation
- [ ] Test filtering works correctly

## Common Mistakes to Avoid

❌ **Forgetting TYPES.Actor localization** - This causes "TYPES.Actor.CreatureName" to display instead of the actual name
❌ **Only adding to one language file** - Must add to ALL language files (en.json, es.json, etc.)
❌ **Missing NPC variant in TYPES.Actor** - NPC types also need localization keys
❌ **Not checking existing creature types** - Look at how Technocrat, Mage, Spirit are implemented
❌ **Skipping dialog theming** - All dialogs need theme-specific overrides
❌ **Not filtering by availableTo** - Reference data must be filtered correctly
❌ **Forgetting chat message theming** - Chat messages need actor-type classes and CSS styling (prevents default Foundry grey styling)
❌ **Not preloading partials** - ALL partials used in the sheet template MUST be added to `loadTemplates()` in `wodsystem.js` (sheet won't render without this!)

## Verification Steps

After implementing a new creature type:

1. **Test actor creation:**
   - Create a new actor of the creature type
   - Verify the name displays correctly (not "TYPES.Actor.CreatureName")
   - Check NPC variant if applicable

2. **Test localization:**
   - Switch language (if multiple languages supported)
   - Verify all text displays correctly
   - Check that no localization keys are showing as raw strings

3. **Test character sheet:**
   - Open the character sheet
   - Verify theme colors are applied
   - Check all tabs and sections load correctly

4. **Test dialogs:**
   - Open all dialogs (Effect Manager, Roll Dialog, etc.)
   - Verify theme colors are applied (not default blue)
   - Check all buttons and inputs are styled correctly

5. **Test filtering:**
   - Verify only appropriate backgrounds/merits/flaws are available
   - Check creature-specific data loads correctly

6. **Debug if sheet doesn't render:**
   - Check browser console (F12) for errors
   - Verify console logs from `defaultOptions()`, `_render()`, `getData()`, `activateListeners()` appear
   - If no logs appear: Check sheet registration in `wodsystem.js`
   - If `getData()` fails: Check for missing data in `template.json` or `ReferenceDataService`
   - If partials fail: Verify all partials are in `loadTemplates()` and files exist
   - Check for JavaScript errors preventing sheet instantiation

## Example: Adding Demon Type

### Step 1: Template Data Model ✅
```json
{
  "Actor": {
    "types": ["Demon", "Demon-NPC", "Earthbound"],
    "creatureTypes": {
      "Demon": { ... }
    }
  }
}
```

### Step 2: Localization ✅
```json
// lang/en.json
{
  "WODSYSTEM": {
    "Demon": "Demon",
    "Earthbound": "Earthbound"
  },
  "TYPES": {
    "Actor": {
      "Demon": "Demon",
      "Demon-NPC": "Demon (NPC)",
      "Earthbound": "Earthbound"
    }
  }
}
```

### Step 3: Character Sheet ✅
- Created `demon-sheet.js`
- Created `demon-sheet.html`
- Registered in `wodsystem.js`

### Step 4: CSS Theming ✅
- Created `demon.css` and `earthbound.css`
- Added to `system.json`

### Step 5: Wizard Support ✅
- Added Demon config to `wizard-config.js`

## Lessons Learned

### Pattern: Missing TYPES.Actor Localization
**Problem:** When adding a new creature type, forgetting to add it to `TYPES.Actor` causes Foundry to display "TYPES.Actor.CreatureName" instead of the actual name.

**Action:** ALWAYS add the creature type to BOTH:
1. `WODSYSTEM` section (for general references)
2. `TYPES.Actor` section (for Foundry's actor type system)

**Context:** Any new actor type added to `template.json`

**Prevention:** Prevents localization key errors and ensures proper display in Foundry UI

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`)

### Pattern: Missing Chat Message Theming
**Problem:** When adding a new creature type, chat messages from that actor type use Foundry's default grey styling instead of theme-specific colors. This makes messages look generic and breaks the visual theme.

**Action:** ALWAYS:
1. Add `renderChatMessageHTML` hook in `wodsystem.js` to add `actor-type-[creature]` class to chat messages
2. Add CSS styles for `.chat-message.actor-type-[creature]` in `mortal.css` at root level (not inside `.wod.sheet.actor`)
3. Use hardcoded colors (CSS variables not available in chat context)
4. Style both `.message-content` and `.message-header` elements

**Context:** Any new actor type that sends chat messages

**Prevention:** Ensures chat messages match the creature type's visual theme

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`) and `01-chat-messages-and-foundry-hooks.md`

### Pattern: Debugging Character Sheets That Don't Render
**Problem:** When a character sheet doesn't render (blank window, no content, or doesn't open), it can be difficult to identify the root cause without systematic debugging.

**Action:** ALWAYS:
1. **Compare with working sheets** - If Mage/Technocrat work but new sheet doesn't, compare them line-by-line to find differences
2. **Simplify to match working pattern** - Start with the exact same structure as a working sheet (Mage/Technocrat), then add features incrementally
3. **Add temporary console logging** to key methods:
   - `defaultOptions()` - Verify sheet class is being queried
   - `getData()` - Verify data preparation works
   - `activateListeners()` - Verify rendering completed
   - **Don't override `_render()` unless necessary** - Mage/Technocrat don't override it
4. **Check browser console** (F12) for:
   - JavaScript errors
   - Missing template/partial errors
   - ReferenceDataService errors
5. **Verify file existence** - Use `Test-Path` or file explorer to confirm all templates/partials exist
6. **Check sheet registration** - Verify `Actors.registerSheet()` is called correctly in `wodsystem.js`
7. **Verify actor type matches** - Check the actor's type field matches exactly what's registered (case-sensitive)
8. **Verify partials are preloaded** - Check all partials used in template are in `loadTemplates()` call

**Context:** Any new character sheet that doesn't render or shows blank content

**Prevention:** Systematic debugging approach identifies the exact failure point (registration, template loading, data preparation, or rendering). Comparing with working sheets reveals structural differences.

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`)

### Pattern: Missing Partial Preloading
**Problem:** When adding a new creature type, forgetting to preload partials in `wodsystem.js` causes the character sheet to fail to render completely. Handlebars can't find the partials and the sheet appears broken or blank.

**Action:** ALWAYS:
1. List ALL partials used in the creature's sheet template (check `{{> "systems/..."}}` references)
2. Add ALL partial paths to the `loadTemplates()` call in `wodsystem.js` during the `init` hook
3. Verify the paths match exactly (case-sensitive, must include full path from `systems/wodsystem/`)

**Context:** Any new creature type with custom partials (header, advantages, lore, etc.)

**Prevention:** Ensures all Handlebars partials are available when the sheet renders

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`)

### Pattern: Missing Actor Type in template.json Types Array
**Problem:** When adding a new creature type, forgetting to add it to the `Actor.types` array in `template.json` causes Foundry to throw an error: `"CreatureName" is not a valid type for the Actor Document class`. The actor cannot be created or opened.

**Action:** ALWAYS:
1. Add the creature type to `Actor.types` array in `template.json` (e.g., `["Mortal", "Technocrat", "Demon", ...]`)
2. Add the creature type definition to `Actor.creatureTypes` object with proper structure
3. Add NPC variants to both `types` array and `creatureTypes` object if applicable
4. Verify JSON syntax is valid after changes

**Context:** Any new actor type added to the system

**Prevention:** Ensures Foundry recognizes the actor type as valid and allows actor creation/editing

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`)

### Pattern: Missing CSS Files in system.json
**Problem:** When adding a new creature type, forgetting to add the CSS theme file to `system.json`'s `styles` array causes the theme not to load, resulting in default Foundry styling or missing visual theme.

**Action:** ALWAYS:
1. Create the CSS theme file (`styles/themes/[creature].css`)
2. Add the path to `system.json`'s `styles` array in the correct order (before generic overrides, after base styles)
3. Verify the path is correct and file exists

**Context:** Any new creature type with a custom theme

**Prevention:** Ensures theme CSS is loaded and applied correctly

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`)

### Pattern: Missing disposition in NPC Types
**Problem:** When adding NPC variants, forgetting to add `disposition: "neutral"` to the `miscellaneous` object causes NPCs to not have a default disposition, which may cause issues with token behavior or NPC-specific features.

**Action:** ALWAYS:
1. Add `"disposition": "neutral"` to `miscellaneous` object in NPC type definitions
2. Compare with existing NPC types (Technocrat-NPC, Mage-NPC) to ensure consistency

**Context:** Any NPC variant of a creature type

**Prevention:** Ensures NPCs have proper default disposition settings

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`)

### Pattern: JSON Syntax Errors in template.json
**Problem:** When editing `template.json`, introducing syntax errors (missing commas, extra braces, mismatched brackets) causes the entire system to fail to load or actors to fail validation.

**Action:** ALWAYS:
1. Validate JSON after every edit using `python -m json.tool template.json` or a JSON validator
2. Pay special attention to:
   - Commas between object properties
   - Closing braces/brackets matching opening ones
   - No trailing commas in arrays/objects
3. Compare structure with existing creature types to ensure consistency
4. Test JSON validity before testing in Foundry

**Context:** Any edit to `template.json`

**Prevention:** Catches syntax errors before they break the system

**Where Documented:** This file (`04-creature-type-implementation-checklist.md`)

## Remember

- **TYPES.Actor is REQUIRED** - Foundry uses this for actor type labels
- **All language files** - Don't forget es.json or other languages
- **NPC variants too** - If you have `Creature-NPC`, it needs a key too
- **Check existing types** - Look at how Technocrat, Mage, Spirit are done
- **Test immediately** - Create an actor right after adding to verify localization works
