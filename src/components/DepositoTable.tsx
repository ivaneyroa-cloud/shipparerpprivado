'use client';

import {
    AlertCircle,
    CheckCircle2,
    Truck
} from 'lucide-react';
import type { Shipment, ShipmentPackage } from '@/types';
import { format } from 'date-fns';

interface DepositoTableProps {
    shipments: any[]; // Using any to accept the partial pick
    loading: boolean;
    onRelease: (id: string) => void;
}

export function DepositoTable({ shipments, loading, onRelease }: DepositoTableProps) {
    if (loading) {
        return (
            <div className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
                <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="font-semibold text-sm">Cargando inventario de depósito...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 [&>th]:px-4 [&>th]:py-4 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-slate-500">
                            <th className="w-16 text-center">Fecha</th>
                            <th>Guía / Cliente</th>
                            <th className="text-center">Cant. Bultos (Dim)</th>
                            <th className="text-center">Peso Físico vs Comp.</th>
                            <th className="text-right">Aduana / Status</th>
                            <th className="text-center w-64">Estado de Entrega</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {shipments.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-20 text-center text-slate-500 font-medium">
                                    No hay envíos en depósito actualmente.
                                </td>
                            </tr>
                        ) : (
                            shipments.map((s) => {
                                // Traffic Light Logic
                                const isReady = s.estado_cobranza === 'Pagado';
                                const bultos = (s.bultos as ShipmentPackage[]) || [];
                                const cantBultos = bultos.length > 0 ? bultos.length : 1;

                                return (
                                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-4 py-4 align-middle text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-black text-slate-700 dark:text-slate-300">
                                                    {format(new Date(s.updated_at), 'dd')}
                                                </span>
                                                <span className="text-[10px] font-bold uppercase text-slate-400">
                                                    {format(new Date(s.updated_at), 'MMM')}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-4 align-middle">
                                            <p className="font-mono text-sm font-black text-slate-800 dark:text-slate-200">{s.tracking_number}</p>
                                            <p className="font-bold text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate max-w-[200px]">{s.client_name}</p>
                                        </td>

                                        <td className="px-4 py-4 align-middle text-center">
                                            <span className="font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm border border-slate-200 dark:border-slate-700 shadow-sm">
                                                {cantBultos} {cantBultos === 1 ? 'Caja' : 'Cajas'}
                                            </span>
                                        </td>

                                        <td className="px-4 py-4 align-middle text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Físico</span>
                                                    <span className="font-semibold text-slate-600 dark:text-slate-300">{Number(s.weight || 0).toFixed(2)}kg</span>
                                                </div>
                                                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                                <div className="flex flex-col items-start">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">Comp.</span>
                                                    <span className="font-black text-indigo-600 dark:text-indigo-400">{Number(s.peso_computable || 0).toFixed(2)}kg</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-4 align-middle text-right">
                                            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                                {s.internal_status}
                                            </span>
                                        </td>

                                        <td className="px-4 py-4 align-middle">
                                            <div className="flex flex-col items-center gap-2 w-full">
                                                {/* TRAFFIC LIGHT */}
                                                <div className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 shadow-sm
                                                    ${isReady
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                                    }`}
                                                >
                                                    {isReady ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
                                                    {isReady ? 'LISTO PARA ENTREGAR' : 'RETENIDO (Deuda)'}
                                                </div>

                                                {/* ACTION BUTTON */}
                                                <button
                                                    onClick={() => onRelease(s.id)}
                                                    disabled={!isReady}
                                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all
                                                        ${isReady
                                                            ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
                                                        }`}
                                                >
                                                    <Truck size={16} />
                                                    Despachar / Entregar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

