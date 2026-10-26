// Numbers for the page and the Discord posts, plus the AI roast.
export function stats(games) {
  const g = games.filter(x => !x.remake);
  const n = g.length || 1;
  const sum = f => g.reduce((s, x) => s + (f(x) || 0), 0);
  const wins = g.filter(x => x.win).length, losses = g.length - wins;
  const K = sum(x => x.k) / n, D = sum(x => x.d) / n, A = sum(x => x.a) / n;
  const mins = sum(x => x.minutes);
  const lpNet = g.reduce((s, x) => s + (x.lp || 0), 0);
  const champs = {};
  for (const x of g) {
    const c = x.champ ? x.champ.n : '?';
    const o = champs[c] || (champs[c] = { name: c, img: x.champ ? x.champ.u : '', games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, mins: 0 });
    o.games++; if (x.win) o.wins++; o.k += x.k; o.d += x.d; o.a += x.a; o.cs += x.cs; o.mins += x.minutes;
  }
  return {
    games: g.length, wins, losses, wr: g.length ? Math.round(wins / g.length * 100) : 0,
    k: K, d: D, a: A, kda: D > 0 ? (K + A) / D : K + A,
    cs: sum(x => x.cs) / n, csm: mins > 0 ? sum(x => x.cs) / mins : 0, kp: sum(x => x.kp) / n,
    mins: mins / n, lpNet, deaths10: g.filter(x => x.d >= 10).length,
    champs: Object.values(champs).sort((a, b) => b.games - a.games),
    streak: streakOf(games),
  };
}
function streakOf(games) {
  let s = 0, w = null;
  for (const x of games) { if (x.remake) continue; if (w === null) w = x.win; if (x.win !== w) break; s++; }
  return { n: s, win: !!w };
}
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);

// AI overview: an honest read of the numbers that roasts the bad bits. Uses Claude if ANTHROPIC_API_KEY is set,
// otherwise a built-in roast so the page still works.
export async function roast(kind, ctx, cfg) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const prompt = kind === 'game'
        ? `You write the post-game verdict for a Discord channel that tracks a friend's League of Legends ranked solo/duo games on op.gg. Player: ${cfg.gameName}#${cfg.tagLine} (${ctx.rank}). Game: ${JSON.stringify(ctx.game)}.\nWrite 2-3 punchy sentences. If the game was bad (loss, many deaths, low CS/min for their role, low kill participation, feeding), roast them brutally - savage friend trash-talk - no slurs, nothing about real-life traits. If it was genuinely good, give grudging credit with a small jab. Reference the actual numbers. No hashtags, no emojis spam (max 1).`
        : `You write the "AI overview" for a page that tracks a friend's League of Legends ranked solo/duo games from op.gg. Player: ${cfg.gameName}#${cfg.tagLine}. Season: ${JSON.stringify(ctx.season)}. Recent ranked solo/duo stats: ${JSON.stringify(ctx.recent)}. Recent games (newest first): ${JSON.stringify(ctx.games)}.\nWrite a short analysis (4-6 sentences) of how they're actually performing: trends, champion pool, deaths, farm, kill participation, LP. Where the performance isn't good, roast it - funny and savage but no slurs and nothing about real-life traits. Where it's good, admit it grudgingly. Use the real numbers. Plain text, no headings, no hashtags.`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: cfg.aiModel || 'claude-haiku-5-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
      });
      const j = await r.json();
      const txt = j && j.content && j.content[0] && j.content[0].text;
      if (txt) return txt.trim();
      console.log('AI roast failed, using built-in:', JSON.stringify(j).slice(0, 300));
    } catch (e) { console.log('AI roast error, using built-in:', e.message); }
  }
  return kind === 'game' ? builtinGame(ctx.game) : builtinOverview(ctx);
}

