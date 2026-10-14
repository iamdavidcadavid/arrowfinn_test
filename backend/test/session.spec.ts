import { tradingSessionFor } from '../src/domain/session';

describe('tradingSessionFor (CME Globex, 17:00 America/Chicago open)', () => {
  it('maps the dataset cut to the session that opened the previous evening', () => {
    const s = tradingSessionFor(new Date('2026-08-25T14:30:00Z'));
    expect(s.start.toISOString()).toBe('2026-08-24T22:00:00.000Z'); // 17:00 CDT
    expect(s.end.toISOString()).toBe('2026-08-25T21:00:00.000Z'); // 16:00 CDT
  });

  it('rolls to the new session at 17:00 Chicago, not at UTC midnight', () => {
    expect(tradingSessionFor(new Date('2026-08-24T21:59:59Z')).start.toISOString()).toBe('2026-08-23T22:00:00.000Z');
    expect(tradingSessionFor(new Date('2026-08-24T22:00:00Z')).start.toISOString()).toBe('2026-08-24T22:00:00.000Z');
    expect(tradingSessionFor(new Date('2026-08-25T01:00:00Z')).start.toISOString()).toBe('2026-08-24T22:00:00.000Z');
  });

  it('follows daylight saving time (23:00Z open in winter)', () => {
    expect(tradingSessionFor(new Date('2026-01-15T15:00:00Z')).start.toISOString()).toBe('2026-01-14T23:00:00.000Z');
  });
});
