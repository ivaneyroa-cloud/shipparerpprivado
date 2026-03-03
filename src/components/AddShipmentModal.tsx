import React, { useState, useEffect } from 'react';
import { X, Package, ChevronRight, ChevronDown, Upload, FileText, AlertCircle } from 'lucide-react';
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
        observaciones_cotizacion: '',
        quote_mode: 'manual' as 'manual' | 'pdf' | 'tarifario'
    });
    const [quoteFile, setQuoteFile] = useState<File | null>(null);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [selectedClientTarifa, setSelectedClientTarifa] = useState<string | null>(null);

    const resetForm = () => {
        setFormData({
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
            observaciones_cotizacion: '',
            quote_mode: 'manual'
        });
        setQuoteFile(null);
        setSelectedClientTarifa(null);
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(formData.client_name.toLowerCase()) ||
        c.code.toLowerCase().includes(formData.client_name.toLowerCase())
    ).slice(0, 8);

    const handleSelectClient = (client: Client) => {
        const hasTarifa = !!(client as any).tarifa_aplicable;
        setSelectedClientTarifa((client as any).tarifa_aplicable || null);
        setFormData({
            ...formData,
            client_name: client.name,
            client_code: client.code,
            client_id: client.id,
            quote_mode: hasTarifa ? 'tarifario' : 'manual'
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

        // --- Quote mode validation ---
        if (formData.quote_mode === 'manual') {
            if (!formData.precio_envio || parseFloat(formData.precio_envio) <= 0) {
                toast.error('El valor de envío es obligatorio en modo Manual');
                return;
            }
        }
        if (formData.quote_mode === 'pdf' && !quoteFile) {
            toast.error('Adjuntá el PDF de la cotización');
            return;
        }

        // Upload PDF if needed
        let quotePdfUrl: string | null = null;
        if (formData.quote_mode === 'pdf' && quoteFile) {
            setUploadingPdf(true);
            try {
                const fileExt = quoteFile.name.split('.').pop();
                const fileName = `${cleanTracking}_${Date.now()}.${fileExt}`;
                const filePath = `quotes/${fileName}`;
                const { error: uploadError } = await supabase.storage
                    .from('invoices')
                    .upload(filePath, quoteFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage
                    .from('invoices')
                    .getPublicUrl(filePath);
                quotePdfUrl = publicUrl;
            } catch (err: any) {
                toast.error(`Error al subir PDF: ${err.message}`);
                setUploadingPdf(false);
                return;
            }
            setUploadingPdf(false);
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
            quote_mode: formData.quote_mode,
            precio_envio: formData.quote_mode === 'manual' ? (parseFloat(formData.precio_envio) || 0) : 0,
            gastos_documentales: formData.quote_mode === 'manual' ? (parseFloat(formData.gastos_documentales) || 0) : 0,
            impuestos: formData.quote_mode === 'manual' ? (parseFloat(formData.impuestos) || 0) : 0,
            observaciones_cotizacion: sanitizeLine(formData.observaciones_cotizacion) || null,
            quote_pdf_url: quotePdfUrl,
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
            <div className="p-4 md:p-8">
                <div className="flex justify-between items-center mb-6 md:mb-10">
                    <h2 className="text-xl md:text-3xl font-black tracking-tight">Nuevo Envío</h2>
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
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.tracking_number}
                                onChange={e => setFormData({ ...formData, tracking_number: e.target.value.toUpperCase() })}
                                placeholder="Ej: ABC123456789"
                            />
                        </div>

                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-2' : 'col-span-2'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Origen (País)</label>
                            <select
                                required
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
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
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
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
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.client_code}
                                onChange={e => setFormData({ ...formData, client_code: e.target.value.toUpperCase() })}
                                placeholder="Ej: SH-001"
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Categoría</label>
                            <input
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
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
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
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
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                                value={formData.boxes_count}
                                onChange={e => setFormData({ ...formData, boxes_count: e.target.value })}
                                placeholder="1"
                            />
                        </div>

                        <div className={`space-y-2 ${isExpandedModal ? 'col-span-1' : 'col-span-2'}`}>
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Estado / Status</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white"
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
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-3 md:px-5 md:py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white font-[Outfit]"
                                value={formData.date_shipped}
                                onChange={e => setFormData({ ...formData, date_shipped: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Cotización — 3 modos */}
                    <div className="border border-blue-200 dark:border-blue-500/20 rounded-2xl overflow-hidden bg-blue-50/30 dark:bg-blue-500/5">
                        <div className="w-full px-6 py-4 flex items-center justify-between font-black text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                                <span>💰 Cotización</span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">Obligatorio</span>
                            </div>
                        </div>

                        {/* Mode selector */}
                        <div className="px-6 pb-4 flex gap-1 bg-white/50 dark:bg-transparent">
                            {[
                                { value: 'manual', label: 'Manual (USD)' },
                                { value: 'pdf', label: 'Adjuntar PDF' },
                                { value: 'tarifario', label: 'Tarifario' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, quote_mode: opt.value as any })}
                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.quote_mode === opt.value
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 pt-2 border-t border-blue-100 dark:border-blue-500/10">
                            {/* Mode: Manual */}
                            {formData.quote_mode === 'manual' && (
                                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Valor Envío (USD) <span className="text-red-500">*</span></label>
                                        <input
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
                            )}

                            {/* Mode: PDF */}
                            {formData.quote_mode === 'pdf' && (
                                <div className="space-y-4">
                                    <div className={`relative border-2 border-dashed rounded-2xl p-6 transition-all flex flex-col items-center justify-center gap-2 ${quoteFile ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-500/5' : 'border-slate-200 dark:border-white/10 hover:border-blue-500 bg-white dark:bg-slate-900'
                                        }`}>
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => { if (e.target.files?.[0]) setQuoteFile(e.target.files[0]); }}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                        {quoteFile ? (
                                            <>
                                                <FileText className="text-emerald-500" size={28} />
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 truncate max-w-full">{quoteFile.name}</span>
                                                <button type="button" onClick={() => setQuoteFile(null)} className="text-[10px] font-black uppercase text-red-500 hover:underline">Quitar</button>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="text-slate-400" size={28} />
                                                <span className="text-sm font-bold text-slate-500">Seleccionar PDF de cotización</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solo PDF, máx 10MB</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Notas (opcional)</label>
                                        <textarea
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white resize-none"
                                            rows={2}
                                            value={formData.observaciones_cotizacion}
                                            onChange={e => setFormData({ ...formData, observaciones_cotizacion: e.target.value })}
                                            placeholder="Observaciones sobre la cotización..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Mode: Tarifario */}
                            {formData.quote_mode === 'tarifario' && (
                                <div className="space-y-3">
                                    {selectedClientTarifa ? (
                                        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">💰 Tarifa del cliente</p>
                                            <p className="text-lg font-black text-amber-700 dark:text-amber-300">{selectedClientTarifa}</p>
                                            <p className="text-[10px] font-bold text-slate-500 mt-2">Cobranzas validará el monto final según este tarifario.</p>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex gap-3 items-start">
                                            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                                            <div>
                                                <p className="text-sm font-black text-red-600 dark:text-red-400">Este cliente no tiene tarifa cargada</p>
                                                <p className="text-[10px] font-bold text-slate-500 mt-1">Cargá la tarifa en el perfil del cliente o usá modo Manual / PDF.</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Observaciones (opcional)</label>
                                        <textarea
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition-all font-bold text-slate-900 dark:text-white resize-none"
                                            rows={2}
                                            value={formData.observaciones_cotizacion}
                                            onChange={e => setFormData({ ...formData, observaciones_cotizacion: e.target.value })}
                                            placeholder="Notas para cobranzas..."
                                        />
                                    </div>
                                </div>
                            )}
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
