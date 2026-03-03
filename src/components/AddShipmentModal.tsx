import React, { useState, useEffect } from 'react';
import { X, Package, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Client } from '@/types';
import { validateShipmentPayload, sanitizeLine, isValidBoxesCount } from '@/lib/validation';
import { BaseModal } from '@/components/ui/BaseModal';

interface AddShipmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    clients: Client[];
}

export function AddShipmentModal({ isOpen, onClose, onSuccess, clients }: AddShipmentModalProps) {
    const [orgId, setOrgId] = React.useState<string | null>(null);

    useEffect(() => {
        // Fetch org_id once — required by INSERT RLS policy
        supabase.rpc('user_org_id').then(({ data }) => setOrgId(data));
    }, []);
    const [isExpandedModal, setIsExpandedModal] = useState(false);
    const [showClientResults, setShowClientResults] = useState(false);
    const [showCategoryResults, setShowCategoryResults] = useState(false);
    const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);

    const commonCategories = ['OTROS', 'ROPA', 'ELECTRÓNICA', 'ACCESORIOS', 'SUPLEMENTOS', 'JUGUETES', 'CALZADO'];
    const statusOptions = ['Guía Creada', 'Pendiente Expo', 'En Transito'];

    const [formData, setFormData] = useState({
        tracking_number: '',
        client_name: '',
        client_code: '',
        client_id: '',
        category: '',
        weight: '',
        boxes_count: '1',
        internal_status: 'Guía Creada',
        date_shipped: new Date().toISOString().split('T')[0],
        origin: 'CHINA',
        precio_envio: '',
        gastos_documentales: '',
        impuestos: '',
        observaciones_cotizacion: ''
    });

    const resetForm = () => setFormData({
        tracking_number: '',
        client_name: '',
        client_code: '',
        client_id: '',
        category: '',
        weight: '',
        boxes_count: '1',
        internal_status: 'Guía Creada',
        date_shipped: new Date().toISOString().split('T')[0],
        origin: 'CHINA',
        precio_envio: '',
        gastos_documentales: '',
        impuestos: '',
        observaciones_cotizacion: ''
    });

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(formData.client_name.toLowerCase()) ||
        c.code.toLowerCase().includes(formData.client_name.toLowerCase())
    ).slice(0, 8);

    const handleSelectClient = (client: Client) => {
        setFormData({
            ...formData,
            client_name: client.name,
            client_code: client.code,
            client_id: client.id
        });
        setShowClientResults(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Tracking number: must be exactly 18 alphanumeric characters
        const cleanTracking = formData.tracking_number.trim().toUpperCase();
        if (!/^[A-Z0-9]{18}$/.test(cleanTracking)) {
            toast.error('El número de guía debe tener exactamente 18 caracteres alfanuméricos. Ej: 1Z0J5W578632211979');
            return;
        }

        const payload = {
            tracking_number: cleanTracking,
            client_name: sanitizeLine(formData.client_name),
            client_code: sanitizeLine(formData.client_code) || null,
            client_id: formData.client_id || null,
            category: sanitizeLine(formData.category).toUpperCase() || null,
            weight: parseFloat(formData.weight) || 0,
            boxes_count: parseInt(formData.boxes_count) || 1,
            internal_status: formData.internal_status,
            date_shipped: formData.date_shipped || null,
            origin: formData.origin || null,
            precio_envio: parseFloat(formData.precio_envio) || 0,
            gastos_documentales: parseFloat(formData.gastos_documentales) || 0,
            impuestos: parseFloat(formData.impuestos) || 0,
            observaciones_cotizacion: sanitizeLine(formData.observaciones_cotizacion) || null,
            org_id: orgId,
        };

        // Validate before sending to DB
        const validation = validateShipmentPayload(payload);
        if (!validation.valid) {
            validation.errors.forEach(err => toast.error(err));
            return;
        }

        // Warning for unusual boxes count
        const boxCheck = isValidBoxesCount(payload.boxes_count);
        if (boxCheck.warning) {
            const proceed = window.confirm(boxCheck.warning + '\n\n¿Querés continuar?');
            if (!proceed) return;
        }

        const { error } = await supabase
            .from('shipments')
            .insert([payload]);

        if (!error) {
            // Auto-save category to categories table (if new)
            if (payload.category) {
                await supabase
                    .from('categories')
                    .upsert(
                        { name: payload.category.toUpperCase() },
                        { onConflict: 'name', ignoreDuplicates: true }
                    );
            }
            resetForm();
            onSuccess();
        } else {
            if (error.message?.includes('shipments_tracking_number_key') || error.message?.includes('duplicate key')) {
                toast.error(`⚠️ La guía "${cleanTracking}" ya existe. No se puede crear un envío duplicado.`);
            } else {
                toast.error(`Error al guardar: ${error.message}`);
            }
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            size={isExpandedModal ? 'full' : 'md'}
        >
            <div className="p-5 md:p-8">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black tracking-tight">Nuevo Envío</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExpandedModal(!isExpandedModal)}
                            className="px-4 py-2 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 font-bold rounded-full text-xs uppercase tracking-wider transition-colors"
                        >
                            {isExpandedModal ? 'Reducir' : 'Ampliar'}
                        </button>
                        <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full flex items-center justify-center text-red-500">
                            <X size={32} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 ${isExpandedModal ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-2' : 'col-span-2'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Nro de Tracking (UPS, etc)</label>
                            <input
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.tracking_number}
                                onChange={e => setFormData({ ...formData, tracking_number: e.target.value.toUpperCase() })}
                                placeholder="Ej: ABC123456789"
                            />
                        </div>

                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-2' : 'col-span-2'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Origen (País)</label>
                            <select
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
                                value={formData.origin}
                                onChange={e => setFormData({ ...formData, origin: e.target.value })}
                            >
                                <option value="CHINA">CHINA</option>
                                <option value="USA">USA / MIAMI</option>
                                <option value="PAKISTAN">PAKISTAN</option>
                                <option value="ESPAÑA">ESPAÑA</option>
                                <option value="REINO UNIDO">REINO UNIDO</option>
                                <option value="ALEMANIA">ALEMANIA</option>
                            </select>
                        </div>

                        <div className="space-y-2 relative">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Nombre Cliente</label>
                            <input
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.client_name}
                                onFocus={() => setShowClientResults(true)}
                                onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                                placeholder="Buscar o escribir nuevo..."
                            />
                            {showClientResults && formData.client_name.length > 0 && filteredClients.length > 0 && (
                                <div className="absolute z-[110] left-0 right-0 w-[90vw] md:w-full max-w-[90vw] md:max-w-none top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                                    {filteredClients.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => handleSelectClient(c)}
                                            className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between group transition-colors"
                                        >
                                            <div>
                                                <p className="font-black text-slate-900 dark:text-white group-hover:text-blue-600">{c.name}</p>
                                                <p className="text-xs text-slate-500 font-bold tracking-widest">{c.code}</p>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Código</label>
                            <input
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.client_code}
                                onChange={e => setFormData({ ...formData, client_code: e.target.value.toUpperCase() })}
                                placeholder="Ej: SH-001"
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Categoría</label>
                            <input
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.category}
                                onFocus={() => setShowCategoryResults(true)}
                                onBlur={() => setTimeout(() => setShowCategoryResults(false), 200)}
                                onChange={e => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
                                placeholder="Ej: ROPA"
                            />
                            {showCategoryResults && (
                                <div className="absolute z-[110] left-0 right-0 w-[90vw] md:w-full max-w-[90vw] md:max-w-none top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                                    {commonCategories
                                        .filter(c => c.includes(formData.category.toUpperCase()))
                                        .map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, category: cat });
                                                    setShowCategoryResults(false);
                                                }}
                                                className="w-full px-6 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 font-bold text-sm text-slate-700 dark:text-slate-300 transition-colors"
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-1' : 'col-span-1'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Peso (KG)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.weight}
                                onChange={e => setFormData({ ...formData, weight: e.target.value })}
                                placeholder="0.0"
                            />
                        </div>

                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-1' : 'col-span-1'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Cantidad de Cajas 📦</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.boxes_count}
                                onChange={e => setFormData({ ...formData, boxes_count: e.target.value })}
                                placeholder="1"
                            />
                        </div>

                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-1' : 'col-span-2'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Estado / Status</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
                                value={formData.internal_status}
                                onChange={e => setFormData({ ...formData, internal_status: e.target.value })}
                            >
                                {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-2' : 'col-span-2'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Fecha de Salida</label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-5 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white font-[Outfit]"
                                value={formData.date_shipped}
                                onChange={e => setFormData({ ...formData, date_shipped: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Cotización — obligatoria */}
                    <div className="border border-blue-200 dark:border-blue-500/20 rounded-2xl overflow-hidden bg-blue-50/30 dark:bg-blue-500/5">
                        <div
                            className="w-full px-6 py-4 flex items-center justify-between font-black text-slate-700 dark:text-slate-300"
                        >
                            <div className="flex items-center gap-2">
                                <span>💰 Cotización</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">Obligatorio</span>
                            </div>
                        </div>

                        <div className="p-6 pt-2 border-t border-blue-100 dark:border-blue-500/10 grid gap-4 grid-cols-1 md:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Valor Envío (USD) <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="number" step="0.01" min="0"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
                                    value={formData.precio_envio}
                                    onChange={e => setFormData({ ...formData, precio_envio: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Gastos Doc. (USD)</label>
                                <input
                                    type="number" step="0.01" min="0"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
                                    value={formData.gastos_documentales}
                                    onChange={e => setFormData({ ...formData, gastos_documentales: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Impuestos (USD)</label>
                                <input
                                    type="number" step="0.01" min="0"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
                                    value={formData.impuestos}
                                    onChange={e => setFormData({ ...formData, impuestos: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-3">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Observaciones</label>
                                <textarea
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white resize-none"
                                    rows={2}
                                    value={formData.observaciones_cotizacion}
                                    onChange={e => setFormData({ ...formData, observaciones_cotizacion: e.target.value })}
                                    placeholder="Ej: Precio especial por volumen..."
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Package size={20} /> GUARDAR ENVÍO
                    </button>
                </form>
            </div>
        </BaseModal>
    );
}
