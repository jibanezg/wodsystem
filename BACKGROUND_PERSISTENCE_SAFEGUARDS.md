# Background Persistence Safeguards

## Issue
Backgrounds data was occasionally being lost from actor sheets. This document outlines the safeguards that have been implemented to prevent this issue.

## Root Causes Identified

1. **Foundry Form Submission**: Foundry's default form handling can overwrite array data when only a subset of items are visible (due to pagination).
2. **Race Conditions**: Multiple simultaneous updates could potentially overwrite each other.
3. **Type Corruption**: In rare cases, backgrounds could be set to null, undefined, or non-array values.

## Safeguards Implemented

### 1. Form Submission Protection (`wod-actor-sheet.js`)
**Location**: `_onChangeInput()` method

```javascript
// Ignore background field changes in form submission
if (fieldName.startsWith("system.miscellaneous.backgrounds.")) {
    return; // Skip default form processing
}
```

**Why**: Prevents Foundry's form handling from overwriting the full backgrounds array when only paginated items are visible.

### 2. Pre-Update Validation (`wod-actor.js`)
**Location**: `_preUpdate()` method

```javascript
// Protect backgrounds from being accidentally deleted or set to invalid values
if (changed.system?.miscellaneous?.backgrounds !== undefined) {
    const newBackgrounds = changed.system.miscellaneous.backgrounds;
    
    // If trying to set to null, undefined, or non-array, preserve current
    if (!Array.isArray(newBackgrounds)) {
        console.warn(`Attempted to update backgrounds to invalid type, preserving current backgrounds`);
        changed.system.miscellaneous.backgrounds = currentBackgrounds;
    }
    // Log if backgrounds are being cleared
    else if (newBackgrounds.length === 0 && currentBackgrounds.length > 0) {
        console.warn(`Backgrounds being cleared (had ${currentBackgrounds.length} entries)`);
    }
}
```

**Why**: Catches any attempt to set backgrounds to an invalid value before it reaches the database.

### 3. Migration Protection (`wod-actor.js`)
**Location**: `_migrateBackgrounds()` method

```javascript
// Always ensure backgrounds is an array
if (!Array.isArray(this.system.miscellaneous.backgrounds)) {
    console.warn(`backgrounds was not an array, resetting to empty array`);
    this.system.miscellaneous.backgrounds = [];
}
```

**Why**: Ensures backgrounds is always an array, even if corrupted data is loaded.

### 4. Operation-Level Validation (`wod-actor-sheet.js`)
**Locations**: 
- `_onAddBackground()`
- `_onDeleteBackground()`
- `_onBackgroundNameChange()`
- `_updateBackground()`

```javascript
// Validate before every background operation
if (!Array.isArray(currentBackgrounds)) {
    console.error(`Cannot perform operation - backgrounds is not an array!`);
    ui.notifications.error('Background data corruption detected. Please reload.');
    return;
}
```

**Why**: Prevents operations from proceeding if data is in an invalid state, alerts the user immediately.

### 5. Defensive Data Access
**Location**: Throughout `wod-actor-sheet.js`

```javascript
// Always provide fallback to empty array
const backgrounds = this.actor.system.miscellaneous?.backgrounds || [];
```

**Why**: Prevents crashes if backgrounds is undefined or null.

## Debugging Tool

A debugging script has been provided at `scripts/debug_backgrounds.js` that can be loaded in the console to log all background-related updates:

```javascript
// Run this in the console to enable debugging
game.wod.loadScript('scripts/debug_backgrounds.js');
```

This will log:
- All updates that affect backgrounds
- The before and after state
- Stack traces to identify where updates originate

## Best Practices for Future Development

1. **Always use `foundry.utils.duplicate()`** when modifying arrays
2. **Never modify `this.actor.system.miscellaneous.backgrounds` directly** - always use `actor.update()`
3. **Validate array type** before operations
4. **Use dedicated handlers** for background operations (don't rely on form submission)
5. **Test with pagination** - ensure operations work when backgrounds span multiple pages

## Monitoring

The system now logs warnings when:
- Backgrounds are set to invalid types (automatic recovery)
- Backgrounds are completely cleared (may indicate a bug)
- Background operations fail due to data corruption

Check the browser console for these warnings if backgrounds disappear.

## Recovery

If a user experiences background data loss:

1. **Immediate**: Reload the actor sheet - the migration system will ensure backgrounds is at least an empty array
2. **Data Recovery**: Check Foundry's document history (right-click actor → "Show Document Permissions" → click ID to see history)
3. **Last Resort**: Restore from a world backup

## Technical Notes

- Backgrounds are stored at `system.miscellaneous.backgrounds` as an array of `{name, value, customName?, locked?}` objects
- Pagination displays 9 backgrounds per page
- Updates use `{ render: false }` option when possible to avoid unnecessary re-renders
- The system properly handles both `system.miscellaneous.backgrounds` and `system.backgroundsExpanded` arrays
