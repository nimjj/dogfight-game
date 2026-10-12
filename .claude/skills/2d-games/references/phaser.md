# Phaser 3 Reference (TypeScript + Vite)

Read this when the project uses Phaser. It supplements the engine-agnostic rules in `SKILL.md`.

## Project setup and layout

- Use **Vite + TypeScript**. Scaffold manually (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`) so nothing is installed outside the project folder.
- Keep installs local to the project: add a project `.npmrc` with `cache=./.npm-cache`, add `.npm-cache/` and `node_modules/` to `.gitignore`, and never use `-g`.
- Suggested layout:

```
src/
  main.ts              # Phaser.Game config
  config/              # data: pilots, weapons, waves, tuning
  scenes/              # Boot, Menu, PilotSelect, Game, Hud, GameOver
  entities/            # Plane, Bullet, Missile, Enemy
  systems/             # WaveSpawner, Scoring, InputMap, Targeting
  shared/              # simulation code reusable by a server (no Phaser imports)
public/                # static assets
```

- Keep `shared/` free of Phaser imports so a Node server can run the same simulation (see `multiplayer.md`).

## Game config

```ts
new Phaser.Game({
  type: Phaser.AUTO,
  width: 1280, height: 720,
  pixelArt: true,                       // nearest-neighbour scaling
  backgroundColor: '#3f6246',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: true },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [Boot, Menu, PilotSelect, GameScene, Hud, GameOver],
});
```

## Scenes

- Lifecycle: `init(data)` → `preload()` → `create()` → `update(time, delta)`. Do setup in `create`, never in the constructor.
- Run the HUD as a **parallel scene** (`this.scene.launch('Hud')`) with its own camera, so shake and zoom on the game camera do not move the UI. Communicate through `this.events` / the registry, not direct references.
- Clean up listeners on `shutdown` to avoid duplicate handlers after restarting a scene.

## Fixed timestep

Phaser's `update` receives a variable `delta`. For deterministic simulation, accumulate time and step the game in fixed slices:

```ts
private acc = 0;
update(_t: number, delta: number) {
  this.acc += Math.min(delta, 100);       // clamp to avoid spiral of death
  while (this.acc >= STEP_MS) { this.simulate(STEP_MS / 1000); this.acc -= STEP_MS; }
}
```

Use Arcade Physics for simple overlap tests if the game is single-player-only; for networked play, run your own simulation and treat Phaser as the renderer.

## Arcade Physics

- `overlap` reports contact without separating bodies (bullets, pickups); `collider` also separates (solid obstacles).
- Use **separate groups per team** (`playerBullets`, `enemyBullets`, `players`, `enemies`) and register only the pairs that should interact. Players' bullets never get a collider against players, so friendly fire cannot happen.
- Set circular bodies for round shapes: `body.setCircle(r, offsetX, offsetY)`. Shrink them slightly below the sprite.
- Flight movement: compute velocity yourself from heading, thrust and gravity (`body.setVelocity`) and set `rotation` from the heading. Do not mix this with `body.setAcceleration` on the same object.

## Object pooling

```ts
this.bullets = this.physics.add.group({ classType: Bullet, maxSize: 200, runChildUpdate: true });
// fire:
const b = this.bullets.get(x, y) as Bullet | null;
if (b) b.fire(x, y, angle, ownerId);
// retire:
b.setActive(false).setVisible(false); b.body.enable = false;
```

Reset every field in `fire()`; stale state from the previous use is the usual pooling bug.

## Input

- Keyboard: `this.input.keyboard.addKeys({...})`; gamepad: `this.input.gamepad.pad1` (or `getPad(i)` for multiple pads). Wait for the `connected` event before reading a pad.
- Wrap both in an `InputMap` class that returns an action snapshot per tick: `{thrust, turn (-1..1), gun, missile, special, flare}`. Apply a dead zone to sticks.
- Browsers need a user gesture before audio plays; start sound after the first click or key press.

## Placeholder art

Generate textures in code so there are no external assets:

```ts
const g = this.add.graphics();
g.fillStyle(0xa8e66e).fillTriangle(0, 0, 24, 8, 0, 16);
g.generateTexture('plane', 24, 16); g.destroy();
```

Use a small palette (a handful of greens for a Game Boy look). Bitmap fonts keep pixel text crisp.

## Camera

- `camera.startFollow(target, true, 0.1, 0.1)` for smooth follow; `camera.shake(duration, intensity)` for impact; `camera.setBounds()` to clamp.
- Multi-target (co-op): follow an invisible object positioned at the midpoint of the players and adjust `camera.setZoom` to keep everyone visible.

## Particles, tweens, text

- Use the particle emitter for smoke/missile trails and explosions; cap `maxParticles` and keep `lifespan` short.
- Tweens for HUD pop-ups and callout text ("Bullseye!"); destroy or recycle text objects after they finish.
- Prefer `Phaser.GameObjects.Text` with a pixel font, set `resolution` for crisp rendering.

## Common gotchas

- Forgetting to remove event listeners on scene restart causes double-firing.
- `body.enable = false` on pooled objects, or inactive bullets still collide.
- Large delta after a tab switch: clamp delta.
- Scaling modes: use `pixelArt: true` and integer scaling when possible to avoid blurry sprites.
