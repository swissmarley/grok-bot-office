import type { AvatarShape } from '@grok-office/shared';
import { EYE, avatarGeometry, svgPath } from './shapes';

const EYE_COLOR = '#111111';
export const STEM_COLOR = '#3F3F46';

export function AvatarIcon({ shape, color, size = 32, closedEyes = false }: {
  shape?: AvatarShape;
  color: string;
  size?: number;
  closedEyes?: boolean;
}) {
  const geo = avatarGeometry(shape);
  const deg = (-EYE.tilt * 180) / Math.PI;
  return (
    <svg aria-hidden width={size} height={size} viewBox="-1.15 -1.15 2.3 2.3" className="shrink-0">
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
    </svg>
  );
}
