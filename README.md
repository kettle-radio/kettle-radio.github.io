# Put the Kettle On

Randomly chosen, timeless BBC Sounds. Press the button and a spoken-word programme (drama, comedy, history, science, documentaries, life stories) opens in BBC Sounds. No news.

## How it works

- `template.html` is the page.
- `scripts/build.mjs` picks about 6,000 programmes from the BBC Sounds catalogue and writes them into `dist/index.html`. It favours timeless shows such as *In Our Time* and *The Life Scientific*, and skips news, politics, sport and anything leaving BBC Sounds within three months.
- A GitHub Action runs the build every Monday and publishes the result to GitHub Pages. You can also run it by hand from the **Actions** tab ("Refresh and publish" → "Run workflow").
- If the BBC catalogue can't be reached, the build falls back to the snapshot in `data/episodes.json`.

The page uses an undocumented BBC catalogue service, so it may need fixing if the BBC changes it. Programmes play on BBC Sounds itself; most are available in the UK only.
