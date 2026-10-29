import type { AvatarShape } from '@grok-office/shared';
import { EYE, avatarGeometry, svgPath } from './shapes';

const EYE_COLOR = '#111111';
export const STEM_COLOR = '#3F3F46';

export function AvatarIcon({ shape, color, size = 32, closedEyes = false, main = false }: {
  shape?: AvatarShape;
  color: string;
  size?: number;
  closedEyes?: boolean;
  /** The account's main bot: an orange star badge, as in Grok Bot. */
  main?: boolean;
}) {
  const geo = avatarGeometry(shape);
  const deg = (-(geo.eyeTilt ?? EYE.tilt) * 180) / Math.PI;
  return (
    <svg aria-hidden width={size} height={size} viewBox="-1.15 -1.15 2.3 2.3" className="shrink-0 overflow-visible">
      {geo.stem && <path d={svgPath(geo.stem)} fill={STEM_COLOR} />}
      <path d={svgPath(geo.outline)} fill={color} />
      {geo.eyes.map(([x, y]) => (
        <rect
          key={x}
          x={x - EYE.rx}
          y={-y - (closedEyes ? EYE.rx : EYE.ry)}
          width={EYE.rx * 2}
          height={(closedEyes ? EYE.rx : EYE.ry) * 2}
          rx={EYE.rx}
          fill={EYE_COLOR}
          transform={`rotate(${deg} ${x} ${-y})`}
        />
      ))}
      {main && <MainBadge />}
    </svg>
  );
}

const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 0.11 : 0.25;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return `${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`;
}).join(' ');

function MainBadge() {
  return (
    <g transform="translate(0.68 0.68)">
      <circle r="0.44" fill="var(--panel)" />
      <circle r="0.36" fill={MAIN_BADGE_COLOR} />
      <polygon points={STAR} fill="#FFFFFF" strokeLinejoin="round" stroke="#FFFFFF" strokeWidth="0.04" />
    </g>
  );
}

export const MAIN_BADGE_COLOR = '#FF9800';
