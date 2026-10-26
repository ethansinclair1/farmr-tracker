// op.gg shows times in the browser's timezone ("10/26/2026, 4:11 PM"); these convert between that and real UTC time.
import { parseOpDate } from './extract.mjs';
const offset = (t, tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t;
};
export function opDateToTs(s, tz) {
  const d = parseOpDate(s); if (!d) return 0;
  const guess = Date.UTC(d.y, d.mo - 1, d.d, d.h, d.mi);
  let t = guess - offset(guess, tz); t = guess - offset(t, tz);
  return t;
}
export const tsToOpDate = (t, tz) => new Date(t).toLocaleString('en-US', { timeZone: tz, month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
