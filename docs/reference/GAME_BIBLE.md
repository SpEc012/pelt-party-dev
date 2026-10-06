# PELT PARTY: the game bible

*Working title. Rename it freely; it should be one constant in the code.*

This is the full design for the game described in `PROMPT.md`. If the two ever disagree, **this file wins**. Every number is a **starting value to be tuned in playtests**, not a law.

Contents: 1 Pitch · 2 The feel · 3 How a match plays (incl. rooms and auto-start) · 4 Modes · 5 Seasons · 6 Maps · 7 Characters · 8 Wardrobe and unlockables · 9 Coins and progression · 10 Power-ups · 11 Screens and flows · 12 Audio · 13 Kindness, safety, accessibility · 14 Stretch goals

---

## 1. Pitch

**Pelt Party is a cozy 3D snowball fight for 2 to 20 players where the "snowballs" are whatever the season says they are.** In October you lob squishy mini **pumpkins** that burst into orange goo and seeds. In November it is puffy bundles of crunchy **autumn leaves**. In December it is real **snowballs**. Everyone is a big-headed chibi, everyone gets splatted, and the losers get hugged.

You open a link on any phone or laptop and either tap **Play with friends** (you get a 4-character room code like `K7PM` and friends type it in) or **Quick Play** (you drop into a public lobby with up to 20 other people). Once 4 to 8 players are in, the match **starts by itself**. No logins, nothing to install. A match lasts three or four minutes. You earn **Pelt Coins** that unlock new characters, costumes, pets, trails, emotes and secret maps. On the 1st of each month the whole world changes: new season, new maps, new music, new cosmetics.

The tone is **silly, warm and never mean**: no gore, no insults, no blood. A "splat" is a goo puff and a dizzy cartoon wobble.

---

## 2. The feel: what to take from my other game, and what to ignore

My other game (lovebugs.world) is a site full of cozy 3D games. **Take only three things from it: the chibi characters, the 3D map feel, and the 3D game feel.** Ignore everything else about it (its 2D menus, its pink theme, its garden gameplay, its love notes). Pictures are in `images/`, code is in `code/`.

### 2.1 The chibi characters (images 01 to 07, code in `code/chibi-model-code.md`)

- A **huge round head on a tiny body**: the head is almost half the character's height (about 2¼ heads tall). Short stubby limbs, no visible neck, big soft hands.
- **Painted faces**: large glossy eyes with two highlights, rosy cheeks, a tiny mouth. Twelve eye frames and nine mouth frames swapped from a painted atlas (image 03). The faces carry all the emotion, so keep them expressive: BONK eyes (`squint`, `wide`, `star`), cheering (`happy`, `grin`), splatted (`sad`, `down`, spiral eyes if you add them).
- **Soft, chunky, rounded shapes** with a faint fresnel rim light so they lift off the ground. Hair is a shell with springy locks that swing. Clothes have small details (hoodie strings, knit texture, overall straps).
- **Twelve hair styles, six eye styles, ten tops, six bottoms, six shoe styles, nine hats and nine extras**, in any colour (images 04 to 06). The animation vocabulary (image 07): idle, walk, run, crouch to scoop, hop, cheer, wave, dance, bow, laugh, sleep.
- **Use the attached code as the real thing.** Do not redraw them from scratch and do not change their proportions. Port `createChibi()`, add the new animation states (throw, charge, roll, hit, splat, victory) through the exported `STATES` table, and build costumes by attaching meshes to the rig, exactly as the notes at the top of `chibi-model-code.md` describe.

### 2.2 The 3D map feel (images 08 to 10)

- **Low-poly, rounded, chunky, pastel-bright.** Trees are clusters of faceted blobs on tapered trunks; bushes are overlapping spheres; rocks are squashed icosahedrons; props have soft bevels; no outlines, no photographic textures. Colour comes from vertex colours and a few painted canvas textures.
- **Lighting**: sRGB output, ACES filmic tone mapping at exposure about 1.1, one warm shadow-casting sun with soft shadows plus a hemisphere light, distance fog, a big sky gradient with hills on the horizon. Characters get a faint rim light. Small things get blob shadows instead of real ones.
- **Life**: instanced grass blades that sway, drifting petals/leaves, fireflies at dusk, glowing windows and string lights at night, gentle particle bursts for every action.
- **Everything is procedural**: geometry from code, textures painted on canvases at start-up, sound synthesised. **Nothing is downloaded** (no models, no images, no audio files). This keeps load times tiny and means the whole game is just code.
- **Performance**: static scenery merged into a handful of meshes (one draw call per material), repeated things instanced, three quality tiers (low / mid / high) chosen from the device, pixel ratio capped at 2, 60 fps on a mid-range phone.

### 2.3 The 3D game feel (my kart, boxing and putt-putt games)

- **Cameras**: smoothed chase or orbit cameras with a little look-ahead; they never snap except on teleports.
- **Controls**: keyboard + mouse, a gamepad, and on phones a virtual stick plus big thumb buttons. **Every action responds within one frame.**
- **Juice**: squash and stretch, short hit-stop on big hits, particle bursts, optional light camera shake, floating "BONK!" text, a friendly announcer banner ("Round 1... FIGHT!"), confetti and a fanfare at the end.
- **Audio**: all synthesised with Web Audio (SFX plus a looping chord-score of music per scene); unlocks on the first tap; mute switches.
- **Menus** float over the live 3D scene on **soft frosted-glass pills** (blurred translucent cream, big rounded corners, soft shadow).
- **Tone**: cozy and silly. Knockouts are floppy cartoon wobbles, not violence.

---

## 3. How a match plays

### 3.1 In ten lines

1. Everyone joins a room (a 4-character code, or Quick Play) and picks a character and outfit. Everyone presses **Ready**.
2. As soon as the minimum number of players is in (4 to 8, see 3.4), a **lobby countdown starts by itself**; players vote on the map. Then a shared 4-second countdown ends in **GO** on every screen at the same instant.
3. You run around a 3D arena seen from a tilted overhead camera.
4. Stand in a **Pelt Pile** ring to restock ammo automatically.
5. **Tap to lob** a pelt at where you are aiming. **Hold to pack** a Big Pelt (a ring fills), release to throw it farther and harder.
6. **Roll** to dodge. **Pack a fort** to hide behind. Grab glowing **Mystery Gourds** for power-ups.
7. You have **3 hearts**. A hit costs 1 (a direct Big Pelt costs 2). At 0 you go "splat", wobble for 3 seconds and respawn with a sparkle shield.
8. Splats score points. Time runs out (or someone reaches the score limit).
9. A podium, awards ("Sharpshooter", "Dodge Master", "Most Hugged"), a coin payout animation.
10. **Rematch** with one tap, or change the map.

