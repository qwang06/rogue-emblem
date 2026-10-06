# Game data

Authored content that the game loads at build time. Edit these files and the dev server reloads the game. `npm test` parses every file and fails with the file and line number if something's wrong.

## `characters.json`

Everyone who can speak in dialog, by id:

```json
{
  "alden": { "name": "Alden", "team": "player", "unitClass": "villager", "portrait": null }
}
```

- **id**: lowercase letters, digits, and `_`. Dialog files refer to speakers by it.
- **name**: shown on the dialog box's name plate.
- **team**: `player` or `enemy`. Player speakers stand on the left of the dialog box, enemies on the right.
- **unitClass**: the unit class (`villager`, `soldier`, ...) whose sprite fills the portrait frame until there's portrait art, or `null` for an empty frame. Optional. The Sparring Partner leaves it `null` because Training fills in whichever class you picked.
- **portrait**: the sprite key of the character's portrait art, or `null` for none yet. A new portrait image goes in `src/assets/sprites.ts` like the other sprites.

## `dialog/*.txt`

One file per level, named after it (`demo.txt`, `training.txt`). Every `.txt` file in this folder is loaded automatically.

You can also try out dialog without touching the repo: open **Game Configs → Dialogs** (`#/configs/dialogs`) from the title screen and upload a file with the same name as the one it replaces. It's checked the same way, kept in your browser only, and plays from the next battle you start. Download a built-in file there to start from it.

```
# Comments start with #. Blank lines are ignored.

[opening]
alden: Enemy soldiers have taken the old gate.
enemy_soldier: Hold the line!
bryn (right): Add (left) or (right) to put a speaker on the other side.
```

- **`[section]`** starts a conversation and names when it plays. Every section is optional, and each can appear once per file:
  - `opening`: when the level starts, before deployment.
  - `turn N` (for example `turn 3`): at the start of the player phase on turn N, once the phase banner has played.
  - `victory` / `defeat`: when the battle is won or lost, before the Victory / Defeat screen.
- **`speaker: text`**: one line of dialog, with `speaker` an id from `characters.json`. Everything after the first colon is the text, so colons and apostrophes in the text are fine. Each line is one box of dialog, so keep it to a sentence or two.

## `dungeon.json`

Dungeon Mode's floors. A run goes down floor by floor; every `floorsPerConfig` floors it moves on to the next entry in `floors`, and once they run out every floor uses the last one.

```json
{
  "floorsPerConfig": 1,
  "floors": [
    {
      "name": "Meadowlands",
      "description": "Open fields: a small map with a few lakes and hills and a farming village.",
      "terrain": { "width": 14, "height": 12, "lakes": 1, "meadows": 4, "meadowSize": [5, 9] },
      "enemies": [
        { "count": 2, "region": { "y": [0, 0.34] } },
        { "count": 1, "minDistance": 4, "maxDistance": 6 }
      ],
      "treeChance": 0.05,
      "palette": "a-stone"
    }
  ]
}
```

- **name**: shown on the Objective and Victory screens ("Floor 2: Lakeside"). **description** is optional notes for whoever edits the file.
- **terrain**: the map generator's settings. `width` and `height` (6–48 tiles) are required; the rest are optional: how many patches to grow (`lakes`, `mountains`, `forests`, `meadows`), their sizes as `[min, max]` tiles (`lakeSize`, `mountainSize`, `forestSize`, `meadowSize`), how many walled `ruins` and lone `buildings`, whether there's a `castle` (true/false), and `turnChance` (0–1, how much the path winds).
- **enemies**: 1–10 groups of enemy soldiers, up to 30 in all, placed in order on random tiles the player can walk to. Each group has a `count` and optional limits:
  - `region`: a box as `[from, to]` fractions of the map's columns (`x`) and rows (`y`), 0 being the west or north edge and 1 the east or south. It covers the tiles from `from × size` up to, but not including, `to × size`, rounded down, so `[0, 0.5]` and `[0.5, 1]` split the map into halves. Unset, an axis covers the whole map. `{ "y": [0, 0.34] }` is the north third.
  - `minDistance` / `maxDistance`: 1–100 steps a unit would walk from the nearest deployment tile, going around water, mountains and walls.

  A file whose limits leave too few tiles for its enemies on a test map is turned away. An older file's `"enemyCount": n` still loads, as `n` enemies in the north third.

- **treeChance**: 0–1, how likely each free grass tile is to get a tree.
- **palette**: the building and wall colors, one of the names in `BUILDING_PALETTES` (`src/game/tileset.ts`), e.g. `a-stone`, `b-blue`.

A setting the game doesn't know (a typo like `"lake"`) is an error, not ignored. The config editor's **Dungeon Floors** page (`#/configs/dungeon-floors`) edits this file as a form. Under `npm run dev` its Save writes this file (checked first, and laid out so an unchanged save changes nothing); in a built game Save keeps the floors in your browser instead. The page also takes this file as an upload, to try changes in your browser without touching the repo.
