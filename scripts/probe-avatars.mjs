#!/usr/bin/env node
// Read-only probe: where does the Grok Bot desktop app keep each Bot's avatar?
//
// Run on the Mac where Grok Bot is signed in, after `grokbot launch`:
//   node scripts/probe-avatars.mjs > avatars.json
//
// It only reads: no clicks, no store method calls besides the snapshot getter, no writes.
// Output: field names of the Bot-list rows, avatar-looking values (truncated), and the
// image / svg / emoji markup inside each sidebar item. Remove anything private before sharing.

const port = Number(process.env.GROKBOT_CDP_PORT || 9333);

const PAGE = String.raw`(() => {
  const AVATARISH = /avatar|icon|emoji|image|img|photo|picture|color|colour|hue|glyph|persona|appearance|portrait|face/i;
  const clip = (v) => {
    if (v == null) return v;
    if (typeof v === 'string') return v.length > 300 ? v.slice(0, 300) + '…(' + v.length + ' chars)' : v;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    try { const s = JSON.stringify(v); return s.length > 600 ? s.slice(0, 600) + '…' : JSON.parse(s); } catch { return '[' + typeof v + ']'; }
  };
  const avatarish = (obj, depth = 0, path = '') => {
    const out = {};
    if (!obj || typeof obj !== 'object' || depth > 2) return out;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (AVATARISH.test(k)) out[path + k] = clip(v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, avatarish(v, depth + 1, path + k + '.'));
    }
    return out;
  };

  // Same lookup the bridge uses (src/page.ts): walk React fibers up to the context holding the roster store.
  let roster = null;
  for (const start of [document.querySelector('.sand-agent-item[data-agent-id]'), document.querySelector('button')]) {
    const key = start && Object.keys(start).find((k) => k.startsWith('__reactFiber'));
    for (let f = key ? start[key] : null; f && !roster; f = f.return) {
      const v = f.memoizedProps && f.memoizedProps.value;
      if (v && typeof v === 'object' && v.roster && typeof v.roster.createAgent === 'function') roster = v.roster;
    }
  }

  const rows = roster ? roster.snapshots.get().agents.rows.filter((r) => !r.isGroup) : [];
  const bots = rows.map((r) => ({
    id: r.id,
    name: r.name,
    fields: Object.keys(r).sort(),
    avatarFields: avatarish(r),
  }));

  // What the sidebar actually renders next to each Bot name.
  const sidebar = [...document.querySelectorAll('.sand-agent-item[data-agent-id]')].map((el) => {
    const visuals = [...el.querySelectorAll('img, svg, canvas, video, [style*="background"]')].slice(0, 6).map((n) => ({
      tag: n.tagName.toLowerCase(),
      class: String(n.getAttribute('class') || '').slice(0, 160),
      src: n.getAttribute('src') ? clip(n.getAttribute('src')) : undefined,
      style: n.getAttribute('style') ? clip(n.getAttribute('style')) : undefined,
      size: [Math.round(n.getBoundingClientRect().width), Math.round(n.getBoundingClientRect().height)],
      markup: n.tagName.toLowerCase() === 'svg' ? clip(n.outerHTML) : undefined,
    }));
    const firstText = (el.textContent || '').trim().slice(0, 4);
    return { agentId: el.getAttribute('data-agent-id'), visuals, leadingText: firstText };
  });

  return {
    appVersion: (window.desktop && window.desktop.appVersion) || navigator.userAgent.match(/Grok ?Bot\/([\d.]+)/i)?.[1] || null,
    rosterFound: !!roster,
    bots,
    sidebar,
  };
})()`;

const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null);
if (!targets) {
  console.error(`Grok Bot isn't reachable on 127.0.0.1:${port}. Run \`grokbot launch\` first.`);
  process.exit(1);
}
const page = targets.find((t) => t.type === 'page' && /app\.asar|\/renderer\/index\.html/.test(t.url));
if (!page) {
  console.error('Debug port is open, but no Grok Bot window was found.');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', () => reject(new Error('Could not open the CDP websocket')), { once: true });
});
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: PAGE, returnByValue: true } }));
const msg = await new Promise((resolve) => ws.addEventListener('message', (ev) => resolve(JSON.parse(String(ev.data))), { once: true }));
ws.close();

if (msg.error || msg.result?.exceptionDetails) {
  console.error('Probe failed:', msg.error?.message ?? msg.result.exceptionDetails.exception?.description ?? msg.result.exceptionDetails.text);
  process.exit(1);
}
console.log(JSON.stringify(msg.result.result.value, null, 2));
