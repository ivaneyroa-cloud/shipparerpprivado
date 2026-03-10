"use client";

import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, FileText, Banknote } from 'lucide-react';
import { BaseModal } from '@/components/ui/BaseModal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ShipmentCobranzasRow } from '@/types';

interface PaymentVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (paymentData: { proofUrl: string; notes: string }) => void;
    shipment: ShipmentCobranzasRow | null;
}

export function PaymentVerificationModal({ isOpen, onClose, onSuccess, shipment }: PaymentVerificationModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [notes, setNotes] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isCashPayment, setIsCashPayment] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shipment) return;

        // Require either a file OR cash payment toggle
        if (!file && !isCashPayment) return;

        setIsUploading(true);
        try {
            let publicUrl = '';

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${shipment.id}_${Date.now()}.${fileExt}`;
                const filePath = `payments/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('invoices')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl: url } } = supabase.storage
                    .from('invoices')
                    .getPublicUrl(filePath);

                publicUrl = url;
            }

            // For cash payments without file, add automatic note
            const finalNotes = isCashPayment && !file
                ? `💵 PAGO EN EFECTIVO${notes ? ` — ${notes}` : ''}`
                : notes;

            onSuccess({ proofUrl: publicUrl, notes: finalNotes });
            setFile(null);
            setNotes('');
            setIsCashPayment(false);
        } catch (error: any) {
            toast.error(`Error al subir comprobante: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const canSubmit = file || isCashPayment;

    if (!shipment) return null;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} size="lg" zIndex={110}>
            <div className="p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-500" /> Confirmar Pago
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Cash payment toggle */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsCashPayment(!isCashPayment);
                            if (!isCashPayment) setFile(null);
                        }}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${isCashPayment
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50 dark:bg-white/[0.03]'
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${isCashPayment
                                ? 'bg-amber-400 text-white'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                            }`}>
                            <Banknote size={20} />
                        </div>
                        <div className="text-left flex-1">
                            <p className={`text-sm font-black ${isCashPayment ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                Pago en efectivo
                            </p>
                            <p className={`text-[10px] font-bold ${isCashPayment ? 'text-amber-600/70 dark:text-amber-400/60' : 'text-slate-400'}`}>
                                Sin comprobante digital — se registra como pago en efectivo
                            </p>
                        </div>
                        <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${isCashPayment
                                ? 'border-amber-500 bg-amber-500'
                                : 'border-slate-300 dark:border-white/20'
                            }`}>
                            {isCashPayment && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                    </button>

                    {/* Info banner — changes based on mode */}
                    <div className={`p-4 border rounded-2xl flex gap-3 ${isCashPayment
                            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'
                            : 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20'
                        }`}>
                        <AlertCircle className={`shrink-0 ${isCashPayment ? 'text-amber-500' : 'text-blue-500'}`} size={20} />
                        <p className={`text-xs font-bold ${isCashPayment ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
                            {isCashPayment
                                ? 'Se registrará como pago en efectivo. Podés adjuntar un comprobante opcionalmente.'
                                : 'Para marcar como PAGADO, adjuntá el comprobante de transferencia o depósito.'
                            }
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* File upload — required only when NOT cash payment */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Comprobante de Pago {isCashPayment && <span className="text-slate-400 normal-case">(opcional)</span>}
                            </label>
                            <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center gap-3
                                            ${file ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-500/5' : 'border-slate-200 dark:border-white/10 hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50'}`}>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                {file ? (
                                    <>
                                        <CheckCircle2 className="text-emerald-500" size={32} />
                                        <span className="text-sm font-bold text-emerald-600 truncate max-w-full px-4">{file.name}</span>
                                        <button type="button" onClick={() => setFile(null)} className="text-[10px] font-black uppercase text-red-500 hover:underline">Quitar</button>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="text-slate-400" size={32} />
                                        <span className="text-sm font-bold text-slate-500">Click o arrastra el archivo</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PNG, JPG, PDF hasta 5MB</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                                <FileText size={12} /> Notas / Justificación {isCashPayment ? '' : '(Opcional)'}
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={isCashPayment ? 'Ej: Pagó en oficina, monto exacto...' : 'Ej: Pago parcial, descuento aplicado...'}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white resize-none h-24 text-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={!canSubmit || isUploading}
                        className={`w-full font-black py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 uppercase tracking-wide text-sm disabled:opacity-50 disabled:cursor-not-allowed ${isCashPayment && !file
                                ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                            }`}
                    >
                        {isUploading ? (
                            <>Subiendo...</>
                        ) : isCashPayment && !file ? (
                            <>💵 Confirmar Pago en Efectivo</>
                        ) : (
                            <>Confirmar Pago y Guardar Comprobante</>
                        )}
                    </button>
                </form>
            </div>
        </BaseModal>
    );
}
