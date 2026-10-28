#!/usr/bin/env node
// Stand-in for the grokbot CLI, driven by files in $FAKE_GROKBOT_DIR:
//   connected      exists while "Grok Bot" is reachable
//   bots.json      output of `bots --json`
//   read-<id>.json output of `read <id> --json`
//   events.jsonl   lines that `watch --json` streams as they are appended
//   calls.log      every invocation, with the GROKBOT_APP it got
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.FAKE_GROKBOT_DIR;
const [cmd, ...args] = process.argv.slice(2);
appendFileSync(join(dir, 'calls.log'), JSON.stringify({ cmd, args, app: process.env.GROKBOT_APP }) + '\n');
const connected = () => existsSync(join(dir, 'connected'));
const fail = (msg) => {
  console.error(`grokbot: ${msg}`);
  process.exit(1);
};

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
  case 'stop':
    console.log(JSON.stringify({ bot: args[0], stopped: true }));
    break;
  case 'watch': {
    const file = join(dir, 'events.jsonl');
    let offset = existsSync(file) ? statSync(file).size : 0;
    setInterval(() => {
      if (!connected()) {
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
    break;
  }
  default:
    fail(`Unknown command "${cmd}".`);
}
