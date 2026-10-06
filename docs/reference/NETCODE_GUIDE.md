# How my other game keeps screens in sync, and what to copy

This is a plain-English reading of the real code in `code/netcode-reference.md`. Every number below is taken from that code. The goal for the new game is the same one my kart racer, air hockey and boxing games already hit: **nobody ever waits on the network to see their own character move or their own throw leave their hand.**

## Three generations (only the third is acceptable for this game)

1. **HTTP + database + polling.** Every move is a database write and the other screen asks "anything new?" a couple of times a second. Perfect for checkers, hopeless for action: the other player's move shows up half a second late. My first kart racer worked this way (inputs every ~150 ms, the server simulating everything) and it jittered on phones.
2. **WebSocket "hint channel".** The database is still the authority, but a room object tells everyone "it changed, pull now". Instant for board games, still not a transport for action.
3. **Real-time relay over WebSocket.** One room object holds every player's socket and relays *validated* messages. Each screen simulates its own character locally and the games are designed so that the network only carries small facts. This is what kart (30 Hz snapshots), air hockey, boxing and the shared 3D garden (poses at ~12 Hz) use.

**Do not use generation 1 or 2 for anything that happens during a match.**

## The building blocks

1. **One room is one Durable Object.** Name it from the room code (`idFromName(code)`). It is the single place where order is decided and everyone's sockets live. It uses the hibernation API (`acceptWebSocket`), so an idle lobby costs nothing. See `server/room-socket.mjs`.
2. **Identity without logins.** Each browser makes a random 64-hex token. The WebSocket handshake carries it as a subprotocol (`tok.<token>`) because browsers cannot set headers on a WebSocket. The Worker checks it, tells the room which seat connected, and the room **stamps that seat onto every message it relays**. A client can never speak as someone else.
3. **Message hygiene.** The room drops anything not on a whitelist of message types, anything over 4 KB, anything that is not JSON. Every accepted message is **rebuilt field by field with numeric bounds** (`cleanKart`, `cleanBoxing`, `cleanHockey`): nothing extra rides along, impossible numbers are refused. Each socket also has a **token bucket** per message type (boxing: 60 messages a second, burst 120).
4. **A shared clock.** The client sends `clk` with its own `Date.now()`; the room answers with its own. The client keeps the last 12 samples from the last 60 seconds and **trusts the one with the lowest round-trip** (`offset = serverNow + rtt/2 - localNow`): a fast reply is the one least stretched by queueing. It pings every 250 ms for the first 8 samples, then every 3 s. Everything that has to happen "at the same time" (round start, a throw's release moment, a pickup respawning, a windmill's angle) is expressed in this shared time.
5. **Own-entity authority.** Each screen runs its own character with no waiting and sends **snapshots** (kart: 30 Hz, compact arrays). Nothing about my own movement ever depends on a reply.
6. **Interpolation for everyone else.** Remote characters are drawn **about 100 ms in the past**, blended between the two snapshots either side of that moment. The delay is *adaptive*: it stretches to cover the measured lateness of arrivals (never below 100 ms, never above 250 ms). If a snapshot is late the character carries on along its last velocity for **at most 300 ms**, then holds. A jump of more than 6 m is a teleport: snap, don't slide. See `createRemoteKart` in `public/kart-net.mjs` and `src/world/remote.mjs`.
7. **Events for discrete things, state for continuous things.** Anything that happens once (an item used, a punch thrown) is a small event with a **unique id** and the sender's shared-clock time. Receivers keep a dedupe log so a re-sent event is applied once. Every message also carries the **round number**, so a straggler from the last round is ignored.
8. **The victim decides.** In boxing, a punch is announced the moment it starts with the exact shared-clock tick it will land. The *target's own screen* checks its own recorded guard/dodge at that tick (kept in a two-second ring buffer so a hitched frame cannot turn a block into a hit), applies the result to itself and reports it. **So what you see happening to you is what happens to you, always.** The wind-up (a readable tell) hides the round trip, a small fairness pad (the measured one-way latency, capped at 50 ms) lengthens it, and a punch that arrives too late to be seen is given 120 ms of air or called off.
9. **A reliable layer where it matters.** Results, knockdowns and pauses get a `seq`, are re-sent until the other screen's heartbeat acknowledges them and are applied in order, so both screens end with the same log even across a dropout.
10. **Deterministic shortcuts.** Air hockey runs the same deterministic table on both screens from the shared clock (120 ticks a second) and only exchanges events; conflicting events are settled by "earlier tick wins" and replayed. For moving obstacles (a windmill, a ferris wheel) the same trick means **zero network traffic**: the angle is a pure function of room time.
11. **Resilience.** Reconnect with exponential backoff (1 s up to 20 s, with random jitter so two tabs do not knock in step), a keep-alive ping every 25 s (Cloudflare drops idle sockets at about 100 s), a re-check when the tab wakes or the network comes back, and a "send me everything" message (`hi`) on every (re)join.
12. **Tests with a fake network.** Two layers: (a) the room alone, driven by fake sockets, asserting what it relays, what it refuses and who it says the sender is (`tests/realtime.test.mjs`); (b) **two or more screens joined by a fake wire** with latency, jitter and dropouts, bots playing, then asserting both screens ended up in the same state (`tests/hockey.test.mjs`: 0, 35, 85-115 and 200-300 ms; boxing also adds a two-second dropout).

