"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !shipment) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${shipment.id}_${Date.now()}.${fileExt}`;
            const filePath = `payments/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath);

            onSuccess({ proofUrl: publicUrl, notes });
            setFile(null);
            setNotes('');
        } catch (error: any) {
            toast.error(`Error al subir comprobante: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    if (!shipment) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                                    <CheckCircle2 className="text-emerald-500" /> Confirmar Pago
                                </h2>
                                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl flex gap-3">
                                    <AlertCircle className="text-blue-500 shrink-0" size={20} />
                                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                                        Para marcar como **PAGADO**, es obligatorio adjuntar el comprobante de transferencia o depósito.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Comprobante de Pago</label>
                                        <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center gap-3
                                            ${file ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-500/5' : 'border-slate-200 dark:border-white/10 hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50'}`}>
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                required
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
                                            <FileText size={12} /> Notas / Justificación (Opcional)
                                        </label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Ej: Pago parcial, descuento aplicado..."
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white resize-none h-24 text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!file || isUploading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 uppercase tracking-wide text-sm"
                                >
                                    {isUploading ? (
                                        <>Subiendo...</>
                                    ) : (
                                        <>Confirmar Pago y Guardar Comprobante</>
                                    )}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
