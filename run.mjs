// One check: read op.gg, store any new games, post new ranked solo/duo games to Discord, rebuild the page.
//   node run.mjs              (normal run - what the GitHub Action does)
//   node run.mjs --fixture f  (build from a saved op.gg read instead of opening op.gg - for testing)
import fs from 'fs';
import crypto from 'crypto';
import { parseGame } from './lib/extract.mjs';
import { stats, roast, dayReport, guestCallouts } from './lib/report.mjs';
import { buildPage } from './lib/page.mjs';
import { postGame, postText } from './lib/discord.mjs';
import { opDateToTs, tsToOpDate } from './lib/time.mjs';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
if (process.env.PAGE_URL) cfg.pageUrl = process.env.PAGE_URL;
const DATA = 'data', DOCS = 'docs', SHOTS = 'docs/shots', TMP = '.tmp_shots';
fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const save = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const isRanked = g => /Ranked/.test(g.queue);
const DAY = 864e5;

const history = load(`${DATA}/history.json`, { games: {} });
const state = load(`${DATA}/state.json`, { posted: [], firstRun: true });

// times are stored the way op.gg shows them in cfg.timezone; if the timezone changed, convert what's stored
const oldTz = history.tz || 'Europe/London';
if (oldTz !== cfg.timezone) {
  const remap = {}, moved = {};
  for (const g of Object.values(history.games)) {
    const ts = g.ts || opDateToTs(g.date, oldTz);
    const date = ts ? tsToOpDate(ts, cfg.timezone) : g.date;
    const id = [g.queue, date, g.champ && g.champ.n, g.duration].join('|');
    remap[g.id] = id; moved[id] = { ...g, id, date, ts };
  }
  history.games = moved;
  state.posted = (state.posted || []).map(i => remap[i] || i);
  console.log(`Timezone ${oldTz} -> ${cfg.timezone}: converted ${Object.keys(moved).length} stored games`);
}
history.tz = cfg.timezone;

// games we already have op.gg's detail panel for don't need opening again
const known = new Set(Object.values(history.games).filter(g => g.detail).map(g => `${g.date}|${g.champ && g.champ.n}`));
const fixArg = process.argv.indexOf('--fixture');
let raw;
if (fixArg > 0) raw = load(process.argv[fixArg + 1], null);
else { const { scrape } = await import('./lib/scrape.mjs'); raw = await scrape(cfg, TMP, known); }
if (!raw || !raw.games || !raw.games.length) { console.log('No games read from op.gg - leaving everything as it was.'); process.exit(0); }
const nowTs = fixArg > 0 && raw.scrapedAt ? Date.parse(raw.scrapedAt) : Date.now();

const parsed = raw.games.map(g => ({ ...parseGame(g, cfg.gameName), ts: opDateToTs(g.date, cfg.timezone), detail: g.detail || null, _idx: g.idx }));
const newOnes = [];
for (const g of parsed) {
  if (!history.games[g.id]) { g.firstSeen = Date.now(); history.games[g.id] = g; newOnes.push(g); }
  else {
    const keep = history.games[g.id];
    history.games[g.id] = { ...g, roast: keep.roast, shot: keep.shot, lp: g.lp != null ? g.lp : keep.lp, detail: g.detail || keep.detail || null, firstSeen: keep.firstSeen };
  }
  // keep the op.gg screenshot of each game we see (row screenshots are taken in the order op.gg lists them)
  const tmpShot = `${TMP}/game_${g._idx}.jpg`;
  if (!history.games[g.id].shot && fs.existsSync(tmpShot)) {
    const name = `g_${hash(g.id)}.jpg`; fs.copyFileSync(tmpShot, `${SHOTS}/${name}`); history.games[g.id].shot = name;
  }
  delete history.games[g.id]._idx;
}

// op.gg doesn't always show the LP gained/lost (never for Flex, sometimes not for the newest solo/duo game) -
// fill it in from his rank before vs after the game.
const APEX = /^(Master|Grandmaster|Challenger)/;
state.rank = state.rank || {}; state.pendingLp = state.pendingLp || {};
for (const [q, key] of [['Ranked Solo/Duo', 'solo'], ['Ranked Flex', 'flex']]) {
  const cur = raw.profile[key], prev = state.rank[key];
  const fresh = newOnes.filter(g => g.queue === q && !g.remake);
  if (fresh.length) state.pendingLp[key] = fresh.length === 1 && fresh[0].lp == null ? fresh[0].id : null;
  if (!cur) continue;
  const pid = state.pendingLp[key], pg = pid && history.games[pid];
  if (pg && pg.lp == null && prev) {
    const same = cur.tier === prev.tier || (APEX.test(cur.tier) && APEX.test(prev.tier));
    const diff = cur.lp - prev.lp;
    if (same && diff !== 0 && Math.abs(diff) <= 60 && (diff > 0) === !!pg.win) { pg.lp = diff; pg.lpCalc = true; state.pendingLp[key] = null; console.log(`LP for ${pid} worked out from rank: ${diff}`); state.rank[key] = cur; continue; }
    if (cur.lp === prev.lp && cur.tier === prev.tier) continue;   // rank not updated yet - try again next run
    state.pendingLp[key] = null;
  } else if (pg && pg.lp != null) state.pendingLp[key] = null;
  // only move the "rank before the next game" marker when a game was played (or on the first run)
  if (fresh.length || !prev) state.rank[key] = cur;
}

