// Generates 4 anime / VTuber-style takes on Chenny (brown messy hair, black headset w/ blue glow, black tee).
import fs from 'fs';

const LINE = '#3b2418';
function lock(x, top, len, w, bend, fill) {   // one pointed hair lock hanging down
  return `<path d="M${x - w} ${top}Q${x - w * .4 + bend * .3} ${top + len * .6} ${x + bend} ${top + len}Q${x + w * .5 + bend * .4} ${top + len * .55} ${x + w} ${top}z" fill="${fill}" stroke="${LINE}" stroke-width="2.6" stroke-linejoin="round"/>`;
}
function eyes(kind, iris) {
  // one eye drawn around (0,0); the right eye is the same drawing mirrored
  const one = () => {
    if (kind === 'happy') return `<path d="M-26 6Q0 -24 26 6" stroke="${LINE}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    if (kind === 'xd') return `<path d="M-20 -16L18 0L-20 16" stroke="${LINE}" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    const cool = kind === 'cool';
    return `<ellipse cx="0" cy="0" rx="24" ry="${cool ? 21 : 29}" fill="#fff"/>
      <ellipse cx="2" cy="${cool ? 4 : 4}" rx="19" ry="${cool ? 19 : 26}" fill="url(#iris)"/>
      <ellipse cx="2" cy="${cool ? 7 : 7}" rx="9.5" ry="${cool ? 10 : 14}" fill="#1a1530"/>
      <path d="M-12 ${cool ? 18 : 22}q14 8 28 0" stroke="${iris[2]}" stroke-width="3" fill="none"/>
      <ellipse cx="-7" cy="${cool ? -2 : -8}" rx="6.5" ry="8.5" fill="#fff"/>
      <circle cx="10" cy="${cool ? 12 : 14}" r="3.4" fill="#fff"/>
      ${cool ? `<path d="M-30 -24H30V-8Q0 -16 -30 -10z" fill="#fff3ea"/>` : ''}
      <path d="M-29 ${cool ? -8 : -10}Q-4 ${cool ? -20 : -38} 28 ${cool ? -12 : -20}" stroke="${LINE}" stroke-width="6.5" fill="none" stroke-linecap="round"/>
      <path d="M24 ${cool ? -13 : -21}l10 -6" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>
      <path d="M-18 ${cool ? 24 : 32}q18 5 34 0" stroke="#c98d78" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  };
  return `<g transform="translate(160 226)">${one()}</g><g transform="translate(240 226) scale(-1 1)">${one()}</g>`;
}
function mouth(kind) {
  if (kind === 'cat') return `<path d="M186 276q7 8 14 0q7 8 14 0" stroke="${LINE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  if (kind === 'smirk') return `<path d="M188 280q14 6 28-4" stroke="${LINE}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  if (kind === 'shout') return `<path d="M178 268q22-4 44 0q-4 30-22 32-18-2-22-32z" fill="#7a1f2c" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M182 270l6 9 4-8z" fill="#fff"/><path d="M188 290q12-8 24 0-4 8-12 8t-12-8z" fill="#ff7b8c"/>`;
  return `<path d="M184 272q16 4 32 0q-2 18-16 19-14-1-16-19z" fill="#8a2a36" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/><path d="M190 284q10-5 20 0-4 6-10 6t-10-6z" fill="#ff8a98"/>`;
}
function hair(kind, c) {
  const F = 'url(#hair)';
  let back = `<path d="M108 210C96 120 140 70 200 68s104 52 92 142c-4 30-10 54-18 70H126c-8-16-14-40-18-70z" fill="${c.dark}" stroke="${LINE}" stroke-width="3"/>`;
  let crown = `<path d="M114 176C108 112 148 72 200 72s92 40 86 104z" fill="${F}" stroke="${LINE}" stroke-width="3"/>`;
  let bangs = '', side = '', extra = '';
  if (kind === 'fluffy') {           // VTuber: soft layered fringe swept to one side
    [[132, 60, 20, 6], [152, 78, 18, 10], [172, 92, 18, 14], [194, 100, 18, 16], [216, 92, 18, 18], [238, 80, 17, 16], [258, 66, 16, 12], [272, 52, 14, 8]].forEach(([x, l, w, b]) => bangs += lock(x, 120, l * .62, w, b * .7, F));
    side = lock(122, 160, 120, 16, 4, F) + lock(278, 160, 120, 16, -4, F);
    extra = `<path d="M150 118q50-30 104 0" stroke="${c.shine}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>`;
  } else if (kind === 'spiky') {   // shonen: big spikes
    crown = `<path d="M110 180L96 104L136 120L132 60L170 98L196 40L214 94L254 54L252 112L300 96L286 180z" fill="${F}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>`;
    [[138, 70, 18, -8], [164, 92, 18, 8], [192, 84, 18, -6], [222, 96, 18, 10], [252, 74, 18, 8]].forEach(([x, l, w, b]) => bangs += lock(x, 122, l * .6, w, b * .7, F));
    side = lock(120, 160, 90, 14, -8, F) + lock(280, 160, 90, 14, 8, F);
    extra = `<path d="M140 110l20-30M200 100l4-40M248 108l8-36" stroke="${c.shine}" stroke-width="5" stroke-linecap="round" opacity=".8"/>`;
  } else if (kind === 'messy') {   // closest to the real him: messy fringe falling to his left
    [[140, 64, 18, 10], [162, 86, 18, 16], [186, 100, 20, 20], [210, 104, 20, 22], [234, 90, 18, 18], [256, 70, 16, 12], [274, 54, 14, 6]].forEach(([x, l, w, b]) => bangs += lock(x, 118, l * .64, w, b * .7, F));
    side = lock(122, 160, 92, 14, 2, F) + lock(278, 160, 92, 14, -2, F);
    extra = lock(170, 76, 34, 12, -14, F) + lock(226, 74, 30, 12, 16, F) + `<path d="M146 112q40-24 92-12" stroke="${c.shine}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".85"/>`;
  } else {                         // chibi round
    [[136, 56, 22, 4], [166, 76, 22, 6], [200, 84, 22, 0], [234, 76, 22, -6], [264, 56, 22, -4]].forEach(([x, l, w, b]) => bangs += lock(x, 116, l * .6, w, b * .7, F));
    side = lock(120, 160, 80, 16, 4, F) + lock(280, 160, 80, 16, -4, F);
    extra = `<path d="M196 72c-8-24 4-40 22-44-10 12-12 26-6 42z" fill="${F}" stroke="${LINE}" stroke-width="3"/><path d="M150 110q50-26 100 0" stroke="${c.shine}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>`;
  }
  return { back, front: crown + extra + bangs + side };
}

function chenny(o) {
  const { eye, mouthK, hairK, bg, iris, hairC, extras = '' } = o;
  const h = hair(hairK, hairC);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">${bg.map((c, i) => `<stop offset="${i / (bg.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>
  <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3ea"/><stop offset="1" stop-color="#ffe2d2"/></linearGradient>
  <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hairC.light}"/><stop offset="1" stop-color="${hairC.mid}"/></linearGradient>
  <linearGradient id="iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${iris[0]}"/><stop offset=".6" stop-color="${iris[1]}"/><stop offset="1" stop-color="${iris[2]}"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#9cc4ff"/><stop offset="1" stop-color="#4d7ef0" stop-opacity="0"/></radialGradient>
</defs>
<rect width="400" height="440" fill="url(#bg)"/>
${o.behind || ''}
${h.back}
<path d="M70 440c6-56 44-86 92-92l38 8 38-8c48 6 86 36 92 92z" fill="#1d1e28" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M168 350q32 22 64 0" stroke="#0d0d14" stroke-width="5" fill="none"/>
<path d="M176 300h48v50q-24 12-48 0z" fill="#f4cdbb" stroke="${LINE}" stroke-width="3"/>
<path d="M176 304q24 16 48 0v10q-24 12-48 0z" fill="#e7b39f"/>
<path d="M124 170Q120 252 164 292Q200 322 236 292Q280 252 276 170Q274 100 200 98Q126 100 124 170z" fill="url(#skin)" stroke="${LINE}" stroke-width="3.2"/>
<path d="M128 190c-16-2-18 22-4 30" fill="#ffe2d2" stroke="${LINE}" stroke-width="3"/><path d="M272 190c16-2 18 22 4 30" fill="#ffe2d2" stroke="${LINE}" stroke-width="3"/>
<path d="M126 168q74 34 148 0v-10H126z" fill="#f2c4b1" opacity=".75"/>
${eyes(eye, iris)}

<ellipse cx="146" cy="262" rx="18" ry="9" fill="#ff8fa5" opacity=".5"/><ellipse cx="254" cy="262" rx="18" ry="9" fill="#ff8fa5" opacity=".5"/>
<path d="M140 258l5-7M148 260l5-7M156 258l5-7M244 258l5-7M252 260l5-7M260 258l5-7" stroke="#ff6f8f" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>
<path d="M200 252l-2 5h4" stroke="#d99a86" stroke-width="2.5" fill="none" stroke-linecap="round"/>
${mouth(mouthK)}
${h.front}
<path d="M138 ${eye === 'cool' ? 196 : 184}q22-8 42 0M220 ${eye === 'cool' ? 196 : 184}q22-8 42 0" stroke="${hairC.dark}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<!-- headset -->
<path d="M106 196C98 100 146 52 200 52s102 48 94 144" fill="none" stroke="#17171f" stroke-width="13" stroke-linecap="round"/>
<path d="M112 168C116 96 152 62 200 62s84 34 88 106" fill="none" stroke="#5b8cff" stroke-width="2.5" opacity=".9"/>
<ellipse cx="102" cy="214" rx="28" ry="36" fill="url(#glow)" opacity=".8"/><ellipse cx="298" cy="214" rx="28" ry="36" fill="url(#glow)" opacity=".8"/>
<rect x="84" y="182" width="32" height="60" rx="15" fill="#1b1b24" stroke="#0a0a10" stroke-width="3.5"/>
<rect x="284" y="182" width="32" height="60" rx="15" fill="#1b1b24" stroke="#0a0a10" stroke-width="3.5"/>
<rect x="91" y="196" width="6" height="32" rx="3" fill="#8ab4ff"/><rect x="303" y="196" width="6" height="32" rx="3" fill="#8ab4ff"/>
<path d="M100 236q2 44 62 50" fill="none" stroke="#17171f" stroke-width="6" stroke-linecap="round"/><circle cx="164" cy="286" r="8" fill="#17171f"/>
${extras}
</svg>`;
}

const brown = { light: '#c8995f', mid: '#94693c', dark: '#6b4a2a', shine: '#f0cf9a' };
const star = (x, y, s, c = '#fff8c4') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10z" fill="${c}"/>`;
const V = {
  A_vtuber: chenny({ eye: 'open', mouthK: 'smile', hairK: 'fluffy', iris: ['#2c3b8f', '#5b8df0', '#b6e0ff'], hairC: brown, bg: ['#b9c8ff', '#f4c6ff', '#ffd9ec'],
    extras: star(48, 70, 1.6) + star(352, 90, 1.2) + star(350, 330, .9) + star(50, 320, 1) + `<path d="M84 186l-12-30 26 14z M316 186l12-30-26 14z" fill="#1b1b24" stroke="#5b8cff" stroke-width="2"/>` }),
  B_shonen: chenny({ eye: 'open', mouthK: 'shout', hairK: 'spiky', iris: ['#3a1d0f', '#c06a1d', '#ffcf6b'], hairC: { light: '#b07a42', mid: '#7a5128', dark: '#55361a', shine: '#e2b277' }, bg: ['#ff8a3d', '#ffd23f', '#ff5f6d'],
    behind: Array.from({ length: 22 }, (_, i) => { const a = i / 22 * Math.PI * 2; return `<path d="M200 220L${200 + Math.cos(a) * 340} ${220 + Math.sin(a) * 340}L${200 + Math.cos(a + .08) * 340} ${220 + Math.sin(a + .08) * 340}z" fill="#fff" opacity=".22"/>`; }).join('') }),
  C_chibi: chenny({ eye: 'xd', mouthK: 'shout', hairK: 'chibi', iris: ['#2c3b8f', '#5b8df0', '#b6e0ff'], hairC: brown, bg: ['#a8f0d8', '#b9d3ff', '#e3c6ff'],
    extras: star(56, 80, 1.4, '#fff') + star(344, 70, 1.6, '#fff') + star(340, 300, 1, '#fff') + `<text x="300" y="150" font-family="Arial Black,Arial" font-size="34" fill="#ff5c8a" stroke="#fff" stroke-width="2" transform="rotate(14 300 150)">!!</text>` }),
  D_cool: chenny({ eye: 'cool', mouthK: 'smirk', hairK: 'messy', iris: ['#1d2a5c', '#4064c8', '#8fb8ff'], hairC: { light: '#a8794a', mid: '#7a5230', dark: '#553820', shine: '#d9b07c' }, bg: ['#1b1f3b', '#3a2d6b', '#6a3f8f'],
    extras: star(60, 70, 1.2, '#8fb8ff') + star(340, 80, 1, '#ff9ad5') + star(346, 320, .8, '#8fb8ff') + `<circle cx="70" cy="300" r="40" fill="#8fb8ff" opacity=".12"/>` }),
};
const out = process.argv[2] || '.';
for (const [k, s] of Object.entries(V)) fs.writeFileSync(`${out}/${k}.svg`, s);
console.log(Object.keys(V).join(' '));
