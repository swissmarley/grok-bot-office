import { Instance, Instances } from '@react-three/drei';
import type { Bot } from '@grok-office/shared';
import { statusHex } from '../status';
import { DESK, deskPosition } from './layout';

type V3 = [number, number, number];

interface Part {
  color: string;
  /** Box size and offset from the desk center. */
  boxes: { size: V3; offset: V3 }[];
}

const { width: W, depth: D, height: H } = DESK;

// Repeated furniture, one instanced mesh per part.
const PARTS: Part[] = [
  { color: '#3A2F2A', boxes: [{ size: [W, 0.06, D], offset: [0, H, 0] }] },
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
    color: '#9AA3B2',
    boxes: [
      { size: [0.42, 0.02, 0.28], offset: [0.52, H + 0.04, 0.08] },
      { size: [0.42, 0.28, 0.02], offset: [0.52, H + 0.18, -0.06] },
    ],
  },
  // Chair: seat, back, post
  {
    color: '#2C3A52',
    boxes: [
      { size: [0.5, 0.08, 0.48], offset: [0, 0.46, 0.8] },
      { size: [0.5, 0.42, 0.07], offset: [0, 0.72, 1.06] },
      { size: [0.06, 0.4, 0.06], offset: [0, 0.22, 0.8] },
    ],
  },
];

export function Desks({ count, bots }: { count: number; bots: Bot[] }) {
  const desks = Array.from({ length: count }, (_, i) => deskPosition(i));
  const byDesk = new Map(bots.map((b) => [b.deskIndex, b]));

  return (
    <group>
      {PARTS.map((part, p) => (
        <Instances key={p} limit={count * part.boxes.length} castShadow receiveShadow>
          <boxGeometry />
          <meshStandardMaterial color={part.color} />
          {desks.flatMap(([x, y, z], d) =>
            part.boxes.map((box, b) => (
              <Instance
                key={`${d}-${b}`}
                position={[x + box.offset[0], y + box.offset[1], z + box.offset[2]]}
                scale={box.size}
              />
            )),
          )}
        </Instances>
      ))}
      {desks.map(([x, y, z], d) => (
        <Screen key={d} position={[x, y + H + 0.5, z - 0.235]} bot={byDesk.get(d)} />
      ))}
    </group>
  );
}

function Screen({ position, bot }: { position: V3; bot?: Bot }) {
  const off = !bot || bot.status === 'sleeping';
  const color = off ? '#05070B' : statusHex(bot.status);
  return (
    <mesh position={position}>
      <planeGeometry args={[0.78, 0.44]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={off ? 1 : 0.85} />
    </mesh>
  );
}
