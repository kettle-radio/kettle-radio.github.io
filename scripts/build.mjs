// Builds dist/index.html with a fresh random sample of timeless BBC Sounds programmes.
// If the BBC catalogue can't be reached, it falls back to the snapshot in data/episodes.json.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const API = "https://rms.api.bbc.co.uk";
const MIN_EPISODES = 1500;

// Timeless shows: pulled straight from their own archives, up to 80 episodes each.
const EVERGREEN = {
  "In Our Time": "factual-history", "The Life Scientific": "factual-scienceandnature",
  "Desert Island Discs": "factual-lifestories", "Great Lives": "factual-lifestories",
  "You're Dead to Me": "factual-history", "Witness History": "factual-history",
  "The Infinite Monkey Cage": "factual-scienceandnature", "Short Works": "audiobooks",
  "The Essay": "factual-artscultureandthemedia", "Archive on 4": "documentaries",
  "Soul Music": "documentaries", "Natural Histories": "factual-scienceandnature",
  "Lady Killers with Lucy Worsley": "factual-crimeandjustice-truecrime",
  "Just One Thing - with Michael Mosley": "factual-healthandwellbeing", "Ramblings": "factual-travel",
  "Seriously...": "documentaries", "The Food Programme": "factual-foodanddrink",
  "Gardeners' Question Time": "factual-homesandgardens", "Short Cuts": "documentaries",
  "The Listening Project": "factual-lifestories", "Word of Mouth": "factual-artscultureandthemedia",
  "Making History": "factual-history", "Fortunately... with Fi and Jane": "comedy",
  "I'm Sorry I Haven't a Clue": "comedy", "Just a Minute": "comedy", "Drama on 4": "drama",
  "Classic Stories": "audiobooks", "Book of the Week": "audiobooks", "The Untold": "documentaries",
  "Free Thinking": "factual-artscultureandthemedia", "The History Podcast": "factual-history",
  "Rare Earth": "factual-scienceandnature", "Open Country": "factual-travel",
  "Costing the Earth": "factual-scienceandnature", "Sliced Bread": "factual-healthandwellbeing",
  "Bunk Bed": "comedy", "Conversations from a Long Marriage": "comedy", "Ed Reardon's Week": "comedy",
  "John Finnemore's Souvenir Programme": "comedy", "Round Britain Quiz": "comedy",
};

// Genre sampling: up to 330 per genre, max 12 per show (3 for topical magazine shows).
const GENRES = [
  "drama", "comedy", "audiobooks", "documentaries", "factual-history", "factual-scienceandnature",
  "factual-artscultureandthemedia", "factual-lifestories", "factual-crimeandjustice-truecrime",
  "factual-foodanddrink", "factual-travel", "factual-homesandgardens", "factual-healthandwellbeing",
  "factual-familiesandrelationships", "religionandethics", "factual-disability",
];
const TOPICAL = /^(woman's hour|saturday live|the fifth floor|people fixing the world|elis james and john robins|that peter crouch podcast|the gerry anderson show|the scott mills weekly|the gemma collins podcast|loose ends|midweek|start the week|feedback|click|digital planet|science in action|inside health|health matters|5 live science podcast|what in the world|the conversation|newsjack|the now show|dead ringers|the kitchen caf[eé]|farmwatch|scotland outdoors|tech life)/i;
const NEWSY = /^(today|pm|the world at one|the world tonight|newsnight|newscast|americast|any questions|any answers|week in westminster|westminster hour|from our own correspondent|the briefing room|world business report|newshour|newsday|the newsroom|5 live news|radio 1 newsbeat|the daily service|sunday|thought for the day|prayer for the day|beyond belief|the media show|front row|you and yours|money box|file on 4|analysis|the context|global news podcast|ukrainecast|the news quiz|the archers|bells on sunday|daily service|in touch|crossing continents|assignment|the inquiry|question time)\b|news|politic|briefing|headline|highlights|gossip|need to know|all day breakfast|smart consumer|election|the week in|football|soccer|cricket|rugby|golf|tennis|formula 1|\bf1\b|sport/i;

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const norm = (s) => clean(s).toLowerCase().replace(/[’']/g, "'");
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API + path, { headers: { "user-agent": "put-the-kettle-on (weekly refresh)" } });
      if (res.ok) return await res.json();
    } catch {}
    await sleep(1000 * (attempt + 1));
  }
  return {};
}

