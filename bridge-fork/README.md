# grokbot-bridge fork for Grok Bot Office

`patches/` holds the office's changes to [grokbot-bridge](https://github.com/TheSethRose/grokbot-bridge)
(MIT), as `git format-patch` output on top of upstream `b905584` (apply them in order). They add
`src/adapter/grokbot-internals.ts`, the one place for the Grok Bot internals the office uses:

- `grokbot bots --json` also carries each Bot's `avatar`, `main` and `computerPhase`
- `grokbot open <bot>` shows that Bot's conversation and brings Grok Bot to the front
- `grokbot office-watch` streams the tool each Bot is using, or its own status line, open questions and cards
- `grokbot cards <bot>` and `grokbot resolve <bot> <entry> allow_once|deny|discard` for approvals
- `grokbot internals` reports which pieces the running app still exposes

To make the fork (on the Mac, with `gh` signed in):

```sh
gh repo fork TheSethRose/grokbot-bridge --clone=true --remote=true
cd grokbot-bridge && git checkout -b office-adapter
git am ../grok-bot-office/bridge-fork/patches/*.patch
bun install && bun test && bun run check && bun run build && git diff --exit-code dist/cli.js
git push -u origin office-adapter
npm install -g https://github.com/swissmarley/grokbot-bridge/archive/refs/heads/office-adapter.tar.gz
```

Next steps for the fork (tool steps, approvals V2) are in `docs/HANDOFF.md`.
