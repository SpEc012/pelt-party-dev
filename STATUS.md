# Resumable checkpoint — 0.2.0

Updated October 6, 2026. User approved building continuously, supplied their original chibi source, confirmed a Cloudflare account and selected an iPhone 14 for real-device testing. The game now uses a close third-person chase camera and the 0.2 gameplay pass is pushed to GitHub.

## Current position

This is a functional early playable and backend foundation spanning parts of M0–M7. It is **not** completion of those milestones. The GitHub deploy workflow now runs on every `main` push, performs the full check, and deploys when the two Cloudflare Actions secrets are configured. With those secrets absent, the latest workflow recorded a clean skipped deployment; the public Cloudflare URL still needs them.

## Evidence from this workspace

- `npm run check`: room rules/simulated workload tests pass; Vite production build succeeds.
- `wrangler deploy --dry-run`: Worker bundles with both Durable Object bindings and static assets.
- Real local WebSocket integration: two clients share start time, observe movement, reject a client score write, and reconnect to the same seat.
- 20 human socket clients plus 10 spectator clients join and receive valid binary frames. Measured idle downstream payload: about 2.7 KB/s per client. This excludes TLS/TCP framing and busy-match events.
- Playwright Chromium smoke test: starts an eight-player solo match, moves, throws, rolls, completes results, earns local practice coins, buys/equips a hat, and changes seasons. No uncaught page errors.
- iPhone 14 **viewport emulation in Chromium**: home and game render, controls are visible, no horizontal overflow. Real iPhone Safari has not been tested.
- After batching particles/pelts/forts and adding original-model LOD: the sampled desktop eight-player frame used 63 draw calls / 103,569 triangles; the sampled 20-player frame used 60 / 98,537; the phone viewport sample used 62 / 101,837. These are sampled views, **not** worst-case guarantees or hardware FPS measurements.
- Ten rooms of twenty bots advance through ten simulated minutes with bounded projectile/dedupe state. This is a rules workload, **not** a ten-minute wall-clock production load test, heap profile, or proof of 800 concurrent players.

## Implemented with known limits

- Exact supplied chibi base rig is used. Four character looks are available; stats and signature moves are not yet active. Distant models use simplified baked geometry and reduced animation.
- Three prototype map layouts share a recipe. They are not the fully authored map designs from the bible; Haunted Hollow portals/fog and Cauldron eruptions are absent.
- Three modes work. Team results now rank by combined team score, with explicit ties and shared placement; economy balancing remains provisional.
- Three power-ups: Triple Toss, Shield, Heal. Shield is time-based, not the requested three-hit shield. Charged pelts do direct damage; area splash is not implemented yet.
- Practice coins/owned hats are local and untrusted. Online match payout previews exist, but there is **no server wallet, Rescue Code, shop authority, XP, quests, daily caps ledger or Season Trail**. No local balance is uploaded into an online wallet.
- Tutorial is timed, skippable hints during a regular match, not yet a separate goal-checked tutorial.
- Bots navigate directly with collision sliding and configurable aim/reaction. They do not yet perform the complete tactical roll/pathfinding behaviors in the bible.
- Rooms retain disconnected seats for sixty seconds and migrate host. Checkpoints are periodic; abrupt Worker replacement can rewind a few seconds. This needs stronger restart handling before production competition.
- Basic ASCII nickname cleaning and word rejection are placeholders, not comprehensive public-room moderation. No block/report UI yet. Public discovery has per-token throttling; IP-based abuse protection and room expiration policy need hardening.
- Production costs, cross-region latency, iPhone 14 Safari frame time, WebGL context loss and all contest edge cases remain unverified.

## Highest-priority next work

1. Authenticate the owner's Cloudflare deployment and publish a development URL. Measure phone/laptop RTT on different networks. Record account cost/limits; establish stable/dev deployment separation.
2. Run the real iPhone 14 checklist in `docs/TESTING.md`; fix input, readability and sustained performance issues before adding content.
3. Strengthen network simulation into independent client replicas with loss, replay, hostile inputs and restart recovery. Measure busy-match bandwidth and ten real WebSocket rooms.
4. Implement proper splash resolution, historical hit validation, map collision ordering, fortified cover validation, complete bot navigation/roll, and public lobby map voting.
5. Implement trusted online profiles/rewards with atomic claims and a secure recoverable identity design. Keep offline practice progress separate.
6. Finish the character roster, signature/passive abilities and remaining power-ups; author three complete Halloween maps; add the first thirty cosmetics.
7. Accessibility, left-handed controls, audio volume/music, moderation, settings persistence, spectator camera, one-tap rematch and the full edge-case checklist.
8. Feature freeze October 27. Entry art/description must match shipped features. Rehearse the two-minute judge demo; submit October 29; keep the link live through December 1.

The original design and networking briefs are in `docs/reference/`. Do not copy the old game's database/polling match paths back into this implementation. Do not claim a test was performed just because the design requests it.
