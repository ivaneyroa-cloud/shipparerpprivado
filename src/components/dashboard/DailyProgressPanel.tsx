"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Target, Package, Scale, Clock, Zap, TrendingUp, Flame } from 'lucide-react';

interface DailyStats {
    receptions_count: number;
    kg_managed: number;
    differences_detected: number;
    avg_reception_seconds: number;
    clean_receptions: number;
    total_receptions: number;
}

interface Streak {
    current_clean_receptions: number;
    best_clean_receptions: number;
    current_clean_days: number;
    best_clean_days: number;
}

const KG_DAILY_GOAL = 500; // configurable

export function DailyProgressPanel() {
    const [stats, setStats] = useState<DailyStats | null>(null);
    const [streak, setStreak] = useState<Streak | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) { setLoading(false); return; }

                const today = new Date().toISOString().split('T')[0];

                const [statsRes, streakRes] = await Promise.all([
                    supabase.from('user_daily_stats')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .eq('stat_date', today)
                        .maybeSingle(),
                    supabase.from('user_streaks')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .maybeSingle(),
                ]);

                if (statsRes.data) setStats(statsRes.data);
                if (streakRes.data) setStreak(streakRes.data);
            } catch (err) {
                console.warn('[DailyProgress] Load failed:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="erp-card p-5 animate-pulse">
                <div className="h-4 rounded w-1/3 mb-4" style={{ background: 'var(--input-bg)' }} />
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl" style={{ background: 'var(--input-bg)' }} />)}
                </div>
            </div>
        );
    }

    const receptions = stats?.receptions_count || 0;
    const kg = stats?.kg_managed || 0;
    const differences = stats?.differences_detected || 0;
    const avgSec = stats?.avg_reception_seconds || 0;
    const cleanPct = stats?.total_receptions ? Math.round((stats.clean_receptions / stats.total_receptions) * 100) : 100;
    const kgProgress = Math.min((kg / KG_DAILY_GOAL) * 100, 100);

    const cleanStreak = streak?.current_clean_receptions || 0;
    const bestStreak = streak?.best_clean_receptions || 0;

    const formatTime = (sec: number) => {
        if (sec < 60) return `${sec}s`;
        return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    };

    return (
        <div className="erp-card p-5 erp-animate-in space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2E7BFF] to-[#1B6AF0] flex items-center justify-center">
                        <TrendingUp size={14} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Tu rendimiento hoy</h3>
                    </div>
                </div>
                {/* Streak badge */}
                {cleanStreak >= 3 && (
                    <div className="erp-badge erp-badge-amber flex items-center gap-1">
                        <Flame size={10} />
                        {cleanStreak} consecutivas
                    </div>
                )}
            </div>

            {/* Kg progress bar */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Kg gestionados
                    </span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                        {kg.toFixed(1)} <span style={{ color: 'var(--text-muted)' }}>/ {KG_DAILY_GOAL}</span>
                    </span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'var(--input-bg)' }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${kgProgress}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{
                            background: kgProgress >= 100
                                ? 'linear-gradient(90deg, #10B981, #00C2FF)'
                                : 'linear-gradient(90deg, #2E7BFF, #00C2FF)',
                        }}
                    />
                </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-2 erp-stagger">
                {/* Recepciones */}
                <MetricCard
                    icon={<Package size={14} />}
                    label="Recepciones"
                    value={receptions.toString()}
                    accent="#2E7BFF"
                />
                {/* Diferencias */}
                <MetricCard
                    icon={<Target size={14} />}
                    label="Diferencias"
                    value={differences.toString()}
                    accent={differences > 0 ? '#FFB020' : '#10B981'}
                />
                {/* Precisión */}
                <MetricCard
                    icon={<Zap size={14} />}
                    label="Precisión"
                    value={`${cleanPct}%`}
                    accent={cleanPct >= 90 ? '#10B981' : cleanPct >= 70 ? '#FFB020' : '#EF4444'}
                />
            </div>

            {/* Secondary row */}
            <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--card-border)' }}>
                <div className="flex items-center gap-1.5">
                    <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        Promedio: {formatTime(avgSec)} / recepción
                    </span>
                </div>
                {bestStreak > 0 && (
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        Mejor racha: {bestStreak}
                    </span>
                )}
            </div>
        </div>
    );
}

function MetricCard({ icon, label, value, accent }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    accent: string;
}) {
    return (
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--input-bg)' }}>
            <div className="flex items-center gap-1.5">
                <span style={{ color: accent }}>{icon}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {label}
                </span>
            </div>
            <div className="text-lg font-bold erp-count-animate" style={{ color: accent }}>
                {value}
            </div>
        </div>
    );
}
