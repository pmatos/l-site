# Linus - Badminton Player Website

Personal website for Linus, an elite youth badminton player. Built with [Astro](https://astro.build).

**Live site:** https://l.ocmatos.com/

## Quick Start

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at localhost:4321
npm run build     # Build for production
```

## Updating Content

All content is managed through JSON files in `src/data/`. Edit these files and push to deploy.

### Profile & Rankings (`src/data/profile.json`)

```json
{
  "name": "Linus",
  "fullName": "Linus Matos",
  "tagline": "Elite Youth Badminton Player",
  "bio": "A passionate and dedicated badminton player...",
  "photo": "/images/linus.jpg",
  "rankings": {
    "singles": 8,
    "doubles": 10,
    "mixed": 3
  },
  "achievements": [
    "Regional Youth Champion 2024",
    "National U15 Finalist"
  ],
  "club": "Your Club Name",
  "startedPlaying": 2019,
  "socialLinks": {
    "instagram": "",
    "youtube": ""
  }
}
```

**To update rankings:** Change the numbers in `rankings.singles`, `rankings.doubles`, `rankings.mixed`.

### Tournaments (`src/data/tournaments.json`)

The file has two sections: `past` (completed tournaments) and `upcoming` (future tournaments).

#### Adding a Past Tournament

Add to the `past` array:

```json
{
  "name": "Tournament Name",
  "date": "2024-11-15",
  "location": "Munich, Germany",
  "category": "U15",
  "results": {
    "singles": { "place": 1, "notes": "Gold Medal" },
    "doubles": { "place": 2, "partner": "Partner Name" },
    "mixed": null
  }
}
```

- `date`: Use format `YYYY-MM-DD`
- `results`: Set to `null` for events not participated in
- `place`: 1 = Gold, 2 = Silver, 3 = Bronze styling

#### Adding an Upcoming Tournament

Add to the `upcoming` array:

```json
{
  "name": "Tournament Name",
  "date": "2025-01-20",
  "location": "Frankfurt, Germany",
  "category": "U15",
  "registeredFor": ["singles", "doubles"],
  "notes": "Seeded 3rd in singles"
}
```

- `registeredFor`: Array of events: `"singles"`, `"doubles"`, `"mixed"`
- `notes`: Optional additional info

### Adding/Updating the Photo

1. Add photo to `public/images/linus.jpg`
2. The photo will automatically appear on the homepage and about page
3. Recommended: High quality portrait photo, minimum 800x1000px

## Project Structure

```
src/
├── components/
│   └── Layout.astro        # Main layout with nav/footer
├── data/
│   ├── profile.json        # Player info & rankings
│   └── tournaments.json    # Past & upcoming tournaments
├── pages/
│   ├── index.astro         # Homepage
│   ├── about.astro         # About page
│   └── tournaments/
│       ├── past.astro      # Past tournaments
│       └── next.astro      # Upcoming tournaments
├── styles/
│   └── global.css          # All styles
public/
└── images/                 # Photos go here
```

## Deployment

The site auto-deploys to GitHub Pages on every push to `main`:

1. Make changes to JSON files or code
2. Commit and push to `main`
3. GitHub Actions builds and deploys automatically
4. Live in ~2 minutes

## Moving Tournament from Upcoming to Past

After a tournament is completed:

1. Open `src/data/tournaments.json`
2. Find the tournament in `upcoming` array
3. Move it to `past` array
4. Add the `results` field with placements
5. Remove `registeredFor` and `notes` fields (or keep notes if relevant)
6. Commit and push

## Future Enhancements

- [ ] Auto-fetch rankings from turnier.de (player ID: 07-046080) at build time
- [ ] Photo gallery
- [ ] Social media integration

## Commands Reference

| Command           | Action                                      |
|:------------------|:--------------------------------------------|
| `npm install`     | Install dependencies                        |
| `npm run dev`     | Start dev server at `localhost:4321`        |
| `npm run build`   | Build production site to `./dist/`          |
| `npm run preview` | Preview build locally before deploying      |
