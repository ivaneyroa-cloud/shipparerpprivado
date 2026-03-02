"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { BarChart3, Truck, DollarSign, Sparkles } from 'lucide-react';

import { ReportsPeriodFilter, getPeriodDates, getPeriodRange, PeriodType } from '@/components/reports/ReportsPeriodFilter';
import { ReportsComercial } from '@/components/reports/ReportsComercial';
import { ReportsLogistica } from '@/components/reports/ReportsLogistica';
import { ReportsFinanciero } from '@/components/reports/ReportsFinanciero';
import { ReportsAIChat } from '@/components/reports/ReportsAIChat';
import { ReportsDrillDown } from '@/components/reports/ReportsDrillDown';

type Tab = 'comercial' | 'logistica' | 'financiero' | 'ai';

const TABS: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'comercial', label: 'Comercial', icon: <BarChart3 size={15} />, color: 'text-blue-500' },
    { key: 'logistica', label: 'Logística', icon: <Truck size={15} />, color: 'text-purple-500' },
    { key: 'financiero', label: 'Financiero', icon: <DollarSign size={15} />, color: 'text-emerald-500' },
    { key: 'ai', label: 'Preguntale al ERP', icon: <Sparkles size={15} />, color: 'text-violet-400' },
];

export default function ReportsPage() {
    const [tab, setTab] = useState<Tab>('comercial');

    // Main period
    const [period, setPeriod] = useState<PeriodType>('1m');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    // Compare period
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [comparePeriod, setComparePeriod] = useState<PeriodType>('1m');
    const [compareCustomFrom, setCompareCustomFrom] = useState('');
    const [compareCustomTo, setCompareCustomTo] = useState('');

    // Drill-down state
    const [drillOpen, setDrillOpen] = useState(false);
    const [drillTitle, setDrillTitle] = useState('');
    const [drillShipments, setDrillShipments] = useState<any[]>([]);

    const { from, to } = getPeriodRange(period, customFrom, customTo);
    const { from: prevFrom, to: prevTo } = getPeriodRange(comparePeriod, compareCustomFrom, compareCustomTo);

    const handleDrillDown = async (title: string, filters: Record<string, string>) => {
        setDrillTitle(title);
        setDrillOpen(true);
        setDrillShipments([]);

        // dateField allows logística to filter by date_arrived or date_dispatched
        const dateField = filters.dateField || 'created_at';
        const orderField = ['date_arrived', 'date_dispatched'].includes(dateField) ? dateField : 'created_at';

        let q = supabase.from('shipments').select('id, tracking_number, client_name, client_code, internal_status, weight, peso_computable, origin, category, date_shipped, date_arrived, precio_envio, costo_flete, gastos_documentales, impuestos, created_at, updated_at, retenido_nota');
        if (filters.from) q = q.gte(dateField, filters.from);
        if (filters.to) q = q.lte(dateField, filters.to + (dateField === 'created_at' ? ' 23:59:59' : ''));
        if (filters.status) q = q.eq('internal_status', filters.status);
        if (filters.origin) q = q.eq('origin', filters.origin);
        if (filters.client) q = q.ilike('client_name', `%${filters.client}%`);

        const { data } = await q.order(orderField, { ascending: false });
        setDrillShipments(data || []);
    };

    const tabProps = { from, to, prevFrom, prevTo, compareEnabled, onDrillDown: handleDrillDown };

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Centro de Reportes
                </h1>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Análisis operativo, comercial y financiero · datos en tiempo real
                </p>
            </div>

            {/* Period filter */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] px-5 py-4 shadow-sm dark:shadow-2xl">
                <ReportsPeriodFilter
                    period={period} setPeriod={setPeriod}
                    customFrom={customFrom} setCustomFrom={setCustomFrom}
                    customTo={customTo} setCustomTo={setCustomTo}
                    compareEnabled={compareEnabled} setCompareEnabled={setCompareEnabled}
                    comparePeriod={comparePeriod} setComparePeriod={setComparePeriod}
                    compareCustomFrom={compareCustomFrom} setCompareCustomFrom={setCompareCustomFrom}
                    compareCustomTo={compareCustomTo} setCompareCustomTo={setCompareCustomTo}
                />
            </div>

            {/* Tab nav */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 w-fit">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tab === t.key
                            ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        <span className={tab === t.key ? t.color : ''}>{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                {tab === 'comercial' && <ReportsComercial {...tabProps} />}
                {tab === 'logistica' && <ReportsLogistica {...tabProps} />}
                {tab === 'financiero' && <ReportsFinanciero {...tabProps} />}
                {tab === 'ai' && <ReportsAIChat from={from} to={to} />}
            </motion.div>

            {/* Drill-down modal */}
            <ReportsDrillDown
                isOpen={drillOpen}
                onClose={() => setDrillOpen(false)}
                title={drillTitle}
                shipments={drillShipments}
            />
        </div>
    );
}