## What to copy for the snowball fight

| Need | Do this |
| --- | --- |
| Join by room code | A Worker route (`/ws/ABCD`) sends the socket to the Durable Object named by the code. |
| Who is who | Token in the subprotocol; the room stamps the seat on every relayed message. |
| My own movement | Simulate locally at 60 Hz. Send a snapshot 12 to 30 times a second depending on room size (see "Scaling to 20 players"). Never wait for a reply. |
| Other players' movement | Interpolate ~100 ms in the past, adaptive up to 250 ms, extrapolate at most 300 ms, snap on teleports. |
| A throw | **One event**: `{ id, release time (shared clock), origin, aim point, charge }`. Everyone simulates the identical ballistic flight from it, so no per-frame pelt traffic. A 120 ms wind-up animation plays on every screen; the event is sent at wind-up start with the release time in the future, so remote screens usually have it before it happens. |
| A hit | **The victim's screen decides** (swept sphere test every frame against pelts in flight, using its own true position and roll state) and reports `{ pelt id, time }`. The room validates (the pelt exists, was thrown by an enemy, has not already hit someone, was plausible at that time and place, victim not shielded or respawning) and then **owns** hearts, score and the splat announcement. |
| Scoreboard, hearts, ammo count, coins, match phase and timer | Authoritative in the room, derived only from validated events. |
| Power-up pickups | The room arbitrates "first claim wins" and broadcasts who got it. Pickup *spawns* are derived from the match seed and shared clock so nothing is sent for them. |
| Match start | The room picks `startAt = now + 4 s` and a random seed and tells everybody; every screen counts down to that shared instant. |
| Moving obstacles and map gimmicks | Pure functions of shared time. No traffic. |
| Reconnect | Same token, same seat for 60 s, a `hi` message, and the room replies with a full snapshot of roster, hearts, scores, timers and live pelts. |
| Solo play and bots | **Solo runs the same room logic inside the page** (a loopback with no network), exactly how my boxing game runs both sides of a bot fight on one page. It also means a lone visitor can always play, even if the server is down. Online, run the bots in the room if you can (so they survive any human leaving), otherwise on the host's screen with host migration. Bots send the same messages as a human. |
| Testing | A room-level test with fake sockets plus a multi-client network simulator (0, 50, 100, 200 and 300 ms, 30 ms of jitter, 3% loss, one 2 s dropout, bots throwing) asserting that every screen ends with the same scoreboard and that no pelt ever counts twice. |

## Latency budget (starting targets)

| Moment | Target |
| --- | --- |
| Press a key or stick: my character moves | the same frame (no network involved) |
| Press throw: arm starts to rise | the same frame; pelt leaves the hand 120 ms later |
| Another player's movement, as I see it | their true position from about 100 ms ago (up to 250 ms on a bad link) |
| A pelt thrown at me appears on my screen | before it is released if the link is under ~100 ms one way, otherwise mid-flight at the right place |
| Splat feedback for the thrower | one-way latency after the pelt arrives (the flight time is the buffer) |
| Reconnect after a dropped Wi-Fi | under 5 s, same seat, no restart |

## Scaling from 8 to 20 players (what my other game never needed)

My kart game relays every snapshot straight to every other socket and its grid stops at 8. That is fine for 8 and is a **bad fit for 20**: 20 players × 20 snapshots a second × 19 recipients is **7,600 sends a second** from one room object (simple arithmetic, not something I measured). This section is my engineering recommendation, not something in the attached code; everything else in this guide still applies.

