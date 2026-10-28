import { Instance, Instances } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Bot } from '@grok-office/shared';
import { DESK, deskPosition } from './layout';
import { ANIMATED_SCREENS, SCREEN_H, SCREEN_W, drawScreen, type ScreenState } from './screens';

type V3 = [number, number, number];

interface Part {
  color: string;
  /** Box size and offset from the desk center. */
  boxes: { size: V3; offset: V3 }[];
}

const { width: W, depth: D, height: H } = DESK;

/** Screen center relative to the desk center; bots use it to aim their glow. */
export const SCREEN_OFFSET: V3 = [0, H + 0.5, -0.235];
const LAMP_HEAD: V3 = [-0.62, H + 0.48, -0.18];

// Repeated furniture, one instanced mesh per part (remounted when the desk count changes,
// since an instanced mesh can't grow).
const PARTS: Part[] = [
  { color: '#5B4636', boxes: [{ size: [W, 0.06, D], offset: [0, H, 0] }] },
  {
    color: '#2A2F3A',
    boxes: [
      { size: [0.06, H, 0.06], offset: [-W / 2 + 0.08, H / 2, -D / 2 + 0.08] },
      { size: [0.06, H, 0.06], offset: [W / 2 - 0.08, H / 2, -D / 2 + 0.08] },
      { size: [0.06, H, 0.06], offset: [-W / 2 + 0.08, H / 2, D / 2 - 0.08] },
      { size: [0.06, H, 0.06], offset: [W / 2 - 0.08, H / 2, D / 2 - 0.08] },
    ],
  },
  // Monitor: stand, foot, bezel
  {
    color: '#11151D',
    boxes: [
      { size: [0.06, 0.22, 0.06], offset: [0, H + 0.14, -0.22] },
      { size: [0.3, 0.02, 0.18], offset: [0, H + 0.04, -0.22] },
      { size: [0.86, 0.52, 0.04], offset: [0, H + 0.5, -0.26] },
    ],
  },
  // Laptop base and lid
  {
    color: '#A3ACBB',
    boxes: [
      { size: [0.42, 0.02, 0.28], offset: [0.52, H + 0.04, 0.08] },
      { size: [0.42, 0.28, 0.02], offset: [0.52, H + 0.18, -0.06] },
    ],
  },
  // Desk lamp: base, post, arm, shade
  {
    color: '#2B2F38',
    boxes: [
      { size: [0.16, 0.03, 0.16], offset: [-0.62, H + 0.045, -0.25] },
      { size: [0.03, 0.4, 0.03], offset: [-0.62, H + 0.25, -0.25] },
      { size: [0.03, 0.03, 0.12], offset: [-0.62, H + 0.45, -0.2] },
      { size: [0.14, 0.06, 0.14], offset: [LAMP_HEAD[0], LAMP_HEAD[1] + 0.02, LAMP_HEAD[2]] },
    ],
  },
];

// Chairs of empty desks; occupied desks get a chair that swivels with its bot.
export const CHAIR_PARTS: { size: V3; offset: V3 }[] = [
  { size: [0.5, 0.08, 0.48], offset: [0, 0.46, 0] },
  { size: [0.5, 0.42, 0.07], offset: [0, 0.72, 0.26] },
  { size: [0.06, 0.4, 0.06], offset: [0, 0.22, 0] },
];
export const CHAIR_OFFSET_Z = 0.8;
export const CHAIR_COLOR = '#2C3A52';

export function Desks({ count, bots, lamps, reduced }: { count: number; bots: Bot[]; lamps: boolean; reduced: boolean }) {
  const desks = Array.from({ length: count }, (_, i) => deskPosition(i));
  const byDesk = new Map(bots.map((b) => [b.deskIndex, b]));
  const empty = desks.filter((_, i) => !byDesk.has(i));

  return (
    <group>
      {PARTS.map((part, p) => (
        <Instances key={`${p}-${count}`} limit={Math.max(1, count * part.boxes.length)} castShadow receiveShadow>
          <boxGeometry />
          <meshStandardMaterial color={part.color} />
          {desks.flatMap(([x, y, z], d) =>
            part.boxes.map((box, b) => (
              <Instance key={`${d}-${b}`} position={[x + box.offset[0], y + box.offset[1], z + box.offset[2]]} scale={box.size} />
            )),
          )}
        </Instances>
      ))}
      {empty.length > 0 && (
        <Instances key={empty.length} limit={empty.length * CHAIR_PARTS.length} castShadow>
          <boxGeometry />
          <meshStandardMaterial color={CHAIR_COLOR} />
          {empty.flatMap(([x, y, z], d) =>
            CHAIR_PARTS.map((box, b) => (
              <Instance
                key={`${d}-${b}`}
                position={[x + box.offset[0], y + box.offset[1], z + CHAIR_OFFSET_Z + box.offset[2]]}
                scale={box.size}
              />
            )),
          )}
        </Instances>
      )}
      {/* Lamp bulbs and the pools of light they throw on the desk. */}
      <Instances key={`bulbs-${count}`} limit={Math.max(1, count)}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color={lamps ? '#FFE2A8' : '#6B6F7A'} emissive="#FFC46B" emissiveIntensity={lamps ? 2.2 : 0} toneMapped={!lamps} />
        {desks.map(([x, y, z], d) => (
          <Instance key={d} position={[x + LAMP_HEAD[0], y + LAMP_HEAD[1] - 0.02, z + LAMP_HEAD[2]]} />
        ))}
      </Instances>
      {lamps && (
        <Instances key={`pools-${count}`} limit={Math.max(1, count)}>
          <circleGeometry args={[0.42, 24]} />
          <meshBasicMaterial color="#FFC46B" transparent opacity={0.16} depthWrite={false} />
          {desks.map(([x, y, z], d) => (
            <Instance key={d} position={[x - 0.45, y + H + 0.035, z - 0.05]} rotation={[-Math.PI / 2, 0, 0]} />
          ))}
        </Instances>
      )}
      {desks.map(([x, y, z], d) => {
        const bot = byDesk.get(d);
        return (
          <Screen
            key={d}
            position={[x + SCREEN_OFFSET[0], y + SCREEN_OFFSET[1], z + SCREEN_OFFSET[2]]}
            state={bot?.status ?? 'empty'}
            color={bot?.color ?? '#64748B'}
            reduced={reduced}
          />
        );
      })}
    </group>
  );
}

const FPS = 12;

function Screen({ position, state, color, reduced }: { position: V3; state: ScreenState; color: string; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const { ctx, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return { ctx: canvas.getContext('2d')!, texture: tex };
  }, []);
  const last = useRef(0);
  const animated = !reduced && ANIMATED_SCREENS.has(state);

  useLayoutEffect(() => {
    drawScreen(ctx, state, 0, color);
    texture.needsUpdate = true;
    invalidate();
  }, [ctx, texture, state, color, invalidate]);

  useLayoutEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    if (!animated) return;
    const t = clock.elapsedTime;
    if (t - last.current < 1 / FPS) return;
    last.current = t;
    drawScreen(ctx, state, t, color);
    texture.needsUpdate = true;
  });

  return (
    <mesh position={position}>
      <planeGeometry args={[0.78, 0.44]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
