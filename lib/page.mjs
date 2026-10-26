import fs from 'fs';
import { f1, analyse, eloShame } from './report.mjs';
import { parseOpDate } from './extract.mjs';

const CSS = fs.readFileSync(new URL('./page.css', import.meta.url), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EMBLEM = t => `https://opgg-static.akamaized.net/images/medals_new/${String(t || 'unranked').split(' ')[0].toLowerCase()}.png`;
const opLink = (p, region) => p.h ? `https://op.gg${p.h}` : `https://op.gg/multisearch/${region}?summoners=${encodeURIComponent(p.n)}`;
// real TheBurntPeanut lines (from his clips, Wikipedia and Dexerto) - add more here and they join the rotation
const BP_QUOTES = [
  'My goopa, my goopa!',
  "That's a real goopa right there!",
  'Goop!',
  'Let them cook.',
  'I declare sweeping victory for the Bungulators.',
  'The peanut avatar already is my real face.',
  "If it's war with the Bungulators you want, then it's war you'll get.",
  'But little do they know, the Bungulators in the north are on the rise.',
  'Will you join us?',
  "It's not my community.",
  "I'm a PTuber.",
  'Losers.',
];
const sign = n => `${n >= 0 ? '+' : ''}${n}`;

function gameRow(g, cfg, myTier) {
  const me = cfg.gameName;
  const cls = g.remake ? 'remake' : g.win ? 'win' : 'loss';
  const items = [...g.items];
  const ward = items.findIndex(i => /Ward|Lens|Farsight/.test(i.n));
  const trinket = ward >= 0 ? items.splice(ward, 1)[0] : null;
  const role = items.filter(i => /Quest Reward/.test(i.n));
  const main = items.filter(i => !/Quest Reward/.test(i.n)).slice(0, 6);
  while (main.length < 6) main.push(null);
  const img = (o, c = '') => o ? `<img class="${c}" src="${esc(o.u)}" alt="${esc(o.n)}" title="${esc(o.n)}" loading="lazy">` : `<span class="${c} empty"></span>`;
  // player links: the row's own link, else the detail panel's, else an op.gg search
  const dPlayers = g.detail ? g.detail.teams.flatMap(t => t.players) : [];
  const href = p => p.h ? p : (dPlayers.find(d => d.n === p.n) || p);
  const team = side => g.players.slice(side * 5, side * 5 + 5).map(p => `<li class="${p.n.toLowerCase() === me.toLowerCase() ? 'me' : ''}"><a href="${esc(opLink(href(p), cfg.region))}" target="_blank" rel="noopener">${p.u ? `<img src="${esc(p.u)}" alt="">` : ''}<span>${esc(p.n)}</span></a></li>`).join('');
  const kdaCls = g.kda === 'Perfect' || +g.kda >= 5 ? 'gold' : +g.kda >= 3 ? 'blue' : '';
  const an = analyse(g, myTier);
  return `
  <div class="game ${cls}" data-queue="${esc(g.queue)}">
    <div class="g-meta">
      <b class="q">${esc(g.queue.replace('Ranked ', ''))}</b>
      <span class="ago" data-ts="${g.ts || 0}">${esc(g.date)}</span>
      <i class="bar"></i>
      <b class="res">${g.remake ? 'Remake' : g.win ? 'Victory' : 'Defeat'}</b>
      <span>${esc(g.duration)}</span>
    </div>
    <div class="g-main">
      <div class="g-top">
        <div class="champ">${img(g.champ, 'cimg')}<em>${g.level || ''}</em></div>
        <div class="col2">${img(g.spells[0], 'sq')}${img(g.spells[1], 'sq')}</div>
        <div class="col2">${img(g.runes[0], 'rd')}${img(g.runes[1], 'rd')}</div>
        <div class="kda"><div class="k">${g.k} <i>/</i> <span class="dd">${g.d}</span> <i>/</i> ${g.a}</div><div class="ratio ${kdaCls}">${g.kda === 'Perfect' ? 'Perfect' : g.kda + ':1'} KDA</div></div>
        <div class="extra">
          <div class="kp">P/Kill ${g.kp}%</div>
          <div>CS ${g.cs} (${g.csm})</div>
          <div class="tier">${esc(g.avgTier)}</div>
          ${g.lp != null ? `<div class="lp ${g.lp >= 0 ? 'up' : 'down'}">${sign(g.lp)} LP</div>` : ''}
        </div>
      </div>
      <div class="items">${main.map(i => img(i, 'it')).join('')}${img(trinket, 'it rd')}${role.length ? img(role[0], 'it') : ''}
        ${g.laning ? `<span class="laning">Laning ${g.laning[0]} : ${g.laning[1]}</span>` : ''}</div>
      <button class="abtn" type="button">Analysis ▾</button>
      <div class="ana"><div class="v">${esc(an.verdict)}</div><ul>${an.points.map(p => `<li class="${typeof p.ok === 'string' ? p.ok : p.ok === true ? 'ok' : p.ok === false ? 'bad' : 'mid'}">${esc(p.t)}</li>`).join('')}</ul>
        ${g.shot ? `<a class="shotl" href="shots/${esc(g.shot)}" target="_blank">📸 op.gg screenshot</a>` : ''}</div>
    </div>
    <div class="teams"><ul>${team(0)}</ul><ul>${team(1)}</ul></div>
  </div>`;
}

function liveBox(live, cfg) {
  if (!live || !live.teams) return '';
  const startTs = Date.parse(live.at) - live.elapsed * 1000;
  const all = live.teams.flatMap(t => t.players);
  const me = all.find(p => /fullcleardeluxe/i.test(p.n));
  const side = (t, i) => `<div class="lteam ${i ? 'red' : 'blue'}">${t.players.map(p => {
    const inner = `${p.champ ? `<img src="${esc(p.champ.u)}" alt="">` : ''}<span class="${me === p ? 'mine' : ''}">${esc(p.champ ? p.champ.n : '?')} · ${esc(p.n)}</span><small>${esc(p.tier)}${p.wr ? ` · ${p.wr}% WR` : ''}</small>`;
    return p.h ? `<a href="https://op.gg${esc(p.h)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="lp_">${inner}</div>`;
  }).join('')}${t.bans.length ? `<div class="bans">Bans ${t.bans.map(b => `<img src="${esc(b.u)}" alt="${esc(b.n)}" title="${esc(b.n)}">`).join('')}</div>` : ''}</div>`;
  return `<div class="live" id="live" data-start="${startTs}">
  <div class="lh"><span class="dot"></span><h3>Live now</h3><span class="lq">${esc(live.queue)} · ${esc(live.map)}</span><span class="lt" id="ltimer"></span></div>
  ${me && me.champ ? `<div class="lme"><img src="${esc(me.champ.u)}" alt=""><div><b>Chenny is on ${esc(me.champ.n)}</b><br><span class="lq">Pray for his team.</span></div></div>` : ''}
  <div class="lteams">${live.teams.map(side).join('')}</div>
  <div style="margin-top:8px"><a href="https://op.gg/lol/summoners/${cfg.region}/${encodeURIComponent(cfg.gameName)}-${encodeURIComponent(cfg.tagLine)}/ingame" target="_blank" style="color:#ffc4cd">Open the live game on op.gg ↗</a></div>
