"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ReportsKPICard } from './ReportsKPICard';
import { Clock, AlertTriangle, Truck, Package, CheckCircle, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';

interface Props {
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
    compareEnabled: boolean;
    onDrillDown: (title: string, filters: Record<string, string>) => void;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export function ReportsLogistica({ from, to, prevFrom, prevTo, compareEnabled, onDrillDown }: Props) {
    const [loading, setLoading] = useState(true);
    // Received: filter by date_arrived
    const [received, setReceived] = useState<any[]>([]);
    const [prevReceived, setPrevReceived] = useState<any[]>([]);
    // Dispatched: filter by date_dispatched (set auto by depot)
    const [dispatched, setDispatched] = useState<any[]>([]);
    const [prevDispatched, setPrevDispatched] = useState<any[]>([]);
    // Retained: filter by date_arrived (they arrived and were retained)
    const [retained, setRetained] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [recCurr, recPrev, disCurr, disPrev, retCurr] = await Promise.all([
                // RECIBIDOS en depósito → date_arrived (auto-set by ReceiveShipmentModal)
                supabase.from('shipments').select('id, tracking_number, client_name, internal_status, category, origin, weight, peso_computable, date_shipped, date_arrived, date_dispatched, retenido_nota').gte('date_arrived', from).lte('date_arrived', to),
                compareEnabled
                    ? supabase.from('shipments').select('id, tracking_number, client_name, internal_status, category, origin, weight, peso_computable, date_shipped, date_arrived, date_dispatched, retenido_nota').gte('date_arrived', prevFrom).lte('date_arrived', prevTo)
                    : Promise.resolve({ data: [] }),
                // DESPACHADOS → date_dispatched (auto-set when depot marks Retirado/Despachado/ML Full)
                supabase.from('shipments').select('id, tracking_number, client_name, internal_status, category, origin, weight, peso_computable, date_shipped, date_arrived, date_dispatched, retenido_nota').gte('date_dispatched', from).lte('date_dispatched', to),
                compareEnabled
                    ? supabase.from('shipments').select('id, tracking_number, client_name, internal_status, category, origin, weight, peso_computable, date_shipped, date_arrived, date_dispatched, retenido_nota').gte('date_dispatched', prevFrom).lte('date_dispatched', prevTo)
                    : Promise.resolve({ data: [] }),
                // RETENIDOS en el período (date_arrived)
                supabase.from('shipments').select('id, tracking_number, client_name, internal_status, category, origin, weight, peso_computable, date_shipped, date_arrived, date_dispatched, retenido_nota').eq('internal_status', 'Retenido').gte('date_arrived', from).lte('date_arrived', to),
            ]);
            setReceived(recCurr.data || []);
            setPrevReceived((recPrev as any).data || []);
            setDispatched(disCurr.data || []);
            setPrevDispatched((disPrev as any).data || []);
            setRetained(retCurr.data || []);
            setLoading(false);
        };
        load();
    }, [from, to, prevFrom, prevTo, compareEnabled]);

    // Transit time: date_shipped → date_arrived
    const withTransit = received.filter(s => s.date_shipped && s.date_arrived);
    const avgTransitDays = withTransit.length > 0
        ? withTransit.reduce((acc, s) => acc + Math.max(0, (new Date(s.date_arrived).getTime() - new Date(s.date_shipped).getTime()) / 86400000), 0) / withTransit.length
        : 0;

    // Dispatched breakdown by status
    const dispatchedByStatus: Record<string, number> = {};
    dispatched.forEach(s => { dispatchedByStatus[s.internal_status] = (dispatchedByStatus[s.internal_status] || 0) + 1; });
    const dispatchPie = Object.entries(dispatchedByStatus).map(([name, count]) => ({ name, count }));

    // Retentions by category
    const retByCat: Record<string, number> = {};
    retained.forEach(s => { retByCat[s.category || 'SIN CAT'] = (retByCat[s.category || 'SIN CAT'] || 0) + 1; });
    const retByCatArr = Object.entries(retByCat).sort(([, a], [, b]) => b - a).slice(0, 6)
        .map(([cat, n]) => ({ cat: cat.length > 14 ? cat.slice(0, 14) + '…' : cat, Retenciones: n }));

    // Origin breakdown of received
    const originMap: Record<string, number> = {};
    received.forEach(s => { const o = s.origin || 'N/D'; originMap[o] = (originMap[o] || 0) + 1; });
    const originArr = Object.entries(originMap).sort(([, a], [, b]) => b - a)
        .map(([origin, count]) => ({ origin, count, pct: received.length > 0 ? (count / received.length * 100).toFixed(1) : '0' }));

    // Anomalies in received batch
    const noWeight = received.filter(s => !s.weight || Number(s.weight) === 0).length;
    const noCategory = received.filter(s => !s.category || s.category.trim() === '').length;
    const longTransit = withTransit.filter(s => {
        const d = (new Date(s.date_arrived).getTime() - new Date(s.date_shipped).getTime()) / 86400000;
        return d > 60;
    }).length;

    if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            {/* Context labels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <FileText size={12} className="text-blue-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Recibidos: filtrado por <span className="text-white">fecha de llegada a depósito</span></p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <FileText size={12} className="text-emerald-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Despachados: filtrado por <span className="text-white">fecha de despacho (marcado por depósito)</span></p>
                </div>
            </div>

            {/* KPIs row 1: Received */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3 px-1">— Recibidos en depósito</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <ReportsKPICard index={0} title="Paquetes Recibidos" value={received.length}
                        currentNum={received.length} prevValue={compareEnabled ? prevReceived.length : undefined}
                        icon={<Package size={16} />} color="#3b82f6"
                        onClick={() => onDrillDown('Paquetes recibidos en el período', { dateField: 'date_arrived', from, to })} />
                    <ReportsKPICard index={1} title="KG Recibidos" value={received.reduce((a, s) => a + Number(s.peso_computable || s.weight || 0), 0).toFixed(1)} unit="kg"
                        currentNum={received.reduce((a, s) => a + Number(s.peso_computable || s.weight || 0), 0)}
                        prevValue={compareEnabled ? prevReceived.reduce((a, s) => a + Number(s.peso_computable || s.weight || 0), 0) : undefined}
                        icon={<Package size={16} />} color="#8b5cf6" />
                    <ReportsKPICard index={2} title="Retenidos en período" value={retained.length}
                        icon={<AlertTriangle size={16} />} color="#ef4444"
                        onClick={() => onDrillDown('Paquetes retenidos', { status: 'Retenido', dateField: 'date_arrived', from, to })} />
                    <ReportsKPICard index={3} title="Tránsito prom." value={avgTransitDays > 0 ? `${avgTransitDays.toFixed(1)}` : 'N/D'} unit="días"
                        icon={<Clock size={16} />} color="#f59e0b" />
                </div>
            </div>

            {/* KPIs row 2: Dispatched */}
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3 px-1">— Despachados desde depósito</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <ReportsKPICard index={0} title="Total Despachados" value={dispatched.length}
                        currentNum={dispatched.length} prevValue={compareEnabled ? prevDispatched.length : undefined}
                        icon={<CheckCircle size={16} />} color="#10b981"
                        onClick={() => onDrillDown('Paquetes despachados', { dateField: 'date_dispatched', from, to })} />
                    <ReportsKPICard index={1} title="Retirados" value={dispatched.filter(s => s.internal_status === 'Retirado').length}
                        icon={<CheckCircle size={16} />} color="#10b981" />
                    <ReportsKPICard index={2} title="ML / Full" value={dispatched.filter(s => s.internal_status === 'Mercado Libre full').length}
                        icon={<Truck size={16} />} color="#fbbf24" />
                    <ReportsKPICard index={3} title="Despachados (otro)" value={dispatched.filter(s => s.internal_status === 'Despachado').length}
                        icon={<Truck size={16} />} color="#8b5cf6" />
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dispatch breakdown pie */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Tipo de Despacho</h3>
                    {dispatchPie.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin despachos en período{dispatched.length === 0 ? ' (campo date_dispatched vacío en histórico)' : ''}</div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <ResponsiveContainer width="50%" height={180}>
                                <PieChart>
                                    <Pie data={dispatchPie} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                                        {dispatchPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex-1 space-y-2">
                                {dispatchPie.map((s, i) => (
                                    <div key={s.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{s.name}</span>
                                        </div>
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">{s.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Retentions by category */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Retenciones por Categoría</h3>
                    {retByCatArr.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-emerald-400 text-sm font-bold">✓ Sin retenciones en este período</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={retByCatArr} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis dataKey="cat" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={90} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                                <Bar dataKey="Retenciones" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Origin breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-2">
                    <Truck size={16} className="text-purple-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Origen de envíos recibidos</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {originArr.map((o, i) => (
                        <div key={o.origin} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                            onClick={() => onDrillDown(`Recibidos desde ${o.origin}`, { origin: o.origin, from, to })}>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-slate-400 w-4">{i + 1}</span>
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{o.origin}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-24 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${o.pct}%` }} />
                                </div>
                                <span className="font-black text-slate-700 dark:text-slate-200 w-8 text-right text-sm">{o.count}</span>
                                <span className="text-[10px] text-slate-400 w-10 text-right">{o.pct}%</span>
                            </div>
                        </div>
                    ))}
                    {originArr.length === 0 && <p className="px-6 py-10 text-slate-400 text-sm text-center">Sin recibidos en este período</p>}
                </div>
            </div>

            {/* Anomalies */}
            {(noCategory > 0 || noWeight > 0 || longTransit > 0) && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-[20px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-amber-400" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Anomalías en recibidos del período</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {noCategory > 0 && <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-amber-500/20"><p className="text-2xl font-black text-amber-400">{noCategory}</p><p className="text-[10px] font-bold text-slate-400 mt-1">Sin categoría</p></div>}
                        {noWeight > 0 && <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-amber-500/20"><p className="text-2xl font-black text-amber-400">{noWeight}</p><p className="text-[10px] font-bold text-slate-400 mt-1">Sin peso registrado</p></div>}
                        {longTransit > 0 && <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-red-500/20"><p className="text-2xl font-black text-red-400">{longTransit}</p><p className="text-[10px] font-bold text-slate-400 mt-1">Tránsito {">"}60 días</p></div>}
                    </div>
                </div>
            )}
        </div>
    );
}
