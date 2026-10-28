import { Canvas, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { useLayoutEffect, useRef } from 'react';
import type { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import { useOffice } from '../store';
import { Desks } from './Desks';
import { Ghost } from './Ghost';
import { Room } from './Room';

// Isometric: camera on the (1, 1, 1) diagonal → rotation Y 45°, X ≈ -35.26°.
const TARGET: [number, number, number] = [0, 1.5, 0];
const DISTANCE = 30;

function IsoCamera() {
  const ref = useRef<ThreeOrthographicCamera>(null);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    const cam = ref.current;
    if (!cam) return;
    // The room projects to about 16.5 × 12.5 units on screen.
    cam.zoom = Math.min(size.width / 16.5, size.height / 12.5);
    cam.lookAt(...TARGET);
    cam.updateProjectionMatrix();
  }, [size]);

  return (
    <OrthographicCamera
      ref={ref}
      makeDefault
      position={[TARGET[0] + DISTANCE, TARGET[1] + DISTANCE, TARGET[2] + DISTANCE]}
      near={0.1}
      far={200}
    />
  );
}

export function Office() {
  const bots = Object.values(useOffice((s) => s.bots));
  const desks = useOffice((s) => s.desks);

  return (
    <Canvas shadows dpr={[1, 2]} frameloop="demand" className="!absolute inset-0">
      <color attach="background" args={['#0B0F17']} />
      <IsoCamera />
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
      <Room />
      <Desks count={desks} bots={bots} />
      {bots.map((bot) => (
        <Ghost key={bot.id} bot={bot} />
      ))}
    </Canvas>
  );
}
