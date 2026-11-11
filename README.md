# AI-based Roguelike (Hackathon 5.0)

A turn-based 2D dungeon crawler built in **Unity 2021.3.26f1**. Every run takes place in a
procedurally generated dungeon, and enemies use A* pathfinding to hunt you down.

## Download and play (Windows)

1. Download [`HACKATHON 5.0.zip`](HACKATHON%205.0.zip) and extract it.
2. Run `HACKATHON 5.0/HACKATHON PROJECT 1.0.exe`.

Keep the `.exe` next to its `_Data` folder, `UnityPlayer.dll` and `MonoBleedingEdge` folder,
or it won't start. The same build is also in the extracted [`HACKATHON 5.0/`](HACKATHON%205.0)
folder.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys | Move / attack (walk into an enemy) |
| Space | Pick up item |
| E or I | Open inventory (use an item) |
| Q | Drop an item |
| F or Enter | Confirm (target a spell) |
| V | Message history |
| C | Character info |
| Esc | Close menu / quit |

## Features

- **Procedural dungeons**: rooms and corridors are generated fresh on every floor, and stairs lead deeper.
- **Enemy AI**: hostile enemies chase you with A* pathfinding. A confused enemy wanders at random.
- **Fog of war**: field of view is calculated with a shadow-casting visibility algorithm.
- **Turn-based combat** with health, power and defense stats.
- **Items and equipment**: health potions, Fireball, Lightning and Confusion scrolls,
  Dagger, Sword, Leather Armor and Chain Mail.
- **Leveling**: earn XP, then choose to raise max HP, power or defense when you level up.
- **Save / Continue** from the main menu.

## Tech

Unity 2021.3 (2D Tilemaps, Input System, TextMeshPro), C#, Odin Serializer for save files.

## Last Light (new Android game)

The roguelike above was the hackathon prototype. Its idea grew into **Last Light**, a casual
lantern dungeon crawler with 9 dungeons, relics, shops and bosses, built as an Android app. It lives in
[`last-light/`](last-light), with its own [README](last-light/README.md).

## Repository contents

For the original roguelike, this repo contains the **compiled Windows build** only. The Unity project source
(`Assets/`, `Packages/`, `ProjectSettings/`) has not been committed yet.
