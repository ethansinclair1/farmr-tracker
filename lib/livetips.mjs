// "How to win this game" tips for the live game: his role + both team comps + op.gg tiers.
const id = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const set = s => new Set(s.split(' '));
const ASSASSIN = set('zed katarina akali qiyana talon khazix rengar evelynn leblanc fizz kayn naafiri pyke shaco ekko diana nocturne kassadin yone yasuo viego briar');
const HEAL = set('soraka yuumi sona nami aatrox vladimir sylas warwick drmundo briar fiddlesticks swain illaoi renataglasc renata seraphine milio belveth');
const TANK = set('ornn malphite sion chogath maokai zac sejuani rammus amumu leona nautilus alistar braum taric tahmkench poppy shen ksante drmundo galio sett skarner volibear');
const AP = set('ahri akali anivia annie aurelionsol azir brand cassiopeia diana ekko elise evelynn fiddlesticks fizz galio gragas gwen heimerdinger hwei karthus kassadin katarina kennen leblanc lillia lissandra lux malzahar maokai mordekaiser morgana neeko nidalee orianna rumble ryze seraphine sylas syndra taliyah teemo twistedfate veigar velkoz vex viktor vladimir xerath ziggs zoe zyra amumu chogath sona soraka nami lulu janna karma yuumi milio renataglasc renata zac sejuani aurora mel smolder kaisa');
const EARLY_JG = set('leesin elise nidalee xinzhao jarvaniv reksai khazix graves briar rengar shaco volibear olaf trundle pantheon talon qiyana naafiri wukong monkeyking');
const SCALING_JG = set('masteryi karthus kayn shyvana lillia belveth kindred evelynn nocturne fiddlesticks gragas zac sejuani amumu ivern diana hecarim viego');
const POS = ['top', 'jungle', 'mid', 'adc', 'support'];

function roleOf(p, tiers) {
  if ((p.spells || []).some(s => /smite/i.test(s.n))) return 'jungle';
  let best = null;
  for (const pos of POS) {
    const t = (tiers[pos] || []).find(x => x.id === id(p.champ && p.champ.n));
    if (t && (!best || t.rank / (tiers[pos].length || 1) < best.r)) best = { pos, r: t.rank / (tiers[pos].length || 1) };
  }
  return best ? best.pos : '';
}
function tierLabel(tiers, pos, champ) {
  const list = tiers[pos] || []; const t = list.find(x => x.id === id(champ)); if (!t || !t.band) return '';
  const band = list.filter(x => x.band === t.band), i = band.findIndex(x => x.id === t.id), third = band.length < 3 ? 1 : Math.floor(i / band.length * 3);
  return 'SABCD'[t.band - 1] + (third === 0 ? '+' : third === 2 ? '-' : '');
}

