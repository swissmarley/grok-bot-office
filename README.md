# grok-bot-office

Local web app that shows your Grok Bot bots as characters in an isometric 3D office,
with live status and approvals. Full spec: [SPEC.md](SPEC.md).

Unofficial project, not affiliated with xAI.

## Development

Requirements: Node.js 22+, pnpm 10.

```sh
pnpm install
pnpm dev --mock   # 5 scripted bots, no Grok Bot needed
```

The office server prints an `Open:` link with a one-time token; open it (the token is
swapped for an httpOnly cookie and removed from the address bar).

- Office server: `127.0.0.1:4317` only (WebSocket `/ws`, REST `/api`).
- Web UI (Vite): `127.0.0.1:5173`, proxied to the server.
- State on disk in `~/.grok-office/`: `desks.json` (stable desks) and `roles.json`
  (roles you edited); mock mode uses `desks.mock.json` and `roles.mock.json`.
- Names like "Bob - Chief of Staff" show as Bob, with role Chief of Staff.

Mock options (environment variables):

- `GBO_MOCK_BOTS=12` runs more bots (copies of the five scripts).
- `GBO_MOCK_SHOWCASE=1` pins one bot in each state, to check the scene.

The scene draws each bot as its Grok Bot avatar (shape + color), rebuilt from
primitives in `apps/web/src/avatar/shapes.ts`: the 14 shapes and 11 colors of
Grok Bot's "Create New Bot" picker.

```sh
pnpm test        # server and web unit tests
pnpm typecheck
```

## Everyday use: one command

```sh
pnpm start            # your bots through grokbot-bridge (run `grokbot launch` first)
pnpm start --mock     # the scripted demo bots
```

It builds the UI when it changed, starts the office on `127.0.0.1:4317` serving it,
and opens your browser with a one-time token (`--no-open` to just print the link).
Run `pnpm link --global` once in this folder to get the same as a `grok-office`
command anywhere. (Not `npx grok-office`: this project isn't on npm, and that name
would fetch whatever someone else publishes under it.)

In the header: the speaker toggles a short chime when a bot starts needing you (it
plays after your first click or key press on the page, as browsers require), and the
bell asks permission for system notifications when the tab is in the background.
Add `&stats` to the URL for an FPS meter.

The server sends `X-Frame-Options: DENY` and a strict Content-Security-Policy
(scripts only from itself, no framing), since the page can act on your bots.

## With your real bots (grokbot-bridge)

Requirements: the Grok Bot desktop app signed in with at least one Bot, and
[grokbot-bridge](https://github.com/TheSethRose/grokbot-bridge) installed so that
`grokbot` is on your PATH (macOS; `GROKBOT_BIN` points elsewhere).

```sh
npm install -g https://github.com/TheSethRose/grokbot-bridge/archive/refs/heads/main.tar.gz
grokbot launch     # restarts Grok Bot with the debug port on 127.0.0.1:9333
pnpm start         # or `pnpm dev` while developing; no --mock: your bots via the bridge
grokbot restore    # when you're done: restarts Grok Bot normally, closing the port
```

The office runs `grokbot status`, `bots --json`, `watch --json`, `read <bot> --json
--limit 20` and `stop <bot>`. It **never starts, quits or restarts Grok Bot**: the
bridge relaunches the app when it can't reach the port, so the office runs it with
`GROKBOT_APP` pointing nowhere and that relaunch fails instead. If you close Grok
Bot, the badge turns Disconnected and the office keeps retrying; it reconnects by
itself once you run `grokbot launch` again.

**Risk of the debug port:** while Grok Bot runs with it, any program on your Mac
that connects to `127.0.0.1:9333` can act in the app as you. It isn't exposed to the
network, but close it with `grokbot restore` when you're not using the office.

## Probing the Grok Bot app

`scripts/probe-grokbot.mjs` is a read-only look inside the desktop app, to learn what
the grokbot-bridge fork needs (avatars, main bot, account handle, tool steps, pending
approvals, store and method names, the Bot computer's sleep phase):

```sh
grokbot launch
node scripts/probe-grokbot.mjs > grokbot-probe.json
node scripts/probe-grokbot.mjs --watch 90 > grokbot-watch.json   # make a Bot work meanwhile
grokbot restore
```

It never clicks or calls app actions; besides reading snapshots it only loads each
Bot's recent conversation into the transcript store, as `grokbot read` does.
Conversation text is never printed, only entry kinds, field names and short
identifier-like values. Run it once more while a Bot has an approval card open to
capture what a pending approval looks like. Check the file before sharing it.
