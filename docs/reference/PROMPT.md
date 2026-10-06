# Build me a live multiplayer 3D game: "Pelt Party" (working title)

You are my lead engineer and game designer. I want you to **design and build a real-time multiplayer 3D game** that lots of people can join from their own phones and laptops: **up to 20 players in one match**, joined by a **4-character room code** or by **Quick Play**, with **no login and nothing to install**. The match **starts by itself** once 4 to 8 players are in. It must stay perfectly in sync, feel instant, and look and feel like the cozy 3D world described below.

**Today is October 5, 2026. The official entry deadline is October 30, 2026 at 11:59 PM PT, so I want to submit on October 29.** The entry is a project title, a cover image, a description and a public link. I am using ChatGPT Work mode: use whatever build, run, test and deploy tools it gives you. If it cannot run code, host a public page or open real-time connections, tell me at once.

**Follow the process in section 1. Do not write code until I type APPROVED.**

---

## 0. What I attached (read all of it first)

| File | What it is |
| --- | --- |
| `GAME_BIBLE.md` | The complete game design: rooms and auto-start, modes, 17 maps, 12 characters, wardrobe, coin economy, 12 power-ups, seasons, screens, audio. **If it disagrees with this prompt, the bible wins.** |
| `NETCODE_GUIDE.md` | A plain-English guide to how my other game keeps screens in sync with very low latency, what to copy, and **how to scale it from 8 to 20 players**. |
| `CONTEST_NOTES.md` | The contest's official rules and judging criteria, and what they mean for this game. **Read "What this means for the game": it changes priorities.** |
| `images/01` to `07` | The chibi characters: the cast, a front/side/back model sheet, the painted faces, hair, outfits, hats and extras, and the animation poses. |
| `images/08` to `10` | The 3D world feel (afternoon, aerial, dusk). |
| `code/chibi-model-code.md` | The real code that draws and animates the chibi characters (Three.js). |
| `code/netcode-reference.md` | The real code of my real-time sync: the room (a Cloudflare Durable Object), the browser client, interpolation, hit resolution and the network-simulator tests. |

**This is a brand-new, separate game.** From my other game (lovebugs.world) I want exactly four things and nothing else: **(1) the chibi characters, (2) the 3D map feel, (3) the 3D game feel, (4) the real-time sync approach.** Do not copy its 2D menus, its pink theme, its garden gameplay or anything else.

---

## 1. How I want you to work

1. **Read everything attached.**
2. **Reply with** (and nothing else yet):
   - (a) the game in 10 bullets or fewer, in your own words;
   - (b) your **assumptions**;
   - (c) at most **6 questions**, only about things I have not already answered (section 11 lists what is still open);
   - (d) your **plan**: milestones with an acceptance test each (start from section 10 and improve it), and your **top 5 risks** (number one is real-time transport, number two is phone performance with 20 players on screen, number three is a judge who opens the link alone).
3. **Wait for me to type APPROVED.**
4. Build **one milestone at a time**. At the end of each one: deploy it, give me the **public link**, and give me a **checklist of what to test with real devices**. Wait for my OK before the next milestone.
5. When I report a bug I will use the format in section 9. Reproduce it, find the root cause, fix it, add a test so it cannot come back, and tell me exactly what changed and how I can verify it.
6. **Be honest.** If you did not run a test, say so. If something is impossible in this environment, say so and propose the closest alternative. Never say it works unless you ran it.
7. The contest rules are summarised in `CONTEST_NOTES.md` (the deadline is **October 30, 11:59 PM PT**). If I paste the full rules, follow them over anything here that conflicts.

---

## 2. The game in one paragraph

**Pelt Party** is a cozy 3D snowball fight for **2 to 20 players** where the "snowballs" are whatever the **season** says: squishy mini **pumpkins** in October (Halloween), crunchy **leaf-balls** in November, real **snowballs** in December. Everyone is a big-headed chibi seen from a tilted overhead camera. You scoop ammo from piles, lob it in an arc, roll to dodge, hide behind forts, grab power-ups, and get splatted three hearts at a time. Matches take three or four minutes. Tap **Quick Play** to drop into a public lobby, or make a private room and share a code. **Once 4 to 8 players are in, the match auto-starts.** You earn **Pelt Coins** that unlock new characters, costumes, pets, trails, emotes and secret maps. On the 1st of each month the world changes: new season, new maps, new music, new cosmetics. The tone is silly, warm and never mean.

