// One check: read op.gg, store any new games, post new ranked solo/duo games to Discord, rebuild the page.
//   node run.mjs              (normal run - what the GitHub Action does)
//   node run.mjs --fixture f  (build from a saved op.gg read instead of opening op.gg - for testing)
import fs from 'fs';
import crypto from 'crypto';
import { parseGame } from './lib/extract.mjs';
import { stats, roast } from './lib/report.mjs';
import { buildPage } from './lib/page.mjs';
import { postGame, postText } from './lib/discord.mjs';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
if (process.env.PAGE_URL) cfg.pageUrl = process.env.PAGE_URL;
const DATA = 'data', DOCS = 'docs', SHOTS = 'docs/shots', TMP = '.tmp_shots';
fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const save = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

const fixArg = process.argv.indexOf('--fixture');
let raw;
if (fixArg > 0) raw = load(process.argv[fixArg + 1], null);
else { const { scrape } = await import('./lib/scrape.mjs'); raw = await scrape(cfg, TMP); }
if (!raw || !raw.games || !raw.games.length) { console.log('No games read from op.gg - leaving everything as it was.'); process.exit(0); }

const history = load(`${DATA}/history.json`, { games: {} });
const state = load(`${DATA}/state.json`, { posted: [], firstRun: true });
const parsed = raw.games.map(g => ({ ...parseGame(g, cfg.gameName), _idx: g.idx }));
const newOnes = [];
for (const g of parsed) {
  if (!history.games[g.id]) { g.firstSeen = Date.now(); history.games[g.id] = g; newOnes.push(g); }
  else { const keep = history.games[g.id]; history.games[g.id] = { ...g, roast: keep.roast, shot: keep.shot, lp: g.lp != null ? g.lp : keep.lp }; }
  // keep the op.gg screenshot of each game we see (row screenshots are taken in the order op.gg lists them)
  const tmpShot = `${TMP}/game_${g._idx}.jpg`;
  if (!history.games[g.id].shot && fs.existsSync(tmpShot)) {
    const name = `g_${hash(g.id)}.jpg`; fs.copyFileSync(tmpShot, `${SHOTS}/${name}`); history.games[g.id].shot = name;
  }
}
for (const s of ['profile.jpg', 'games.jpg']) if (fs.existsSync(`${TMP}/${s}`)) fs.copyFileSync(`${TMP}/${s}`, `${SHOTS}/${s}`);

// newest first (op.gg's own order wins for games it still shows; older stored games follow)
const order = parsed.map(g => g.id);
const all = Object.values(history.games);
all.sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); if (ia >= 0 && ib >= 0) return ia - ib; if (ia >= 0) return -1; if (ib >= 0) return 1; return (b.firstSeen || 0) - (a.firstSeen || 0); });
const soloAll = all.filter(g => g.queue === cfg.trackQueue);
const recent = stats(soloAll.slice(0, 20));
const solo = raw.profile.solo;
const rank = solo ? `${solo.tier} ${solo.lp} LP` : '';

// a roast for every new ranked solo/duo game
const soloNew = newOnes.filter(g => g.queue === cfg.trackQueue);
for (const g of soloNew) {
  const lite = { champ: g.champ && g.champ.n, result: g.result, win: g.win, remake: g.remake, k: g.k, d: g.d, a: g.a, kda: g.kda, cs: g.cs, csm: g.csm, kp: g.kp, length: g.duration, lp: g.lp, laning: g.laning, avgRank: g.avgTier, items: (g.items || []).map(i => i.n) };
  history.games[g.id].roast = await roast('game', { game: lite, rank }, cfg);
}

// the page's AI overview is redone whenever something new happens (or there isn't one yet)
const prev = load(`${DATA}/overview.json`, {});
let overview = prev.text;
if (!overview || soloNew.length) {
  const lite = soloAll.slice(0, 12).map(g => ({ champ: g.champ && g.champ.n, win: g.win, k: g.k, d: g.d, a: g.a, cs: g.cs, csm: g.csm, kp: g.kp, len: g.duration, lp: g.lp }));
  overview = await roast('overview', { season: solo, recent: { ...recent, champs: recent.champs.slice(0, 5).map(c => ({ name: c.name, games: c.games, wins: c.wins })) }, games: lite }, cfg);
  save(`${DATA}/overview.json`, { text: overview, at: new Date().toISOString() });
}

// Discord: one post per new solo/duo game (the very first run just records what's already there instead of spamming)
const hook = process.env.DISCORD_WEBHOOK_URL;
if (hook) {
  if (state.firstRun) {
    for (const g of soloAll) state.posted.push(g.id);
    try {
      await postText(hook, `👀 Now tracking **${cfg.gameName}#${cfg.tagLine}** (${rank}, ${solo ? solo.wins + 'W ' + solo.losses + 'L' : ''}). Every ranked solo/duo game gets posted here with an op.gg card and a verdict.${cfg.pageUrl ? '\n' + cfg.pageUrl : ''}\n> 🤖 ${overview}`);
    } catch (e) { console.log(e.message); }
  } else {
    for (const g of [...soloNew].reverse()) {
      if (state.posted.includes(g.id)) continue;
      const shot = history.games[g.id].shot ? `${SHOTS}/${history.games[g.id].shot}` : null;
      try { await postGame(hook, { cfg, g: history.games[g.id], rank, shotFile: shot, pageUrl: cfg.pageUrl }); state.posted.push(g.id); console.log('Posted', g.id); }
      catch (e) { console.log('Discord post failed:', e.message); }
    }
  }
  state.firstRun = false;
  state.posted = state.posted.slice(-500);
} else console.log('No DISCORD_WEBHOOK_URL set - skipping Discord.');

// nothing new on op.gg (same games, same rank): leave the files alone so the repo only changes when he plays
const sig = hash(JSON.stringify([Object.keys(history.games).sort(), raw.profile.solo, raw.profile.flex]));
if (!newOnes.length && state.sig === sig && fs.existsSync(`${DOCS}/index.html`) && fixArg < 0) { console.log('No change since last check.'); process.exit(0); }
state.sig = sig;
save(`${DATA}/history.json`, history);
save(`${DATA}/state.json`, state);
save(`${DATA}/profile.json`, { ...raw.profile, scrapedAt: raw.scrapedAt || new Date().toISOString() });

const games = all.map(g => history.games[g.id]);
const shots = ['profile.jpg', 'games.jpg'].filter(s => fs.existsSync(`${SHOTS}/${s}`));
fs.writeFileSync(`${DOCS}/index.html`, buildPage({ cfg, profile: raw.profile, games, recent, overview, updatedAt: raw.scrapedAt || new Date().toISOString(), shots }));
console.log(`Done: ${parsed.length} games read, ${newOnes.length} new (${soloNew.length} solo/duo). ${recent.wins}W ${recent.losses}L in the last ${recent.games} solo/duo.`);
