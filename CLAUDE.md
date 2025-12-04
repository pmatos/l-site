# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for a youth badminton player built with Astro 5. Deployed to GitHub Pages at https://l.ocmatos.com/.

## Commands

```bash
npm run dev           # Start dev server at localhost:4321
npm run build         # Fetch rankings + build production site to ./dist/
npm run preview       # Preview production build locally
npm run fetch-rankings # Fetch rankings from turnier.de (runs automatically during build)
```

## Architecture

- **Framework**: Astro 5 (static site generation)
- **Content**: JSON files in `src/data/` drive all dynamic content
  - `profile.json` - player info, rankings, achievements
  - `tournaments.json` - past and upcoming tournament data
- **Layout**: Single `Layout.astro` component wraps all pages with nav/footer
- **Styling**: Global CSS in `src/styles/global.css`
- **Rankings**: `scripts/fetch-rankings.js` scrapes turnier.de and updates `profile.json`

## Deployment

Auto-deploys via GitHub Actions on push to `main`. The workflow runs `npm run build` (which fetches rankings first) then deploys `./dist/` to GitHub Pages.
