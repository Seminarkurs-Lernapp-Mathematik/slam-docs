# slam-docs

Dokumentation für **SLAM** (Smart Learning and Mathematics), erreichbar unter
[docs.learn-smart.app](https://docs.learn-smart.app).

## Tech-Stack

- [Astro](https://astro.build) + [Starlight](https://starlight.astro.build)
- Deployment via GitHub Actions auf GitHub Pages (Custom Domain `docs.learn-smart.app`)

## Lokale Entwicklung

```bash
npm install
npm run dev      # Dev-Server auf http://localhost:4321
npm run build    # Statisches Build in ./dist
npm run preview  # Preview des Builds
```

## Inhalte

- `src/content/docs/` – alle Doc-Seiten als `.md` / `.mdx`
- `src/content/docs/index.mdx` – Hero-Landingpage
- `src/content/docs/getting-started/` – Schüler- und Lehrer-Quickstart
- `src/content/docs/komponenten/` – App, Backend, Teacher-Plattform
- `src/content/docs/technisch/` – tiefergehende technische Themen
- `public/` – statische Assets (Screenshots, CNAME, Architektur-Graph)

## Screenshots ergänzen

Lege PNGs unter `public/screenshots/` ab. Konventionen siehe
[public/screenshots/README.md](./public/screenshots/README.md).

## Mehrsprachigkeit

Aktuell nur Deutsch. Die EN-Locale ist in `astro.config.mjs` vorbereitet, aber
auskommentiert. Aktivieren, sobald erste Inhalte unter `src/content/docs/en/` liegen.

## Deployment

Push auf `main` → GitHub Actions baut und deployed automatisch.
Erforderliche Einstellung im Repo: **Settings → Pages → Source: "GitHub Actions"**
(nicht "Deploy from a branch").
