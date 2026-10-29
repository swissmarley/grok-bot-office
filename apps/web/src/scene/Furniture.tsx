import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import type { RoomSize } from './layout';

// Office furniture from primitives. Layout: rack, bookshelf and fridge on the back
// wall; whiteboard on the left wall; lounge (sofa, rug, floor lamp, poufs) at the
// front left; plants in the corners.

type V3 = [number, number, number];

function Box({ size, position, color, rotation }: { size: V3; position: V3; color: string; rotation?: V3 }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Rug({ position, size, color, round = false }: { position: V3; size: [number, number]; color: string; round?: boolean }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      {round ? <circleGeometry args={[size[0] / 2, 40]} /> : <planeGeometry args={size} />}
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Sofa({ position }: { position: V3 }) {
  const c = '#4C5D8A';
  return (
    <group position={position}>
      <RoundedBox args={[0.8, 0.4, 2.3]} radius={0.08} position={[0, 0.25, 0]} castShadow>
        <meshStandardMaterial color={c} />
      </RoundedBox>
      <RoundedBox args={[0.22, 0.85, 2.3]} radius={0.08} position={[-0.32, 0.47, 0]} castShadow>
        <meshStandardMaterial color={c} />
      </RoundedBox>
      {[-1.1, 1.1].map((z) => (
        <RoundedBox key={z} args={[0.8, 0.6, 0.2]} radius={0.08} position={[0, 0.35, z]} castShadow>
          <meshStandardMaterial color="#42517A" />
        </RoundedBox>
      ))}
      {[-0.5, 0.5].map((z) => (
        <RoundedBox key={z} args={[0.5, 0.12, 0.9]} radius={0.05} position={[0.08, 0.5, z]}>
          <meshStandardMaterial color="#5A6CA0" />
        </RoundedBox>
      ))}
    </group>
  );
}

function FloorLamp({ position, on }: { position: V3; on: boolean }) {
  return (
    <group position={position}>
      <Box size={[0.3, 0.04, 0.3]} position={[0, 0.02, 0]} color="#2B2F38" />
      <Box size={[0.04, 1.5, 0.04]} position={[0, 0.77, 0]} color="#2B2F38" />
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.16, 0.26, 0.32, 20, 1, true]} />
        <meshStandardMaterial color={on ? '#FFE7B8' : '#D8D2C4'} emissive="#FFB65C" emissiveIntensity={on ? 1.4 : 0} side={2} />
      </mesh>
      {on && <pointLight position={[0, 1.45, 0]} color="#FFC07A" intensity={4} distance={4.5} decay={1.6} />}
    </group>
  );
}

const BOOK_COLORS = ['#E76F51', '#2A9D8F', '#E9C46A', '#8AB17D', '#F4A261', '#6D597A', '#457B9D', '#B5838D'];

function Bookshelf({ position }: { position: V3 }) {
  const shelves = [0.4, 0.85, 1.3, 1.75];
  return (
    <group position={position}>
      <Box size={[1.5, 1.95, 0.38]} position={[0, 0.975, 0]} color="#5B4636" />
      <Box size={[1.4, 1.85, 0.3]} position={[0, 0.975, 0.05]} color="#3A2C22" />
      {shelves.map((y, s) => (
        <group key={y}>
          <Box size={[1.4, 0.04, 0.32]} position={[0, y - 0.22, 0.04]} color="#5B4636" />
          {Array.from({ length: 7 }, (_, i) => {
            const h = 0.26 + ((i * 7 + s * 3) % 5) * 0.025;
            return (
              <Box
                key={i}
                size={[0.12, h, 0.24]}
                position={[-0.56 + i * 0.16 + (s % 2) * 0.04, y - 0.2 + h / 2, 0.06]}
                color={BOOK_COLORS[(i + s * 3) % BOOK_COLORS.length]!}
              />
            );
          })}
        </group>
      ))}
    </group>
  );
}

