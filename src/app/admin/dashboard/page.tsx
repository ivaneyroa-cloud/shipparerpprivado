"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Plus, ArrowUpRight, TrendingUp, Package, Users,
    MapPin, UserPlus, Send
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

// ── Extracted components ──
import { DashboardTasksWidget } from '@/components/dashboard/DashboardTasksWidget';
import { DashboardAlerts } from '@/components/dashboard/DashboardAlerts';
import { NewClientAlertModal } from '@/components/dashboard/NewClientAlertModal';
import { DailyProgressPanel } from '@/components/dashboard/DailyProgressPanel';
import { ManagerPerformancePanel } from '@/components/dashboard/ManagerPerformancePanel';
import { OperationalRadar } from '@/components/dashboard/OperationalRadar';

export default function DashboardPage() {
    const [userProfile, setUserProfile] = useState<any>(null);
    const [stats, setStats] = useState({
        monthlyActiveClients: 0,
        pendingCollection: 0,
        totalShipmentsMonth: 0,
        totalWeightMonth: 0
    });
    const [showNewClientAlert, setShowNewClientAlert] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);

    // ── Profile fetch ──
    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, role, org_id, is_active, full_name, email')
                    .eq('id', session.user.id)
                    .single();

                if (profile) setUserProfile(profile);
            }
        };
        fetchProfile();
    }, []);

    // ── Load team for tasks modal ──
    const loadTeamMembers = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .neq('id', session.user.id);
        if (profiles) setTeamMembers(profiles);
    }, []);

    useEffect(() => { loadTeamMembers(); }, [loadTeamMembers]);

    // ── Stats fetch ──
    useEffect(() => {
        const fetchStats = async () => {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            if (userProfile?.role === 'sales') {
                const { data: assignedClients } = await supabase
                    .from('clients')
                    .select('name')
                    .eq('assigned_to', session.user.id);

                const clientNames = assignedClients?.map(c => c.name) || [];

                if (clientNames.length > 0) {
                    const { data: shipments } = await supabase
                        .from('shipments')
                        .select('weight, internal_status, client_name, created_at')
                        .gte('created_at', startOfMonth)
                        .in('client_name', clientNames);

                    if (shipments) {
                        const totalWeight = shipments.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);
                        setStats({
                            monthlyActiveClients: clientNames.length,
                            pendingCollection: shipments.filter(s => s.internal_status === 'Guía Creada').length,
                            totalShipmentsMonth: shipments.length,
                            totalWeightMonth: Number(totalWeight.toFixed(2))
                        });
                    }
                } else {
                    setStats({ monthlyActiveClients: 0, pendingCollection: 0, totalShipmentsMonth: 0, totalWeightMonth: 0 });
                }
            } else {
                const { data: shipments } = await supabase
                    .from('shipments')
                    .select('weight, internal_status, client_name, created_at')
                    .gte('created_at', startOfMonth);

                if (shipments) {
                    const uniqueClients = new Set(shipments.map(s => s.client_name)).size;
                    const pendingCollection = shipments.filter(s => s.internal_status === 'Guía Creada').length;
                    const totalWeight = shipments.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);
                    setStats({
                        monthlyActiveClients: uniqueClients,
                        pendingCollection,
                        totalShipmentsMonth: shipments.length,
                        totalWeightMonth: Number(totalWeight.toFixed(2))
                    });
                }
            }
        };

        if (userProfile) fetchStats();
    }, [userProfile]);

    const isSales = userProfile?.role === 'sales';
    const isAdmin = userProfile?.role === 'admin';
    const isLogistics = userProfile?.role === 'logistics';
    const firstName = userProfile?.full_name?.split(' ')[0] || 'Usuario';

    const salesCards = [
        { label: 'Mis Clientes', value: stats.monthlyActiveClients, icon: <Users size={18} strokeWidth={1.5} />, color: 'blue' },
        { label: 'Guías del Mes', value: stats.totalShipmentsMonth, icon: <Package size={18} strokeWidth={1.5} />, color: 'indigo' },
        { label: 'KGs Totales', value: stats.totalWeightMonth + ' KG', icon: <ArrowUpRight size={18} strokeWidth={1.5} />, color: 'emerald' },
    ];

    const adminCards = [
        { label: 'Clientes del Mes', value: stats.monthlyActiveClients, icon: <Users size={18} strokeWidth={1.5} />, color: 'blue' },
        { label: 'Guías por Recolectar', value: stats.pendingCollection, icon: <Package size={18} strokeWidth={1.5} />, color: 'amber' },
        { label: 'Paquetes del Mes', value: stats.totalShipmentsMonth, icon: <TrendingUp size={18} strokeWidth={1.5} />, color: 'indigo' },
        { label: 'KGs del Mes', value: stats.totalWeightMonth + ' KG', icon: <ArrowUpRight size={18} strokeWidth={1.5} />, color: 'emerald' },
    ];

    const cards = isSales ? salesCards : adminCards;

    return (
        <div className="space-y-5 md:space-y-8">
            {/* Saludo */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                        ¡Buen día, {firstName}! 👋
                    </h1>
                    <p className="font-medium text-sm md:text-base" style={{ color: 'var(--text-muted)' }}>
                        {isSales
                            ? 'Acá tenés un resumen de tus clientes y envíos.'
                            : 'Acá tenés un resumen de cómo viene la logística hoy.'}
                    </p>
                </div>
            </div>

            {/* ═══ OPERATIONAL RADAR — Before metrics ═══ */}
            {!isSales && <OperationalRadar />}

            {/* Stats Cards */}
            <div className={`grid grid-cols-2 ${isSales ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3 md:gap-4 erp-stagger`}>
                {cards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="erp-card p-5 group cursor-default"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl flex items-center justify-center
                                ${card.color === 'blue' ? 'bg-[#2E7BFF]/15 text-[#2E7BFF]' :
                                    card.color === 'amber' ? 'bg-[#FFB020]/15 text-[#FFB020]' :
                                        card.color === 'indigo' ? 'bg-indigo-500/15 text-indigo-400' :
                                            'bg-[#10B981]/15 text-[#10B981]'}
                            `}>
                                {card.icon}
                            </div>
                            <div>
                                <p className="erp-kpi-label">{card.label}</p>
                                <p className="erp-kpi-value">{card.value}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Tasks Widget ── */}
            <DashboardTasksWidget userProfile={userProfile} teamMembers={teamMembers} />

            {/* Content Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                {/* Main Content */}
                <div className={`${isSales ? 'lg:col-span-7' : 'lg:col-span-8'} space-y-6`}>
                    {/* Admin/Logistics: Estado de la Operación */}
                    {(isAdmin || isLogistics) && (
                        <DashboardAlerts pendingCollection={stats.pendingCollection} />
                    )}

                    {/* Manager Performance Panel — admin only */}
                    {isAdmin && (
                        <ManagerPerformancePanel />
                    )}

                    {/* Sales: Aviso de Nuevo Cliente */}
                    {isSales && (
                        <div className="erp-card p-7 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#10B981]/5 dark:bg-[#10B981]/10 blur-[80px] rounded-full" />
                            <h2 className="text-base font-bold mb-3 flex items-center gap-3 relative z-10 uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                <UserPlus className="text-[#10B981]" size={18} strokeWidth={1.5} /> Cerrar Nuevo Cliente
                            </h2>
                            <p className="text-sm font-medium mb-5 relative z-10" style={{ color: 'var(--text-muted)' }}>
                                ¿Cerraste un cliente nuevo? Avisale a Logística para que lo contacten y arranquen el proceso.
                            </p>
                            <div className="flex flex-wrap gap-3 relative z-10">
                                <button
                                    onClick={() => setShowNewClientAlert(true)}
                                    className="bg-[#10B981] hover:bg-[#0EA573] text-white font-bold px-5 py-3 rounded-xl transition-all active:scale-95 text-sm flex items-center gap-2"
                                >
                                    <Send size={16} />
                                    AVISAR A LOGÍSTICA
                                </button>
                                <Link
                                    href="/admin/dashboard/commissions"
                                    className="bg-[#2E7BFF] hover:bg-[#2E7BFF]/90 text-white font-bold px-5 py-3 rounded-xl transition-all active:scale-95  text-sm flex items-center gap-2"
                                >
                                    <TrendingUp size={16} />
                                    VER COMISIONES
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className={`${isSales ? 'lg:col-span-5' : 'lg:col-span-4'} space-y-4`}>
                    {/* Daily Progress — visible to operators/logistics/admin */}
                    {!isSales && <DailyProgressPanel />}
                    <div className="erp-card p-6 h-full">
                        <h3 className="erp-kpi-label mb-5">Acceso Rápido</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {isSales ? (
                                <>
                                    <Link href="/admin/dashboard/clients" className="flex items-center gap-3 p-4 border rounded-xl border-white/[0.04] bg-white/[0.02] hover:bg-[#2E7BFF]/10 hover:border-[#2E7BFF]/20 transition-all group font-semibold text-xs tracking-wider" style={{ color: 'var(--text-primary)' }}>
                                        <div className="w-8 h-8 bg-[#2E7BFF]/10 rounded-lg flex items-center justify-center text-[#2E7BFF] group-hover:bg-[#2E7BFF]/20 transition-all">
                                            <Users size={15} strokeWidth={1.5} />
                                        </div>
                                        MIS CLIENTES
                                    </Link>
                                    <Link href="/admin/dashboard/shipments" className="flex items-center gap-3 p-4 border rounded-xl border-white/[0.04] bg-white/[0.02] hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all group font-semibold text-xs tracking-wider" style={{ color: 'var(--text-primary)' }}>
                                        <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                                            <Package size={15} strokeWidth={1.5} />
                                        </div>
                                        MIS ENVÍOS
                                    </Link>
                                    <Link href="/admin/dashboard/chat" className="flex items-center gap-3 p-4 border rounded-xl border-white/[0.04] bg-white/[0.02] hover:bg-[#10B981]/10 hover:border-[#10B981]/20 transition-all group font-semibold text-xs tracking-wider" style={{ color: 'var(--text-primary)' }}>
                                        <div className="w-8 h-8 bg-[#10B981]/10 rounded-lg flex items-center justify-center text-[#10B981] group-hover:bg-[#10B981]/20 transition-all">
                                            <Send size={15} strokeWidth={1.5} />
                                        </div>
                                        CHAT IA
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link href="/admin/dashboard/operations" className="flex items-center gap-3 p-4 border rounded-xl border-[#FFB020]/10 bg-[#FFB020]/[0.03] hover:bg-[#FFB020]/10 hover:border-[#FFB020]/20 transition-all group font-semibold text-xs tracking-wider" style={{ color: 'var(--text-primary)' }}>
                                        <div className="w-8 h-8 bg-gradient-to-br from-[#FFB020]/20 to-[#FF8C00]/20 rounded-lg flex items-center justify-center text-[#FFB020] group-hover:from-[#FFB020]/30 group-hover:to-[#FF8C00]/30 transition-all">
                                            <TrendingUp size={15} strokeWidth={1.5} />
                                        </div>
                                        CONTROL DE OPERACIONES
                                    </Link>
                                    <Link href="/admin/dashboard/shipments" className="flex items-center gap-3 p-4 border rounded-xl border-white/[0.04] bg-white/[0.02] hover:bg-[#2E7BFF]/10 hover:border-[#2E7BFF]/20 transition-all group font-semibold text-xs tracking-wider" style={{ color: 'var(--text-primary)' }}>
                                        <div className="w-8 h-8 bg-[#2E7BFF]/10 rounded-lg flex items-center justify-center text-[#2E7BFF] group-hover:bg-[#2E7BFF]/20 transition-all">
                                            <Plus size={15} strokeWidth={1.5} className="group-hover:rotate-90 transition-transform" />
                                        </div>
                                        NUEVO ENVÍO
                                    </Link>
                                    <Link href="/admin/dashboard/clients" className="flex items-center gap-3 p-4 border rounded-xl border-white/[0.04] bg-white/[0.02] hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all group font-semibold text-xs tracking-wider" style={{ color: 'var(--text-primary)' }}>
                                        <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                                            <Users size={15} strokeWidth={1.5} />
                                        </div>
                                        NUEVO CLIENTE
                                    </Link>
                                    <Link href="/admin/dashboard/settings?tab=origins" className="flex items-center gap-3 p-4 border rounded-xl border-white/[0.04] bg-white/[0.02] hover:bg-[#10B981]/10 hover:border-[#10B981]/20 transition-all group font-semibold text-xs tracking-wider" style={{ color: 'var(--text-primary)' }}>
                                        <div className="w-8 h-8 bg-[#10B981]/10 rounded-lg flex items-center justify-center text-[#10B981] group-hover:bg-[#10B981]/20 transition-all">
                                            <MapPin size={15} strokeWidth={1.5} />
                                        </div>
                                        NUEVO PAÍS DE ORIGEN
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* New Client Alert Modal (Sales Only) */}
            <NewClientAlertModal
                isOpen={showNewClientAlert}
                onClose={() => setShowNewClientAlert(false)}
                userProfile={userProfile}
            />
        </div>
    );
}
