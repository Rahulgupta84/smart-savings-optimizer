# Smart Savings Optimizer — Development Guidelines

## PRD Reference (Required Before Any Feature Work)

The authoritative PRD lives in Notion. **Fetch it before implementing any feature:**

- Notion page ID: `3febad0e-8a64-8015-a18b-de4221e5de1c`
- Child page: "Smart Savings Optimizer — PRD"
- Use the Notion MCP tool (`notion-fetch` or `notion-search`) to retrieve the current PRD at the start of any feature session

## Workflow

1. **Read the PRD first** — fetch the Notion PRD before writing any code for a new feature
2. **Implement what's described** — build only features defined in the PRD; no speculative additions
3. **Flag gaps** — if a requested feature is not in the PRD, say so and ask whether to add it to the PRD before coding
4. **Flag conflicts** — if existing code diverges from the PRD, surface it rather than silently overwriting

## Project Structure

- Pure HTML/CSS/JS — no build step, opens directly in browser
- `index.html` — app shell (Search, Cards, Portals panels + modals)
- `css/styles.css` — CSS variables, mobile-first, dark mode
- `js/data.js` — card/portal templates, merchant DB, category keywords
- `js/storage.js` — localStorage CRUD
- `js/engine.js` — recommendation engine, merchant identification, autocomplete
- `js/app.js` — UI controller, event wiring, modal management
