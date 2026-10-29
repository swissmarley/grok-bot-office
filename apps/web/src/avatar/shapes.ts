import type { AvatarShape } from '@grok-office/shared';

// Grok Bot avatar silhouettes, rebuilt procedurally from the app's "Create New Bot"
// picker: soft colored blobs with two slanted capsule eyes. One outline per shape, in
// unit space (y up, fits in [-1, 1]), shared by the 2D icon and the extruded 3D figure.

export type Pt = [number, number];

export interface AvatarGeometry {
  outline: Pt[];
  /** Eye centers; eyes are capsules of EYE.rx × EYE.ry rotated by `eyeTilt` (default EYE.tilt). */
  eyes: [Pt, Pt];
  eyeTilt?: number;
  /** Pumpkin stem, drawn darker on top of the outline. */
  stem?: Pt[];
}

export const EYE = { rx: 0.095, ry: 0.22, tilt: 0.42 };

const TAU = Math.PI * 2;

function polar(r: (t: number) => number, n = 144): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    const radius = r(t);
    return [Math.cos(t) * radius, Math.sin(t) * radius];
  });
}

/** Corner-cutting smoothing for closed outlines. */
function chaikin(pts: Pt[], iterations: number): Pt[] {
  let out = pts;
  for (let k = 0; k < iterations; k++) {
    const next: Pt[] = [];
    for (let i = 0; i < out.length; i++) {
      const [ax, ay] = out[i]!;
      const [bx, by] = out[(i + 1) % out.length]!;
      next.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
    }
    out = next;
  }
  return out;
}

/** Polygon with straight sides and rounded corners: more points per side = tighter corners. */
function roundedPolygon(sides: number, rotation: number, perSide: number): Pt[] {
  const corners = Array.from({ length: sides }, (_, i): Pt => {
    const t = rotation + (i / sides) * TAU;
    return [Math.cos(t), Math.sin(t)];
  });
  const dense: Pt[] = [];
  corners.forEach(([ax, ay], i) => {
    const [bx, by] = corners[(i + 1) % sides]!;
    for (let k = 0; k < perSide; k++) dense.push([ax + ((bx - ax) * k) / perSide, ay + ((by - ay) * k) / perSide]);
  });
  return chaikin(dense, 4);
}

function rotate(pts: Pt[], angle: number): Pt[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

/** Centers on the bounding box and scales the larger side to 2. */
function fit(pts: Pt[]): { pts: Pt[]; map: (p: Pt) => Pt } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const k = 2 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const map = ([x, y]: Pt): Pt => [(x - cx) * k, (y - cy) * k];
  return { pts: pts.map(map), map };
}

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const bump = (t: number, at: number, width: number) => Math.exp(-((angleDiff(t, at) / width) ** 2));

/** Outline of a union of circles [cx, cy, r] (the origin must be inside), notches softened. */
function circles(cs: [number, number, number][]): Pt[] {
  const raw = polar((t) => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    let far = 0;
    for (const [cx, cy, r] of cs) {
      const p = cx * c + cy * s;
      const disc = r * r - (cx * cx + cy * cy - p * p);
      if (disc >= 0) far = Math.max(far, p + Math.sqrt(disc));
    }
    return far;
  }, 240);
  return chaikin(raw.filter((_, i) => i % 4 === 0), 3);
}