</div>`;
}

export function buildPage({ cfg, profile, games, recent, report, live, callouts = [], matchups = [], build = '', updatedAt }) {
  const tz = cfg.timezone;
  const solo = profile.solo || {};
  const sTot = (solo.wins || 0) + (solo.losses || 0);
  const sWr = sTot ? Math.round(solo.wins / sTot * 100) : 0;
  const pct = recent.wr;
  const champRows = recent.champs.slice(0, 6).map(c => `
    <li><img src="${esc(c.img)}" alt=""><div><b>${esc(c.name)}</b><span>${f1(c.k / c.games)} / ${f1(c.d / c.games)} / ${f1(c.a / c.games)}</span></div>
    <div class="cr"><b class="${c.wins / c.games >= 0.6 ? 'red' : ''}">${Math.round(c.wins / c.games * 100)}%</b><span>${c.games}G · ${f1(c.mins > 0 ? c.cs / c.mins : 0)} CS/m</span></div></li>`).join('');
  const opUrl = `https://op.gg/lol/summoners/${cfg.region}/${encodeURIComponent(cfg.gameName)}-${encodeURIComponent(cfg.tagLine)}`;
  // ranked games of the last 14 days, grouped by day (op.gg-style list)
  const byDay = [];
  for (const g of games) {
    const d = parseOpDate(g.date); const key = d ? `${d.y}-${d.mo}-${d.d}` : '?';
    let grp = byDay[byDay.length - 1];
    if (!grp || grp.key !== key) byDay.push(grp = { key, label: d ? new Date(Date.UTC(d.y, d.mo - 1, d.d, 12)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '', games: [] });
    grp.games.push(g);
  }
  const dayHead = grp => {
    const s = grp.games.filter(g => g.queue === cfg.trackQueue && !g.remake);
    const w = s.filter(g => g.win).length, lp = s.reduce((t, g) => t + (g.lp || 0), 0);
    return `<div class="dayh"><b>${esc(grp.label)}</b>${s.length ? `<span>Solo/Duo ${w}W ${s.length - w}L</span><span class="${lp >= 0 ? 'up' : 'down'}">${sign(lp)} LP</span>` : ''}</div>`;
  };
  const lpToday = recent.lpNet;
  // top of the AI overview: elo shame for today's solo/duo losses first, then champion-tier matchups
  const todaySolo = games.filter(g => g.queue === cfg.trackQueue && g.ts && new Date(g.ts).toLocaleDateString('en-CA', { timeZone: cfg.timezone }) === new Date(updatedAt).toLocaleDateString('en-CA', { timeZone: cfg.timezone }));
  const shame = todaySolo.map(g => eloShame(g, solo.tier)).filter(Boolean).map(text => ({ text, win: false }));
  const tops = [...shame, ...matchups].slice(0, 4);
  // EmeraldFinalBoss / Wyatt lines blend into the overview text (no labels)
  const extra = callouts.slice(0, 2).map(c => c.text).join(' ');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chenny LoL Tracker</title>
<meta property="og:title" content="Chenny LoL Tracker - ${esc(solo.tier || '')} ${solo.lp != null ? solo.lp + ' LP' : ''} (${sign(lpToday)} LP today)">
<meta property="og:description" content="${esc((report ? report.roast : '').slice(0, 180))}">
<meta name="build" content="${esc(build)}">
<style>${CSS}</style></head><body><div class="wrap">
<div class="vol" title="Music volume"><span id="volic">🔊</span><input type="range" id="vol" min="0" max="100" value="50" aria-label="Music volume"></div>
<audio id="song" loop preload="auto" playsinline><source src="goopa.ogg" type="audio/ogg"><source src="goopa.mp3" type="audio/mpeg"><source src="goopa.mp4" type="video/mp4"></audio>

<header class="hero">
  <img class="pn pn1" src="peanut1.png" alt="">
  <div class="htxt"><div class="logo">Chenny LoL Tracker</div>
    <div class="who">${esc(cfg.gameName)}#${esc(cfg.tagLine)} · NA · <a href="${esc(opUrl)}" target="_blank">op.gg ↗</a></div>
    <div class="date"><b id="today"></b><span>Updated <span class="ago" data-iso="${esc(updatedAt)}"></span> · checks every 5 min</span></div></div>
  <img class="pn pn2" src="peanut2.png" alt="">
</header>

${liveBox(live, cfg)}

<div class="card prof">
  <div class="icon">${profile.icon ? `<img src="${esc(profile.icon)}" alt="">` : ''}${profile.level ? `<em>${esc(profile.level)}</em>` : ''}</div>
  <div><h1><a href="${esc(opUrl)}" target="_blank" style="text-decoration:none">${esc(cfg.gameName)} <span>#${esc(cfg.tagLine)}</span></a></h1>
  <div class="sub">${esc(cfg.region.toUpperCase())}${profile.ladderRank ? ` · Ladder Rank <b>${esc(profile.ladderRank)}</b> (${esc(profile.ladderPct)}% of top)` : ''}</div></div>
  <div class="pq"><span>🥜 BP quote of the day</span><q id="bpq"></q></div>
  <div class="lpday ${lpToday > 0 ? 'up' : lpToday < 0 ? 'down' : ''}"><b>${sign(lpToday)} LP</b><span>today · ${recent.wins}W ${recent.losses}L</span></div>
</div>

<div class="grid">
  <div>
    <div class="card"><h2>Ranked Solo/Duo</h2>
      <div class="rank"><img src="${esc(EMBLEM(solo.tier))}" alt=""><div><div class="t">${esc(solo.tier || 'Unranked')}</div><div class="lp">${solo.lp != null ? solo.lp + ' LP' : ''}</div></div>
      <div class="wl">${solo.wins || 0}W ${solo.losses || 0}L<br>Win rate ${sWr}%</div></div>
    </div>
    <div class="card"><h2>Champions · today</h2><ul class="champs">${champRows || '<li><span>No solo/duo games yet today</span></li>'}</ul></div>
  </div>
  <div>
    <div class="card"><h2>Ranked Solo/Duo · today</h2>
      ${recent.games ? `<div class="summ">
        <div class="donut" style="--p:${pct}"><b>${pct}%</b></div>
        <div><div class="s2">${recent.games}G ${recent.wins}W ${recent.losses}L</div>
          <div class="big">${f1(recent.k)} <i>/</i> <span class="dd">${f1(recent.d)}</span> <i>/</i> ${f1(recent.a)}</div>
          <div class="s2"><b>${f1(recent.kda)}:1</b> KDA · P/Kill ${Math.round(recent.kp)}%</div></div>
        <div class="stat"><div>Avg CS<b>${Math.round(recent.cs)}</b></div><div>CS/min<b>${f1(recent.csm)}</b></div><div>Avg length<b>${Math.round(recent.mins)}m</b></div><div>LP<b class="${recent.lpNet >= 0 ? '' : 'red'}">${sign(recent.lpNet)}</b></div></div>
      </div>` : '<p class="s2" style="color:var(--mut);margin:0">No ranked solo/duo games yet today.</p>'}
    </div>
    <div class="card ai" id="ai"><h2>Ranked Solo/Duo AI Overview · today</h2>
      ${tops.length ? `<ul class="mups">${tops.map(m => `<li class="${m.win ? 'w' : 'l'}">${esc(m.text)}</li>`).join('')}</ul>` : ''}
      ${report || extra ? `<p>${esc([report ? report.roast : '', extra].filter(Boolean).join(' '))}</p>` : (tops.length ? '' : `<p>No ranked games yet today. Either touching grass or too scared to queue.</p>`)}
      ${report ? `<div class="tips"><b>Tips</b><ol>${(report.fixes || []).map(f => `<li>${esc(f)}</li>`).join('')}</ol></div>` : ''}
    </div>
  </div>
</div>

<div class="tabs"><button class="on" data-f="Ranked Solo/Duo">Solo/Duo</button><button data-f="Ranked Flex">Flex</button><button data-f="Ranked 5s">5s</button><button data-f="">All</button><span style="margin-left:auto;color:var(--mut);align-self:center">Last 14 days</span></div>
<div id="list">${byDay.map(grp => `<section class="dgrp">${dayHead(grp)}${grp.games.map(g => gameRow(g, cfg, solo.tier)).join('')}</section>`).join('')}</div>
<div class="none" id="none" ${games.length ? 'hidden' : ''}>No games in the last 14 days.</div>
<footer>Data from op.gg. Not endorsed by Riot Games or OP.GG.</footer>
</div>
<script>
const TZ=${JSON.stringify(tz)};const now=new Date();
document.getElementById('today').textContent=now.toLocaleDateString('en-US',{timeZone:TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'});
function ago(d){const s=(Date.now()-d)/1000;if(s<60)return'just now';const m=s/60;if(m<60)return Math.round(m)+' minute'+(Math.round(m)==1?'':'s')+' ago';const h=m/60;if(h<24)return Math.round(h)+' hour'+(Math.round(h)==1?'':'s')+' ago';const dd=Math.round(h/24);return dd+' day'+(dd==1?'':'s')+' ago';}
function stamp(){document.querySelectorAll('.ago').forEach(e=>{const d=e.dataset.iso?new Date(e.dataset.iso):(+e.dataset.ts?new Date(+e.dataset.ts):null);if(d&&!isNaN(d)){e.title=d.toLocaleString('en-US',{timeZone:TZ});e.textContent=ago(d);}});}stamp();setInterval(stamp,60000);
// tabs
// BP quote of the day: same quote for everyone all day (Toronto date), cycles through the list
const BPQ=${JSON.stringify(BP_QUOTES)};
(()=>{const d=new Date(new Date().toLocaleString('en-US',{timeZone:TZ}));const n=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);document.getElementById('bpq').textContent=BPQ[n%BPQ.length];})();
const btns=document.querySelectorAll('.tabs button');
function show(f){btns.forEach(b=>b.classList.toggle('on',b.dataset.f===f));let n=0;document.querySelectorAll('.dgrp').forEach(s=>{let k=0;s.querySelectorAll('.game').forEach(g=>{const ok=!f||g.dataset.queue===f;g.style.display=ok?'':'none';if(ok)k++;});s.style.display=k?'':'none';n+=k;});document.getElementById('none').hidden=n>0;}
btns.forEach(b=>b.onclick=()=>show(b.dataset.f));show('Ranked Solo/Duo');
// analysis buttons
document.querySelectorAll('.abtn').forEach(b=>b.onclick=()=>{const g=b.closest('.game');g.classList.toggle('open');b.textContent=g.classList.contains('open')?'Analysis ▴':'Analysis ▾';});
// live game timer (hidden once the game must be over)
const lv=document.getElementById('live');
if(lv){const st=+lv.dataset.start;const tick=()=>{const s=Math.floor((Date.now()-st)/1000);if(s>80*60){lv.remove();return;}document.getElementById('ltimer').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};tick();setInterval(tick,1000);}
// pick up new games without a manual refresh
const BUILD=${JSON.stringify(build)};
setInterval(()=>{if(document.hidden)return;fetch(location.pathname+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.text()).then(t=>{const m=t.match(/<meta name="build" content="([^"]*)"/);if(m&&m[1]!==BUILD)location.reload();}).catch(()=>{});},120000);
// background music: goopa.mp4 on loop with just a volume slider (browsers only allow sound after the first click/tap)
const vol=document.getElementById('vol'),volic=document.getElementById('volic'),song=document.getElementById('song');
try{const v=localStorage.getItem('chenny_vol');if(v!==null)vol.value=v;}catch(e){}
function applyVol(){const v=+vol.value;volic.textContent=v==0?'🔇':v<50?'🔉':'🔊';song.volume=v/100;song.muted=v==0;if(v>0&&song.paused)song.play().catch(()=>{});}
vol.oninput=()=>{applyVol();try{localStorage.setItem('chenny_vol',vol.value);}catch(e){}};
song.addEventListener('ended',()=>{song.currentTime=0;song.play().catch(()=>{});});
applyVol();
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,()=>{if(+vol.value>0&&song.paused)song.play().catch(()=>{});}));
// inside Discord (the Activity), everything must go through Discord's proxy: op.gg images via /.proxy/opgg, links via the SDK
const IN_DISCORD=location.hostname.endsWith('.discordsays.com');
if(IN_DISCORD){
  const fix=el=>{const s=el.getAttribute('src');if(s&&s.startsWith('https://opgg-static.akamaized.net/'))el.setAttribute('src','/.proxy/opgg/'+s.slice(34));};
  document.querySelectorAll('img').forEach(fix);
  const sd=document.createElement('script');sd.src='discord-sdk.js';sd.onload=async()=>{
    const sdk=new ChennyDiscord.DiscordSDK(${JSON.stringify(cfg.discordAppId || '')});
    try{await sdk.ready();}catch(e){console.log('discord ready failed',e);}
    document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a)return;const u=new URL(a.getAttribute('href'),location.href);if(u.origin===location.origin)return;e.preventDefault();sdk.commands.openExternalLink({url:u.href}).catch(()=>{});},true);
  };document.head.appendChild(sd);
}
</script></body></html>`;
}
