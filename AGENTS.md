# AGENTS.md — lyyl80's Blog

## Tech Stack
- Hugo static site generator (≥ v0.146.0 required by PaperMod)
- PaperMod theme as git submodule (`themes/PaperMod`), custom layouts in `layouts/` fully override theme defaults (not extend)
- No npm / Makefile / build scripts — pure Hugo
- Custom CSS design system in `assets/css/style.css`, no framework
- Client-side search: Hugo generates `/index.json` at build, JS in `assets/js/main.js` queries it

## Commands
```bash
hugo server          # dev server with live reload
hugo                 # production build → public/
hugo new content posts/文章名.md   # new post (draft by default)
```

## Key Conventions
- Content language: `zh-cn`
- Post Front Matter must include `date`, `tags`, `summary`
- `public/` is tracked in git (GitHub Pages deployment) — run `hugo`, then commit `public/` changes, then `git push`
- Single `main` branch, no PR workflow
- Theme submodule: `git submodule update --init --recursive` on fresh clone

## Architecture
- Homepage `/` uses `layouts/index.html` (Dashboard: calendar + stats + latest articles)
- All other pages (posts list, archives, tags, search, about) use `layouts/_default/list.html` with section-based conditionals
- Post detail uses `layouts/_default/single.html`
- Layout: fixed sidebar + main content area, no featured images
- Search: `/search/` page → fetches `/index.json` → client-side filter in JS
- `content/posts/ARCHITECTURE.md` is an external AI agent architecture doc, not blog metadata

## Deploy
1. `hugo`
2. `git add public/ && git commit -m "..."` (or `git add -A`)
3. `git push origin main`
