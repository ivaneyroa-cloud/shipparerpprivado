import { NextRequest } from 'next/server';

/**
 * Simple in-memory sliding window rate limiter.
 *
 * Keyed by IP (or fallback to "anon").
 * Designed for API routes that call expensive services (OpenAI, etc).
 *
 * ⚠️ In-memory = resets on deploy/restart and is per-instance.
 * For multi-instance deployments, use Upstash Redis or similar.
 * For a single Vercel deployment, this is sufficient and free.
 */

interface SlidingWindow {
    timestamps: number[];
}

const store = new Map<string, SlidingWindow>();

// Clean up old entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;

    const cutoff = now - windowMs;
    for (const [key, entry] of store.entries()) {
        entry.timestamps = entry.timestamps.filter(t => t > cutoff);
        if (entry.timestamps.length === 0) {
            store.delete(key);
        }
    }
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

/**
 * Check if a request is within the rate limit.
 *
 * @param req - The incoming request (uses IP as key)
 * @param maxRequests - Max requests per window (default: 30)
 * @param windowMs - Window size in ms (default: 60_000 = 1 minute)
 */
export function checkRateLimit(
    req: NextRequest,
    maxRequests = 30,
    windowMs = 60_000
): RateLimitResult {
    cleanup(windowMs);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'anon';

    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(ip);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(ip, entry);
    }

    // Drop timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);

    if (entry.timestamps.length >= maxRequests) {
        // Calculate when the oldest request in the window will expire
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = oldestInWindow + windowMs - now;
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: Math.max(retryAfterMs, 1000),
        };
    }

    entry.timestamps.push(now);
    return {
        allowed: true,
        remaining: maxRequests - entry.timestamps.length,
        retryAfterMs: 0,
    };
}
