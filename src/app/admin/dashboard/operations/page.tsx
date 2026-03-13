"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Package, Scale, AlertTriangle,
    ChevronRight, ArrowLeft, Shield, FileWarning,
    Activity, Zap, Target, BarChart3, Truck
} from 'lucide-react';
import { SHIPMENT_STATUSES } from '@/lib/constants';

// ── Status Pipeline Stages ──
const PIPELINE_STAGES = [
    { key: 'creada', label: 'Creadas', statuses: ['Guía Creada'], color: '#64748B' },
    { key: 'transito', label: 'En Tránsito', statuses: [...SHIPMENT_STATUSES.TRANSIT.filter(s => s !== 'Guía Creada')], color: '#2E7BFF' },
    { key: 'recibido', label: 'En Depósito', statuses: ['Recibido en Oficina', 'Enviado BUE'], color: '#8B5CF6' },
    { key: 'liberado', label: 'Liberadas', statuses: ['Listo Para Entregar', 'Cerrado/Facturado'], color: '#00C2FF' },
    { key: 'entregado', label: 'Entregadas', statuses: [...SHIPMENT_STATUSES.DELIVERED], color: '#10B981' },
] as const;

interface ShipmentRow {
    id: string;
    internal_status: string;
    weight: number;
    date_shipped: string | null;
    date_arrived: string | null;
    created_at: string;
    delta_kg: number | null;
    delta_boxes: number | null;
    edited_post_delivery: boolean | null;
    reception_status: string | null;
    tracking_number: string | null;
    client_name: string | null;
}

