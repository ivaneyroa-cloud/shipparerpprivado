'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { BaseModal } from '@/components/ui/BaseModal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AddClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    salesMembers: any[];
}

const INITIAL_FORM = {
    name: '',
    code: '',
    assigned_to: '',
    cuit: '',
    address: '',
    tax_condition: 'Consumidor final',
    service_type: 'Retiro',
    email: '',
    phone: '',
    tarifa_aplicable: ''
};

export function AddClientModal({ isOpen, onClose, onCreated, salesMembers }: AddClientModalProps) {
    const [formData, setFormData] = useState(INITIAL_FORM);

    const getNextSHCode = async () => {
        const { data } = await supabase
            .from('clients')
            .select('code')
            .ilike('code', 'SH-%')
            .order('code', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const lastCode = data[0].code;
            const match = lastCode.match(/SH-(\d+)/);
            if (match) {
                const nextNum = parseInt(match[1]) + 1;
                return `SH-${nextNum.toString().padStart(3, '0')}`;
            }
        }
        return 'SH-001';
    };

    useEffect(() => {
        if (isOpen) {
            getNextSHCode().then(nextCode => {
                setFormData(prev => ({ ...prev, code: nextCode }));
            });
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const insertData: any = {
            name: formData.name,
            code: formData.code,
            cuit: formData.cuit,
            address: formData.address,
            tax_condition: formData.tax_condition,
            service_type: formData.service_type,
            email: formData.email,
            phone: formData.phone,
            tarifa_aplicable: formData.tarifa_aplicable || null
        };
        if (formData.assigned_to) {
            insertData.assigned_to = formData.assigned_to;
        }
        const { error } = await supabase
            .from('clients')
            .insert([insertData]);

        if (!error) {
            toast.success(`Cliente ${formData.name} creado exitosamente`);
            onClose();
            setFormData(INITIAL_FORM);
            onCreated();
        } else {
            toast.error(error.message);
        }
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} size="lg">
            <div className="px-6 pt-6 md:px-10 md:pt-10 text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/10 text-blue-600 rounded-[22px] flex items-center justify-center mx-auto mb-6">
                    <UserPlus size={24} strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-2">Nuevo Cliente</h2>
                <p className="text-slate-500 font-bold uppercase text-[9px] tracking-[0.2em] mb-4">Completá los datos para el alta</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-4 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nombre / Razón Social</label>
                        <input required
                            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ej: Robert Reyes"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Código SH <span className="text-slate-400 normal-case">(auto o manual)</span></label>
                        <input required
                            className="w-full border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-black text-sm text-blue-600 dark:text-blue-400 uppercase"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            placeholder="SH-001"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">CUIL / CUIT</label>
                        <input
                            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            value={formData.cuit} onChange={e => setFormData({ ...formData, cuit: e.target.value })}
                            placeholder="20-95862137-0"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Condición IVA</label>
                        <select
                            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                            value={formData.tax_condition} onChange={e => setFormData({ ...formData, tax_condition: e.target.value })}
                        >
                            <option value="Consumidor final">Consumidor final</option>
                            <option value="Monotributista">Monotributista</option>
                            <option value="IVA responsable inscripto">IVA responsable inscripto</option>
                            <option value="Exento">Exento</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Dirección Completa</label>
                    <input
                        className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Soler 3369, 1C CABA"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-600 ml-1">💰 Tarifa Aplicable</label>
                    <input
                        className="w-full border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 px-5 py-3.5 rounded-xl outline-none focus:border-amber-500 transition-all font-black text-sm text-slate-900 dark:text-amber-400 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={formData.tarifa_aplicable} onChange={e => setFormData({ ...formData, tarifa_aplicable: e.target.value })}
                        placeholder="Ej: 17*kg, 11.5, TARIFA NUEVA UPS sin depo"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
                        <input type="email"
                            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="ejemplo@correo.com"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Teléfono</label>
                        <input
                            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="549 11 27864229"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Preferencia de Servicio</label>
                        <select
                            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                            value={formData.service_type} onChange={e => setFormData({ ...formData, service_type: e.target.value })}
                        >
                            <option value="Retiro">Retiro</option>
                            <option value="Despacho">Despacho</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Asignar Vendedor</label>
                        <select
                            className="w-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-5 py-3.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                            value={formData.assigned_to} onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                        >
                            <option value="">— Sin asignar —</option>
                            {salesMembers.map(member => (
                                <option key={member.id} value={member.id}>{member.full_name || member.email}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 pt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 bg-slate-100 dark:bg-white/5 text-slate-500 font-black py-5 rounded-2xl transition-all"
                    >
                        CANCELAR
                    </button>
                    <button
                        type="submit"
                        className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                    >
                        GUARDAR CLIENTE
                    </button>
                </div>
            </form>
        </BaseModal>
    );
}
