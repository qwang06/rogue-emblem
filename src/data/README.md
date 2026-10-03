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
- **portrait**: the sprite key of the character's portrait art, or `null` for none yet. A new portrait image goes in `src/assets/sprites.js` like the other sprites.

## `dialog/*.txt`

One file per level, named after it (`demo.txt`, `training.txt`). Every `.txt` file in this folder is loaded automatically.

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
