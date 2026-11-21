<div align="center">

# Kali

**A sleek League of Legends companion for Windows.**

See your profile, reveal your champ-select teammates, scout both teams in-game, automate the boring
parts of queue, and show your status on Discord — all in one clean app.

[![Download](https://img.shields.io/github/v/release/shivy1337/kali?label=Download&style=for-the-badge)](https://github.com/shivy1337/kali/releases/latest)

</div>

---

## Download

**[⬇ Download the latest `Kali-Setup.exe`](https://github.com/shivy1337/kali/releases/latest)** — run
the installer and you're done. No League client restart, no setup.

> Windows may show a SmartScreen warning because the app isn't code-signed — click **More info →
> Run anyway**. The source is all here if you'd rather build it yourself.

## Features

- **👤 Profile** — icon, Riot ID, level, Solo/Duo & Flex rank with real rank emblems.
- **🔍 Champ select** — every teammate's rank, winrate and most-played champions at a glance, plus
  which side you're on and **who has last pick**. Reveals hidden teammates in ranked.
- **⚔️ Live game** — both full teams with ranks, KDA, CS and items, sorted by role, updating live.
- **🕑 History** — your recent champ selects, marked played or dodged, with one-click team lookup.
- **⚙️ Automation** — auto-accept queue, re-queue after games, dodge-pause, and auto-ban / auto-lock
  with per-role pick lists. All opt-in.
- **🎮 Discord Rich Presence** — show your champion, rank and game timer on your Discord profile.
- **🪟 Quality of life** — system tray, launch on startup, and pop-to-front when champ select begins.

## Not affiliated with Riot Games

Kali is **client-only**: it talks to the League Client API on your own PC and reads images from your
League install. It does **not** inject into the game, modify game files, or touch Vanguard. League
of Legends and Riot Games are trademarks of Riot Games, Inc.

## Build from source

<details>
<summary>For developers</summary>

Requires Node.js 20+ and Windows with League installed.

```bash
npm install
npm run dev     # run against your live client
npm run dist    # build the installer into dist/
```

Electron + Vite + React + TypeScript + Tailwind. All LCU calls live in the main process; the
renderer uses a typed, context-isolated `window.kali` preload API.

</details>

## License

[MIT](LICENSE)