### 3.2 Controls

| Action | Desktop | Phone | Gamepad |
| --- | --- | --- | --- |
| Move | WASD / arrows | left virtual stick | left stick |
| Aim | mouse position (world point under the cursor) | right virtual stick (drag; further = longer throw) | right stick |
| Throw / pack a Big Pelt | left click (tap = lob, hold = pack, release = throw) | release the right stick (a quick flick = lob; auto-aim assist on a flick) | right trigger |
| Roll | Space | button | A |
| Use power-up | E | button | X |
| Pack a fort | Q (hold) | button (hold) | Y (hold) |
| Emote wheel | T or 1 to 6 | button | D-pad |

Left-handed layout switch on phones. Everything is also reachable with a single thumb in landscape.

### 3.3 Starting numbers

| Thing | Value |
| --- | --- |
| Players per match | **up to 20** (plus up to 10 watch-only spectators). **Auto-start needs 4 to 8 players** (host-set, default 6). See 3.4. |
| Match length | 3:00, or 4:00 with 12 or more players (2 / 3 / 4 / 5 selectable). Countdown 4 s. |
| Arena size | **Standard** (up to 10 players) as described in 6; **Grand** (11 to 20 players) is the same map at ×1.5 width and depth. |
| Hearts | 3 (3 or 5 selectable) |
| Character hit shape | capsule, radius 0.42 m, from the ground to 1.25 m |
| Walk speed | 5.2 m/s times the character's speed factor (0.8 to 1.2). Top speed in 0.12 s. |
| Roll | 0.28 s, 4.2 m, invulnerable for the first 0.2 s, 2.2 s cooldown |
| Ammo | carry cap 6 (character 4 to 7), start with 3 |
| Pile refill | 1 pelt per 0.4 s while standing in the pile's ring (radius 1.4 m; about 6 chibis fit). Piles never run out. Number of piles: **one per 3 players, at least 4**. |
| Throw wind-up | 0.12 s (the arm rises; this is the tell opponents see) |
| Quick lob | costs 1 pelt, 1 heart, range up to ~9 m, flight 0.55 to 0.8 s |
| Big Pelt | hold 0.9 s (a ring fills), costs 2 pelts, range up to ~14 m, flight up to 1.0 s, direct hit 2 hearts, splash radius 1.2 m for 1 heart |
| Pelt flight | an arc with gravity 14 m/s². Flight time `T = 0.45 + 0.04 × distance`. Vertical speed solved so it lands at the aim point. Height at time t: `y = 1.0 + vy·t - 7·t²`. |
| Pelt size | radius 0.18 m. Hit test is a swept sphere against the character capsule, every frame. |
| Cover heights | low 0.9 m or less (arcs clear it mid-flight but not near the throw or the landing), tall 1.4 m or more (blocks everything) |
| Splatted | wobble 3 s, respawn with 3 ammo, 2 s shield, lose any held power-up |
| Fort | hold 0.6 s, costs 3 pelts, wall 1.8 m wide and 0.9 m high, 6 hit points (pelt 1, Big Pelt 2), lasts 20 s, 3 per player |
| Power-up pads | first Mystery Gourd at 0:15, then 20 s after each pickup. Number of pads: **one per 3 players, at least 4**. |
| Spawn points | players + 4, spread and mirrored |
| Score limits | Pelt Party first to `8 + players` splats (max 30); Team Pelt first to `15 + 2 × players` (max 60) |
| Emotes | 6 slots |
| Team friendly fire | off (pelts pass through teammates) |

**Feel notes**: pelts spin in flight and have a blob shadow on the ground so the landing spot reads. Your own Big Pelt shows a landing ring (only to you). A hit gives 60 ms of hit-stop, a squash on the target, a goo splat stuck to their torso for 2 s, a splat decal on the ground for 8 s, a "BONK!" pop, a heart-pop above the target and a haptic buzz on phones.

### 3.4 Rooms, lobbies and auto-start

- **Three ways to play.** A **private room** is joined by a 4-character code; its host can press **Start now** any time (with 2 or more humans it starts as is; alone, bots fill the seats). A **public room** is what **Quick Play** puts you in; it auto-starts at the minimum. **Play vs bots** is a solo match that needs no one else (see 3.5).
- **Capacity**: up to **20 players** per match, plus up to 10 watch-only spectators. When the room is full, further people can only watch. **Drop-in**: a late joiner may enter during the first two-thirds of a match (3 hearts, 3 pelts, a 2 s shield, a spot on the smaller team); after that they watch until the next match.
- **Minimum to auto-start: 4 to 8 players**, the room's *Min players* setting. Default **6** for public rooms and **4** for private rooms. Team modes need an even number of at least 4.
- **The auto-start countdown**:
  1. Below the minimum the lobby says "Waiting for players (3/6)" and shows who is here.
  2. The instant the minimum is reached, a **20-second "Match starting" countdown** begins on every screen.
  3. Each new player who joins raises it back to at least 10 s (never more than 45 s in total since the minimum was reached). When **everyone** has pressed Ready it drops to 5 s. If the room fills to 20 it drops to 5 s.
  4. If players leave and it falls below the minimum, the countdown **cancels** ("Waiting for players (5/6)").
  5. At 0 the shared 4-second match countdown runs and everyone is dropped into the arena at the same instant.
- **Map and mode in public rooms** are decided by a quick **vote** during the countdown (three random maps from the season, one vote each, ties broken at random). The mode follows the player count: 4 to 8 players Pelt Party or Team Pelt, 9 to 20 Team Pelt or King of the Patch (Team Pelt by default). Private-room hosts choose directly.
- **Teams** are auto-balanced (the sizes never differ by more than 1; late joiners go to the smaller team). Up to 10 v 10.
- **After a match**: results for 12 s, then back to the lobby with a "Next match" countdown under the same rules. A public room lives as long as one human is in it.
- **Nobody is ever stuck waiting.** If a public lobby is still below the minimum after **20 seconds**, a **"Fill with bots"** button appears. It starts when most of the humans present press it. A public room never adds bots on its own.

