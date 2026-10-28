import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Shape,
  Vector2,
} from 'three';
import type { AvatarShape, Bot, BotStatus } from '@grok-office/shared';
import { STEM_COLOR } from '../avatar/AvatarIcon';
import { EYE, avatarGeometry } from '../avatar/shapes';
import { STATUS_LABEL, statusHex, statusVar } from '../status';
import { useOffice } from '../store';
import { CHAIR_COLOR, CHAIR_OFFSET_Z, CHAIR_PARTS, SCREEN_OFFSET } from './Desks';
import { deskPosition } from './layout';

// A bot: its Grok Bot avatar as a soft extruded figure, sitting on a swivel chair.
// Working, it faces its monitor; otherwise it turns toward the room (the camera).

const AVATAR_SCALE = 0.36;
const DEPTH = 0.5;
const BEVEL = 0.25;
const FRONT_Z = DEPTH / 2 + BEVEL;
/** Height of the avatar's center above the floor while seated. */
const BODY_Y = 0.94;
const HEAD_TOP = BODY_Y + 0.42;

const FACE_MONITOR = Math.PI;
const FACE_CAMERA = Math.PI / 4;
const FACING: Record<BotStatus, number> = {
  coding: FACE_MONITOR,
  browsing: FACE_MONITOR,
  terminal: FACE_MONITOR,
  thinking: FACE_MONITOR,
  error: FACE_MONITOR,
  needs_you: FACE_CAMERA,
  done: FACE_CAMERA,
  idle: FACE_CAMERA,
  sleeping: FACE_CAMERA,
};

/** Still pose per state (lean forward, tilt sideways, squash); reduced motion keeps only these. */
const POSE: Record<BotStatus, { lean: number; tilt: number; squash: number }> = {
  coding: { lean: 0.08, tilt: 0, squash: 1 },
  browsing: { lean: 0.04, tilt: 0, squash: 1 },
  terminal: { lean: 0.2, tilt: 0, squash: 1 },
  thinking: { lean: 0, tilt: 0, squash: 1 },
  needs_you: { lean: 0, tilt: 0, squash: 1 },
  error: { lean: 0.32, tilt: 0.14, squash: 0.86 },
  done: { lean: 0, tilt: 0, squash: 1 },
  idle: { lean: 0, tilt: 0, squash: 1 },
  sleeping: { lean: -0.16, tilt: 0.3, squash: 0.96 },
};

const BUBBLE_MAX = 40;
const DONE_CELEBRATION_S = 2;

const geometries = new Map<AvatarShape, ExtrudeGeometry>();
function avatarExtrusion(shape: AvatarShape): ExtrudeGeometry {
  let geo = geometries.get(shape);
  if (!geo) {
    const outline = new Shape(avatarGeometry(shape).outline.map(([x, y]) => new Vector2(x, y)));
    geo = new ExtrudeGeometry(outline, {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: 0.1,
      bevelSegments: 5,
      curveSegments: 4,
    });
    geo.center();
    geo.computeVertexNormals();
    geometries.set(shape, geo);
  }
  return geo;
}

let glowTexture: CanvasTexture | undefined;
function glow(): CanvasTexture {
  if (!glowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glowTexture = new CanvasTexture(c);
  }
  return glowTexture;
}

function dampAngle(current: number, target: number, k: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * k;
}

function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : chars.slice(0, max - 1).join('') + '…';
}

