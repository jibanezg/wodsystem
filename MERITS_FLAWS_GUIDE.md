# Merit/Flaw Data Entry Guide

This guide will help you complete the `config/reference/merits_flaws.json` file using your `merits_and_flaws.md` source.

## Current Status
✅ **System is fully functional** with 9 merits and 8 flaws
✅ All features work: tooltips, click-to-chat, trie search
✅ Ready for testing in Foundry

## Master Index Reference

Lines 5843-6133 in `merits_and_flaws.md` contain the complete index of all merits and flaws with their costs and types.

### Merits Start: Line ~5843
### Flaws Start: Line ~5976

## JSON Entry Template

For each merit/flaw in the index, create an entry following this structure:

```json
{
  "id": "unique_lowercase_id",
  "name": "Exact Name from Index",
  "type": "Physical|Mental|Social|Supernatural",
  "category": "Merit" or "Flaw",
  "cost": [1, 3],
  "costDescription": "1 or 3 points",
  "description": "Brief description of the trait (1-2 sentences)",
  "gameEffects": "Mechanical effects, dice modifiers, difficulty changes, etc.",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "searchTerms": ["search", "terms", "for", "finding", "this"]
}
```

## Field Guidelines

### `id`
- Lowercase, underscores for spaces
- No special characters except underscore
- Keep under 50 characters
- Example: `dark_triad`, `acute_senses`, `too_tough_to_die`

### `name`
- Exact name from the master index
- Preserve capitalization and special characters
- Example: `"Stormwarden/Quantum Voyager"`

### `type`
- Must be one of: `Physical`, `Mental`, `Social`, `Supernatural`
- Exactly as shown in master index

### `category`
- Either `"Merit"` or `"Flaw"`

### `cost`
- Array of integers: `[1]`, `[3]`, `[1, 3]`, `[1, 2, 3, 4, 5]`
- Variable costs as array: `[2, 3, 4, 5]` for "2 to 5 points"

### `costDescription`
- Human-readable: `"1 point"`, `"1 or 3 points"`, `"2 to 5 points"`, `"7 points per dot"`

### `description`
- Keep under 500 characters
- Focus on what the trait IS, not mechanics
- Avoid page references

### `gameEffects`
- Keep under 300 characters
- Include: dice modifiers, difficulty changes, special rules
- Example: `"Adds three dice to Seduction rolls"`
- Example: `"Reduces difficulty by -2"`

### `keywords`
- 3-5 words related to the trait
- Lowercase
- Used for categorization
- Example: `["social", "manipulation", "charisma"]`

### `searchTerms`
- 5-10 words people might search for
- Lowercase
- Include synonyms and related concepts
- Example: `["dark", "triad", "narcissism", "manipulation", "sociopath"]`

## Quick Entry Process

1. **Open the master index** (lines 5843-6133)
2. **For each entry**, locate its description in the main text
3. **Extract key information**:
   - Name and cost from index
   - Description from main text
   - Mechanical effects (dice, difficulty, duration)
4. **Create JSON entry** following the template
5. **Add to appropriate array** (merits or flaws)

## Example: Adding a New Merit

Let's say you want to add "Iron Will" from line 5900:

```
Iron Will 3 Mental
```

1. **Find description** in main text (search for "Iron Will")
2. **Extract info**:
   - Cost: 3 points
   - Type: Mental
   - Description: "Tremendous willpower and self-control"
   - Effects: "+3 dice to resist mind control, bonus to Willpower rolls"

3. **Create entry**:
```json
{
  "id": "iron_will",
  "name": "Iron Will",
  "type": "Mental",
  "category": "Merit",
  "cost": [3],
  "costDescription": "3 points",
  "description": "You possess tremendous willpower and self-control, able to resist mental intrusion and control.",
  "gameEffects": "+3 dice to resist mind control and mental domination. Bonus dice to Willpower rolls in appropriate situations.",
  "keywords": ["mental", "willpower", "resistance", "mind"],
  "searchTerms": ["iron", "will", "willpower", "mental", "resistance", "control", "domination"]
}
```

4. **Add to merits array** in JSON file

## Testing Your Entries

After adding entries to the JSON:

1. **Reload Foundry**
2. **Open a character sheet**
3. **Add the merit/flaw name** to your character
4. **Hover over it** - tooltip should appear
5. **Click it** - should post to chat
6. **Verify formatting** - check chat card looks good

## Tips

- **Start with common merits/flaws** players use most
- **Batch similar entries** (all Physical merits together)
- **Keep descriptions concise** - players can reference books for full details
- **Focus on mechanics** in gameEffects field
- **Test frequently** - add 5-10 entries, then test

## Validation

Your JSON must be valid. Use a JSON validator if you get errors:
- https://jsonlint.com/
- Or run: `node -e "JSON.parse(require('fs').readFileSync('config/reference/merits_flaws.json'))"`

## Total Count Goal

Based on the master index, you should have approximately:
- **~150 merits** (rough estimate from index)
- **~120 flaws** (rough estimate from index)

Current: 9 merits, 8 flaws
Remaining: ~141 merits, ~112 flaws

---

## Need Help?

The system is **fully functional** with the current sample data. You can:
1. Test it now in Foundry
2. Add entries gradually as needed
3. Focus on merits/flaws your players actually use

The architecture supports adding more data anytime without system changes!

