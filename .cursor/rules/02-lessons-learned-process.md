# Lessons Learned Process

## Core Principle
**Every successful implementation should result in refined or new rules that capture generalized, actionable lessons learned.**

## When to Document Lessons Learned

Document lessons learned **immediately after**:
- ✅ Successfully fixing a bug that took multiple iterations
- ✅ Solving a problem that required a different approach than initially attempted
- ✅ Discovering a pattern that could prevent similar issues in the future
- ✅ Finding a solution that required checking something that wasn't obvious initially

## What Makes a Good Lesson Learned

### ✅ Good Lessons Learned (Generalized, Actionable)
- **"When cleaning up DOM elements, always check if they're inside custom containers before removing them"**
  - Applies to: Any feature that hides Foundry's default elements
  - Actionable: Check parent container before removing
  - Prevents: Accidentally removing custom elements

- **"When hiding elements with CSS, immediately create visibility rules with equal or higher specificity"**
  - Applies to: Any feature that hides default UI elements
  - Actionable: Create showing rules right after hiding rules
  - Prevents: Custom elements being hidden by your own CSS

- **"Validate data before generating HTML, not after"**
  - Applies to: Any feature that generates dynamic HTML
  - Actionable: Calculate/validate all values before template generation
  - Prevents: Missing or incorrect data in rendered output

### ❌ Bad Lessons Learned (Too Specific, Not Actionable)
- ❌ "The initiative roll d10 result wasn't showing"
  - Too specific to one feature
  - Doesn't tell you what to do differently

- ❌ "Fixed the CSS for initiative cards"
  - Not generalized
  - Doesn't explain the pattern

## Structure of a Lesson Learned

Each lesson learned should include:

1. **The Pattern/Problem** (generalized)
   - What type of situation does this apply to?
   - Example: "When cleaning up DOM elements..."

2. **The Action** (concrete steps)
   - What specific check/validation/step should be done?
   - Example: "...always check if they're inside custom containers before removing"

3. **The Context** (when it applies)
   - What features/scenarios does this apply to?
   - Example: "Any feature that hides Foundry's default elements"

4. **The Prevention** (what it prevents)
   - What problem does following this lesson prevent?
   - Example: "Accidentally removing custom elements"

## Process for Documenting Lessons Learned

### Step 1: Identify the Lesson
After successfully solving a problem, ask:
- What step/check/validation could have prevented this issue?
- What pattern emerged that applies beyond this specific feature?
- What would I do differently next time to avoid this?

### Step 2: Generalize the Lesson
- Remove feature-specific details
- Focus on the pattern, not the implementation
- Make it applicable to similar situations

### Step 3: Add to Appropriate Rule File
- **CSS/Styling issues** → `00-style-features-rule.md` or `01-chat-messages-and-foundry-hooks.md`
- **DOM manipulation issues** → `01-chat-messages-and-foundry-hooks.md`
- **Data validation issues** → Create new rule or add to relevant existing rule
- **Process/workflow issues** → This file (`02-lessons-learned-process.md`)

### Step 4: Update Checklists
- Add the lesson to relevant checklists
- Ensure it's actionable (can be checked off)
- Place it in the logical order of the workflow

### Step 5: Test the Lesson
- When implementing the next similar feature, apply the lesson
- Verify it prevents the issue
- Refine if needed

## Example: From This Session

### Problem
The d10 result wasn't showing in the initiative roll display, even though it was in the HTML.

### Root Cause
The DOM cleanup function was removing ALL `.dice-result` elements, including our custom one inside `.wod-initiative-card`.

### Lesson Learned
**"When cleaning up DOM elements, always check if they're inside custom containers before removing them"**

**Pattern:** Any feature that needs to hide Foundry's default elements while keeping custom ones

**Action:** Before removing elements by class name, check their parent container:
```javascript
messageElement.find('.dice-result').each(function() {
    const $el = $(this);
    // Skip if it's inside our custom container
    if ($el.closest('.wod-initiative-card').length) {
        return; // Skip - it's ours!
    }
    // Only remove Foundry's default elements
    $el.remove();
});
```

**Prevention:** Prevents accidentally removing custom elements during cleanup

**Where Documented:** Added to `01-chat-messages-and-foundry-hooks.md` in the DOM Cleanup section

## Checklist for Documenting Lessons Learned

After successfully implementing a feature or fixing a bug:

- [ ] **Identified** the generalized pattern (not feature-specific)
- [ ] **Extracted** the actionable step/check/validation
- [ ] **Determined** what context/features this applies to
- [ ] **Clarified** what problem this prevents
- [ ] **Added** to appropriate rule file with example code
- [ ] **Updated** relevant checklists
- [ ] **Tested** the lesson on next similar feature (if applicable)

## Red Flags (Don't Do This)

❌ **Documenting feature-specific details** instead of generalized patterns
❌ **Skipping documentation** because "it's obvious" - it might not be next time
❌ **Documenting in code comments only** - rules files are the source of truth
❌ **Creating overly broad lessons** that aren't actionable
❌ **Forgetting to update checklists** - lessons should be checkable

## Remember

- **Lessons learned = Time saved in the future**
- **Generalized patterns = Reusable knowledge**
- **Actionable steps = Preventable mistakes**
- **Document immediately = Fresh context**
- **Update checklists = Built-in reminders**
