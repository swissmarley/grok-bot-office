import { Html } from '@react-three/drei';
import type { Bot } from '@grok-office/shared';
import { STATUS_LABEL, statusHex, statusVar } from '../status';
import { SEAT_OFFSET, deskPosition } from './layout';

/** A bot: a ghost-shaped blob (capsule + two eyes) sitting at its desk, facing the monitor (-z). */
export function Ghost({ bot }: { bot: Bot }) {
  const [x, y, z] = deskPosition(bot.deskIndex);
  const asleep = bot.status === 'sleeping';

  return (
    <group position={[x + SEAT_OFFSET[0], y + SEAT_OFFSET[1], z + SEAT_OFFSET[2]]}>
      <mesh position={[0, 0.98, 0]} castShadow>
        <capsuleGeometry args={[0.27, 0.34, 6, 16]} />
        <meshStandardMaterial color={bot.color} roughness={0.55} />
      </mesh>
      {[-0.1, 0.1].map((ex) => (
        <mesh key={ex} position={[ex, 1.1, -0.24]} scale={asleep ? [1, 0.25, 1] : 1}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#0B0F17" />
        </mesh>
      ))}
      {/* Status ring on the floor */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.42, 32]} />
        <meshBasicMaterial color={statusHex(bot.status)} toneMapped={false} />
      </mesh>
      <Html center position={[0, 1.72, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-panel/90 px-2 py-0.5 text-[11px] font-medium shadow">
          <span className="size-1.5 rounded-full" style={{ background: statusVar(bot.status) }} />
          <span>{bot.name}</span>
          <span className="sr-only">{STATUS_LABEL[bot.status]}</span>
        </div>
      </Html>
    </group>
  );
}
