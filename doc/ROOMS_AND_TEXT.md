# Rooms, scenes, and continuation text

## Rooms and scenes

A **room** is a logical location with a name, map position, four normal exits,
and one primary scene. A **scene** is one Atari display containing ten authored
rows of up to 12 characters. The engine owns the eleventh row for movement,
actions, Inventory, or Restart.

A room may contain:

- one primary scene shown by default;
- continuation scenes connected with NEXT;
- conditional scenes selected by room variants;
- ending scenes where only Restart is available.

All scenes count toward the cartridge limit of 102 scenes.

## Example: a two-page library

Create a room named **Old Library** with the normal exits WEST to Great Hall and
NORTH to Dungeon.

The primary scene might contain:

```text
OLD LIBRARY
DUSTY SHELVES
LEAN INWARD.
A BLACK BOOK
LIES OPEN.
```

Add a second scene named **Strange Book** and select it as the primary scene's
NEXT destination:

```text
THE BOOK TELLS
OF TWO KEYS
AND A CROWN
ABOVE THE KEEP.
```

When the player presses Fire on the first page, NEXT is initially selected.
After NEXT displays the second page, LOOK returns to the library's primary or
currently matching conditional scene.

Scene order alone does not create this connection. The NEXT field must be set.

## Primary scene and room entry

**Make primary** chooses the default scene for the logical room. Entering the
room through movement or an action destination begins with that scene unless a
room variant matches the current flags.

**Set start room** chooses the logical room used after power-on and Restart.
Restart also restores the configured initial flag and object states.

## Shared exits and scene overrides

The room's NORTH, EAST, SOUTH, and WEST exits are inherited by all its scenes.
This means a continuation page normally has the same movement as its primary
page.

Use **Optional movement overrides** only when one scene needs different
behavior. An override can:

- redirect a direction to another room;
- block a direction on that scene;
- return to **Same as room** to restore inheritance.

Example: a normal Bridge room allows EAST, but a Collapsed Bridge conditional
scene can override EAST with no destination while retaining the other exits.

## NEXT, LOOK, and variants

- NEXT displays another scene in the same room.
- NEXT is initially selected in action mode when a link exists.
- LOOK returns to the room's primary or first matching conditional scene.
- Entering a logical room also resolves its variants.
- Showing a specific scene through a contextual-action destination goes
  directly to that scene. LOOK can then return to the resolved room entry.

## Capacity and text storage

Every scene reserves ten rows of 12 characters, or 120 authored characters,
even when some rows are blank. Two scenes are packed efficiently into an
aligned ROM block, and the browser compiler manages their physical banks
automatically. Authors only need to monitor the displayed scene and character
capacity counters.