1. **Batch into ticks.** The room keeps only the *latest* snapshot from each player and, every 50 to 83 ms, sends **one** `world` message to each client holding every other player's latest state **plus the events from that tick** (throws, power-up uses, splats). 20 players at 15 Hz is **300 sends a second**, about 25 times fewer, and positions and events now arrive together and in a single agreed order.
2. **Adapt the rate to the room size.** 30 Hz for 2 to 4 players, 20 Hz for 5 to 8, 15 Hz for 9 to 14, 12 Hz for 15 to 20. (My shared 3D garden already looks fine at about 12 Hz with a 140 ms interpolation delay.) Keep the interpolation delay at least **1.5 ticks plus the measured jitter**: at 12 Hz that means 140 ms or more.
3. **Make the world tick binary and tiny.** Quantise: x and z as 16-bit offsets in 1 cm steps from the map centre, facing in 256 steps (1 byte), velocity as two signed bytes in 0.1 m/s steps, flags as 1 byte, the player's slot as 1 byte, which is **9 bytes per player**. 20 players at 15 Hz is about **2.7 KB/s down per client** (the same data as JSON is roughly ten times that, which is rough on a cellular connection). Upstream a client sends about 11 bytes per snapshot. Keep readable JSON for rare things (join, splat, score, phase).
4. **Relevance tiers (optional, once it works).** Players within 14 m of the receiver at full rate, 14 to 28 m every 2nd tick, farther every 4th, and everybody at least 4 times a second so off-screen arrows and the scoreboard stay honest.
5. **A cheap room.** Hit validation is O(1) (look the pelt up by id). Per-player state in flat arrays, no allocation per tick. **One timer for the whole room, running only while a match or countdown is active**, so an idle lobby can still hibernate.
6. **One room, one data centre.** A room's object lives in one place. Create it with a **location hint** from the host's region so most players are near it. Players far away will always have a higher round trip; the adaptive interpolation absorbs it and the debug overlay shows it.
7. **Client budgets at 20.** Remote chibis need **three levels of detail**: full detail for yourself and the nearest ~6, a simplified version (no springs, merged hair and hat, about 12 to 16 meshes) for the mid range, and a single merged low-poly "impostor" for the far ones and for low-end phones. Skip animation updates for anything off-screen. Pool pelts, decals and particles; cap live pelts (~120) and ground decals (~60). Show name tags only for the nearest ~8. **Targets on a mid-range phone with a full 20-player match: at most 150 draw calls and 250,000 triangles, at 60 fps.**
8. **Capacity target**: 40 rooms of 20 players at the same time (800 players), with nothing shared between rooms except the **Directory** below. Prove it with the simulator at 10 rooms × 20 clients.

### Public rooms and Quick Play

Private rooms are joined by code and never listed. **Quick Play** adds *public* rooms:

- A single **Directory** object (a singleton Durable Object) knows the public rooms that are in their lobby phase: `{ code, players, max, minPlayers, mode, season, region, updatedAt }`. Rooms report to it when something changes (debounced to about 2 s) and an entry expires after 15 s of silence.
- **Quick Play** asks the Directory for the **fullest joinable lobby** near the player (and creates a new room when there is none). Protect it with a token and an IP-based rate limit.
- The lobby auto-start rules (minimum 4 to 8 players, a 20 s countdown that cancels if people leave) are enforced **by the room**, on the shared clock, so every screen shows the same countdown.

## The one thing to find out first

**Which real-time transport does the hosting here actually give you?** My other game uses Cloudflare Workers + Durable Objects (config in `wrangler.example.json`). Before any design work depends on it, do a "transport spike" on the public URL: a room that echoes, relays between two browsers and answers clock pings, with the round-trip shown on screen. In order of preference:

1. WebSocket to a per-room Durable Object (or any per-room single-instance WebSocket server).
2. Server-Sent Events down + batched POSTs up (50 ms batches). Still push, but upstream costs an extra half round trip.
3. Short polling. Last resort. If this is all that exists, **tell me plainly** and we change the design: longer wind-up, 250 ms interpolation, server-simulated pelts.

Whatever you choose, **say which it is and show me the measured round trip.**

## Mistakes to avoid

- Polling during a match. Sending full state every frame. Echoing a message back to its sender.
- Trusting a client for scores, hearts, coins or pickups.
- Using `setTimeout`/wall-clock time for anything two screens must agree on; use the shared clock.
- A background tab that keeps sending (pause on `visibilitychange`).
- Letting a client choose its own seat, name stamp or team in a relayed message.
- Claiming the netcode works without running the multi-client simulator.
