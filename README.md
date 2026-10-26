# Chenny LoL Tracker - FullClearDeluxe#FarmR (NA)

Every 5 minutes a GitHub Action opens his op.gg page (presses **Update** first), reads it, and:

- **Discord:** posts every new **Ranked Solo/Duo** game: an op.gg-style card (result, champion, K/D/A, KDA, CS & CS/min,
  kill participation, length, LP gained/lost, rank, build), the op.gg screenshot of that game, and an AI verdict
  that roasts him when it's bad.
- **GitHub Pages site ("Chenny LoL Tracker"):** a big flashing LIVE banner when he's in a game (champions, both teams,
  bans, live timer), LP gained/lost today, today's stats and champions, a short brutal AI overview with tips, and every
  ranked game from the last 14 days laid out like op.gg - each with an Analysis button (OP Score, objectives, damage,
  vision, kill participation, deaths, farm, laning) and player names that open their op.gg. Background music with a
  volume slider. Open tabs refresh themselves when new data lands.

## Setup (one time)

1. **Discord webhook:** in your server, *Channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL*.
2. In this repo: *Settings → Secrets and variables → Actions → New repository secret*
   - `DISCORD_WEBHOOK_URL` = the webhook URL
   - `ANTHROPIC_API_KEY` (optional) = a Claude API key for the AI roasts. Without it, built-in roasts are used.
3. *Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/docs`*.
4. *Actions → Track op.gg → Run workflow* once. The first run posts a "now tracking" message instead of spamming
   old games; after that every new solo/duo game gets its own post.

Change the account, region, timezone or AI model in `config.json`.

## Notes
- Data comes from op.gg's public page (no Riot API key needed). If op.gg changes its page layout the reader in
  `lib/extract.mjs` may need a tweak; the run just logs "No games read" and changes nothing.
- GitHub runs scheduled workflows on a best-effort basis, so a post can lag a game by ~10-20 minutes.
- `npm test` builds the page from `test/fixture.json` (a real op.gg read from 26 Oct 2026) without opening op.gg.
