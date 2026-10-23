import { RateLimiter } from './rate-limit.guard';

describe('RateLimiter', () => {
  it('allows up to the limit per minute, then denies', () => {
    const limiter = new RateLimiter();
    const now = 1_000_000;
    expect(limiter.take('ip', 2, now).allowed).toBe(true);
    expect(limiter.take('ip', 2, now + 1).allowed).toBe(true);
    const denied = limiter.take('ip', 2, now + 2);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(60_000 - 2);
  });

  it('reports only the first denial of a window', () => {
    const limiter = new RateLimiter();
    limiter.take('ip', 1, 0);
    expect(limiter.take('ip', 1, 10).firstDenial).toBe(true);
    expect(limiter.take('ip', 1, 20).firstDenial).toBe(false);
  });

  it('frees the slot after the window and keeps keys apart', () => {
    const limiter = new RateLimiter();
    limiter.take('a', 1, 0);
    expect(limiter.take('b', 1, 1).allowed).toBe(true);
    expect(limiter.take('a', 1, 60_000).allowed).toBe(true);
  });
});
