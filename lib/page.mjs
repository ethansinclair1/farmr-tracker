import { f1 } from './report.mjs';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EMBLEM = t => `https://opgg-static.akamaized.net/images/medals_new/${String(t || 'unranked').split(' ')[0].toLowerCase()}.png`;

function gameRow(g, me) {
  const cls = g.remake ? 'remake' : g.win ? 'win' : 'loss';
  const items = [...g.items];
  const ward = items.findIndex(i => /Ward|Lens|Farsight/.test(i.n));
  const trinket = ward >= 0 ? items.splice(ward, 1)[0] : null;
  const role = items.filter(i => /Quest Reward/.test(i.n));
  const main = items.filter(i => !/Quest Reward/.test(i.n)).slice(0, 6);
  while (main.length < 6) main.push(null);
  const img = (o, c = '') => o ? `<img class="${c}" src="${esc(o.u)}" alt="${esc(o.n)}" title="${esc(o.n)}" loading="lazy">` : `<span class="${c} empty"></span>`;
  const team = side => g.players.slice(side * 5, side * 5 + 5).map(p => `<li class="${p.n.toLowerCase() === me.toLowerCase() ? 'me' : ''}">${p.u ? `<img src="${esc(p.u)}" alt="">` : ''}<span>${esc(p.n)}</span></li>`).join('');
  const kdaCls = g.kda === 'Perfect' || +g.kda >= 5 ? 'gold' : +g.kda >= 3 ? 'blue' : '';
  return `
  <div class="game ${cls}" data-queue="${esc(g.queue)}" data-ts="${g.ts || 0}">
    <div class="g-meta">
      <b class="q">${esc(g.queue)}</b>
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
          ${g.lp != null ? `<div class="lp ${g.lp >= 0 ? 'up' : 'down'}">${g.lp >= 0 ? '+' : ''}${g.lp} LP</div>` : ''}
        </div>
      </div>
      <div class="items">${main.map(i => img(i, 'it')).join('')}${img(trinket, 'it rd')}${role.length ? img(role[0], 'it') : ''}
        ${g.laning ? `<span class="laning">Laning ${g.laning[0]} : ${g.laning[1]}</span>` : ''}</div>
      ${g.roast ? `<div class="g-roast">${esc(g.roast)}</div>` : ''}
    </div>
    <div class="teams"><ul>${team(0)}</ul><ul>${team(1)}</ul></div>
    ${g.shot ? `<a class="shot" href="shots/${esc(g.shot)}" target="_blank" title="op.gg screenshot">📸</a>` : ''}
  </div>`;
}

const reportHtml = (r, title) => !r ? '' : `<div class="dstats"><span><b>${r.wins}W ${r.losses}L</b></span><span><b>${f1(r.k)} / ${f1(r.d)} / ${f1(r.a)}</b> avg</span><span><b>${f1(r.csm)}</b> CS/min</span><span><b>${Math.round(r.kp)}%</b> KP</span><span><b>${r.lpNet >= 0 ? '+' : ''}${r.lpNet}</b> LP</span>${r.ints ? `<span class="int">${r.ints} int${r.ints > 1 ? 's' : ''}</span>` : ''}</div>
  <p>${esc(r.roast)}</p><div class="fix"><b>${title}</b><ol>${(r.fixes || []).map(f => `<li>${esc(f)}</li>`).join('')}</ol></div>`;

