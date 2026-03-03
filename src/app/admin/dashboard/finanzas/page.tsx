'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    DollarSign, TrendingUp, AlertTriangle, Package,
    Search, Download, ArrowUpRight, ArrowDownRight,
    ShieldAlert, Clock, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { StatusBadge, CobranzaBadge, LegendRow, DonutChart, MarginDistribution } from '@/components/finanzas/FinanzasCharts';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface FinanceShipment {
    id: string;
    tracking_number: string;
    client_name: string;
    client_id: string | null;
    internal_status: string;
    costo_flete: number | null;
    precio_envio: number | null;
    gastos_documentales: number | null;
    impuestos: number | null;
    monto_cobrado: number | null;
    estado_cobranza: string | null;
    estado_pago_proveedor: string | null;
    date_arrived: string | null;
    date_shipped: string | null;
    date_dispatched: string | null;
    weight: number | null;
    peso_computable: number | null;
    updated_at: string | null;
    created_at: string | null;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const STALE_DAYS = 5;

const revenue = (s: FinanceShipment) =>
    (s.monto_cobrado && s.monto_cobrado > 0)
        ? s.monto_cobrado
        : (s.precio_envio || 0) + (s.gastos_documentales || 0) + (s.impuestos || 0);

const margin = (s: FinanceShipment) => revenue(s) - (s.costo_flete || 0);

const formatMoney = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatMoneyFull = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(value);

const atDepotStatuses = ['Recibido en Oficina', 'Retenido'];
const deliveredStatuses = ['Retirado', 'Despachado', 'Mercado Libre full'];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function FinanzasDashboard() {
    const [shipments, setShipments] = useState<FinanceShipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTable, setActiveTable] = useState<'uncollected' | 'stale'>('uncollected');

    // ── Fetch ──
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('shipments')
                .select('id, tracking_number, client_name, client_id, internal_status, costo_flete, precio_envio, gastos_documentales, impuestos, monto_cobrado, estado_cobranza, estado_pago_proveedor, date_arrived, date_shipped, date_dispatched, weight, peso_computable, updated_at, created_at')
                .order('updated_at', { ascending: false });

            // Month filter
            if (selectedMonth && selectedMonth !== 'all') {
                const start = `${selectedMonth}-01`;
                const y = parseInt(selectedMonth.split('-')[0]);
                const m = parseInt(selectedMonth.split('-')[1]);
                const endDate = new Date(y, m, 0);
                const end = format(endDate, 'yyyy-MM-dd');
                query = query.gte('updated_at', start).lte('updated_at', `${end} 23:59:59`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setShipments((data as FinanceShipment[]) || []);
        } catch (error: any) {
            console.error('Finance fetch error:', error);
            toast.error('Error al cargar datos financieros');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Realtime sync ──
    useRealtimeRefresh('shipments', fetchData);

    // ── Month Options ──
    const monthOptions = useMemo(() => {
        const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Todo el historial' }];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            opts.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy').replace(/^\w/, c => c.toUpperCase()) });
        }
        return opts;
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // DERIVED METRICS
    // ═══════════════════════════════════════════════════════════════

    const metrics = useMemo(() => {
        // Total pagado a proveedores
        const providerPaid = shipments
            .filter(s => s.estado_pago_proveedor === 'Pagado/Abonado')
            .reduce((sum, s) => sum + (s.costo_flete || 0), 0);

        // Total revenue de envíos cobrados (estado_cobranza = Pagado)
        const paidShipments = shipments.filter(s => s.estado_cobranza === 'Pagado');
        const totalRevenue = paidShipments.reduce((sum, s) => sum + revenue(s), 0);
        const totalCost = paidShipments.reduce((sum, s) => sum + (s.costo_flete || 0), 0);
        const grossMargin = totalRevenue - totalCost;
        const avgMarginPerShipment = paidShipments.length > 0 ? grossMargin / paidShipments.length : 0;
        const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

        // Capital inmovilizado = pagamos al proveedor pero no cobramos al cliente
        const immobilized = shipments
            .filter(s => s.estado_pago_proveedor === 'Pagado/Abonado' && s.estado_cobranza !== 'Pagado')
            .reduce((sum, s) => sum + (s.costo_flete || 0), 0);

        const immobilizedCount = shipments
            .filter(s => s.estado_pago_proveedor === 'Pagado/Abonado' && s.estado_cobranza !== 'Pagado')
            .length;

        // Envíos sin cobrar (Pendientes en depósito/entregado)
        const uncollectedInDepot = shipments.filter(s =>
            s.estado_cobranza !== 'Pagado' &&
            (atDepotStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase()) ||
                deliveredStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase()))
        ).length;

        // Cobranza distribution
        const pendienteCount = shipments.filter(s => (s.estado_cobranza || 'Pendiente') === 'Pendiente').length;
        const facturadoCount = shipments.filter(s => s.estado_cobranza === 'Facturado').length;
        const pagadoCount = shipments.filter(s => s.estado_cobranza === 'Pagado').length;

        const pendienteAmount = shipments.filter(s => (s.estado_cobranza || 'Pendiente') === 'Pendiente').reduce((sum, s) => sum + revenue(s), 0);
        const facturadoAmount = shipments.filter(s => s.estado_cobranza === 'Facturado').reduce((sum, s) => sum + revenue(s), 0);
        const pagadoAmount = paidShipments.reduce((sum, s) => sum + revenue(s), 0);

        // Margin distribution for chart
        const margins = paidShipments.map(s => margin(s)).sort((a, b) => a - b);
        const medianMargin = margins.length > 0 ? margins[Math.floor(margins.length / 2)] : 0;
        const p25 = margins.length >= 4 ? margins[Math.floor(margins.length * 0.25)] : margins[0] || 0;
        const p75 = margins.length >= 4 ? margins[Math.floor(margins.length * 0.75)] : margins[margins.length - 1] || 0;

        return {
            providerPaid,
            grossMargin,
            avgMarginPerShipment,
            marginPct,
            immobilized,
            immobilizedCount,
            uncollectedInDepot,
            paidCount: paidShipments.length,
            totalShipments: shipments.length,
            pendienteCount, facturadoCount, pagadoCount,
            pendienteAmount, facturadoAmount, pagadoAmount,
            medianMargin, p25, p75, margins
        };
    }, [shipments]);

    // ── Actionable Tables ──
    const uncollectedShipments = useMemo(() => {
        return shipments
            .filter(s =>
                s.estado_pago_proveedor === 'Pagado/Abonado' &&
                s.estado_cobranza !== 'Pagado' &&
                (searchTerm === '' ||
                    (s.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (s.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .sort((a, b) => (b.costo_flete || 0) - (a.costo_flete || 0));
    }, [shipments, searchTerm]);

    const staleUnpaidShipments = useMemo(() => {
        const now = new Date();
        return shipments
            .filter(s => {
                const isInDepot = atDepotStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase());
                if (!isInDepot) return false;
                const arrived = s.date_arrived || s.updated_at;
                if (!arrived) return false;
                const days = differenceInDays(now, new Date(arrived));
                if (days < STALE_DAYS) return false;
                if (s.estado_cobranza === 'Pagado') return false;
                if (searchTerm && !(s.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) && !(s.client_name || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
                return true;
            })
            .sort((a, b) => {
                const daysA = differenceInDays(now, new Date(a.date_arrived || a.updated_at || ''));
                const daysB = differenceInDays(now, new Date(b.date_arrived || b.updated_at || ''));
                return daysB - daysA;
            });
    }, [shipments, searchTerm]);

    // ── CSV Export ──
    const exportCSV = (data: FinanceShipment[], filename: string) => {
        const headers = ['Guía', 'Cliente', 'Estado', 'Costo Flete', 'Cotizado', 'Cobrado', 'Estado Cobranza', 'Estado Proveedor', 'F. Llegada'];
        const rows = data.map(s => [
            s.tracking_number, s.client_name, s.internal_status,
            s.costo_flete || 0, revenue(s), s.monto_cobrado || 0,
            s.estado_cobranza || 'Pendiente', s.estado_pago_proveedor || '—',
            s.date_arrived || '—'
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${selectedMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const currentData = activeTable === 'uncollected' ? uncollectedShipments : staleUnpaidShipments;

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Finanzas Logística
                    </h1>
                    <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                        Cashflow, márgenes y capital de trabajo — {shipments.length} envíos en período
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="erp-select text-xs font-bold px-3 py-2"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                    >
                        {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            </div>

            {/* ── KPI ROW ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total pagado a proveedores */}
                <div className="erp-card px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Pagado a proveedores
                        </span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                            <DollarSign size={14} className="text-red-500" />
                        </div>
                    </div>
                    <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                        {formatMoney(metrics.providerPaid)}
                    </p>
                    <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                        Flete abonado en el período
                    </p>
                </div>

                {/* Margen bruto */}
                <div className="erp-card px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Margen bruto
                        </span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: metrics.grossMargin >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                            {metrics.grossMargin >= 0
                                ? <ArrowUpRight size={14} className="text-emerald-500" />
                                : <ArrowDownRight size={14} className="text-red-500" />}
                        </div>
                    </div>
                    <p className="text-xl font-black" style={{ color: metrics.grossMargin >= 0 ? '#10B981' : '#EF4444' }}>
                        {formatMoney(metrics.grossMargin)}
                    </p>
                    <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                        {metrics.marginPct.toFixed(1)}% sobre {metrics.paidCount} envíos cobrados
                    </p>
                </div>

                {/* Capital inmovilizado */}
                <div className="erp-card px-4 py-4" style={{ borderLeft: metrics.immobilized > 0 ? '3px solid #FFB020' : undefined }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: metrics.immobilized > 0 ? '#FFB020' : 'var(--text-muted)' }}>
                            Capital inmovilizado
                        </span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255, 176, 32, 0.1)' }}>
                            <ShieldAlert size={14} className="text-amber-500" />
                        </div>
                    </div>
                    <p className="text-xl font-black" style={{ color: metrics.immobilized > 0 ? '#FFB020' : 'var(--text-primary)' }}>
                        {formatMoney(metrics.immobilized)}
                    </p>
                    <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                        {metrics.immobilizedCount} envíos pagados al proveedor sin cobrar
                    </p>
                </div>

                {/* Promedio margen por envío */}
                <div className="erp-card px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Margen prom/envío
                        </span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(46, 123, 255, 0.1)' }}>
                            <TrendingUp size={14} className="text-blue-500" />
                        </div>
                    </div>
                    <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                        {formatMoneyFull(metrics.avgMarginPerShipment)}
                    </p>
                    <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                        Mediana: {formatMoneyFull(metrics.medianMargin)}
                    </p>
                </div>
            </div>

            {/* ── CHARTS ROW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Donut: Estado de cobranza */}
                <div className="erp-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <PieChartIcon size={14} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Distribución de Cobranza
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        {/* Donut CSS */}
                        <DonutChart
                            segments={[
                                { value: metrics.pendienteAmount, color: '#FFB020', label: 'Pendiente' },
                                { value: metrics.facturadoAmount, color: '#2E7BFF', label: 'Facturado' },
                                { value: metrics.pagadoAmount, color: '#10B981', label: 'Pagado' },
                            ]}
                        />
                        <div className="flex-1 space-y-3">
                            <LegendRow color="#FFB020" label="Pendiente" count={metrics.pendienteCount} amount={metrics.pendienteAmount} />
                            <LegendRow color="#2E7BFF" label="Facturado" count={metrics.facturadoCount} amount={metrics.facturadoAmount} />
                            <LegendRow color="#10B981" label="Pagado" count={metrics.pagadoCount} amount={metrics.pagadoAmount} />
                        </div>
                    </div>
                </div>

                {/* Margin distribution */}
                <div className="erp-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={14} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            Distribución de Margen por Envío
                        </span>
                    </div>
                    <MarginDistribution margins={metrics.margins} avg={metrics.avgMarginPerShipment} median={metrics.medianMargin} />
                </div>
            </div>

            {/* ── ACTIONABLE TABLES ── */}
            <div className="erp-card overflow-hidden">
                {/* Table header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTable('uncollected')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeTable === 'uncollected'
                                ? 'text-white' : ''}`}
                            style={{
                                background: activeTable === 'uncollected' ? '#FFB020' : 'transparent',
                                color: activeTable === 'uncollected' ? '#fff' : 'var(--text-muted)'
                            }}
                        >
                            <span className="flex items-center gap-1.5">
                                <AlertTriangle size={11} />
                                Pagados no cobrados ({uncollectedShipments.length})
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTable('stale')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all`}
                            style={{
                                background: activeTable === 'stale' ? '#EF4444' : 'transparent',
                                color: activeTable === 'stale' ? '#fff' : 'var(--text-muted)'
                            }}
                        >
                            <span className="flex items-center gap-1.5">
                                <Clock size={11} />
                                En depósito &gt; {STALE_DAYS}d sin cobrar ({staleUnpaidShipments.length})
                            </span>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                            <input
                                className="erp-input text-xs pl-8 pr-3 py-1.5 w-56"
                                placeholder="Buscar guía o cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => exportCSV(currentData, activeTable === 'uncollected' ? 'pagados_no_cobrados' : 'deposito_sin_cobrar')}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all hover:opacity-80"
                            style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
                        >
                            <Download size={11} />
                            CSV
                        </button>
                    </div>
                </div>

                {/* Table content */}
                <div className="overflow-x-auto" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'var(--table-header)' }}>
                                <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cliente</th>
                                <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Guía</th>
                                <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Estado</th>
                                <th className="px-4 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Costo Flete</th>
                                <th className="px-4 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cotizado</th>
                                <th className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cobranza</th>
                                <th className="px-4 py-2.5 text-right text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                    {activeTable === 'stale' ? 'Días' : 'Pendiente'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
                                    </td>
                                </tr>
                            ) : currentData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                        {activeTable === 'uncollected'
                                            ? '✅ No hay envíos pagados al proveedor sin cobrar'
                                            : '✅ No hay envíos en depósito sin cobrar por más de ' + STALE_DAYS + ' días'}
                                    </td>
                                </tr>
                            ) : (
                                currentData.map(s => {
                                    const outstanding = revenue(s) - (s.monto_cobrado || 0);
                                    const daysInDepot = s.date_arrived
                                        ? differenceInDays(new Date(), new Date(s.date_arrived))
                                        : s.updated_at ? differenceInDays(new Date(), new Date(s.updated_at)) : 0;
                                    const estadoCobranza = s.estado_cobranza || 'Pendiente';

                                    return (
                                        <tr
                                            key={s.id}
                                            className="transition-colors hover:bg-white/[0.02]"
                                            style={{ borderBottom: '1px solid var(--card-border)' }}
                                        >
                                            <td className="px-4 py-2.5">
                                                <span className="text-xs font-bold truncate block max-w-[160px]" style={{ color: 'var(--text-primary)' }}>
                                                    {s.client_name || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="text-[11px] font-mono font-bold text-emerald-500">{s.tracking_number}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <StatusBadge status={s.internal_status} />
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {formatMoneyFull(s.costo_flete || 0)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                                    {formatMoneyFull(revenue(s))}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <CobranzaBadge estado={estadoCobranza} />
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                {activeTable === 'stale' ? (
                                                    <span className={`text-xs font-black ${daysInDepot > 10 ? 'text-red-500' : daysInDepot > 5 ? 'text-amber-500' : ''}`}
                                                        style={{ color: daysInDepot <= 5 ? 'var(--text-primary)' : undefined }}>
                                                        {daysInDepot}d
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-bold" style={{ color: outstanding > 0 ? '#FFB020' : '#10B981' }}>
                                                        {formatMoneyFull(outstanding)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

