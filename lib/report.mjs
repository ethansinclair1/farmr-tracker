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
  const lite = games.map(g => ({ champ: g.champ && g.champ.n, win: g.win, k: g.k, d: g.d, a: g.a, kda: g.kda, cs: g.cs, csm: g.csm, kp: g.kp, len: g.duration, lp: g.lp, laning: g.laning, avgRank: g.avgTier, inted: isInt(g) }));
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const prompt = `You write the "AI overview" for "Chenny LoL Tracker", a page where friends track Chenny's League of Legends ranked solo/duo games from op.gg. Player: ${cfg.gameName}#${cfg.tagLine}, currently ${ctx.rank}. Period: ${dayLabel}.
The ranked solo/duo games (oldest first): ${JSON.stringify(lite)}
Day totals: ${JSON.stringify({ wins: s.wins, losses: s.losses, avgKDA: `${s.k.toFixed(1)}/${s.d.toFixed(1)}/${s.a.toFixed(1)}`, kdaRatio: s.kda.toFixed(2), csPerMin: s.csm.toFixed(1), killParticipation: Math.round(s.kp), lpNet: s.lpNet, intGames: games.filter(isInt).length })}
Return ONLY JSON: {"roast": "...", "fixes": ["...", "...", "..."]}
- "roast": 5-7 sentences reviewing the period using the real numbers. Roast him HARD - savage, brutal, funny trash-talk like a friend who's waited all week to flame him. If he inted (games marked inted, lots of deaths, negative LP), go all out and name the worst games. Even on a good day, find something to flame and only give the most grudging credit. No slurs, nothing about real-life traits, appearance or family - only his gameplay.
- "fixes": exactly 3 specific, practical things he needs to improve, based on this day's numbers (e.g. deaths/positioning, farm/CS per min for a jungler or laner, kill participation/pathing, champion pool, early game/laning). Each one short and concrete, a little cheeky is fine.`;
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
  if (s.losses > s.wins && s.lpNet < 0) out.push(pickOne([
    `${wl} and ${lp}. That's not a ranked session, that's a charity drive for the enemy team.`,
    `${wl}, ${lp}. Riot should send him a thank-you email - he's personally funding everyone else's promotions.`,
    `${wl}, ${lp}. His LP graph looks like a ski slope and he isn't even wearing skis.`]));
  else if (s.wins > s.losses) out.push(pickOne([
    `${wl}, ${lp}. Even a broken clock wins lane twice a day.`,
    `${wl}, ${lp}. A winning stretch - screenshot it, frame it, it is not happening again.`]));
  else if (s.lpNet < 0) out.push(`${wl} - broke even on games and STILL lost ${-s.lpNet} LP. You genuinely have to try to do that.`);
  else out.push(`${wl}, ${lp}. Hours of queueing to go absolutely nowhere. A hamster wheel with a ranked emblem.`);
  out.push(`Averaged ${f1(s.k)}/${f1(s.d)}/${f1(s.a)} (${f1(s.kda)} KDA)${s.kda < 2 ? ' - that\'s not a ratio, that\'s a cry for help' : ''}, ${f1(s.csm)} CS/min and ${Math.round(s.kp)}% kill participation.`);
  if (ints.length) out.push(`${ints.length === 1 ? 'One game' : ints.length + ' games'} he flat-out inted: ${ints.map(g => `${g.k}/${g.d}/${g.a} ${g.champ ? g.champ.n : ''}`).join(', ')}. That's not jungling, that's running it down with extra steps. The enemy team should be splitting their LP with him.`);
  if (s.d >= 7) out.push(`${f1(s.d)} deaths a game - the grey screen gets more playtime than his champion. The death timer knows him by first name.`);
  else if (s.d >= 5) out.push(`${f1(s.d)} deaths a game. Not inting by definition, inting by vibes.`);
  if (s.csm < 6.5) out.push(`${f1(s.csm)} CS/min - the camps are respawning out of pity.`);
  if (s.kp < 50) out.push(`${Math.round(s.kp)}% kill participation - his team was fighting 4v5 while he was having a picnic at raptors.`);
  if (worst && worst !== best && !worst.win) out.push(pickOne([`Low point: ${worst.k}/${worst.d}/${worst.a} on ${worst.champ ? worst.champ.n : '?'}. Delete the replay. Delete the account. Start again.`, `Low point: ${worst.k}/${worst.d}/${worst.a} on ${worst.champ ? worst.champ.n : '?'}. The enemy team is still laughing about it in their Discord.`]));
  if (best && (best.k + best.a) / Math.max(1, best.d) >= 4) out.push(`Best game: ${best.k}/${best.d}/${best.a} on ${best.champ ? best.champ.n : '?'} - proof he CAN play, which makes the rest of it even worse.`);
  else if (s.wins > s.losses && s.d < 4) out.push('Annoyingly decent. Don\'t get used to it.');
  // what to fix
  const fixes = [];
  if (s.d >= 5 || ints.length) fixes.push(`Stop dying: ${f1(s.d)} deaths a game is too many - ward before face-checking, track the enemy jungler, and back off when your summoners are down.`);
  if (s.csm < 7) fixes.push(`Farm more: ${f1(s.csm)} CS/min - clear camps between fights instead of hovering lanes that aren't going to give anything.`);
  if (s.kp < 55) fixes.push(`Join the fights: ${Math.round(s.kp)}% kill participation - path towards the side of the map that's actually playing and be there for objectives.`);
  const lan = games.filter(g => g.laning).map(g => g.laning[0]);
  if (lan.length && lan.reduce((a, b) => a + b, 0) / lan.length < 50) fixes.push(`Win the early game: losing laning phase on average (${Math.round(lan.reduce((a, b) => a + b, 0) / lan.length)}:${100 - Math.round(lan.reduce((a, b) => a + b, 0) / lan.length)}) - plan the first clear and look for an early gank on the winning lane.`);
  const champs = new Set(games.map(g => g.champ && g.champ.n));
  if (champs.size >= 4 && games.length <= 6) fixes.push(`Pick a lane - and a champion: ${champs.size} different champions in ${games.length} games. Stick to 2-3 picks and actually master them.`);
  if (s.losses >= 3 && s.losses > s.wins) fixes.push(`Know when to stop: ${s.losses} losses in a day - two losses in a row means log off, not "one more".`);
  while (fixes.length < 3) fixes.push(['Review one loss a day - find the single fight that lost the game and what he should have done instead.', 'Track objective timers - set up vision 1 minute before dragon/herald/baron spawn instead of arriving as it dies.', 'Stop coin-flipping fights - his wins came from playing with his team, his losses from trying to 1v9 like he\'s a streamer.'][fixes.length % 3]);
  return { roast: out.join(' '), fixes: fixes.slice(0, 3) };
}