const pickOne = a => a[Math.floor(Math.random() * a.length)];
function builtinGame(g) {
  const kda = `${g.k}/${g.d}/${g.a}`;
  if (g.remake) return 'Remake. Even the game gave up on this one.';
  if (!g.win && g.d >= 8) return pickOne([`${kda} on ${g.champ}. That's not a KDA, that's a donation receipt.`, `${g.d} deaths. The enemy team should be paying ${g.d} cents in rent for living in this player's jungle.`]);
  if (!g.win && g.kp < 40) return `${g.kp}% kill participation. Was ${g.champ} in this game or just watching it?`;
  if (!g.win && g.csm < 6) return `${g.csm} CS/min on ${g.champ}. The camps respawned out of boredom. L.`;
  if (!g.win) return pickOne([`A ${kda} loss on ${g.champ}. Not the worst, but the LP doesn't care about effort.`, `Lost on ${g.champ} (${kda}). Blame the team, sure. The op.gg won't.`]);
  if (g.d === 0) return `${kda} deathless on ${g.champ}. Annoyingly clean. Enjoy it, it won't last.`;
  if (g.k + g.a >= 20 && g.d <= 5) return `${kda} on ${g.champ}, ${g.kp}% KP. Fine. That was actually good. Don't let it go to your head.`;
  return pickOne([`Win on ${g.champ} (${kda}). Carried or carried? The ${g.csm} CS/min says "a bit of both".`, `${kda} win on ${g.champ}. LP is LP, even when it's ugly.`]);
}
function builtinOverview(c) {
  const r = c.recent, out = [];
  out.push(`${r.wins}W ${r.losses}L in the tracked solo/duo games (${r.wr}%), averaging ${f1(r.k)}/${f1(r.d)}/${f1(r.a)} for a ${f1(r.kda)} KDA.`);
  if (r.d >= 6) out.push(`${f1(r.d)} deaths a game is less "jungler" and more "free gold delivery service".`);
  else out.push(`Only ${f1(r.d)} deaths a game, which is suspiciously responsible.`);
  if (r.csm < 6.5) out.push(`${f1(r.csm)} CS/min - the jungle camps are filing a missing person report.`);
  else out.push(`${f1(r.csm)} CS/min is solid farming, credit where it's due.`);
  if (r.kp < 50) out.push(`${Math.round(r.kp)}% kill participation: the team fights, and he hears about it later.`);
  const top = r.champs[0];
  if (top) out.push(`${top.games} of these on ${top.name} (${Math.round(top.wins / top.games * 100)}% WR) - ${top.wins / top.games >= 0.5 ? 'the comfort pick is actually comforting' : 'loyalty to a champion that clearly is not loyal back'}.`);
  if (r.streak.n >= 3) out.push(r.streak.win ? `On a ${r.streak.n}-game win streak, so of course nobody will shut up about it.` : `${r.streak.n} losses in a row. Maybe touch some grass between queues.`);
  return out.join(' ');
}

// ---------------- the daily report: that day's solo/duo games, roasted, plus what to fix ----------------
export const isInt = g => !g.remake && (g.d >= 10 || (g.d >= 7 && (g.k + g.a) / Math.max(1, g.d) < 1.2));

