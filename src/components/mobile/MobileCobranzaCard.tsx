'use client';

import React from 'react';
import { FileCheck, FileText } from 'lucide-react';
import { ShipmentCobranzasRow } from '@/types';

const formatMoney = (val: number) =>
    new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(val);

interface MobileCobranzaCardProps {
    s: ShipmentCobranzasRow;
    draftValues: Record<string, string>;
    onDraftChange: (id: string, field: string, val: string) => void;
    onDraftBlur: (s: ShipmentCobranzasRow, field: keyof ShipmentCobranzasRow, val: string) => void;
    estadoOpciones: string[];
    handleLocalUpdate: (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null) => void;
    handleInlineUpdate: (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null, last_updated?: string) => void;
    onPayment: (s: ShipmentCobranzasRow) => void;
    clientTarifaMap: Record<string, string>;
}

export function MobileCobranzaCard({
    s, draftValues, onDraftChange, onDraftBlur, estadoOpciones,
    handleLocalUpdate, handleInlineUpdate, onPayment, clientTarifaMap
}: MobileCobranzaCardProps) {
    const envio = Number(s.precio_envio) || 0;
    const gastos = Number(s.gastos_documentales) || 0;
    const imp = Number(s.impuestos) || 0;
    const costo_prov = Number(s.costo_flete) || 0;
    const cobrado_real = Number(s.monto_cobrado) || 0;
    const totalRef = envio + gastos + imp;
    const ganancia = cobrado_real > 0 ? cobrado_real - costo_prov : 0;

    const estadoColor = s.estado_cobranza === 'Pagado'
        ? 'bg-[#FF6900] text-white border-[#FF6900]'
        : s.estado_cobranza === 'Facturado'
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-slate-100 border-slate-200 text-slate-500';

    return (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
            <div className="p-4 space-y-3">
                {/* Row 1: Tracking + Status badge */}
                <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-slate-700 dark:text-slate-200">{s.tracking_number}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${estadoColor}`}>
                        {s.estado_cobranza || 'Pendiente'}
                    </span>
                </div>

                {/* Row 2: Client */}
                <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">{s.client_name}</p>

                {/* Row 3: Quote mode badge */}
                {s.quote_mode === 'tarifario' && (
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-2 py-1 rounded-lg">📋 TARIFARIO</span>
                        {s.client_id && clientTarifaMap[s.client_id] && (
                            <span className="text-xs font-black text-amber-700 dark:text-amber-300">{clientTarifaMap[s.client_id]}</span>
                        )}
                    </div>
                )}
                {s.quote_mode === 'pdf' && (
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-100 dark:bg-blue-500/15 px-2 py-1 rounded-lg">📎 PDF</span>
                        {s.quote_pdf_url && (
                            <a href={s.quote_pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-500 underline flex items-center gap-1">
                                <FileText size={10} /> Ver
                            </a>
                        )}
                    </div>
                )}

                {/* Row 4: Weight + Reference amounts */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">KG</p>
                        <p className="text-lg font-black text-slate-700 dark:text-slate-200">{Number(s.peso_computable || s.weight).toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ref Total</p>
                        <p className="text-lg font-black text-slate-500">{formatMoney(totalRef)}</p>
                    </div>
                </div>

                {/* Row 5: Costo proveedor */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Costo Proveedor</label>
                    <input
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 outline-none"
                        placeholder="0.00"
                        value={draftValues[`${s.id}-costo_flete`] ?? (s.costo_flete && Number(s.costo_flete) > 0 ? s.costo_flete : '')}
                        onChange={(e) => onDraftChange(s.id, 'costo_flete', e.target.value)}
                        onBlur={(e) => onDraftBlur(s, 'costo_flete', e.target.value)}
                    />
                </div>

                {/* Row 6: Monto cobrado */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monto Cobrado</label>
                    <input
                        type="number"
                        step="0.01"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 outline-none"
                        placeholder={totalRef > 0 ? totalRef.toString() : '0.00'}
                        value={draftValues[`${s.id}-monto_cobrado`] ?? (s.monto_cobrado && Number(s.monto_cobrado) > 0 ? s.monto_cobrado : '')}
                        onChange={(e) => onDraftChange(s.id, 'monto_cobrado', e.target.value)}
                        onBlur={(e) => onDraftBlur(s, 'monto_cobrado', e.target.value)}
                    />
                </div>

                {/* Row 7: Ganancia */}
                {cobrado_real > 0 && (
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ganancia</span>
                        <span className={`text-lg font-black px-2 py-0.5 rounded-lg ${ganancia > 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' : ganancia < 0 ? 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400' : 'text-slate-500'}`}>
                            {ganancia > 0 ? '+' : ''}{formatMoney(ganancia)}
                        </span>
                    </div>
                )}

                {/* Row 8: Estado selector */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estado de Cobro</label>
                    <select
                        className={`w-full text-sm font-black uppercase tracking-wider px-4 py-3 rounded-xl cursor-pointer outline-none border transition-all text-center ${estadoColor}`}
                        value={s.estado_cobranza || 'Pendiente'}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === s.estado_cobranza) return;
                            if (val === 'Pagado') {
                                onPayment(s);
                                return;
                            }
                            handleLocalUpdate(s.id, 'estado_cobranza', val);
                            handleInlineUpdate(s.id, 'estado_cobranza', val, s.updated_at);
                        }}
                    >
                        {estadoOpciones.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                {/* Payment info */}
                {(s.payment_notes || s.payment_proof_url) && (
                    <div className="space-y-1.5 pt-1">
                        {s.payment_notes && (
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-xl">
                                📝 {s.payment_notes}
                            </p>
                        )}
                        {s.payment_proof_url && (
                            <a href={s.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-500 hover:text-blue-600 underline flex items-center gap-1.5 px-1">
                                <FileCheck size={14} /> Ver comprobante de pago
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
