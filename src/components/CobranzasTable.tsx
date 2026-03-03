import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Edit2, FileCheck, FileText } from 'lucide-react';
import { ShipmentCobranzasRow } from '@/types';
import { PaymentVerificationModal } from './PaymentVerificationModal';
import { supabase } from '@/lib/supabase';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import { toast } from 'sonner';

const formatMoney = (val: number) =>
    new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(val);

interface CobranzasTableProps {
    shipments: ShipmentCobranzasRow[];
    loading: boolean;
    handleInlineUpdate: (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null, last_updated?: string) => void;
    handleLocalUpdate: (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null) => void;
    clientVendorMap?: Record<string, string>;
}

function EditableCurrencyCell({
    value,
    placeholder,
    isDraft,
    onDraftChange,
    onDraftBlur,
    className = "",
    prefix = ""
}: {
    value: number | null | undefined;
    placeholder: string;
    isDraft: string | undefined;
    onDraftChange: (val: string) => void;
    onDraftBlur: (val: string) => void;
    className?: string;
    prefix?: string;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const displayValue = value && value > 0 ? `${prefix} ${formatMoney(value)}` : formatMoney(0);

    if (isEditing) {
        return (
            <div className="flex items-center w-full relative">
                <input
                    ref={inputRef}
                    type="number" step="0.01" min="0" placeholder={placeholder}
                    className="w-full bg-white dark:bg-slate-800 border-b-2 border-blue-500 outline-none py-1 text-sm font-semibold transition-all px-1 focus:ring-0"
                    value={isDraft ?? (value === null || value === undefined ? '' : value)}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onBlur={(e) => {
                        setIsEditing(false);
                        onDraftBlur(e.target.value);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            setIsEditing(false);
                            onDraftBlur((e.target as HTMLInputElement).value);
                        }
                        if (e.key === 'Escape') {
                            setIsEditing(false);
                            onDraftChange(value === null || value === undefined ? '' : String(value));
                        }
                    }}
                />
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer group flex items-center justify-between gap-2 py-1 transition-all w-full"
            title="Click para editar"
        >
            <span className={`font-semibold tracking-tight text-[13px] ${value && value > 0 ? className : 'text-slate-400'}`}>
                {displayValue}
            </span>
            <Edit2 size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
        </div>
    );
}

export function CobranzasTable({ shipments, loading, handleInlineUpdate, handleLocalUpdate, clientVendorMap = {} }: CobranzasTableProps) {
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});
    const [selectedForPayment, setSelectedForPayment] = useState<ShipmentCobranzasRow | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const estadoOpciones = ['Pendiente', 'Facturado', 'Pagado'];

    const handleDraftChange = (id: string, field: string, val: string) => {
        setDraftValues(prev => ({ ...prev, [`${id}-${field}`]: val }));
    };

    const handleDraftBlur = (s: ShipmentCobranzasRow, field: keyof ShipmentCobranzasRow, raw: string) => {
        setDraftValues(prev => {
            const next = { ...prev };
            delete next[`${s.id}-${field}`];
            return next;
        });

        const originalStr = s[field] === null || s[field] === undefined ? '' : String(s[field]);
        if (raw === originalStr) return;

        handleLocalUpdate(s.id, field, raw === '' ? null : Number(raw));
        handleInlineUpdate(s.id, field, raw === '' ? null : Number(raw), s.updated_at);
    };

    const estadoPagoOpciones = ['Pendiente', 'Pagado/Abonado'];

    return (
        <div className="w-full bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:border-slate-700 flex flex-col transition-all mb-12 font-[Outfit]">
            <div className="overflow-x-auto rounded-[24px] pb-2">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 [&>th]:px-4 [&>th]:py-3 [&>th]:text-[10px] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-slate-500">
                            <th>Guía / Cliente</th>
                            <th className="text-center">Detalles (KG)</th>
                            <th className="">Orig: FC Proveedor</th>
                            <th className="">Ref: Cotización Vendedor</th>
                            <th className="">Real: Monto Cobrado</th>
                            <th className="text-right">Ganancia</th>
                            <th className="text-center">Estado de Cobro</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center">
                                    <div className="flex justify-center"><Loader2 className="animate-spin text-[#FF6900]" /></div>
                                </td>
                            </tr>
                        ) : shipments.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center text-slate-500 font-medium">
                                    No hay envíos en este filtro.
                                </td>
                            </tr>
                        ) : (
                            shipments.map((s) => {
                                const envio = Number(s.precio_envio) || 0;
                                const gastos = Number(s.gastos_documentales) || 0;
                                const imp = Number(s.impuestos) || 0;
                                const costo_prov = Number(s.costo_flete) || 0;
                                const cobrado_real = Number(s.monto_cobrado) || 0;

                                const totalEstimadoRef = envio + gastos + imp;

                                // Ganancia only when there's real money collected
                                const ganancia = cobrado_real > 0 ? cobrado_real - costo_prov : 0;

                                return (
                                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-4 py-3 align-top">
                                            <p className="font-mono text-xs font-black text-slate-800 dark:text-slate-200">{s.tracking_number}</p>
                                            <p className="font-bold text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 truncate max-w-[180px]">{s.client_name}</p>
                                            <div className="mt-1.5 flex gap-1">
                                                <span className="text-[8px] uppercase font-bold tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{s.internal_status}</span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 align-top text-center">
                                            <span className="font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-sm border border-slate-200 dark:border-slate-700 shadow-sm">{Number(s.peso_computable || s.weight).toFixed(2)}</span>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">KG Computables</p>
                                        </td>

                                        <td className="px-4 py-3 align-top min-w-[140px]">
                                            <EditableCurrencyCell
                                                placeholder="0.00"
                                                value={s.costo_flete}
                                                isDraft={draftValues[`${s.id}-costo_flete`]}
                                                onDraftChange={(val) => handleDraftChange(s.id, 'costo_flete', val)}
                                                onDraftBlur={(val) => handleDraftBlur(s, 'costo_flete', val)}
                                                className="text-red-600 dark:text-red-400"
                                                prefix="-"
                                            />
                                        </td>

                                        <td className="px-4 py-3 align-top">
                                            <div className="flex flex-col gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-bold uppercase text-slate-400">Cotizado/Envío:</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{formatMoney(envio)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-bold uppercase text-slate-400">G. Documentales:</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{formatMoney(gastos)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-bold uppercase text-slate-400">Impuestos:</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{formatMoney(imp)}</span>
                                                </div>
                                                <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                                                    <span className="text-[9px] font-black uppercase text-slate-400">Sumatoria Ref:</span>
                                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{formatMoney(totalEstimadoRef)}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 align-middle min-w-[160px]">
                                            <div className="flex flex-col gap-1 w-full">
                                                <EditableCurrencyCell
                                                    placeholder={totalEstimadoRef > 0 ? totalEstimadoRef.toString() : "0.00"}
                                                    value={s.monto_cobrado}
                                                    isDraft={draftValues[`${s.id}-monto_cobrado`]}
                                                    onDraftChange={(val) => handleDraftChange(s.id, 'monto_cobrado', val)}
                                                    onDraftBlur={(val) => handleDraftBlur(s, 'monto_cobrado', val)}
                                                    className="text-emerald-600 dark:text-emerald-400"
                                                    prefix="+"
                                                />
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 align-middle text-right">
                                            {cobrado_real > 0 ? (
                                                <span className={`font-black text-[15px] px-2.5 py-1.5 rounded-lg tracking-tight
                                                    ${ganancia > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                        : ganancia < 0 ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                                                            : 'bg-slate-50 text-slate-500'}`}>
                                                    {ganancia > 0 ? '+' : ''}{formatMoney(ganancia)}
                                                </span>
                                            ) : (
                                                <span className="font-bold text-xs text-slate-300 dark:text-slate-600">—</span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 align-middle text-center">
                                            <select
                                                className={`text-[10px] w-full font-black uppercase tracking-wider px-2 py-2 rounded-lg cursor-pointer outline-none appearance-none border shadow-sm transition-all focus:ring-2 focus:ring-[#FF6900]/20 text-center
                                                     ${s.estado_cobranza === 'Pagado' ? 'bg-[#FF6900] border-[#FF6900] text-white'
                                                        : s.estado_cobranza === 'Facturado' ? 'bg-white border-slate-300 text-slate-800'
                                                            : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                                                value={s.estado_cobranza || 'Pendiente'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === s.estado_cobranza) return;
                                                    if (val === 'Pagado') {
                                                        setSelectedForPayment(s);
                                                        setIsPaymentModalOpen(true);
                                                        return;
                                                    }
                                                    handleLocalUpdate(s.id, 'estado_cobranza', val);
                                                    handleInlineUpdate(s.id, 'estado_cobranza', val, s.updated_at);
                                                }}
                                            >
                                                {estadoOpciones.map(opt => <option key={opt} value={opt} className="text-left bg-white text-slate-800">{opt}</option>)}
                                            </select>
                                            {(s.payment_notes || s.payment_proof_url) && (
                                                <div className="mt-2 space-y-1">
                                                    {s.payment_notes && (
                                                        <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md leading-tight">
                                                            📝 {s.payment_notes}
                                                        </p>
                                                    )}
                                                    {s.payment_proof_url && (
                                                        <a href={s.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-blue-500 hover:text-blue-600 underline flex items-center gap-1">
                                                            <FileCheck size={10} /> Ver comprobante
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <PaymentVerificationModal
                isOpen={isPaymentModalOpen}
                onClose={() => {
                    setIsPaymentModalOpen(false);
                    setSelectedForPayment(null);
                }}
                shipment={selectedForPayment}
                onSuccess={async (data) => {
                    if (!selectedForPayment) return;
                    handleLocalUpdate(selectedForPayment.id, 'estado_cobranza', 'Pagado');
                    const updatePayload: Record<string, any> = {
                        estado_cobranza: 'Pagado',
                    };
                    if (data.proofUrl) updatePayload.payment_proof_url = data.proofUrl;
                    if (data.notes) updatePayload.payment_notes = data.notes;
                    const result = await secureShipmentUpdate(selectedForPayment.id, updatePayload);
                    if (!result.success) {
                        toast.error(`Error al registrar pago: ${result.error}`);
                    } else {
                        toast.success('Pago verificado y registrado correctamente');
                        setIsPaymentModalOpen(false);
                        setSelectedForPayment(null);
                    }
                }}
            />
        </div>
    );
}
