# Auto Line Namer (Cities First Edition) for Transport Fever 3

Gives your lines consistent, readable names built with the **town/city names first**, so that when lines are sorted alphabetically in the Line Manager, all lines belonging to the same cities cluster together:

```
Spr-She - Bus Passengers-IC-1
Spr-She - Bus Passengers-IC-2
Nor-Cam - TC Logs,Gravel-IC-1
BadBer - RC Vegetables-LO-1
```

> [!NOTE]
> **Credits & Attribution / Ursprung:**
> Dieser Mod ist eine 1:1 Kopie und Weiterentwicklung des Original-Mods **Auto Line Namer** für Transport Fever 3 von **Dave W (BeautifulCheez)** (veröffentlicht auf mod.io ID `6414403`), welcher wiederum auf dem Transport Fever 2 Mod von **Erkan Ercan** ([Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3360333659)) basiert.
> Lizenziert unter der **MIT License** (siehe [LICENSE](LICENSE)).
> 
> **Einzige Änderung gegenüber dem Original:** Das Standard-Namensschema wurde so modifiziert, dass die **Städtenamen an den Anfang** gestellt werden (`{townNames} - ...`), damit Linien bei alphabetischer Sortierung im Spiel automatisch städtebezogen gruppiert sind.

This is an enhanced Transport Fever 3 edition of Auto Line Namer, featuring a city-first naming layout for perfect alphabetical grouping in the line manager.

## Using it

- **New lines** are named within about two seconds of being created.
- **Force a rename:** rename a line to `r` or `reload`.
- **Protect a line:** start its name with `Cst` (for example `Cst Airport Express`). Every other line gets renamed, so if you name a line by hand, add the prefix.
- **Auto Update** re-evaluates all lines every minute by default, so cargo shows up once vehicles are assigned.
- **Line Manager:** select lines, press the built-in Auto-Rename button and pick **Auto Line Namer**. This works on any selected line, protected or not.

## Settings

When you add the mod to a game you can choose:

| Option | Choices |
|---|---|
| Naming Convention | `Spr-She - Bus Passengers-IC-1` (City-First default), `Spr-She - Bus - Passengers IC`, `Spr-She: Bus (1) IC`, or Custom |
| Town Names | Short (3 letters per word) or Full |
| Cargo Names | Full or Short |
| Auto Update | Off, or every 1 / 2 / 5 / 10 minutes |
| Line Number Digits | 1, 2, 3 or 4 (3 gives 001, 002, 003) |
| Cargo: (one per cargo type, advanced) | Default (follow Cargo Names), Full, Short or Code (e.g. PAX, LOG, ORE) |

Everything else is in `content/auto_line_namer/aln_config.lua`: the custom convention, the protect prefix, labels for each transport and line type, separators, and how many cargo types to show. Edit it with the game closed.

### Convention tokens

| Token | Meaning |
|---|---|
| `{transportType}` | Bus, RC (road cargo), Tram, TP / TC (train passenger / cargo), WP / WC (water), AP / AC (plane), HE / HC (helicopter), UNK |
| `{cargoTypes}` | Cargo the line carries |
| `{townNames}` | First and last town |
| `{lineType}` | LO (one town), IC (two towns), RE (three or more) |
| `{lineNumber}` | 1 for the first line with this name, 2 for the next, and so on |

## Differences from the TF2 version

- Settings are in the mod options and a config file rather than an in-game window, because TF3's interface is built differently.
- New lines are detected directly, so you no longer need to toggle "Add station" to trigger a rename.
- Cargo comes from the line's load settings, falling back to what its vehicles can carry, and is capped at 3 types plus "+N" by default so universal trucks don't produce huge names.
- Short names count letters rather than bytes, so towns with accented names abbreviate correctly.
- `{lineNumber}` counts lines that share a name (1, 2, 3) instead of using the game's internal line id.
