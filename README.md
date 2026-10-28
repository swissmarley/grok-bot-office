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
- State on disk: `~/.grok-office/desks.json` (mock mode: `desks.mock.json`).

```sh
pnpm test        # server unit tests
pnpm typecheck
```
