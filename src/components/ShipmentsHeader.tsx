import React from 'react';
import { motion } from 'framer-motion';
import { Package, TrendingUp, Calendar } from 'lucide-react';

interface ShipmentsHeaderProps {
    selectedMonth: string;
    setSelectedMonth: (val: string) => void;
    progressPercent: number;
    todayCount: number;
    dailyGoal: number;
    totalShipments?: number;
}

export function ShipmentsHeader({
    selectedMonth,
    setSelectedMonth,
    progressPercent,
    todayCount,
    dailyGoal,
    totalShipments = 0,
}: ShipmentsHeaderProps) {
    return (
        <div className="erp-card p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Title + context */}
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E7BFF] to-[#1B6AF0] flex items-center justify-center  shrink-0">
                        <Package size={20} strokeWidth={1.5} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            Gestión de Envíos
                        </h1>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                Centro de control operativo
                            </span>
                            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--text-muted)', opacity: 0.4 }} />
                            <div className="flex items-center gap-1.5">
                                <Calendar size={11} className="text-[#2E7BFF]" />
                                <input
                                    type="month"
                                    className="erp-date-input bg-transparent border-none text-[#2E7BFF] font-bold text-xs uppercase cursor-pointer"
                                    style={{ padding: '0', width: 'auto' }}
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Operational metrics mini-strip */}
                <div className="flex items-center gap-3">
                    {/* Total shipments — PRIMARY KPI */}
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total</span>
                        <span className="text-2xl font-black erp-count-animate gradient-text">{totalShipments}</span>
                    </div>

                    {/* Daily gauge — secondary */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'var(--input-bg)' }}>
                        <div className="flex items-center gap-1.5">
                            <TrendingUp size={12} className="text-[#2E7BFF]" />
                            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Hoy</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                    className="h-full rounded-full bg-gradient-to-r from-[#2E7BFF] to-[#00C2FF]"
                                />
                            </div>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                                {todayCount}<span style={{ color: 'var(--text-muted)' }}>/{dailyGoal}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
