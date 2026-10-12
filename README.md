# Dogfight Co-op

A 2D arcade dogfight shooter built with **Phaser 3**, inspired by the gameplay of *Dogfight Night*
(gravity-assisted flight, an overheating gun, lock-on missiles, flares, endless waves, combo scoring),
with **online 2-player co-op and no friendly fire**.

All art and sound are generated in code. Nothing is copied from the original game: only its mechanics
and overall feel are recreated.

## Play

```bash
npm install          # first time only (everything installs inside this folder)
npm run dev          # game server on :2567 + Vite dev client on :5173
```

Open <http://localhost:5173>.

- **SOLO**: fly alone against endless waves (3 lives).
- **HOST CO-OP**: opens a room and shows a 4-letter code (5 shared lives).
- **JOIN CO-OP**: type a friend's code. The host presses ENTER once both pilots are in.

### Playing with a friend on the same network (LAN)

`npm run dev` prints your network addresses. Your friend opens `http://<your-ip>:5173`, picks
**JOIN CO-OP** and types your code. (If Windows Firewall asks, allow Node.js on private networks.)

### Playing over the internet

Build once and run the single production server, then host it somewhere reachable (a VPS, or a tunnel such
as Cloudflare Tunnel / ngrok pointed at port 2567):

```bash
npm run build
npm start            # serves the game and the WebSocket server on http://localhost:2567
```

Set the `PORT` environment variable to change the port (e.g. `set PORT=3000` in cmd, `$env:PORT=3000` in PowerShell). The client talks to `/ws` on whatever address served the page,
so no configuration is needed. Use HTTPS in front of it for public hosting (the client switches to `wss://` automatically).

### Dev helper: test co-op alone

```bash
npm run bot-host     # starts the server and a bot that hosts a room; prints "ROOM CODE: XXXX"
```

Then pick **JOIN CO-OP** in the browser and type that code.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Turn | A / D (or arrows) | Left stick |
| Engine | W (or Up) | Left stick up |
| Gun | L (or Space) | A |
| Missile | P | B |
| Special weapon | K | X |
| Flares (countermeasure) | O | Y |
| Leave match | ESC twice | |

## How it plays

- **Flight**: gravity pulls the nose-down; diving gains speed, climbing loses it, and below stall speed the
  nose drops. Use the engine to stay fast. Hitting the ground is fatal.
- **Gun**: fast, slightly aims at an enemy right in front of you, and **overheats** (watch GUN TEMP).
- **Missiles**: keep an enemy near your nose for a moment to get **LOCKED**, then fire. Missiles home with a limited
  turn rate, so they can be dodged. Enemy missiles can be fooled with **flares**.
- **Special weapons** (pick one before the run, charges as you score kills): *Missile Barrage*, *Rail Shot*, *EMP Burst*.
- **Pilots**: Kestrel (faster jet), Bulldog (gun runs cooler), Siren (extra missile, faster reload).
- **Score**: kills give points times a combo multiplier that grows with consecutive kills and resets when you are hit.
- **Co-op**: both pilots share one pool of lives and one score. Enemies come in larger and tougher waves.
  **Your bullets, missiles and special weapons never hurt your teammate.**

## How it is built

```
src/shared/   deterministic game simulation (no Phaser, DOM or Node imports)
  config/     all tuning data: pilots, weapons, specials, enemies, waves
  sim/        flight, weapons, combat (the single damage gate), AI, waves, shared lives, World
src/client/   Phaser: scenes (Menu, PilotSelect, Lobby, Game, Hud, GameOver), rendering, input, sessions
  session/    SoloSession (sim in the browser) and OnlineSession (talks to the server)
src/server/   authoritative co-op server: HTTP static files + WebSocket rooms (ws)
tests/        Vitest unit tests for the simulation
scripts/      smoke-coop.ts (end-to-end test), bot-host.ts (dev helper)
```

**One simulation, three uses.** `World` runs in the browser for solo play, on the server for co-op, and in the tests.

**Co-op networking.** The server runs the match at 60 ticks per second and sends snapshots 20 times per second.
Clients send only their inputs. Your own plane is *predicted* locally (so controls feel instant) and corrected
from server snapshots; everything else is drawn about 100 ms in the past and interpolated.

**No friendly fire.** All damage goes through `damagePlane` in `src/shared/sim/combat.ts`, which ignores any hit
whose team equals the target's team. Missiles only home on the other team, and the EMP only stuns the other team.

**Reconnecting.** If a pilot drops mid-match their plane is removed (no life lost). They can pick **REJOIN MATCH**
in the menu within 30 seconds.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server and Vite dev client together |
| `npm run build` | Type-check and build the client into `dist/` |
| `npm start` | Production server (serves `dist/` and WebSockets) |
| `npm test` | Unit tests |
| `npm run smoke` | End-to-end co-op test with two bot clients |
| `npm run typecheck` | TypeScript only |

## Everything stays in this folder

`.npmrc` points the npm cache at `./.npm-cache`, and dependencies live in `./node_modules`. Nothing is installed
globally. Both folders are git-ignored; delete them to reclaim the space and `npm install` to restore.

## Ideas for later

Day/night cycle with random modifiers, more enemy types and bosses, leaderboards, 3-4 players, mobile touch controls.