async function fetchFresh() {
  const cutoff = Date.now() + 90 * 864e5; // must stay available for 3+ months
  const seen = new Set();
  const rows = [];
  const toRow = (genre, it) => {
    const until = it.availability?.to ? Date.parse(it.availability.to) : Infinity;
    if (until < cutoff) return null;
    const pid = (it.urn || "").split(":").pop();
    if (!pid || seen.has(pid)) return null;
    const mins = Math.round((it.duration?.value || 0) / 60);
    if (mins < 8) return null;
    return [genre, pid, clean(it.titles?.primary), clean(it.titles?.secondary || it.titles?.entity_title),
      clean(it.synopses?.short || it.synopses?.medium).slice(0, 160), mins, clean(it.network?.short_title),
      (it.release?.date || "").slice(0, 4), it.availability?.to ? it.availability.to.slice(0, 10) : ""];
  };

  const everNames = new Set(Object.keys(EVERGREEN).map(norm));
  for (const [name, genre] of Object.entries(EVERGREEN)) {
    const search = await getJSON("/v2/programmes/search/container?q=" + encodeURIComponent(name));
    const hit = (search.data || []).find((d) => norm(d.titles?.primary) === norm(name));
    if (!hit) { console.log(`  ${name}: not found`); continue; }
    const id = hit.id || (hit.urn || "").split(":").pop();
    const first = await getJSON(`/v2/programmes/playable?container=${id}&sort=-release_date&limit=100&offset=0`);
    const total = first.total || 0;
    const pageCount = Math.floor(total / 100);
    const offsets = new Set();
    while (offsets.size < Math.min(3, pageCount)) offsets.add(100 * (1 + Math.floor(Math.random() * pageCount)));
    const pages = [first, ...(await Promise.all([...offsets].map((o) => getJSON(`/v2/programmes/playable?container=${id}&sort=-release_date&limit=100&offset=${o}`))))];
    const cand = pages.flatMap((p) => (p.data || []).map((it) => toRow(genre, it)).filter(Boolean));
    let kept = 0;
    for (const r of shuffle(cand)) { if (kept >= 80) break; if (seen.has(r[1])) continue; seen.add(r[1]); rows.push(r); kept++; }
    console.log(`  ${name}: ${kept} of ${total}`);
  }

  const perShow = {};
  for (const genre of GENRES) {
    const first = await getJSON(`/v2/programmes/playable?category=${genre}&sort=-release_date&limit=1`);
    const total = first.total || 0;
    const n = Math.min(10, Math.max(1, Math.ceil(total / 100)));
    const offsets = new Set();
    let guard = 0;
    while (offsets.size < n && guard++ < 100) offsets.add(total <= 1000 ? offsets.size * 100 : Math.floor(Math.random() * Math.max(1, total - 100)));
    const pages = await Promise.all([...offsets].map((o) => getJSON(`/v2/programmes/playable?category=${genre}&sort=-release_date&offset=${o}&limit=100`)));
    const cand = [];
    for (const p of pages) for (const it of p.data || []) {
      const show = clean(it.titles?.primary);
      const net = clean(it.network?.short_title);
      if (!show || NEWSY.test(show) || everNames.has(norm(show)) || net === "CBeebies" || net === "Sport") continue;
      const row = toRow(genre, it);
      if (row) cand.push(row);
    }
    let kept = 0;
    for (const r of shuffle(cand)) {
      if (kept >= 330) break;
      if (seen.has(r[1])) continue;
      const cap = TOPICAL.test(r[2]) ? 3 : 12;
      perShow[r[2]] = (perShow[r[2]] || 0) + 1;
      if (perShow[r[2]] > cap) continue;
      seen.add(r[1]); rows.push(r); kept++;
    }
    console.log(`  ${genre}: ${kept} (catalogue ${total})`);
  }
  return rows;
}

let episodes;
try {
  episodes = process.env.SKIP_FETCH ? [] : await fetchFresh();
  console.log(`Fetched ${episodes.length} episodes from BBC Sounds.`);
} catch (err) {
  console.log("Fetch failed:", err.message);
  episodes = [];
}
if (episodes.length < MIN_EPISODES) {
  console.log(`Too few episodes (${episodes.length}); using the saved snapshot instead.`);
  episodes = JSON.parse(await readFile("data/episodes.json", "utf8"));
}

const template = await readFile("template.html", "utf8");
const data = JSON.stringify(episodes).replace(/<\//g, "<\\/");
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", template.replace("/*EPISODES*/[]", data));
console.log(`Wrote dist/index.html with ${episodes.length} episodes.`);
