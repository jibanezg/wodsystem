# World of Darkness System for Foundry VTT

A Foundry VTT game system built to deliver the full **World of Darkness 20th Anniversary Edition** experience at the table. The goal is a living, growing platform — accurate to WoD rules, deeply integrated with Foundry's canvas and document layers, and extensible enough to support the full breadth of the setting as the system matures.

> **Compatibility:** Foundry VTT 13.x | **Languages:** English, Spanish | **Author:** jibanezg

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Character Types](#character-types)
- [Dice System](#dice-system)
- [Trigger System](#trigger-system)
  - [Events](#events)
  - [Conditions](#conditions)
  - [Actions](#actions)
  - [Step-by-Step Guide](#trigger-system-step-by-step-guide)
- [Token Manager](#token-manager)
- [Effects System](#effects-system)
- [Character Creation Wizard](#character-creation-wizard)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Roadmap](#roadmap)

---

## Features

### Currently Available

| Area | What's Included |
|---|---|
| **Character System** | Six playable supernatural types (Mortal, Mage, Technocrat, Spirit, Demon, Earthbound) with type-specific sheets, dot-based traits, and dedicated NPC variants |
| **WoD Dice Engine** | Accurate 20th Anniversary pool-based rolling — difficulty, specialties, auto-successes, botch detection, ST approval flow |
| **Trigger System** | Event-driven scene automation across tiles, regions, walls, actors, lights, and scenes — 24 event types, 8 condition types, 13+ action types |
| **Token Manager** | Rule-based visual overlays on tokens (opacity, tint, scale) reacting to illumination, health thresholds, active effects, and more |
| **Effects Engine** | Core WoD effects, status effects, and equipment-sourced effects with full management UI |
| **Character Wizard** | Guided step-by-step character creation for all six playable types with validation |
| **Localization** | English and Spanish included |

### Planned

| Area | Notes |
|---|---|
| **Combat System** | WoD initiative, damage resolution, soak rolls, and combat maneuvers integrated with the sheet and dice engine |
| *More to come* | The system grows alongside the campaign — expect new character capabilities, UI improvements, and deeper Foundry integrations over time |

---

## Installation

### Option A — Manifest URL (Recommended)

1. Open Foundry VTT and go to **Configuration > Game Systems**.
2. Click **Install System**.
3. Paste the manifest URL:
   ```
   https://raw.githubusercontent.com/jibanezg/wodsystem/main/system.json
   ```
4. Click **Install**, then create or open a world using **World of Darkness System**.

### Option B — Manual

1. Download the latest release from [GitHub](https://github.com/jibanezg/wodsystem).
2. Extract the folder into your Foundry `Data/systems/` directory so the path is `Data/systems/wodsystem/`.
3. Restart Foundry VTT.

### Option C — Git Clone

```bash
cd /path/to/FoundryVTT/Data/systems/
git clone https://github.com/jibanezg/wodsystem.git
```

### First-Time Setup

After creating your world:

1. Go to **Game Settings > Configure Settings > System Settings**.
2. Enable **Debug Mode** if you are a developer or want verbose logging.
3. Optionally configure the login video splash and other UI options.

---

## Character Types

The system supports **six playable types** and four NPC variants:

| Type | Description | Unique Mechanics |
|---|---|---|
| **Mortal** | Baseline human characters | Virtues, Humanity, Numina |
| **Mage** | Mystical wielders of Spheres | Sphere ratings, Arete, Quintessence, Paradox |
| **Technocrat** | Technology-focused mages | Device/enhancement tracking, technology Spheres |
| **Spirit** | Spirit entities | Essence pool (Willpower + Rage + Gnosis), Charms |
| **Demon** | Fallen angels | Torment, Apocalyptic Form, Lore system |
| **Earthbound** | Bound demon variants | Bound-specific mechanics, Apocalyptic Form |

NPC versions of Mortal, Technocrat, Mage, and Demon are also available as simplified actor types.

### Creating a Character

1. In the **Actors** directory, click **Create Actor**.
2. Choose the desired type (Mortal, Mage, Technocrat, Spirit, Demon, or Earthbound).
3. The sheet opens automatically with all traits initialized from templates.
4. Use the **Character Creation Wizard** (wand icon on the sheet header) for guided setup.

### Character Sheet Layout

All sheets share a common structure:

- **Header** — Name, portrait, concept, chronicle
- **Attributes** — Physical / Social / Mental in the classic 3×3 grid (1–5 dots)
- **Abilities** — Talents, Skills, and Knowledges
- **Advantages** — Backgrounds and type-specific pools
- **Health Track** — Bashing / Lethal / Aggravated damage
- **Active Effects** — Current modifiers from spells, equipment, and conditions
- **Biography** — Backstory, appearance, notes

Type-specific tabs appear automatically based on character type (e.g., Spheres for Mage, Essence for Spirit, Lore for Demon).

---

## Dice System

The dice engine implements **WoD 20th Anniversary Edition** pool mechanics exactly.

### Core Rules

- Roll a number of **d10s** equal to your dice pool.
- Each die that meets or exceeds the **difficulty** (default 6) counts as one success.
- Each **1** cancels one success.
- **Botch**: No successes rolled *and* at least one 1 showing (successes cancelled by 1s = failure, not a botch — correctly per WoD 20th).
- **Specialty**: When active, rolls of **10** count as two successes instead of one.

### Making a Roll

1. Click any **attribute or ability dot** on a character sheet.
2. The **Roll Dialog** opens, showing your current pool.
3. Adjust the following if needed:
   - **Pool Bonus** — Add or subtract dice.
   - **Difficulty** — Change the target number (2–10).
   - **Specialty** — Toggle 10s as double successes.
   - **Auto-Successes / Auto-Fails** — Apply automatic modifiers.
4. Click **Roll** to send the result to chat.
5. If the **Storyteller Approval** setting is on, the ST sees the roll before it resolves.

### Roll Results in Chat

Each roll card shows:
- Individual die results with colour-coding (success / failure / botch die / specialty)
- Total successes
- Final outcome (Success / Failure / Botch)

---

## Trigger System

The Trigger System is a **scene automation engine** built into the system. It lets you react to in-game events — token movement, door changes, combat rounds, light state, and more — and automatically execute actions like showing or hiding tiles, sending chat messages, toggling lights, or running macros. No external modules required.

Triggers are stored as flags directly on **scene documents**: Tiles, Regions, Walls, Actors, Ambient Lights, and the Scene itself.

### Architecture Overview

```
Event detected by TriggerManager (Foundry hooks)
    → Conditions evaluated by ConditionEvaluator
        → Actions executed by TriggerActionExecutor
            → Targets resolved from scene documents
```

### Events

The trigger can fire on any of the following events, grouped by document type:

#### Movement Events (Tile / Region)
| Event | Description |
|---|---|
| `onEnter` | A token enters the tile or region |
| `onExit` | A token exits the tile or region |
| `onProximity` | A token comes within a configurable distance |
| `onEffect` | An effect is applied to a token inside the area |

#### Door Events (Wall)
| Event | Description |
|---|---|
| `onDoorOpened` | This specific door is opened |
| `onDoorClosed` | This specific door is closed |
| `onDoorLocked` | This specific door is locked |
| `onDoorUnlocked` | This specific door is unlocked |
| `onAnyDoorOpened` | Any door in the scene is opened |
| `onAnyDoorClosed` | Any door in the scene is closed |

#### Actor Events (Global)
| Event | Description |
|---|---|
| `onEffectApplied` | An effect is added to this actor |
| `onEffectRemoved` | An effect is removed from this actor |
| `onAttributeChanged` | Any attribute on the actor changes |
| `onHealthChanged` | The actor's health track changes |

#### Ambient Light Events
| Event | Description |
|---|---|
| `onLightEnabled` | The light becomes visible |
| `onLightDisabled` | The light is hidden |
| `onLightChanged` | Any property of the light changes |

#### Combat Events (Scene-wide)
| Event | Description |
|---|---|
| `onCombatStart` | Combat begins in the scene |
| `onCombatEnd` | Combat ends |
| `onRoundStart` | A new combat round begins |

#### Time Events
| Event | Description |
|---|---|
| `onTimeChange` | In-game time changes (requires Simple Calendar) |

### Conditions

Before executing actions, the trigger evaluates a list of conditions. All conditions must pass.

| Condition | Description |
|---|---|
| `hasEffect` | Triggering token has a specific active effect |
| `removedEffect` | The effect that was just removed matches |
| `isGM` | Triggering user is the GM |
| `isPlayer` | Triggering user is a player |
| `doorState` | A door is open / closed / locked |
| `healthPercent` | Actor health percentage compared to a threshold |
| `tokenAttribute` | A token attribute equals, is greater than, or less than a value |
| `actorType` | Triggering actor is of a specific type |
| `distance` | Token is within a specified distance of a point |

### Actions

When all conditions pass, these actions can execute:

#### Environmental
| Action | Description |
|---|---|
| `showTile` | Make a tile visible |
| `hideTile` | Hide a tile |
| `toggleTileVisibility` | Toggle a tile's visibility |
| `changeTileAsset` | Swap a tile's image |
| `door` | Open, close, or lock a door |
| `enableLight` | Make an ambient light visible |
| `disableLight` | Hide an ambient light |
| `toggleLight` | Toggle an ambient light's visibility |

#### Effects
| Action | Description |
|---|---|
| `enableCoreEffect` | Apply a core WoD effect to a target |
| `disableCoreEffect` | Remove a core WoD effect |
| `toggleCoreEffect` | Toggle a core WoD effect |

#### Region Behaviors
| Action | Description |
|---|---|
| `enableRegionBehavior` | Enable a region behavior |
| `disableRegionBehavior` | Disable a region behavior |
| `toggleRegionBehavior` | Toggle a region behavior |

#### Communication
| Action | Description |
|---|---|
| `chatMessage` | Send a message to chat (with optional whisper) |
| `notification` | Display a UI notification to players |

#### Scripting
| Action | Description |
|---|---|
| `macro` | Execute a Foundry macro, passing the full trigger context |

### Target Modes

Every action specifies how it selects its target document:

| Mode | Description |
|---|---|
| `self` | The document the trigger is anchored to |
| `triggering` | The actor / token that fired the event |
| `specific` | A specific document picked by ID |
| `all` | All matching documents in the scene |

---

### Trigger System Step-by-Step Guide

#### 1. Opening the Trigger Editor

Triggers can be placed on **Tiles**, **Regions**, **Walls**, **Actors**, **Ambient Lights**, or a **Scene**.

- **Tile / Region / Wall / Light**: Right-click the element on the canvas → select **Configure Triggers** (or open the document's config sheet and go to the Triggers tab).
- **Actor**: Open the character sheet → go to the **Triggers** tab.
- **Scene**: Open Scene Configuration → **Triggers** tab.

#### 2. Creating a Trigger

1. Click **Add Trigger** in the Triggers panel.
2. Give the trigger a **Name** (e.g., "Open hidden door when entering room").
3. Toggle **Enabled** on.

#### 3. Configuring the Event

1. Under **Trigger Event**, select the document scope (Tile, Region, Wall, etc.).
2. Pick the specific **Event** (e.g., `onEnter`, `onDoorOpened`).
3. *(Optional)* Enable **Proximity Mode** on tiles or regions to fire before the token physically enters.

#### 4. Setting Target Filters

The target filter determines *which tokens* can fire this trigger:

- **Any** — all tokens qualify.
- **Player Tokens** — only tokens controlled by players.
- **GM Tokens** — only tokens controlled by the GM.
- **Specific Actor** — only a named actor.
- **Actor Type** — only tokens of a specific character type.

#### 5. Adding Conditions *(optional)*

Click **Add Condition** to add one or more conditions that must all be true for the trigger to fire:

1. Choose the **Condition Type** (e.g., `hasEffect`, `healthPercent`).
2. Configure the condition parameters.
3. Add as many conditions as needed — they are combined with AND logic.

#### 6. Adding Outcomes

Outcomes are groups of actions that execute when the trigger fires. You can add multiple outcomes.

1. Click **Add Outcome**.
2. Click **Add Action** inside the outcome.
3. Choose the **Action Type** (e.g., `showTile`, `chatMessage`, `enableLight`).
4. Configure the action:
   - **Target Mode**: `self`, `triggering`, `specific`, or `all`.
   - For `specific` targets: click the **Pick** button then click the desired element on the canvas.
   - Set any action-specific parameters (message text, effect ID, delay, etc.).
5. Add more actions to the outcome — they execute in order.

#### 7. One-Shot Triggers

Under **Execution Settings**, you can limit how many times the trigger fires:

- **One-Shot** — fires once per actor, then stops.
- **Reset** — can be reset manually or by another trigger's macro action.

#### 8. Testing Your Trigger

1. Save the trigger configuration.
2. Move a token into the trigger zone (or perform the trigger action).
3. Check the browser console for `[WOD TRIGGER]` log lines to trace exactly what fired and why.
4. Enable **Debug Mode** in System Settings for verbose logging.

#### 9. Example: Hidden Room Reveal

**Goal**: When a player token enters a tile, reveal a hidden tile and send a chat message.

| Setting | Value |
|---|---|
| Trigger Anchored To | Tile (the entry zone) |
| Event | `onEnter` |
| Target Filter | Player Tokens |
| Outcome 1, Action 1 | `showTile` → specific → pick the hidden tile |
| Outcome 1, Action 2 | `chatMessage` → "You notice a hidden doorway..." |

#### 10. Example: Door-Triggered Lights

**Goal**: When a specific door opens, enable a candle light.

| Setting | Value |
|---|---|
| Trigger Anchored To | Wall (the door) |
| Event | `onDoorOpened` |
| Target Filter | Any |
| Outcome 1, Action 1 | `enableLight` → specific → pick the candle light |

---

## Token Manager

The **WodTokenManager** automatically adjusts how tokens look on the canvas based on their in-game state, without the GM or players needing to touch token settings manually.

### How It Works

Rules are **condition → property** mappings evaluated reactively as the scene changes:

```
Condition (is the token in darkness?) → Property (set opacity to 0.4)
```

Multiple rules can stack, and evaluation is throttled to avoid performance impact on large scenes.

### Built-in Conditions

| Condition | Description |
|---|---|
| `isIlluminated` | Whether the token is currently inside a light source's radius |
| `hasEffect` | Whether a specific active effect is applied to the token |
| `attributeThreshold` | A numeric attribute (e.g. health) is below / above a value |
| Custom | Register your own evaluator function via the API |

### Built-in Properties

| Property | Description |
|---|---|
| `opacity` | Token transparency (0.0 – 1.0) |
| `tint` | Colour overlay applied to the token image |
| `scale` | Token size multiplier |
| Custom | Register your own property handler via the API |

### Example Use Cases

- Dim tokens that are in darkness (low illumination → opacity 0.4).
- Tint injured tokens red when health drops below 25%.
- Scale up a token that has a "Gigantic Form" effect applied.
- Desaturate dead tokens by tinting them grey when their health reaches zero.

### Queries API

The token manager also exposes a queries API for other parts of the system (and macros) to ask questions like:

- "Give me all tokens currently in darkness."
- "Give me all tokens within 10 metres of this point."
- "Is this specific token illuminated?"

These are used internally by the Trigger System's `isIlluminated` condition and proximity detection.

---

## Effects System

Three layers of effects management:

### Core Effects

System-defined WoD effects (e.g., Cloaked, Berserk, Possessed) with configurable modifiers. Managed via the **Core Effects** tab on actor sheets and can be targeted by trigger actions.

### Status Effects

The **Status Effect Manager** provides a library of reusable effects that can be applied to any document type — not just actors. Includes tokens, tiles, walls, and more.

### Equipment Effects

Items with the equipment type can carry their own effect payloads. The **Equipment Effects Dialog** manages which effects an equipped item grants to its owner automatically.

---

## Character Creation Wizard

The guided creation wizard walks players through building a character step by step, ensuring all traits are properly allocated.

### Starting the Wizard

1. Create a new Actor of the desired type.
2. Click the **Wand** icon in the sheet header.

### Wizard Steps (by type)

**All Types:**
1. Choose concept and basic identity
2. Allocate Attributes (7/5/3 priority split)
3. Allocate Abilities (13/9/5 priority split)
4. Choose Backgrounds

**Mage / Technocrat additionally:**
5. Choose Spheres (primary Sphere + starting ratings)
6. Set Arete, Quintessence, and Paradox

**Spirit additionally:**
5. Set Rage, Gnosis, and Willpower
6. Choose starting Charms

**Demon additionally:**
5. Choose primary Lore
6. Set Torment

### Validation

The wizard validates point totals at each step and highlights over-spent or under-spent categories before allowing you to continue.

---

## Project Structure

```
wodsystem/
├── wodsystem.js                        # System entry point and initialization
├── system.json                         # Foundry manifest
├── template.json                       # Actor/Item data schema
├── lang/
│   ├── en.json                         # English localization
│   └── es.json                         # Spanish localization
├── module/
│   ├── actor/
│   │   ├── data/wod-actor.js           # Actor data model and core logic
│   │   ├── template/                   # Per-type sheet classes
│   │   │   ├── wod-actor-sheet.js      # Base sheet (shared logic)
│   │   │   ├── mortal-sheet.js
│   │   │   ├── mage-sheet.js
│   │   │   ├── technocrat-sheet.js
│   │   │   ├── spirit-sheet.js
│   │   │   ├── demon-sheet.js
│   │   │   └── earthbound-sheet.js
│   │   └── scripts/trait-factory.js    # Trait initialization from templates
│   ├── apps/
│   │   ├── wod-roll-dialog.js          # Dice roll UI
│   │   ├── wod-st-approval-dialog.js   # Storyteller approval flow
│   │   ├── wod-trigger-config-dialog.js# Trigger editor UI
│   │   ├── wod-unified-triggers-dialog.js # Scene-wide trigger manager
│   │   ├── wod-effect-manager.js       # Effect management UI
│   │   ├── wod-equipment-effects-dialog.js
│   │   ├── wod-status-effect-library.js
│   │   └── wod-visual-rules-dialog.js
│   ├── character-creation/
│   │   ├── wod-character-wizard.js     # Wizard entry point
│   │   ├── wizard-config.js
│   │   ├── base/mortal-wizard.js
│   │   └── creatures/                  # Type-specific wizard logic
│   ├── dice/wod-dice-pool.js           # WoD 20th dice mechanics
│   ├── effects/
│   │   ├── wod-active-effect.js
│   │   └── effect-modifier-converter.js
│   ├── items/wod-item.js               # Weapons, armor, gear
│   ├── services/
│   │   ├── trigger-event-registry.js   # Event, condition, and action definitions
│   │   ├── trigger-manager.js          # Hook registration and event routing
│   │   ├── trigger-action-executor.js  # Action execution and target resolution
│   │   ├── trigger-api.js              # Public trigger query API
│   │   ├── condition-evaluator.js      # Condition evaluation logic
│   │   ├── wod-token-manager.js        # Token visual rules engine
│   │   ├── core-effects-manager.js
│   │   ├── status-effect-manager.js
│   │   ├── equipment-effects-manager.js
│   │   ├── game-data-service.js        # Edition-aware data (M20 / D20)
│   │   └── minimap-manager.js
│   └── ui/
│       ├── wod-trigger-tabs.js
│       ├── canvas-effect-indicators.js
│       ├── login-video-splash.js
│       └── minimap-hud.js
├── templates/
│   ├── actor/
│   │   ├── mortal-sheet.html
│   │   ├── mage-sheet.html
│   │   ├── technocrat-sheet.html
│   │   ├── spirit-sheet.html
│   │   ├── demon-sheet.html
│   │   ├── earthbound-sheet.html
│   │   └── partials/                   # 40+ shared template fragments
│   └── apps/                           # Dialog templates
├── styles/
│   └── themes/                         # Per-type CSS (mortal, mage, spirit, etc.)
└── scripts/utilities.js                # Handlebars helpers
```

---

## Troubleshooting

### Character sheet opens but traits are missing
Ensure `template.json` is valid JSON. Check the browser console for parse errors. Delete and recreate the actor if the data model became corrupted.

### Trigger is not firing
1. Enable **Debug Mode** in System Settings.
2. Open the browser console (F12) and look for `[WOD TRIGGER]` lines.
3. Verify the **event type** matches what actually happened.
4. Check that the **target filter** allows the token that performed the action.
5. Confirm all **conditions** are met — any single failing condition blocks the trigger.

### Trigger fires but action does nothing
1. Look for `WoD ActionExecutor |` lines in the console.
2. For `specific` target mode: re-open the trigger config and use **Pick** again to confirm the element ID is still valid (IDs can change if the scene is re-imported).
3. For tile / light targets: make sure the action type matches the target type.

### Dice rolls are not appearing in chat
Check that the actor is owned by the user making the roll. Guest players with Observer access cannot roll.

### Debug Mode
Go to **Game Settings → Configure Settings → System Settings → Debug Mode** and enable it. This outputs detailed logs for the trigger system, token manager, and effect engine.

---

## Contributing

1. Fork the repository on [GitHub](https://github.com/jibanezg/wodsystem).
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and test in a local Foundry installation.
4. Commit with a clear message: `git commit -m 'feat: add your feature description'`
5. Push and open a Pull Request.

### Adding a New Event Type

1. Add the event definition to `trigger-event-registry.js` under `_initEvents()`.
2. Add the corresponding Foundry hook in `trigger-manager.js` calling `this._fireEvent(...)`.
3. Add UI labels to `lang/en.json`.

### Adding a New Action Type

1. Register a handler in `trigger-action-executor.js` constructor: `this.registerActionHandler('myAction', ...)`.
2. Implement the `_executeMyAction(action, context)` method.
3. Add `elementType` resolution in `_resolveTarget` if needed.
4. Add normalization in `_normalizeActions` in `wod-trigger-config-dialog.js`.
5. Add the UI option in the trigger config dialog HTML.

---

## Roadmap

This section tracks what's coming next. It will grow as the system does.

### In Progress / Near-term

- **Combat System** — WoD initiative, attack/defence pools, soak rolls, damage application, and combat maneuver support integrated with the character sheet and dice engine.

### Further Out

- Deeper trigger actions (light colour/intensity control, macro chaining, conditional branching)
- Extended token manager rules UI (configure visual rules from a dialog rather than code)
- Additional character type support as needed
- Expanded localization coverage

---

## License

Licensed under the MIT License. See [LICENSE.txt](LICENSE.txt) for details.

---

*Made with care for the World of Darkness community.*
