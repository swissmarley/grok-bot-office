import type { BotStatus } from '@grok-office/shared';

// Monitor contents per state, drawn on a small canvas. `t` is seconds; t = 0 gives
// the still frame used with reduced motion.

export const SCREEN_W = 192;
export const SCREEN_H = 108;

export type ScreenState = BotStatus | 'empty';

/** States whose screen changes over time. */
export const ANIMATED_SCREENS: ReadonlySet<ScreenState> = new Set(['coding', 'browsing', 'terminal', 'idle']);

const CODE_COLORS = ['#7AA2F7', '#BB9AF7', '#9ECE6A', '#E0AF68', '#7DCFFF', '#C0CAF5'];
const rand = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function fill(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

function code(ctx: CanvasRenderingContext2D, t: number) {
  fill(ctx, '#0D1222');
  const lineH = 9;
  const scroll = t * 18;
  const first = Math.floor(scroll / lineH);
  for (let i = -1; i < SCREEN_H / lineH + 1; i++) {
    const n = first + i;
    const y = i * lineH - (scroll % lineH) + 6;
    let x = 10 + (rand(n * 3.1) > 0.6 ? 12 : 0) + (rand(n * 1.7) > 0.85 ? 12 : 0);
    const tokens = 1 + Math.floor(rand(n) * 4);
    for (let k = 0; k < tokens; k++) {
      const w = 10 + rand(n * 7 + k) * 34;
      ctx.fillStyle = CODE_COLORS[Math.floor(rand(n * 5 + k) * CODE_COLORS.length)]!;
      ctx.fillRect(x, y, w, 4);
      x += w + 5;
    }
  }
  ctx.fillStyle = '#1A2238';
  ctx.fillRect(0, 0, 6, SCREEN_H);
}

function browser(ctx: CanvasRenderingContext2D, t: number) {
  fill(ctx, '#F4F6FA');
  const scroll = (t * 14) % 120;
  for (let i = 0; i < 6; i++) {
    const y = 22 + i * 30 - scroll;
    ctx.fillStyle = i % 3 === 0 ? '#C9D8F2' : '#DDE3EE';
    ctx.fillRect(12, y, i % 3 === 0 ? 60 : 168, i % 3 === 0 ? 24 : 5);
    ctx.fillStyle = '#E4E8F0';
    ctx.fillRect(i % 3 === 0 ? 80 : 12, y + (i % 3 === 0 ? 4 : 10), i % 3 === 0 ? 96 : 130, 5);
    ctx.fillRect(i % 3 === 0 ? 80 : 12, y + (i % 3 === 0 ? 14 : 18), i % 3 === 0 ? 70 : 150, 5);
  }
  ctx.fillStyle = '#E2E6EE';
  ctx.fillRect(0, 0, SCREEN_W, 16);
  ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(9 + i * 9, 8, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(40, 4, 140, 8);
}

const TERMINAL_LINES = ['$ npm test', '  ✓ checkout.spec.ts', '  ✓ cart.spec.ts', '$ git status', '  modified: src/pay.ts', '$ ls -la', '$ make build'];

function terminal(ctx: CanvasRenderingContext2D, t: number) {
  fill(ctx, '#050806');
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#4ADE80';
  const shown = Math.floor(t / 1.2) % TERMINAL_LINES.length;
  const lines = Array.from({ length: 6 }, (_, i) => TERMINAL_LINES[(shown + i) % TERMINAL_LINES.length]!);
  lines.forEach((line, i) => ctx.fillText(line, 8, 16 + i * 14));
  // Blinking block cursor after the last line.
  if (t === 0 || Math.floor(t * 2) % 2 === 0) ctx.fillRect(8 + ctx.measureText(lines[5]!).width + 3, 80, 6, 10);
}

function thinking(ctx: CanvasRenderingContext2D) {
  // Half off: a dimmed, still editor.
  code(ctx, 0);
  ctx.fillStyle = 'rgba(5, 7, 12, 0.6)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

function card(ctx: CanvasRenderingContext2D) {
  fill(ctx, '#151A26');
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.roundRect(36, 18, 120, 72, 8);
  ctx.fill();
  ctx.fillStyle = '#1F1300';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', 96, 64);
  ctx.textAlign = 'start';
}

function errorScreen(ctx: CanvasRenderingContext2D) {
  fill(ctx, '#7F1D1D');
  ctx.strokeStyle = '#FEE2E2';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(80, 38);
  ctx.lineTo(112, 70);
  ctx.moveTo(112, 38);
  ctx.lineTo(80, 70);
  ctx.stroke();
}

function doneScreen(ctx: CanvasRenderingContext2D) {
  fill(ctx, '#0B1A12');
  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.arc(96, 54, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#052E16';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(83, 55);
  ctx.lineTo(93, 65);
  ctx.lineTo(110, 45);
  ctx.stroke();
}

function screensaver(ctx: CanvasRenderingContext2D, t: number, color: string) {
  fill(ctx, '#070A12');
  const x = 30 + (Math.sin(t * 0.5) * 0.5 + 0.5) * 132;
  const y = 25 + (Math.sin(t * 0.37 + 1) * 0.5 + 0.5) * 58;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawScreen(ctx: CanvasRenderingContext2D, state: ScreenState, t: number, color: string) {
  switch (state) {
    case 'coding': return code(ctx, t);
    case 'browsing': return browser(ctx, t);
    case 'terminal': return terminal(ctx, t);
    case 'thinking': return thinking(ctx);
    case 'needs_you': return card(ctx);
    case 'error': return errorScreen(ctx);
    case 'done': return doneScreen(ctx);
    case 'idle': return screensaver(ctx, t, color);
    case 'sleeping':
    case 'empty':
      return fill(ctx, '#030407');
  }
}
