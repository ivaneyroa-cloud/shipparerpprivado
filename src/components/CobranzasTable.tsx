import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Edit2, FileCheck, FileText } from 'lucide-react';
import { ShipmentCobranzasRow } from '@/types';
import { MobileCobranzaCard } from '@/components/mobile/MobileCobranzaCard';
import { PaymentVerificationModal } from './PaymentVerificationModal';
import { supabase } from '@/lib/supabase';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import { toast } from 'sonner';
import { formatARSFull as formatMoney } from '@/lib/formatters';



interface CobranzasTableProps {
    shipments: ShipmentCobranzasRow[];
    loading: boolean;
    handleInlineUpdate: (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null, last_updated?: string) => void;
    handleLocalUpdate: (id: string, field: keyof ShipmentCobranzasRow, value: string | number | null) => void;
    clientVendorMap?: Record<string, string>;
    clientTarifaMap?: Record<string, string>;
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
            <span className={`font-semibold tracking-tight text-[11px] ${value && value > 0 ? className : 'text-slate-400'}`}>
                {displayValue}
            </span>
            <Edit2 size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
        </div>
    );
}

export function CobranzasTable({ shipments, loading, handleInlineUpdate, handleLocalUpdate, clientVendorMap = {}, clientTarifaMap = {} }: CobranzasTableProps) {
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
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-[24px] pb-2">
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
                                const costo_prov_flete = Number(s.costo_flete) || 0;
                                const costo_prov_imp = Number(s.costo_impuestos_proveedor) || 0;
                                const costo_prov_total = costo_prov_flete + costo_prov_imp;
                                const cobrado_real = Number(s.monto_cobrado) || 0;

                                const totalEstimadoRef = envio + gastos + imp;

                                // Ganancia only when there's real money collected
                                const ganancia = cobrado_real > 0 ? cobrado_real - costo_prov_total : 0;

                                return (
                                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="px-3 py-2 align-middle">
                                            <p className="font-mono text-[11px] font-black text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{s.tracking_number}</p>
                                            <p className="font-bold text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[160px]">{s.client_name}</p>
                                            <span className="text-[7px] uppercase font-bold tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 py-px rounded mt-0.5 inline-block">{s.internal_status}</span>
                                        </td>

                                        <td className="px-2 py-2 align-middle text-center">
                                            <span className="font-black text-slate-700 dark:text-slate-300 text-[11px]">{Number(s.peso_computable || s.weight).toFixed(2)}</span>
                                            <span className="text-[8px] font-bold text-slate-400 ml-0.5">kg</span>
                                        </td>

                                        <td className="px-2 py-2 align-middle min-w-[140px]">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[8px] font-bold uppercase text-slate-400">Flete:</span>
                                                    <div className="w-[100px]">
                                                        <EditableCurrencyCell
                                                            placeholder="0.00"
                                                            value={s.costo_flete}
                                                            isDraft={draftValues[`${s.id}-costo_flete`]}
                                                            onDraftChange={(val) => handleDraftChange(s.id, 'costo_flete', val)}
                                                            onDraftBlur={(val) => handleDraftBlur(s, 'costo_flete', val)}
                                                            className="text-red-600 dark:text-red-400"
                                                            prefix="-"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-[8px] font-bold uppercase text-slate-400">Imp:</span>
                                                    <div className="w-[100px]">
                                                        <EditableCurrencyCell
                                                            placeholder="0.00"
                                                            value={s.costo_impuestos_proveedor}
                                                            isDraft={draftValues[`${s.id}-costo_impuestos_proveedor`]}
                                                            onDraftChange={(val) => handleDraftChange(s.id, 'costo_impuestos_proveedor', val)}
                                                            onDraftBlur={(val) => handleDraftBlur(s, 'costo_impuestos_proveedor', val)}
                                                            className="text-red-600 dark:text-red-400"
                                                            prefix="-"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="pt-0.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                                    <span className="text-[8px] font-black uppercase text-slate-400">Total:</span>
                                                    <span className={`text-[10px] font-black tracking-tight ${costo_prov_total > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                                                        {costo_prov_total > 0 ? `- ${formatMoney(costo_prov_total)}` : formatMoney(0)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-2 py-2 align-middle min-w-[120px]">
                                            {(s.quote_mode === 'tarifario') ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 rounded inline-block w-fit">📋 TARIFARIO</span>
                                                    {s.client_id && clientTarifaMap[s.client_id] ? (
                                                        <p className="text-[10px] font-black text-amber-700 dark:text-amber-300">{clientTarifaMap[s.client_id]}</p>
                                                    ) : (
                                                        <p className="text-[9px] font-bold text-slate-400">Sin tarifa</p>
                                                    )}
                                                    <p className="text-[8px] text-slate-400">Cobranzas valida</p>
                                                </div>
                                            ) : (s.quote_mode === 'pdf') ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/15 px-1.5 py-0.5 rounded inline-block w-fit">📎 PDF</span>
                                                    {s.quote_pdf_url ? (
                                                        <a href={s.quote_pdf_url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-blue-500 hover:text-blue-600 underline flex items-center gap-1">
                                                            <FileText size={9} /> Ver PDF
                                                        </a>
                                                    ) : (
                                                        <p className="text-[9px] font-bold text-slate-400">No disponible</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-[8px] font-bold uppercase text-slate-400">Envío:</span>
                                                        <span className="text-[9px] font-bold text-slate-500">{formatMoney(envio)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-[8px] font-bold uppercase text-slate-400">G.Doc:</span>
                                                        <span className="text-[9px] font-bold text-slate-500">{formatMoney(gastos)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-[8px] font-bold uppercase text-slate-400">Imp:</span>
                                                        <span className="text-[9px] font-bold text-slate-500">{formatMoney(imp)}</span>
                                                    </div>
                                                    <div className="pt-0.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                                        <span className="text-[8px] font-black uppercase text-slate-400">Ref:</span>
                                                        <span className="text-[9px] font-black text-slate-600 dark:text-slate-300">{formatMoney(totalEstimadoRef)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-2 py-2 align-middle min-w-[120px]">
                                            <EditableCurrencyCell
                                                placeholder={totalEstimadoRef > 0 ? totalEstimadoRef.toString() : "0.00"}
                                                value={s.monto_cobrado}
                                                isDraft={draftValues[`${s.id}-monto_cobrado`]}
                                                onDraftChange={(val) => handleDraftChange(s.id, 'monto_cobrado', val)}
                                                onDraftBlur={(val) => handleDraftBlur(s, 'monto_cobrado', val)}
                                                className="text-emerald-600 dark:text-emerald-400"
                                                prefix="+"
                                            />
                                        </td>

                                        <td className="px-2 py-2 align-middle text-right">
                                            {cobrado_real > 0 ? (
                                                <span className={`font-black text-[12px] px-2 py-1 rounded-lg tracking-tight
                                                    ${ganancia > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                        : ganancia < 0 ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                                                            : 'bg-slate-50 text-slate-500'}`}>
                                                    {ganancia > 0 ? '+' : ''}{formatMoney(ganancia)}
                                                </span>
                                            ) : (
                                                <span className="font-bold text-[10px] text-slate-300 dark:text-slate-600">—</span>
                                            )}
                                        </td>

                                        <td className="px-2 py-2 align-middle text-center">
                                            <select
                                                className={`text-[9px] w-full font-black uppercase tracking-wider px-1.5 py-1.5 rounded-lg cursor-pointer outline-none appearance-none border shadow-sm transition-all focus:ring-2 focus:ring-[#FF6900]/20 text-center
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
                                                <div className="mt-1 space-y-0.5">
                                                    {s.payment_notes && (
                                                        <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded leading-tight truncate max-w-[100px]">
                                                            📝 {s.payment_notes}
                                                        </p>
                                                    )}
                                                    {s.payment_proof_url && (
                                                        <a href={s.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-blue-500 hover:text-blue-600 underline flex items-center gap-0.5">
                                                            <FileCheck size={8} /> Comprobante
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

            {/* Mobile cards */}
            <div className="md:hidden">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-[#FF6900]" />
                    </div>
                ) : shipments.length === 0 ? (
                    <div className="px-4 py-16 text-center text-slate-500 font-medium text-sm">
                        No hay envíos en este filtro.
                    </div>
                ) : (
                    <div className="space-y-3 p-3">
                        {shipments.map((s) => (
                            <MobileCobranzaCard
                                key={s.id}
                                s={s}
                                draftValues={draftValues}
                                onDraftChange={handleDraftChange}
                                onDraftBlur={handleDraftBlur}
                                estadoOpciones={estadoOpciones}
                                handleLocalUpdate={handleLocalUpdate}
                                handleInlineUpdate={handleInlineUpdate}
                                onPayment={(s) => { setSelectedForPayment(s); setIsPaymentModalOpen(true); }}
                                clientTarifaMap={clientTarifaMap}
                            />
                        ))}
                    </div>
                )}
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
