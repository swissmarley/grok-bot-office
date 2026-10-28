import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { WALL_HEIGHT, type RoomSize } from './layout';
import type { Lighting } from './lighting';

const FLOOR = '#252E40';
const WALL = '#2E3850';
const FRAME = '#3A4560';
const WIN_W = 1.6;
const WIN_H = 1.1;

function useSkyTexture([top, bottom]: [string, string]) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 64);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [top, bottom]);
}

function Stars({ seed }: { seed: number }) {
  const positions = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 18; i++) {
      const r1 = Math.abs(Math.sin((i + 1) * 12.9898 + seed) * 43758.5453) % 1;
      const r2 = Math.abs(Math.sin((i + 1) * 78.233 + seed) * 12543.123) % 1;
      out.push((r1 - 0.5) * (WIN_W - 0.1), (r2 - 0.3) * (WIN_H - 0.1), 0.05);
    }
    return new Float32Array(out);
  }, [seed]);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#FFFFFF" size={2.2} sizeAttenuation={false} toneMapped={false} />
    </points>
  );
}

function Window({ position, rotationY = 0, sky, stars, seed }: {
  position: [number, number, number];
  rotationY?: number;
  sky: CanvasTexture;
  stars: boolean;
  seed: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[WIN_W + 0.2, WIN_H + 0.2, 0.04]} />
        <meshStandardMaterial color={FRAME} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[WIN_W, WIN_H]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      {stars && <Stars seed={seed} />}
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.05, WIN_H, 0.02]} />
        <meshStandardMaterial color={FRAME} />
      </mesh>
      <mesh position={[0, -WIN_H / 2 - 0.1, 0.08]}>
        <boxGeometry args={[WIN_W + 0.3, 0.05, 0.14]} />
        <meshStandardMaterial color={FRAME} />
      </mesh>
    </group>
  );
}

export function Room({ size, lighting }: { size: RoomSize; lighting: Lighting }) {
  const { width, depth, backZ } = size;
  const midZ = backZ + depth / 2;
  const sky = useSkyTexture(lighting.sky);
  const win = { sky, stars: lighting.stars };
  return (
    <group>
      <mesh position={[0, -0.05, midZ]} receiveShadow>
        <boxGeometry args={[width, 0.1, depth]} />
        <meshStandardMaterial color={FLOOR} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, WALL_HEIGHT / 2, backZ - 0.1]} receiveShadow>
        <boxGeometry args={[width + 0.2, WALL_HEIGHT, 0.2]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-width / 2 - 0.1, WALL_HEIGHT / 2, midZ]} receiveShadow>
        <boxGeometry args={[0.2, WALL_HEIGHT, depth]} />
        <meshStandardMaterial color={WALL} />
      </mesh>
      {/* Skirting */}
      <mesh position={[0, 0.06, backZ + 0.01]}>
        <boxGeometry args={[width, 0.12, 0.02]} />
        <meshStandardMaterial color="#232B3D" />
      </mesh>
      <mesh position={[-width / 2 + 0.01, 0.06, midZ]}>
        <boxGeometry args={[0.02, 0.12, depth]} />
        <meshStandardMaterial color="#232B3D" />
      </mesh>
      <Window position={[-1.3, 1.8, backZ]} seed={1} {...win} />
      <Window position={[2.6, 1.8, backZ]} seed={2} {...win} />
      <Window position={[-width / 2, 1.8, backZ + 4.4]} rotationY={Math.PI / 2} seed={3} {...win} />
      <Window position={[-width / 2, 1.8, backZ + 7.6]} rotationY={Math.PI / 2} seed={4} {...win} />
    </group>
  );
}
