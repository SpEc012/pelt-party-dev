# Resumable checkpoint — 1.0.0

Updated October 6, 2026. The owner asked for most of the 0.2 prototype to be redone: faster, more competitive pacing, a real dive/slide/quick-cover move set ("the Elf snowball fight"), bigger maps, a new menu, music and settings, and a high frame rate. This is that rework. It was developed on a fork (`SpEc012/pelt-party-dev`) and offered to `dylandev01/pelt-party` as a pull request.

## Evidence from this workspace

- `npm test`: 24 rule tests pass. They cover dive invulnerability, the snap movement budget (accepts dive speed, rejects teleports), wall building (three segments, cooldown, per-player cap, never on ammo piles), scooping and pile refill rates, streak/multi/payback callouts, power pads, plus the earlier lobby, capacity, validation, replica and workload tests.
- `node scripts/integration-runner.mjs` against a real local Worker: two WebSocket clients share a start time, see each other move, reconnect to the same seat; 20 players + 10 spectators receive valid binary frames (about 2.6 KB/s idle downstream per client on localhost).
- `npm run test:browser` (headless Chromium, SwiftShader software GL): menu → 8-player match → move, throw, dive, build → results pay coins → Locker hat purchase → Settings quality and FPS cap → season switch → 20-player Teams match → iPhone 14 viewport layout and touch buttons. No page errors.
- Simulated bot matches (12 bots, 4 minutes, all four maps): Rookie lobbies produce roughly 50–150 splats per match, Ace lobbies fewer because Ace bots dodge more. The room step averages about 0.12–0.2 ms per tick in Node.
- Per-frame CPU cost in headless Chromium with 20 Ace bots, GPU submission stubbed out: about 1.0 ms renderer preparation plus 0.8 ms for the local room step, with about 160–190 draw calls. That leaves headroom for 240 Hz on a desktop CPU, but **no real-GPU or real-monitor frame rate has been measured**; SwiftShader frame rates in this sandbox (3–40 fps) say nothing about hardware.

## What changed for frame rate

- Removed all CSS `backdrop-filter` blur over the full-screen canvas (the old HUD blurred the 3D scene every frame).
- The HUD is built once per match and only touches changed text and styles; no full HTML rebuild on state messages.
- One frustum per frame, no per-actor allocations, instanced pelts, trails, particles, decals and walls, merged static map geometry.
- Name tags update every frame with `translate3d` (the old build updated them every fourth frame, which looked choppy).
- Frame-rate cap setting (Unlimited follows the display's refresh rate), quality presets, render scale and optional shadows.

## Known limits and next work

1. Deploy and play on real hardware: measure FPS on the owner's 240 Hz PC and an iPhone 14, and RTT phone ↔ laptop on different networks. Tune the Ultra/High defaults from those numbers.
2. Real iPhone Safari: pointer, safe-area and audio unlock behaviour have only been checked in Chromium emulation.
3. Coins, XP, unlocks and the Locker are stored on this device only. There is no server wallet, account or Rescue Code. Online results credit the local wallet; they are not trusted by any server.
4. Bots use steering, line-of-sight, leading, dodging, building and scooping; they do not path-find through mazes and can still bunch up.
5. Walls are validated on the server (placement, cooldown, cap); there is no anti-spam beyond the cooldown.
6. Moderation is still a basic name filter; no report/block UI.
7. Durable Object checkpoints every 5 seconds; a Worker restart can rewind a few seconds of a match.
8. Contest deliverables still to make: a cover image rendered from the game, a description matching what shipped, the stable link. Feature freeze October 27, submit October 29, keep it live through December 1.

The original design and networking briefs are in `docs/reference/`. Do not claim a test was performed just because the design requests it.
