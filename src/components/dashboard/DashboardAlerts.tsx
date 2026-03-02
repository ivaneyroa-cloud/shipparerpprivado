'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle, UserPlus, CheckCircle, Maximize, Trash2, Loader2, Package, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardAlertsProps {
    pendingCollection: number;
}

export function DashboardAlerts({ pendingCollection }: DashboardAlertsProps) {
    const [newClientAlerts, setNewClientAlerts] = useState<any[]>([]);
    const [partialReceptions, setPartialReceptions] = useState<any[]>([]);
    const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
    const [creatingClient, setCreatingClient] = useState<string | null>(null);

    useEffect(() => {
        fetchAlerts();
        fetchPartialReceptions();
    }, []);

    const fetchAlerts = async () => {
        const { data } = await supabase
            .from('activity_logs')
            .select('id, user_id, action, details, created_at')
            .eq('action', 'new_client_alert')
            .order('created_at', { ascending: false })
            .limit(10);

        if (data) {
            setNewClientAlerts(data.map(log => ({
                id: log.id,
                user_id: log.user_id,
                ...JSON.parse(log.details),
                created_at: log.created_at
            })));
        }
    };

    const fetchPartialReceptions = async () => {
        const { data } = await supabase
            .from('shipments')
            .select('id, tracking_number, client_name, boxes_count, bultos, reception_status')
            .eq('reception_status', 'PARTIAL')
            .order('updated_at', { ascending: false })
            .limit(10);

        if (data) setPartialReceptions(data);
    };

    const deleteAlert = async (id: string) => {
        const { error } = await supabase.from('activity_logs').delete().eq('id', id);
        if (!error) {
            setNewClientAlerts(prev => prev.filter(a => a.id !== id));
            toast.success('Aviso archivado');
        }
    };

    const handleCreateClientFromAlert = async (alert: any) => {
        setCreatingClient(alert.id);
        try {
            // 1. Get next code
            const { data: lastClients } = await supabase
                .from('clients')
                .select('code')
                .ilike('code', 'SH-%')
                .order('code', { ascending: false })
                .limit(1);

            let clientCode = 'SH-001';
            if (lastClients && lastClients.length > 0) {
                const lastCode = lastClients[0].code;
                const match = lastCode.match(/SH-(\d+)/);
                if (match) {
                    const nextNum = parseInt(match[1]) + 1;
                    clientCode = `SH-${nextNum.toString().padStart(3, '0')}`;
                }
            }

            // 2. Check if client with this name already exists
            const { data: existing } = await supabase
                .from('clients')
                .select('id, name')
                .ilike('name', alert.client_name.trim())
                .limit(1);

            if (existing && existing.length > 0) {
                await supabase.from('activity_logs').delete().eq('id', alert.id);
                setNewClientAlerts(prev => prev.filter(a => a.id !== alert.id));
                toast.warning(`${alert.client_name} ya existe en la base de clientes. Aviso archivado.`);
                return;
            }

            // 3. Insert into clients table
            const { error: clientError } = await supabase.from('clients').insert([{
                name: alert.client_name,
                code: clientCode,
                assigned_to: alert.user_id,
                phone: alert.phone,
                email: alert.email,
                tax_condition: 'Consumidor final',
                service_type: alert.service_type || 'Retiro'
            }]);

            if (clientError) throw clientError;

            // 4. Archive the alert
            await supabase.from('activity_logs').delete().eq('id', alert.id);
            setNewClientAlerts(prev => prev.filter(a => a.id !== alert.id));

            toast.success(`¡Cliente ${alert.client_name} creado con código ${clientCode} y asignado a ${alert.vendor_name}!`);
        } catch (err: any) {
            toast.error(err.message || 'Error al crear cliente');
        } finally {
            setCreatingClient(null);
        }
    };

    return (
        <div className="erp-card p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#2E7BFF]/5 dark:bg-[#2E7BFF]/8 blur-[80px] rounded-full" />
            <h2 className="text-base font-bold mb-5 flex items-center gap-3 relative z-10 uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                <AlertCircle className="text-[#2E7BFF]" size={18} strokeWidth={1.5} /> Estado de la Operación
            </h2>
            <div className="relative z-10 space-y-3">
                {/* Compact New Client Alerts List */}
                {newClientAlerts.map((alert) => (
                    <div key={alert.id} className="border border-green-500/20 dark:border-green-500/10 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-green-500/5 dark:bg-green-500/[0.03] p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-green-500/20">
                                    <UserPlus size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                                        {alert.client_name}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500">
                                        Vendedor: <span className="text-blue-500 font-extrabold uppercase">{alert.vendor_name}</span> • {new Date(alert.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleCreateClientFromAlert(alert)}
                                    disabled={creatingClient === alert.id}
                                    className="text-[9px] font-black bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-500 transition-all active:scale-95 flex items-center gap-1.5 shadow-sm shadow-green-600/20"
                                >
                                    {creatingClient === alert.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                    DAR DE ALTA
                                </button>
                                <button
                                    onClick={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}
                                    className={`p-1.5 rounded-lg border transition-all ${expandedAlertId === alert.id ? 'bg-slate-200 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <Maximize size={12} className={expandedAlertId === alert.id ? 'rotate-180' : ''} />
                                </button>
                                <button
                                    onClick={() => deleteAlert(alert.id)}
                                    className="p-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        <AnimatePresence>
                            {expandedAlertId === alert.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-white dark:bg-black/20 border-t border-slate-100 dark:border-white/5"
                                >
                                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contacto</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{alert.email || 'Sin mail'}</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{alert.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Origen / Tarifa</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{alert.origin_country}</p>
                                            <p className="text-xs font-bold text-green-600">{alert.offered_tariff} USD/Kg</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Servicio / Gasto Doc</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{alert.service_type}</p>
                                            <p className="text-xs font-bold text-blue-500">{alert.doc_expense || 'Sin gasto doc'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Observaciones</p>
                                            <p className="text-xs font-medium italic text-slate-500 line-clamp-3">{alert.notes || 'Sin observaciones'}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}

                {/* Partial Receptions Alert */}
                {partialReceptions.length > 0 && (
                    <div className="bg-orange-500/5 border-2 border-orange-500/20 p-5 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="text-orange-500" />
                                <p className="text-sm font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                                    Recepciones Parciales
                                </p>
                            </div>
                            <span className="text-xs font-black bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-lg">
                                {partialReceptions.length}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {partialReceptions.map(s => {
                                const received = Array.isArray(s.bultos) ? s.bultos.length : 0;
                                const declared = s.boxes_count || 0;
                                return (
                                    <div key={s.id} className="flex items-center justify-between bg-white/5 border border-orange-200 dark:border-orange-500/10 px-4 py-2.5 rounded-xl">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 dark:text-white">{s.client_name}</p>
                                            <p className="text-[10px] font-bold text-slate-500">
                                                {s.tracking_number} · {received}/{declared || '?'} cajas
                                            </p>
                                        </div>
                                        <Link href="/admin/dashboard/deposito"
                                            className="text-[9px] font-black bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1 shadow-sm">
                                            <Package size={11} /> Completar
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Pending Shipments */}
                {pendingCollection > 0 ? (
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors">
                        <p className="text-sm font-bold tracking-tight">Hay <span className="text-blue-400 font-black">{pendingCollection}</span> paquetes pendientes de recolección.</p>
                        <Link href="/admin/dashboard/shipments?status=Guía Creada" className="text-[10px] font-black bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-all  active:scale-95">VER AHORA</Link>
                    </div>
                ) : newClientAlerts.length === 0 && partialReceptions.length === 0 && (
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between">
                        <p className="text-sm font-bold">¡Excelente! Todo ha sido recolectado.</p>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                    </div>
                )}
            </div>
        </div>
    );
}