export function buildPage({ cfg, profile, games, recent, report, lastDay, days = [], updatedAt, cartoon = '' }) {
  const tz = cfg.timezone;
  const solo = profile.solo || {};
  const sTot = (solo.wins || 0) + (solo.losses || 0);
  const sWr = sTot ? Math.round(solo.wins / sTot * 100) : 0;
  const pct = recent.wr;
  const champRows = recent.champs.slice(0, 6).map(c => `
    <li><img src="${esc(c.img)}" alt=""><div><b>${esc(c.name)}</b><span>${f1(c.k / c.games)} / ${f1(c.d / c.games)} / ${f1(c.a / c.games)}</span></div>
    <div class="cr"><b class="${c.wins / c.games >= 0.6 ? 'red' : ''}">${Math.round(c.wins / c.games * 100)}%</b><span>${c.games}G · ${f1(c.mins > 0 ? c.cs / c.mins : 0)} CS/m</span></div></li>`).join('');
  const opUrl = `https://op.gg/lol/summoners/${cfg.region}/${encodeURIComponent(cfg.gameName)}-${encodeURIComponent(cfg.tagLine)}`;
  const desc = report ? report.roast : lastDay ? lastDay.roast : '';
  const aiBody = report ? reportHtml(report, 'What he needs to fix')
    : `<p>No ranked solo/duo games in the last 24 hours. Either he's touching grass or he's too scared to queue.</p>${lastDay ? `<p class="mut">Last time he played (${esc(lastDay.label)}):</p>${reportHtml(lastDay, 'What he still needs to fix')}` : ''}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chenny LoL Tracker</title>
<meta property="og:title" content="Chenny LoL Tracker - ${esc(solo.tier || '')} ${solo.lp != null ? solo.lp + ' LP' : ''}">
<meta property="og:description" content="${esc(desc.slice(0, 180))}">
<style>
:root{--bg:#1c1c1f;--card:#31313c;--card2:#282830;--line:#424254;--txt:#e3e3ea;--mut:#9e9eb1;--blue:#5383e8;--red:#e84057;--winbg:#28344e;--winb:#2f436e;--lossbg:#59343b;--lossb:#703c47;--gold:#ff8200;--teal:#00bba3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:13px/1.35 "Segoe UI",Roboto,Helvetica,Arial,sans-serif}
img{color:transparent;font-size:0}a{color:inherit}.wrap{max-width:1080px;margin:0 auto;padding:16px}
.card{background:var(--card);border-radius:6px;padding:16px;margin-bottom:10px}
.prof{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.prof .icon{position:relative}.prof .icon img{width:84px;height:84px;border-radius:18px}
.prof .icon em{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);background:#202d37;border-radius:10px;padding:1px 8px;font-style:normal;font-size:12px}
.prof h1{margin:0;font-size:24px}.prof h1 span{color:var(--mut);font-weight:400}.prof .sub{color:var(--mut);margin-top:4px}.prof .sub b{color:var(--blue)}
.grid{display:grid;grid-template-columns:330px 1fr;gap:10px}@media(max-width:820px){.grid{grid-template-columns:1fr}}
.rank{display:flex;align-items:center;gap:14px}.rank img{width:84px;height:84px;background:#1f1f25;border-radius:50%;padding:4px}
.rank .t{font-size:20px;font-weight:700}.rank .lp{color:var(--mut)}.rank .wl{margin-left:auto;text-align:right;color:var(--mut)}
h2{font-size:14px;margin:0 0 12px;color:var(--txt)}
.summ{display:flex;align-items:center;gap:22px;flex-wrap:wrap}.donut{--p:0;width:90px;height:90px;border-radius:50%;background:conic-gradient(var(--blue) calc(var(--p)*1%),var(--red) 0);display:grid;place-items:center}
.donut b{width:68px;height:68px;border-radius:50%;background:var(--card);display:grid;place-items:center;color:var(--blue);font-size:15px}
.summ .big{font-size:20px;font-weight:700}.summ .big i{color:var(--mut);font-style:normal;font-weight:400}.summ .big .dd{color:var(--red)}
.summ .s2{color:var(--mut)}.summ .s2 b{color:var(--txt);font-size:18px}.stat{display:grid;grid-template-columns:repeat(4,auto);gap:4px 22px;color:var(--mut)}.stat b{display:block;color:var(--txt);font-size:16px}
.champs{list-style:none;margin:0;padding:0}.champs li{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--line)}.champs li:first-child{border:0}
.champs img{width:32px;height:32px;border-radius:50%}.champs div{display:flex;flex-direction:column}.champs span{color:var(--mut);font-size:12px}.champs .cr{margin-left:auto;text-align:right}.red{color:var(--red)}
.ai{border-left:4px solid var(--gold);background:linear-gradient(90deg,#3a2f22,var(--card) 40%)}.ai h2{color:var(--gold)}.ai p{margin:0;font-size:14px;line-height:1.55}
.tabs{display:flex;gap:6px;margin:4px 0 8px}.tabs button{background:var(--card);color:var(--mut);border:0;border-radius:4px;padding:8px 14px;font-weight:600;cursor:pointer}.tabs button.on{background:var(--blue);color:#fff}
.game{display:flex;position:relative;border-left:6px solid var(--c);background:var(--bg2);border-radius:4px;margin-bottom:8px;padding:8px 12px;gap:14px;align-items:center}
.game.win{--c:var(--blue);--bg2:var(--winbg);--c2:var(--winb)}.game.loss{--c:var(--red);--bg2:var(--lossbg);--c2:var(--lossb)}.game.remake{--c:#7b7a8e;--bg2:#282830;--c2:#515163}
.g-meta{width:108px;flex:0 0 108px;display:flex;flex-direction:column;color:var(--mut);font-size:12px}.g-meta .q{color:var(--c)}.g-meta .bar{display:block;width:48px;height:1px;background:var(--c2);margin:6px 0}.g-meta .res{color:var(--txt)}
.g-main{flex:1;min-width:0}.g-top{display:flex;align-items:center;gap:6px}
.champ{position:relative}.champ .cimg{width:48px;height:48px;border-radius:50%;display:block}.champ em{position:absolute;right:-2px;bottom:-2px;background:#202024;border-radius:50%;width:20px;height:20px;display:grid;place-items:center;font-style:normal;font-size:11px}
.col2{display:flex;flex-direction:column;gap:2px}.sq{width:22px;height:22px;border-radius:4px;display:block}.rd{width:22px;height:22px;border-radius:50%;background:#000;display:block}
.kda{margin-left:14px;min-width:100px}.kda .k{font-size:15px;font-weight:700}.kda i{color:var(--mut);font-style:normal;font-weight:400}.kda .dd{color:var(--red)}.kda .ratio{color:var(--mut);font-size:12px}.ratio.gold{color:var(--gold)}.ratio.blue{color:var(--teal)}
.extra{border-left:1px solid var(--c2);padding-left:10px;margin-left:6px;color:var(--mut);font-size:12px}.extra .kp{color:var(--red)}.lp.up{color:var(--teal)}.lp.down{color:var(--red)}
.items{display:flex;align-items:center;gap:2px;margin-top:6px;flex-wrap:wrap}.it{width:22px;height:22px;border-radius:4px;display:block}.empty{display:block;width:22px;height:22px;border-radius:4px;background:var(--c2)}
.laning{margin-left:10px;background:var(--c2);border-radius:10px;padding:1px 8px;font-size:11px;color:var(--txt)}
.g-roast{margin-top:6px;font-size:12px;color:#ffd7a3;background:rgba(0,0,0,.18);border-radius:4px;padding:5px 8px}
.teams{display:flex;gap:8px;flex:0 0 auto}.teams ul{list-style:none;margin:0;padding:0;width:88px}.teams li{display:flex;align-items:center;gap:4px;height:16px;color:var(--mut);font-size:11px;white-space:nowrap;overflow:hidden}
.teams img{width:14px;height:14px;border-radius:3px}.teams li.me{color:var(--txt);font-weight:700}
.shot{position:absolute;right:8px;top:6px;text-decoration:none;opacity:.7}.shot:hover{opacity:1}
@media(max-width:820px){.teams{display:none}.game{flex-wrap:wrap}.g-meta{flex-direction:row;flex-wrap:wrap;gap:6px;width:auto;flex-basis:100%}.g-meta .bar{display:none}}
#dayrep p{margin:0 0 10px}.dstats{display:flex;gap:16px;flex-wrap:wrap;color:var(--mut);margin-bottom:10px}.dstats b{color:var(--txt)}
.fix{background:rgba(0,0,0,.2);border-radius:6px;padding:10px 12px}.fix b{color:var(--gold)}.fix ol{margin:6px 0 0;padding-left:20px}.fix li{margin:3px 0}
.days{display:flex;flex-direction:column;gap:6px}.day{background:var(--card2);border-radius:6px;border-left:4px solid var(--line)}.day.up{border-color:var(--blue)}.day.down{border-color:var(--red)}
.day summary{cursor:pointer;display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:9px 12px;color:var(--mut)}.day summary b{color:var(--txt);min-width:170px}.day .dwl{color:var(--txt)}
.day.up .dlp{color:var(--teal)}.day.down .dlp{color:var(--red)}.int{background:var(--red);color:#fff;border-radius:10px;padding:0 8px;font-size:11px}.day i{font-style:normal}.day p,.day .fix{margin:0 12px 12px}
footer{color:var(--mut);text-align:center;font-size:12px;margin:22px 0 8px}

.hero{display:flex;align-items:center;gap:16px;background:linear-gradient(120deg,#3e63c9,#5383e8 55%,#7c5ce8);margin:-16px -16px 16px;padding:14px 18px;flex-wrap:wrap}
.toon{width:150px;height:127px;flex:0 0 auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35))}.toon svg{width:100%;height:100%;display:block}
.logo{font-weight:900;font-size:34px;letter-spacing:-1px;color:#fff;line-height:1;text-shadow:0 2px 0 rgba(0,0,0,.25)}.who{color:#e4ebff;margin-top:6px;font-size:13px}
.date{color:#fff;text-align:right;margin-left:auto}.date b{display:block;font-size:18px}.date span{font-size:12px;opacity:.9}
@media(max-width:640px){.toon{width:110px;height:93px}.logo{font-size:26px}.date{text-align:left;margin-left:0}}
.mut{color:var(--mut)!important;margin-top:12px!important}.none{background:var(--card);border-radius:6px;padding:18px;color:var(--mut);text-align:center}
</style></head><body><div class="wrap">
<header class="hero"><div class="toon">${cartoon}</div><div><div class="logo">Chenny LoL Tracker</div><div class="who">${esc(cfg.gameName)}#${esc(cfg.tagLine)} · NA · <a href="${esc(opUrl)}" target="_blank">op.gg ↗</a></div></div>
<div class="date"><b id="today"></b><span>Toronto time · updated <span class="ago" data-iso="${esc(updatedAt)}"></span> · checks every 10 min</span></div></header>

<div class="card prof">
  <div class="icon">${profile.icon ? `<img src="${esc(profile.icon)}" alt="">` : ''}${profile.level ? `<em>${esc(profile.level)}</em>` : ''}</div>
  <div><h1>${esc(cfg.gameName)} <span>#${esc(cfg.tagLine)}</span></h1>
  <div class="sub">${esc(cfg.region.toUpperCase())}${profile.ladderRank ? ` · Ladder Rank <b>${esc(profile.ladderRank)}</b> (${esc(profile.ladderPct)}% of top)` : ''}</div></div>
</div>

<div class="grid">
  <div>
    <div class="card"><h2>Ranked Solo/Duo</h2>
      <div class="rank"><img src="${esc(EMBLEM(solo.tier))}" alt=""><div><div class="t">${esc(solo.tier || 'Unranked')}</div><div class="lp">${solo.lp != null ? solo.lp + ' LP' : ''}</div></div>
      <div class="wl">${solo.wins || 0}W ${solo.losses || 0}L<br>Win rate ${sWr}%</div></div>
    </div>
    <div class="card"><h2>Champions · last 24 hours</h2><ul class="champs">${champRows || '<li><span>No solo/duo games in the last 24 hours</span></li>'}</ul></div>
  </div>
  <div>
    <div class="card"><h2>Ranked Solo/Duo · last 24 hours</h2>
      ${recent.games ? `<div class="summ">
        <div class="donut" style="--p:${pct}"><b>${pct}%</b></div>
        <div><div class="s2">${recent.games}G ${recent.wins}W ${recent.losses}L</div>
          <div class="big">${f1(recent.k)} <i>/</i> <span class="dd">${f1(recent.d)}</span> <i>/</i> ${f1(recent.a)}</div>
          <div class="s2"><b>${f1(recent.kda)}:1</b> KDA · P/Kill ${Math.round(recent.kp)}%</div></div>
        <div class="stat"><div>Avg CS<b>${Math.round(recent.cs)}</b></div><div>CS/min<b>${f1(recent.csm)}</b></div><div>Avg length<b>${Math.round(recent.mins)}m</b></div><div>LP<b class="${recent.lpNet >= 0 ? '' : 'red'}">${recent.lpNet >= 0 ? '+' : ''}${recent.lpNet}</b></div></div>
      </div>` : '<p class="s2" style="color:var(--mut);margin:0">No ranked solo/duo games in the last 24 hours.</p>'}
    </div>
    <div class="card ai" id="ai"><h2>🤖 AI overview · last 24 hours</h2><div id="dayrep">${aiBody}</div></div>
  </div>
</div>

<div class="tabs"><button class="on" data-f="${esc(cfg.trackQueue)}">Ranked Solo/Duo</button><button data-f="">All games</button><span style="margin-left:auto;color:var(--mut);align-self:center">Last 24 hours</span></div>
<div id="list">${games.map(g => gameRow(g, cfg.gameName)).join('')}</div>
<div class="none" id="none" hidden>No games in the last 24 hours.</div>

${days.length ? `<div class="card" style="margin-top:14px"><h2>Previous days</h2><div class="days">${days.map(d => `
  <details class="day ${d.lpNet > 0 ? 'up' : d.lpNet < 0 ? 'down' : ''}"><summary><b>${esc(d.label)}</b><span class="dwl">${d.wins}W ${d.losses}L</span><span>${f1(d.k)} / <i class="red">${f1(d.d)}</i> / ${f1(d.a)}</span><span>${f1(d.csm)} CS/m</span><span class="dlp">${d.lpNet >= 0 ? '+' : ''}${d.lpNet} LP</span>${d.ints ? `<span class="int">${d.ints} int${d.ints > 1 ? 's' : ''}</span>` : ''}</summary>
  <p>${esc(d.roast)}</p><div class="fix"><b>What to fix</b><ol>${(d.fixes || []).map(f => `<li>${esc(f)}</li>`).join('')}</ol></div></details>`).join('')}</div></div>` : ''}
<footer>Data from op.gg. Times in Toronto (Eastern) time. Not endorsed by Riot Games or OP.GG.</footer>
</div>
<script>
const TZ=${JSON.stringify(tz)};const now=new Date();
document.getElementById('today').textContent=now.toLocaleDateString('en-US',{timeZone:TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'})+' · '+now.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'});
function ago(d){const s=(Date.now()-d)/1000;if(s<60)return'just now';const m=s/60;if(m<60)return Math.round(m)+' minute'+(Math.round(m)==1?'':'s')+' ago';const h=m/60;if(h<24)return Math.round(h)+' hour'+(Math.round(h)==1?'':'s')+' ago';const dd=Math.round(h/24);return dd+' day'+(dd==1?'':'s')+' ago';}
document.querySelectorAll('.ago').forEach(e=>{const d=e.dataset.iso?new Date(e.dataset.iso):(+e.dataset.ts?new Date(+e.dataset.ts):null);if(d&&!isNaN(d)){e.title=d.toLocaleString('en-US',{timeZone:TZ})+' Toronto';e.textContent=ago(d);}});
const btns=document.querySelectorAll('.tabs button');
function show(f){btns.forEach(b=>b.classList.toggle('on',b.dataset.f===f));let n=0;document.querySelectorAll('.game').forEach(g=>{const ok=(!f||g.dataset.queue===f)&&Date.now()-(+g.dataset.ts)<864e5;g.style.display=ok?'':'none';if(ok)n++;});document.getElementById('none').hidden=n>0;}
btns.forEach(b=>b.onclick=()=>show(b.dataset.f));show(${JSON.stringify(cfg.trackQueue)});
</script></body></html>`;
}
