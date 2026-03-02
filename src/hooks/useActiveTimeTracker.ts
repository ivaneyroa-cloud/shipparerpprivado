'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════
// ACTIVE TIME TRACKER
// Tracks real interaction time (clicks, keys, scroll, mouse)
// NOT idle session time. Pauses after 60s of inactivity.
// Flushes every 60s to user_daily_stats.active_minutes
// ═══════════════════════════════════════════════════════════════

const IDLE_TIMEOUT_MS = 60_000;      // 60s without activity = idle
const FLUSH_INTERVAL_MS = 60_000;    // Flush to DB every 60s
const ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'] as const;

// Throttle mousemove/scroll to avoid excessive updates
function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let last = 0;
    return ((...args: any[]) => {
        const now = Date.now();
        if (now - last >= ms) {
            last = now;
            fn(...args);
        }
    }) as T;
}

export function useActiveTimeTracker() {
    const activeSecondsRef = useRef(0);
    const lastActivityRef = useRef(Date.now());
    const isActiveRef = useRef(true);
    const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Mark user as active (on any interaction)
    const markActive = useCallback(() => {
        lastActivityRef.current = Date.now();
        if (!isActiveRef.current) {
            isActiveRef.current = true;
        }
    }, []);

    // Throttled version for high-frequency events
    const markActiveThrottled = useCallback(
        throttle(() => markActive(), 2000),
        [markActive]
    );

    // Flush accumulated seconds to database
    const flush = useCallback(async () => {
        const seconds = activeSecondsRef.current;
        if (seconds <= 0) return;

        // Reset counter immediately to avoid double-counting
        activeSecondsRef.current = 0;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;

            const userId = session.user.id;
            const today = new Date().toISOString().split('T')[0];
            const minutesToAdd = parseFloat((seconds / 60).toFixed(2));

            // Upsert into user_daily_stats
            const { data: existing } = await supabase
                .from('user_daily_stats')
                .select('id, active_minutes')
                .eq('user_id', userId)
                .eq('stat_date', today)
                .maybeSingle();

            if (existing) {
                await supabase.from('user_daily_stats').update({
                    active_minutes: parseFloat(((existing.active_minutes || 0) + minutesToAdd).toFixed(2)),
                    updated_at: new Date().toISOString(),
                }).eq('id', existing.id);
            } else {
                await supabase.from('user_daily_stats').insert({
                    user_id: userId,
                    stat_date: today,
                    active_minutes: minutesToAdd,
                });
            }
        } catch (err) {
            // Silently fail — never break app for tracking
            console.warn('[ActiveTime] Flush failed:', err);
            // Put seconds back so they're not lost
            activeSecondsRef.current += seconds;
        }
    }, []);

    useEffect(() => {
        // Tick every second: if user was active in the last IDLE_TIMEOUT, count it
        tickIntervalRef.current = setInterval(() => {
            const idle = Date.now() - lastActivityRef.current;
            if (idle < IDLE_TIMEOUT_MS) {
                isActiveRef.current = true;
                activeSecondsRef.current += 1;
            } else {
                isActiveRef.current = false;
            }
        }, 1000);

        // Flush to DB periodically
        flushIntervalRef.current = setInterval(flush, FLUSH_INTERVAL_MS);

        // Listen for user interactions
        const directHandler = () => markActive();
        const throttledHandler = () => markActiveThrottled();

        // Direct events (low frequency)
        window.addEventListener('click', directHandler, { passive: true });
        window.addEventListener('keydown', directHandler, { passive: true });
        window.addEventListener('touchstart', directHandler, { passive: true });

        // Throttled events (high frequency)
        window.addEventListener('scroll', throttledHandler, { passive: true, capture: true });
        window.addEventListener('mousemove', throttledHandler, { passive: true });

        // Flush on page unload
        const handleUnload = () => {
            flush();
        };
        window.addEventListener('beforeunload', handleUnload);

        // Flush on visibility change (tab switch)
        const handleVisibility = () => {
            if (document.hidden) {
                isActiveRef.current = false;
                flush();
            } else {
                markActive();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            // Cleanup
            if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
            if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);

            window.removeEventListener('click', directHandler);
            window.removeEventListener('keydown', directHandler);
            window.removeEventListener('touchstart', directHandler);
            window.removeEventListener('scroll', throttledHandler, { capture: true } as any);
            window.removeEventListener('mousemove', throttledHandler);
            window.removeEventListener('beforeunload', handleUnload);
            document.removeEventListener('visibilitychange', handleVisibility);

            // Final flush
            flush();
        };
    }, [markActive, markActiveThrottled, flush]);
}
