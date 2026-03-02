'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UserPlus, Users, Phone, Globe, DollarSign, Package, Send, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface NewClientAlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: any;
}

export function NewClientAlertModal({ isOpen, onClose, userProfile }: NewClientAlertModalProps) {
    const [alertData, setAlertData] = useState({
        client_name: '',
        email: '',
        phone: '',
        origin_country: 'China',
        offered_tariff: '',
        doc_expense: '',
        service_type: 'Standard',
        notes: ''
    });
    const [sendingAlert, setSendingAlert] = useState(false);

    const handleSendAlert = async (e: React.FormEvent) => {
        e.preventDefault();
        setSendingAlert(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const { error } = await supabase.from('activity_logs').insert([{
                user_id: session.user.id,
                action: 'new_client_alert',
                details: JSON.stringify({
                    ...alertData,
                    vendor_name: userProfile?.full_name,
                    vendor_email: userProfile?.email,
                    timestamp: new Date().toISOString()
                })
            }]);

            if (error) throw error;

            toast.success('¡Aviso enviado a Logística! Te van a contactar.');
            onClose();
            setAlertData({
                client_name: '', email: '', phone: '', origin_country: 'China',
                offered_tariff: '', doc_expense: '', service_type: 'Standard', notes: ''
            });
        } catch (err: any) {
            toast.error(err.message || 'Error al enviar aviso');
        } finally {
            setSendingAlert(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
                        className="w-full max-w-md rounded-[24px] shadow-2xl overflow-hidden border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 text-green-600 rounded-[22px] flex items-center justify-center mx-auto mb-6">
                                <UserPlus size={24} strokeWidth={1.5} />
                            </div>
                            <h2 className="text-xl font-black tracking-tight mb-1">Aviso de Nuevo Cliente</h2>
                            <p className="text-slate-500 text-xs font-medium mb-6">Logística recibirá la alerta y contactará al cliente</p>

                            <form onSubmit={handleSendAlert} className="space-y-4 text-left">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre del Cliente</label>
                                        <div className="relative">
                                            <Users size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input required value={alertData.client_name} onChange={e => setAlertData({ ...alertData, client_name: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                                placeholder="Juan Pérez"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
                                        <div className="relative">
                                            <UserPlus size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input type="email" value={alertData.email} onChange={e => setAlertData({ ...alertData, email: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                                placeholder="juan@email.com"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Teléfono</label>
                                        <div className="relative">
                                            <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input required value={alertData.phone} onChange={e => setAlertData({ ...alertData, phone: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                                placeholder="+54 11 ..."
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">País de Origen</label>
                                        <div className="relative">
                                            <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <select value={alertData.origin_country} onChange={e => setAlertData({ ...alertData, origin_country: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                            >
                                                <option value="China">🇨🇳 China</option>
                                                <option value="USA/Miami">🇺🇸 USA / Miami</option>
                                                <option value="Pakistán">🇵🇰 Pakistán</option>
                                                <option value="España">🇪🇸 España</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Tarifa (USD/Kg)</label>
                                        <div className="relative">
                                            <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input required value={alertData.offered_tariff} onChange={e => setAlertData({ ...alertData, offered_tariff: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                                placeholder="8.50"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Servicio Ofrecido</label>
                                        <div className="relative">
                                            <Package size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <select value={alertData.service_type} onChange={e => setAlertData({ ...alertData, service_type: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                            >
                                                <option value="Standard">Standard</option>
                                                <option value="Express">Express</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Gasto Documental / Observaciones</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <input value={alertData.doc_expense} onChange={e => setAlertData({ ...alertData, doc_expense: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                            placeholder="Gasto documental (USD)"
                                        />
                                        <input value={alertData.notes} onChange={e => setAlertData({ ...alertData, notes: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-colors"
                                            placeholder="Notas adicionales..."
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={onClose}
                                        className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-500 font-black py-4 rounded-xl transition-all text-sm"
                                    >
                                        CANCELAR
                                    </button>
                                    <button type="submit" disabled={sendingAlert}
                                        className="flex-[2] bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white font-black py-4 rounded-xl transition-all shadow-xl shadow-green-600/20 active:scale-95 flex items-center justify-center gap-2 text-sm"
                                    >
                                        {sendingAlert ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        ENVIAR AVISO
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