/** Capsule of length 2 and height h. */
function pill(h: number): Pt[] {
  const r = h / 2;
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI;
    pts.push([1 - r + Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 2 + (i / 24) * Math.PI;
    pts.push([-1 + r + Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

function build(shape: AvatarShape): AvatarGeometry {
  switch (shape) {
    case 'blob':
      return { outline: fit(polar(() => 1)).pts, eyes: [[0.1, 0.34], [0.5, 0.46]] };
    case 'cloud':
      return {
        outline: fit(circles([[0.15, 0.25, 0.55], [-0.45, 0.18, 0.42], [-0.38, -0.3, 0.44], [0.15, -0.32, 0.5], [0.55, -0.05, 0.44]])).pts,
        eyes: [[0.0, 0.26], [0.42, 0.32]],
      };
    case 'square':
      return { outline: fit(roundedPolygon(4, Math.PI / 4 + 0.3, 3)).pts, eyes: [[-0.06, 0.06], [0.32, 0.1]] };
    case 'sparkle':
      return {
        outline: fit(polar((t) => 0.6 + 0.4 * Math.abs(Math.cos(2 * (t - 0.22))) ** 1.8)).pts,
        eyes: [[-0.06, 0.14], [0.3, 0.2]],
      };
    case 'clover': {
      const d = 0.42;
      const lobes = [0, 1, 2, 3].map((i): [number, number, number] => {
        const a = Math.PI / 4 + 0.15 + (i * Math.PI) / 2;
        return [Math.cos(a) * d, Math.sin(a) * d, 0.5];
      });
      return { outline: fit(circles([...lobes, [0, 0, 0.5]])).pts, eyes: [[-0.1, 0.08], [0.3, 0.14]] };
    }
    case 'heart': {
      const heart = Array.from({ length: 160 }, (_, i): Pt => {
        const t = (i / 160) * TAU;
        return [16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)];
      });
      // Chubby: pulled halfway toward a circle, so the cleft is shallow and the tip blunt, leaning right.
      const mean = heart.reduce((sum, [x, y]) => sum + Math.hypot(x, y), 0) / heart.length;
      const chubby = heart.map(([x, y]): Pt => {
        const r = Math.hypot(x, y);
        const k = (0.55 * r + 0.45 * mean) / r;
        return [x * k, y * k];
      });
      // Resample coarsely, then smooth: rounds off the cusp at the tip.
      const coarse = chubby.filter((_, i) => i % 10 === 0);
      return { outline: fit(rotate(chaikin(coarse, 4), 0.45)).pts, eyes: [[0.14, 0.1], [0.5, 0.16]] };
    }
    case 'flower': {
      const lobes = Array.from({ length: 8 }, (_, i): [number, number, number] => {
        const a = 0.2 + (i / 8) * TAU;
        return [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.4];
      });
      return { outline: fit(circles([...lobes, [0, 0, 0.66]])).pts, eyes: [[-0.02, 0.08], [0.36, 0.14]] };
    }
    case 'teardrop': {
      // A drop with its soft tip up and to the left.
      const drop = polar((t) => 1 + 0.42 * bump(t, 2.05, 0.55));
      return { outline: fit(chaikin(drop, 2)).pts, eyes: [[0.12, 0.16], [0.48, 0.24]] };
    }
    case 'pill':
      return { outline: fit(rotate(pill(1.4), 0.24)).pts, eyes: [[0.0, 0.16], [0.44, 0.26]] };
    case 'wedge':
      return { outline: fit(roundedPolygon(3, -0.3, 2)).pts, eyes: [[-0.1, 0.2], [0.22, 0.24]], eyeTilt: 1.0 };
    case 'pentagon':
      return { outline: fit(roundedPolygon(5, Math.PI / 2 + 0.35, 3)).pts, eyes: [[-0.14, 0.04], [0.22, 0.1]] };
    case 'star':
      return {
        outline: fit(polar((t) => 0.84 + 0.14 * Math.cos(7 * (t - 0.3)) + 0.03 * Math.cos(2 * t))).pts,
        eyes: [[-0.04, 0.08], [0.32, 0.14]],
      };
    case 'hex':
      return { outline: fit(roundedPolygon(6, 0.28, 4)).pts, eyes: [[-0.16, 0.12], [0.3, 0.18]] };
    case 'pumpkin': {
      const raw = polar((t) => {
        const base = 1 / Math.hypot(Math.cos(t) / 1.04, Math.sin(t) / 0.92);
        return base * (1 - 0.12 * bump(t, Math.PI / 2 + 0.25, 0.3) + 0.025 * Math.cos(9 * t) * bump(t, -Math.PI / 2, 1.1));
      });
      const { pts, map } = fit(raw);
      const stem: Pt[] = (
        [[-0.08, 0.7], [0.06, 0.72], [-0.02, 1.0], [-0.22, 1.12], [-0.3, 1.02], [-0.14, 0.94]] as Pt[]
      ).map(map);
      return { outline: pts, eyes: [[0.14, 0.2], [0.56, 0.3]], stem };
    }
  }
}

const cache = new Map<AvatarShape, AvatarGeometry>();

export function avatarGeometry(shape: AvatarShape = 'blob'): AvatarGeometry {
  let geo = cache.get(shape);
  if (!geo) {
    geo = build(shape);
    cache.set(shape, geo);
  }
  return geo;
}

/** SVG path data, y flipped for SVG's downward axis. */
export function svgPath(pts: Pt[]): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${(-y).toFixed(3)}`).join('') + 'Z';
}
