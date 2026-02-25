# Project context for Claude

## What this is

A static single-page app hosted on Netlify. No framework, no build step. HTML + CSS + vanilla JS, with two Netlify Functions for server-side work.

## File map

| File | Purpose |
|------|---------|
| `index.html` | All markup |
| `styles.css` | All styles — dark warm theme, Lora serif font |
| `script.js` | All frontend logic — feed fetching, card rendering, form submission |
| `netlify/functions/rss-proxy.js` | Fetches RSS/Atom feeds server-side, returns JSON |
| `netlify/functions/submit-blog.js` | Verifies Turnstile CAPTCHA, forwards submission to Google Forms |
| `package.json` | Single dependency: `rss-parser` |

## Critical: adding a new feed requires two changes

Feeds are hardcoded in two places and must stay in sync:

1. `script.js` — `feeds` array
2. `netlify/functions/rss-proxy.js` — `ALLOWED_FEEDS` set

The proxy whitelists allowed feed URLs and returns 403 for anything else. Adding to `feeds` without adding to `ALLOWED_FEEDS` will silently fail at runtime.

## Architecture notes

- **RSS fetching**: browser calls `/.netlify/functions/rss-proxy?url=<encoded>` for each feed. The function uses `rss-parser` to handle both RSS and Atom. Response shape: `{ status, feed: { title }, items: [{ title, link }] }`.
- **Card links**: validated with `isSafeUrl()` before being set as `href` — only `http:` and `https:` are allowed.
- **Blog submission**: browser POSTs to `/.netlify/functions/submit-blog`. The function verifies the Cloudflare Turnstile token with `TURNSTILE_SECRET` env var, then forwards to Google Forms. The Google Forms URL and field entry IDs live only in the function, not in client-side code.
- **CSP**: set via `<meta>` tag in `index.html`. All external origins are explicitly listed. No `unsafe-inline`.

## Environment variables

- `TURNSTILE_SECRET` — Cloudflare Turnstile secret key, set in Netlify UI.

## Style conventions

- JS uses `const` / `let`, no semicolons omitted, Unicode escapes for non-ASCII characters (e.g. `\u2026` for `…`)
- CSS uses CSS custom properties (vars) defined in `:root` for all colours
- No TypeScript, no linter config
