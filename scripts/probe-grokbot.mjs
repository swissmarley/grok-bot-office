#!/usr/bin/env node
// Read-only probe of the Grok Bot desktop app's internal stores, to learn what the office
// needs from the grokbot-bridge fork before writing it:
//   1. avatars (shape + color) and the main bot, from the Bot-list rows
//   2. the account handle
//   3. tool steps in transcripts (coding / browsing / terminal)
//   4. what a pending approval looks like (run it once while a card is open)
//   5. the names of the app's stores and their methods (names only, never called)
//   6. the Bot computer's sleep phase and the app version
//
// Run on the Mac where Grok Bot is signed in, after `grokbot launch`:
//   node scripts/probe-grokbot.mjs > grokbot-probe.json
//   node scripts/probe-grokbot.mjs --watch 90 > grokbot-watch.json
// then `grokbot restore` to close the debug port. With --watch it also samples what
// changes for 90 s: start it, then make a Bot work (browse, run a command, edit a file)
// and, if you can, ask for something that needs your approval.
//
// It only reads: no clicks, no store actions (only snapshot getters are called; other
// methods are listed by name and signature, never invoked). The one thing it does besides reading
// snapshots is load each Bot's recent conversation into the transcript store, the same
// way `grokbot read` does (and the app does when you open a conversation). Conversation
// text is never printed: for each entry only its kind, field names and short
// identifier-like values (tool name, type, status). Check the file before sharing it.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.GROKBOT_CDP_PORT || 9333);

