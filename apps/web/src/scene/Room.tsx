import { ROOM } from './layout';

const FLOOR = '#252E40';
const WALL = '#2E3850';
const SKY = '#13254A';

function Window({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[1.8, 1.3, 0.04]} />
        <meshStandardMaterial color="#2B364C" />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.6, 1.1]} />
        <meshBasicMaterial color={SKY} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.05, 1.1, 0.02]} />
        <meshStandardMaterial color="#2B364C" />
      </mesh>
    </group>
  );
}

export function Room() {
  const { width, depth, wallHeight } = ROOM;
  return (
    <group>
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[width, 0.1, depth]} />
        <meshStandardMaterial color={FLOOR} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, wallHeight / 2, -depth / 2 - 0.1]} receiveShadow>
        <boxGeometry args={[width + 0.2, wallHeight, 0.2]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-width / 2 - 0.1, wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, wallHeight, depth]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      <Window position={[-1.5, 1.8, -depth / 2]} />
      <Window position={[2.5, 1.8, -depth / 2]} />
      <Window position={[-width / 2, 1.8, -1]} rotationY={Math.PI / 2} />
      <Window position={[-width / 2, 1.8, 2.5]} rotationY={Math.PI / 2} />
    </group>
  );
}