export async function dayReport(dayLabel, games, ctx, cfg) {
  const s = stats(games);
  const lite = games.map(g => { const x = objOf(g); return { champ: g.champ && g.champ.n, win: g.win, k: g.k, d: g.d, a: g.a, kp: g.kp, csm: g.csm, lp: g.lp, laning: g.laning, inted: isInt(g), withEmeraldFinalBoss: !!(g.players || []).some(p => /^emeraldfinalboss$/i.test(p.n)), withWyatt: !!(g.players || []).some(p => /^wyatt$/i.test(p.n)), jungle: isJungle(g), ...(x ? { opScore: x.me.op, opRank: x.me.opr, controlWards: x.me.cw, objectivesUs: x.us, objectivesThem: x.them } : {}) }; });
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const prompt = `You write the "AI overview" for "Chenny LoL Tracker", a page where friends track Chenny's League of Legends ranked solo/duo games from op.gg. Player: ${cfg.gameName}#${cfg.tagLine}, currently ${ctx.rank}. Period: ${dayLabel}.
The ranked solo/duo games (oldest first): ${JSON.stringify(lite)}
Day totals: ${JSON.stringify({ wins: s.wins, losses: s.losses, avgKDA: `${s.k.toFixed(1)}/${s.d.toFixed(1)}/${s.a.toFixed(1)}`, kdaRatio: s.kda.toFixed(2), csPerMin: s.csm.toFixed(1), killParticipation: Math.round(s.kp), lpNet: s.lpNet, intGames: games.filter(isInt).length })}
Return ONLY JSON: {"roast": "...", "fixes": ["...", "...", "..."]}
- "roast": 1-2 SHORT sentences, max 25 words total. Brutal friend trash-talk about how he's playing, using at most one number. Bad day => go for the throat (e.g. "0-3 and -45 LP. Not doing good today, uninstall."). Good day => grudging, still a jab. Do NOT go game by game. No slurs, nothing about real-life traits, appearance or family.
- If he played badly in a game with EmeraldFinalBoss, glaze EmeraldFinalBoss (he is clearly better). If he jungled in a game with Wyatt, flame him for wasting the game ganking Wyatt's lane.
- "fixes": exactly 3 short, clear tips (max ~15 words each) on what he must improve, from the numbers: e.g. objectives (dragons/grubs/herald lost), low kill participation, deaths, farm, vision/control wards, champion pool.`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: cfg.aiModel || 'claude-haiku-5-5', max_tokens: 700, messages: [{ role: 'user', content: prompt }] }),
      });
      const j = await r.json();
      const txt = j && j.content && j.content[0] && j.content[0].text;
      const m = txt && txt.match(/\{[\s\S]*\}/);
      if (m) { const o = JSON.parse(m[0]); if (o.roast) return { roast: o.roast, fixes: (o.fixes || []).slice(0, 4), ai: true, ...summary(s, games) }; }
      console.log('AI day report failed, using built-in:', JSON.stringify(j).slice(0, 300));
    } catch (e) { console.log('AI day report error, using built-in:', e.message); }
  }
  return { ...builtinDay(s, games), ai: false, ...summary(s, games) };
}
function summary(s, games) { return { wins: s.wins, losses: s.losses, k: s.k, d: s.d, a: s.a, kda: s.kda, csm: s.csm, kp: s.kp, lpNet: s.lpNet, ints: games.filter(isInt).length, games: games.length }; }

function builtinDay(s, games) {
  const ints = games.filter(isInt);
  const worst = [...games].sort((a, b) => (b.d - (b.k + b.a) / 3) - (a.d - (a.k + a.a) / 3))[0];
  const best = [...games].sort((a, b) => ((b.k + b.a) / Math.max(1, b.d)) - ((a.k + a.a) / Math.max(1, a.d)))[0];
  const out = [];
  const wl = `${s.wins}W ${s.losses}L`, lp = `${s.lpNet >= 0 ? '+' : ''}${s.lpNet} LP`;
  if (ints.length >= 2 || (s.losses >= s.wins + 2)) out.push(pickOne([`${wl}, ${lp}. Not doing good today. Uninstall.`, `${wl}, ${lp}. Log off and hand the account to someone who can play.`, `${wl}, ${lp}. The enemy team should be paying him.`]));
  else if (ints.length) out.push(pickOne([`Inted a ${ints[0].k}/${ints[0].d}/${ints[0].a} ${ints[0].champ ? ints[0].champ.n : ''}. Embarrassing. ${wl}, ${lp}.`, `${wl}, ${lp} - and a ${ints[0].k}/${ints[0].d}/${ints[0].a} int in there. Uninstall.`]));
  else if (s.losses > s.wins || s.lpNet < 0) out.push(pickOne([`${wl}, ${lp}. Mid at best. Do better.`, `${wl}, ${lp}. Bleeding LP like it's a hobby.`]));
  else if (s.wins > s.losses) out.push(pickOne([`${wl}, ${lp}. Fine. Even a broken clock wins sometimes.`, `${wl}, ${lp}. Decent - don't let it go to your head.`]));
  else out.push(`${wl}, ${lp}. Hours of queueing to go nowhere.`);
  // what to fix
  const fixes = [];
  const ob = games.map(objOf).filter(Boolean);
  const avg = f => ob.reduce((t, x) => t + f(x), 0) / Math.max(1, ob.length);
  if (ob.length && avg(x => x.them.Dragon + x.them['Void Grub'] + x.them['Rift Herald']) > avg(x => x.us.Dragon + x.us['Void Grub'] + x.us['Rift Herald']) + 1)
    fixes.push(`Take objectives: losing dragons/grubs (${f1(avg(x => x.us.Dragon))} vs ${f1(avg(x => x.them.Dragon))} drakes a game). Be there before they spawn.`);
  if (s.kp < 55) fixes.push(`Low kill participation (${Math.round(s.kp)}%). Stop farming while your team fights.`);
  if (s.d >= 5 || ints.length) fixes.push(`Stop dying - ${f1(s.d)} deaths a game. Ward before face-checking.`);
  if (ob.length && avg(x => x.me.cw) < 1.5) fixes.push(`Buy control wards - ${f1(avg(x => x.me.cw))} a game is nothing.`);
  if (s.csm < 7) fixes.push(`Farm more: ${f1(s.csm)} CS/min. Clear camps between fights.`);
  const lan = games.filter(g => g.laning).map(g => g.laning[0]);
  if (lan.length && lan.reduce((a, b) => a + b, 0) / lan.length < 50) fixes.push('Losing the early game - plan the first clear and gank the winning lane.');
  if (s.losses >= 3 && s.losses > s.wins) fixes.push('Two losses in a row = log off, not "one more".');
  const champs = new Set(games.map(g => g.champ && g.champ.n));
  if (champs.size >= 4 && games.length <= 6) fixes.push(`${champs.size} champions in ${games.length} games - pick 2-3 and stick to them.`);
  while (fixes.length < 3) fixes.push(['Review one loss - find the fight that threw it.', 'Track objective timers and set up vision a minute early.', 'Play with the team, not for the highlight reel.'][fixes.length % 3]);
  return { roast: out.join(' '), fixes: fixes.slice(0, 3) };
}


