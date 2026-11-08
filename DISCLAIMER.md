# Disclaimer

Grok Bot Office is an **unofficial, community-maintained** project. It is **not affiliated with,
endorsed by, sponsored by, or authorized by xAI** or any other rights holder.

**Grok**, **Grok Bot**, and related names, logos, and marks are trademarks of their respective
owners. This project uses those names only to describe compatibility with software you already run
on your machine (nominative use). No ownership of, license to, or affiliation with those marks is
claimed or implied.

## What this repository is

- Open-source code and documentation for a **local dashboard** that runs on your Mac and talks to
  the Grok Bot desktop app you installed, via a debug bridge and your own credentials.
- A fork of [grokbot-bridge](https://github.com/TheSethRose/grokbot-bridge) (MIT), shipped as
  patches in `bridge-fork/patches/`.

## What this repository is not

- Not an official xAI or Grok Bot product, support channel, or substitute for the desktop app.
- Not legal, security, or compliance advice.
- Not a distribution of Grok Bot, its assets, or proprietary app code. Nothing here bypasses
  sign-in or grants access to xAI services you are not already entitled to use.

## Your responsibilities

- You must comply with **xAI's terms**, the **Grok Bot app's license and acceptable use**, and any
  other agreements that govern your account and the desktop app. If those terms restrict
  automation, debugging, or third-party tools, you are responsible for deciding whether this
  project is appropriate for you.
- The office and `grokbot launch` use a **local debug port** on your Mac. Treat it like leaving a
  privileged remote control on your desk: only use it on a machine you trust, do not expose it
  through tunnels or public networks, and run `grokbot restore` when you are done (see README
  **Safety**).
- Approvals and actions you take in the office are **your** decisions under **your** account.

## License scope

The [MIT License](LICENSE) applies only to **original source code and documentation in this
repository**. It does **not** grant any rights in third-party software, trademarks, or Grok Bot
internals. Third-party projects (for example grokbot-bridge upstream) remain under their own
licenses.

## Good faith

This project is maintained in good faith for personal productivity on your own hardware. If you are
a rights holder and believe something in this repository should change, please [open an
issue](https://github.com/swissmarley/grok-bot-office/issues). Maintainers will respond promptly
and are willing to correct attribution, remove content, or adjust the project as needed.

*This file is practical guidance for users and contributors. It is not legal advice. For questions
about your obligations, consult a qualified professional in your jurisdiction.*