### 3.5 Bots and solo play

The people judging this game will probably open it **alone**, so a lone visitor must reach a real, fun match in seconds.

- **Play vs bots** (the big button on the landing page): starts within 10 seconds. The player picks a character (or keeps the last one), a **difficulty** (Rookie, Regular or Ace) and a size (4, 8 or 12 players including bots; default 8). It **runs entirely in the browser** (the same room logic running in the page, no server, no network), so it works even when the hosting is having a bad day. A brand-new player's first match is the 45-second guided tutorial.
- **Fill with bots** in a public lobby (above) and in private rooms: bots fill empty seats **up to the minimum, never above it**. Online, the bots are run by the room (so they survive any human leaving); if that is impossible they run on the host's screen with host migration.
- **Bots are clearly bots**: a small "bot" tag on the name, shown as bots on the results screen. They pay **half** the coins and XP.
- **Bot behaviour** (starting values): head for the nearest pile when ammo is 1 or less; otherwise approach to about 8 m of the nearest *visible* enemy (they never see through walls or fog); aim with an error of ±18° (Rookie), ±9° (Regular) or ±3° (Ace) and a reaction delay of 600, 350 or 150 ms; lob when in range and the line is not blocked by tall cover; roll when a pelt is predicted to hit within 0.4 s (30%, 60% or 90% of the time); grab power-ups and use them sensibly; run to a Candy Heal when on 1 heart. Bot names come from the cast, with "(bot)".
- **Bots send exactly what a human sends**, so the rest of the game cannot tell the difference.

---

## 4. Modes

| Mode | Rules | Build in |
| --- | --- | --- |
| **Pelt Party** (free-for-all) | Everyone for themselves. First to `8 + players` splats (max 30), or most when time ends. Great with 4 to 12; chaotic and fun with 20. | v1 |
| **Team Pelt** | Two teams of up to 10, auto-balanced. First to `15 + 2 × players` (max 60) or most. Team names and colours change with the season (see 5). Team icons are shapes as well as colours. The default mode for 9 or more players. | v1 |
| **King of the Patch** | A glowing circle (radius 3 m) is on the map; stand inside alone (or only with teammates) to score 1 point per second. It jumps to a new spot every 30 s. | v1 |
| **Capture the Great Pumpkin** | Each team has a giant pumpkin in its base. Carry the enemy's home (you move 30% slower and cannot roll). First to 3 captures. | v2 |
| **Last Bug Standing** | 3 lives, no respawn timer. Eliminated players become ghosts who can only ping the map. | v2 |
| **Co-op: Great Gourd Rush** | Everyone versus waves of cute ghost "Boo-gies" and a boss. | stretch |

Host options (private rooms): map (or random), mode, time, hearts, score limit, min players (4 to 8), power-ups on/off, bots to fill empty seats (see "Bots" in `PROMPT.md`). In public rooms these are chosen by the vote and the player count. **Later**: a 4-team variant (4 teams of 5) for 16 to 20 players.

---

## 5. Seasons

### 5.1 The calendar