// ---------------- per-game analysis (shown behind the "Analysis" button) ----------------
// uses the op.gg detail panel (objectives, OP Score, damage, wards) when we have it
export function objOf(g) {
  const d = g.detail; if (!d || !d.teams || d.teams.length < 2) return null;
  const ti = d.teams.findIndex(t => t.players.some(p => /fullcleardeluxe/i.test(p.n)));
  if (ti < 0) return null;
  const meP = d.teams[ti].players.find(p => /fullcleardeluxe/i.test(p.n));
  const z = { Baron: 0, Dragon: 0, 'Rift Herald': 0, 'Void Grub': 0, Tower: 0, Inhibitor: 0 };
  const team = d.teams[ti].players;
  return { me: meP, us: { ...z, ...(d.obj[ti] || {}) }, them: { ...z, ...(d.obj[1 - ti] || {}) }, team,
    dmgRank: 1 + team.filter(p => p.dmg > meP.dmg).length };
}
export function analyse(g) {
  if (g.remake) return { verdict: 'Remake. Nothing to see.', points: [] };
  const P = [], good = (t) => P.push({ ok: true, t }), bad = (t) => P.push({ ok: false, t });
  const x = objOf(g);
  if (x) {
    const o = x.me.opr;
    if (/MVP|ACE/.test(o)) good(`OP Score ${x.me.op} - ${o} of the game`); else if (/^(8|9|10)th/.test(o)) bad(`OP Score ${x.me.op} - ranked ${o} of 10 players`); else P.push({ ok: null, t: `OP Score ${x.me.op} (${o} of 10)` });
    const us = x.us, th = x.them;
    const objLine = `Drakes ${us.Dragon}-${th.Dragon} · Grubs ${us['Void Grub']}-${th['Void Grub']} · Herald ${us['Rift Herald']}-${th['Rift Herald']} · Baron ${us.Baron}-${th.Baron}`;
    const diff = (us.Dragon + us['Void Grub'] + us['Rift Herald'] + us.Baron) - (th.Dragon + th['Void Grub'] + th['Rift Herald'] + th.Baron);
    if (diff <= -2) bad(`Not getting objectives: ${objLine}`); else if (diff >= 2) good(`Objectives controlled: ${objLine}`); else P.push({ ok: null, t: `Objectives even: ${objLine}` });
    if (x.dmgRank <= 2) good(`Damage: ${x.me.dmg.toLocaleString('en-US')} to champions (#${x.dmgRank} on his team)`); else if (x.dmgRank >= 4) bad(`Low damage: ${x.me.dmg.toLocaleString('en-US')} to champions (#${x.dmgRank} of 5 on his team)`);
    if (x.me.cw === 0) bad('Vision: bought 0 control wards'); else if (x.me.cw >= 3) good(`Vision: ${x.me.cw} control wards bought`);
  }
  if (g.kp < 45) bad(`Low kill participation: ${g.kp}% - missing fights`); else if (g.kp >= 65) good(`Kill participation ${g.kp}% - in every fight`);
  if (g.d >= 8) bad(`${g.d} deaths - feeding`); else if (g.d <= 3) good(`Only ${g.d} deaths`);
  if (g.csm < 6) bad(`Farm: ${g.csm} CS/min - way too low`); else if (g.csm >= 8) good(`Farm: ${g.csm} CS/min`);
  if (g.laning) { if (g.laning[0] < 45) bad(`Lost the early game (laning ${g.laning[0]}:${g.laning[1]})`); else if (g.laning[0] > 55) good(`Won the early game (laning ${g.laning[0]}:${g.laning[1]})`); }
  const verdict = g.roast || builtinGame({ ...g, champ: g.champ && g.champ.n });
  for (const c of guestCallouts([g])) P.unshift({ ok: c.kind, t: c.text });
  return { verdict, points: P };
}