export const PAGE = String.raw`(async () => {
  const MAX_ENTRIES = 80;
  const AVATARISH = /avatar|icon|emoji|image|img|photo|picture|color|colour|hue|glyph|shape|persona|appearance|portrait|face/i;
  const MAINISH = /main|primary|default|chief|pinned|star|owner/i;
  const HANDLEISH = /handle|username|userName|screenName|screen_name|login|xUser|twitter/i;
  // Values of these fields are short identifiers, safe to print; anything else is summarized.
  const SAFE_VALUE = /^(id|kind|type|role|status|state|phase|name|tool|toolName|tool_name|toolKind|toolType|category|action|actionType|origin|source|scope|decision|result|outcome|mode|level|expiresAt|expires_at|createdAt|created_at|timestampMs|isStreaming|ok|error|code|[a-zA-Z]*Id)$/;

  const describe = (v, depth = 0) => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'boolean' || typeof v === 'number') return v;
    if (typeof v === 'string') return '<string ' + v.length + '>';
    if (typeof v === 'function') return '<function>';
    if (Array.isArray(v)) return depth > 2 ? '<array ' + v.length + '>' : (v.length ? [describe(v[0], depth + 1), '…' + v.length] : []);
    if (typeof v === 'object') {
      if (depth > 2) return '<object>';
      const out = {};
      for (const k of Object.keys(v).slice(0, 40)) {
        const x = v[k];
        out[k] = typeof x === 'string' && SAFE_VALUE.test(k) ? x.slice(0, 80) : describe(x, depth + 1);
      }
      return out;
    }
    return '<' + typeof v + '>';
  };
  const clip = (v, n = 300) => (typeof v === 'string' && v.length > n ? v.slice(0, n) + '…(' + v.length + ')' : v);
  const pick = (obj, re, depth = 0, path = '') => {
    const out = {};
    if (!obj || typeof obj !== 'object' || depth > 2) return out;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (re.test(k) && typeof v !== 'function') out[path + k] = typeof v === 'object' && v !== null ? describe(v) : clip(v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, pick(v, re, depth + 1, path + k + '.'));
    }
    return out;
  };

  // Every React context value reachable from a few rendered elements (same lookup as the bridge's page.ts).
  const contexts = [];
  const starts = [document.querySelector('.sand-agent-item[data-agent-id]'), document.querySelector('button'), document.querySelector('#root > *')];
  for (const start of starts) {
    const key = start && Object.keys(start).find((k) => k.startsWith('__reactFiber'));
    for (let f = key ? start[key] : null; f; f = f.return) {
      const v = f.memoizedProps && f.memoizedProps.value;
      if (v && typeof v === 'object' && !contexts.includes(v)) contexts.push(v);
    }
  }
  const findStore = (name, method) => {
    for (const c of contexts) if (c[name] && typeof c[name][method] === 'function') return c[name];
    return null;
  };
  const roster = findStore('roster', 'createAgent');
  const transcript = findStore('transcript', 'snapshotsFor');

  // 5. Store names and method names.
  const stores = [];
  for (const c of contexts) {
    for (const [name, v] of Object.entries(c)) {
      if (!v || typeof v !== 'object') continue;
      const proto = Object.getPrototypeOf(v);
      const names = new Set([...Object.keys(v), ...(proto && proto !== Object.prototype ? Object.getOwnPropertyNames(proto) : [])]);
      const methods = [...names].filter((m) => m !== 'constructor' && typeof v[m] === 'function');
      if (methods.length && !stores.some((s) => s.name === name)) stores.push({ name, methods: methods.slice(0, 60) });
    }
  }
  const approvalish = /approv|permission|consent|allow|deny|reject|respond|resolve|decision|confirm|takeover|take_over|review/i;

  // 1 + 4. Bot rows.
  const rows = roster ? roster.snapshots.get().agents.rows.filter((r) => !r.isGroup) : [];
  const bots = rows.map((r) => ({
    id: r.id,
    name: r.name,
    hidden: !!r.isHiddenFromSidebar,
    fields: Object.keys(r).sort(),
    avatar: pick(r, AVATARISH),
    mainCandidates: pick(r, MAINISH),
    waiting: r.awaitingUserResponse == null ? null : describe(r.awaitingUserResponse),
    lastEntry: r.lastEntry == null ? null : describe(r.lastEntry),
    harness: describe(r.harness),
    running: { isRunning: !!r.isRunning, isRunningTurn: !!r.isRunningTurn, sessions: (r.runningSessionIds || []).length },
  }));

  // What the sidebar draws next to each name (avatar svg / img).
  const sidebar = [...document.querySelectorAll('.sand-agent-item[data-agent-id]')].slice(0, 30).map((el) => ({
    agentId: el.getAttribute('data-agent-id'),
    visuals: [...el.querySelectorAll('img, svg, canvas, [style*="background"]')].slice(0, 4).map((n) => ({
      tag: n.tagName.toLowerCase(),
      class: String(n.getAttribute('class') || '').slice(0, 160),
      src: n.getAttribute('src') ? clip(n.getAttribute('src'), 200) : undefined,
      style: n.getAttribute('style') ? clip(n.getAttribute('style'), 200) : undefined,
      size: [Math.round(n.getBoundingClientRect().width), Math.round(n.getBoundingClientRect().height)],
      markup: n.tagName.toLowerCase() === 'svg' ? clip(n.outerHTML, 1500) : undefined,
      data: Object.fromEntries([...n.attributes].filter((a) => a.name.startsWith('data-')).map((a) => [a.name, clip(a.value, 80)])),
    })),
  }));

  // 3. Transcripts: kinds of entries, and the shape of tool-call and card entries.
  const kinds = {};
  const toolShapes = [];
  const otherShapes = [];
  const seenShape = new Set();
  const transcriptErrors = [];
  if (transcript) {
    for (const r of rows.filter((x) => !x.isHiddenFromSidebar).slice(0, 12)) {
      let release = () => {};
      try {
        release = transcript.observeEntries(r.id, () => {});
        if (transcript.snapshotsFor(r.id).get().loadState !== 'ready') transcript.load(r.id);
        for (let t0 = Date.now(); transcript.snapshotsFor(r.id).get().loadState !== 'ready'; await new Promise((s) => setTimeout(s, 150))) {
          if (Date.now() - t0 > 15000) throw new Error('timed out loading');
        }
        const entries = transcript.snapshotsFor(r.id).get().entries.slice(-MAX_ENTRIES);
        for (const e of entries) {
          const k = e.kind + (e.message && e.message.type ? '/' + e.message.type : '');
          kinds[k] = (kinds[k] || 0) + 1;
          if (e.kind === 'message' || (e.kind === 'send-message' && e.message && e.message.type === 'text')) continue;
          const sig = k + ':' + Object.keys(e).sort().join(',');
          if (seenShape.has(sig) && toolShapes.length + otherShapes.length > 40) continue;
          seenShape.add(sig);
          (e.kind === 'tool-call' ? toolShapes : otherShapes).push({ bot: r.name, kind: k, entry: describe(e) });
        }
      } catch (err) {
        transcriptErrors.push({ bot: r.name, error: String((err && err.message) || err) });
      } finally {
        release();
      }
    }
  }

  // 2. Account handle candidates.
  const account = {};
  for (const c of contexts) Object.assign(account, pick(c, HANDLEISH));

  // 6. Computer phase and version.
  let boxPhase = null;
  for (const c of contexts) {
    if (c.boxHostPhase && c.boxHostPhase.snapshots && typeof c.boxHostPhase.snapshots.get === 'function') {
      const phase = c.boxHostPhase.snapshots.get();
      boxPhase = typeof phase === 'string' && phase.length <= 24 ? phase : describe(phase);
      break;
    }
  }

  // The avatar drawing the sidebar <use>s: exact outline of each Bot's shape.
  const marks = {};
  for (const r of rows) {
    const el = document.getElementById('sand-agent-mark-source-' + r.id);
    if (el) marks[r.avatarShape || r.id] = clip(el.outerHTML.replace(/\s+/g, ' '), 6000);
  }

  // Stores that likely hold the main bot, the account, what a Bot is doing now, and navigation.
  const DETAIL = ['mainAgent', 'workingAgents', 'session', 'savedAccounts', 'botActions', 'navigation', 'selection',
    'cloudAgentOpenTarget', 'agentTasks', 'asyncTasks', 'subagents', 'renderStream', 'agentTurnStarts', 'workflows'];
  const snapshotOf = (v) => {
    try {
      if (v.snapshots && typeof v.snapshots.get === 'function') return v.snapshots.get();
      if (typeof v.getSnapshot === 'function') return v.getSnapshot();
    } catch (e) { return '<threw ' + String((e && e.message) || e).slice(0, 80) + '>'; }
    return undefined;
  };
  const signature = (fn) => ({ length: fn.length, head: String(fn).replace(/\s+/g, ' ').slice(0, 400) });
  const details = {};
  for (const name of DETAIL) {
    for (const c of contexts) {
      const v = c[name];
      if (!v || typeof v !== 'object' || details[name]) continue;
      const proto = Object.getPrototypeOf(v);
      const names = new Set([...Object.keys(v), ...(proto && proto !== Object.prototype ? Object.getOwnPropertyNames(proto) : [])]);
      const methods = {};
      for (const m of names) if (m !== 'constructor' && typeof v[m] === 'function') methods[m] = signature(v[m]);
      const snap = snapshotOf(v);
      details[name] = { methods, snapshot: describe(snap), handles: snap && typeof snap === 'object' ? pick(snap, HANDLEISH) : {} };
    }
  }
  // How the app answers cards, interrupts a Bot and brings a conversation forward.
  const signatures = {};
  const want = {
    transcript: ['respondToWidget', 'dismissWidget', 'resolveAutoReviewApproval', 'resolveLocalToolPermission', 'resolveConnectorGrant',
      'resolveVirtualCardApproval', 'beginSpendApproval', 'submitUserForm', 'entriesFor', 'findEntrySessionId'],
    roster: ['interruptAgentRun', 'findAgent', 'markAgentRead'],
    desktop: ['focusWindow', 'setViewingAgent', 'openChatPopout', 'isWindowShown'],
  };
  for (const [store, methods] of Object.entries(want)) {
    const v = findStore(store, methods[0]);
    if (!v) continue;
    for (const m of methods) if (typeof v[m] === 'function') signatures[store + '.' + m] = signature(v[m]);
  }

  return {
    probe: 'grok-office probe 3',
    marks,
    details,
    signatures,
    app: { userAgent: navigator.userAgent, desktopKeys: window.desktop ? Object.keys(window.desktop) : null, appVersion: (window.desktop && window.desktop.appVersion) || null },
    found: { roster: !!roster, transcript: !!transcript, contexts: contexts.length },
    account,
    bots,
    sidebar,
    transcripts: { kinds, toolShapes: toolShapes.slice(0, 25), otherShapes: otherShapes.slice(0, 25), errors: transcriptErrors },
    approvalStores: stores.filter((s) => approvalish.test(s.name) || s.methods.some((m) => approvalish.test(m))),
    stores,
    boxPhase,
  };
})()`;