| | **October: HALLOWEEN** | **November: HARVEST** | **December: FROST** |
| --- | --- | --- | --- |
| Season title | *Pumpkin Panic* | *Leaf Fort Frenzy* | *Snowball Showdown* |
| Dates | Oct 1 to Oct 31 | Nov 1 to Nov 30 | Dec 1 to Dec 31 (and January) |
| Ammo | **Pumpkin Pelts** (squishy mini pumpkins; Big = a glowing jack-o'-lantern) | **Leaf Balls** (puffy bundles of leaves; Big = a giant acorn) | **Snowballs** (soft, poofy; Big = a shimmering ice pelt) |
| Sky and light | plum-to-magenta dusk, a big smiling moon, warm orange key light, pink-magenta rim, purple fog | golden hour, long soft shadows, honey-coloured fog | bright pale-blue day with an aurora at night, cool fill, warm lantern gold |
| Palette | plum `#24123d`, magenta `#9a4a74`, pumpkin `#ff8a2a`, candy-corn `#ffd45a`, slime `#8fe36b`, bone white | amber `#f0a54a`, rust `#c8602a`, sage `#9fb07a`, cream, brown | ice `#9fd0ff`, snow white, mint `#bff2e0`, cranberry `#d94a6a`, gold |
| Particles and weather | drifting fog wisps, falling leaves, bats crossing the moon, will-o'-the-wisps | falling leaves, floating dust motes, a light drizzle some matches | snowfall, sparkling flakes, string-light twinkle |
| Music | spooky-cute: celesta and pizzicato in a minor key, a wobbly theremin | warm acoustic plucks, a fiddle-ish lead, relaxed | sleigh-bell sparkle, soft piano, music-box |
| Teams | **Cherry Bugs** (red, ladybug icon) vs **Pumpkin Pals** (orange, pumpkin icon) | **Acorn Crew** (brown, acorn icon) vs **Maple Gang** (red-orange, leaf icon) | **Cocoa Club** (brown and cream, mug icon) vs **Mint Squad** (mint, candy icon) |
| Coin icon | pumpkin-stamped | leaf-stamped | snowflake-stamped |
| Power-up container | Mystery Gourd | Acorn Basket | Gift Box |
| Seasonal character | **Count Cuddles** | **Juniper** | **Frostine** |

**Between Jan 1 and Sep 30**: keep Frost through January, then fall back to a plain **Meadow** season (flower-puff ammo, bright day light, the two Meadow maps) until I add more seasons. The game must always have a working season.

### 5.2 How the switch works

- The **server** decides the season from the current **UTC** date. A room's season is fixed when the room is created, so a match never changes theme mid-game. New rooms after midnight UTC on the 1st use the new season.
- A "New season!" splash plays the first time a player sees a new season (remember the last-seen season on the device). A small banner shows "Halloween ends in 12 days. Harvest starts Nov 1."
- **Season Vault**: past seasons' maps and items stay playable and buyable forever. The host can pick any season they have unlocked in the lobby. Vault items cost 50% more than they did in season.
- **Overrides for testing and for judges**: `?season=halloween|harvest|frost|meadow` forces a season; `?date=2026-11-03` pretends it is that day. A visible **"Play the Halloween Edition"** button must work in November and December, so the October version can always be shown.
- All season content is **data** (a season object: ammo type, colours, lighting rig, particle type, music score, props, maps, cosmetics, teams). Adding a season later must not touch game logic.

---

## 6. Maps

Seventeen maps: **five per season** (four free, one secret you unlock) and two Meadow maps. Every map is a flat-ground arena with props, mirrored left-to-right for fairness in team modes. The sizes written below are the *Standard* size, 24 to 36 m deep. Each is described by: size · modes · concept · layout recipe · its **gimmick** (always a pure function of shared time so it costs no network traffic).

Prop heights: **low** ≤ 0.9 m (lobs fly over), **tall** ≥ 1.4 m (blocks everything), **thin** = tall and narrow (trunks, posts, scarecrows).

**Every map ships in two sizes.** *Standard* (up to 10 players) is the layout written below. *Grand* (11 to 20 players) is the same map at **×1.5 in width and depth** with proportionally more of everything: piles and power pads at one per 3 players, the cover props repeated in the same style, and more spawn points (players + 4), all still mirrored. The room picks the size from the player count when the lobby countdown starts (private-room hosts can override). Gimmicks grow in extent, never in timing. **Define each map once as data with a scale rule**; do not draw two maps by hand.

### October: HALLOWEEN (*Pumpkin Panic*)

1. **Pumpkin Patch Panic** · 44 × 30 m · all modes · *The friendliest field of vegetables you have ever been splatted in.*
   Teams spawn west and east behind hay-bale walls (x = ±19). Center: **the Great Pumpkin** (radius 2.2 m, 2.4 m tall, solid). Six **vine rows** of low cover (5 m long, 1.2 m gaps) at x = ±7, ±11, ±15, staggered. Four scarecrows (thin) at (±5, ±9). **6 Pelt Piles**: two on each spawn flank, two near the center top and bottom. **4 power pads** at (±9, 0) and (0, ±6).
   **Gimmick: Full Moon.** Every 45 s the moon swells for 10 s: piles refill twice as fast and every pelt glows.
2. **Haunted Hollow** · 40 × 32 m · all modes · *The manor's lights are on. Nobody is home. Everybody is home.*
   A manor facade (12 × 5 m, 6 m tall, glowing windows) at the north center. A wrought-iron fence line across the middle with gaps (low). Ten tombstones in three sizes (low). Four dead trees (thin). 6 piles in the outer corners and by the manor.
   **Gimmick: Ghost Doors.** Two pairs of matching doors (front gate with west crypt; east crypt with back balcony). Walk through one to appear at its twin (2 s cooldown, a ghostly whoosh). **Fog banks**: three fog patches drift on loops; inside fog, enemies farther than 5 m cannot see you.
3. **Corn Maze Mayhem** · 36 × 36 m · all modes · *Lobs cannot save you in here. Walls are walls.*
   A ring-shaped maze of cornstalk walls 2.1 m tall, four entrances (N, E, S, W), and a central plaza (radius 5 m) holding the Great Pumpkin or the King of the Patch circle. Crows sit on fence posts (decor). Piles in the four dead-end pockets and plaza edge.
   **Gimmick: Hay Gates.** Six short wall segments swing open and shut on a 40 s cycle with a 3 s warning chime, so the routes keep changing.
4. **Witch's Cauldron Cove** · 42 × 30 m · all modes · *Mind the bubbles.*
   A swamp. **Slime puddles** (radius 2 to 3 m, slow 35%) and **wooden boardwalks** (fast, +15%) form a loop. A **giant cauldron** (radius 3 m, solid) sits in the center. Lily-pad stepping stones and glowing mushrooms as decor. Piles on the four boardwalk corners.
   **Gimmick: Eruption.** Every 30 s the cauldron bubbles and glows green for 3 s, then erupts: anyone within 4.5 m is pushed 3 m outward (no damage) and 6 free pelt bundles rain around it.
5. **Candy Corn Carnival** *(secret: 600 coins or win 5 matches in October)* · 40 × 28 m · team modes and King of the Patch · *Spooky, sugary and slightly sticky.*
   Candy-corn striped tents (solid), popcorn carts (low), three balloon arches. A **Ferris wheel** (radius 5 m) in the center.
   **Gimmick:** the wheel's six cabins orbit (period 48 s) and act as moving 1.6 m cover along its rim path.

### November: HARVEST (*Leaf Fort Frenzy*)

6. **Orchard Rumble** · 44 × 32 m · all modes · *Everything is within lobbing distance of an apple.*
   Five rows of four apple trees (trunk radius 0.5 m solid; canopies are visual only), hay-bale walls (low), wooden crates (low), a barn corner. Piles at both ends.
   **Gimmick: Shake the Tree.** Stand still beside a trunk for 1 s: three apples drop (3 pelts plus 1 healing apple that restores a heart). That tree then rests for 25 s (bare branches show it).
7. **Cozy Cabin Clearing** · 40 × 30 m · all modes · *Cozy by the fire. Not for long.*
   A log cabin (10 × 6 m, solid) in the middle with porch steps (low). A **campfire** just south of it. Woodpiles (low), stump seats, string lights that glow at dusk.
   **Gimmick: Campfire.** Anyone within 2.5 m heals 1 heart every 6 s. It is contested ground.
8. **Hay Bale Hollow** · 40 × 30 m · all modes · *A farmyard with a very opinionated windmill.*
   A red barn (solid) on the west, a silo (solid) on the east, a hay wagon, hay-bale alley walls (low), a scarecrow.
   **Gimmick: Windmill.** A windmill in the center has four solid sails that rotate (period 14 s, a pure function of shared time); they block low and mid pelts as they sweep by.
9. **Cranberry Bog Bounce** · 42 × 30 m · all modes · *The floor is a trampoline. Mostly.*
   A bog with boardwalk paths and cranberry slush (slow 30%). Six **bounce mushrooms**.
   **Gimmick: Bounce.** Step on a mushroom to launch 2 m up for 0.9 s. You can throw while airborne (arcs start higher, so you can clear tall walls from above).
10. **Harvest Fair** *(secret: 600 coins or win 5 matches in November)* · 40 × 28 m · team modes · *Pie contests, but with more throwing.*
   Market stalls (solid), a cornucopia in the center (solid), bunting. **Gimmick:** a hay wagon (1.4 m tall) rolls a loop path through the market, a moving wall.

### December: FROST (*Snowball Showdown*)

11. **Snowman Village** · 44 × 32 m · all modes · *Eight snowmen are watching. Do not look them in the eye.*
   Eight round snowmen (radius 0.9 m, solid) in a mirrored layout, pre-built snow forts near the spawns (0.9 m walls), pine trees with lights (thin trunks), a frozen fountain in the center (radius 2 m, solid).
   **Gimmick: Drifts.** Snow-drift patches (radius 3 m) slow you 25% but make you scoop ammo twice as fast.
12. **Frozen Pond Faceoff** · 40 × 30 m · all modes · *Friction is for other people.*
   A big central pond (ellipse 11 × 7 m) of **ice**: acceleration and braking are a quarter of normal, a roll slides twice as far. Snowy shore, igloos at both ends (solid).
   **Gimmick:** slippery ice. Pelts and forts work as normal.
13. **Candy Cane Lane** · 50 × 24 m · all modes · *A long road paved with questionable decisions.*
   A long lane with three rows of candy-cane posts (thin), gumdrop bushes you can hide in (enemies farther than 4 m cannot see you inside), gingerbread archways.
   **Gimmick: Peppermint strips.** Speed lanes along both sides give +25% speed.
14. **Gingerbread Gulch** · 40 × 32 m · all modes · *Something smells delicious and mildly dangerous.*
   Gingerbread houses with icing roofs (solid) and a **cocoa river** across the middle (slow 40%) crossed by two licorice bridges.
   **Gimmick: Chimney Pops.** Four chimneys each fire a bundle of free pelts every 20 s; the landing spot is telegraphed 1.5 s ahead.
15. **Aurora Ridge** *(secret: 600 coins or win 5 matches in December)* · 44 × 30 m · team modes and King of the Patch · *Look up. Now duck.*
   A hilltop under a dancing aurora, a ring of pines, a giant snow globe (radius 2.5 m, solid) in the center.
   **Gimmick: Ice slides.** Three one-way slide lanes launch you at ×1.5 speed in one direction.

### Meadow (the off-season)

16. **Sunny Meadow** · 36 × 26 m · all modes. Flower beds (low), a mushroom cottage (solid), a pond (slow 30%), tulip patches. No gimmick.
17. **Picnic Panic** · 36 × 26 m · all modes. Picnic blankets (flat), baskets (low), a few trees (thin). No gimmick.

**Build order**: Pumpkin Patch Panic first (it is the tutorial and the flagship), then Haunted Hollow, Witch's Cauldron Cove, Corn Maze Mayhem. Everything in November and December is data and can arrive after launch.

---

## 7. Characters

A **character** is gameplay (stats, a passive, a signature move) **plus** its default look. The **look is separate** and always customisable (see 8): you can put any wardrobe on any character; only the stats and abilities belong to the character.

Stats are 1 to 5 and always **sum to 15**. *Speed* scales walk speed, *Power* scales throw range, *Roll* is distance and cooldown, *Pocket* is ammo capacity, *Fort* is fort hit points. The **signature** has a cooldown and also charges 25% per splat you land.

| # | Character | Title | Spd | Pow | Roll | Pkt | Fort | Passive | Signature (cooldown) | Unlock |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Pip** | the all-rounder | 3 | 3 | 3 | 3 | 3 | **Quick Learner**: your first splat of each life refills 1 pelt | **Pelt Pal**: a mini pumpkin buddy circles you and bonks the nearest enemy once (20 s) | free |
| 2 | **Dot** | the ladybug grandma | 2 | 3 | 3 | 4 | 3 | **Cozy Cardigan**: heal 1 heart after 12 s without taking damage | **Cocoa Break**: drop a thermos; allies within 2.5 m heal 1 heart (25 s) | free |
| 3 | **Chad Beetle** | always in a hurry | 5 | 2 | 4 | 2 | 2 | **Hustle**: +10% speed while holding 2 pelts or fewer | **Leg-Day Lunge**: a 3.5 m slide with i-frames that knocks over forts (20 s) | free |
| 4 | **Luna Moth** | arrives with the last light | 3 | 2 | 5 | 2 | 3 | **Moonstep**: rolls go 20% farther and leave a glowing trail | **Lullaby Lantern**: place a lantern; enemies within 2.5 m slow by 40% for 8 s (25 s) | 500 coins |
| 5 | **Sir Snailsworth** | very slow, very patient | 1 | 4 | 2 | 5 | 3 | **Shell Shock**: the first hit of each life bounces off his shell | **Slow and Steady**: your next throw is a Mega Pelt that moves slowly and splashes huge (20 s) | 700 coins |
| 6 | **Bea & Bee** | the Bee twins | 4 | 3 | 2 | 3 | 3 | **Twin Toss**: every 4th throw fires a bonus pelt | **Buzz Barrage**: spin and fire 5 pelts in a ring (28 s) | 700 coins |
| 7 | **Mantis Mom** | always on a call | 2 | 4 | 2 | 3 | 4 | **Eyes in the Back of Her Head**: red arrows at the screen edge show incoming pelts | **Mom Voice**: "TIMEOUT!" Enemies within 4 m cannot throw for 1.5 s (30 s) | 800 coins |
| 8 | **Flick** | the firefly teen | 4 | 2 | 4 | 3 | 2 | **Afterglow**: 0.6 s of glowing invulnerability after taking a hit | **Flash Mob**: a photo flash whites out enemies who can see you for 1.5 s (18 s) | 800 coins |
| 9 | **Gus** | the gym grasshopper | 3 | 5 | 3 | 2 | 2 | **Cannon Arm**: +20% throw range | **Hop Hop Hooray**: a big hop over walls; the landing splashes 2 m (24 s) | 900 coins |
| 10 | **Count Cuddles** | the vampire kid who just wants hugs | 4 | 3 | 3 | 2 | 3 | **Bat Cape**: rolls glide 1 m farther over low cover | **Bat Buddies**: three bats circle you and each blocks one pelt (28 s) | Halloween Season Trail tier 20 |
| 11 | **Juniper** | the pumpkin-spice maven | 3 | 3 | 2 | 4 | 3 | **Warm Drink**: +10% speed for 3 s after a pile refill | **Spice Splash**: lob a thermos that leaves a sticky puddle for 6 s (22 s) | Harvest Season Trail tier 20 |
| 12 | **Frostine** | the snow kid | 3 | 3 | 4 | 3 | 2 | **Snow Angel**: standing still for 1.5 s makes you harder to see | **Snow Fort Express**: three free forts in an arc (26 s) | Frost Season Trail tier 20 |

Seasonal characters stay unlockable forever through the Season Vault (a challenge, or 1,500 coins).

### Their default looks (use these exactly; they are valid `LOOK` objects for the attached code)

```js
pip:          { skin:'#f7d0b5', hair:'short',   hairColor:'#8d5c38', eyes:'round',   top:'hoodie',   topColor:'#7fc3c9', bottom:'shorts',   bottomColor:'#3f4a5c', shoes:'sneakers', shoeColor:'#f6efe4', hat:'beanie',   hatColor:'#f7d77a', extra:'none' },
dot:          { skin:'#f7d0b5', hair:'bun',     hairColor:'#f3efe6', eyes:'happy',   top:'cardigan', topColor:'#e25b4f', bottom:'skirt',    bottomColor:'#3f4a5c', shoes:'flats',    shoeColor:'#3f4a5c', extra:'glasses' },
chad:         { skin:'#cf9570', hair:'buzz',    hairColor:'#2e211b', eyes:'round',   top:'tank',     topColor:'#3f4a5c', bottom:'joggers',  bottomColor:'#3f4a5c', shoes:'sneakers', shoeColor:'#e25b4f', extra:'sunnies' },
luna:         { skin:'#ffe3d3', hair:'long',    hairColor:'#9b86dc', eyes:'sleepy',  top:'kimono',   topColor:'#b69be0', bottom:'skirt',    bottomColor:'#8ea6e6', shoes:'sandals',  shoeColor:'#f6efe4', hat:'flower', hatColor:'#f6efe4', extra:'earrings' },
snailsworth:  { skin:'#eab792', hair:'short',   hairColor:'#c58d56', eyes:'round',   top:'sweater',  topColor:'#6b8f5e', bottom:'cargo',    bottomColor:'#c98b5a', shoes:'boots',    shoeColor:'#5b3825', hat:'bucket', hatColor:'#c98b5a', extra:'glasses' },
beeTwins:     { skin:'#f7d0b5', hair:'pigtails',hairColor:'#2e211b', eyes:'sparkle', top:'overalls', topColor:'#f7d77a', bottom:'shorts',   bottomColor:'#3f4a5c', shoes:'sneakers', shoeColor:'#f7d77a', hat:'headband', hatColor:'#3f4a5c' },
mantisMom:    { skin:'#eab792', hair:'ponytail',hairColor:'#8d5c38', eyes:'lashes',  top:'cardigan', topColor:'#9fd39a', bottom:'jeans',    bottomColor:'#3f4a5c', shoes:'flats',    shoeColor:'#6b8f5e', extra:'earrings' },
flick:        { skin:'#ffe3d3', hair:'bangs',   hairColor:'#f3a9c4', eyes:'sparkle', top:'hoodie',   topColor:'#f7d77a', bottom:'skirt',    bottomColor:'#b69be0', shoes:'sneakers', shoeColor:'#f4a6bd', extra:'heartpin' },
gus:          { skin:'#a9714c', hair:'short',   hairColor:'#2e211b', eyes:'happy',   top:'jersey',   topColor:'#9fd39a', bottom:'joggers',  bottomColor:'#6b8f5e', shoes:'sneakers', shoeColor:'#f6efe4', hat:'cap',    hatColor:'#6b8f5e' },
countCuddles: { skin:'#ffe3d3', hair:'spiky',   hairColor:'#2e211b', eyes:'sparkle', top:'cardigan', topColor:'#2c2233', bottom:'jeans',    bottomColor:'#3f4a5c', shoes:'boots',    shoeColor:'#2e211b', extra:'scarf', hatColor:'#b32a4c' },   // + a cape and fangs (new accessories)
juniper:      { skin:'#eab792', hair:'wavy',    hairColor:'#d9745f', eyes:'lashes',  top:'sweater',  topColor:'#c98b5a', bottom:'leggings', bottomColor:'#6b4a3a', shoes:'boots',    shoeColor:'#5b3825', hat:'beanie', hatColor:'#e25b4f', extra:'scarf' },
frostine:     { skin:'#ffe3d3', hair:'pigtails',hairColor:'#76bccd', eyes:'sparkle', top:'hoodie',   topColor:'#9fd0ff', bottom:'leggings', bottomColor:'#f6efe4', shoes:'rainboots',shoeColor:'#f6efe4', hat:'beanie', hatColor:'#f4a6bd', extra:'scarf' },
```

Dot, Chad, Luna, Snailsworth, Bea & Bee, Mantis Mom, Flick and Gus are the eight named regulars in image 01.

---

## 8. Wardrobe and unlockables

### 8.1 Slots

**Character** (gameplay) · **Look** (the base chibi creator: skin, hair, eyes, top, bottom, shoes, colours) · **Hat** · **Face** (glasses, paint, fangs) · **Back** (wings, cape, broom, backpack) · **Hand prop** (pail, lantern, candy cane) · **Pelt skin** · **Splat style** (colour and sparkle of the goo) · **Trail** (what your feet leave) · **Emotes** (6 equipped) · **Victory pose** · **Buddy** (a tiny pet that follows you) · **Nameplate and title**.

### 8.2 Rarity and price (Pelt Coins)

Common 80 to 150 · Uncommon 160 to 260 · Rare 300 to 500 · Epic 600 to 900 · Legendary 1,200 to 1,800. Characters 500 to 900. Buddies 500 to 900. Secret maps 600. A complete **seasonal set** (head + back + outfit + hand) gives a small sparkle bonus effect.

### 8.3 Free at the start

All seven skin tones, six of the twelve hair styles, five of the ten tops, four of the six bottoms, three of the six shoes, three of the six eye styles, the twelve swatch colours, the Pip, Dot and Chad characters, and the seasonal base pelt. The rest unlock cheaply (40 to 150 coins) or by level.

### 8.4 Halloween items (the October launch set)

The attached chibi code already makes the base wardrobe. **All of these are new accessories to build** in the same style (vertex-coloured merged primitives attached to the rig):

- **Head**: Witch Hat (Rare), Pumpkin Cap (Common), Jack-o'-Lantern Helmet with a glowing carved face (Epic), Cat Ears (Common), Tiny Devil Horns (Uncommon), Bat Headband (Uncommon), Ghost Hood (Rare), Mummy Wraps (Rare), Candy-Corn Cone Hat (Common), Cauldron Hat with bubbling slime (Epic), Spider Clip (Common), Skull Crown (Legendary).
- **Face**: Fangs, Skull Face Paint, Cat Whiskers, Cobweb Cheek, Monster Stitches.
- **Back**: Bat Wings (they flap), Witch Broom, Vampire Cape, Ghost Tail, Spiderweb Backpack.
- **Outfits** (a look preset plus extra bits): Skeleton Suit, Mummy Suit, Ghost Robe, Pumpkin Onesie (orange hoodie, green stem on the hood), Witch Robe and Curly-Toe Boots, Vampire Suit, Black Cat Costume.
- **Hand**: Pumpkin Pail, Jack-o'-Lantern Lantern (it really glows), Spooky Candle.
- **Pelt skins**: Classic Pumpkin (free), Ghost Pumpkin (white), Moon Pumpkin (blue), Candy Pumpkin (polka dots), Golden Pumpkin, Glow-in-the-Dark, Rotten Pumpkin (cute green).
- **Trails**: Bat Flutter, Candy-Corn Confetti, Ghost Wisps, Spiderwebs.
- **Splat styles**: Orange Goo (free), Slime Green, Purple Potion, Glitter Goo.
- **Emotes**: Boo!, Cackle, Spooky Dance, Ghost Float, Monster Mash.
- **Victory poses**: Witch Cackle Spin, Skeleton Rattle.
- **Buddies**: Tiny Bat, Ghost Kitten, Mini Skeleton, Spider Pal, Black Cat.
- **Titles**: "Pumpkin Royalty" (win 25 matches in October), "Boo-tiful" (use Boo! on 50 players), "Gourd Almighty" (land 500 splats).

### 8.5 Harvest items (November)

Acorn Cap, Leaf Crown, Scarecrow Hat, Apple Hat, Pie Hat (a pie on your head), Fox Ears and Tail, Squirrel Tail, Maple Cape, Cozy Scarf, Turkey-Feather Backpack, Flannel Look, Corn Costume, Scarecrow Suit, Pumpkin-Spice Cup (hand), Pelt skins (Maple, Oak, Golden Birch, Rainbow Leaf), Trail (Falling Leaves), Buddies (Squirrel, Hedgehog, Fox Cub, Owl), Emotes (Thankful Heart, Leaf Toss, Cozy Sip). *Gratitude Week (Nov 22 to 28)*: bonus coins for kind "Good game" emotes.

### 8.6 Frost items (December)

Cozy Pom Beanie, Reindeer Antlers, Earmuffs, Snowman Top Hat with a carrot nose (face), Penguin Hood, Ice Crown, Star-Topper Hat, Snow Goggles, Elf Boots, Sled (back), Gift Backpack, Candy Cane (hand), Hot Cocoa (hand), Pelt skins (Sparkle, Rainbow, Ice Crystal, Gingerbread Cookie), Trail (Snowflakes), Buddies (Snow Bunny, Penguin Chick, Polar Cub, Reindeer, Mini Snowman), Emotes (Snow Angel, Jingle Dance, Shiver).

### 8.7 Ways to unlock things

1. The **coin shop** (a permanent list plus six "Featured today" items that rotate daily).
2. The **Season Trail** (see 9).
3. **Milestones** (for example: splat 100 players, win 10 matches, dodge 50 pelts, hug 5 friends). Each pays coins and sometimes an item.
4. The **Daily Gourd**: one free mystery gift a day (30 to 150 coins, sometimes a Common or Uncommon item).
5. **Levels** (profile levels 1 to 50 give coins and cosmetics).
6. **Secret maps and seasonal characters** (coins or a challenge).

A **Mirror** screen lets you try anything on a rotating 3D chibi before buying.

---

## 9. Coins and progression

### 9.1 Pelt Coins

| Earn | Coins |
| --- | --- |
| Finish a match | 20 |
| Each splat you land (up to 15 count per match) | 3 |
| Win (team) · place 1st / 2nd / 3rd (free-for-all) | 25 · 30 / 15 / 8 |
| King of the Patch: every 5 s you held the circle | 1 |
| First match of the day | +30 |
| Daily streak: 3 days · 7 days | +20 · +60 |
| Daily quests (3 a day, e.g. "Splat 10", "Dodge 3 pelts", "Win a match", "Use 2 power-ups") | 25 to 60 each |
| Weekly challenge | 150 |
| Milestones | 70 to 300 each |

**Soft cap**: after 400 coins in a day, further coins are halved. **Anti-farming**: a room of only 2 pays half; matches with bots pay half; leaving early forfeits bonuses; only the first 15 splats count. **Payouts are calculated on the server** from validated events, never sent by a client.

### 9.2 XP, levels and the Season Trail

- XP per match: 50 + 3 per splat + 25 for a win. Profile levels 1 to 10 need 150 XP each, 11 to 30 need 250, 31 to 50 need 400.
- The **Season Trail** is free: 30 tiers of 300 XP each (9,000 XP, about four weeks of casual play). Every 5th tier is a big reward; **tier 20 unlocks the seasonal character**; tier 30 is a Legendary item. Missing a season's trail is fine: it stays in the Vault.
- Target pace: a first cosmetic after your **first** match, a first character after about 5 matches, the whole trail in about 30 days at three matches a day.

### 9.3 No login

There are no accounts. A browser makes an anonymous profile (random token) on first visit; progress lives on the server keyed by a hash of that token, with a local copy. A **Rescue Code** (three words, e.g. `plum-otter-lamp`) can be shown in Settings and typed on another device to move the profile. The player picks a nickname (checked by a kind-words filter). There is **no real money anywhere**, no ads, no tracking.

---

## 10. Power-ups

**Mystery Gourds** (Acorn Baskets in November, Gift Boxes in December) spawn on glowing pads (one pad per 3 players, at least 4). Run over one to claim it (the server decides on simultaneous grabs). You can hold **one** at a time; the effect is chosen when you grab it, weighted so players who are behind get stronger ones. Use with E / the button. Each season re-skins them (the names below are the Halloween ones).

| # | Power-up | Effect |
| --- | --- | --- |
| 1 | **Triple Toss** | your next throw fires 3 pelts in a 20° fan for the price of 1 |
| 2 | **Pumpkin Rain** | aim a 4 m circle; for 3 s pelts rain down (6 a second, 1 heart each); a ring on the ground warns everyone |
| 3 | **Jack-o'-Lantern Shield** | a glowing pumpkin orbits you and absorbs 3 hits or 8 s |
| 4 | **Boo Boots** | +40% speed for 6 s, immune to slow puddles, leaves a ghostly dust trail |
| 5 | **Goo Bomb** | throw a jar of green goo; it leaves a sticky puddle (radius 2 m) for 8 s that slows enemies 50% and not allies |
| 6 | **Mega Gourd** | a huge slow pumpkin; splash radius 2 m, 2 hearts, knocks back, smashes forts |
| 7 | **Ghost Phase** | 3 s intangible: pelts pass through you and you walk through forts, but you cannot throw |
| 8 | **Candy Heal** | restore 1 heart and burst a heart-wave that heals allies within 3 m |
| 9 | **Bat Swarm** | three homing bats (7 m/s for 4 s) tag the nearest enemy; at most 2 hearts of damage in total |
| 10 | **Scarecrow Decoy** | drop a scarecrow with 6 HP that enemies' auto-aim prefers; it bursts into confetti |
| 11 | **Spooky Wall** | instantly raise a 5 m curved wall of pumpkin crates for 8 s |
| 12 | **Lovestruck Swarm** | a cloud of ladybugs with hearts for 4 s: enemies within 4 m get heart eyes, aim wobbles ±25°, and they move 20% slower |

**Season skins**: Bat Swarm becomes *Crow Parade* in November and *Snow Owls* in December; Pumpkin Rain becomes *Leaf Storm* then *Blizzard*; the Shield becomes an *Acorn Shield* then a *Snowflake Shield*; Goo Bomb becomes *Cider Splash* then *Slush Bomb*; Mega Gourd becomes *Mega Acorn* then *Mega Snowball*; Scarecrow becomes a *Snowman Decoy*; Spooky Wall becomes a *Hay Wall* then an *Ice Wall*. Each needs a small 3D pickup model that floats and spins above the pad, plus a matching icon.

---

## 11. Screens and flows

1. **Landing** (over a live 3D scene of the current season's flagship map with chibis idling): **Play vs bots** (the biggest button: a solo match in seconds) · **Quick Play** (a public lobby of up to 20) · *Play with friends* · *Join with a code* · *Practice with bots* · *Wardrobe* · *Shop* · *Season Trail* · *Settings*. A season banner with a countdown. A "Play the Halloween Edition" button when it is no longer October.
2. **First visit**: pick a nickname and a starter character, then a 45-second guided **tutorial match** against bots ("Pumpkin 101") that teaches move, lob, Big Pelt, roll, pile, fort, power-up.
3. **Create or join**: creating gives a code and a share button (copy link, the Web Share sheet). Joining takes the 4-character code (letters and digits without look-alikes; consonants and digits only, so a code can never spell a word).
4. **Lobby**: the room code in big letters (private rooms), a **"4/6 players to start" meter**, the big **auto-start countdown** when it is running (and after 20 s below the minimum a **"Fill with bots"** button), everyone's chibi lined up on a little stage (up to 20, in rows, waving and idling), a **character and wardrobe** picker, a **Ready** toggle, the **map vote** (public rooms) or the host's mode/map/rules and **Start now** (private rooms), and a few emotes to wave at each other. Spectators can join with the code (watch only).
5. **Match HUD** (frosted-glass pills): hearts, ammo pips, time and score, a mini scoreboard (the top 5 plus you, so it stays readable with 20 players), the roll cooldown ring, the held power-up, the signature charge, emote button, a small ping indicator, the room code chip. Off-screen enemy markers (small arrows) near the edge, **capped at the 6 nearest** so 20 players do not clutter the screen; name tags only for the nearest 8.
6. **Results**: podium with the chibis cheering, awards, coin and XP payout counting up, the buttons *Rematch* · *Change map* · *Back to lobby*.
7. **Shop and Wardrobe**: tabs per slot, rarity colours, a Mirror with a rotating 3D chibi, Featured today.
8. **Season Trail** and **Daily quests** (with a progress ring).
9. **Settings**: sound, music, vibration, camera shake, reduced motion, left-handed controls, aim assist, quality, large text, colour-blind markers, name, Rescue Code, and a hidden **Debug overlay** toggle.
10. **Pause or "connection lost"**: a friendly banner, automatic reconnect, never a dead end.

---

## 12. Audio (all synthesised)

- **SFX**: a throw whoosh, a goo splat (noise burst through a sweeping filter with a "plop" sine), a bonk for Big Pelts, a roll swish, a pile refill ticking up in pitch, a pickup chime, power-up activations, a countdown beep, a victory fanfare, a defeat "boing", footsteps (soft, per surface), UI taps.
- **Music**: one short looping chord score per season (see 5.1) played by simple oscillators and a little reverb; calmer in the lobby, busier in the last 30 seconds.
- Starts on the first tap. Separate music and SFX volume, a mute switch, and everything pauses when the tab is hidden.

---

## 13. Kindness, safety, accessibility

- **No free-text chat.** Communication is emotes and a short list of quick phrases ("Good game!", "Nice throw!", "Oops!", "Again?").
- Nicknames pass a kind-words filter; names are never shown until checked. There is a **mute/block** button on every player and a simple **report** (the host sees it in a private room; it is logged for public rooms).
- **Public rooms** (Quick Play) are open to anyone, so they get the same safety rules with nothing extra to type: no free text, no links, no images, emotes and quick phrases only. A **"Friends only"** switch hides a room from Quick Play (on by default for rooms created with a code).
- No accounts, emails, locations, ads, tracking or purchases. Nothing is collected beyond the anonymous profile.
- Team colours are never the only signal (icons and shapes too). A reduced-motion mode, camera-shake off, adjustable aim assist, left-handed layout, large text, and all important audio cues have a visual twin.

---

## 14. Stretch goals (only after the Halloween core is solid)

Capture the Great Pumpkin and Last Bug Standing; the co-op Great Gourd Rush; a **map editor**; weekly rotating "mutator" rules (big heads, low gravity, double pelts); photo mode with stickers; a replay of the last splat; Spring and Summer seasons (water balloons, sunflowers).
