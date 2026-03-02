"use client";

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type PerformanceEventType =
    | 'reception_confirmed'
    | 'difference_detected'
    | 'post_edit_detected'
    | 'validation_error'
    | 'streak_reset'
    | 'record_broken';

interface ReceptionMetadata {
    shipment_id: string;
    tracking_number?: string;
    kg_managed?: number;
    boxes_count?: number;
    delta_kg?: number;
    had_errors?: boolean;
    is_edit?: boolean;
    duration_seconds?: number;
}

export function usePerformanceTracking() {
    /**
     * Log a performance event and update daily stats + streaks.
     * Designed to be fire-and-forget — never blocks UI.
     */
    const logEvent = useCallback(async (
        eventType: PerformanceEventType,
        metadata: ReceptionMetadata
    ) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            const userId = session.user.id;

            // 1. Insert event
            await supabase.from('performance_events').insert({
                user_id: userId,
                event_type: eventType,
                shipment_id: metadata.shipment_id,
                metadata,
            });

            // 2. Upsert daily stats
            if (eventType === 'reception_confirmed') {
                const today = new Date().toISOString().split('T')[0];
                const { data: existing } = await supabase
                    .from('user_daily_stats')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('stat_date', today)
                    .single();

                if (existing) {
                    await supabase.from('user_daily_stats').update({
                        receptions_count: (existing.receptions_count || 0) + 1,
                        kg_managed: parseFloat(((existing.kg_managed || 0) + (metadata.kg_managed || 0)).toFixed(2)),
                        differences_detected: (existing.differences_detected || 0) + (metadata.delta_kg && Math.abs(metadata.delta_kg) > 0.5 ? 1 : 0),
                        clean_receptions: (existing.clean_receptions || 0) + (metadata.had_errors ? 0 : 1),
                        total_receptions: (existing.total_receptions || 0) + 1,
                        avg_reception_seconds: metadata.duration_seconds
                            ? Math.round(((existing.avg_reception_seconds || 0) * (existing.total_receptions || 0) + metadata.duration_seconds) / ((existing.total_receptions || 0) + 1))
                            : existing.avg_reception_seconds || 0,
                        updated_at: new Date().toISOString(),
                    }).eq('id', existing.id);
                } else {
                    await supabase.from('user_daily_stats').insert({
                        user_id: userId,
                        stat_date: today,
                        receptions_count: 1,
                        kg_managed: metadata.kg_managed || 0,
                        differences_detected: metadata.delta_kg && Math.abs(metadata.delta_kg) > 0.5 ? 1 : 0,
                        clean_receptions: metadata.had_errors ? 0 : 1,
                        total_receptions: 1,
                        avg_reception_seconds: metadata.duration_seconds || 0,
                    });
                }

                // 3. Update streaks
                if (!metadata.had_errors) {
                    const { data: streak } = await supabase
                        .from('user_streaks')
                        .select('*')
                        .eq('user_id', userId)
                        .single();

                    if (streak) {
                        const newCleanReceptions = (streak.current_clean_receptions || 0) + 1;
                        await supabase.from('user_streaks').update({
                            current_clean_receptions: newCleanReceptions,
                            best_clean_receptions: Math.max(streak.best_clean_receptions || 0, newCleanReceptions),
                            updated_at: new Date().toISOString(),
                        }).eq('id', streak.id);
                    } else {
                        await supabase.from('user_streaks').insert({
                            user_id: userId,
                            current_clean_days: 1,
                            current_clean_receptions: 1,
                            best_clean_days: 1,
                            best_clean_receptions: 1,
                        });
                    }
                }
            }

            // Reset streak on validation errors
            if (eventType === 'validation_error') {
                await supabase.from('user_streaks').update({
                    current_clean_receptions: 0,
                    last_error_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }).eq('user_id', userId);
            }

            // Reset streak on post edits
            if (eventType === 'post_edit_detected') {
                await supabase.from('user_streaks').update({
                    last_edit_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }).eq('user_id', userId);
            }
        } catch (err) {
            // Fire-and-forget — never break user flow
            console.warn('[Performance] Event log failed:', err);
        }
    }, []);

    /**
     * Fetch today's stats for the logged user.
     */
    const fetchTodayStats = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return null;

            const today = new Date().toISOString().split('T')[0];
            const { data } = await supabase
                .from('user_daily_stats')
                .select('*')
                .eq('user_id', session.user.id)
                .eq('stat_date', today)
                .single();

            return data;
        } catch {
            return null;
        }
    }, []);

    /**
     * Fetch current streak for the logged user.
     */
    const fetchStreak = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return null;

            const { data } = await supabase
                .from('user_streaks')
                .select('*')
                .eq('user_id', session.user.id)
                .single();

            return data;
        } catch {
            return null;
        }
    }, []);

    return { logEvent, fetchTodayStats, fetchStreak };
}
