---
name: 2d-games
description: "Design, build and debug 2D games: platformers, top-down games, arcade shooters, shmups and flight/dogfight games. Covers game loop and fixed timestep, entity and scene state, object pooling, sprites and animation, collision and physics, input (keyboard and gamepad), cameras, game feel and juice, HUD, enemy waves and difficulty, performance, Phaser and other 2D engines, and local or online co-op. Use whenever the task involves making, extending or fixing a 2D game, even if the user never says '2D'."
---

# 2D Game Development

2D games succeed on clarity and feel: the player should always understand what is happening on screen, and every input should answer immediately. The sections below are engine-agnostic. Open a reference file only when it applies:

- Project uses **Phaser** → read `references/phaser.md`
- Game has **co-op or online play** → read `references/multiplayer.md`

---

## 1. Game loop and timing

- Run game logic on a **fixed timestep** (e.g. 60 updates/s) and render as fast as the display allows. Variable `dt` makes physics differ between machines and makes networked play impossible to keep in sync.
- Keep simulation code free of rendering, input polling and `Math.random()` calls. Read input into a snapshot once per tick, and use a seeded RNG for anything gameplay-relevant. This keeps the simulation testable and, later, shareable between client and server.
- Pausing means stopping the simulation tick, not the render loop, so menus and overlays keep animating.

## 2. Scenes, entities and state

- Model the flow as scenes: boot → menu → setup (e.g. pilot select) → play → game over. Keep the HUD in its own layer or scene so it ignores camera movement and shake.
- Give entities (player, enemy, missile) a small state machine instead of piles of boolean flags: `spawning → active → dying → dead`. Bugs like "dead enemy still shoots" disappear.
- **Pool anything spawned often** (bullets, missiles, particles, pickups). Allocating and garbage-collecting per shot causes frame hitches.
- Keep tunable numbers (speeds, damage, heat, wave composition, pilot perks) in data objects or JSON, not scattered through code. Balancing a game is mostly editing numbers; it should never need a code hunt.

## 3. Sprites and animation

| Concept | Rule |
|---------|------|
| Atlas | Pack textures together to reduce draw calls |
| Pivot | Set it at the rotation point (the plane's centre of mass, not its corner) |
| Layering | Decide z-order up front: background < clouds < enemies < player < projectiles < effects < HUD |
| Frame rate | 8-24 FPS for sprite animation |

- Squash/stretch for impact, anticipation before an action, follow-through after it.
- For prototypes, draw placeholder shapes or simple generated pixel art. Do not copy another game's art, audio or code; reproduce *mechanics and feel*, not assets.
- A limited palette (4 colours, Game Boy style) is a cheap way to get a cohesive look.

## 4. Physics and collision

- Choose **one** approach per object: physics-engine-driven or hand-written kinematics. Mixing them makes motion fight itself.
- Use the simplest collision shape that feels fair: circles for bullets and missiles, small boxes or circles for planes, and shrink hitboxes slightly below the sprite so near misses feel like near misses.
- **Collision layers/groups** do the filtering, not `if` statements in handlers. Define who can hurt whom up front (player bullets collide with enemies, not with teammates).
- Flight-style movement is usually hand-written: velocity from thrust along the heading, constant gravity, drag, and a capped turn rate. This gives arcs and momentum without a full physics engine.
- Terrain can be a plain height check (`y > groundY`) rather than a collider.

## 5. Input

- Map hardware to **actions** (`thrust`, `turnLeft`, `fireGun`, `fireMissile`, `special`, `flare`) in one place. Game code reads actions only, so keyboard, gamepad, rebinding and multiple local players all work without touching gameplay.
- Apply a dead zone (~0.2) to analog sticks; read buttons by edge (just pressed) vs level (held) deliberately.
- Buffer short inputs (about 100 ms) when timing is tight, so presses slightly early still count.

## 6. Camera

| Type | Use |
|------|-----|
| Follow | Track one player; add smoothing so it never jitters |
| Look-ahead | Lead in the direction of travel |
| Multi-target | Frame several players (midpoint, zoom out to keep all visible) |
| Fixed / room-based | Arcade screens, Metroidvania rooms |

- Screen shake: 50-200 ms, decaying intensity, reserved for impactful events (explosions, damage). Overuse hides the action.
- If the whole arena fits on screen, a fixed camera is usually the clearest choice for shooters.

## 7. Game feel ("juice")

Small feedback layers make hits satisfying: muzzle flash, hit flash on damage, a few frames of hit-stop on big impacts, particles, missile smoke trails, callout text ("Bullseye!", "Wave Cleared!"), score/combo pop-ups and a sound for each. Add them after the mechanic works, one at a time, and keep the screen readable. If effects hide bullets, dial them back.

## 8. HUD and UI

- Put persistent meters in the screen corners (score and multiplier top-right, speed/altitude at the sides, weapon heat and loadout bottom-right) so the centre stays clear for play.
- Mark things in world space: lock-on reticles on targeted enemies, off-screen arrows for threats and teammates.
- Show state changes with text and an icon, not colour alone (accessibility), and keep fonts crisp at the game's native resolution.

## 9. Genre patterns

### Arcade shooter / flight (dogfight)
- **Guns:** short cooldown plus a heat meter; overheating forces a pause, which creates rhythm.
- **Missiles:** acquire a lock (cone and range), then home with a **limited turn rate** so they can be dodged; finite fuel/lifetime. Countermeasures (flares) can break a lock or decoy a missile.
- **Waves:** define each wave as data (enemy types, counts, spawn edges, delay). Scale difficulty gradually: more enemies, then faster or smarter ones, then mixed groups.
- **Scoring:** points per kill, a multiplier that grows on consecutive kills and decays or resets on taking damage.
- **Modifiers:** time-of-day or random effects (good and bad) add variety cheaply: a status that changes a number in a config.
- Use "endless" difficulty curves (soft cap on enemy count, increasing aggression) so the game can run indefinitely.

### Platformer
- Coyote time (jump allowed shortly after leaving a ledge), jump buffering, variable jump height by holding the button.

### Top-down
- 8-directional or free movement; aim with mouse/right stick or auto-aim; decide up front whether the sprite rotates.

## 10. Performance

- Pool objects, reuse vectors and arrays in hot loops, and avoid allocating in `update`.
- Cap particle counts and let old particles die quickly.
- Batch draws via atlases; avoid per-frame texture creation.
- Profile before optimising: measure frame time, not guesses.

---

## Anti-patterns

| Don't | Do |
|-------|----|
| Variable-`dt` physics | Fixed timestep simulation |
| `new Bullet()` on every shot | Pooled, reusable objects |
| Separate loose textures | Atlases |
| Complex collision polygons | Simple circles/boxes, slightly smaller than the sprite |
| Hard-coded stats in logic | Data-driven configs |
| Game code reading raw keys | Action-mapping layer |
| One shared group for all bullets | Separate groups/teams so friendly fire is impossible by construction |
| Jittery, instant camera | Smooth follow with lerp |
| Mixing engine physics and manual movement on one object | Pick one |
| Effects that hide gameplay | Juice that stays readable |

> **Remember:** every pixel should communicate something to the player.
