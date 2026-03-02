import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge Middleware — security headers + rate limiting gate.
 *
 * Since we use the Supabase JS client (which stores auth in localStorage,
 * not cookies), we can't validate sessions at the edge. Instead:
 *
 * 1. Middleware adds security headers to all matched routes.
 * 2. Each dashboard page validates auth client-side via supabase.auth.getSession().
 * 3. API routes validate auth server-side via getAuthContext().
 */

// Simple in-memory rate limiter (per IP, per minute)
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;       // max requests per window
const RATE_WINDOW_MS = 60000; // 1 minute

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }

    entry.count++;
    if (entry.count > RATE_LIMIT) return true;
    return false;
}

// Periodically clean up old entries (avoid memory leak)
if (typeof globalThis !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, val] of rateMap.entries()) {
            if (now > val.resetAt) rateMap.delete(key);
        }
    }, 60000);
}

export function middleware(req: NextRequest) {
    // ── Rate Limiting ──
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'unknown';

    if (isRateLimited(ip)) {
        return NextResponse.json(
            { error: 'Demasiadas solicitudes. Intentá de nuevo en un minuto.' },
            { status: 429 }
        );
    }

    // ── Security Headers ──
    const response = NextResponse.next();

    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");

    // Prevent MIME sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // XSS protection (legacy browsers)
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // Referrer policy — don't leak URLs
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy — restrict browser features
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    );

    return response;
}

export const config = {
    matcher: ['/admin/dashboard/:path*', '/api/:path*'],
};
