# Chat Messages and Foundry Hooks

## Core Principle
**Chat messages exist outside the actor sheet context. Styles must be global, and Foundry's default displays can be intercepted and customized.**

## Chat Message Styling

### Critical Context Difference
**Chat messages are NOT inside `.wod.sheet.actor.Mortal` or any sheet context.**

This means:
- ❌ CSS variables defined in `.wod.sheet.actor.Mortal` are **NOT available** in chat messages
- ✅ Styles for chat messages must be **global** (defined at root level)
- ✅ Use **hardcoded color values** or reference similar global styles (like `.wod-reference-card`)

### Where to Place Chat Message Styles

**Location:** `styles/themes/mortal.css` (at root level, not inside `.wod.sheet.actor.Mortal`)

**Why:** Chat messages are global UI elements, not part of the actor sheet DOM structure.

**Process:**
1. **Check existing chat message patterns:**
   - Look for `.wod-reference-card`, `.wod-sphere-reference-card` in `styles/reference-system.css`
   - These are good examples of global chat message styles
   - Review their structure: gradients, borders, padding, shadows

2. **Reuse reference card patterns:**
   - Use similar gradient backgrounds: `linear-gradient(135deg, #f8f8f8 0%, #e0e0e0 100%)`
   - Use similar border styles: `border: 2px solid #color; border-left: 4px solid #color;`
   - Use similar box shadows: `box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);`
   - Use similar font families: `"Palatino Linotype", "Book Antiqua", Palatino, serif`

