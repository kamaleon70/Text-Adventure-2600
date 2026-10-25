# Conditions and changing room text

## Target example: using a torch

Initial visit to the shaft:

```text
ROOM 6 SHAFT
TOTAL DARK.
AIR RISES
FROM BELOW.
```

After taking and using a torch:

```text
ROOM 6 SHAFT
TORCH LIGHT
SHOWS A LIFT
AND RED WIRE.
```

The descriptions remain ROM pages. RAM stores only the fact that the torch is
lit and, if portable, where the torch currently is.

## Flag storage

Reserve eight RAM bytes for 64 named boolean flags. The editor exposes names,
while generated assembly uses indexes:

```text
0 TORCH_LIT
1 STORE_CRATE_OPEN
2 FUSE_INSTALLED
3 LAB_CARD_USED
4 VAULT_OPEN
```

Testing, setting, and clearing a flag requires a byte index and bit mask. No
text or flag names are stored in RAM.

## Variant rules

Each room can have ordered rules followed by a default scene:

```json
"variants": [
  { "when_all": ["TORCH_LIT"], "scene": "shaft_lit" }
],
"default_scene": "shaft_dark"
```

The generator converts names to compact ROM records. The first matching rule
wins. Early versions should support only:

- all listed flags must be set;
- all listed flags must be clear;
- player must carry one specified object.

Avoid a general expression language until real game content proves it is
needed.

## When to resolve a variant

Resolve the current room description:

- when entering a room;
- after an interaction changes flags or objects;
- when performing `LOOK`.

Do not resolve it every video frame. Gameplay logic belongs in VBLANK or
overscan, and unnecessary per-frame work makes television timing harder to
reason about.

## Interaction result

An interaction should be able to:

- set or clear a flag;
- move one object;
- display a result scene;
- optionally move to another room;
- optionally play a small sound cue.

For example, `USE TORCH` sets `TORCH_LIT` and redisplays the current room. The
room resolver then chooses the lit scene.

## Failure text

Avoid allocating a unique failure page for every rule. A small shared set is
usually enough:

- `NOT HERE.`
- `YOU NEED IT.`
- `IT IS LOCKED.`
- `NOTHING HAPPENS.`

These can be action-row messages or short shared scenes, depending on how long
the message must remain visible.
