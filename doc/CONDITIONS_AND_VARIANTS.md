# Conditions and changing room descriptions

## Flags remember story facts

A flag is a persistent yes/no value. The editor supports up to 64 flags.
Examples include:

- `TORCH_LIT`;
- `CHEST_OPEN`;
- `CASTLE_UNLOCKED`;
- `DRAGON_DEFEATED`.

**Initially set** determines the flag's value after power-on or Restart.
Actions can SET, CLEAR, or TOGGLE flags while the game is running.

## Room variants

A room variant selects a different scene when its requirements match. Every
**must be set** flag must be on, and every **must be clear** flag must be off.
Rules are checked from top to bottom; the first matching rule wins. If none
matches, the room's primary scene is used.

Variants are resolved when:

- the player enters the room;
- LOOK is performed;
- an action changes state and stays in the current room;
- an action destination enters that logical room.

## Example: dark and illuminated shaft

Create `TORCH_LIT`, initially clear.

1. Make **Shaft - Dark** the room's primary scene.
2. Add **Shaft - Lit** as another scene in the same room.
3. Add a room variant selecting Shaft - Lit when `TORCH_LIT` must be set.
4. Create a LIGHT TORCH action that SETs `TORCH_LIT`.
5. Leave **After action** at Stay in current room.

After LIGHT TORCH runs, the room is resolved again and immediately displays
Shaft - Lit. Leaving and returning still shows the lit description because the
flag remains set.

## Multiple conditions and rule priority

Suppose a laboratory uses `POWER_ON` and `ALARM_ON`:

1. **Laboratory - Alarm**: `POWER_ON` set and `ALARM_ON` set.
2. **Laboratory - Powered**: `POWER_ON` set.
3. Primary **Laboratory - Dark**: used when neither rule matches.

The alarm rule must come first because it is more specific. If the powered rule
came first, it would hide the alarm scene whenever both flags were set.

## Flags interacting with objects

Flags remember facts; object locations remember where items are. A contextual
action can test both.

Example: USE FUSE can require:

- `FUSE_INSTALLED` clear;
- Fuse carried.

It can then:

- SET `FUSE_INSTALLED`;
- remove Fuse from play;
- enter the powered lift room.

The flag keeps the machinery powered after the physical fuse object has been
consumed.

## Testing variants

Use the Playtest flag debugger to force each relevant combination. Confirm:

- the default scene appears when no rule matches;
- each rule selects the intended scene;
- more-specific rules take priority;
- LOOK and room entry resolve the same result;
- Restart restores the configured initial values.
