import { Clock } from '../../application/ports';

/**
 * The dataset is frozen at 2026-08-25T14:30:00Z and the brief says to treat that
 * as "now". A fully frozen clock would stamp every simulated fill with the same
 * instant, so instead time starts at the anchor when the process boots and then
 * advances in real time. Set SNAPSHOT_NOW="" to use the real wall clock.
 */
export class AnchoredClock implements Clock {
  private readonly bootedAt = Date.now();

  constructor(private readonly anchor: Date | null) {}

  now(): Date {
    if (!this.anchor) return new Date();
    return new Date(this.anchor.getTime() + (Date.now() - this.bootedAt));
  }
}
