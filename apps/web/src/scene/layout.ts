// Room geometry in world units. The room spans x ∈ [-6, 6], z ∈ [-5, 5];
// back wall at z = -5, left wall at x = -6, camera looks from +x +y +z.

export const ROOM = { width: 12, depth: 10, wallHeight: 3 };
export const DESK_COLUMNS = 4;

/** Center of desk `index` on the floor; bots sit on the +z side, facing the back wall. */
export function deskPosition(index: number): [number, number, number] {
  const col = index % DESK_COLUMNS;
  const row = Math.floor(index / DESK_COLUMNS);
  return [-1.6 + col * 2.1, 0, -2.6 + row * 3];
}

export const DESK = { width: 1.6, depth: 0.8, height: 0.75 };
/** Where a bot sits, relative to its desk center. */
export const SEAT_OFFSET: [number, number, number] = [0, 0, 0.75];
