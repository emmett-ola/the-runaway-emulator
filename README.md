 # The Runaway Emulator - 《跑路模拟器》🏃

A personal hobby project designed to provide an escape window from the boredom, irrationality, and hopelessness of daily work.

## What is this?

The Runaway Emulator is a web application that allows you to vent and escape from the daily grind through interactive gameplay. Currently, it features a simple Run button that makes a character run while recording and displaying your activity. In the future, it will evolve into a fully-fledged game space with multiple buttons, story progression, random events, and support for multiple playthroughs.

## Project Nature

This project is developed during personal leisure time, assisted by multiple AI agents, especially for the code part. Currently, there are no manual code changes.

## Core Vision

Create a game-like experience where:
- Players can find relief from work stress
- The narrative progresses based on real-world time
- Random events keep gameplay fresh
- Multiple playthroughs are encouraged with data inheritance and difficulty adjustments
- Cloud storage is the primary data model, with self-host and localStorage options available

## Current Features

- One-click Run button with character animations
- Statistics dashboard with streaks and trends
- 90-day calendar heatmap with color themes
- Dark mode support
- Progressive Web App (PWA) with offline support
- Export/Import data functionality
- Print calendar feature

## Future Plans

- Transform into a more game-like space with multiple interactive buttons
- Implement main story progression tied to real-world time
- Add random events and mini-games
- Support multiple playthroughs (NG+, NG++) with data inheritance
- Cloud storage with MariaDB (primary)
- Self-host option for privacy-focused users
- Local storage compatibility for offline use
- Docker-based deployment as the primary mode

## Quick Start

### Local Development
```bash
git clone https://github.com/macar-x/runaway-log.git
cd runaway-log
npm install
npm run dev
```
Visit `http://localhost:5173`

### Docker
```bash
docker compose up -d
```
Visit `http://localhost:8080`

## Tech Stack

React 19 + TypeScript + Vite + anime.js + Vitest  
PWA with Workbox + Service Worker  
Nginx Alpine + Docker (~53MB image)

## Requirements

- **Development:** Node.js 20+, npm 10+
- **Production:** Docker + Docker Compose

## License

MIT

---

Built with AI assistance.

## Translations

- [中文](readme_cn.md)
