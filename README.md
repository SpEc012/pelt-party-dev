# Pelt Party

A cozy procedural 3D pumpkin fight for browsers. Built for Dylan's Handshake multiplayer game project. **Work in progress — not a contest-ready release yet.**

## What is playable

- Browser-only solo matches with 4, 8, 12 or 20 participants and three bot difficulty settings.
- The original supplied chibi rig, faces, hair and clothing, with added fight animations and procedural hats.
- Movement, charged throws, rolling, restocking piles, forts, three pickups, hearts, respawn, results and rematch.
- Pelt Party, Team Pelt and King of the Patch; three prototype arena layouts.
- Keyboard/mouse, twin-stick touch and gamepad input.
- Cloudflare Worker + Durable Object WebSocket rooms, four-character codes, Quick Play, reconnect, auto-start and majority-voted bot fill.
- 20 player seats and 10 spectator seats; binary movement frames and adaptive 12–30 Hz updates.
- Seasonal previews, Halloween return button, tutorial hints, sound effects, local practice coins and wardrobe.

See [STATUS.md](STATUS.md) for measured tests and the unfinished work. The current maps, economy and characters do **not** yet implement the entire game bible.

## Run locally

Requires Node 22+.

```sh
npm ci
npm run dev
```

Vite runs the browser-only game. For multiplayer, run this in another terminal:

```sh
npm run dev:worker
```

Vite proxies `/api` and `/ws` to the local Worker on port 8787. Or open the Worker directly after building. If your environment cannot list network interfaces, use explicit addresses and inspector ports:

```sh
npx vite --host 127.0.0.1 --port 5173
npx wrangler dev --ip 127.0.0.1 --port 8787 --inspector-port 9230 --local
```

## Deploy to your Cloudflare account

No account credentials are stored in this repository. The development workspace has not been authenticated to Cloudflare.

```sh
npm ci
npx wrangler login
npm run check
npm run deploy
```

Wrangler creates the `PeltRoom` and `Directory` SQLite Durable Object namespaces through the migration in `wrangler.jsonc`. Open the URL Wrangler prints and perform the phone/laptop checklist in [docs/TESTING.md](docs/TESTING.md). Keep this hostname stable; only promote tested commits. Account plan, quotas and costs must be verified in the owner's account before public launch.

Alternatively, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the repository's **Actions secrets**, then run the manual **Deploy to Cloudflare** workflow. Use a token scoped to this account with the necessary Workers deployment permissions. Do not paste it into chat or commit it.

## Tests

```sh
npm test                         # room rules and simulated workload
npm run build                   # browser production bundle
node scripts/integration-runner.mjs  # launches actual local Worker + socket clients
npx playwright install chromium
npm run test:browser             # desktop and iPhone 14 viewport smoke tests
```

Browser tests produce screenshots in `test-results/`. iPhone emulation is **not** a real iPhone/Safari performance test. Socket RTT measured on localhost is **not** internet RTT. See the report before treating a milestone as complete.

## Architecture

- `shared/room.mjs`: transport-free authoritative game model used in a Durable Object and in solo loopback.
- `shared/physics.mjs`: movement, collision, ballistic pelts and payout calculations.
- `shared/protocol.mjs`: identity/code validation, binary pose frames and remote interpolation.
- `server/worker.mjs`: route handling, room allocation, WebSockets, presence and checkpoints.
- `src/main.js`: browser screens, local motion, victim reports, controls and practice persistence.
- `src/world/chars/`: Dylan's original character source; `characters.js` adds fight poses and hats.
- `src/world/lod.js`: simplified meshes baked from the original character geometry.

Live gameplay travels over WebSockets. HTTP is used to create/find a room. There is no match polling. Solo mode has no server dependency once the page and its bundle have loaded; it cannot load an uncached page during a hosting outage.

## Debugging

`?debug=1` shows draw calls, triangles, FPS, ping, jitter, clock offset and downstream application bytes. `?lag=120&jitter=30&loss=3` simulates delay and dropped movement messages at the application boundary. `?season=halloween|harvest|frost|meadow` selects a preview; `?date=2026-11-03` tests the local season. Online rooms use the server's selected season and do not change mid-match.

`?test=1` exposes local browser test hooks; it cannot grant authority over an online room. The online server validates commands independently.

## Source and rights

The chibi rig and the relevant geometry/appearance helpers were supplied by the repository owner on October 5, 2026. The original proportions and painted faces are retained. Only locomotion, pose blending, model construction and facial rendering are retained from that source. Garden props, paired gestures and photo-booth/bed animations were removed. No garden, café, chat, relationship or arcade gameplay is integrated. No external art/models/audio are downloaded at runtime. Three.js and development dependencies retain their own licenses. The owner has not selected a project license yet; none is implied here.