## 3. Hard requirements (not negotiable)

1. A **public link** that opens on iPhone Safari, Android Chrome and desktop Chrome/Firefox/Edge/Safari. **No install, no login.**
2. **Up to 20 players in one match** (plus up to 10 watch-only spectators), with no lag spikes, in rooms of any size from 2 to 20.
3. **Auto-start**: when the **minimum number of players (4 to 8, the room's setting, default 6 in public rooms and 4 in private rooms)** has joined, a visible **20-second lobby countdown** starts by itself, rises a little when more people join, drops when everybody is Ready or the room is full, and **cancels if people leave**. Private-room hosts can also press **Start now** at any time (with 2 or more humans it starts as is; alone, bots fill the seats). The room enforces all of this on the shared clock. Details: bible section 3.4.
4. **Two ways in**: a **4-character room code** (consonants and digits only, no look-alikes, so a code can never spell a word) for private rooms, and **Quick Play** for public rooms that fill with other players. Create, join, rejoin, and spectate.
5. **Real-time with very low latency** (section 8). My own character and my own throws respond in the same frame. Other players are about 100 ms behind on a good connection (more as the room grows). A hit that looks like a hit to the victim **is** a hit.
6. **Every screen agrees**: the same scoreboard, hearts, timer, pickups, countdowns and season, at the same moment.
7. **60 fps on a mid-range phone, even with 20 players in the match**, and a fast first load (under 5 s on 4G, small code, **no downloaded art, models or audio**; everything is generated by code).
8. **Kid-friendly, including in public rooms**: no gore, no free-text chat, no links, no ads, no purchases, no personal data, no real money anywhere.
9. A new player understands the rules **without me explaining**: a 45-second guided tutorial match and clear icons.
10. A friend's Wi-Fi hiccup never ends the game: same token, same seat, automatic reconnect.
11. The **Halloween Edition** is what I submit and it **must stay reachable afterwards** (a visible "Play the Halloween Edition" button works in November and December), because it may be judged after the season changes.
12. A **debug overlay** (ping, jitter, clock offset, snapshot rate, packets late or dropped, players in room, room code, build number) behind a Settings toggle and `?debug=1`, and a **lag simulator** (`?lag=120&jitter=30&loss=3`) for testing.
13. **A lone visitor always gets a game.** The people judging this will probably open the link **alone**. From the landing page, **"Play vs bots" starts a full match within 10 seconds with nobody else needed, and it runs entirely in the browser (no server, no network)**, so it works even if hosting hiccups. In Quick Play, if the lobby is still below the minimum after 20 s, offer an opt-in **"Fill with bots"** (it starts when most of the humans present agree). **Never leave a player stuck on a waiting screen.**
14. **Edge cases and guidance are part of the product**: a wrong or expired room code, a full room, a name that is taken, a host who leaves (the room carries on and picks a new host), a lost connection, audio blocked until the first tap, a rotated phone, a tab in the background, a slow network, a browser without WebGL, first-time hints. The checklist is in `CONTEST_NOTES.md`.

### 3.1 What the contest judges, and what it means for the design

Every entry is scored 1 to 5 on four equal criteria (25% each): **Execution** ("fully functional, stable and demo-ready end to end"), **Creativity**, **Usefulness/Value** (does it delight its audience) and **Polish & Thoughtfulness** ("feels intentional and real, with thoughtful details, edge cases and clear guidance"). The entry is a **title, a cover image, a description and a link**. The **official deadline is October 30, 2026, 11:59 PM PT.** So:

1. **Reliability beats features.** A smaller game that never breaks scores higher than a bigger one that sometimes does; a broken link scores 1 on the heaviest criterion.
2. **Keep a stable link.** From the first playable milestone on, if you can host two deployments, keep a **stable** one (what I submit) and a **dev** one (where you work), and promote a build to stable only after its tests pass. If you can only host one, tag every release and be able to roll back in one step. **Feature freeze on October 27**; the 28th and 29th are for fixes, the entry kit and a last full test on real devices. Never ship an untested build in the last three days.
3. **The first 60 seconds are the demo**: the landing page, then "Play vs bots", then a match that already looks and feels great, with Quick Play and the room code one tap away.
4. **The link must keep working** after the deadline (winners are told up to 30 days later) and **after the season changes on November 1** (the Halloween Edition button).
5. **Deliver an entry kit at the end**: three title options, a cover image rendered from the game itself, a description of about 110 words that is true to what shipped, and the final link.

## 4. Look and feel (details in the bible, section 2)

- **The characters are my chibis.** Study images 01 to 07 and port `code/chibi-model-code.md`. A huge round head on a tiny body (the head is almost half the height), painted faces with big glossy eyes and rosy cheeks, soft chunky shapes, springy hair. **Do not redraw them and do not change their proportions.** Use `createChibi(look)`; add new animation states (throw, charge, roll, hit, splat, victory) through the exported `STATES` table; build costumes by attaching meshes to the rig; follow the notes at the top of the code file.
- **The maps feel like images 08 to 10**: low-poly, rounded, chunky, bright; trees as clusters of faceted blobs, bushes as overlapping spheres, soft shadows, a warm sun plus hemisphere light, ACES tone mapping, fog and a big sky, swaying grass, drifting petals/leaves, fireflies at dusk. Halloween is the same world at dusk: plum and magenta sky, orange pumpkins, glowing windows and lanterns, drifting fog and bats. Cute-spooky, never scary.
- **The game feels like my 3D games**: smoothed cameras, instant controls (keyboard + mouse, gamepad, and a phone twin-stick with big thumb buttons), squash and stretch, short hit-stop, particle bursts, floating "BONK!" text, a friendly announcer banner, confetti and a fanfare. Menus float over the live 3D scene on frosted-glass pills.
- **Everything is procedural**: geometry from code, textures painted on canvases, audio synthesised with Web Audio. Nothing downloaded.
- **Performance is a feature, and 20 players is the hard case.** One real chibi can be about 40 meshes and 25,000 triangles; twenty of them would be about 500,000 triangles, far too many for a phone. You must build **three levels of detail** for remote chibis (full for me and the nearest ~6, simplified with no springs for the mid range, one merged low-poly impostor for the far ones and for low-end phones), skip animating anything off-screen, pool pelts, decals and particles, merge or instance static scenery, cap the pixel ratio at 2, and **measure frame time on a real phone with 20 players**. Budget: **at most 150 draw calls and 250,000 triangles**. If you cannot hold 60 fps, cut before you add.

## 5. Gameplay (numbers are in the bible, section 3)

- 3 or 4-minute matches. **3 hearts.** A pelt hit costs 1, a direct Big Pelt costs 2, at 0 you go "splat" (3 s wobble, respawn with a 2 s shield).
- **Ammo** from **Pelt Piles** (stand in the ring to refill; one pile per 3 players). **Tap to lob** an arcing pelt at the aim point; **hold to pack** a Big Pelt. A 0.12 s **wind-up** (the arm rises) is the readable tell. Pelts follow a **ballistic arc**, so they fly over low cover but not tall cover.
- **Roll** to dodge (short, with invulnerability frames, on a cooldown). **Pack a fort** (a wall of crates, leaves or snow). Collect **Mystery Gourds** for one of **12 power-ups** (Triple Toss, Pumpkin Rain, Jack-o'-Lantern Shield, Boo Boots, Goo Bomb, Mega Gourd, Ghost Phase, Candy Heal, Bat Swarm, Scarecrow Decoy, Spooky Wall, Lovestruck Swarm).
- **Modes in v1**: Pelt Party (free-for-all), Team Pelt (two teams of up to 10, the default from 9 players up), King of the Patch. Later: Capture the Great Pumpkin, Last Bug Standing. Score limits scale with the player count.
- **Rooms**: private (a code, host controls, and **Start now** whenever the host likes: with 2 or more humans it starts as is, alone it fills with bots) and public (**Quick Play**: a vote on the map during the countdown, auto-start at the minimum, and an opt-in **Fill with bots** after 20 s below it). **Play vs bots** on the landing page is a solo match that needs nothing else. Late joiners can **drop in** during the first two-thirds of a match; teams stay balanced to within 1. After a match: results, then a "Next match" countdown under the same rules.
- Each of the 12 **characters** has stats (they sum to 15), a passive and a signature move. The look is separate from the character and always customisable.

## 6. Seasons and maps (the bible, sections 5 and 6)

| | October: HALLOWEEN | November: HARVEST | December: FROST |
| --- | --- | --- | --- |
| Title | Pumpkin Panic | Leaf Fort Frenzy | Snowball Showdown |
| Ammo | Pumpkin Pelts | Leaf Balls | Snowballs |
| Mood | plum dusk, big moon, fog, bats | golden hour, falling leaves | bright snow, aurora, string lights |
| Maps | Pumpkin Patch Panic, Haunted Hollow, Corn Maze Mayhem, Witch's Cauldron Cove, **Candy Corn Carnival** (secret) | Orchard Rumble, Cozy Cabin Clearing, Hay Bale Hollow, Cranberry Bog Bounce, **Harvest Fair** (secret) | Snowman Village, Frozen Pond Faceoff, Candy Cane Lane, Gingerbread Gulch, **Aurora Ridge** (secret) |
| New character | Count Cuddles | Juniper | Frostine |

- **The server picks the season from the UTC date**, fixed per room when it is created. Seasons are **data**: adding one must not touch game logic. After January, fall back to a plain **Meadow** season so the game always works.
- **Season Vault**: old seasons' maps and items stay playable and buyable forever.
- `?season=halloween` and `?date=2026-11-03` override the season for testing and judging.
- **Every map ships in two sizes**: *Standard* (up to 10 players) and *Grand* (11 to 20 players, the same map at ×1.5 width and depth with more piles, pads, props and spawn points). Define each map **once as data with a scale rule**.
- Every map has a **gimmick that is a pure function of shared time** (the Full Moon, the cauldron eruption, hay gates, a windmill, a Ferris wheel...), so it costs no network traffic.
- **Build order**: Pumpkin Patch Panic first, then Haunted Hollow, Witch's Cauldron Cove, Corn Maze Mayhem. **November and December are data and may arrive after I submit**, but the season engine must be in place.

## 7. Characters, wardrobe, coins (the bible, sections 7 to 9)

- 12 characters: Pip, Dot, Chad Beetle, Luna Moth, Sir Snailsworth, Bea & Bee, Mantis Mom, Flick, Gus, plus three seasonal ones. Their looks are given exactly in the bible and are valid `LOOK` objects for the attached code.
- **Wardrobe slots**: look, hat, face, back, hand prop, pelt skin, splat style, trail, emotes, victory pose, buddy (a tiny follower), nameplate. The bible lists about 60 Halloween items to build as new accessories in the same style as the attached hats and extras. **Rarity and prices** are in the bible.
- **Pelt Coins** are earned per match, per splat, for wins, daily first match, streaks, daily quests and milestones; spent in a shop with a daily "Featured" shelf, plus a free daily mystery gift. **XP and a free 30-tier Season Trail** unlock the seasonal character at tier 20.
- **No accounts.** A browser makes an anonymous profile (random token). Progress lives on the server keyed by a hash of the token, with a **Rescue Code** (three words) to move it to another device. **Payouts are computed on the server** from validated events; two-player rooms and bot matches pay half; leaving early forfeits bonuses.

---

## 8. Real-time multiplayer: the most important part

Read `NETCODE_GUIDE.md` and `code/netcode-reference.md` carefully. They describe how my other games (a kart racer, air hockey, boxing) stay in sync over real phones and laptops, and the approach is proven. **Copy the architecture, not the game rules.** My other games top out at 8 players, so the guide also says what must change for 20 (section 8.4 below).

### 8.1 What "low latency" means here

| Moment | Target |
| --- | --- |
| I press a key or move the stick: my character moves | the same frame (no network involved) |
| I press throw: my arm rises | the same frame; the pelt leaves my hand 120 ms later |
| Another player's movement, as I see it | their true position from about 100 ms ago (up to 250 ms on a bad link or in a big room) |
| A pelt thrown at me appears on my screen | usually before it is released, otherwise mid-flight in the right place |
| The thrower sees the splat | about one-way latency after the pelt arrives |
| A dropped connection comes back | under 5 s, same seat |
| Lobby countdown | identical on every screen (shared clock) |

### 8.2 Architecture

- **One room = one authoritative object** named by the room code. In my other game it is a **Cloudflare Durable Object** with hibernating WebSockets (see `server/room-socket.mjs` and `wrangler.example.json`). A Worker routes `/ws/ABCD` to it. Create it with a **location hint** from the host's region.
- **A Directory object** (one singleton) lists **public** lobbies for Quick Play (see the guide). Private rooms are never listed.
- **Identity**: a random token per browser, sent in the WebSocket subprotocol. The room stamps the sender's seat on every message it relays, so nobody can speak as someone else.
- **Message hygiene**: a whitelist of message types, a size cap, numeric bounds on every field, and rebuilding each accepted message from validated fields. A **token-bucket rate limit** per socket and message type.
- A **database** is only for profiles, coins, unlocks and shop state. **Nothing about a live match ever goes through a database or an HTTP request.**
- **No polling during a match. Ever.**

### 8.3 The netcode model (use exactly this unless the transport spike proves it impossible)

1. **Own-entity authority.** Each screen simulates its own chibi locally at 60 Hz and sends **snapshots** (rate by room size, see 8.4) as compact arrays: time, x, z, facing, velocity, flags.
2. **Interpolation.** Draw every other player **about 100 ms in the past** (more in big rooms: at least 1.5 ticks plus the measured jitter), blended between the two snapshots either side of that moment. Make the delay **adaptive** (stretch to measured lateness, between 100 and 250 ms). If a snapshot is late, extrapolate for **at most 300 ms**, then hold. A jump over 6 m is a teleport: snap.
3. **A shared clock.** A `clk` ping/pong; keep the last 12 samples within 60 s and **trust the lowest round trip**. Ping every 250 ms for the first 8 samples, then every 3 s. Everything two screens must agree on (lobby countdown, match start, throw release, pickup respawn, rotating obstacles, season-gimmick timers) uses this shared time, **never** local `setTimeout`.
4. **A throw is one event.** `{ id, release time (shared clock), origin, aim point, charge }`. Everyone simulates the same deterministic ballistic flight from it: **no per-frame pelt traffic.** The wind-up animation plays on every screen; the event is sent at wind-up **start** with a release time in the future, so remote screens usually have it before it happens.
5. **The victim decides hits.** Every screen tests the pelts in flight against **its own** character (swept sphere vs capsule, every frame, using the player's true position and roll state) and reports `{ pelt id, time }`. What the victim sees is what happens. A small fairness pad (measured one-way latency, capped at 50 ms) may lengthen the wind-up.
6. **The room owns the truth about outcomes.** It validates each hit (the pelt exists, was thrown by an enemy, has not hit anyone yet, was plausible at that place and time, the victim is not shielded or respawning) and then **owns** hearts, scores, ammo counts, coins, the lobby and match phase and timers, and power-up claims (first claim wins). It broadcasts `splat`, `score`, `ammo`, `pu`, `phase` and `lobby` messages.
7. **Ids, dedupe and rounds.** Every event has a unique id and is applied once; every message carries the match number so a straggler from the last match is ignored. Important results can be re-sent until acknowledged (see the reliable layer in the boxing excerpt).
8. **Deterministic gimmicks.** Anything that moves on its own (windmill sails, Ferris wheel, hay gates, eruptions, pickup spawns, the King of the Patch circle) is a pure function of the **match seed and the shared clock**. The room sends the seed and `startAt` once.
9. **Resilience.** Reconnect with exponential backoff and jitter; a keep-alive ping every 25 s; re-check when the tab wakes or the network returns; a `hi` message on every join; the room answers a rejoin with a full snapshot (roster, hearts, scores, timers, live pelts). Stop sending from hidden tabs.
10. **Bots** (milestone 3 for solo, milestone 4 for online). **Solo "Play vs bots" runs entirely in the browser**: the same room logic running in the page against local bots (my boxing game runs both sides on one page the same way), with no network. **Online bot-fill** is run by the **room** if the transport allows (so it keeps working when any human leaves), otherwise on the host's screen with host migration. Bots send exactly the same messages as a human, come in three levels (Rookie, Regular, Ace) and never see through walls. A public room never adds bots silently: it only offers "Fill with bots" after 20 s below the minimum. Bot matches pay half the coins.

### 8.4 Scaling to 20 players (my other games never needed this; do it from the start)

The direct "relay every snapshot to everybody" design of my kart game does **7,600 sends a second** at 20 players. Instead:

1. **Batch into ticks.** The room keeps the latest snapshot per player and every 50 to 83 ms sends **one `world` message per client** containing every other player's latest state **plus that tick's events** (throws, power-up uses, splats). About 300 sends a second for 20 players.
2. **Adapt the snapshot rate to the room size**: 30 Hz for 2 to 4 players, 20 Hz for 5 to 8, 15 Hz for 9 to 14, 12 Hz for 15 to 20.
3. **Make the `world` tick binary and tiny**: positions in 1 cm steps as 16-bit offsets, facing in 1 byte, velocity in 2 bytes, flags in 1 byte, slot in 1 byte, about **9 bytes per player**, about **2.7 KB/s down per client** at 20 players. Readable JSON for rare messages only. (Start with JSON in the first milestones and switch the tick to binary in the scale milestone.)
4. **Optional once it works**: relevance tiers (near players at full rate, far players at a quarter, everyone at 4 Hz or better).
5. **One timer per room, only while a lobby countdown or a match is running**, so an idle lobby can hibernate. Hit validation O(1). No per-tick allocation.
6. **Budgets**: at most about 10 KB/s down and 2 KB/s up per client in a full room; at most about 120 live pelts and 60 ground decals; name tags for the nearest 8 only.
7. **Capacity target**: 40 rooms of 20 players at the same time. Prove it with the simulator at 10 rooms of 20 clients.

### 8.5 Transport reality check (milestone 0, before anything else)

I do not know what real-time transport this environment provides. **Find out first** with a "transport spike" on the public URL: a room that echoes, relays between two browsers and answers clock pings, with the round trip shown on screen. In order of preference:

1. **WebSocket to a per-room Durable Object** (or any single-instance WebSocket server per room).
2. **Server-Sent Events down plus batched POSTs up** (50 ms batches).
3. **Short polling.** Last resort. If this is all that exists, **tell me plainly before going on**, because it changes the design (longer wind-up, 250 ms interpolation, a server that simulates pelts) and 20 players may not be feasible.

Whatever you choose: **say which it is and show me the measured round trip.** Do not silently fall back.

### 8.6 Suggested messages (change them if you have a better idea)

Client to room: `hello {name, character, look, version}` · `clk {c}` · `snap [tm,x,z,facing,vx,vz,flags]` · `throw {id,tm,x,z,aimX,aimZ,charge}` · `hit {pelt,tm,x,z}` · `roll {tm,facing}` · `refill {pile}` · `claim {pad,n}` · `use {id,tm,kind,x,z,facing}` · `fort {id,tm,x,z,facing}` · `emote {e}` · `ready {on}` · `vote {map}` · `pick {character,look}` · `settings {...}` (private host) · `start` (private host) · `hi`.

Room to clients: `welcome` (full state) · `lobby {players, min, countdownEndsAt, votes, map, mode}` · `phase {phase,startAt,seed,season,map,mode,size}` · **`world` (the batched tick: everyone's latest state plus the tick's events, each stamped with `by`)** · `splat {by,victim,pelt,hearts,dmg,tm}` · `ammo {id,n}` · `score {...}` · `pu {pad,n,by,kind}` · `end {results,payouts}` · `clk {c,now}` · `pong`.

### 8.7 Tests I require (and I want to see them run)

1. **The room as a unit**, with fake sockets: what it relays, what it refuses (bad types, oversize, out-of-range numbers, a wrong `by`), who it stamps, rate limits, the hit validator (double hit, friendly fire, shielded victim, impossible geometry), and the **auto-start rules** (minimum 4 to 8, the 20 s countdown, a join raising it, everyone Ready lowering it, a full room, a leave cancelling it, a private host's Start now, drop-in, team balance, map vote ties).
2. **A network simulator**: **2, 8 and 20 virtual clients** joined to a real room by a fake wire with one-way latency of **0, 50, 100, 200 and 300 ms**, **30 ms jitter**, **3% loss**, and one **2-second dropout**, bots running and throwing for several simulated minutes. **Assert** that every client ends with the same scoreboard, that no pelt ever counts twice, that interpolated positions stay within a tolerance of the truth, that the lobby countdown agrees on every client to within one tick, that bytes per client stay inside the budget in 8.4, and that reconnects restore the seat.
3. **Rules tests**: the season for a given date (including month boundaries and the UTC rule), economy payouts and caps, the daily soft cap, hit geometry, score-limit scaling, and **map validity at Standard and Grand size** (everything inside bounds, spawns and piles not inside props, every spawn can reach every pile and every other spawn, team spawns mirror).
4. A **soak test**: a full 20-client room for 10 minutes with no growth in memory or message queues, then 10 rooms at once.

## 9. Testing, debugging and the bug-report format

- At the end of each milestone: a **checklist** I can follow with real devices (for example: "On phone A create a room and read me the code. On laptop B join with it. Both press Ready... You should see..."). Include what the debug overlay should read. From milestone 4 on, include a **many-players test I can run alone** (for example a button that fills the room with simulated clients) because I will not always have 20 people.
- **When something breaks I will write:**

```
BUG: <one line>
Where: room code, public or private, players in the room, map, mode, season
Devices and browsers (all players involved):
Steps: 1. ... 2. ...
Expected:
Actual:
How often: always / sometimes (1 in N) / once
Debug overlay (ping, jitter, offset, snapshot rate):
Screenshot or short video: (attached)
```

- **You respond with**: your reproduction (or why you could not), the **root cause** with evidence (a log, a failing test), the fix, the regression test, and a one-line way for me to verify. If you cannot reproduce it, ask me for exactly one more piece of information.
- Keep a **CHANGELOG** and show the **build number** on screen.

## 10. Milestones (improve this in your plan)

Rough calendar: M0 by Oct 7, M1 by Oct 9, **M2 (first playable) by Oct 12**, **M3 (a submit-ready Minimum Lovable Entry) by Oct 14**, **M4 (20 players, Quick Play, auto-start) by Oct 17**, M5 by Oct 20, M6 by Oct 23, M7 by Oct 26, **feature freeze Oct 27**, M8 on Oct 27 to 28, **M9 (entry kit) and submit on Oct 29** (the official deadline is Oct 30, 11:59 PM PT). If you are behind, tell me and propose cuts.

| # | Milestone | Done when |
| --- | --- | --- |
| **M0** | **Transport spike** | A public page where two browsers join a room by code, see each other's cursor, answer clock pings and show a live round trip. I know which transport we are using and the measured latency. |
| **M1** | **Two chibis, one yard** | Private rooms by code, a basic lobby, nickname, character pick; chibis (ported code) walking around a flat test map on 2 to 8 devices with interpolation; the debug overlay and lag simulator; reconnect. |
| **M2** | **Throw and splat (first playable)** | Piles, ammo, lob and Big Pelt with wind-up, ballistic flight, victim-decided hits validated by the room, hearts, splat and respawn, scoreboard, 3-minute timer, results screen, Pelt Party mode on **Pumpkin Patch Panic**. Room and network-simulator tests pass at 2 and 8 clients. |
| **M3** | **Minimum Lovable Entry** | Touch controls and gamepad, camera, procedural audio, particles and hit juice, quality tiers; the landing page; **Play vs bots, running in the browser**, with simple bots at three levels; the 45-second guided tutorial and first-time hints; spectators; the edge cases from `CONTEST_NOTES.md` that apply so far; a stable link and a phone performance report. **If everything after this failed, this is already a complete entry I could submit.** |
| **M4** | **Scale to 20** | The batched binary `world` tick and adaptive rates; **three-level chibi LOD**; the **Grand** layout; the **Directory**, **Quick Play** and public rooms; the **auto-start lobby** (minimum 4 to 8, the shared countdown), the map vote, drop-in and team balance; online **Fill with bots** after 20 s below the minimum; a "fill the room with simulated players" button for solo testing. Simulator and soak tests pass at 20 clients; a real-phone frame-time report with 20 on screen. |
| **M5** | **The full fight** | Roll, forts, Team Pelt, King of the Patch, 6 then 12 power-ups, signature moves, the first 4 characters. |
| **M6** | **Coins and wardrobe** | Anonymous profile and Rescue Code, coins and XP computed by the room, the shop and Mirror, wardrobe and the first 30 Halloween items, the Season Trail, daily quests and the free daily gift, all 12 characters. |
| **M7** | **Maps and seasons** | The four Halloween maps and Candy Corn Carnival at both sizes, the season engine with the UTC rule, the Vault and overrides, a Harvest and a Frost pack behind `?season=` (can be rough). |
| **M8** | **Hardening** | Soak and load tests (10 rooms of 20), security review (validation, rate limits, privacy, public-room safety), accessibility pass, a full run of every test, the whole edge-case checklist, a launch checklist, and a written "how to play" page. |
| **M9** | **Entry kit and submit** | Three title options, a cover image rendered from the game, the description, the final stable link tested in a private window on a phone and a laptop from another network, and the 2-minute judge demo from `CONTEST_NOTES.md` rehearsed end to end. |

**Must be in the submission**: M0 to M6, M8 and M9, and at least three Halloween maps (from M7). Everything else is a bonus; propose the order of cuts in your plan. **You may cut anything except the stable link, Play vs bots and reliability.**

## 11. Still open (you may ask me about these, and only these)

1. The final **name** (give me three alternatives to "Pelt Party").
2. If the transport spike shows a **cost or capability limit** that forces a choice (for example it cannot do 20 players).
3. The **minimum-players default** (my default: 6 for public rooms, 4 for private).
4. The **bot levels** and how hard Ace should be (my defaults: Rookie, Regular and Ace, with reaction times of 600, 350 and 150 ms).
5. **Test devices** (my default: iPhone Safari, Android Chrome, laptop Chrome).
6. Anything in the bible you think **cannot ship by October 29**; propose cuts (my default order: the November and December packs, then buddies, then Candy Corn Carnival, then the Grand layout of the secret maps, then some wardrobe items). **Never cut the stable link, Play vs bots or reliability.**
7. Any **character or item names** you think should change.

## 12. Do and do not

**Do**: generate everything by code; keep seasons, maps, characters, cosmetics and the economy as **data**; make every gimmick a function of shared time; keep the room authoritative for outcomes, countdowns and money; batch the world tick; write the tests in section 8.7 and **show me they run**; show measured numbers (round trip, frame time, bytes per client) rather than claims; keep a changelog; keep a stable link apart from the dev link.

**Do not**: poll during a match; relay every snapshot to every player one by one once a room is bigger than 8; send per-frame pelt positions; trust a client for scores, hearts, ammo, coins, pickups or the countdown; add logins, free-text chat, ads or purchases; download art or audio; build November and December content before the Halloween core plays well; silently cut scope; develop on the link I will submit; ship an untested build in the last three days; or say something works that you did not run.

Now: read everything, then give me the reply described in section 1, step 2.