3. **Use hardcoded colors (not CSS variables):**
   - Chat messages can't access sheet-scoped CSS variables
   - Use the base theme colors directly (e.g., `#2D5016` for Mortal green)
   - Or use fallback values: `var(--wod-primary, #2D5016)` (fallback works, but variable won't)

**Example:**
```css
/* ✅ CORRECT - Global style, hardcoded colors, similar to reference cards */
.wod-initiative-card {
    background: linear-gradient(135deg, #f8f8f8 0%, #e0e0e0 100%);
    border: 2px solid #2D5016;
    border-left: 4px solid #2D5016;
    border-radius: 8px;
    padding: 16px;
    margin: 8px 0;
    font-family: "Palatino Linotype", "Book Antiqua", Palatino, serif;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* ❌ WRONG - Trying to use sheet-scoped variables (won't work) */
.wod-initiative-card {
    background: var(--wod-bg-subtle);  /* Variable not available in chat context */
    border-left: 4px solid var(--wod-primary);  /* Variable not available */
}
```

## Foundry Hooks for Chat Messages

### Hook Lifecycle for Custom Chat Messages

When creating custom chat message displays, use this hook sequence:

1. **`preCreateChatMessage`** - Intercept BEFORE creation
   - Use to: Delete `messageData.roll`, set initial `content`, add flags
   - Prevents Foundry from generating default roll display
   - Example: Set `messageData.content` to placeholder HTML structure

2. **`createChatMessage`** - Intercept AFTER creation
   - Use to: Update message content with final HTML, delete `roll` property
   - Access: `message` object (already created)
   - Example: `await message.update({ content: finalHTML, roll: null })`

3. **`renderChatMessageHTML`** - Intercept during rendering (NEW API)
   - Use to: Clean up DOM, remove Foundry's default elements
   - Access: `html` (HTMLElement, not jQuery)
   - Example: Remove `.dice-roll`, `.dice-result` elements

**Important:** `renderChatMessage` is deprecated. Always use `renderChatMessageHTML` instead.

### Pattern: Custom Roll Display

**Goal:** Replace Foundry's default roll display with custom HTML

**Steps:**
1. In `preCreateChatMessage`: Delete `messageData.roll` and set initial `content`
2. In `createChatMessage`: Update message with final custom HTML, set `roll: null`
3. In `renderChatMessageHTML`: Remove any remaining Foundry default elements

**Example:**
```javascript
// Step 1: preCreateChatMessage
Hooks.on("preCreateChatMessage", async (messageData, options, userId) => {
    if (isInitiativeRoll(messageData)) {
        delete messageData.roll;
        messageData.content = `<div class="wod-initiative-card">...</div>`;
    }
});

// Step 2: createChatMessage
Hooks.on("createChatMessage", async (message, options, userId) => {
    if (isInitiativeRoll(message)) {
        await message.update({
            content: `<div class="wod-initiative-card">${finalHTML}</div>`,
            roll: null
        });
    }
});

// Step 3: renderChatMessageHTML
Hooks.on("renderChatMessageHTML", (message, html, data) => {
    const $html = $(html);
    if ($html.find('.wod-initiative-card').length > 0) {
        // Remove Foundry's default roll elements
        html.querySelectorAll('.dice-roll').forEach(el => {
            if (!el.closest('.wod-initiative-card')) el.remove();
        });
    }
});
```

## Hiding Foundry's Default Elements

### Critical Rule: Always Protect Your Custom Elements

**⚠️ IMPORTANT:** When hiding Foundry's default elements, you MUST immediately create corresponding rules to ensure your custom elements remain visible. This is a common pitfall that causes custom elements to be hidden by your own CSS.

### The Pattern

**Step 1: Identify what Foundry generates**
- Foundry creates elements like `.dice-roll`, `.dice-result`, `.dice-formula`, etc.
- These appear in the DOM alongside your custom elements

**Step 2: Hide Foundry's elements with specific selectors**
- Target Foundry's elements specifically (e.g., `.dice-roll .dice-result`)
- Use `!important` to override Foundry's styles
- Be specific about what you're hiding

**Step 3: IMMEDIATELY create visibility rules for your custom elements**
- Your custom elements may use the same class names (e.g., `.dice-result`)
- Create MORE SPECIFIC selectors for your custom elements
- Use EQUAL OR HIGHER specificity than the hiding rules
- Place these rules AFTER the hiding rules in the CSS file

**Step 4: Verify visibility**
- Test that your custom elements are visible
- Check browser DevTools to ensure your rules are applied
- If hidden, increase selector specificity

### Solution: Aggressive CSS + DOM Cleanup

**CSS Approach:**
```css
/* Step 1: Hide default Foundry roll display - be specific about what you're hiding */
.chat-message:has(.wod-initiative-card) .dice-roll,
.chat-message:has(.wod-initiative-card) .dice-roll .dice-result,  /* Foundry's dice-result inside dice-roll */
.chat-message:has(.wod-initiative-card) .dice-formula,
.chat-message:has(.wod-initiative-card) .dice-total,
.chat-message:has(.wod-initiative-card) .dice {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* Step 2: IMMEDIATELY ensure your custom elements are visible */
/* Use EQUAL OR HIGHER specificity than the hiding rules above */
.chat-message:has(.wod-initiative-card) .wod-initiative-card .dice-result,  /* Your custom dice-result */
.chat-message:has(.wod-initiative-card) .wod-initiative-card .initiative-roll .dice-result {
    display: inline !important;
    visibility: visible !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* Alternative for browsers without :has() support */
.chat-message .wod-initiative-card ~ .dice-roll,
.chat-message .wod-initiative-card ~ .dice-result {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
}
```

**DOM Cleanup Approach:**
```javascript
// In renderChatMessageHTML hook
// CRITICAL: Always check if element is inside your custom container before removing
const diceRollElements = html.querySelectorAll('.dice-roll');
diceRollElements.forEach((el) => {
    // Make sure it's not part of our custom display
    if (!el.closest('.wod-initiative-card') && !el.closest('.wod-initiative-roll')) {
        el.remove();
    }
});

// When removing elements by class name, ALWAYS check parent container
messageElement.find('.dice-result').each(function() {
    const $el = $(this);
    // Skip if it's inside our custom initiative card
    if ($el.closest('.wod-initiative-card').length || $el.closest('.wod-initiative-roll').length) {
        return; // Skip this element - it's ours!
    }
    // Only remove Foundry's default elements
    $el.remove();
});

// Also use MutationObserver for dynamically added elements (e.g., Dice So Nice!)
const observer = new MutationObserver((mutations) => {
    // Check for new dice elements and remove them
});
observer.observe(html, { childList: true, subtree: true });
```

**Key Points:**
- **ALWAYS create visibility rules immediately after hiding rules** - don't forget this step!
- Use `!important` to override Foundry's styles
- Target multiple selectors (`.dice-roll`, `.dice-result`, `.dice-formula`, etc.)
- **Use EQUAL OR HIGHER specificity for showing rules than hiding rules**
- Be specific: hide Foundry's `.dice-roll .dice-result`, show your `.wod-initiative-card .dice-result`
- Use both `:has()` selector and sibling selectors for compatibility
- Clean up DOM in `renderChatMessageHTML` hook
- **CRITICAL: When cleaning up DOM elements, ALWAYS check if they're inside custom containers before removing them**
- Use `MutationObserver` to catch elements added after initial render
- **Test visibility immediately** - if your custom elements are hidden, increase selector specificity

## Message Update Pattern

### Problem
When updating a message with `message.update()`, Foundry may regenerate default elements.

### Solution
1. **Delete roll property:** Always set `roll: null` in update
2. **Delete from object:** `delete message.roll` after update
3. **Use hooks to clean up:** Let `renderChatMessageHTML` handle remaining cleanup

**Example:**
```javascript
await message.update({
    content: customHTML,
    roll: null  // Explicitly remove roll
});

// Also delete from object
if (message.roll) {
    delete message.roll;
}
```

## Reference Card Pattern

### When Creating New Chat Message Styles

**Always reference existing reference cards:**
- Check `styles/reference-system.css` for `.wod-reference-card` patterns
- Use similar structure: header, content sections, footer
- Use similar styling: gradients, borders, shadows, typography

**Key Elements to Match:**
- Gradient background: `linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)`
- Border style: `border: 2px solid #color; border-left: 4px solid #color;`
- Box shadow: `box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);`
- Font family: `"Palatino Linotype", "Book Antiqua", Palatino, serif`
- Header with border-bottom: `border-bottom: 2px solid #color;`
- Section backgrounds: Light gray with left border accent

## Checklist for Chat Message Features

- [ ] **Determined** if this is a chat message feature (not sheet feature)
- [ ] **Checked** `styles/reference-system.css` for similar patterns
- [ ] **Placed** styles in `mortal.css` at root level (not inside `.wod.sheet.actor`)
- [ ] **Used** hardcoded colors (not sheet-scoped CSS variables)
- [ ] **Matched** reference card styling patterns (gradients, borders, shadows)
- [ ] **Implemented** hook sequence: `preCreateChatMessage` → `createChatMessage` → `renderChatMessageHTML`
- [ ] **Added** CSS rules to hide Foundry's default elements
- [ ] **IMMEDIATELY added** CSS rules to ensure custom elements are visible (equal or higher specificity)
- [ ] **Verified** custom elements are visible in browser DevTools
- [ ] **Added** DOM cleanup in `renderChatMessageHTML` hook
- [ ] **In DOM cleanup: Checked parent container before removing elements** (prevent removing custom elements)
- [ ] **Used** `MutationObserver` for dynamically added elements
- [ ] **Set** `roll: null` when updating messages
- [ ] **Tested** that default Foundry display is hidden
- [ ] **Tested** that custom elements are visible and styled correctly
- [ ] **Documented lessons learned** if any new patterns emerged (see `02-lessons-learned-process.md`)

## Red Flags (Don't Do This)

❌ **Using CSS variables** from `.wod.sheet.actor` in chat message styles
❌ **Placing chat message styles** inside `.wod.sheet.actor.Mortal` selector
❌ **Only using CSS** to hide Foundry elements (also need DOM cleanup)
❌ **Forgetting to delete** `roll` property when updating messages
❌ **Using deprecated** `renderChatMessage` hook (use `renderChatMessageHTML`)
❌ **Not checking** existing reference card patterns before creating new styles
❌ **Creating hiding rules without immediately creating visibility rules** - This is a critical mistake!
❌ **Using lower specificity for showing rules than hiding rules** - Your custom elements will be hidden!
❌ **Not testing visibility** after adding CSS rules - Always verify in browser DevTools

## Remember

- **Chat messages = Global context** (not inside sheet DOM)
- **Hardcoded colors** for chat messages (variables not available)
- **Reference cards** are the pattern to follow
- **Three hooks** work together: preCreate → create → render
- **CSS + DOM cleanup** both needed to hide Foundry defaults
- **MutationObserver** catches dynamically added elements
