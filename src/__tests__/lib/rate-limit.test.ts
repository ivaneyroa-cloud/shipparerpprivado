import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock NextRequest since it comes from Next.js server runtime
function createMockRequest(ip: string = '192.168.1.1'): any {
    return {
        headers: {
            get: (name: string) => {
                if (name === 'x-forwarded-for') return ip;
                return null;
            },
        },
    };
}

// We need a fresh module on each test to reset the in-memory store
async function getFreshRateLimiter() {
    // Reset module cache so the store Map is fresh
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    return mod.checkRateLimit;
}

describe('checkRateLimit', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('allows first request', async () => {
        const checkRateLimit = await getFreshRateLimiter();
        const req = createMockRequest();
        const result = checkRateLimit(req, 5, 60_000);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
        expect(result.retryAfterMs).toBe(0);
    });

    it('counts down remaining correctly', async () => {
        const checkRateLimit = await getFreshRateLimiter();
        const req = createMockRequest();

        const r1 = checkRateLimit(req, 3, 60_000);
        expect(r1.remaining).toBe(2);

        const r2 = checkRateLimit(req, 3, 60_000);
        expect(r2.remaining).toBe(1);

        const r3 = checkRateLimit(req, 3, 60_000);
        expect(r3.remaining).toBe(0);
    });

    it('blocks after exceeding limit', async () => {
        const checkRateLimit = await getFreshRateLimiter();
        const req = createMockRequest();

        // Use up all 3 allowed requests
        checkRateLimit(req, 3, 60_000);
        checkRateLimit(req, 3, 60_000);
        checkRateLimit(req, 3, 60_000);

        // 4th request should be blocked
        const result = checkRateLimit(req, 3, 60_000);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('isolates rate limits per IP', async () => {
        const checkRateLimit = await getFreshRateLimiter();
        const reqA = createMockRequest('10.0.0.1');
        const reqB = createMockRequest('10.0.0.2');

        // Max out IP A
        checkRateLimit(reqA, 1, 60_000);
        const blockedA = checkRateLimit(reqA, 1, 60_000);
        expect(blockedA.allowed).toBe(false);

        // IP B should still be allowed
        const allowedB = checkRateLimit(reqB, 1, 60_000);
        expect(allowedB.allowed).toBe(true);
    });

    it('falls back to "anon" when no IP headers', async () => {
        const checkRateLimit = await getFreshRateLimiter();
        const noIpReq = {
            headers: {
                get: () => null,
            },
        } as any;

        const result = checkRateLimit(noIpReq, 5, 60_000);
        expect(result.allowed).toBe(true);
    });

    it('uses x-real-ip as fallback', async () => {
        const checkRateLimit = await getFreshRateLimiter();
        const req = {
            headers: {
                get: (name: string) => {
                    if (name === 'x-forwarded-for') return null;
                    if (name === 'x-real-ip') return '10.0.0.99';
                    return null;
                },
            },
        } as any;

        // Should work and use the x-real-ip
        const r1 = checkRateLimit(req, 1, 60_000);
        expect(r1.allowed).toBe(true);

        const r2 = checkRateLimit(req, 1, 60_000);
        expect(r2.allowed).toBe(false);
    });

    it('defaults to 30 requests per 60 seconds', async () => {
        const checkRateLimit = await getFreshRateLimiter();
        const req = createMockRequest('default-test');

        // Fire 30 requests
        for (let i = 0; i < 30; i++) {
            const r = checkRateLimit(req);
            expect(r.allowed).toBe(true);
        }

        // 31st should be blocked
        const blocked = checkRateLimit(req);
        expect(blocked.allowed).toBe(false);
    });
});
