# Pelt Party

A fast 3D snowball fight for up to 20 players in the browser. Dive through incoming throws, slide into cover, slam down a snow wall and splat your friends. No login, nothing to install. Built for Dylan's Handshake multiplayer game project.

## What is playable (1.0)

- **Play vs bots** starts a full match in seconds, entirely in the browser: 4 to 20 players, Rookie / Regular / Ace bots, Free-for-all, Teams or King of the Hill.
- **Movement built for hero moments**: run, sprint, a 2-charge **dive** with brief invulnerability, a **slide** (crouch while sprinting), crouching behind cover, and slippery ice ponds.
- **Quick cover**: `Q` slams a curved three-segment wall (snow, pumpkins, leaves or hedge by season). Walls absorb hits, crumble and expire.
- **Ammo economy**: carry up to 8. Glowing piles refill fast; hold `R` anywhere to scoop by hand. The last 30 seconds are a **Blizzard** with double refill and cheaper Big Pelts.
- **Throws**: tap for a fast, flat throw; hold to charge a **Big Pelt** (2 damage, splash). Misses keep flying until they land.
- **Five visible power-up pads**: Triple Toss, Snow Shield, Hot Cocoa, Giga Ball, Sugar Rush.
- **Competitive feedback**: hit markers, damage direction, kill feed, streak and multi-splat callouts (Double Splat, Snowstorm, Shutdown, Payback), hit-stop, scoreboard (`Tab`), race-to-the-limit bar, minimap and end-of-match awards.
- **Four authored arenas**, each re-skinned for every season: Frosty Commons (city park with a skyline), Maple Street (parked cars and front yards), Pumpkin Patch (hay lanes) and Haunted Hollow (tombstones and a crypt). Bigger lobbies get a 20% larger arena.
- **Ten chibis** from the supplied rig plus twelve hats; coins and XP saved on this device; Locker with live 3D preview.
- **New menu** with a live bot match behind it, **synthesised seasonal music** that intensifies in the Blizzard, and new sound effects.
- **Settings**: quality preset (Low to Ultra), unlimited or capped frame rate (30 to 240), render scale, shadows, weather, FOV, mouse and aim sensitivity, invert Y, toggle crouch and sprint, volumes, camera shake, reduced motion, FPS display.
- Keyboard and mouse (pointer lock), gamepad, and touch controls with a floating stick.
- Online: Cloudflare Worker + Durable Object WebSocket rooms, four-character codes, Quick Play, reconnect to the same seat, auto-start and majority-voted bot fill, 20 players plus 10 spectators, binary movement frames at an adaptive 12 to 30 Hz.

See [STATUS.md](STATUS.md) for what was measured and what is still open.

## Accounts, challenges and ranks (1.1)

- **Sign up with a username and password** (no email). Passwords are stored only as salted PBKDF2-SHA256 hashes (100,000 iterations) in a per-user Durable Object; sessions are random 256-bit tokens stored as SHA-256 hashes. Five wrong passwords lock the account for a growing delay; new accounts are rate-limited per IP.
- **Everything saves to the account**: coins, XP and level, unlocked chibis and hats, the equipped look and lifetime stats. Guests keep playing with device-only progress.
- **The server owns the economy**: purchases, equips and rewards are checked by `shared/progress.mjs` inside the Account object. Clients never send balances.
- **Online matches** credit signed-in players directly from the room's own results (the room calls the account object; the browser cannot). **Bot matches** count too, but the report is clamped to plausible numbers, must be at least a minute apart and is capped at ◈40 per match and ◈400 per day.
- **Goals**: 3 daily challenges, 2 weekly challenges, 11 achievements (some unlock exclusive hats), a daily login streak bonus and ◈50 per level-up.
- **Global ranks**: top players by XP.
- **Funnier deaths**: splatted chibis ragdoll away from the thrower, backflip, bounce and land flat on their back with stars circling; a "SPLATTED!" death screen shows who got you, a countdown and a tip, while the camera circles your ragdoll.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Move / sprint | WASD / Shift | Left stick / L3 | Left side stick (push fully to sprint) |
| Look / aim | Mouse / hold right button | Right stick / LT | Drag the right side |
| Throw (hold to charge) | Left button | RT | THROW |
| Dive | Space | A | DIVE |
| Crouch, or slide while sprinting | C | B | CROUCH |
| Wall | Q | X | WALL |
| Scoop ammo (hold) | R | Y | SCOOP |
| Scoreboard / pause | Tab / Esc | – / Start | ❚❚ |

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
- `shared/maps.mjs`: the four authored arenas as finite collision cylinders.
- `shared/controller.mjs`: movement curves (run, dive, slide, ice) shared by prediction and validation.
- `src/main.js`: game loop, local motion, victim reports, input and progress.
- `src/ui.js`, `src/hud.js`, `src/settings.js`, `src/audio.js`: menus, match HUD, settings and synthesised audio.
- `server/accounts.mjs`: Account (per user) and Leaderboard Durable Objects; `shared/progress.mjs`: levels, rewards, challenges and caps; `src/account.js`: the browser client.
- `src/world/scene.js`, `src/world/props.js`: renderer, quality presets, effects and seasonal map art.
- `src/world/chars/`: Dylan's original character source; `characters.js` adds fight poses and hats.
- `src/world/lod.js`: simplified meshes baked from the original character geometry.

Live gameplay travels over WebSockets. HTTP is used to create/find a room. There is no match polling. Solo mode has no server dependency once the page and its bundle have loaded; it cannot load an uncached page during a hosting outage.

## Debugging

`?debug=1` (or Settings → Show FPS) shows the frame rate and ping. `?lag=120&jitter=30&loss=3` simulates delay and dropped movement messages at the application boundary. `?season=halloween|harvest|frost|meadow` selects a preview; `?date=2026-11-03` tests the local season. Online rooms use the server's selected season and do not change mid-match.

`?test=1` exposes local browser test hooks; it cannot grant authority over an online room. The online server validates commands independently.

## Source and rights

The chibi rig and the relevant geometry/appearance helpers were supplied by the repository owner on October 5, 2026. The original proportions and painted faces are retained. Only locomotion, pose blending, model construction and facial rendering are retained from that source. Garden props, paired gestures and photo-booth/bed animations were removed. No garden, café, chat, relationship or arcade gameplay is integrated. No external art/models/audio are downloaded at runtime. Three.js and development dependencies retain their own licenses. The owner has not selected a project license yet; none is implied here.
