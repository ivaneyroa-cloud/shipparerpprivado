"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Search, CreditCard, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatARSFull as formatMoney } from '@/lib/formatters';

interface ProviderShipment {
    id: string;
    tracking_number: string;
    client_name: string;
    date_arrived: string | null;
    costo_flete: number | null;
    estado_pago_proveedor: string | null;
    updated_at: string | null;
}

interface ProviderPaymentViewProps {
    onBack: () => void;
}



export function ProviderPaymentView({ onBack }: ProviderPaymentViewProps) {
    const [pendingShipments, setPendingShipments] = useState<ProviderShipment[]>([]);
    const [paidShipments, setPaidShipments] = useState<ProviderShipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [referenceNumber, setReferenceNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');

    const fetchShipments = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch pending
            const { data: pending, error: err1 } = await supabase
                .from('shipments')
                .select('id, tracking_number, client_name, date_arrived, costo_flete, estado_pago_proveedor, updated_at')
                .or('estado_pago_proveedor.is.null,estado_pago_proveedor.eq.Pendiente')
                .not('costo_flete', 'is', null)
                .gt('costo_flete', 0)
                .order('date_arrived', { ascending: true });

            if (err1) throw err1;
            setPendingShipments(pending || []);

            // Fetch paid/abonados
            const { data: paid, error: err2 } = await supabase
                .from('shipments')
                .select('id, tracking_number, client_name, date_arrived, costo_flete, estado_pago_proveedor, updated_at')
                .eq('estado_pago_proveedor', 'Pagado/Abonado')
                .not('costo_flete', 'is', null)
                .gt('costo_flete', 0)
                .order('updated_at', { ascending: false });

            if (err2) throw err2;
            setPaidShipments(paid || []);
        } catch (error: any) {
            toast.error(`Error al cargar datos: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchShipments();
    }, [fetchShipments]);

    const currentList = activeTab === 'pending' ? pendingShipments : paidShipments;

    const filteredShipments = useMemo(() => {
        if (!searchTerm) return currentList;
        const term = searchTerm.toLowerCase();
        return currentList.filter(s =>
            (s.tracking_number?.toLowerCase() || '').includes(term) ||
            (s.client_name?.toLowerCase() || '').includes(term)
        );
    }, [currentList, searchTerm]);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredShipments.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredShipments.map(s => s.id)));
        }
    };

    const selectedTotal = useMemo(() => {
        return pendingShipments
            .filter(s => selectedIds.has(s.id))
            .reduce((sum, s) => sum + (Number(s.costo_flete) || 0), 0);
    }, [pendingShipments, selectedIds]);

    const grandTotal = useMemo(() => {
        return pendingShipments.reduce((sum, s) => sum + (Number(s.costo_flete) || 0), 0);
    }, [pendingShipments]);

    const totalPaid = useMemo(() => {
        return paidShipments.reduce((sum, s) => sum + (Number(s.costo_flete) || 0), 0);
    }, [paidShipments]);

    const handleSubmit = async () => {
        if (selectedIds.size === 0) {
            toast.error('Seleccioná al menos una guía');
            return;
        }

        setSubmitting(true);
        try {
            const ids = Array.from(selectedIds);

            // Update each shipment through the secure API
            const results = await Promise.all(
                ids.map(id => secureShipmentUpdate(id, { estado_pago_proveedor: 'Pagado/Abonado' }))
            );

            const failed = results.filter(r => !r.success);
            if (failed.length > 0) {
                toast.error(`${failed.length} guías fallaron: ${failed[0].error}`);
            }

            const successCount = results.filter(r => r.success).length;
            if (successCount > 0) {
                toast.success(`✅ ${successCount} guías marcadas como pagadas (Ref: ${referenceNumber || 'Sin ref'})`);
            }

            setSelectedIds(new Set());
            setReferenceNumber('');
            fetchShipments();
        } catch (error: any) {
            toast.error(`Error al registrar pago: ${error.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col pt-4 overflow-hidden relative bg-[#F4F5F7] dark:bg-slate-900 -m-8 p-8" style={{ height: 'calc(100vh - 80px)' }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    >
                        <ArrowLeft size={18} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-[28px] font-black tracking-tight mb-1 text-slate-800 dark:text-white font-[Outfit] flex items-center gap-3">
                            <CreditCard className="text-blue-500" size={28} />
                            Pagos a Proveedores
                        </h1>
                        <p className="text-slate-500 font-bold tracking-wide text-xs">Gestión de deudas con UPS / FedEx / Proveedores logísticos</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white p-1 rounded-full flex items-center gap-1 mt-3 md:mt-0 shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <button
                        onClick={() => { setActiveTab('pending'); setSelectedIds(new Set()); setSearchTerm(''); }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'pending' ? 'bg-red-500 shadow-md text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Pendientes ({pendingShipments.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab('paid'); setSelectedIds(new Set()); setSearchTerm(''); }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${activeTab === 'paid' ? 'bg-emerald-500 shadow-md text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Abonados ({paidShipments.length})
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border-b-4 border-b-red-500 border border-slate-200 dark:border-slate-700">
                    <p className="text-[11px] font-bold text-red-500 mb-1">Deuda Total Pendiente</p>
                    <p className="font-black text-2xl text-slate-800 dark:text-white font-[Outfit]">{formatMoney(grandTotal)}</p>
                    <p className="text-[9px] font-medium text-slate-400 mt-1">{pendingShipments.length} guías sin pagar</p>
                </motion.div>
                {activeTab === 'pending' ? (
                    <>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border-b-4 border-b-blue-500 border border-slate-200 dark:border-slate-700">
                            <p className="text-[11px] font-bold text-blue-500 mb-1">Seleccionadas para Pagar</p>
                            <p className="font-black text-2xl text-blue-600 dark:text-blue-400 font-[Outfit]">{formatMoney(selectedTotal)}</p>
                            <p className="text-[9px] font-medium text-slate-400 mt-1">{selectedIds.size} guías seleccionadas</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <p className="text-[11px] font-bold text-slate-500 mb-1">Quedaría Pendiente</p>
                            <p className="font-black text-2xl text-slate-800 dark:text-white font-[Outfit]">{formatMoney(grandTotal - selectedTotal)}</p>
                            <p className="text-[9px] font-medium text-slate-400 mt-1">{pendingShipments.length - selectedIds.size} guías restantes</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 block">📅 Fecha de Pago</label>
                                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 block">🔢 Nro Referencia</label>
                                <input type="text" placeholder="Ej: TRF-48291" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        </motion.div>
                    </>
                ) : (
                    <>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border-b-4 border-b-emerald-500 border border-slate-200 dark:border-slate-700">
                            <p className="text-[11px] font-bold text-emerald-500 mb-1">Total Abonado</p>
                            <p className="font-black text-2xl text-emerald-600 dark:text-emerald-400 font-[Outfit]">{formatMoney(totalPaid)}</p>
                            <p className="text-[9px] font-medium text-slate-400 mt-1">{paidShipments.length} guías pagadas</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 col-span-2 flex items-center justify-center">
                            <p className="text-xs font-bold text-slate-400">Historial de pagos realizados a proveedores logísticos</p>
                        </motion.div>
                    </>
                )}
            </div>

            {/* Search + Actions Bar */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por guía o cliente..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500 transition-colors shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {activeTab === 'pending' && (
                    <>
                        <button
                            onClick={toggleAll}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors shadow-sm"
                        >
                            {selectedIds.size === filteredShipments.length && filteredShipments.length > 0 ? 'Deseleccionar' : 'Seleccionar Todas'}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={selectedIds.size === 0 || submitting}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-2.5 px-6 rounded-xl transition-all  flex items-center gap-2 uppercase tracking-wide text-xs whitespace-nowrap"
                        >
                            <CheckCircle2 size={16} />
                            {submitting ? 'Procesando...' : `Confirmar Pago (${selectedIds.size})`}
                        </button>
                    </>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 [&>th]:px-5 [&>th]:py-4 [&>th]:text-[10px] [&>th]:font-black [&>th]:uppercase [&>th]:tracking-widest [&>th]:text-slate-500">
                                    {activeTab === 'pending' && (
                                        <th className="w-14">
                                            <input
                                                type="checkbox"
                                                checked={filteredShipments.length > 0 && selectedIds.size === filteredShipments.length}
                                                onChange={toggleAll}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                        </th>
                                    )}
                                    <th>Número de Guía</th>
                                    <th>Cliente</th>
                                    <th>F. Ingreso Depósito</th>
                                    <th className="text-right">{activeTab === 'pending' ? 'Deuda al Proveedor' : 'Monto Pagado'}</th>
                                    {activeTab === 'paid' && <th>Estado</th>}
                                    {activeTab === 'paid' && <th>F. Pago</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={activeTab === 'pending' ? 5 : 6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                                </svg>
                                                <span className="font-bold text-sm">Cargando...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredShipments.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTab === 'pending' ? 5 : 6} className="px-6 py-20 text-center text-slate-500 font-bold text-sm">
                                            {activeTab === 'pending' ? '🎉 No hay deudas pendientes con proveedores' : 'No hay pagos registrados'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredShipments.map(s => (
                                        <tr
                                            key={s.id}
                                            onClick={() => activeTab === 'pending' && toggleSelection(s.id)}
                                            className={`transition-colors ${activeTab === 'pending' ? 'cursor-pointer' : ''} ${selectedIds.has(s.id)
                                                ? 'bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                        >
                                            {activeTab === 'pending' && (
                                                <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(s.id)}
                                                        onChange={() => toggleSelection(s.id)}
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-5 py-4">
                                                <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-200 uppercase">{s.tracking_number}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="font-bold text-sm text-slate-600 dark:text-slate-400">{s.client_name}</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-xs font-bold text-slate-500">{s.date_arrived || '—'}</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className={`font-black text-sm ${activeTab === 'pending' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {formatMoney(Number(s.costo_flete) || 0)}
                                                </span>
                                            </td>
                                            {activeTab === 'paid' && (
                                                <td className="px-5 py-4">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-1 rounded-md">
                                                        {s.estado_pago_proveedor}
                                                    </span>
                                                </td>
                                            )}
                                            {activeTab === 'paid' && (
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-bold text-slate-500">
                                                        {s.updated_at ? format(new Date(s.updated_at), 'dd/MM/yyyy') : '—'}
                                                    </span>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
