'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { BaseModal } from '@/components/ui/BaseModal';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ClientDetailModalProps {
    client: any | null;
    onClose: () => void;
    onSaved: () => void;
    getVendorName: (id: string | null) => string | null;
}

export function ClientDetailModal({ client, onClose, onSaved, getVendorName }: ClientDetailModalProps) {
    const [editingClient, setEditingClient] = useState<any>(null);
    const [savingClient, setSavingClient] = useState(false);

    if (!client) return null;

    const handleSave = async () => {
        if (!editingClient) return;
        setSavingClient(true);
        const { error } = await supabase.from('clients').update({
            cuit: editingClient.cuit,
            phone: editingClient.phone,
            email: editingClient.email,
            address: editingClient.address,
            tax_condition: editingClient.tax_condition,
            service_type: editingClient.service_type,
        }).eq('id', client.id);
        setSavingClient(false);
        if (!error) {
            toast.success('Datos actualizados');
            onClose();
            onSaved();
        } else {
            toast.error(error.message);
        }
    };

    return (
        <BaseModal isOpen={!!client} onClose={() => { onClose(); setEditingClient(null); }} size="lg">
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b" style={{ borderColor: 'var(--card-border)' }}>
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl font-black ">
                    {client.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{client.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full">{client.code || 'Sin código'}</span>
                    </div>
                </div>
                <button onClick={() => { onClose(); setEditingClient(null); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                    <X size={18} className="text-slate-400" />
                </button>
            </div>

            {/* Editable fields */}
            <div className="p-6 grid grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto">
                {[
                    { label: 'CUIL / CUIT', key: 'cuit', placeholder: '20-12345678-9' },
                    { label: 'Teléfono', key: 'phone', placeholder: '549 11 ...' },
                    { label: 'Email', key: 'email', placeholder: 'correo@ejemplo.com' },
                    { label: 'Dirección', key: 'address', placeholder: 'Calle 123, CABA' },
                ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                        <input
                            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--card-border)' }}
                            className="w-full border px-3 py-2.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                            value={(editingClient || client)[key] || ''}
                            placeholder={placeholder}
                            onChange={e => setEditingClient({ ...(editingClient || client), [key]: e.target.value })}
                        />
                    </div>
                ))}
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Condición IVA</p>
                    <select
                        style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--card-border)' }}
                        className="w-full border px-3 py-2.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                        value={(editingClient || client).tax_condition || 'Consumidor final'}
                        onChange={e => setEditingClient({ ...(editingClient || client), tax_condition: e.target.value })}
                    >
                        <option value="Consumidor final">Consumidor final</option>
                        <option value="Monotributista">Monotributista</option>
                        <option value="IVA responsable inscripto">IVA responsable inscripto</option>
                        <option value="Exento">Exento</option>
                    </select>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Servicio</p>
                    <select
                        style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--card-border)' }}
                        className="w-full border px-3 py-2.5 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                        value={(editingClient || client).service_type || 'Retiro'}
                        onChange={e => setEditingClient({ ...(editingClient || client), service_type: e.target.value })}
                    >
                        <option value="Retiro">Retiro</option>
                        <option value="Despacho">Despacho</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Vendedor</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{getVendorName(client.assigned_to) || 'Sin asignar'}</p>
                </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
                <button
                    onClick={() => { onClose(); setEditingClient(null); }}
                    className="flex-1 py-3.5 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl text-sm transition-all hover:bg-slate-200 dark:hover:bg-white/10"
                >
                    CANCELAR
                </button>
                <button
                    disabled={savingClient || !editingClient}
                    onClick={handleSave}
                    className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl text-sm transition-all  active:scale-95 flex items-center justify-center gap-2"
                >
                    {savingClient ? <Loader2 size={16} className="animate-spin" /> : null}
                    GUARDAR CAMBIOS
                </button>
            </div>
        </BaseModal>
    );
}
