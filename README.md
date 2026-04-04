# Behind the Curtain

A theatrical concert invite website. A red velvet curtain covers the screen — click it to reveal the event details behind.

## Local Development

No build step required. Just open `index.html` in a browser, or use any static file server:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

## Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Under **Source**, select **Deploy from a branch**
4. Set branch to `main` and folder to `/ (root)`
5. Click **Save**

Your site will be live at `https://<your-username>.github.io/behind-the-curtain`

## Customising Content

All event info lives in `index.html` inside `.invite__inner`. Update:

- `.invite__eyebrow` — subtitle / teaser line
- `.invite__title` — event name
- `.invite__detail-value` elements — date, venue, doors, artists
- `.invite__tagline` — the quote
- `.invite__cta` — button text and `href`
- `.invite__footer` — dress code / small print

## Adjusting the Hint Timing

In `main.js`, change `HINT_DELAY` (milliseconds) to control how long before the "Click to reveal" hint appears:

```js
const HINT_DELAY = 5000; // 5 seconds
```
