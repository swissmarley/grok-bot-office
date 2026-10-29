import { useEffect } from 'react';
import type { Bot } from '@grok-office/shared';
import { useOffice } from './store';

// When a bot starts needing you: a short chime (unless muted) and, if the tab isn't in
// front, a system notification. Never on the first snapshot, only on transitions.

const SOUND_GAP_MS = 1500;

let ctx: AudioContext | undefined;
let lastSound = 0;

/** Browsers only allow audio after a user gesture; create the context on the first one. */
function unlockAudio(): void {
  const unlock = () => {
    ctx ??= new AudioContext();
    void ctx.resume();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

// As early as possible, so even the very first click or key press counts.
if (typeof window !== 'undefined' && 'AudioContext' in window) unlockAudio();

export function chime(): void {
  if (!ctx || ctx.state !== 'running') return;
  const now = performance.now();
  if (now - lastSound < SOUND_GAP_MS) return;
  lastSound = now;
  const t = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = t + i * 0.14;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + 0.34);
  });
}

function notify(bot: Bot): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  const body = bot.approval ? `${bot.approval.action} · ${bot.approval.target}` : bot.activity || 'Waiting for you in Grok Bot';
  // Notification text is rendered by the OS as plain text.
  const n = new Notification(`${bot.name} needs you`, { body, tag: `gbo-${bot.id}` });
  n.onclick = () => {
    window.focus();
    useOffice.getState().select(bot.id);
    n.close();
  };
}

/** Bots that turned needs_you since `prev`; bots that just appeared don't count. */
export function newlyNeedingYou(prev: Record<string, Bot['status']>, bots: Bot[]): Bot[] {
  return bots.filter((b) => b.status === 'needs_you' && prev[b.id] !== undefined && prev[b.id] !== 'needs_you');
}

export function useNeedsYouAlerts(): void {
  useEffect(() => {
    let known: Record<string, Bot['status']> | null = null;
    return useOffice.subscribe((s) => {
      if (s.link !== 'open') return;
      const bots = Object.values(s.bots);
      const prev = known;
      known = Object.fromEntries(bots.map((b) => [b.id, b.status]));
      if (!prev) return; // first state after connecting: nothing is "new"
      const fresh = newlyNeedingYou(prev, bots);
      if (!fresh.length) return;
      if (!s.muted) chime();
      fresh.forEach(notify);
    });
  }, []);
}
