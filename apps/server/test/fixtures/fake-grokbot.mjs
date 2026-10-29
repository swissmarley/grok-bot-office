#!/usr/bin/env node
// Stand-in for the grokbot CLI, driven by files in $FAKE_GROKBOT_DIR:
//   connected      exists while "Grok Bot" is reachable
//   bots.json      output of `bots --json`
//   read-<id>.json output of `read <id> --json`
//   events.jsonl   lines that `watch --json` streams as they are appended
//   calls.log      every invocation, with the GROKBOT_APP it got
//   watch-ready    written once `watch` is streaming
//   fork           exists to act as the office fork of the bridge (has `open`, `office-watch`)
//   tools.jsonl    lines that `office-watch` streams as they are appended
//   tools-ready    written once `office-watch` is streaming
//   tools-crash    exists to make `office-watch` exit
//   no-window      exists while Grok Bot runs with its window closed
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.FAKE_GROKBOT_DIR;
const [cmd, ...args] = process.argv.slice(2);
appendFileSync(join(dir, 'calls.log'), JSON.stringify({ cmd, args, app: process.env.GROKBOT_APP }) + '\n');
const connected = () => existsSync(join(dir, 'connected'));
const fail = (msg) => {
  console.error(`grokbot: ${msg}`);
  process.exit(1);
};

if (existsSync(join(dir, 'no-window'))) fail('Debug port 9333 is open, but no Grok Bot window was found on it.');
if (cmd === 'status') {
  console.log(JSON.stringify(connected() ? { connected: true, port: 9333, bots: [], busy: false, usage: null } : { connected: false, port: 9333 }));
  process.exit(0);
}
// Like the real CLI: anything else would try to launch the app, which our guard makes fail.
if (!connected()) fail(`Grok Bot app not found. Looked in:\n  ${process.env.GROKBOT_APP}\nSet GROKBOT_APP to its path.`);

switch (cmd) {
  case 'bots':
    console.log(readFileSync(join(dir, 'bots.json'), 'utf8'));
    break;
  case 'read': {
    const file = join(dir, `read-${args[0]}.json`);
    console.log(existsSync(file) ? readFileSync(file, 'utf8') : JSON.stringify({ bot: args[0], messages: [] }));
    break;
  }
  case 'open':
    if (!existsSync(join(dir, 'fork'))) fail(`Unknown command "open".`);
    console.log(JSON.stringify({ bot: args[0], selected: true, focused: true }));
    break;
  case 'stop':
    console.log(JSON.stringify({ bot: args[0], stopped: true }));
    break;
  case 'watch':
    stream('events.jsonl', 'watch-ready');
    break;
  case 'office-watch':
    if (!existsSync(join(dir, 'fork'))) fail(`Unknown command "office-watch".`);
    stream('tools.jsonl', 'tools-ready', 'tools-crash');
    break;
  default:
    fail(`Unknown command "${cmd}".`);
}

/** Streams what gets appended to `name` after start; exits when disconnected or `crashFlag` appears. */
function stream(name, readyFlag, crashFlag) {
  const file = join(dir, name);
  let offset = existsSync(file) ? statSync(file).size : 0;
  // Tests wait for this before appending, since a watch only streams what comes after it starts.
  writeFileSync(join(dir, readyFlag), String(process.pid));
  setInterval(() => {
    if (!connected() || (crashFlag && existsSync(join(dir, crashFlag)))) {
      console.error('grokbot: CDP connection closed');
      process.exit(1);
    }
    if (!existsSync(file)) return;
    const buf = readFileSync(file);
    if (buf.length > offset) {
      process.stdout.write(buf.subarray(offset));
      offset = buf.length;
    }
  }, 25);
}
