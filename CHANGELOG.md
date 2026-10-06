# Changelog

## 1.0.0 — October 6, 2026 — the big rework

- **Move set**: 2-charge dive with invulnerability frames, slide (crouch while sprinting), crouch cover, slippery ice; faster run/sprint; knockback on hit.
- **Quick cover**: `Q` builds a curved three-segment wall that rises from the ground, absorbs hits and crumbles; replaces the old 3-ammo fort.
- **Pacing**: faster, flatter throws that keep flying past the aim point, 260 ms throw cooldown, 0.55 s charge, 8 ammo, scoop-anywhere ammo, faster piles, 2.2 s respawn with spawn protection at the safest spawn, a 30-second Blizzard finale.
- **Power pads** show their power and rotate: Triple Toss, Snow Shield, Hot Cocoa, Giga Ball, Sugar Rush (auto-applied on touch).
- **Competitive feedback**: streaks, multi-splats, first splat, shutdown and payback callouts; kill feed, hit markers, damage direction, hit-stop, scoreboard, race bar, minimap, end-of-match awards.
- **Maps**: four authored arenas (Frosty Commons, Maple Street, Pumpkin Patch, Haunted Hollow) with backdrops (skyline, houses, cornfield, crypts) and seasonal dressing; 20% larger for 13+ players.
- **Bots**: target scoring, strafing at range, leading shots, dodge dives, defensive walls, scooping, pickup hunting, unsticking.
- **Renderer**: quality presets, FPS cap or unlimited, render scale, PCF shadows, sky gradient, falling snow/leaves/embers, pelt trails, splat decals, instanced effects; removed full-screen blur filters.
- **UI**: new menu over a live bot match, play setup with map cards, Locker with 3D preview, tabbed Settings, pause menu, lobby, results with awards, XP and levels, phone layouts.
- **Audio**: synthesised seasonal menu and battle music with Blizzard intensity, new sound effects with stereo panning.
- **Content**: 10 chibi looks and 12 hats built on the supplied rig; new dive/slide/scoop/build/charge poses.
- Tests rewritten for the new rules; browser smoke test rewritten for the new UI.


## 0.1.0 — October 6, 2026

- Created the standalone Pelt Party project and Cloudflare Worker/Durable Object backend.
- Added pure shared room rules, binary movement, local bots, reconnects, countdowns and opt-in public bot fill.
- Imported the owner's original chibi modules and required appearance/toolbox helpers; added fight poses and four hats.
- Built procedural seasonal scenes, three prototype maps/modes, basic combat/forts/pickups, results, responsive menus and touch/gamepad input.
- Added geometry-derived LOD, instanced effects, local practice progression, wardrobe and season previews.
- Added rules tests, a simulated room workload, actual local WebSocket integration checks and browser smoke tests.
- Recorded limitations and remaining milestones in STATUS.md. Production deployment and real-device acceptance remain open.

- Fixed reconnect identity checks for reused seats, roll movement validation, ground z-fighting, mobile home scrolling, player labels and team result ranking.
- Reduced the supplied animation module to idle, walk, run and pose blending; removed unused paired gestures, photo booth/bed sequences, garden props and their rig hooks before GitHub publication.
