"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, ChevronDown, Flame, BarChart3 } from 'lucide-react';

interface EmployeePerf {
    user_id: string;
    full_name: string;
    email: string;
    total_receptions: number;
    total_kg: number;
    clean_pct: number;
    differences: number;
    streak: number;
}

export function ManagerPerformancePanel() {
    const [employees, setEmployees] = useState<EmployeePerf[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user?.id) return;

                // Check admin role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.role !== 'admin') { setLoading(false); return; }

                // Date range
                const now = new Date();
                let fromDate: string;
                if (dateRange === 'today') {
                    fromDate = now.toISOString().split('T')[0];
                } else if (dateRange === 'week') {
                    const weekAgo = new Date(now);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    fromDate = weekAgo.toISOString().split('T')[0];
                } else {
                    const monthAgo = new Date(now);
                    monthAgo.setDate(monthAgo.getDate() - 30);
                    fromDate = monthAgo.toISOString().split('T')[0];
                }

                // Fetch daily stats aggregated
                const { data: statsData } = await supabase
                    .from('user_daily_stats')
                    .select('user_id, receptions_count, kg_managed, differences_detected, clean_receptions, total_receptions')
                    .gte('stat_date', fromDate);

                // Fetch streaks
                const { data: streaks } = await supabase
                    .from('user_streaks')
                    .select('user_id, current_clean_receptions');

                // Fetch profiles
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('role', ['operator', 'logistics', 'admin']);

                if (!statsData || !profiles) { setLoading(false); return; }

                // Aggregate per user
                const userMap = new Map<string, {
                    receptions: number; kg: number; diffs: number; clean: number; total: number;
                }>();

                for (const row of statsData) {
                    const existing = userMap.get(row.user_id) || { receptions: 0, kg: 0, diffs: 0, clean: 0, total: 0 };
                    existing.receptions += row.receptions_count || 0;
                    existing.kg += row.kg_managed || 0;
                    existing.diffs += row.differences_detected || 0;
                    existing.clean += row.clean_receptions || 0;
                    existing.total += row.total_receptions || 0;
                    userMap.set(row.user_id, existing);
                }

                const streakMap = new Map<string, number>();
                for (const s of (streaks || [])) {
                    streakMap.set(s.user_id, s.current_clean_receptions || 0);
                }

                const result: EmployeePerf[] = [];
                for (const p of profiles) {
                    const agg = userMap.get(p.id);
                    if (!agg || agg.total === 0) continue;
                    result.push({
                        user_id: p.id,
                        full_name: p.full_name || p.email?.split('@')[0] || 'Unknown',
                        email: p.email || '',
                        total_receptions: agg.receptions,
                        total_kg: parseFloat(agg.kg.toFixed(1)),
                        clean_pct: Math.round((agg.clean / agg.total) * 100),
                        differences: agg.diffs,
                        streak: streakMap.get(p.id) || 0,
                    });
                }

                result.sort((a, b) => b.total_kg - a.total_kg);
                setEmployees(result);
            } catch (err) {
                console.warn('[ManagerPerf] Load failed:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [dateRange]);

    return (
        <div className="erp-card p-5 space-y-4 erp-animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFB020] to-[#FF8C00] flex items-center justify-center">
                        <BarChart3 size={14} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Rendimiento Operativo</h3>
                </div>
                {/* Date range selector */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--input-bg)' }}>
                    {(['today', 'week', 'month'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${dateRange === range
                                    ? 'bg-[#2E7BFF] text-white shadow-sm'
                                    : 'hover:bg-white/[0.04]'
                                }`}
                            style={dateRange !== range ? { color: 'var(--text-muted)' } : undefined}
                        >
                            {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : 'Mes'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--input-bg)' }} />
                    ))}
                </div>
            ) : employees.length === 0 ? (
                <div className="text-center py-6">
                    <Users size={24} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sin datos de rendimiento para este período</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {/* Table header */}
                    <div className="grid grid-cols-6 gap-2 px-3 py-1.5">
                        <span className="col-span-2 text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Operador</span>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Recep.</span>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Kg</span>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Precisión</span>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-right" style={{ color: 'var(--text-muted)' }}>Racha</span>
                    </div>

                    {employees.map((emp, i) => (
                        <div
                            key={emp.user_id}
                            className="grid grid-cols-6 gap-2 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.02]"
                            style={i % 2 === 0 ? { background: 'rgba(255,255,255,0.008)' } : undefined}
                        >
                            <div className="col-span-2 flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ background: `hsl(${(i * 60) % 360}, 60%, 50%)` }}>
                                    {emp.full_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                    {emp.full_name}
                                </span>
                            </div>
                            <span className="text-xs font-bold text-right" style={{ color: 'var(--text-primary)' }}>
                                {emp.total_receptions}
                            </span>
                            <span className="text-xs font-bold text-right text-[#2E7BFF]">
                                {emp.total_kg}
                            </span>
                            <span className={`text-xs font-bold text-right ${emp.clean_pct >= 90 ? 'text-[#10B981]' : emp.clean_pct >= 70 ? 'text-[#FFB020]' : 'text-[#EF4444]'
                                }`}>
                                {emp.clean_pct}%
                            </span>
                            <div className="flex items-center justify-end gap-1">
                                {emp.streak >= 3 && <Flame size={10} className="text-[#FFB020]" />}
                                <span className="text-xs font-bold text-right" style={{ color: emp.streak >= 3 ? '#FFB020' : 'var(--text-muted)' }}>
                                    {emp.streak}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