export function BotFigure({ bot, reduced }: { bot: Bot; reduced: boolean }) {
  const [dx, dy, dz] = deskPosition(bot.deskIndex);
  const seat: [number, number, number] = [dx, dy, dz + CHAIR_OFFSET_Z];
  const selected = useOffice((s) => s.selectedId === bot.id);
  const hovered = useOffice((s) => s.hoveredId === bot.id);
  const allTasks = useOffice((s) => s.allTasks);
  const select = useOffice((s) => s.select);
  const hover = useOffice((s) => s.hover);
  const invalidate = useThree((s) => s.invalidate);

  const swivel = useRef<Group>(null);
  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const hands = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const phase = useMemo(() => (bot.id.length * 1.37) % 6, [bot.id]);

  // Remember when the bot became done, for the hop + confetti.
  const doneAt = useRef<number | null>(null);
  const prevStatus = useRef(bot.status);
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    if (bot.status === 'done' && prevStatus.current !== 'done' && !reduced) {
      doneAt.current = clock.elapsedTime;
      invalidate();
    }
    prevStatus.current = bot.status;
  }, [bot.status, reduced, clock, invalidate]);

  const shape = bot.avatar?.shape ?? 'round';
  const geo = avatarGeometry(shape);
  const bodyColor = useMemo(() => new Color(bot.color), [bot.color]);
  const handColor = useMemo(() => new Color(bot.color).multiplyScalar(0.75), [bot.color]);
  const status = bot.status;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + phase;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
    let busy = false;

    if (swivel.current) {
      const goal = FACING[status];
      const next = dampAngle(swivel.current.rotation.y, goal, k);
      busy ||= Math.abs(next - goal) > 0.002;
      swivel.current.rotation.y = Math.abs(next - goal) > 0.002 ? next : goal;
    }

    if (body.current) {
      const pose = POSE[status];
      let y = 0;
      let lean = pose.lean;
      let tilt = pose.tilt;
      if (!reduced) {
        if (status === 'coding') {
          tilt += 0.07 * Math.sin(t * 3);
          y = 0.012 * Math.sin(t * 6);
        } else if (status === 'browsing') {
          lean += 0.05 * Math.sin(t * 1.3);
        } else if (status === 'thinking') {
          y = 0.05 + 0.05 * Math.sin(t * 1.4);
        }
        const since = doneAt.current === null ? Infinity : state.clock.elapsedTime - doneAt.current;
        if (status === 'done' && since < DONE_CELEBRATION_S) {
          y = 0.14 * Math.abs(Math.sin(since * Math.PI * 2));
          busy = true;
        }
      }
      body.current.position.y = BODY_Y + y;
      body.current.rotation.set(lean, 0, tilt);
      body.current.scale.set(1, pose.squash, 1);
    }

    if (hands.current) {
      hands.current.visible = status === 'coding';
      if (!reduced && status === 'coding') {
        hands.current.children.forEach((h, i) => {
          h.position.y = 0.8 + 0.03 * Math.max(0, Math.sin(t * 14 + i * Math.PI));
        });
      }
    }

    if (ring.current) {
      const pulse = status === 'needs_you' && !reduced ? 1 + 0.28 * (0.5 + 0.5 * Math.sin(t * 4)) : 1;
      ring.current.scale.setScalar(pulse);
      (ring.current.material as MeshBasicMaterial).opacity = status === 'needs_you' && !reduced ? 1.25 - pulse * 0.5 : 1;
    }

    if (glowRef.current) {
      const on = status === 'coding' || status === 'browsing';
      glowRef.current.visible = on;
      if (on && !reduced) (glowRef.current.material as MeshBasicMaterial).opacity = 0.42 + 0.08 * Math.sin(t * 2.2);
    }

    if (busy) invalidate();
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hover(bot.id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    hover(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(selected ? null : bot.id);
  };

  const showBubble = (selected || hovered || allTasks || status === 'needs_you') && bot.activity !== '';
  const ringColor = statusHex(status);
  const eyeScaleY = status === 'sleeping' ? 0.28 : 1;

  return (
    <group position={seat}>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, selected ? 0.5 : 0.46, 40]} />
        <meshBasicMaterial color={ringColor} toneMapped={false} transparent depthWrite={false} />
      </mesh>

      <group ref={swivel} rotation={[0, FACING[status], 0]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        {/* Chair, in the bot's frame: it faces local +z, so the back sits at -z. */}
        {CHAIR_PARTS.map((part, i) => (
          <mesh key={i} position={[part.offset[0], part.offset[1], -part.offset[2]]} castShadow>
            <boxGeometry args={part.size} />
            <meshStandardMaterial color={CHAIR_COLOR} />
          </mesh>
        ))}
        <group ref={body} position={[0, BODY_Y, 0]}>
          <group scale={AVATAR_SCALE}>
            <mesh geometry={avatarExtrusion(shape)} castShadow>
              <meshStandardMaterial color={bodyColor} roughness={0.45} emissive={bodyColor} emissiveIntensity={0.14} />
            </mesh>
            {geo.eyes.map(([x, y]) => (
              <mesh key={x} position={[x, y, FRONT_Z - 0.02]} rotation={[0, 0, geo.eyeTilt ?? EYE.tilt]} scale={[1, eyeScaleY, 0.35]}>
                <capsuleGeometry args={[EYE.rx, 2 * (EYE.ry - EYE.rx), 4, 10]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
            ))}
            {geo.stem && <Stem points={geo.stem} />}
          </group>
        </group>
        <group ref={hands} visible={false}>
          {[-0.16, 0.16].map((x) => (
            <mesh key={x} position={[x, 0.8, 0.4]}>
              <sphereGeometry args={[0.055, 12, 12]} />
              <meshStandardMaterial color={handColor} />
            </mesh>
          ))}
        </group>
      </group>

      <mesh
        ref={glowRef}
        position={[SCREEN_OFFSET[0], SCREEN_OFFSET[1], SCREEN_OFFSET[2] - CHAIR_OFFSET_Z + 0.04]}
        visible={false}
      >
        <planeGeometry args={[1.5, 1.0]} />
        <meshBasicMaterial map={glow()} color={ringColor} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>

      {!reduced && <Confetti doneAt={doneAt} />}

      <Html position={[0, HEAD_TOP + 0.08, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex origin-bottom -translate-x-1/2 -translate-y-full flex-col items-center gap-1 max-sm:scale-[0.72]">
          <Indicator status={status} />
          {showBubble && (
            <div className="gbo-bubble w-max max-w-[200px] rounded-xl bg-white px-2.5 py-1 text-center text-[11px] leading-snug font-medium text-slate-900 shadow-lg">
              {truncate(bot.activity, BUBBLE_MAX)}
            </div>
          )}
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-panel/90 px-2 py-0.5 text-[11px] font-medium shadow ${selected ? 'border-white/70' : 'border-line'}`}
          >
            <span className="size-1.5 rounded-full" style={{ background: statusVar(status) }} />
            <span>{bot.name}</span>
            <span className="sr-only">{STATUS_LABEL[status]}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

function Stem({ points }: { points: [number, number][] }) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return (
    <mesh position={[cx, cy, 0]} rotation={[0, 0, 0.45]}>
      <capsuleGeometry args={[0.07, 0.3, 4, 8]} />
      <meshStandardMaterial color={STEM_COLOR} />
    </mesh>
  );
}

function Indicator({ status }: { status: BotStatus }) {
  switch (status) {
    case 'thinking':
      return (
        <div className="gbo-dots flex gap-1 rounded-full bg-panel/90 px-2 py-1" aria-hidden>
          <span /><span /><span />
        </div>
      );
    case 'needs_you':
      return <div className="gbo-bounce text-2xl leading-none font-black text-st-needs drop-shadow" aria-hidden>!</div>;
    case 'error':
      return (
        <div className="grid size-6 place-items-center rounded-full bg-st-error text-sm font-black text-white shadow" aria-hidden>
          ×
        </div>
      );
    case 'sleeping':
      return <div className="gbo-zzz text-sm font-bold text-slate-300" aria-hidden>Zzz</div>;
    default:
      return null;
  }
}

const CONFETTI = 28;
const CONFETTI_COLORS = ['#F59E0B', '#22C55E', '#3B82F6', '#EF4444', '#A855F7', '#FFFFFF'];

function Confetti({ doneAt }: { doneAt: MutableRefObject<number | null> }) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const seeds = useMemo(
    () => Array.from({ length: CONFETTI }, (_, i) => ({ a: (i / CONFETTI) * Math.PI * 2, v: 0.6 + ((i * 37) % 10) / 12, spin: (i % 5) + 2 })),
    [],
  );
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    seeds.forEach((_, i) => mesh.setColorAt(i, new Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length])));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seeds]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const since = doneAt.current === null ? Infinity : state.clock.elapsedTime - doneAt.current;
    mesh.visible = since < DONE_CELEBRATION_S;
    if (!mesh.visible) return;
    seeds.forEach((s, i) => {
      const r = s.v * since * 0.9;
      dummy.position.set(Math.cos(s.a) * r, HEAD_TOP + 0.2 + s.v * 1.6 * since - 2.2 * since * since, Math.sin(s.a) * r);
      dummy.rotation.set(since * s.spin, since * s.spin * 0.7, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CONFETTI]} visible={false}>
      <planeGeometry args={[0.06, 0.035]} />
      <meshBasicMaterial side={2} toneMapped={false} />
    </instancedMesh>
  );
}
