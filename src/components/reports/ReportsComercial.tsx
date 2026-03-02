"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ReportsKPICard } from './ReportsKPICard';
import { Package, Scale, Users, TrendingUp, Award, FileText } from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';

interface Props {
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
    compareEnabled: boolean;
    onDrillDown: (title: string, filters: Record<string, string>) => void;
}

const sortByOptions = [
    { key: 'count' as const, label: '# Envíos' },
    { key: 'kg' as const, label: 'KG' },
    { key: 'revenue' as const, label: 'Revenue' },
    { key: 'margen' as const, label: 'Margen %' },
];

export function ReportsComercial({ from, to, prevFrom, prevTo, compareEnabled, onDrillDown }: Props) {
    const [loading, setLoading] = useState(true);
    const [shipments, setShipments] = useState<any[]>([]);
    const [prevShipments, setPrevShipments] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [sortBy, setSortBy] = useState<'count' | 'kg' | 'revenue' | 'margen'>('count');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            // COMERCIAL: filter by created_at — "guías nuevas gestionadas" (salidas de China)
            const [currRes, prevRes] = await Promise.all([
                supabase.from('shipments').select('id, tracking_number, client_name, client_code, category, weight, peso_computable, precio_envio, gastos_documentales, impuestos, costo_flete, created_at').gte('created_at', from).lte('created_at', to + ' 23:59:59'),
                compareEnabled
                    ? supabase.from('shipments').select('id, tracking_number, client_name, client_code, category, weight, peso_computable, precio_envio, gastos_documentales, impuestos, costo_flete, created_at').gte('created_at', prevFrom).lte('created_at', prevTo + ' 23:59:59')
                    : Promise.resolve({ data: [] }),
            ]);
            const curr = currRes.data || [];
            setShipments(curr);
            setPrevShipments((prevRes as any).data || []);

            // Daily trend by created_at
            const map: Record<string, { envios: number; kg: number }> = {};
            curr.forEach((s: any) => {
                const day = (s.created_at || '').slice(0, 10);
                if (!day) return;
                if (!map[day]) map[day] = { envios: 0, kg: 0 };
                map[day].envios++;
                map[day].kg += Number(s.peso_computable || s.weight || 0);
            });
            setTrendData(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
                .map(([date, v]) => ({ date: date.slice(5), 'Guías': v.envios, 'KG': Math.round(v.kg * 10) / 10 })));
            setLoading(false);
        };
        load();
    }, [from, to, prevFrom, prevTo, compareEnabled]);

    const totalGuias = shipments.length;
    const prevGuias = prevShipments.length;
    const totalKg = shipments.reduce((s, x) => s + Number(x.peso_computable || x.weight || 0), 0);
    const prevKg = prevShipments.reduce((s, x) => s + Number(x.peso_computable || x.weight || 0), 0);
    const totalCotizado = shipments.reduce((s, x) => s + Number(x.precio_envio || 0) + Number(x.gastos_documentales || 0) + Number(x.impuestos || 0), 0);
    const prevCotizado = prevShipments.reduce((s, x) => s + Number(x.precio_envio || 0) + Number(x.gastos_documentales || 0) + Number(x.impuestos || 0), 0);
    const activeClients = new Set(shipments.map((s: any) => s.client_name)).size;
    const prevActiveClients = new Set(prevShipments.map((s: any) => s.client_name)).size;

    // Category breakdown
    const catMap: Record<string, { count: number; kg: number }> = {};
    shipments.forEach((s: any) => {
        const cat = s.category || 'SIN CATEGORÍA';
        if (!catMap[cat]) catMap[cat] = { count: 0, kg: 0 };
        catMap[cat].count++;
        catMap[cat].kg += Number(s.peso_computable || s.weight || 0);
    });
    const catData = Object.entries(catMap).sort(([, a], [, b]) => b.count - a.count).slice(0, 7)
        .map(([cat, v]) => ({ cat: cat.length > 12 ? cat.slice(0, 12) + '…' : cat, Guías: v.count }));

    // Top clients
    const clientMap: Record<string, { name: string; code: string; count: number; kg: number; revenue: number; costo: number }> = {};
    shipments.forEach((s: any) => {
        const key = s.client_name || 'Sin nombre';
        if (!clientMap[key]) clientMap[key] = { name: key, code: s.client_code || '', count: 0, kg: 0, revenue: 0, costo: 0 };
        clientMap[key].count++;
        clientMap[key].kg += Number(s.peso_computable || s.weight || 0);
        clientMap[key].revenue += Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0);
        clientMap[key].costo += Number(s.costo_flete || 0);
    });
    const allClients = Object.values(clientMap).map(c => ({ ...c, margen: c.revenue > 0 ? ((c.revenue - c.costo) / c.revenue * 100) : 0 }));
    const topClients = [...allClients].sort((a, b) => {
        if (sortBy === 'kg') return b.kg - a.kg;
        if (sortBy === 'revenue') return b.revenue - a.revenue;
        if (sortBy === 'margen') return b.margen - a.margen;
        return b.count - a.count;
    }).slice(0, 15);

    if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-6">
            {/* Context label */}
            <div className="flex items-center gap-2 px-1">
                <FileText size={13} className="text-blue-400" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Guías nuevas gestionadas · filtrado por <span className="text-blue-400">fecha de creación (salida de China)</span>
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportsKPICard index={0} title="Guías Creadas" value={totalGuias.toLocaleString('es-AR')}
                    currentNum={totalGuias} prevValue={compareEnabled ? prevGuias : undefined}
                    icon={<Package size={16} />} color="#3b82f6"
                    onClick={() => onDrillDown('Guías creadas en el período', { from, to })} />
                <ReportsKPICard index={1} title="KG Gestionados" value={totalKg.toFixed(1)} unit="kg"
                    currentNum={totalKg} prevValue={compareEnabled ? prevKg : undefined}
                    icon={<Scale size={16} />} color="#8b5cf6" />
                <ReportsKPICard index={2} title="Cotizado (est.)" value={`$${totalCotizado.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                    currentNum={totalCotizado} prevValue={compareEnabled ? prevCotizado : undefined}
                    icon={<TrendingUp size={16} />} color="#10b981" />
                <ReportsKPICard index={3} title="Clientes con Guías" value={activeClients}
                    currentNum={activeClients} prevValue={compareEnabled ? prevActiveClients : undefined}
                    icon={<Users size={16} />} color="#f59e0b" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Nuevas guías por día</h3>
                    {trendData.length === 0 ? <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin guías en este período</div> : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                                <Line type="monotone" dataKey="Guías" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Guías por Categoría</h3>
                    {catData.length === 0 ? <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin datos</div> : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={catData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis dataKey="cat" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                                <Bar dataKey="Guías" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Top clients */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Award size={16} className="text-amber-500" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Top Clientes</h3>
                        <span className="text-[10px] text-slate-400 font-bold">({allClients.length} total)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Ordenar por:</span>
                        {sortByOptions.map(opt => (
                            <button key={opt.key} onClick={() => setSortBy(opt.key)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${sortBy === opt.key ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-white/5 [&>th]:px-4 [&>th]:py-2.5 [&>th]:text-[10px] [&>th]:font-black [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-slate-400">
                                <th>#</th><th>Cliente</th><th>Código</th>
                                <th className={`text-right cursor-pointer ${sortBy === 'count' ? 'text-blue-500' : ''}`} onClick={() => setSortBy('count')}>Guías {sortBy === 'count' ? '↓' : ''}</th>
                                <th className={`text-right cursor-pointer ${sortBy === 'kg' ? 'text-blue-500' : ''}`} onClick={() => setSortBy('kg')}>KG {sortBy === 'kg' ? '↓' : ''}</th>
                                <th className={`text-right cursor-pointer ${sortBy === 'revenue' ? 'text-blue-500' : ''}`} onClick={() => setSortBy('revenue')}>Cotizado {sortBy === 'revenue' ? '↓' : ''}</th>
                                <th className={`text-right cursor-pointer ${sortBy === 'margen' ? 'text-blue-500' : ''}`} onClick={() => setSortBy('margen')}>Margen % {sortBy === 'margen' ? '↓' : ''}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {topClients.map((c, i) => (
                                <motion.tr key={c.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                    onClick={() => onDrillDown(`Guías de ${c.name}`, { client: c.name, from, to })}
                                    className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                    <td className="px-4 py-3 text-[11px] font-black text-slate-400">{i + 1}</td>
                                    <td className="px-4 py-3 font-bold text-sm text-slate-800 dark:text-slate-200 max-w-[180px] truncate">{c.name}</td>
                                    <td className="px-4 py-3 font-mono text-[11px] uppercase text-cyan-600 dark:text-cyan-400">{c.code}</td>
                                    <td className="px-4 py-3 text-right font-black text-slate-700 dark:text-slate-300">{c.count}</td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400">{c.kg.toFixed(1)}</td>
                                    <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">${c.revenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.margen > 20 ? 'bg-emerald-500/10 text-emerald-500' : c.margen > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-400'}`}>
                                            {c.margen.toFixed(1)}%
                                        </span>
                                    </td>
                                </motion.tr>
                            ))}
                            {topClients.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">Sin guías en este período</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Period comparison */}
            {compareEnabled && prevShipments.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Comparación de períodos</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {[{ label: 'Guías creadas', curr: totalGuias, prev: prevGuias }, { label: 'KG gestionados', curr: totalKg, prev: prevKg }, { label: 'Cotizado', curr: totalCotizado, prev: prevCotizado }].map(kpi => {
                            const delta = kpi.prev > 0 ? ((kpi.curr - kpi.prev) / kpi.prev * 100) : 0;
                            return (
                                <div key={kpi.label} className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{kpi.label}</p>
                                    <p className="text-lg font-black text-slate-900 dark:text-white">{typeof kpi.curr === 'number' && kpi.label === 'KG gestionados' ? kpi.curr.toFixed(1) : kpi.curr.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                                    <p className={`text-xs font-black mt-1 ${delta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs período ant.</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
