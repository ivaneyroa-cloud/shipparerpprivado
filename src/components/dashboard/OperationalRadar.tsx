"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    AlertTriangle, Clock, Shield, Scale, Package,
    TrendingDown, TrendingUp, ChevronRight, CheckCircle2
} from 'lucide-react';

interface ShipmentMinimal {
    id: string;
    internal_status: string;
    weight: number;
    created_at: string;
    date_shipped: string | null;
    date_arrived: string | null;
    delta_kg: number | null;
    updated_at: string | null;
}

interface DailyStat {
    stat_date: string;
    kg_managed: number;
}

// ── Constants ──
const TRANSIT_THRESHOLD_DAYS = 10;
const STALE_GUIA_HOURS = 48;

export function OperationalRadar() {
    const [shipments, setShipments] = useState<ShipmentMinimal[]>([]);
    const [weeklyKg, setWeeklyKg] = useState<DailyStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data: shData } = await supabase
                    .from('shipments')
                    .select('id, internal_status, weight, created_at, date_shipped, date_arrived, delta_kg, updated_at')
                    .order('created_at', { ascending: false })
                    .limit(500);

                if (shData) setShipments(shData as ShipmentMinimal[]);

                // Last 7 days stats
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const { data: statsData } = await supabase
                    .from('user_daily_stats')
                    .select('stat_date, kg_managed')
                    .gte('stat_date', sevenDaysAgo.toISOString().split('T')[0]);

                if (statsData) setWeeklyKg(statsData);
            } catch (err) {
                console.warn('[Radar] Load failed:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // ═══ BLOCK 1: OPERATIONAL ALERTS ═══
    const alerts = useMemo(() => {
        const result: { id: string; label: string; count: number; severity: 'red' | 'amber'; icon: React.ElementType; link: string }[] = [];

        // 1. Long transit (> N days)
        const transitCutoff = new Date(now);
        transitCutoff.setDate(transitCutoff.getDate() - TRANSIT_THRESHOLD_DAYS);
        const longTransit = shipments.filter(s =>
            ['En Transito', 'Pendiente Expo'].some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase()) &&
            new Date(s.created_at) < transitCutoff
        );
        if (longTransit.length > 0) {
            result.push({ id: 'long_transit', label: `Más de ${TRANSIT_THRESHOLD_DAYS} días en tránsito`, count: longTransit.length, severity: 'amber', icon: Clock, link: '/admin/dashboard/shipments?status=En Transito' });
        }

        // 2. Stale guias (created > 48h, no movement)
        const staleCutoff = new Date(now);
        staleCutoff.setHours(staleCutoff.getHours() - STALE_GUIA_HOURS);
        const staleGuias = shipments.filter(s =>
            (s.internal_status || '').toLowerCase() === 'guía creada' &&
            new Date(s.created_at) < staleCutoff
        );
        if (staleGuias.length > 0) {
            result.push({ id: 'stale_guias', label: `Guías sin recolección > ${STALE_GUIA_HOURS}h`, count: staleGuias.length, severity: 'amber', icon: Package, link: '/admin/dashboard/shipments?status=Guía Creada' });
        }

        // 3. Retenciones hoy
        const retenidosHoy = shipments.filter(s =>
            (s.internal_status || '').toLowerCase() === 'retenido' &&
            s.updated_at && s.updated_at.startsWith(today)
        );
        if (retenidosHoy.length > 0) {
            result.push({ id: 'retenidos_hoy', label: 'Nuevas retenciones hoy', count: retenidosHoy.length, severity: 'red', icon: Shield, link: '/admin/dashboard/shipments?status=Retenido' });
        }

        // 4. All retenidos
        const allRetenidos = shipments.filter(s => (s.internal_status || '').toLowerCase() === 'retenido');
        if (allRetenidos.length > 0 && retenidosHoy.length === 0) {
            result.push({ id: 'retenidos_total', label: 'Guías retenidas activas', count: allRetenidos.length, severity: 'red', icon: Shield, link: '/admin/dashboard/shipments?status=Retenido' });
        }

        // 5. Diferencias de peso hoy
        const diffHoy = shipments.filter(s =>
            s.delta_kg && Math.abs(s.delta_kg) > 1 &&
            s.date_arrived === today
        );
        if (diffHoy.length > 0) {
            result.push({ id: 'diff_hoy', label: 'Diferencias de peso hoy', count: diffHoy.length, severity: 'amber', icon: Scale, link: '/admin/dashboard/deposito' });
        }

        // Sort: red first
        result.sort((a, b) => (a.severity === 'red' ? -1 : 1) - (b.severity === 'red' ? -1 : 1));
        return result;
    }, [shipments, today]);

    // ═══ BLOCK 2: VOLUME CONTEXT ═══
    const volumeContext = useMemo(() => {
        const todayKg = shipments
            .filter(s => s.date_arrived === today)
            .reduce((sum, s) => sum + (Number(s.weight) || 0), 0);

        // 7-day average from daily stats
        const totalWeekly = weeklyKg.reduce((sum, d) => sum + (d.kg_managed || 0), 0);
        const avgDaily = weeklyKg.length > 0 ? totalWeekly / 7 : 0;
        const variation = avgDaily > 0 ? Math.round(((todayKg - avgDaily) / avgDaily) * 100) : 0;

        // Build sparkline data (last 7 days)
        const days: { date: string; kg: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayKg = weeklyKg
                .filter(s => s.stat_date === dateStr)
                .reduce((sum, s) => sum + (s.kg_managed || 0), 0);
            days.push({ date: dateStr, kg: dayKg });
        }

        return { todayKg: parseFloat(todayKg.toFixed(1)), avgDaily: parseFloat(avgDaily.toFixed(1)), variation, sparkline: days };
    }, [shipments, weeklyKg, today]);

    // ═══ BLOCK 3: BOTTLENECK ═══
    const bottleneck = useMemo(() => {
        const stages = [
            { key: 'creada', label: 'Guías creadas', statuses: ['Guía Creada'], color: '#64748B' },
            { key: 'pendiente', label: 'Pendiente expo', statuses: ['Pendiente Expo'], color: '#FFB020' },
            { key: 'transito', label: 'En tránsito', statuses: ['En Transito'], color: '#2E7BFF' },
            { key: 'deposito', label: 'En depósito', statuses: ['Recibido en Oficina', 'Enviado BUE'], color: '#8B5CF6' },
            { key: 'retenido', label: 'Retenidos', statuses: ['Retenido'], color: '#EF4444' },
        ];

        return stages.map(stage => {
            const count = shipments.filter(s =>
                stage.statuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase())
            ).length;
            return { ...stage, count };
        });
    }, [shipments]);

    const maxBottleneck = Math.max(...bottleneck.map(s => s.count), 1);
    const totalInPipeline = bottleneck.reduce((sum, s) => sum + s.count, 0);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="erp-card h-16 animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                    <div className="erp-card h-28 animate-pulse" />
                    <div className="erp-card h-28 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 erp-animate-in">
            {/* ═══ BLOCK 1: OPERATIONAL ALERTS ═══ */}
            {alerts.length > 0 ? (
                <div
                    className="erp-card p-4 space-y-3"
                    style={{
                        borderColor: alerts.some(a => a.severity === 'red') ? 'rgba(239,68,68,0.2)' : 'rgba(255,176,32,0.2)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                    }}
                >
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={13} style={{ color: alerts.some(a => a.severity === 'red') ? '#EF4444' : '#FFB020' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: alerts.some(a => a.severity === 'red') ? '#EF4444' : '#FFB020' }}>
                            {alerts.length} alerta{alerts.length > 1 ? 's' : ''} activa{alerts.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {alerts.map(alert => (
                            <Link
                                key={alert.id}
                                href={alert.link}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] group"
                                style={{
                                    background: alert.severity === 'red' ? 'rgba(239,68,68,0.06)' : 'rgba(255,176,32,0.06)',
                                }}
                            >
                                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                                    style={{ background: alert.severity === 'red' ? 'rgba(239,68,68,0.12)' : 'rgba(255,176,32,0.12)' }}>
                                    <alert.icon size={13} style={{ color: alert.severity === 'red' ? '#EF4444' : '#FFB020' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-base font-black" style={{ color: alert.severity === 'red' ? '#EF4444' : '#FFB020' }}>
                                        {alert.count}
                                    </div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
                                        {alert.label}
                                    </div>
                                </div>
                                <ChevronRight size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--text-muted)' }} />
                            </Link>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="erp-card px-4 py-3 flex items-center gap-2" style={{ borderColor: 'rgba(16,185,129,0.15)', borderWidth: '1px', borderStyle: 'solid' }}>
                    <CheckCircle2 size={14} className="text-[#10B981]" />
                    <span className="text-xs font-semibold text-[#10B981]">Operación estable</span>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>— sin alertas activas</span>
                </div>
            )}

            {/* ═══ BLOCKS 2 + 3: Volume + Bottleneck ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* BLOCK 2: Volume vs Context */}
                <div className="erp-card p-4 space-y-3">
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Volumen Hoy vs Contexto
                    </div>
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <div className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                                {volumeContext.todayKg} <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>kg</span>
                            </div>
                            <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Promedio 7d: {volumeContext.avgDaily} kg
                            </div>
                        </div>
                        {/* Variation badge */}
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${volumeContext.variation >= 0
                            ? 'bg-[#10B981]/10 text-[#10B981]'
                            : 'bg-[#FFB020]/10 text-[#FFB020]'
                            }`}>
                            {volumeContext.variation >= 0
                                ? <TrendingUp size={12} />
                                : <TrendingDown size={12} />
                            }
                            {volumeContext.variation >= 0 ? '+' : ''}{volumeContext.variation}%
                        </div>
                    </div>

                    {/* Mini sparkline */}
                    <div className="flex items-end gap-[3px] h-8 pt-1">
                        {volumeContext.sparkline.map((day, i) => {
                            const maxKg = Math.max(...volumeContext.sparkline.map(d => d.kg), 1);
                            const height = Math.max((day.kg / maxKg) * 100, 6);
                            const isToday = day.date === today;
                            return (
                                <motion.div
                                    key={day.date}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                    className="flex-1 rounded-sm"
                                    style={{
                                        background: isToday ? '#2E7BFF' : 'var(--input-bg)',
                                        minHeight: '2px',
                                    }}
                                    title={`${day.date}: ${day.kg.toFixed(1)} kg`}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* BLOCK 3: Bottleneck */}
                <div className="erp-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Distribución Pipeline
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                            {totalInPipeline} en proceso
                        </span>
                    </div>
                    <div className="space-y-2">
                        {bottleneck.map(stage => {
                            const pct = Math.max((stage.count / maxBottleneck) * 100, 0);
                            const isCongested = stage.count === maxBottleneck && stage.count > 3;
                            return (
                                <div key={stage.key} className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold w-20 text-right truncate" style={{ color: isCongested ? stage.color : 'var(--text-muted)' }}>
                                        {stage.label}
                                    </span>
                                    <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: 'var(--input-bg)' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                            className="h-full rounded-sm"
                                            style={{
                                                background: isCongested
                                                    ? `linear-gradient(90deg, ${stage.color}, ${stage.color}cc)`
                                                    : `${stage.color}40`,
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold w-8 text-right" style={{ color: isCongested ? stage.color : 'var(--text-primary)' }}>
                                        {stage.count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
