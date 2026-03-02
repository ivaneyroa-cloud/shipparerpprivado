'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, Search, Package, Weight, DollarSign, AlertTriangle,
    TrendingUp, Edit3, Eye, X, History, CheckCircle2, Clock,
    ChevronDown, Filter, Layers, ArrowUpDown
} from 'lucide-react';
import { Shipment, ShipmentPackage, ReceptionVersion } from '@/types';

type TimeFilter = 'today' | 'week' | 'month';

// ── USD/kg anomaly thresholds ──
const USD_KG_MIN = 2;
const USD_KG_MAX = 25;

function computeUsdPerKg(costoFlete: number, pesoComputable: number): number | null {
    if (!pesoComputable || pesoComputable <= 0) return null;
    return parseFloat(((costoFlete || 0) / pesoComputable).toFixed(2));
}

export default function GerenciaPage() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
    const [searchTerm, setSearchTerm] = useState('');
    const [flagFilter, setFlagFilter] = useState<string>('all');
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [versions, setVersions] = useState<ReceptionVersion[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // ── Fetch ──
    useEffect(() => { fetchShipments(); }, [timeFilter]);

    const fetchShipments = async () => {
        setLoading(true);
        const now = new Date();
        let since: Date;
        if (timeFilter === 'today') {
            since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (timeFilter === 'week') {
            since = new Date(now.getTime() - 7 * 86400000);
        } else {
            since = new Date(now.getTime() - 30 * 86400000);
        }

        const { data, error } = await supabase
            .from('shipments')
            .select('id, tracking_number, client_name, client_code, internal_status, date_arrived, weight, peso_computable, bultos, boxes_count, costo_flete, reception_status, delta_kg, delta_boxes, edited_post_delivery, reception_version_count, invoice_photo_1, invoice_photo_2, estado_cobranza, updated_at, created_at')
            .not('reception_status', 'eq', 'PENDING')
            .gte('updated_at', since.toISOString())
            .order('updated_at', { ascending: false });

        if (!error && data) setShipments(data as Shipment[]);
        setLoading(false);
    };

    // ── Enriched data ──
    const enriched = useMemo(() => {
        return shipments.map(s => {
            const usdKg = computeUsdPerKg(s.costo_flete || 0, s.peso_computable || 0);
            const financialFlag = usdKg !== null && (usdKg < USD_KG_MIN || usdKg > USD_KG_MAX);
            const hasDelta = (s.delta_kg && Math.abs(s.delta_kg) > 0.5) || (s.delta_boxes && s.delta_boxes !== 0);
            const isEdited = (s.reception_version_count || 0) > 1;
            return { ...s, usdKg, financialFlag, hasDelta, isEdited };
        });
    }, [shipments]);

    // ── Filtered ──
    const filtered = useMemo(() => {
        return enriched.filter(s => {
            const matchesSearch =
                s.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.client_name?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (flagFilter === 'delta') return s.hasDelta;
            if (flagFilter === 'financial') return s.financialFlag;
            if (flagFilter === 'edited') return s.isEdited;
            if (flagFilter === 'post_delivery') return s.edited_post_delivery;
            return true;
        });
    }, [enriched, searchTerm, flagFilter]);

    // ── KPIs ──
    const kpis = useMemo(() => {
        const receptions = enriched.length;
        const totalKg = enriched.reduce((s, r) => s + (r.peso_computable || 0), 0);
        const avgKg = receptions > 0 ? totalKg / receptions : 0;
        const withDelta = enriched.filter(r => r.hasDelta).length;
        const withFinancialFlag = enriched.filter(r => r.financialFlag).length;
        const editedCount = enriched.filter(r => r.isEdited).length;
        const postDelivery = enriched.filter(r => r.edited_post_delivery).length;
        return { receptions, totalKg, avgKg, withDelta, withFinancialFlag, editedCount, postDelivery };
    }, [enriched]);

    // ── Detail modal ──
    const openDetail = async (s: Shipment) => {
        setSelectedShipment(s);
        // Fetch versions
        const { data: v } = await supabase
            .from('reception_versions')
            .select('*')
            .eq('shipment_id', s.id)
            .order('version_number', { ascending: false });
        setVersions((v as ReceptionVersion[]) || []);
        // Fetch audit
        const { data: logs } = await supabase
            .from('activity_logs')
            .select('*')
            .or(`details->>shipment_id.eq.${s.id},details.cs.{"shipment_id":"${s.id}"}`)
            .in('action', ['reception_edit', 'reception_edit_post_delivery'])
            .order('created_at', { ascending: false })
            .limit(20);
        setAuditLogs(logs || []);
    };

    const timeLabels: Record<TimeFilter, string> = { today: 'Hoy', week: '7 días', month: '30 días' };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Shield className="text-blue-500" size={24} /> Gerencia de Operación
                    </h1>
                    <p className="text-sm text-slate-500 font-medium mt-1">Control operativo de recepciones, anomalías y auditoría</p>
                </div>

                {/* Time filter */}
                <div className="flex items-center gap-1 bg-white dark:bg-[#1C1C1E] p-1.5 rounded-xl border border-slate-200 dark:border-[#2C2C2E]">
                    {(['today', 'week', 'month'] as TimeFilter[]).map(t => (
                        <button key={t} onClick={() => setTimeFilter(t)}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${timeFilter === t ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            {timeLabels[t]}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                    { label: 'Recepciones', value: kpis.receptions, icon: <Package size={16} />, color: 'blue' },
                    { label: 'Kg computables', value: kpis.totalKg.toFixed(1), icon: <Weight size={16} />, color: 'indigo' },
                    { label: 'Prom. kg/rec', value: kpis.avgKg.toFixed(1), icon: <TrendingUp size={16} />, color: 'cyan' },
                    { label: 'Con diferencia', value: kpis.withDelta, icon: <AlertTriangle size={16} />, color: 'amber', alert: kpis.withDelta > 0 },
                    { label: 'USD/kg anómalo', value: kpis.withFinancialFlag, icon: <DollarSign size={16} />, color: 'red', alert: kpis.withFinancialFlag > 0 },
                    { label: 'Editadas', value: kpis.editedCount, icon: <Edit3 size={16} />, color: 'purple', alert: kpis.editedCount > 0 },
                    { label: 'Post-entrega', value: kpis.postDelivery, icon: <Shield size={16} />, color: 'red', alert: kpis.postDelivery > 0 },
                ].map((card, i) => (
                    <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className={`border rounded-2xl p-4 transition-all ${card.alert ? `border-${card.color}-300 dark:border-${card.color}-500/30 bg-${card.color}-50 dark:bg-${card.color}-500/5` : 'border-slate-200 dark:border-white/8 bg-white dark:bg-[#1C1C1E]'}`}>
                        <div className={`text-${card.color}-500 mb-2`}>{card.icon}</div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{card.value}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{card.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* ── Search + Flag filters ── */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input type="text" placeholder="Buscar por guía o cliente..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#1C1C1E] border-2 border-slate-200 dark:border-[#2C2C2E] rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-[#1C1C1E] p-1 rounded-xl border border-slate-200 dark:border-[#2C2C2E] flex-wrap">
                    {[
                        { key: 'all', label: 'Todos', count: enriched.length },
                        { key: 'delta', label: 'Diferencia', count: kpis.withDelta },
                        { key: 'financial', label: 'USD/kg', count: kpis.withFinancialFlag },
                        { key: 'edited', label: 'Editadas', count: kpis.editedCount },
                        { key: 'post_delivery', label: 'Post-entrega', count: kpis.postDelivery },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFlagFilter(f.key)}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${flagFilter === f.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            {f.label}
                            {f.count > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${flagFilter === f.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/10'}`}>{f.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Drill-down table ── */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-slate-200 dark:border-[#2C2C2E] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 [&>th]:px-3 [&>th]:py-3 [&>th]:text-[9px] [&>th]:font-black [&>th]:uppercase [&>th]:tracking-widest [&>th]:text-slate-500">
                                <th>Fecha</th>
                                <th>Guía</th>
                                <th>Cliente</th>
                                <th className="text-center">Cajas</th>
                                <th className="text-right">Kg comp.</th>
                                <th className="text-right">Factura</th>
                                <th className="text-right">USD/kg</th>
                                <th className="text-center">Cobranza</th>
                                <th className="text-center">Flags</th>
                                <th className="text-center">Ver</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {loading ? (
                                <tr><td colSpan={10} className="px-6 py-16 text-center text-slate-400 text-sm font-bold">Cargando...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={10} className="px-6 py-16 text-center text-slate-400 text-sm font-bold">No hay recepciones en este período</td></tr>
                            ) : (
                                filtered.map(s => {
                                    const usdKgDisplay = s.usdKg !== null ? `$${s.usdKg}` : '—';
                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group" onClick={() => openDetail(s)}>
                                            <td className="px-3 py-3">
                                                <span className="text-xs font-bold text-slate-500">{s.date_arrived || s.updated_at?.slice(0, 10) || '—'}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 uppercase">{s.tracking_number}</span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px] block">{s.client_name}</span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="text-xs font-black text-slate-600 dark:text-slate-400">{s.boxes_count || 0}</span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{(s.peso_computable || 0).toFixed(1)}</span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-xs font-bold text-emerald-600">${(s.costo_flete || 0).toFixed(0)}</span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${s.financialFlag ? 'bg-red-100  dark:bg-red-500/15 text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                                                    {usdKgDisplay}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {s.estado_cobranza === 'Pagado' ? (
                                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg">PAGADO</span>
                                                ) : (
                                                    <span className="text-[9px] font-black text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-lg">PENDIENTE</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="flex items-center gap-1 justify-center flex-wrap">
                                                    {s.hasDelta && <span className="w-2 h-2 rounded-full bg-amber-500" title="Diferencia vs declarado" />}
                                                    {s.financialFlag && <span className="w-2 h-2 rounded-full bg-red-500" title="USD/kg anómalo" />}
                                                    {s.isEdited && <span className="w-2 h-2 rounded-full bg-purple-500" title="Editada" />}
                                                    {s.edited_post_delivery && <span className="w-2 h-2 rounded-full bg-red-600 ring-2 ring-red-300 dark:ring-red-500/30" title="Post-entrega" />}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <Eye size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors mx-auto" />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400">
                    {filtered.length} recepción{filtered.length !== 1 ? 'es' : ''} · {timeLabels[timeFilter]}
                </div>
            </div>

            {/* ── Detail Modal ── */}
            <AnimatePresence>
                {selectedShipment && (
                    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-[#1c1c1e] w-full max-w-4xl rounded-[28px] shadow-2xl border border-slate-200 dark:border-white/10 my-auto">
                            <div className="p-6 md:p-8 space-y-6">
                                {/* Detail Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                            <Eye className="text-blue-500" size={22} /> Detalle de Recepción
                                        </h2>
                                        <p className="text-sm font-bold text-slate-500 mt-1">
                                            <span className="text-blue-600 font-mono uppercase">{selectedShipment.tracking_number}</span>
                                            <span className="text-slate-400 mx-2">·</span>
                                            {selectedShipment.client_name}
                                            {selectedShipment.edited_post_delivery && (
                                                <span className="ml-2 text-[10px] font-black text-red-500 bg-red-100 dark:bg-red-500/15 px-2 py-0.5 rounded-full">⚠ EDITADO POST-ENTREGA</span>
                                            )}
                                        </p>
                                    </div>
                                    <button onClick={() => setSelectedShipment(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                        <X size={24} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Summary cards */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                    {[
                                        { label: 'Cajas', value: selectedShipment.boxes_count || 0 },
                                        { label: 'Kg computable', value: (selectedShipment.peso_computable || 0).toFixed(1) },
                                        { label: 'Factura USD', value: `$${(selectedShipment.costo_flete || 0).toFixed(2)}` },
                                        { label: 'USD/kg', value: (() => { const v = computeUsdPerKg(selectedShipment.costo_flete || 0, selectedShipment.peso_computable || 0); return v !== null ? `$${v}` : '—'; })() },
                                        { label: 'Versiones', value: selectedShipment.reception_version_count || 1 },
                                    ].map(c => (
                                        <div key={c.label} className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/8 rounded-xl p-3 text-center">
                                            <p className="text-lg font-black text-slate-900 dark:text-white">{c.value}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Attachments */}
                                {(selectedShipment.invoice_photo_1 || selectedShipment.invoice_photo_2) && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Facturas adjuntas</p>
                                        <div className="flex gap-3">
                                            {[selectedShipment.invoice_photo_1, selectedShipment.invoice_photo_2].filter(Boolean).map((url, i) => (
                                                <a key={i} href={url!} target="_blank" rel="noopener noreferrer"
                                                    className="w-24 h-24 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-center hover:border-blue-500 transition-colors overflow-hidden">
                                                    <img src={url!} alt={`Factura ${i + 1}`} className="w-full h-full object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Per-box breakdown */}
                                {Array.isArray(selectedShipment.bultos) && selectedShipment.bultos.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Detalle por caja</p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs border-collapse">
                                                <thead>
                                                    <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-[9px] [&>th]:font-black [&>th]:uppercase [&>th]:text-slate-400 [&>th]:tracking-widest border-b border-slate-200 dark:border-white/10">
                                                        <th className="text-left">#</th><th>Largo</th><th>Ancho</th><th>Alto</th><th>P. Físico</th><th>P. Vol.</th><th>Computable</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {(selectedShipment.bultos as ShipmentPackage[]).map((b, i) => (
                                                        <tr key={i} className="[&>td]:px-3 [&>td]:py-2 font-bold text-slate-700 dark:text-slate-300">
                                                            <td className="text-slate-400">Caja {i + 1}</td>
                                                            <td>{b.largo} cm</td><td>{b.ancho} cm</td><td>{b.alto} cm</td>
                                                            <td>{b.peso_fisico} kg</td><td>{b.peso_volumetrico} kg</td>
                                                            <td className="font-black text-blue-600 dark:text-blue-400">{b.peso_computable} kg</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Version history */}
                                {versions.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                            <History size={11} /> Historial de versiones
                                        </p>
                                        <div className="space-y-2">
                                            {versions.map((v, i) => (
                                                <div key={v.id} className={`border rounded-xl p-3 ${v.is_post_delivery ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5' : 'border-slate-200 dark:border-white/8'}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">v{v.version_number}</span>
                                                            {i === 0 && <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">ACTUAL</span>}
                                                            {v.is_post_delivery && <span className="text-[9px] font-black text-red-500 bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded">POST-ENTREGA</span>}
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-bold">{new Date(v.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    {v.reason && <p className="text-xs text-slate-600 dark:text-slate-400 font-bold mb-1">Motivo: <span className="italic">{v.reason}</span></p>}
                                                    {/* Diff summary */}
                                                    {v.diff_summary && Object.keys(v.diff_summary).length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {Object.entries(v.diff_summary).map(([key, val]) => (
                                                                <span key={key} className="text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
                                                                    {key}: {String(val.old)} → {String(val.new)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Audit log */}
                                {auditLogs.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                            <Shield size={11} /> Audit Log
                                        </p>
                                        <div className="space-y-1">
                                            {auditLogs.map(log => {
                                                const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                                                const isHigh = d?.severity === 'HIGH';
                                                return (
                                                    <div key={log.id} className={`text-xs px-3 py-2 rounded-xl border ${isHigh ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5' : 'border-slate-100 dark:border-white/5'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                {log.action === 'reception_edit_post_delivery' ? '🔴 Edición post-entrega' : '✏️ Edición'}
                                                                {d?.reason && <span className="text-slate-500 font-normal ml-1">— {d.reason}</span>}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        {(d?.delta_kg || d?.delta_monto) && (
                                                            <p className="text-slate-500 mt-0.5">
                                                                {d.delta_kg ? `ΔKg: ${d.delta_kg > 0 ? '+' : ''}${d.delta_kg}` : ''}
                                                                {d.delta_monto ? ` · ΔMonto: ${d.delta_monto > 0 ? '+' : ''}$${d.delta_monto}` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
