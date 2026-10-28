import { Canvas, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { useLayoutEffect, useRef } from 'react';
import type { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import { useOffice } from '../store';
import { Desks } from './Desks';
import { Ghost } from './Ghost';
import { Room } from './Room';
import { WALL_HEIGHT, roomSize, type RoomSize } from './layout';

// Isometric: camera on the (1, 1, 1) diagonal → rotation Y 45°, X ≈ -35.26°.
const DISTANCE = 40;
const MARGIN = 1;

function IsoCamera({ room }: { room: RoomSize }) {
  const ref = useRef<ThreeOrthographicCamera>(null);
  const size = useThree((s) => s.size);

  // Screen extents of the room: floor diagonal across, floor + walls up.
  const span = room.width + room.depth;
  const screenW = span / Math.SQRT2 + MARGIN;
  const screenH = (span + 2 * WALL_HEIGHT) / Math.sqrt(6) + MARGIN;
  // Lift the target so walls and floor sit centered vertically.
  const target: [number, number, number] = [0, WALL_HEIGHT / 2, room.backZ + room.depth / 2];

  useLayoutEffect(() => {
    const cam = ref.current;
    if (!cam) return;
    cam.zoom = Math.min(size.width / screenW, size.height / screenH);
    cam.lookAt(...target);
    cam.updateProjectionMatrix();
  });

  return (
    <OrthographicCamera
      ref={ref}
      makeDefault
      position={[target[0] + DISTANCE, target[1] + DISTANCE, target[2] + DISTANCE]}
      near={0.1}
      far={300}
    />
  );
}

export function Office() {
  const bots = Object.values(useOffice((s) => s.bots));
  const desks = useOffice((s) => s.desks);
  const room = roomSize(desks);

  return (
    <Canvas shadows dpr={[1, 2]} frameloop="demand" className="!absolute inset-0">
      <color attach="background" args={['#0B0F17']} />
      <IsoCamera room={room} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#B8C6FF', '#2A3142', 0.6]} />
      <directionalLight
        position={[6, 12, 5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <Room size={room} />
      <Desks count={desks} bots={bots} />
      {bots.map((bot) => (
        <Ghost key={bot.id} bot={bot} />
      ))}
    </Canvas>
  );
}
