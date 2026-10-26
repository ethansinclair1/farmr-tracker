import { chromium } from 'playwright';
import fs from 'fs';
import { extractInPage, extractDetail, extractLive } from './extract.mjs';

// Opens the op.gg profile like a person would: presses Update so the games are fresh, opens a few more games,
// reads everything, and takes screenshots of the profile header, the game list and each game row.
export async function scrape(cfg, shotsDir, known = new Set()) {
  const url = `https://op.gg/lol/summoners/${cfg.region}/${encodeURIComponent(cfg.gameName)}-${encodeURIComponent(cfg.tagLine)}`;
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({
    viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: cfg.timezone, colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  const rowSel = 'div[class*="border-l-[6px]"]';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector(rowSel, { timeout: 45000 });
    // cookie / consent banners
    for (const name of [/^Accept/i, /^Agree/i, /^I agree/i, /^Got it/i]) {
      const b = page.getByRole('button', { name }); if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {});
    }
    // ask op.gg to refresh the match history (it's rate limited on their side - fine if it says "updated recently")
    const upd = page.getByRole('button', { name: /^Update$/ });
    if (await upd.count().catch(() => 0)) {
      await upd.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(9000);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector(rowSel, { timeout: 45000 });
    }
    await page.waitForTimeout(2500);
    for (let i = 0; i < (cfg.showMoreClicks || 0); i++) {
      const more = page.getByRole('button', { name: /^Show more$/ });
      if (!(await more.count().catch(() => 0))) break;
      await more.last().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
    const data = await page.evaluate(extractInPage);
    data.url = url;
    data.scrapedAt = new Date().toISOString();
    // screenshots
    fs.mkdirSync(shotsDir, { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shotsDir}/profile.jpg`, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1100, height: 1000 } });
    const rows = await page.$$(rowSel);
    const keep = [];
    for (let i = 0; i < rows.length; i++) {
      const txt = await rows[i].innerText().catch(() => '');
      if (!/Show More Detail Games/.test(txt)) continue;
      keep.push(rows[i]);
    }
    data.rowShots = [];
    for (let i = 0; i < keep.length && i < 60; i++) {
      const p = `${shotsDir}/game_${i}.jpg`;
      await keep[i].scrollIntoViewIfNeeded().catch(() => {});
      await keep[i].screenshot({ path: p, type: 'jpeg', quality: 85 }).catch(() => {});
      data.rowShots.push(fs.existsSync(p) ? `game_${i}.jpg` : '');
    }
    // the match list as one long "scrolling through op.gg" shot
    const box = await page.evaluate(sel => {
      const rs = [...document.querySelectorAll(sel)].filter(r => /Show More Detail Games/.test(r.innerText)).slice(0, 10);
      if (!rs.length) return null;
      const a = rs[0].getBoundingClientRect(), b = rs[rs.length - 1].getBoundingClientRect();
      return { x: Math.max(0, a.left + scrollX - 6), y: Math.max(0, a.top + scrollY - 6), w: a.width + 12, h: b.bottom - a.top + 12 };
    }, rowSel);
    if (box) await page.screenshot({ path: `${shotsDir}/games.jpg`, type: 'jpeg', quality: 75, fullPage: true, clip: { x: box.x, y: box.y, width: box.w, height: Math.min(box.h, 6000) } }).catch(() => {});
    // open each ranked game's detail panel (once per game - known ones are skipped) for objectives, damage, wards, OP Score
    let opened = 0;
    for (const g of data.games) {
      if (!/Ranked/.test(g.queue) || known.has(`${g.date}|${g.champ && g.champ.n}`) || opened >= 70) continue;
      g.detail = await page.evaluate(extractDetail, g.idx).catch(() => null);
      opened++;
    }
    console.log(`Opened ${opened} game detail panels`);
    // live game?
    try {
      await page.goto(url + '/ingame', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(6000);
      data.live = await page.evaluate(extractLive);
      if (data.live) {
        data.live.at = data.scrapedAt;
        await page.screenshot({ path: `${shotsDir}/live.jpg`, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1100, height: 1000 } }).catch(() => {});
      }
      console.log(data.live ? `LIVE: ${data.live.queue} ${data.live.elapsed}s` : 'Not in a game');
    } catch (e) { console.log('Live check failed:', e.message); data.live = null; }
    return data;
  } finally {
    await browser.close();
  }
}