function ServerRack({ position, animate }: { position: V3; animate: boolean }) {
  const leds = useRef<MeshStandardMaterial[]>([]);
  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    leds.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = Math.sin(t * (2 + i * 0.7) + i) > 0.2 ? 2.4 : 0.3;
    });
  });
  const colors = ['#22C55E', '#3B82F6', '#22C55E', '#F59E0B'];
  return (
    <group position={position}>
      <Box size={[0.75, 2.0, 0.7]} position={[0, 1.0, 0]} color="#151922" />
      {Array.from({ length: 6 }, (_, u) => (
        <group key={u} position={[0.38, 0.35 + u * 0.28, 0]}>
          <Box size={[0.02, 0.2, 0.6]} position={[0, 0, 0]} color="#222836" />
          {colors.map((c, i) => (
            <mesh key={i} position={[0.015, 0.04, -0.22 + i * 0.07]}>
              <boxGeometry args={[0.01, 0.025, 0.025]} />
              <meshStandardMaterial
                ref={(m) => {
                  if (m) leds.current[u * colors.length + i] = m;
                }}
                color={c}
                emissive={c}
                emissiveIntensity={1.6}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Whiteboard({ position }: { position: V3 }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <Box size={[1.9, 1.1, 0.05]} position={[0, 0, 0]} color="#A5ADBA" />
      <Box size={[1.8, 1.0, 0.02]} position={[0, 0, 0.03]} color="#F7F8FA" />
      {[
        { w: 0.7, x: -0.4, y: 0.28, c: '#3B82F6' },
        { w: 0.5, x: -0.5, y: 0.12, c: '#64748B' },
        { w: 0.55, x: -0.45, y: -0.02, c: '#64748B' },
        { w: 0.35, x: 0.45, y: 0.25, c: '#EF4444' },
        { w: 0.5, x: 0.4, y: -0.2, c: '#22C55E' },
      ].map((l, i) => (
        <Box key={i} size={[l.w, 0.035, 0.01]} position={[l.x, l.y, 0.045]} color={l.c} />
      ))}
      <Box size={[0.32, 0.22, 0.01]} position={[0.42, 0.05, 0.045]} color="#FDE68A" />
      <Box size={[1.6, 0.04, 0.1]} position={[0, -0.57, 0.06]} color="#A5ADBA" />
    </group>
  );
}

function Fridge({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.75, 1.75, 0.7]} radius={0.06} position={[0, 0.875, 0]} castShadow>
        <meshStandardMaterial color="#D9DEE7" />
      </RoundedBox>
      <Box size={[0.73, 0.015, 0.02]} position={[0, 1.15, 0.36]} color="#9AA3B2" />
      <Box size={[0.04, 0.3, 0.04]} position={[-0.28, 1.4, 0.37]} color="#8A93A2" />
      <Box size={[0.04, 0.4, 0.04]} position={[-0.28, 0.75, 0.37]} color="#8A93A2" />
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 16]} />
        <meshStandardMaterial color="#C2703D" />
      </mesh>
      {[
        [0, 0.62, 0, 0.26],
        [0.12, 0.8, 0.05, 0.2],
        [-0.1, 0.78, -0.06, 0.2],
        [0.02, 0.98, -0.02, 0.15],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x!, y!, z!]} castShadow>
          <icosahedronGeometry args={[r!, 0]} />
          <meshStandardMaterial color={i % 2 ? '#3E8E5A' : '#4FA66D'} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Pouf({ position, color }: { position: V3; color: string }) {
  return (
    <mesh position={[position[0], 0.18, position[2]]} castShadow>
      <cylinderGeometry args={[0.28, 0.3, 0.36, 20]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function Furniture({ room, lamps, animate }: { room: RoomSize; lamps: boolean; animate: boolean }) {
  const { backZ } = room;
  const left = -room.width / 2;
  return (
    <group>
      <ServerRack position={[left + 0.45, 0, backZ + 0.45]} animate={animate} />
      <Bookshelf position={[left + 2.1, 0, backZ + 0.22]} />
      <Plant position={[left + 3.3, 0, backZ + 0.35]} />
      <Fridge position={[room.width / 2 - 0.5, 0, backZ + 0.45]} />
      <Plant position={[room.width / 2 - 0.45, 0, backZ + 1.4]} scale={0.85} />

      <Whiteboard position={[left + 0.04, 1.55, backZ + 2.3]} />
      <Rug position={[left + 1.5, 0.005, backZ + 2.3]} size={[1.6, 1.6]} color="#2D3B55" round />
      <Pouf position={[left + 1.5, 0, backZ + 2.3]} color="#E9C46A" />

      {/* Lounge */}
      <Rug position={[left + 1.65, 0.005, backZ + 6.6]} size={[2.7, 3.2]} color="#3B4766" />
      <Sofa position={[left + 0.5, 0, backZ + 6.6]} />
      <Box size={[0.7, 0.32, 1.1]} position={[left + 1.75, 0.16, backZ + 6.6]} color="#5B4636" />
      <Pouf position={[left + 2.75, 0, backZ + 6.0]} color="#E76F51" />
      <Pouf position={[left + 2.75, 0, backZ + 7.2]} color="#2A9D8F" />
      <FloorLamp position={[left + 0.4, 0, backZ + 9.3]} on={lamps} />
      <Plant position={[left + 0.45, 0, backZ + 4.6]} scale={0.9} />
      <Plant position={[room.width / 2 - 0.45, 0, room.frontZ - 0.5]} scale={1.1} />
    </group>
  );
}
