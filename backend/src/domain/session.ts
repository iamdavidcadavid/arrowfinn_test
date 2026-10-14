import { SessionWindow } from './model';

/**
 * CME Globex trading day: opens 17:00 America/Chicago, closes 16:00 the next
 * afternoon. One session therefore spans two UTC dates, and DST shifts the UTC
 * boundary (22:00Z in summer, 23:00Z in winter), so we compute it in Chicago time
 * instead of hard-coding an offset.
 *
 * Weekend handling is out of scope: on a Saturday this returns the window that
 * would start Friday 17:00, which contains no fills.
 */
const TZ = 'America/Chicago';
const OPEN_HOUR = 17;
const SESSION_HOURS = 23;

/** Offset (ms) of `tz` from UTC at instant `at`. Positive east of UTC. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** UTC instant for a wall-clock time in `tz`. */
function zonedToUtc(y: number, m: number, d: number, h: number, tz: string): Date {
  const guess = Date.UTC(y, m, d, h);
  // Two passes handle the case where the guess and the answer straddle a DST change.
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  ts = guess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

export function tradingSessionFor(now: Date): SessionWindow {
  const local = new Date(now.getTime() + tzOffsetMs(now, TZ)); // wall clock, read via getUTC*
  let y = local.getUTCFullYear();
  let m = local.getUTCMonth();
  let d = local.getUTCDate();
  if (local.getUTCHours() < OPEN_HOUR) {
    const prev = new Date(Date.UTC(y, m, d) - 24 * 3600 * 1000);
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth();
    d = prev.getUTCDate();
  }
  const start = zonedToUtc(y, m, d, OPEN_HOUR, TZ);
  const end = new Date(start.getTime() + SESSION_HOURS * 3600 * 1000);
  return { start, end };
}
