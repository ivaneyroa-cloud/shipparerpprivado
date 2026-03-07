"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import { ShipmentCobranzasRow } from '@/types';
import { toast } from 'sonner';
import { CobranzasTable } from '@/components/CobranzasTable';
import { ProviderPaymentView } from '@/components/BulkProviderPaymentModal';
import { DollarSign, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

export default function CobranzasPage() {
    const [shipments, setShipments] = useState<ShipmentCobranzasRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('Pendiente'); // Default: Pendientes first
    const [clientVendorMap, setClientVendorMap] = useState<Record<string, string>>({});
    const [clientTarifaMap, setClientTarifaMap] = useState<Record<string, string>>({});
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [isProviderView, setIsProviderView] = useState(false);

    const fetchCobranzas = useCallback(async () => {
        setLoading(true);
        try {
            const allowedStatuses = ['Recibido en Oficina', 'Retirado', 'Despachado', 'Mercado Libre full', 'Retenido'];

            let query = supabase
                .from('shipments')
                .select('id, tracking_number, client_id, client_name, internal_status, bultos, invoice_photo_1, invoice_photo_2, peso_computable, weight, precio_envio, costo_flete, costo_impuestos_proveedor, gastos_documentales, impuestos, monto_cobrado, estado_cobranza, estado_pago_proveedor, updated_at, payment_proof_url, payment_notes, quote_mode, quote_pdf_url')
                .in('internal_status', allowedStatuses)
                .order('updated_at', { ascending: false });

            // Month filter
            if (selectedMonth) {
                const start = `${selectedMonth}-01`;
                const endDate = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0);
                const end = format(endDate, 'yyyy-MM-dd');
                query = query.gte('updated_at', start).lte('updated_at', `${end} 23:59:59`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setShipments(data as ShipmentCobranzasRow[]);

            // Build the Vendor Map
            const clientIds = Array.from(new Set(data.map(s => s.client_id).filter(Boolean)));
            if (clientIds.length > 0) {
                const { data: clientsData } = await supabase.from('clients').select('id, assigned_to, tarifa_aplicable').in('id', clientIds);

                const { data: { session } } = await supabase.auth.getSession();
                let usersList: any[] = [];
                if (session) {
                    try {
                        const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
                        const usersData = await res.json();
                        usersList = usersData.users || [];
                    } catch (e) {
                        // silently handle if api users is restricted
                    }
                }

                const map: Record<string, string> = {};
                const tarifaMap: Record<string, string> = {};
                if (clientsData) {
                    clientsData.forEach(c => {
                        if (c.assigned_to) {
                            const user = usersList.find(u => u.id === c.assigned_to);
                            map[c.id] = user?.full_name || user?.email || 'Sin Asignar';
                        }
                        if (c.tarifa_aplicable) {
                            tarifaMap[c.id] = c.tarifa_aplicable;
                        }
                    });
                }
                setClientVendorMap(map);
                setClientTarifaMap(tarifaMap);
            }
        } catch (error: any) {
            toast.error(`Error al cargar cobranzas: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        fetchCobranzas();
    }, [fetchCobranzas]);

    // ── Realtime sync ──
    useRealtimeRefresh('shipments', fetchCobranzas);

    const EDITABLE_FIELDS: Array<keyof ShipmentCobranzasRow> = [
        'estado_cobranza',
        'estado_pago_proveedor',
        'costo_flete',
        'costo_impuestos_proveedor',
        'monto_cobrado',
        'precio_envio',
        'gastos_documentales',
        'impuestos'
    ];

    const handleLocalUpdate = (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null) => {
        setShipments(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleInlineUpdate = async (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null, last_updated?: string) => {
        if (!EDITABLE_FIELDS.includes(field)) {
            toast.error('Campo no editable online');
            return;
        }

        const normalizedValue =
            ['precio_envio', 'costo_flete', 'costo_impuestos_proveedor', 'monto_cobrado', 'gastos_documentales', 'impuestos'].includes(field as string)
                ? (value === '' || value === null ? null : Number(value))
                : value;

        // Snapshot for rollback
        const original = shipments.find(s => s.id === id);
        const originalValue = original ? original[field] : undefined;

        // Optimistic update (already applied via handleLocalUpdate from CobranzasTable)

        try {
            const result = await secureShipmentUpdate(id, { [field]: normalizedValue });

            if (!result.success) throw new Error(result.error);
        } catch (error: any) {
            // ROLLBACK — restore original value
            if (original && originalValue !== undefined) {
                setShipments(prev => prev.map(s =>
                    s.id === id ? { ...s, [field]: originalValue } : s
                ));
            }
            toast.error(`Error al actualizar: ${error.message}`);
        }
    };

    // Calculate aggregated KPIs
    const stats = useMemo(() => {
        const result = { pendientes: 0, facturados: 0, pagados: 0, pendientesAbonar: 0 };
        shipments.forEach(s => {
            const envio = Number(s.precio_envio) || 0;
            const gastos = Number(s.gastos_documentales) || 0;
            const imp = Number(s.impuestos) || 0;
            const cobrado_real = Number(s.monto_cobrado) || 0;

            // Quote total is just the reference for what SHOULD be invoiced
            const totalCotizado = envio + gastos + imp;

            const estado = s.estado_cobranza || 'Pendiente';

            // Total por Facturar = sum of quotes for Pendiente items
            if (estado === 'Pendiente') result.pendientes += totalCotizado;

            // Total Facturado = sum of monto_cobrado for Facturado items (or quote if no monto_cobrado yet)
            if (estado === 'Facturado') result.facturados += (cobrado_real > 0 ? cobrado_real : totalCotizado);

            // Dinero Ingresado = sum of monto_cobrado for Pagado items
            if (estado === 'Pagado') result.pagados += (cobrado_real > 0 ? cobrado_real : totalCotizado);

            // Pendientes de Abonar = items where estado_pago_proveedor is NOT Pagado/Abonado
            if (s.estado_pago_proveedor !== 'Pagado/Abonado') {
                const costo = (Number(s.costo_flete) || 0) + (Number(s.costo_impuestos_proveedor) || 0);
                result.pendientesAbonar += costo;
            }
        });
        return result;
    }, [shipments]);

    // Compute filtered shipments
    const filteredShipments = useMemo(() => {
        return shipments.filter(s => {
            if (filterStatus === 'all') return true;
            const estado = s.estado_cobranza || 'Pendiente';
            return estado === filterStatus;
        });
    }, [shipments, filterStatus]);

    const formatMoney = (value: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
        }).format(value);
    };

    // Generate month options (current + 11 back)
    const monthOptions = useMemo(() => {
        const opts = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const val = format(d, 'yyyy-MM');
            const label = format(d, 'MMMM yyyy').replace(/^\w/, c => c.toUpperCase());
            opts.push({ value: val, label });
        }
        return opts;
    }, []);

    // If in provider view, render that full page instead
    if (isProviderView) {
        return <ProviderPaymentView onBack={() => { setIsProviderView(false); fetchCobranzas(); }} />;
    }

    return (
        <div className="w-full flex-1 flex flex-col pt-4 overflow-hidden relative bg-[#F4F5F7] dark:bg-slate-900 -mx-3 px-3 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 -mb-3 pb-3 md:-mb-6 md:pb-6 lg:-mb-8 lg:pb-8" style={{ minHeight: 'calc(100dvh - 80px)' }}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 shrink-0">
                <div className="flex items-end gap-4">
                    <div>
                        <h1 className="text-[28px] font-black tracking-tight mb-1 text-slate-800 dark:text-white font-[Outfit]">Finanzas</h1>
                        <p className="text-slate-500 font-bold tracking-wide text-xs">Administración de Cobros y Pagos</p>
                    </div>
                    {/* Month selector */}
                    <select
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer hover:border-blue-500 transition-colors"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                        {monthOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* Filter tabs: Pendientes first, Todos at the end */}
                <div className="bg-white p-1 rounded-full flex items-center gap-1 mt-3 md:mt-0 shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <button onClick={() => setFilterStatus('Pendiente')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterStatus === 'Pendiente' ? 'bg-[#FF6900] shadow-md text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Pendientes</button>
                    <button onClick={() => setFilterStatus('Facturado')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterStatus === 'Facturado' ? 'bg-[#FF6900] shadow-md text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Facturados</button>
                    <button onClick={() => setFilterStatus('Pagado')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterStatus === 'Pagado' ? 'bg-[#FF6900] shadow-md text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Pagados</button>
                    <button onClick={() => setFilterStatus('all')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${filterStatus === 'all' ? 'bg-[#FF6900] shadow-md text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Todos</button>
                </div>

                <button
                    onClick={() => setIsProviderView(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md hover:shadow-lg flex items-center gap-2 mt-3 md:mt-0 shrink-0"
                >
                    <CreditCard size={14} />
                    Proveedores
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 shrink-0">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-500 mb-1">Total por Facturar</p>
                    <p className="font-black text-2xl text-slate-800 dark:text-white font-[Outfit]">{formatMoney(stats.pendientes)}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-500 mb-1">Total Facturado</p>
                    <p className="font-black text-2xl text-slate-800 dark:text-white font-[Outfit]">{formatMoney(stats.facturados)}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-slate-500 mb-1">Dinero Ingresado</p>
                    <p className="font-black text-2xl text-emerald-600 dark:text-emerald-400 font-[Outfit]">{formatMoney(stats.pagados)}</p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-md border-b-4 border-b-red-500 dark:border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={48} /></div>
                    <p className="text-[11px] font-bold text-red-500 mb-1">Pendientes de Abonar</p>
                    <p className="font-black text-2xl text-slate-800 dark:text-white font-[Outfit]">{formatMoney(stats.pendientesAbonar)}</p>
                    <p className="text-[9px] font-medium text-slate-400 mt-1">Costos de flete sin abonar al proveedor</p>
                </motion.div>
            </div>

            {/* Table wrapper */}
            <div className="flex-1 overflow-hidden flex flex-col relative mask-bottom pb-4">
                <div className="absolute inset-0 overflow-y-auto no-scrollbar pb-20 px-2 -mx-2">
                    <CobranzasTable
                        shipments={filteredShipments}
                        loading={loading}
                        handleInlineUpdate={handleInlineUpdate}
                        handleLocalUpdate={handleLocalUpdate}
                        clientVendorMap={clientVendorMap}
                        clientTarifaMap={clientTarifaMap}
                    />
                </div>
            </div>
        </div>
    );
}
