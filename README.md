# Read a Blog

A minimal single-page app that serves a random post from a hand-curated list of personal blogs. Click a button, get a post. No feed to exhaust, no recommendations, no algorithms.

## How it works

1. On click, the browser calls a Netlify Function (`rss-proxy`) for each feed in the list
2. The function fetches and parses the RSS/Atom feed server-side and returns JSON
3. All posts are pooled and one is picked at random
4. "Try Another" picks a different post from the already-loaded pool

## Stack

- Vanilla HTML, CSS, JS — no build step, no framework
- Netlify Functions (Node.js) for the RSS proxy and blog submission
- Cloudflare Turnstile for CAPTCHA on the submission form
- Google Forms/Sheets as the submission backend

## Project structure

```
index.html                        # Markup
styles.css                        # All styles
script.js                         # All frontend logic
netlify/functions/
  rss-proxy.js                    # Fetches and parses RSS feeds
  submit-blog.js                  # Verifies CAPTCHA, forwards to Google Forms
package.json                      # rss-parser dependency
```

## Adding a new feed

Feeds must be added in **two places**:

1. `script.js` — add to the `feeds` array
2. `netlify/functions/rss-proxy.js` — add to `ALLOWED_FEEDS`

The proxy rejects any URL not in `ALLOWED_FEEDS`, so both must stay in sync.

## Environment variables

| Variable           | Where to set    | Description                        |
|--------------------|-----------------|------------------------------------|
| `TURNSTILE_SECRET` | Netlify UI      | Cloudflare Turnstile secret key    |

## Local development

Install dependencies:

```
npm install
```

To run functions locally, use the [Netlify CLI](https://docs.netlify.com/cli/get-started/):

```
npx netlify dev
```
