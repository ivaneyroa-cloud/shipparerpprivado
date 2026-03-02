"use client";
import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

interface DrillDownModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    shipments: any[];
}

export function ReportsDrillDown({ isOpen, onClose, title, shipments }: DrillDownModalProps) {
    const handleExport = () => {
        const rows = shipments.map(s => ({
            'Tracking': s.tracking_number,
            'Cliente': s.client_name,
            'Código': s.client_code,
            'Categoría': s.category,
            'Status': s.internal_status,
            'Origen': s.origin,
            'Fecha Salida': s.date_shipped,
            'Fecha Llegada': s.date_arrived,
            'Peso KG': s.weight,
            'Peso Comp.': s.peso_computable,
            'Cotizado': (Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0)).toFixed(2),
            'Costo Flete': s.costo_flete,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle');
        XLSX.writeFile(wb, `detalle-${title.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}>
                    <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                        onClick={e => e.stopPropagation()}
                        className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-[24px] w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
                            <div>
                                <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{shipments.length} registros</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleExport}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all">
                                    <ExternalLink size={11} /> Excel
                                </button>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                                    <X size={16} className="text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left border-separate" style={{ borderSpacing: '0 4px' }}>
                                <thead className="sticky top-0 z-10">
                                    <tr className="[&>th]:bg-slate-50 [&>th]:dark:bg-slate-800/80 [&>th]:px-4 [&>th]:py-2.5 [&>th]:text-[10px] [&>th]:font-black [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-slate-400 [&>th]:whitespace-nowrap">
                                        <th>Tracking</th><th>Cliente</th><th>Status</th>
                                        <th>Categoría</th><th>Origen</th><th>F. Salida</th>
                                        <th>F. Llegada</th><th className="text-right">KG</th>
                                        <th className="text-right">Cotizado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shipments.map(s => {
                                        const cotizado = (Number(s.precio_envio || 0) + Number(s.gastos_documentales || 0) + Number(s.impuestos || 0));
                                        return (
                                            <tr key={s.id} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group shadow-[0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)] rounded-xl [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl">
                                                <td className="px-4 py-2.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 max-w-[160px] truncate">{s.tracking_number}</td>
                                                <td className="px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-slate-200 max-w-[150px] truncate">{s.client_name}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider
                                                        ${s.internal_status === 'Retirado' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            s.internal_status === 'Retenido' ? 'bg-red-500/10 text-red-400' :
                                                                s.internal_status === 'Recibido en Oficina' ? 'bg-blue-500/10 text-blue-400' :
                                                                    'bg-slate-500/10 text-slate-400'}`}>
                                                        {s.internal_status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">{s.category || '—'}</td>
                                                <td className="px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">{s.origin}</td>
                                                <td className="px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">{s.date_shipped || '—'}</td>
                                                <td className="px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">{s.date_arrived || '—'}</td>
                                                <td className="px-4 py-2.5 text-right text-[12px] font-black text-slate-700 dark:text-slate-200">{Number(s.peso_computable || s.weight || 0).toFixed(1)}</td>
                                                <td className="px-4 py-2.5 text-right text-[12px] font-black text-emerald-600 dark:text-emerald-400">{cotizado > 0 ? `$${cotizado.toFixed(2)}` : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                    {shipments.length === 0 && (
                                        <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400 text-sm">Sin datos para este filtro</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
