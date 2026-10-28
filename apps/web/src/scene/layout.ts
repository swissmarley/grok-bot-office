import { DESKS_PER_ROW } from '@grok-office/shared';

// Room geometry in world units. The back wall sits at z = -5 and the left wall at
// x = -6; the camera looks from +x +y +z. The room is 12 × 10 for up to three rows
// of desks and grows toward the camera, one row at a time, beyond that.

const BACK_Z = -5;
const ROW_PITCH = 3;
const FIRST_ROW_Z = -2.6;
const BASE_ROWS = 3;

export const WALL_HEIGHT = 3;
export const ROOM_WIDTH = 12;

export interface RoomSize {
  width: number;
  depth: number;
  /** z of the back wall and of the front edge. */
  backZ: number;
  frontZ: number;
}

export function roomSize(desks: number): RoomSize {
  const rows = Math.ceil(desks / DESKS_PER_ROW);
  const depth = 10 + Math.max(0, rows - BASE_ROWS) * ROW_PITCH;
  return { width: ROOM_WIDTH, depth, backZ: BACK_Z, frontZ: BACK_Z + depth };
}

/** Center of desk `index` on the floor; bots sit on the +z side, facing the back wall. */
export function deskPosition(index: number): [number, number, number] {
  const col = index % DESKS_PER_ROW;
  const row = Math.floor(index / DESKS_PER_ROW);
  return [-1.6 + col * 2.1, 0, FIRST_ROW_Z + row * ROW_PITCH];
}

export const DESK = { width: 1.6, depth: 0.8, height: 0.75 };
/** Where a bot sits, relative to its desk center. */
export const SEAT_OFFSET: [number, number, number] = [0, 0, 0.75];
