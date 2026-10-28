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

## Probing the Grok Bot app

`scripts/probe-avatars.mjs` is a read-only look at where the desktop app keeps each
Bot's avatar (run after `grokbot launch`, then `grokbot restore` to close the debug
port). It never clicks or calls app actions.