export function liveTips(live, tiers = {}) {
  if (!live || !live.teams) return null;
  const ti = live.teams.findIndex(t => t.players.some(p => /^fullcleardeluxe$/i.test(p.n)));
  if (ti < 0) return null;
  const mine = live.teams[ti].players, theirs = live.teams[1 - ti].players;
  const me = mine.find(p => /^fullcleardeluxe$/i.test(p.n));
  const role = roleOf(me, tiers) || 'jungle';
  const myChamp = me.champ ? me.champ.n : 'his champ';
  const ec = theirs.map(p => id(p.champ && p.champ.n)), oc = mine.map(p => id(p.champ && p.champ.n));
  const eJg = theirs.find(p => (p.spells || []).some(s => /smite/i.test(s.n)));
  const eSame = theirs.find(p => roleOf(p, tiers) === role && p !== eJg) || (role === 'jungle' ? eJg : null);
  const tips = [];
  const base = {
    jungle: ['Full clear, then gank the lane with the most crowd control and the enemy laner pushed up - not the lane you like the most.', 'Set up vision on dragon/grubs 60 seconds before they spawn and be there first, not arriving as it dies.', 'Track the enemy jungler: when he shows bot side, take the top side camps and objective (and the reverse).'],
    top: ['Freeze the wave near your tower when you\'re ahead - make him walk into the jungler.', 'Use Teleport for bot-side fights and dragon, not just to get back to lane.', 'Ping and back off when the enemy jungler is missing - top dies to ganks more than any lane.'],
    mid: ['Shove the wave and move first to river - mid priority decides every early skirmish.', 'Roam bot when their mid is backing; ping before you go.', 'Ward the side brushes - assassins and junglers will come through them.'],
    adc: ['Stay alive: an ADC with 0 deaths does more damage than one that dies chasing.', 'Farm the side waves mid-game, then group for objectives - don\'t ARAM mid for no gold.', 'Hit what\'s in range, not the champion you want to hit.'],
    support: ['Ward the enemy jungler\'s path at 3 minutes - your bot lane lives or dies by that ward.', 'Roam mid when your ADC backs; get the jungler priority on scuttle.', 'Peel for your carry in fights instead of diving the backline.'],
  }[role] || [];
  if (eJg) {
    const c = id(eJg.champ && eJg.champ.n), n = eJg.champ ? eJg.champ.n : 'their jungler';
    if (role === 'jungle') {
      if (EARLY_JG.has(c)) tips.push(`Enemy jungler is ${n} - strong early. Don't fight him in the first 10 minutes; ward his entrances and mirror him to the other side.`);
      else if (SCALING_JG.has(c)) tips.push(`Enemy jungler is ${n} - a scaler. Invade his first buff with your laners and end before 25 minutes.`);
      else tips.push(`Enemy jungler is ${n}. Ward his first buff at 1:30 to see which side he starts.`);
    } else tips.push(`Enemy jungler is ${n}${EARLY_JG.has(c) ? ' - expect an early gank around 3:00, keep the wave near your tower' : ''}.`);
  }
  if (eSame && role !== 'jungle') {
    const a = tierLabel(tiers, role, myChamp), b = tierLabel(tiers, role, eSame.champ && eSame.champ.n);
    if (a && b) tips.push(`Lane: ${a} tier ${myChamp} vs ${b} tier ${eSame.champ.n}.${'SABCD'.indexOf(a[0]) < 'SABCD'.indexOf(b[0]) ? ' You have the stronger pick - no excuses, play for the lead.' : 'SABCD'.indexOf(a[0]) > 'SABCD'.indexOf(b[0]) ? ' He has the stronger pick - farm safe and wait for the jungler.' : ''}`);
  } else if (role === 'jungle' && eJg) {
    const a = tierLabel(tiers, 'jungle', myChamp), b = tierLabel(tiers, 'jungle', eJg.champ && eJg.champ.n);
    if (a && b) tips.push(`Jungle matchup: ${a} tier ${myChamp} vs ${b} tier ${eJg.champ.n}.`);
  }
  const assassins = ec.filter(c => ASSASSIN.has(c)).length, heals = ec.filter(c => HEAL.has(c)).length, tanks = ec.filter(c => TANK.has(c)).length, ap = ec.filter(c => AP.has(c)).length;
  if (assassins >= 2) tips.push(`They have ${assassins} assassins - never face-check, buy a defensive item (Zhonya's / Guardian Angel / armor) early and group with your team.`);
  if (heals >= 2) tips.push(`They have a lot of healing (${heals} champs) - rush an anti-heal item, fights will be lost without it.`);
  if (tanks >= 2) tips.push(`They have ${tanks} tanks - build armor/magic penetration and target their carries, not the frontline.`);
  if (ap >= 3) tips.push(`Their damage is mostly magic (${ap} AP champs) - an early magic resist item will win fights.`);
  else if (ap <= 1 && ec.length >= 3) tips.push('Their damage is almost all physical - armor is worth a lot this game.');
  const ourScaling = oc.filter(c => SCALING_JG.has(c) || /kayle|kassadin|vayne|jinx|aurelionsol|smolder|veigar|nasus|azir|ryze/.test(c)).length;
  if (ourScaling >= 2) tips.push('Your team scales well - don\'t throw early. Trade objectives, farm and win after 25 minutes.');
  tips.push(...base);
  return { role, champ: myChamp, tips: tips.slice(0, 7) };
}