// Sampled every 1.5 s with --watch: what a working or waiting Bot looks like right now.
export const SAMPLE = String.raw`(() => {
  const SAFE_VALUE = /^(id|kind|type|role|status|state|phase|name|tool|toolName|tool_name|toolKind|toolType|category|action|actionType|origin|source|scope|decision|result|outcome|mode|level|expiresAt|expires_at|createdAt|created_at|timestampMs|isStreaming|ok|error|code|[a-zA-Z]*Id)$/;
  const describe = (v, depth = 0) => {
    if (v === null || v === undefined) return v;
    if (typeof v === 'boolean' || typeof v === 'number') return v;
    if (typeof v === 'string') return '<string ' + v.length + '>';
    if (typeof v === 'function') return '<function>';
    if (Array.isArray(v)) return depth > 3 ? '<array ' + v.length + '>' : (v.length ? [describe(v[0], depth + 1), '…' + v.length] : []);
    if (typeof v === 'object') {
      if (depth > 3) return '<object>';
      const out = {};
      for (const k of Object.keys(v).slice(0, 40)) {
        const x = v[k];
        out[k] = typeof x === 'string' && SAFE_VALUE.test(k) ? x.slice(0, 80) : describe(x, depth + 1);
      }
      return out;
    }
    return '<' + typeof v + '>';
  };
  const contexts = [];
  for (const start of [document.querySelector('.sand-agent-item[data-agent-id]'), document.querySelector('button'), document.querySelector('#root > *')]) {
    const key = start && Object.keys(start).find((k) => k.startsWith('__reactFiber'));
    for (let f = key ? start[key] : null; f; f = f.return) {
      const v = f.memoizedProps && f.memoizedProps.value;
      if (v && typeof v === 'object' && !contexts.includes(v)) contexts.push(v);
    }
  }
  const find = (name) => { for (const c of contexts) if (c[name] && typeof c[name] === 'object') return c[name]; return null; };
  const snap = (v) => { try { return v && v.snapshots && typeof v.snapshots.get === 'function' ? v.snapshots.get() : v && typeof v.getSnapshot === 'function' ? v.getSnapshot() : undefined; } catch { return undefined; } };
  const roster = find('roster');
  const transcript = find('transcript');
  const rows = roster ? roster.snapshots.get().agents.rows.filter((r) => !r.isGroup) : [];
  const busy = rows.filter((r) => r.isRunning || r.isRunningTurn || r.isComposingMessage || r.awaitingUserResponse != null);
  const samples = [];
  for (const r of busy) {
    samples.push({ what: 'row', bot: r.name, value: describe({ isRunning: r.isRunning, isRunningTurn: r.isRunningTurn, isComposingMessage: r.isComposingMessage,
      runningSessionIds: r.runningSessionIds, awaitingUserResponse: r.awaitingUserResponse, lastEntry: r.lastEntry, harness: r.harness }) });
    if (transcript) {
      try {
        const entries = transcript.snapshotsFor(r.id).get().entries.slice(-12);
        for (const e of entries) if (!(e.kind === 'message' && e.role === 'user')) samples.push({ what: 'entry', bot: r.name, value: describe(e) });
      } catch {}
    }
  }
  for (const name of ['workingAgents', 'renderStream', 'agentTasks', 'asyncTasks', 'subagents', 'agentTurnStarts', 'boxHostPhase']) {
    const s = snap(find(name));
    if (s !== undefined) samples.push({ what: 'store', name, value: typeof s === 'string' && s.length <= 24 ? s : describe(s) });
  }
  return samples;
})()`;

async function main() {
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
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(String(ev.data));
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  });
  const evaluate = (expression) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (m) => {
        if (m.error || m.result?.exceptionDetails) {
          reject(new Error(m.error?.message ?? m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails.text));
        } else resolve(m.result.result.value);
      });
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    });

  try {
    const result = await evaluate(PAGE);
    const watchArg = process.argv.indexOf('--watch');
    const seconds = watchArg === -1 ? 0 : Math.min(600, Number(process.argv[watchArg + 1]) || 60);
    if (seconds) {
      // Distinct shapes only: the same structure seen twice is kept once.
      const seen = new Map();
      console.error(`Watching for ${seconds} s. Make a Bot work now (and, if you can, ask for something that needs approval).`);
      const end = Date.now() + seconds * 1000;
      while (Date.now() < end) {
        for (const sample of await evaluate(SAMPLE)) {
          const key = JSON.stringify(sample);
          if (!seen.has(key) && seen.size < 400) seen.set(key, { at: new Date().toISOString(), ...sample });
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      result.watch = { seconds, samples: [...seen.values()] };
      console.error(`Done: ${seen.size} distinct samples.`);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Probe failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    ws.close();
  }
}

// Run when executed directly (also from paths with spaces), not when imported.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