export default function OperationsPage() {
    const [shipments, setShipments] = useState<ShipmentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [weeklyStats, setWeeklyStats] = useState<{ date: string; kg: number }[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // Fetch all active shipments
                const { data } = await supabase
                    .from('shipments')
                    .select('id, internal_status, weight, date_shipped, date_arrived, created_at, delta_kg, delta_boxes, edited_post_delivery, reception_status, tracking_number, client_name')
                    .order('created_at', { ascending: false });

                if (data) setShipments(data as ShipmentRow[]);

                // Weekly throughput (last 7 days)
                const days: { date: string; kg: number }[] = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().split('T')[0];
                    days.push({ date: dateStr, kg: 0 });
                }

                const { data: dailyStats } = await supabase
                    .from('user_daily_stats')
                    .select('stat_date, kg_managed')
                    .gte('stat_date', days[0].date);

                if (dailyStats) {
                    for (const row of dailyStats) {
                        const day = days.find(d => d.date === row.stat_date);
                        if (day) day.kg += row.kg_managed || 0;
                    }
                }
                setWeeklyStats(days);
            } catch (err) {
                console.warn('[Operations] Load failed:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── Computed metrics ──
    const today = new Date().toISOString().split('T')[0];

    const pipeline = useMemo(() => {
        return PIPELINE_STAGES.map(stage => {
            const items = shipments.filter(s =>
                stage.statuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase())
            );
            const kg = items.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
            return { ...stage, count: items.length, kg: parseFloat(kg.toFixed(1)) };
        });
    }, [shipments]);

    const totalActive = useMemo(() => {
        const deliveredStatuses = SHIPMENT_STATUSES.DELIVERED;
        return shipments.filter(s => !deliveredStatuses.some(ds => ds.toLowerCase() === (s.internal_status || '').toLowerCase())).length;
    }, [shipments]);

    const totalKgInSystem = useMemo(() => {
        const deliveredStatuses = SHIPMENT_STATUSES.DELIVERED;
        return parseFloat(
            shipments
                .filter(s => !deliveredStatuses.some(ds => ds.toLowerCase() === (s.internal_status || '').toLowerCase()))
                .reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
                .toFixed(1)
        );
    }, [shipments]);

    const receptionsToday = useMemo(() => {
        return shipments.filter(s => s.date_arrived === today).length;
    }, [shipments, today]);

    const expectedToday = useMemo(() => {
        // Shipments in transit created > 5 days ago (likely to arrive today)
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const cutoff = fiveDaysAgo.toISOString();
        return shipments.filter(s =>
            ['En Transito', 'Pendiente Expo'].some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase()) &&
            s.created_at < cutoff
        ).length;
    }, [shipments]);

    const completionPct = Math.min(Math.round((receptionsToday / Math.max(expectedToday, 1)) * 100), 100);

    // ── Alerts ──
    const alerts = useMemo(() => {
        const retenidas = shipments.filter(s => (s.internal_status || '').toLowerCase() === 'retenido');
        const withDiff = shipments.filter(s => s.delta_kg && Math.abs(s.delta_kg) > 1);
        const postEdit = shipments.filter(s => s.edited_post_delivery === true);
        const partial = shipments.filter(s => s.reception_status === 'PARTIAL');

        return [
            { label: 'Guías retenidas', count: retenidas.length, color: '#EF4444', icon: Shield, link: '/admin/dashboard/shipments?status=Retenido' },
            { label: 'Diferencia vs declarado', count: withDiff.length, color: '#FFB020', icon: FileWarning, link: '/admin/dashboard/shipments' },
            { label: 'Editadas post-entrega', count: postEdit.length, color: '#8B5CF6', icon: AlertTriangle, link: '/admin/dashboard/shipments' },
            { label: 'Recepciones parciales', count: partial.length, color: '#00C2FF', icon: Package, link: '/admin/dashboard/shipments' },
        ];
    }, [shipments]);

    // ── Throughput ──
    const avgDailyKg = useMemo(() => {
        const total = weeklyStats.reduce((sum, d) => sum + d.kg, 0);
        return parseFloat((total / 7).toFixed(1));
    }, [weeklyStats]);

    const todayKg = weeklyStats.find(d => d.date === today)?.kg || 0;
    const maxKgDay = Math.max(...weeklyStats.map(d => d.kg), 1);

    // ── Quality ──
    const qualityMetrics = useMemo(() => {
        const received = shipments.filter(s =>
            ['Recibido en Oficina', 'Enviado BUE', 'Listo Para Entregar', 'Cerrado/Facturado', 'Entregado', 'Retirado', 'Despachado', 'Mercado Libre full']
                .some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase())
        );
        if (received.length === 0) return { noDiff: 100, noEdit: 100 };
        const noDiff = Math.round((received.filter(s => !s.delta_kg || Math.abs(s.delta_kg) < 0.5).length / received.length) * 100);
        const noEdit = Math.round((received.filter(s => !s.edited_post_delivery).length / received.length) * 100);
        return { noDiff, noEdit };
    }, [shipments]);

    // ── Pipeline max for congestion highlight ──
    const maxPipelineCount = Math.max(...pipeline.slice(0, -1).map(s => s.count), 1);

    if (loading) {
        return (
            <div className="space-y-4 erp-page-enter">
                <div className="h-10 w-64 rounded-lg animate-pulse" style={{ background: 'var(--input-bg)' }} />
                <div className="grid grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="erp-card h-24 animate-pulse" />)}
                </div>
                <div className="erp-card h-32 animate-pulse" />
                <div className="grid grid-cols-2 gap-3">
                    <div className="erp-card h-48 animate-pulse" />
                    <div className="erp-card h-48 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 erp-page-enter">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/admin/dashboard" className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors" style={{ color: 'var(--text-muted)' }}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            Control de Operaciones
                        </h1>
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            Logistics Control Surface — {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 1: TODAY SNAPSHOT ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 erp-stagger">
                <SnapshotCard
                    icon={<Package size={16} />}
                    label="Guías Activas"
                    value={totalActive.toString()}
                    accent="#2E7BFF"
                />
                <SnapshotCard
                    icon={<Scale size={16} />}
                    label="Kg en Sistema"
                    value={totalKgInSystem.toLocaleString('es-AR')}
                    accent="#8B5CF6"
                />
                <SnapshotCard
                    icon={<Truck size={16} />}
                    label="Esperadas Hoy"
                    value={expectedToday.toString()}
                    accent="#00C2FF"
                />
                <SnapshotCard
                    icon={<Target size={16} />}
                    label="Recibidas Hoy"
                    value={receptionsToday.toString()}
                    accent="#10B981"
                />
                <div className="erp-card p-4 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Activity size={12} style={{ color: completionPct >= 80 ? '#10B981' : completionPct >= 50 ? '#FFB020' : 'var(--text-muted)' }} />
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            % del día
                        </span>
                    </div>
                    <div className="text-2xl font-black" style={{ color: completionPct >= 80 ? '#10B981' : completionPct >= 50 ? '#FFB020' : 'var(--text-primary)' }}>
                        {completionPct}%
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden mt-2" style={{ background: 'var(--input-bg)' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${completionPct}%` }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: completionPct >= 80 ? '#10B981' : completionPct >= 50 ? '#FFB020' : '#2E7BFF' }}
                        />
                    </div>
                </div>
            </div>

            {/* ═══ SECTION 2: FLOW PIPELINE ═══ */}
            <div className="erp-card p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                    Pipeline Operativo
                </h3>
                <div className="flex items-stretch gap-1">
                    {pipeline.map((stage, i) => {
                        const isCongested = stage.count === maxPipelineCount && stage.count > 5 && i < pipeline.length - 1;
                        return (
                            <React.Fragment key={stage.key}>
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08, duration: 0.4 }}
                                    className={`flex-1 rounded-xl p-3 relative overflow-hidden transition-all ${isCongested ? 'ring-1' : ''}`}
                                    style={{
                                        background: `${stage.color}08`,
                                        borderLeft: `3px solid ${stage.color}`,
                                        ...(isCongested ? { ringColor: `${stage.color}40` } : {}),
                                    }}
                                >
                                    {isCongested && (
                                        <div className="absolute top-1.5 right-1.5">
                                            <span className="flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: stage.color }} />
                                                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: stage.color }} />
                                            </span>
                                        </div>
                                    )}
                                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: stage.color }}>
                                        {stage.label}
                                    </div>
                                    <div className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                                        {stage.count}
                                    </div>
                                    <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {stage.kg.toLocaleString('es-AR')} kg
                                    </div>
                                </motion.div>
                                {i < pipeline.length - 1 && (
                                    <div className="flex items-center px-0.5" style={{ color: 'var(--text-muted)', opacity: 0.3 }}>
                                        <ChevronRight size={14} />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* ═══ SECTION 3: OPERATIONAL ALERTS ═══ */}
            <div className="erp-card p-5" style={{ border: alerts.some(a => a.count > 0) ? '1px solid rgba(239,68,68,0.15)' : undefined }}>
                <h3 className="text-[10px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: alerts.some(a => a.count > 0) ? '#EF4444' : 'var(--text-muted)' }}>
                    <AlertTriangle size={12} />
                    Alertas Operativas
                    {alerts.reduce((s, a) => s + a.count, 0) > 0 && (
                        <span className="erp-badge erp-badge-red">{alerts.reduce((s, a) => s + a.count, 0)}</span>
                    )}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {alerts.map(alert => (
                        <Link
                            key={alert.label}
                            href={alert.link}
                            className="rounded-xl p-3 flex items-center gap-3 transition-all hover:scale-[1.01] group"
                            style={{
                                background: alert.count > 0 ? `${alert.color}08` : 'var(--input-bg)',
                                border: alert.count > 0 ? `1px solid ${alert.color}20` : '1px solid transparent',
                            }}
                        >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${alert.color}15` }}>
                                <alert.icon size={14} style={{ color: alert.color }} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-lg font-black" style={{ color: alert.count > 0 ? alert.color : 'var(--text-muted)' }}>
                                    {alert.count}
                                </div>
                                <div className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
                                    {alert.label}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* ═══ SECTIONS 4+5+6: Throughput + Quality ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Throughput */}
                <div className="erp-card p-5 space-y-4 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                            <BarChart3 size={12} />
                            Capacidad & Throughput
                        </h3>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Hoy</div>
                                <div className="text-sm font-bold text-[#2E7BFF]">{todayKg.toFixed(1)} kg</div>
                            </div>
                            <div className="w-px h-6" style={{ background: 'var(--card-border)' }} />
                            <div className="text-right">
                                <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Prom. 7d</div>
                                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{avgDailyKg} kg</div>
                            </div>
                        </div>
                    </div>

                    {/* Mini sparkline */}
                    <div className="flex items-end gap-1 h-16">
                        {weeklyStats.map((day, i) => {
                            const height = Math.max((day.kg / maxKgDay) * 100, 4);
                            const isToday = day.date === today;
                            return (
                                <motion.div
                                    key={day.date}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                    className="flex-1 rounded-t-md relative group cursor-default"
                                    style={{
                                        background: isToday
                                            ? 'linear-gradient(to top, #2E7BFF, #00C2FF)'
                                            : 'var(--input-bg)',
                                        minHeight: '3px',
                                    }}
                                    title={`${day.date}: ${day.kg.toFixed(1)} kg`}
                                >
                                    {/* Day label */}
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] font-bold" style={{ color: isToday ? '#2E7BFF' : 'var(--text-muted)' }}>
                                        {['D', 'L', 'M', 'X', 'J', 'V', 'S'][new Date(day.date + 'T12:00').getDay()]}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                    <div className="h-3" /> {/* spacer for day labels */}
                </div>

                {/* Quality Metrics */}
                <div className="erp-card p-5 space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                        <Zap size={12} />
                        Calidad Operativa
                    </h3>

                    <QualityGauge label="Sin diferencias" value={qualityMetrics.noDiff} />
                    <QualityGauge label="Sin edición posterior" value={qualityMetrics.noEdit} />

                    <div className="pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                Recibidos hoy
                            </span>
                            <span className="text-sm font-bold text-[#10B981]">{receptionsToday}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ──

function SnapshotCard({ icon, label, value, accent }: {
    icon: React.ReactNode; label: string; value: string; accent: string;
}) {
    return (
        <div className="erp-card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-2">
                <span style={{ color: accent }}>{icon}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <div className="text-2xl font-black erp-count-animate" style={{ color: accent }}>
                {value}
            </div>
        </div>
    );
}

function QualityGauge({ label, value }: { label: string; value: number }) {
    const color = value >= 90 ? '#10B981' : value >= 70 ? '#FFB020' : '#EF4444';
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-sm font-bold" style={{ color }}>{value}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--input-bg)' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                />
            </div>
        </div>
    );
}
