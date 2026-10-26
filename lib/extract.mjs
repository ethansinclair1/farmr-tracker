// Runs INSIDE the op.gg page (page.evaluate). Reads the profile header and every match row exactly as op.gg shows them.
// (Tested against the live op.gg summoner page, Oct 2026.)
export function extractInPage() {
  const body = document.body.innerText;
  const rows = [...document.querySelectorAll('div[class*="border-l-[6px]"]')].filter(r => /Show More Detail Games/.test(r.innerText));
  const games = rows.map((r, idx) => {
    const text = r.innerText.split('\n').map(s => s.trim()).filter(Boolean);
    const q = r.querySelector('span.break-keep');
    const when = r.querySelector('span[data-tooltip-content]');
    const imgs = [...r.querySelectorAll('img')];
    const pick = re => imgs.filter(i => re.test(i.src)).map(i => ({ n: i.alt, u: i.src.split('?')[0] }));
    const champs = pick(/\/champion\//);
    const links = [...r.querySelectorAll('a[href*="/lol/summoners/"]')].filter(a => a.innerText.trim());
    const names = links.map(a => a.innerText.trim());
    const lvl = r.querySelector('a[href^="/lol/champions/"] span');
    const res = r.querySelector('strong');
    return {
      idx,
      queue: q ? q.innerText.trim() : '',
      date: when ? when.getAttribute('data-tooltip-content') : '',
      ago: when ? when.innerText.trim() : '',
      result: res ? res.innerText.trim() : '',
      champ: champs[0] || null,
      level: lvl ? lvl.innerText.trim() : '',
      items: pick(/\/item\//),
      spells: pick(/\/spell\//),
      runes: pick(/\/perk/),
      players: names.map((n, i) => ({ n, h: links[i].getAttribute('href'), c: champs[i + 1] ? champs[i + 1].n : '', u: champs[i + 1] ? champs[i + 1].u : '' })),
      text,
    };
  });
  const solo = body.match(/Ranked Solo\/Duo\s*\n\s*([A-Za-z]+(?: [1-4IV]+)?)\s*\n\s*([\d,]+) LP\s*\n\s*(\d+)W (\d+)L/);
  const flex = body.match(/Ranked Flex\s*\n\s*([A-Za-z]+(?: [1-4IV]+)?)\s*\n\s*([\d,]+) LP\s*\n\s*(\d+)W (\d+)L/);
  const ladder = body.match(/Ladder Rank\s*([\d,]+)\s*\(([\d.]+)% of top\)/);
  const icon = document.querySelector('img[src*="profile_icons"]');
  let lvlEl = null, el = icon;
  for (let i = 0; i < 3 && el && !lvlEl; i++) { el = el.parentElement; if (el) lvlEl = [...el.querySelectorAll('span,div')].find(e => e.children.length === 0 && /^\d{1,4}$/.test((e.innerText || '').trim())); }
  return {
    profile: {
      solo: solo ? { tier: solo[1], lp: +solo[2].replace(/,/g, ''), wins: +solo[3], losses: +solo[4] } : null,
      flex: flex ? { tier: flex[1], lp: +flex[2].replace(/,/g, ''), wins: +flex[3], losses: +flex[4] } : null,
      ladderRank: ladder ? ladder[1] : '',
      ladderPct: ladder ? ladder[2] : '',
      icon: icon ? icon.src.split('?')[0] : '',
      level: lvlEl ? lvlEl.innerText : '',
    },
    games,
  };
}

// Opens op.gg's "Show More Detail Games" panel for row i and reads both teams (OP Score, damage, wards) and objectives.
export async function extractDetail(i) {
  const rows = [...document.querySelectorAll('div[class*="border-l-[6px]"]')].filter(r => /More Detail Games/.test(r.innerText));
  const row = rows[i]; if (!row) return null;
  const box = row.parentElement;
  if (box.querySelectorAll('table').length < 2) {
    const btns = [...row.querySelectorAll('button')];
    const btn = btns.find(b => /Show More Detail/.test((b.innerText || '') + (b.getAttribute('aria-label') || ''))) || btns.pop();
    if (!btn) return null;
    btn.click();
    for (let t = 0; t < 30 && box.querySelectorAll('table').length < 2; t++) await new Promise(r => setTimeout(r, 150));
  }
  const tables = [...box.querySelectorAll('table')]; if (tables.length < 2) return null;
  const num = s => +(String(s || '').replace(/[^\d.]/g, '')) || 0;
  const teams = tables.slice(0, 2).map(t => {
    const ht = (t.querySelector('thead th') || {}).innerText || '';
    const players = [...t.querySelectorAll('tbody tr')].map(tr => {
      const td = tr.querySelectorAll('td'); const a = tr.querySelector('a[href*="/lol/summoners/"]');
      const dmg = tr.querySelector('[data-tooltip-content^="Damage dealt"]'), tk = tr.querySelector('[data-tooltip-content^="Damage taken"]');
      const ops = td[1] ? td[1].innerText.split('\n').map(x => x.trim()).filter(Boolean) : [];
      const w = td[4] ? td[4].innerText.split('\n').map(x => x.trim()).filter(Boolean) : [];
      return { n: a ? a.innerText.trim() : '', h: a ? a.getAttribute('href') : '', op: +ops[0] || 0, opr: ops[1] || '',
        dmg: dmg ? num(dmg.getAttribute('data-tooltip-content')) : 0, taken: tk ? num(tk.getAttribute('data-tooltip-content')) : 0, cw: +w[0] || 0, wards: w[1] || '' };
    }).filter(p => p.n);
    return { win: /Victory/.test(ht), side: /Blue/.test(ht) ? 'blue' : 'red', players };
  });
  const obj = [...box.querySelectorAll('ul')].filter(u => u.querySelector('li[data-tooltip-content="Baron"]')).slice(0, 2)
    .map(u => Object.fromEntries([...u.querySelectorAll('li[data-tooltip-content]')].map(li => [li.getAttribute('data-tooltip-content'), +li.innerText.trim() || 0])));
  return { teams, obj };
}

// op.gg's "Live game" tab: returns null when he isn't in a game.
export function extractLive() {
  const tables = [...document.querySelectorAll('table')];
  const timer = [...document.querySelectorAll('span[data-tooltip-content]')].find(e => /^\d+:\d\d$/.test(e.textContent.trim()));
  if (tables.length < 2 || !timer) return null;
  const main = (document.querySelector('main') || document.body).innerText;
  const q = main.match(/\n(Ranked Solo\/Duo|Ranked Flex|Normal[^\n]*|Swiftplay|ARAM[^\n]*|Quickplay|Custom[^\n]*|Arena)\nLive\n([^\n]*)\n/);
  const teams = tables.slice(0, 2).map(t => {
    const bans = [];
    const players = [...t.querySelectorAll('tbody tr')].map(tr => {
      const a = tr.querySelector('a[href*="/lol/summoners/"]');
      const imgs = [...tr.querySelectorAll('img')];
      const cn = i => decodeURIComponent(i.src.split('?')[0].split('/').pop().replace('.png', ''));
      const ch = imgs.filter(i => /\/champion\//.test(i.src));
      if (!a && !ch.length) return null;
      ch.slice(1).forEach(i => bans.push({ n: cn(i), u: i.src.split('?')[0] }));
      const tier = imgs.find(i => /medals_mini/.test(i.src));
      const txt = tr.innerText.replace(/\s+/g, ' ');
      const href = a ? a.getAttribute('href') : '';
      const nt = a ? decodeURIComponent(href.split('/').pop()) : (txt.trim().split(' ').slice(0, 2).join(' ') || 'Hidden'); const k = a ? nt.lastIndexOf('-') : -1;
      return { n: k > 0 ? nt.slice(0, k) : nt, tag: k > 0 ? nt.slice(k + 1) : '', h: href, champ: ch[0] ? { n: cn(ch[0]), u: ch[0].src.split('?')[0] } : null,
        spells: imgs.filter(i => /\/spell\//.test(i.src)).map(i => ({ n: i.alt, u: i.src.split('?')[0] })),
        runes: imgs.filter(i => /\/perk/.test(i.src)).map(i => ({ n: i.alt, u: i.src.split('?')[0] })),
        tier: tier ? tier.alt : '', played: (txt.match(/(\d+) Played/) || [])[1] || '', wr: (txt.match(/Played (\d+)%/) || [])[1] || '', kda: (txt.match(/([\d.]+):1 KDA/) || [])[1] || '' };
    }).filter(Boolean);
    return { players, bans };
  });
  const [m, s] = timer.textContent.trim().split(':').map(Number);
  return { queue: q ? q[1] : '', map: q ? q[2] : '', elapsed: m * 60 + s, started: timer.getAttribute('data-tooltip-content'), teams };
}

const TIERS = /^(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)\b/;

// Turns op.gg's raw text tokens for one row into numbers.
export function parseGame(g, me) {
  const t = g.text || [];
  const durIdx = t.findIndex(s => /^\d+m \d+s$/.test(s));
  const dur = durIdx >= 0 ? t[durIdx] : '';
  const [mm, ss] = dur ? dur.replace('s', '').split('m ').map(Number) : [0, 0];
  const minutes = mm + ss / 60;
  const slash = t.indexOf('/');
  const k = slash > 0 ? +t[slash - 1] : 0, d = slash > 0 ? +t[slash + 1] : 0, a = slash > 0 ? +t[slash + 3] : 0;
  const kdaTok = t.find(s => /KDA$/.test(s)) || '';
  const kda = /Perfect/i.test(kdaTok) ? 'Perfect' : (kdaTok.match(/([\d.]+):1/) || [])[1] || '';
  const kpTok = t.find(s => /^P\/Kill/.test(s)) || '';
  const kp = +((kpTok.match(/(\d+)%/) || [])[1] || 0);
  const csTok = t.find(s => /^CS \d+/.test(s)) || '';
  const cs = +((csTok.match(/CS (\d+)/) || [])[1] || 0), csm = +((csTok.match(/\(([\d.]+)\)/) || [])[1] || 0);
  const lanIdx = t.findIndex(s => /^Laning \d+/.test(s));
  const laning = lanIdx >= 0 ? [+t[lanIdx].replace('Laning ', ''), +t[lanIdx + 2]] : null;
  const tier = [...t].reverse().find(s => TIERS.test(s)) || '';
  // ranked games show the LP gained/lost as a bare number between the result and the length
  let lp = null;
  const resIdx = t.indexOf(g.result);
  if (resIdx >= 0 && durIdx > resIdx + 1 && /^\d{1,3}$/.test(t[resIdx + 1])) lp = (g.result === 'Victory' ? 1 : -1) * +t[resIdx + 1];
  const win = g.result === 'Victory', remake = /Remake/i.test(g.result);
  const id = [g.queue, g.date, g.champ && g.champ.n, dur].join('|');
  const meIdx = g.players.findIndex(p => p.n.toLowerCase() === me.toLowerCase());
  const team = meIdx >= 0 ? (meIdx < 5 ? 0 : 1) : -1;
  return {
    id, queue: g.queue, date: g.date, result: g.result, win, remake, champ: g.champ, level: +g.level || 0,
    duration: dur, minutes, k, d, a, kda, kp, cs, csm, laning, avgTier: tier, lp,
    items: g.items, spells: g.spells, runes: g.runes, players: g.players, team,
  };
}

// "10/26/2026, 8:11 PM" -> Date (in the browser's timezone, which the scraper sets)
export function parseOpDate(s) {
  const m = (s || '').match(/(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)\s*(AM|PM)/);
  if (!m) return null;
  let h = +m[4] % 12; if (m[6] === 'PM') h += 12;
  return { y: +m[3], mo: +m[1], d: +m[2], h, mi: +m[5] };
}
