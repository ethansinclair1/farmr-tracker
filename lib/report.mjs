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
        ? `You write the post-game verdict for a Discord channel that tracks a friend's League of Legends ranked solo/duo games on op.gg. Player: ${cfg.gameName}#${cfg.tagLine} (${ctx.rank}). Game: ${JSON.stringify(ctx.game)}.\nWrite 2-3 punchy sentences. If the game was bad (loss, many deaths, low CS/min for their role, low kill participation, feeding), roast them hard but playfully - no slurs, nothing about real-life traits. If it was genuinely good, give grudging credit with a small jab. Reference the actual numbers. No hashtags, no emojis spam (max 1).`
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
