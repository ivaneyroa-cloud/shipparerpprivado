"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
    TrendingUp,
    DollarSign,
    Package,
    Users,
    UserPlus,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Loader2,
    ArrowUpRight,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface Shipment {
    id: string;
    tracking_number: string;
    client_name: string;
    client_id: string | null;
    weight: number;
    peso_computable: number | null;
    internal_status: string;
    precio_envio: number | null;
    gastos_documentales: number | null;
    impuestos: number | null;
    costo_flete: number | null;
    monto_cobrado: number | null;
    created_at: string;
}

interface AllShipmentMinimal {
    client_id: string | null;
    client_name: string | null;
    created_at: string;
}

interface Profile {
    id: string;
    full_name: string;
    role: string;
    org_id: string;
}

export default function CommissionsDashboard() {
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<Profile | null>(null);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [allShipmentsEver, setAllShipmentsEver] = useState<AllShipmentMinimal[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Fetch Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('id, full_name, role, org_id')
                .eq('id', session.user.id)
                .single();

            if (profile) setUserProfile(profile);

            // Fetch Clients (to know who is assigned to whom)
            const { data: clientsData } = await supabase.from('clients').select('id, name, assigned_to');
            if (clientsData) setClients(clientsData);

            // If admin, fetch all profiles to build leaderboard
            if (profile?.role === 'admin' || profile?.role === 'super_admin') {
                const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role, org_id');
                if (profilesData) setProfiles(profilesData);
            }

            fetchData(currentMonth);
        };

        const fetchData = async (month: Date) => {
            setLoading(true);
            const start = startOfMonth(month).toISOString();
            const end = endOfMonth(month).toISOString();

            const { data, error } = await supabase
                .from('shipments')
                .select('id, tracking_number, client_name, client_id, weight, peso_computable, internal_status, precio_envio, gastos_documentales, impuestos, costo_flete, monto_cobrado, created_at')
                .gte('created_at', start)
                .lte('created_at', end);

            if (error) {
                toast.error("Error al cargar datos");
            } else {
                setShipments(data || []);
            }

            // Fetch ALL shipments ever (minimal) to identify first-time clients
            const { data: allData } = await supabase
                .from('shipments')
                .select('client_id, client_name, created_at')
                .order('created_at', { ascending: true });

            if (allData) setAllShipmentsEver(allData);

            setLoading(false);
        };

        init();
    }, [currentMonth]);

    const formatMoney = (val: number) => new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2
    }).format(val);

    // Advanced Stats Calculation
    const stats: {
        totalFacturado: number;
        totalGanancia: number;
        totalComisiones: number;
        totalKG: number;
        newClients: { name: string; id: string }[];
        leaderboard: any[];
        processed: any[];
    } = useMemo(() => {
        const clientVendorMap: Record<string, string> = clients.reduce((acc, c) => ({ ...acc, [c.id]: c.assigned_to }), {});

        const processed = shipments.map(s => {
            const envio = Number(s.precio_envio) || 0;
            const gastos = Number(s.gastos_documentales) || 0;
            const imp = Number(s.impuestos) || 0;
            const costo_prov = Number(s.costo_flete) || 0;
            const cobrado_real = Number(s.monto_cobrado) || 0;

            const totalEstimadoRef = envio + gastos + imp;
            const totalCobrarFinal = cobrado_real > 0 ? cobrado_real : totalEstimadoRef;
            const ganancia = totalCobrarFinal - costo_prov;
            const comision = ganancia > 0 ? (ganancia * 0.75) * 0.05 : 0;
            const vendorId = clientVendorMap[s.client_id || ''] || null;

            return { ...s, ganancia, comision, vendorId, totalFacturado: totalCobrarFinal };
        });

        if (userProfile?.role === 'admin' || userProfile?.role === 'super_admin') {
            // Global Stats for Admin
            const totalFacturado = processed.reduce((acc, s) => acc + s.totalFacturado, 0);
            const totalGanancia = processed.reduce((acc, s) => acc + s.ganancia, 0);
            const totalComisiones = processed.reduce((acc, s) => acc + s.comision, 0);
            const totalKG = processed.reduce((acc, s) => acc + (Number(s.peso_computable || s.weight) || 0), 0);

            // Leaderboard calculation
            const leaderboard = profiles
                .filter(p => ['sales', 'admin'].includes(p.role))
                .map(p => {
                    const userSales = processed.filter(s => s.vendorId === p.id);
                    return {
                        name: p.full_name,
                        role: p.role,
                        comisiones: userSales.reduce((acc, s) => acc + s.comision, 0),
                        facturado: userSales.reduce((acc, s) => acc + s.totalFacturado, 0),
                        kilos: userSales.reduce((acc, s) => acc + (Number(s.peso_computable || s.weight) || 0), 0),
                        count: userSales.length
                    };
                })
                .sort((a, b) => b.comisiones - a.comisiones);

            return {
                totalFacturado,
                totalGanancia,
                totalComisiones,
                totalKG,
                newClients: getNewClients(),
                leaderboard,
                processed
            };
        } else {
            // Personal Stats for Seller
            const mySales = processed.filter(s => s.vendorId === userProfile?.id);
            const totalFacturado = mySales.reduce((acc, s) => acc + s.totalFacturado, 0);
            const totalComisiones = mySales.reduce((acc, s) => acc + s.comision, 0);
            const totalKG = mySales.reduce((acc, s) => acc + (Number(s.peso_computable || s.weight) || 0), 0);

            return {
                totalFacturado,
                totalComisiones,
                totalKG,
                mySales,
                processed: mySales,
                totalGanancia: 0,
                newClients: getNewClients(),
                leaderboard: []
            };
        }

        function getNewClients() {
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);
            // Find the first shipment FOR EACH client_id across all time
            const firstShipmentByClient: Record<string, { date: Date; name: string }> = {};
            allShipmentsEver.forEach(s => {
                if (!s.client_id) return;
                const d = new Date(s.created_at);
                if (!firstShipmentByClient[s.client_id] || d < firstShipmentByClient[s.client_id].date) {
                    firstShipmentByClient[s.client_id] = { date: d, name: s.client_name || 'Sin nombre' };
                }
            });
            // A client is 'new' if their first shipment falls in the selected month
            const newOnes: { name: string; id: string }[] = [];
            Object.entries(firstShipmentByClient).forEach(([clientId, info]) => {
                if (info.date >= monthStart && info.date <= monthEnd) {
                    newOnes.push({ name: info.name, id: clientId });
                }
            });
            return newOnes;
        }
    }, [shipments, clients, userProfile, profiles, currentMonth, allShipmentsEver]);

    const changeMonth = (offset: number) => {
        setCurrentMonth(prev => offset > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="text-slate-500 font-bold animate-pulse">Analizando métricas...</p>
        </div>
    );

    const isSales = userProfile?.role === 'sales';

    return (
        <div className="space-y-8 pb-20">
            {/* Header / Month Filter */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-4 rounded-3xl shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"><ChevronLeft size={20} /></button>
                    <div className="flex flex-col items-center min-w-[160px]">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Período Seleccionado</span>
                        <span className="text-xl font-black capitalize dark:text-white">
                            {format(currentMonth, 'MMMM yyyy', { locale: es })}
                        </span>
                    </div>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"><ChevronRight size={20} /></button>
                </div>

                <div className="hidden md:flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                    <Calendar size={14} className="text-blue-500" />
                    <span>KPIs Automáticos</span>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className={`grid grid-cols-1 ${isSales ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-6`}>
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-6 rounded-[28px] shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 blur-3xl group-hover:bg-blue-600/10 transition-colors" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Facturado</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{formatMoney(stats.totalFacturado)}</p>
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">VENTAS BRUTAS</span>
                        <ArrowUpRight size={14} className="text-blue-500" />
                    </div>
                </div>

                {!isSales && (
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-6 rounded-[28px] shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 blur-3xl group-hover:bg-emerald-600/10 transition-colors" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Ganancia Neta (Org)</p>
                        <p className="text-3xl font-black text-emerald-600">{formatMoney(stats.totalGanancia)}</p>
                        <div className="mt-4 flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">POST-COSTOS LOGÍSTICOS</span>
                            <TrendingUp size={14} className="text-emerald-500" />
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-6 rounded-[28px] shadow-sm relative overflow-hidden group border-b-4 border-b-blue-500">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 blur-3xl transition-colors" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{isSales ? 'Mis Comisiones' : 'Comisiones a Pagar'}</p>
                    <p className="text-3xl font-black text-blue-600">{formatMoney(stats.totalComisiones)}</p>
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">5% S/ GANANCIA - 25%</span>
                        <DollarSign size={14} className="text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 p-6 rounded-[28px] shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-3xl group-hover:bg-indigo-600/10 transition-colors" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Volumen Kilo</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{(stats.totalKG || 0).toFixed(1)} KG</p>
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">PESO COMPUTABLE TOTAL</span>
                        <Package size={14} className="text-indigo-500" />
                    </div>
                </div>
            </div>

            {/* Detailed Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Panel: Table / List */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-[32px] shadow-sm overflow-hidden border-t-8 border-t-slate-100 dark:border-t-white/5">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
                                <Search size={16} className="text-blue-500" />
                                Detalle de Operaciones
                            </h2>
                            <span className="text-[10px] font-bold text-slate-400">{stats.processed.length} ENVÍOS</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5">
                                        <th className="px-6 py-4">Guía / Cliente</th>
                                        <th className="px-6 py-4 text-center">Peso</th>
                                        <th className="px-6 py-4 text-right">F / G / C</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {stats.processed.map((s: any) => (
                                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <p className="text-[11px] font-black text-slate-900 dark:text-white font-mono">{s.tracking_number}</p>
                                                <p className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{s.client_name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{(Number(s.peso_computable || s.weight) || 0).toFixed(1)} KG</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[11px] font-black text-slate-900 dark:text-white">{formatMoney(s.totalFacturado)}</span>
                                                    {!isSales && <span className="text-[9px] font-bold text-emerald-500">G: {formatMoney(s.ganancia)}</span>}
                                                    <span className="text-[9px] font-bold text-blue-500">C: {formatMoney(s.comision)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.processed.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-10 text-center text-slate-500 font-bold">No hay embarques registrados en este mes.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Side Stats / Leaderboard */}
                <div className="lg:col-span-4 space-y-6">
                    {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
                        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-[32px] p-6 shadow-sm border-l-8 border-l-blue-500">
                            <h3 className="text-sm font-black uppercase tracking-tighter mb-6 flex items-center gap-2">
                                <TrendingUp size={16} className="text-blue-500" /> Leaderboard Mensual
                            </h3>
                            <div className="space-y-4">
                                {stats.leaderboard?.map((p, i) => (
                                    <div key={p.name} className="flex items-center justify-between group p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black
                                                ${i === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}
                                            `}>
                                                {i + 1}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900 dark:text-white">{p.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">{p.role === 'admin' || p.role === 'super_admin' ? 'BOSS' : 'Ventas'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-blue-600">{formatMoney(p.comisiones)}</p>
                                            <p className="text-[9px] font-bold text-slate-400">{p.kilos.toFixed(1)} KG</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Meta Mensual (Seller View) */}
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-3xl opacity-50" />
                        <h3 className="text-sm font-black uppercase tracking-tighter mb-4 relative z-10">Meta de Volumen</h3>
                        <div className="mb-6 relative z-10">
                            <div className="flex items-end justify-between mb-2">
                                <p className="text-slate-500 text-xs font-bold font-mono">{(stats.totalKG || 0).toFixed(0)} / 500 KG</p>
                                <p className="text-blue-500 text-sm font-black">{Math.min(100, Math.round(((stats.totalKG || 0) / 500) * 100))}%</p>
                            </div>
                            <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, ((stats.totalKG || 0) / 500) * 100)}%` }}
                                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_10px_rgba(37,99,235,0.3)]"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider relative z-10">
                            Faltan <span className="text-blue-500 font-black">{Math.max(0, 500 - (stats.totalKG || 0)).toFixed(1)} KG</span> para alcanzar el objetivo del mes.
                        </p>
                    </div>

                    {/* New Clients Card */}
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-[32px] p-8 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/5 blur-3xl opacity-50" />
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                            <UserPlus size={18} className="text-emerald-500" />
                            <h3 className="text-sm font-black uppercase tracking-tighter">Clientes Nuevos</h3>
                        </div>
                        <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-3 relative z-10">{stats.newClients.length}</p>
                        {stats.newClients.length > 0 ? (
                            <div className="space-y-2 relative z-10">
                                {stats.newClients.slice(0, 5).map(c => (
                                    <div key={c.id} className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                                        <span className="text-emerald-500">●</span> {c.name}
                                    </div>
                                ))}
                                {stats.newClients.length > 5 && (
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">+{stats.newClients.length - 5} más</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-[10px] font-bold text-slate-400 relative z-10">Sin clientes nuevos este mes</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
