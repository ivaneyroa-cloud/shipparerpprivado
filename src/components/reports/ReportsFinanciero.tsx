"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ReportsKPICard } from './ReportsKPICard';
import { DollarSign, TrendingDown, AlertTriangle, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';

interface Props {
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
    compareEnabled: boolean;
    onDrillDown: (title: string, filters: Record<string, string>) => void;
}

export function ReportsFinanciero({ from, to, prevFrom, prevTo, compareEnabled, onDrillDown }: Props) {
    const [loading, setLoading] = useState(true);
    const [shipments, setShipments] = useState<any[]>([]);
    const [prevShipments, setPrevShipments] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [curr, prev] = await Promise.all([
                supabase.from('shipments').select('id, tracking_number, client_name, client_code, category, origin, internal_status, weight, peso_computable, precio_envio, gastos_documentales, impuestos, costo_flete, monto_facturado, invoice_photo_1, date_shipped, date_arrived, created_at').gte('created_at', from).lte('created_at', to + ' 23:59:59'),
                compareEnabled
                    ? supabase.from('shipments').select('id, tracking_number, client_name, client_code, category, origin, internal_status, weight, peso_computable, precio_envio, gastos_documentales, impuestos, costo_flete, monto_facturado, invoice_photo_1, date_shipped, date_arrived, created_at').gte('created_at', prevFrom).lte('created_at', prevTo + ' 23:59:59')
                    : Promise.resolve({ data: [] }),
            ]);
            const data = curr.data || [];
            setShipments(data);
            setPrevShipments((prev as any).data || []);

            // Daily revenue trend
            const dayMap: Record<string, { revenue: number; costo: number; margen: number }> = {};
            data.forEach((s: any) => {
                const day = (s.created_at || '').slice(0, 10);
                if (!day) return;
                if (!dayMap[day]) dayMap[day] = { revenue: 0, costo: 0, margen: 0 };
                const rev = Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0);
                const cost = Number(s.costo_flete || 0);
                dayMap[day].revenue += rev;
                dayMap[day].costo += cost;
                dayMap[day].margen += rev - cost;
            });

            setTrendData(Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
                date: date.slice(5),
                Revenue: Math.round(v.revenue),
                Costo: Math.round(v.costo),
                Margen: Math.round(v.margen),
            })));
            setLoading(false);
        };
        load();
    }, [from, to, prevFrom, prevTo, compareEnabled]);

    const totalRevenue = shipments.reduce((s, x) => s + Number(x.precio_envio || 0) + Number(x.gastos_documentales || 0) + Number(x.impuestos || 0), 0);
    const prevRevenue = prevShipments.reduce((s, x) => s + Number(x.precio_envio || 0) + Number(x.gastos_documentales || 0) + Number(x.impuestos || 0), 0);
    const totalCosto = shipments.reduce((s, x) => s + Number(x.costo_flete || 0), 0);
    const prevCosto = prevShipments.reduce((s, x) => s + Number(x.costo_flete || 0), 0);
    const totalMargen = totalRevenue - totalCosto;
    const prevMargen = prevRevenue - prevCosto;
    const margenPct = totalRevenue > 0 ? (totalMargen / totalRevenue * 100) : 0;

    // Morosidad / pending by client (no invoice_photo means not yet paid conceptually)
    const noInvoice = shipments.filter(s => !s.invoice_photo_1 && ['Retirado', 'Despachado', 'Mercado Libre full'].includes(s.internal_status));

    // Revenue by category
    const catRevMap: Record<string, { revenue: number; costo: number; count: number }> = {};
    shipments.forEach((s: any) => {
        const cat = s.category || 'SIN CATEGORÍA';
        if (!catRevMap[cat]) catRevMap[cat] = { revenue: 0, costo: 0, count: 0 };
        catRevMap[cat].revenue += Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0);
        catRevMap[cat].costo += Number(s.costo_flete || 0);
        catRevMap[cat].count++;
    });
    const catRevArr = Object.entries(catRevMap).sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 7)
        .map(([cat, v]) => ({
            cat: cat.length > 12 ? cat.slice(0, 12) + '…' : cat,
            Revenue: Math.round(v.revenue),
            Margen: Math.round(v.revenue - v.costo),
        }));

    // Clients with negative margin
    const clientFinMap: Record<string, { name: string; revenue: number; costo: number; count: number }> = {};
    shipments.forEach((s: any) => {
        const key = s.client_name || 'N/D';
        if (!clientFinMap[key]) clientFinMap[key] = { name: key, revenue: 0, costo: 0, count: 0 };
        clientFinMap[key].revenue += Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0);
        clientFinMap[key].costo += Number(s.costo_flete || 0);
        clientFinMap[key].count++;
    });
    const negativeMarginClients = Object.values(clientFinMap)
        .filter(c => c.revenue > 0 && (c.revenue - c.costo) < 0)
        .sort((a, b) => (a.revenue - a.costo) - (b.revenue - b.costo));

    const handleExport = () => {
        const rows = shipments.map(s => ({
            'Tracking': s.tracking_number,
            'Cliente': s.client_name,
            'Código': s.client_code,
            'Categoría': s.category,
            'Origen': s.origin,
            'Status': s.internal_status,
            'Fecha Salida': s.date_shipped,
            'Fecha Llegada': s.date_arrived,
            'Peso (KG)': s.weight,
            'Peso Comp.': s.peso_computable,
            'Precio Envío': s.precio_envio,
            'Gastos Doc.': s.gastos_documentales,
            'Impuestos': s.impuestos,
            'Costo Flete': s.costo_flete,
            'Monto Facturado': s.monto_facturado,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Envíos');
        XLSX.writeFile(wb, `shippar-reporte-${from}-${to}.xlsx`);
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Context label */}
            <div className="flex items-center gap-2 px-1">
                <FileText size={13} className="text-emerald-400" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Datos financieros · filtrado por <span className="text-emerald-400">fecha de creación (created_at)</span> — misma base que Comercial
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                <ReportsKPICard index={0} title="Revenue Estimado" value={`$${totalRevenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                    currentNum={totalRevenue} prevValue={compareEnabled ? prevRevenue : undefined}
                    icon={<DollarSign size={16} />} color="#10b981" />
                <ReportsKPICard index={1} title="Costo de Flete" value={`$${totalCosto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                    currentNum={totalCosto} prevValue={compareEnabled ? prevCosto : undefined}
                    icon={<TrendingDown size={16} />} color="#ef4444" />
                <ReportsKPICard index={2} title="Margen Bruto" value={`$${totalMargen.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`}
                    currentNum={totalMargen} prevValue={compareEnabled ? prevMargen : undefined}
                    icon={<DollarSign size={16} />} color={margenPct > 20 ? '#10b981' : '#f59e0b'} />
                <ReportsKPICard index={3} title="Margen %" value={`${margenPct.toFixed(1)}%`}
                    icon={<FileText size={16} />} color="#3b82f6" />
            </div>

            {/* Export button */}
            <div className="flex justify-end">
                <button onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95">
                    <FileText size={14} /> Exportar Excel
                </button>
            </div>

            {/* Revenue + margin trend */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Tendencia financiera diaria</h3>
                {trendData.length === 0 ? <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin datos</div> : (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                            <Line type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Costo" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                            <Line type="monotone" dataKey="Margen" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Revenue by category */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Revenue y Margen por Categoría</h3>
                {catRevArr.length === 0 ? <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Sin datos</div> : (
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={catRevArr} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis dataKey="cat" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={90} />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                            <Bar dataKey="Revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="Margen" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Negative margin alerts */}
            {negativeMarginClients.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-[20px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-red-400" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-red-400">⚠ Clientes con Margen Negativo</h3>
                    </div>
                    <div className="space-y-2">
                        {negativeMarginClients.slice(0, 5).map((c, i) => (
                            <div key={c.name} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-red-500/10">
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{c.name}</span>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="text-slate-400">Rev: ${c.revenue.toFixed(0)}</span>
                                    <span className="text-slate-400">Costo: ${c.costo.toFixed(0)}</span>
                                    <span className="font-black text-red-400">Margen: ${(c.revenue - c.costo).toFixed(0)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Entregados sin factura */}
            {noInvoice.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-[20px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle size={16} className="text-amber-400" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">Entregados sin Factura ({noInvoice.length})</h3>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {noInvoice.slice(0, 10).map(s => (
                            <div key={s.id} className="flex items-center justify-between text-xs px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-amber-500/10">
                                <span className="font-mono text-cyan-600">{s.tracking_number}</span>
                                <span className="text-slate-500">{s.client_name}</span>
                            </div>
                        ))}
                        {noInvoice.length > 10 && <p className="text-xs text-amber-400 text-center pt-1">+{noInvoice.length - 10} más...</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
