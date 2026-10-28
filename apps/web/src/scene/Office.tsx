import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { Vector3, type OrthographicCamera as ThreeOrthographicCamera } from 'three';
import type { BotStatus } from '@grok-office/shared';
import { useNow, useReducedMotion } from '../hooks';
import { useOffice } from '../store';
import { BotFigure } from './BotFigure';
import { CHAIR_OFFSET_Z, Desks } from './Desks';
import { Furniture } from './Furniture';
import { LIGHTING, resolvePreset } from './lighting';
import { Room } from './Room';
import { WALL_HEIGHT, deskPosition, roomSize, type RoomSize } from './layout';

// Isometric: camera on the (1, 1, 1) diagonal → rotation Y 45°, X ≈ -35.26°.
const OFFSET = new Vector3(40, 40, 40);
const MARGIN = 1;
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 3;

/** States with continuous motion; with none of these on screen the canvas renders on demand. */
const MOVING: ReadonlySet<BotStatus> = new Set(['coding', 'browsing', 'terminal', 'thinking', 'needs_you', 'idle']);

function CameraRig({ room, reduced }: { room: RoomSize; reduced: boolean }) {
  const ref = useRef<ThreeOrthographicCamera>(null);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const selected = useOffice((s) => (s.selectedId ? s.bots[s.selectedId] : undefined));
  const userZoom = useRef(1);
  const target = useRef(new Vector3(0, WALL_HEIGHT / 2, room.backZ + room.depth / 2));

  // Zoom that fits the whole room: floor diagonal across, floor + walls up.
  const span = room.width + room.depth;
  const fit = Math.min(size.width / (span / Math.SQRT2 + MARGIN), size.height / ((span + 2 * WALL_HEIGHT) / Math.sqrt(6) + MARGIN));

  const goal = new Vector3();
  if (selected) {
    const [x, , z] = deskPosition(selected.deskIndex);
    goal.set(x, 0.9, z + CHAIR_OFFSET_Z / 2);
  } else {
    goal.set(0, WALL_HEIGHT / 2, room.backZ + room.depth / 2);
  }

  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      userZoom.current = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, userZoom.current * Math.exp(-e.deltaY * 0.0015)));
      invalidate();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl, invalidate]);

  useEffect(() => invalidate(), [selected?.id, invalidate]);

  useFrame((_, dt) => {
    const cam = ref.current;
    if (!cam) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4);
    target.current.lerp(goal, k);
    if (target.current.distanceTo(goal) < 0.002) target.current.copy(goal);
    else invalidate();
    cam.position.copy(target.current).add(OFFSET);
    cam.lookAt(target.current);
    const zoom = fit * userZoom.current;
    if (Math.abs(cam.zoom - zoom) > 1e-3) {
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
    }
  });

  return <OrthographicCamera ref={ref} makeDefault position={OFFSET.toArray()} near={0.1} far={300} />;
}

export function Office() {
  const bots = Object.values(useOffice((s) => s.bots));
  const desks = useOffice((s) => s.desks);
  const timeOfDay = useOffice((s) => s.timeOfDay);
  const select = useOffice((s) => s.select);
  const reduced = useReducedMotion();
  const now = useNow(60_000);
  const lighting = LIGHTING[resolvePreset(timeOfDay, new Date(now))];
  const room = roomSize(desks);
  const moving = !reduced && bots.some((b) => MOVING.has(b.status));
  const shadowExtent = Math.max(room.width, room.depth) / 2 + 2;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={moving ? 'always' : 'demand'}
      className="!absolute inset-0"
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={[lighting.background]} />
      <CameraRig room={room} reduced={reduced} />
      <ambientLight color={lighting.ambient.color} intensity={lighting.ambient.intensity} />
      <hemisphereLight args={[lighting.hemi.sky, lighting.hemi.ground, lighting.hemi.intensity]} />
      <directionalLight
        position={lighting.sun.position}
        color={lighting.sun.color}
        intensity={lighting.sun.intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-bias={-0.0005}
      />
      <Room size={room} lighting={lighting} />
      <Furniture room={room} lamps={lighting.lamps} animate={!reduced} />
      <Desks count={desks} bots={bots} lamps={lighting.lamps} reduced={reduced} />
      {bots.map((bot) => (
        <BotFigure key={bot.id} bot={bot} reduced={reduced} />
      ))}
    </Canvas>
  );
}
