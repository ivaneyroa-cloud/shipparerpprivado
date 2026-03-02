"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Package,
    Truck,
    MapPin,
    Calendar,
    Search,
    ChevronRight,
    TrendingUp,
    AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Shipment } from '@/types';
import { format } from 'date-fns';
import { AICopilot } from '@/components/AICopilot';

export default function ClientDashboard() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMyShipments = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                // Note: RLS handles the security here. We just select.
                const { data, error } = await supabase
                    .from('shipments')
                    .select('id, tracking_number, client_id, client_name, client_code, category, internal_status, origin, weight, date_shipped, date_arrived, created_at')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setShipments(data || []);
            } catch (err) {
                console.error('Error fetching client shipments:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMyShipments();
    }, []);

    const stats = [
        { label: 'En Tránsito', value: shipments.filter(s => s.internal_status === 'En Transito').length, icon: <Truck />, color: 'blue' },
        { label: 'Recibidos', value: shipments.filter(s => s.internal_status === 'Recibido en Oficina').length, icon: <Package />, color: 'emerald' },
        { label: 'En Aduana', value: shipments.filter(s => s.internal_status === 'Retenido').length, icon: <AlertCircle />, color: 'orange' },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            {/* Welcome Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight dark:text-white mb-2">Mis Envíos</h1>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Bienvenido al panel central de logística</p>
                </div>
                <div className="flex items-center gap-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-6 py-4 rounded-3xl">
                    <TrendingUp className="text-blue-500" size={20} />
                    <span className="text-sm font-black dark:text-white">Total: {shipments.length} Paquetes</span>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-sm"
                    >
                        <div className={`w-12 h-12 bg-${stat.color}-500/10 text-${stat.color}-600 dark:text-${stat.color}-400 rounded-2xl flex items-center justify-center mb-6`}>
                            {stat.icon}
                        </div>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-4xl font-black dark:text-white">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Shipment List */}
            <section className="space-y-6">
                <div className="flex items-center justify-between px-4">
                    <h3 className="text-xl font-black dark:text-white">Seguimiento Detallado</h3>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar guía..."
                            className="pl-10 pr-6 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full text-xs font-bold outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="grid gap-4">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 animate-pulse rounded-3xl" />)
                    ) : shipments.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[32px] p-20 text-center">
                            <Package className="mx-auto text-slate-300 mb-4" size={48} />
                            <p className="text-slate-500 font-bold">No tienes envíos registrados aún.</p>
                        </div>
                    ) : (
                        shipments.map((s, i) => (
                            <motion.div
                                key={s.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 p-6 rounded-[28px] hover:shadow-xl hover:shadow-blue-500/5 transition-all flex flex-col md:flex-row items-center gap-8"
                            >
                                <div className="w-14 h-14 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform flex-shrink-0">
                                    <Package size={24} />
                                </div>

                                <div className="flex-1 min-w-0 space-y-1 text-center md:text-left">
                                    <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight uppercase">{s.tracking_number}</p>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        <span className="flex items-center gap-1.5"><MapPin size={14} className="text-blue-400" /> {s.origin}</span>
                                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-purple-400" /> {s.date_shipped ? format(new Date(s.date_shipped), 'dd/MM/yyyy') : 'Pendiente'}</span>
                                    </div>
                                </div>

                                <div className="flex-shrink-0">
                                    <span className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm
                    ${s.internal_status === 'Retirado' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                            s.internal_status === 'En Transito' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                'bg-slate-50 text-slate-600 border border-slate-100 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'}
                  `}>
                                        {s.internal_status}
                                    </span>
                                </div>

                                <div className="w-10 h-10 border border-slate-100 dark:border-white/10 rounded-full flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all cursor-pointer">
                                    <ChevronRight size={18} />
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </section>

            {/* AI Copilot */}
            <AICopilot shipments={shipments} />
        </div>
    );
}