// newest first
const all = Object.values(history.games);
for (const g of all) if (!g.ts) g.ts = opDateToTs(g.date, cfg.timezone);
all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
const soloAll = all.filter(g => g.queue === cfg.trackQueue);
// "today" = his calendar day in cfg.timezone (Toronto)
const dayOf = t => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const todayKey = dayOf(nowTs);
const solo24 = soloAll.filter(g => g.ts && dayOf(g.ts) === todayKey);
const recent = stats(solo24);
const todayRanked = all.filter(g => isRanked(g) && g.ts && dayOf(g.ts) === todayKey);
const callouts = guestCallouts(todayRanked);
const ranked14 = all.filter(g => isRanked(g) && nowTs - g.ts < 14 * DAY);
const solo = raw.profile.solo;
const rank = solo ? `${solo.tier} ${solo.lp} LP` : '';

// a verdict for every new ranked game
for (const g of newOnes.filter(isRanked)) {
  const lite = { champ: g.champ && g.champ.n, result: g.result, win: g.win, remake: g.remake, k: g.k, d: g.d, a: g.a, kda: g.kda, cs: g.cs, csm: g.csm, kp: g.kp, length: g.duration, lp: g.lp, laning: g.laning, avgRank: g.avgTier };
  history.games[g.id].roast = await roast('game', { game: lite, rank }, cfg);
}

// the AI overview: today's ranked solo/duo, roasted, plus tips (redone when that set of games changes)
let changedReport = false;
const sig24 = hash(JSON.stringify(solo24.map(g => [g.id, !!g.detail])));
const r24 = load(`${DATA}/last24.json`, {});
if (solo24.length && (r24.sig !== sig24 || r24.v !== 3)) {
  r24.sig = sig24; r24.v = 3; r24.report = await dayReport('today', [...solo24].reverse(), { rank }, cfg); changedReport = true;
  save(`${DATA}/last24.json`, r24); console.log('Today report', r24.report.wins + 'W', r24.report.losses + 'L');
}
const report = solo24.length ? r24.report : null;
const overview = report ? report.roast : 'No ranked solo/duo games yet today.';

// live game
const live = raw.live || null;
save(`${DATA}/live.json`, live || {});

// Discord: one post per new solo/duo game (the very first run just records what's already there instead of spamming)
const soloNew = newOnes.filter(g => g.queue === cfg.trackQueue);
const hook = process.env.DISCORD_WEBHOOK_URL;
if (hook) {
  if (state.firstRun) {
    for (const g of soloAll) state.posted.push(g.id);
    try {
      await postText(hook, `👀 Now tracking **${cfg.gameName}#${cfg.tagLine}** (${rank}, ${solo ? solo.wins + 'W ' + solo.losses + 'L' : ''}). Every ranked solo/duo game gets posted here with an op.gg card and a verdict.${cfg.pageUrl ? '\n' + cfg.pageUrl : ''}\n> ${overview}`);
    } catch (e) { console.log(e.message); }
  } else {
    for (const g of [...soloNew].reverse()) {
      if (state.posted.includes(g.id)) continue;
      const shot = history.games[g.id].shot ? `${SHOTS}/${history.games[g.id].shot}` : null;
      try { await postGame(hook, { cfg, g: history.games[g.id], rank, shotFile: shot, pageUrl: cfg.pageUrl }); state.posted.push(g.id); console.log('Posted', g.id); }
      catch (e) { console.log('Discord post failed:', e.message); }
    }
    if (live && /Ranked/.test(live.queue) && state.liveAnnounced !== live.started) {
      const me = live.teams.flatMap(t => t.players).find(p => /fullcleardeluxe/i.test(p.n));
      try { await postText(hook, `🔴 **${cfg.gameName} is live** in ${live.queue}${me && me.champ ? ` on **${me.champ.n}**` : ''}. Pray for his team.${cfg.pageUrl ? '\n' + cfg.pageUrl : ''}`); state.liveAnnounced = live.started; } catch (e) { console.log(e.message); }
    }
  }
  state.firstRun = false;
  state.posted = state.posted.slice(-500);
} else console.log('No DISCORD_WEBHOOK_URL set - skipping Discord.');

// nothing changed (same games, same rank, same live status): leave the files alone so the repo only changes when he plays
const TEMPLATE = 13;   // bump when the page layout changes so the site rebuilds
const sig = hash(JSON.stringify([TEMPLATE, ranked14.map(g => [g.id, !!g.detail]), todayKey, solo24.map(g => g.id), raw.profile.solo, raw.profile.flex, live && [live.started, live.queue]]));
if (!newOnes.length && !changedReport && state.sig === sig && fs.existsSync(`${DOCS}/index.html`) && fixArg < 0) { console.log('No change since last check.'); process.exit(0); }
state.sig = sig;
// keep the stored history to ~30 days
for (const [id, g] of Object.entries(history.games)) if (g.ts && nowTs - g.ts > 30 * DAY) delete history.games[id];
save(`${DATA}/history.json`, history);
save(`${DATA}/state.json`, state);
save(`${DATA}/profile.json`, { ...raw.profile, scrapedAt: raw.scrapedAt || new Date().toISOString() });

const games = ranked14.map(g => history.games[g.id]);
fs.writeFileSync(`${DOCS}/index.html`, buildPage({ cfg, profile: raw.profile, games, recent, report, live, callouts, build: sig, updatedAt: raw.scrapedAt || new Date().toISOString() }));
console.log(`Done: ${parsed.length} games read, ${newOnes.length} new. ${ranked14.length} ranked games in the last 14 days. ${recent.wins}W ${recent.losses}L (${recent.lpNet} LP) today in solo/duo.${live ? ' LIVE NOW.' : ''}`);
