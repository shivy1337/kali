# Kali

A League of Legends desktop companion for Windows — a frameless Electron app that connects to
your running League client and gives you live profile, champ select, and in-game information, plus
quality-of-life automation and Discord Rich Presence.

> **Not affiliated with or endorsed by Riot Games.** Kali is a *client-only* companion: it talks to
> the League Client API (LCU) on your own machine and reads assets from your League install. It does
> **not** inject into the game, modify game files, or touch Riot Vanguard. League of Legends and
> Riot Games are trademarks of Riot Games, Inc.

## Features

- **Profile** — icon, Riot ID, level, Solo/Duo & Flex rank with the client's real rank emblems.
- **Champ select** — compact teammate list with rank, winrate and most-played champions; click a
  player for details or to open their lookup-site profile. Reveals ranked-hidden teammates via the
  champ-select chat room. Shows your **side** (blue/red) and which team has **last pick**.
- **Live game** — both teams with names, ranks, KDA, CS and items, ordered by role, updating live.
- **History** — recent champ selects, marked played or dodged, with one-click team multi-search.
- **Automation** (all opt-in) — auto-accept queue, re-queue after a game, restart long queues, pause
  after a dodge, auto-ban and auto-lock with per-role pick lists, and auto-open your multi-search.
- **Discord Rich Presence** — show your League status (champion, rank, timers) on your Discord
  profile.
- **App** — system tray, close-to-tray, launch on startup, and pop-to-front on champ select.

## Tech

Electron + Vite (electron-vite) · React + TypeScript · Tailwind CSS. All LCU calls live in the main
process; the renderer talks to it through a typed, context-isolated `window.kali` preload API.

## Development

Requires Node.js 20+ and a Windows machine with League of Legends installed.

```bash
npm install
npm run dev      # launch the app against your running League client
npm run build    # typecheck + production build
```

> If you launch from a shell that sets `ELECTRON_RUN_AS_NODE=1` (e.g. some IDE terminals), unset it
> first, otherwise Electron starts as plain Node and crashes.

## Discord Rich Presence setup

Rich Presence uses a shared Discord application so there's no per-user setup — just enable it in the
**League RPC** tab. (If you're building your own fork, create a Discord application, put its
Application ID in `BUNDLED_APP_ID` in `src/shared/rpc.ts`, or paste an ID in the tab.)

## License

[MIT](LICENSE)
