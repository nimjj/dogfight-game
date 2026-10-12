import { GROUND_Y, WORLD_W } from '../constants.ts';
import { angleDiff, clamp, normAngle } from '../math.ts';

export const GRAVITY = 260;
export const DRAG = 0.001;
export const MIN_SPEED = 60;
export const STALL_TURN = 2.2;

export interface FlightBody {
  x: number;
  y: number;
  heading: number;
  speed: number;
}

export interface FlightParams {
  maxSpeed: number;
  stallSpeed: number;
  thrust: number;
  turnRate: number;
}

export interface FlightInput {
  turn: number;
  thrust: boolean;
}

/**
 * Arcade flight model. Speed is a scalar along the heading: climbing trades speed for height,
 * diving gains speed, and below stall speed the nose falls and the pilot loses control.
 * Returns true if the body hit the ground.
 */
export function stepFlight(b: FlightBody, input: FlightInput, f: FlightParams, dt: number): boolean {
  if (b.speed < f.stallSpeed) {
    b.heading += clamp(angleDiff(b.heading, Math.PI / 2), -STALL_TURN * dt, STALL_TURN * dt);
  } else {
    const agility = 0.55 + 0.45 * clamp(b.speed / 320, 0, 1);
    b.heading += clamp(input.turn, -1, 1) * f.turnRate * agility * dt;
  }
  b.heading = normAngle(b.heading);

  const accel = GRAVITY * Math.sin(b.heading) - DRAG * b.speed * b.speed + (input.thrust ? f.thrust : 0);
  b.speed = clamp(b.speed + accel * dt, MIN_SPEED, f.maxSpeed * 1.25);

  b.x += Math.cos(b.heading) * b.speed * dt;
  b.y += Math.sin(b.heading) * b.speed * dt;

  // ceiling: bounce back down
  if (b.y < 0) {
    b.y = 0;
    b.heading = normAngle(-b.heading);
    b.speed *= 0.8;
  }
  // side walls: mirror the heading
  if (b.x < 0) {
    b.x = 0;
    b.heading = normAngle(Math.PI - b.heading);
  } else if (b.x > WORLD_W) {
    b.x = WORLD_W;
    b.heading = normAngle(Math.PI - b.heading);
  }
  return b.y >= GROUND_Y;
}
