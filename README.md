# Ibiza Offseason

Site voor ibizaoffseason.com. Elke push naar `main` gaat automatisch live via Vercel.

## SEO build (automatisch bij elke deploy)
Vercel draait `node tools/seo-build.js` (zie `vercel.json`). Dat script maakt bij elke deploy:
- een vaste pagina per event (`/event/...`), retreat (`/retreat/...`) en venue (`/venue/...`) met schema.org-data,
- de agenda en Open-in-Winter-lijst ook als statische HTML in de pagina (voor Google; de scripts nemen het daarna over),
- og:image / Twitter-cards en scherpere titels op alle pagina's,
- een nieuwe `sitemap.xml`.
Niets hiervan hoeft in git: de mappen `event/`, `venue/` en `retreat/` staan in `.gitignore`. Lokaal testen: `node tools/seo-build.js` in een kopie van de map.
