"use client";
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReportsKPICardProps {
    title: string;
    value: string | number;
    prevValue?: number;
    currentNum?: number;
    unit?: string;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
    index?: number;
}

export function ReportsKPICard({ title, value, prevValue, currentNum, unit, icon, color, onClick, index = 0 }: ReportsKPICardProps) {
    let deltaPercent: number | null = null;
    if (prevValue !== undefined && currentNum !== undefined && prevValue > 0) {
        deltaPercent = ((currentNum - prevValue) / prevValue) * 100;
    }

    const isUp = deltaPercent !== null && deltaPercent > 0;
    const isDown = deltaPercent !== null && deltaPercent < 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            onClick={onClick}
            className={`relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[20px] p-5 shadow-sm dark:shadow-2xl transition-all group overflow-hidden ${onClick ? 'cursor-pointer hover:border-blue-400/50 dark:hover:border-blue-500/40' : ''}`}
        >
            {/* Background glow */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: color }} />

            <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: color }}>
                    {icon}
                </div>
                {deltaPercent !== null && (
                    <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${isUp ? 'bg-emerald-500/10 text-emerald-500' : isDown ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : <Minus size={10} />}
                        {Math.abs(deltaPercent).toFixed(1)}%
                    </div>
                )}
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
                {value}{unit && <span className="text-sm font-bold text-slate-400 ml-1">{unit}</span>}
            </p>

            {prevValue !== undefined && prevValue > 0 && (
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                    Período ant.: {prevValue.toLocaleString('es-AR')}{unit ? ` ${unit}` : ''}
                </p>
            )}


            {onClick && (
                <p className="text-[10px] text-blue-500 font-black uppercase tracking-wider mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver detalle →
                </p>
            )}
        </motion.div>
    );
}
