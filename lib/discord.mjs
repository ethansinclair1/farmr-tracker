import fs from 'fs';
import path from 'path';

// One Discord message per new ranked solo/duo game: an op.gg-style embed, the op.gg screenshot of that game, and the roast.
export async function postGame(webhook, { cfg, g, rank, shotFile, pageUrl }) {
  const color = g.remake ? 0x7b7a8e : g.win ? 0x5383e8 : 0xe84057;
  const title = `${g.remake ? 'REMAKE' : g.win ? 'VICTORY' : 'DEFEAT'} · ${g.champ ? g.champ.n : '?'} ${g.k}/${g.d}/${g.a}`;
  const fields = [
    { name: 'KDA', value: `${g.kda === 'Perfect' ? 'Perfect' : g.kda + ':1'}`, inline: true },
    { name: 'CS', value: `${g.cs} (${g.csm}/min)`, inline: true },
    { name: 'Kill participation', value: `${g.kp}%`, inline: true },
    { name: 'Length', value: g.duration || '?', inline: true },
    { name: 'LP', value: g.lp == null ? '—' : `${g.lp >= 0 ? '+' : ''}${g.lp}`, inline: true },
    { name: 'Rank now', value: rank || '—', inline: true },
  ];
  if (g.items && g.items.length) fields.push({ name: 'Build', value: g.items.filter(i => !/Ward|Lens|Quest Reward|Farsight/.test(i.n)).map(i => i.n).join(' · ').slice(0, 1000) || '—', inline: false });
  const embed = {
    author: { name: `${cfg.gameName}#${cfg.tagLine} · Ranked Solo/Duo`, url: `https://op.gg/lol/summoners/${cfg.region}/${encodeURIComponent(cfg.gameName)}-${encodeURIComponent(cfg.tagLine)}` },
    title, url: pageUrl || undefined, color,
    thumbnail: g.champ ? { url: g.champ.u } : undefined,
    description: `**🤖 ${g.roast || ''}**`,
    fields,
    footer: { text: `${g.date || ''}${g.avgTier ? ' · avg rank ' + g.avgTier : ''}` },
  };
  const form = new FormData();
  if (shotFile && fs.existsSync(shotFile)) {
    const name = path.basename(shotFile);
    embed.image = { url: `attachment://${name}` };
    form.append('files[0]', new Blob([fs.readFileSync(shotFile)], { type: 'image/jpeg' }), name);
  }
  form.append('payload_json', JSON.stringify({ username: 'op.gg tracker', embeds: [embed] }));
  const r = await fetch(webhook, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Discord ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

export async function postText(webhook, content) {
  const r = await fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'op.gg tracker', content }) });
  if (!r.ok) throw new Error(`Discord ${r.status}: ${(await r.text()).slice(0, 300)}`);
}
