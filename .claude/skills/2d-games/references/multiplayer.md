# Multiplayer / Co-op Reference

Read this when the game has two or more players. Decide the mode first (ask the user if unspecified), because it shapes the architecture.

## Choosing a mode

| Mode | What it needs | Trade-off |
|------|---------------|-----------|
| **Local co-op** (same screen) | Two input sources (split keyboard, two pads) | No networking; simplest; players must be together |
| **Online, authoritative server** | A Node server running the simulation; clients send input, receive state | Fair and cheat-resistant, easy to reason about; needs hosting for internet play |
| **Online, peer-to-peer** | WebRTC and a signaling service | No game server to run, but host advantage and fragile on strict networks |

## Authoritative server model (recommended for online co-op)

- The **server owns the simulation**: it runs the game at a fixed tick (e.g. 30-60 Hz), applies each player's latest input, spawns enemies, resolves hits, and keeps score.
- Clients send **inputs** (the action snapshot: thrust, turn, fire...), never positions. They render the state the server sends.
- Share the simulation code between client and server (a `shared/` folder with no engine/DOM imports). Then the client can **predict** its own plane locally and the server stays authoritative.
- Libraries: Colyseus (rooms, state sync, matchmaking) is a good fit for a small Node + Phaser game; a plain `ws` WebSocket server is the lightweight alternative.

## Latency handling

- **Own plane:** client-side prediction. Apply input immediately, remember unacknowledged inputs, and when the server state arrives, reconcile by re-applying the inputs after the acknowledged tick.
- **Other players and enemies:** snapshot interpolation. Render them ~100 ms in the past, interpolating between the two most recent snapshots, so motion is smooth despite jittery packets.
- **Projectiles:** send spawn events (origin, direction, tick) and simulate them locally, rather than sending every bullet position every tick.
- Send only what changed, round numbers, and keep messages small.

## No friendly fire (team model)

- Every projectile, missile and special weapon carries `ownerId` and `team`.
- Damage is applied only when `projectile.team !== target.team`. Players share the `players` team; enemies share the `enemies` team. Because the rule lives in one place, new weapons cannot reintroduce friendly fire.
- Homing missiles must only acquire enemy-team targets; countermeasures may decoy enemy missiles only.
- Optionally allow teammates' bullets to pass through without any collision, so nothing blocks or pushes them.

## Co-op game design

- **Enemy scaling:** scale wave size and enemy health by player count; keep a soft cap on total enemies for performance.
- **Death rules** (choose with the user): respawn after a delay, revive by teammate, or a shared pool of lives. Game over when all players are down.
- **Score:** shared team score with per-player contribution shown, or individual scores plus a team total. Decide whether the combo multiplier is per player or shared.
- **Camera:** a shared fixed arena is simplest; otherwise follow the midpoint and zoom to fit.
- **HUD:** each player sees their own heat, missiles and special weapon, plus a compact view of teammates' status; mark teammates with a distinct colour or tag.
- **Lobby:** room codes (a short code the host shares), a ready-up step, pilot choice per player.
- **Disconnects:** keep the game running with the remaining players; remove or AI-park the disconnected plane; allow rejoin within a time window.

## Testing

- Run server and client on localhost, open two browser tabs (or two windows) as two players.
- Simulate latency and packet loss (browser dev-tools network throttling, or add a delay queue in the server) before judging how the game feels.
- Write simulation tests that run the shared code headlessly: same inputs must give the same state.
- Check the no-friendly-fire rule explicitly: a bullet owned by player A must never damage player B.