// ---------------- special guests: EmeraldFinalBoss gets glazed when Chenny plays badly, Chenny gets flamed for jungling around Wyatt ----------------
const ROLES = ['top laner', 'jungler', 'mid laner', 'ADC', 'support'];
const pickBy = (arr, seed) => arr[[...String(seed)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % arr.length];
const isMe = n => /^fullcleardeluxe$/i.test(n || '');
export const playedBad = g => !g.remake && (!g.win || isInt(g) || (g.d >= 6 && (g.k + g.a) / Math.max(1, g.d) < 2));
export const isJungle = g => (g.spells || []).some(s => /smite/i.test(s.n));
function findIn(g, re) {
  const ps = g.players || []; const me = ps.findIndex(p => isMe(p.n)); const i = ps.findIndex(p => re.test(p.n));
  if (i < 0 || me < 0) return null;
  return { role: ROLES[i % 5], sameTeam: Math.floor(i / 5) === Math.floor(me / 5) };
}
// one line per game, newest first: [{ kind: 'glaze'|'flame', text, gameId }]
export function guestCallouts(games) {
  const out = [], seen = new Set();
  for (const g of games) {
    if (g.remake) continue;
    const champ = g.champ ? g.champ.n : '?', kda = `${g.k}/${g.d}/${g.a}`;
    const key = [g.queue, champ, kda, g.duration].join('|'); if (seen.has(key)) continue; seen.add(key);
    const em = findIn(g, /^emeraldfinalboss$/i);
    if (em && playedBad(g)) {
      out.push({ kind: 'glaze', gameId: g.id, text: em.sameTeam ? pickBy([
        `EmeraldFinalBoss was on your team and you still went ${kda} on ${champ}. Next time just play behind your ${em.role} - he has more skill than you.`,
        `${kda} on ${champ} with EmeraldFinalBoss as your ${em.role}? He carried the mental of this game alone. Ward his lane, hand him every kill, and stay out of his way.`,
        `Imagine having EmeraldFinalBoss as your ${em.role} and still losing it ${kda}. He's the real main character - you're the loading-screen extra.`,
      ], g.id) : pickBy([
        `Got washed by EmeraldFinalBoss (enemy ${em.role}) while going ${kda} on ${champ}. Watch his VODs, take notes, humble yourself.`,
        `EmeraldFinalBoss was on the other team and it showed: ${kda} on ${champ}. That's what real skill looks like, Chenny.`,
      ], g.id) });
    }
    const wy = findIn(g, /^wyatt$/i);
    if (wy && isJungle(g)) {
      out.push({ kind: 'flame', gameId: g.id, text: wy.sameTeam ? pickBy([
        `Jungling ${champ} with Wyatt on your team and you STILL spent the game camping his lane. Your other lanes forgot what a jungler looks like. ${kda}.`,
        `Chenny pathed to Wyatt's lane so many times the enemy jungler took the entire map for free. Stop ganking Wyatt. ${kda} on ${champ}.`,
        `${kda} on ${champ}: every gank went to Wyatt, every objective went to the enemy. Wyatt doesn't need a babysitter - your team needed a jungler.`,
      ], g.id) : pickBy([
        `Kept ganking into Wyatt's lane on ${champ} and got nothing for it. ${kda}. Leave Wyatt alone - he's clearly in your head.`,
        `Wyatt was on the enemy team and Chenny made it personal: ${kda} on ${champ}. Gank literally anyone else.`,
      ], g.id) });
    }
  }
  return out;
}

// ---------------- champion tiers (op.gg tier list) for the top of the AI overview ----------------
const POS = ['top', 'jungle', 'mid', 'adc', 'support'];
const POS_NAME = { top: 'top laner', jungle: 'jungler', mid: 'mid laner', adc: 'ADC', support: 'support' };
const champId = u => decodeURIComponent(String(u || '').split('?')[0].split('/').pop().replace('.png', '')).toLowerCase();
export function tierOf(tiers, pos, champUrl) {
  const list = tiers && tiers[pos]; if (!list || !list.length) return null;
  const t = list.find(x => x.id === champId(champUrl)); if (!t || !t.band) return null;
  const band = list.filter(x => x.band === t.band), i = band.findIndex(x => x.id === t.id);
  const letter = 'SABCD'[t.band - 1], third = band.length < 3 ? 1 : Math.floor(i / band.length * 3);
  return { label: letter + (third === 0 ? '+' : third === 2 ? '-' : ''), score: t.band * 3 + third, rank: t.rank, of: list.length };
}
// a few lines like "Played S+ tier Hecarim and lost to a C- tier Volibear jungler."
export function matchupLines(games, tiers) {
  const out = [];
  for (const g of games) {
    if (g.remake) continue;
    const ps = g.players || []; const me = ps.findIndex(p => /^fullcleardeluxe$/i.test(p.n)); if (me < 0) continue;
    const pos = POS[me % 5], enemy = ps[(me < 5 ? 5 : 0) + me % 5];
    const mine = tierOf(tiers, pos, g.champ && g.champ.u), theirs = enemy && tierOf(tiers, pos, enemy.u);
    if (!mine || !theirs) continue;
    const my = g.champ.n, en = enemy.c || 'someone', role = POS_NAME[pos];
    const an = l => (/^[AS]/.test(l) ? 'an ' : 'a ') + l;   // "an S+", "a C-"
    let text, weight; const d = theirs.score - mine.score;   // > 0: his champ is the stronger pick
    if (!g.win && d > 0) { text = `Played ${mine.label} tier ${my} and lost to ${an(theirs.label)} tier ${en} ${role}. Embarrassing.`; weight = 3 + d; }
    else if (!g.win && d < 0) { text = `Lost on ${mine.label} tier ${my} into ${an(theirs.label)} tier ${en} ${role}. Got out-drafted - and then out-played.`; weight = 2; }
    else if (!g.win) { text = `Lost an even ${mine.label} tier matchup: ${my} vs ${en}. No excuses.`; weight = 2; }
    else if (d < 0) { text = `Won on ${mine.label} tier ${my} against ${an(theirs.label)} tier ${en}. Fine, that's a real diff.`; weight = 1; }
    else if (d > 0) { text = `Won on ${mine.label} tier ${my} vs ${an(theirs.label)} tier ${en}. Picked the stronger champ and did the bare minimum.`; weight = 0; }
    else { text = `Won an even ${mine.label} tier matchup: ${my} vs ${en}. Acceptable.`; weight = 0; }
    out.push({ text, weight, win: g.win });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 3);
}
