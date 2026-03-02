"use client";
import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type PeriodType = '1d' | '7d' | '1m' | '3m' | '1y' | 'custom';

export interface ReportsPeriodFilterProps {
    // Main period
    period: PeriodType;
    setPeriod: (p: PeriodType) => void;
    customFrom: string;
    setCustomFrom: (v: string) => void;
    customTo: string;
    setCustomTo: (v: string) => void;
    // Compare period
    compareEnabled: boolean;
    setCompareEnabled: (v: boolean) => void;
    comparePeriod: PeriodType;
    setComparePeriod: (p: PeriodType) => void;
    compareCustomFrom: string;
    setCompareCustomFrom: (v: string) => void;
    compareCustomTo: string;
    setCompareCustomTo: (v: string) => void;
}

const PERIODS: { key: PeriodType; label: string }[] = [
    { key: '1d', label: 'Hoy' },
    { key: '7d', label: '7 días' },
    { key: '1m', label: 'Este mes' },
    { key: '3m', label: '3 meses' },
    { key: '1y', label: 'Este año' },
    { key: 'custom', label: 'Personalizado' },
];

export function getPeriodRange(period: PeriodType, customFrom: string, customTo: string): { from: string; to: string } {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    if (period === 'custom') {
        return {
            from: customFrom || fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
            to: customTo || fmt(now),
        };
    }

    const to = fmt(now);
    if (period === '1d') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate())), to };
    if (period === '7d') return { from: fmt(new Date(now.getTime() - 7 * 86400000)), to };
    if (period === '1m') return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    if (period === '3m') return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 3, 1)), to };
    if (period === '1y') return { from: fmt(new Date(now.getFullYear(), 0, 1)), to };
    return { from: fmt(now), to };
}

/** Kept for backwards compat — now just calls getPeriodRange for both periods */
export function getPeriodDates(
    period: PeriodType, customFrom: string, customTo: string,
    comparePeriod?: PeriodType, compareCustomFrom?: string, compareCustomTo?: string,
) {
    const main = getPeriodRange(period, customFrom, customTo);
    const prev = getPeriodRange(comparePeriod ?? '1m', compareCustomFrom ?? '', compareCustomTo ?? '');
    return { from: main.from, to: main.to, prevFrom: prev.from, prevTo: prev.to };
}

function PeriodPicker({
    label,
    period,
    setPeriod,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    accent = 'blue',
}: {
    label: string;
    period: PeriodType;
    setPeriod: (p: PeriodType) => void;
    customFrom: string;
    setCustomFrom: (v: string) => void;
    customTo: string;
    setCustomTo: (v: string) => void;
    accent?: 'blue' | 'violet';
}) {
    const activeCls = accent === 'violet'
        ? 'bg-violet-600 text-white shadow-sm'
        : 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm';

    const { from, to } = getPeriodRange(period, customFrom, customTo);

    return (
        <div className={`flex flex-col gap-2 p-3 rounded-2xl border ${accent === 'violet' ? 'border-violet-500/20 bg-violet-500/5' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]'}`}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${accent === 'violet' ? 'text-violet-400' : 'text-slate-400'}`}>{label}</span>
            <div className="flex flex-wrap items-center gap-1">
                <div className="flex items-center gap-1 bg-white/50 dark:bg-white/5 p-0.5 rounded-xl border border-slate-200 dark:border-white/10">
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${period === p.key ? activeCls : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {period === 'custom' && (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5">
                        <Calendar size={11} className={accent === 'violet' ? 'text-violet-400' : 'text-blue-500'} />
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                            className="bg-transparent text-[11px] font-bold outline-none text-slate-700 dark:text-slate-200 [color-scheme:dark]" />
                        <span className="text-slate-400 text-xs">→</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                            className="bg-transparent text-[11px] font-bold outline-none text-slate-700 dark:text-slate-200 [color-scheme:dark]" />
                    </div>
                )}
            </div>
            <p className={`text-[10px] font-bold ${accent === 'violet' ? 'text-violet-400/70' : 'text-slate-400'}`}>
                <span className="font-black">{from}</span> → <span className="font-black">{to}</span>
            </p>
        </div>
    );
}

export function ReportsPeriodFilter({
    period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo,
    compareEnabled, setCompareEnabled,
    comparePeriod, setComparePeriod,
    compareCustomFrom, setCompareCustomFrom,
    compareCustomTo, setCompareCustomTo,
}: ReportsPeriodFilterProps) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
                {/* Main period row */}
                <PeriodPicker
                    label="Período principal"
                    period={period} setPeriod={setPeriod}
                    customFrom={customFrom} setCustomFrom={setCustomFrom}
                    customTo={customTo} setCustomTo={setCustomTo}
                    accent="blue"
                />

                {/* Compare toggle button */}
                <button
                    onClick={() => setCompareEnabled(!compareEnabled)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all self-end mb-1 ${compareEnabled
                        ? 'border-violet-500/50 bg-violet-600 text-white shadow-md shadow-violet-500/20'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-violet-400/40'
                        }`}
                >
                    <ChevronDown size={12} className={`transition-transform ${compareEnabled ? 'rotate-180' : ''}`} />
                    {compareEnabled ? 'Comparando' : 'Comparar período'}
                </button>
            </div>

            {/* Compare period picker — only shown when enabled */}
            {compareEnabled && (
                <PeriodPicker
                    label="Comparar contra →"
                    period={comparePeriod} setPeriod={setComparePeriod}
                    customFrom={compareCustomFrom} setCustomFrom={setCompareCustomFrom}
                    customTo={compareCustomTo} setCustomTo={setCompareCustomTo}
                    accent="violet"
                />
            )}
        </div>
    );
}
