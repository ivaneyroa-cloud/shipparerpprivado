'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Download, Eye, ArrowRight, Package, Plane, Scale,
    DollarSign, AlertTriangle, CheckCircle2, Search, X, ChevronDown,
    Globe, Clock, Shield
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface QuoteFormData {
    clientName: string;
    clientCode: string;
    clientId: string | null;
    origin: string;
    serviceType: 'Standard' | 'Express';
    weightKg: number;
    tarifaPerKg: number;
    gastoDocumental: number;
    guiaAerea: number;
    valorFob: number | null;
    includeTaxes: boolean;
    derechosPct: number;
    tasaEstadisticaPct: number;
    ivaAduana105Pct: number;
    ivaAduana21Pct: number;
    notes: string;
}

const INITIAL_FORM: QuoteFormData = {
    clientName: '',
    clientCode: '',
    clientId: null,
    origin: 'CHINA',
    serviceType: 'Standard',
    weightKg: 0,
    tarifaPerKg: 0,
    gastoDocumental: 0,
    guiaAerea: 0,
    valorFob: null,
    includeTaxes: false,
    derechosPct: 0,
    tasaEstadisticaPct: 3,
    ivaAduana105Pct: 10.5,
    ivaAduana21Pct: 0,
    notes: '',
};

const ORIGINS = [
    { value: 'CHINA', label: 'China', flag: '🇨🇳' },
    { value: 'USA', label: 'Estados Unidos', flag: '🇺🇸' },
    { value: 'PAKISTAN', label: 'Pakistán', flag: '🇵🇰' },
    { value: 'ESPAÑA', label: 'España', flag: '🇪🇸' },
    { value: 'REINO UNIDO', label: 'Reino Unido', flag: '🇬🇧' },
    { value: 'ALEMANIA', label: 'Alemania', flag: '🇩🇪' },
];

const SERVICE_INCLUDES = [
    'Recolección en origen',
    'Handling & almacenaje',
    'TCA (Terminal Cargo Aéreo)',
    'Despacho de importación',
    'Envío integral puerta a puerta',
];

// ═══════════════════════════════════════════════════════════════
// GASTO DOCUMENTAL FORMULA
// ═══════════════════════════════════════════════════════════════
function calcGastoDocumental(fob: number | null): number {
    if (!fob || fob <= 0) return 0;
    if (fob < 500) return Math.min(fob * 0.20, 60);
    return Math.min(fob * 0.0935, 140);
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function CotizacionesPage() {
    const [form, setForm] = useState<QuoteFormData>(INITIAL_FORM);
    const [clients, setClients] = useState<any[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [exchangeDate, setExchangeDate] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    // Fetch clients for autocomplete
    useEffect(() => {
        supabase.from('clients').select('id, name, code, tarifa_aplicable').order('name').then(({ data }) => {
            if (data) setClients(data);
        });
    }, []);

    // Fetch exchange rate
    useEffect(() => {
        fetch('https://dolarapi.com/v1/dolares/oficial')
            .then(r => r.json())
            .then(data => {
                setExchangeRate(data.venta);
                const d = new Date(data.fechaActualizacion);
                setExchangeDate(d.toLocaleDateString('es-AR'));
            })
            .catch(() => {
                // Fallback
                setExchangeRate(null);
            });
    }, []);

    // Filtered clients for autocomplete
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return clients.slice(0, 10);
        const term = clientSearch.toLowerCase();
        return clients.filter(c =>
            c.name.toLowerCase().includes(term) || (c.code || '').toLowerCase().includes(term)
        ).slice(0, 10);
    }, [clients, clientSearch]);

    // ── Calculations ──
    const shippingCost = form.weightKg * form.tarifaPerKg;
    const gastoDoc = form.valorFob ? calcGastoDocumental(form.valorFob) : form.gastoDocumental;
    const subtotalLogistico = shippingCost + gastoDoc + form.guiaAerea;

    const derechosAmount = form.includeTaxes && form.valorFob ? (form.valorFob * form.derechosPct / 100) : 0;
    const tasaAmount = form.includeTaxes && form.valorFob ? (form.valorFob * form.tasaEstadisticaPct / 100) : 0;
    const iva105Amount = form.includeTaxes && form.valorFob ? (form.valorFob * form.ivaAduana105Pct / 100) : 0;
    const iva21Amount = form.includeTaxes && form.valorFob ? (form.valorFob * form.ivaAduana21Pct / 100) : 0;
    const totalTaxes = derechosAmount + tasaAmount + iva105Amount + iva21Amount;

    const totalUSD = subtotalLogistico + (form.includeTaxes ? totalTaxes : 0);
    const totalARS = exchangeRate ? totalUSD * exchangeRate : null;

    const deliveryDays = form.serviceType === 'Express' ? '5-8' : '10-12';

    // Update field helper
    const setField = <K extends keyof QuoteFormData>(key: K, value: QuoteFormData[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    // Select client from autocomplete
    const selectClient = (client: any) => {
        setForm(prev => ({
            ...prev,
            clientName: client.name,
            clientCode: client.code || '',
            clientId: client.id,
            tarifaPerKg: client.tarifa_aplicable ? parseFloat(client.tarifa_aplicable) || prev.tarifaPerKg : prev.tarifaPerKg,
        }));
        setClientSearch(client.name);
        setShowClientDropdown(false);
    };

    // Auto-calculate gasto documental when FOB changes
    useEffect(() => {
        if (form.valorFob) {
            setField('gastoDocumental', calcGastoDocumental(form.valorFob));
        }
    }, [form.valorFob]);

    const canPreview = form.clientName && form.weightKg > 0 && form.tarifaPerKg > 0;

    // Save quote
    const saveQuote = async () => {
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session.user.id).single();

            const { error } = await supabase.from('quotes').insert({
                client_name: form.clientName,
                client_code: form.clientCode || null,
                client_id: form.clientId,
                origin: form.origin,
                service_type: form.serviceType,
                weight_kg: form.weightKg,
                tarifa_per_kg: form.tarifaPerKg,
                shipping_cost: shippingCost,
                gasto_documental: gastoDoc,
                guia_aerea: form.guiaAerea,
                valor_fob: form.valorFob,
                include_taxes: form.includeTaxes,
                derechos_pct: form.derechosPct,
                tasa_estadistica_pct: form.tasaEstadisticaPct,
                iva_aduana_105_pct: form.ivaAduana105Pct,
                iva_aduana_21_pct: form.ivaAduana21Pct,
                total_taxes: totalTaxes,
                total_usd: totalUSD,
                exchange_rate: exchangeRate,
                total_ars: totalARS,
                notes: form.notes || null,
                created_by: session.user.id,
                org_id: profile?.org_id,
            });

            if (error) throw error;
            toast.success('Cotización guardada');
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    // Download PDF
    const downloadPDF = async () => {
        if (!previewRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            const canvas = await html2canvas(previewRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Cotizacion_${form.clientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.success('PDF descargado');
        } catch (err) {
            toast.error('Error al generar PDF');
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="w-full flex-1 flex flex-col overflow-hidden relative" style={{ minHeight: 'calc(100dvh - 80px)' }}>
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                    <h1 className="text-[28px] font-black tracking-tight text-slate-800 dark:text-white font-[Outfit]">Cotizaciones</h1>
                    <p className="text-slate-500 font-bold tracking-wide text-xs">Generá presupuestos profesionales para tus clientes</p>
                </div>
                {showPreview && (
                    <div className="flex gap-2">
                        <button onClick={() => setShowPreview(false)} className="flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-300">
                            <X size={14} /> Editar
                        </button>
                        <button onClick={saveQuote} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg">
                            <CheckCircle2 size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={downloadPDF} className="flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg">
                            <Download size={14} /> Descargar PDF
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                <AnimatePresence mode="wait">
                    {!showPreview ? (
                        <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <QuoteForm
                                form={form}
                                setField={setField}
                                clientSearch={clientSearch}
                                setClientSearch={setClientSearch}
                                showClientDropdown={showClientDropdown}
                                setShowClientDropdown={setShowClientDropdown}
                                filteredClients={filteredClients}
                                selectClient={selectClient}
                                shippingCost={shippingCost}
                                gastoDoc={gastoDoc}
                                subtotalLogistico={subtotalLogistico}
                                totalTaxes={totalTaxes}
                                totalUSD={totalUSD}
                                totalARS={totalARS}
                                exchangeRate={exchangeRate}
                                deliveryDays={deliveryDays}
                                canPreview={canPreview}
                                onPreview={() => setShowPreview(true)}
                            />
                        </motion.div>
                    ) : (
                        <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                            <QuotePreview
                                ref={previewRef}
                                form={form}
                                shippingCost={shippingCost}
                                gastoDoc={gastoDoc}
                                subtotalLogistico={subtotalLogistico}
                                derechosAmount={derechosAmount}
                                tasaAmount={tasaAmount}
                                iva105Amount={iva105Amount}
                                iva21Amount={iva21Amount}
                                totalTaxes={totalTaxes}
                                totalUSD={totalUSD}
                                totalARS={totalARS}
                                exchangeRate={exchangeRate}
                                exchangeDate={exchangeDate}
                                deliveryDays={deliveryDays}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// QUOTE FORM COMPONENT
// ═══════════════════════════════════════════════════════════════
function QuoteForm({
    form, setField, clientSearch, setClientSearch, showClientDropdown, setShowClientDropdown,
    filteredClients, selectClient, shippingCost, gastoDoc, subtotalLogistico, totalTaxes, totalUSD, totalARS,
    exchangeRate, deliveryDays, canPreview, onPreview
}: any) {
    const formatMoney = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const inputClass = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400";
    const labelClass = "text-[10px] font-black uppercase tracking-widest text-slate-500 ml-0.5 mb-1.5 block";

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* SECTION 1: Cliente & Servicio */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/50 space-y-5">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Package size={18} className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">Cliente & Servicio</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Datos del destinatario y tipo de envío</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Client autocomplete */}
                    <div className="relative">
                        <label className={labelClass}>Cliente</label>
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                className={`${inputClass} pl-10`}
                                placeholder="Buscar o escribir nombre..."
                                value={clientSearch || form.clientName}
                                onChange={(e) => {
                                    setClientSearch(e.target.value);
                                    setField('clientName', e.target.value);
                                    setField('clientId', null);
                                    setField('clientCode', '');
                                    setShowClientDropdown(true);
                                }}
                                onFocus={() => setShowClientDropdown(true)}
                            />
                        </div>
                        <AnimatePresence>
                            {showClientDropdown && filteredClients.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto"
                                >
                                    {filteredClients.map((c: any) => (
                                        <button
                                            key={c.id}
                                            onClick={() => selectClient(c)}
                                            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors text-left"
                                        >
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.name}</span>
                                            <span className="text-[10px] font-black text-blue-500">{c.code}</span>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setShowClientDropdown(false)}
                                        className="w-full px-4 py-2 text-center text-[10px] font-bold text-slate-400 border-t border-slate-100 dark:border-slate-700"
                                    >
                                        Cerrar ✕
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Origin */}
                    <div>
                        <label className={labelClass}>Origen</label>
                        <select
                            className={inputClass}
                            value={form.origin}
                            onChange={(e) => setField('origin', e.target.value)}
                        >
                            {ORIGINS.map(o => (
                                <option key={o.value} value={o.value}>{o.flag} {o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Service type */}
                <div>
                    <label className={labelClass}>Tipo de Servicio</label>
                    <div className="grid grid-cols-2 gap-3">
                        {(['Standard', 'Express'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setField('serviceType', type)}
                                className={`p-4 rounded-xl border-2 transition-all text-left ${form.serviceType === type
                                    ? 'border-blue-500 bg-blue-500/5 shadow-lg shadow-blue-500/10'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-black text-slate-800 dark:text-white">
                                        {type === 'Express' ? '⚡' : '✈️'} {type} Air
                                    </span>
                                    {form.serviceType === type && <CheckCircle2 size={16} className="text-blue-500" />}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                                    {type === 'Express' ? '5-8 días hábiles' : '10-12 días hábiles'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECTION 2: Costos Logísticos */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/50 space-y-5">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Plane size={18} className="text-emerald-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">Costos Logísticos</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Transporte, documentación y guía</p>
                    </div>
                </div>

                {/* KG + Tarifa side by side with big numbers */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Peso (KG)</label>
                        <input
                            type="number" step="0.1" min="0"
                            className={`${inputClass} text-2xl text-center font-black`}
                            value={form.weightKg || ''}
                            onChange={(e) => setField('weightKg', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Tarifa USD / KG</label>
                        <input
                            type="number" step="0.1" min="0"
                            className={`${inputClass} text-2xl text-center font-black text-blue-600 dark:text-blue-400`}
                            value={form.tarifaPerKg || ''}
                            onChange={(e) => setField('tarifaPerKg', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Subtotal envío */}
                {shippingCost > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Transporte aéreo ({form.weightKg} kg × ${form.tarifaPerKg})</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">${formatMoney(shippingCost)} USD</span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Gasto Documental (USD)</label>
                        <input
                            type="number" step="0.01" min="0"
                            className={inputClass}
                            value={form.gastoDocumental || ''}
                            onChange={(e) => setField('gastoDocumental', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                        />
                        {form.valorFob && form.valorFob > 0 && (
                            <p className="text-[9px] text-blue-500 font-bold mt-1 ml-1">
                                Auto: {form.valorFob < 500 ? '20%' : '9.35%'} del FOB (tope ${form.valorFob < 500 ? '60' : '140'})
                            </p>
                        )}
                    </div>
                    <div>
                        <label className={labelClass}>Guía Aérea (USD)</label>
                        <input
                            type="number" step="0.01" min="0"
                            className={inputClass}
                            value={form.guiaAerea || ''}
                            onChange={(e) => setField('guiaAerea', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {/* Subtotal logístico */}
                {subtotalLogistico > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Subtotal Logístico</span>
                        <span className="text-lg font-black text-slate-800 dark:text-white">${formatMoney(subtotalLogistico)} USD</span>
                    </div>
                )}
            </div>

            {/* SECTION 3: Impuestos (Toggle) */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/50 space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Scale size={18} className="text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 dark:text-white">Impuestos Estimados</h3>
                            <p className="text-[10px] text-slate-400 font-bold">Opcional — solo si cotizas con impuestos</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setField('includeTaxes', !form.includeTaxes)}
                        className={`w-14 h-7 rounded-full transition-all relative ${form.includeTaxes ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all ${form.includeTaxes ? 'left-8' : 'left-1'}`} />
                    </button>
                </div>

                <AnimatePresence>
                    {form.includeTaxes && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-4"
                        >
                            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Los impuestos son aproximados y pueden variar según la determinación de Aduana</p>
                            </div>

                            <div>
                                <label className={labelClass}>Valor FOB Declarado (USD)</label>
                                <input
                                    type="number" step="0.01" min="0"
                                    className={inputClass}
                                    value={form.valorFob ?? ''}
                                    onChange={(e) => setField('valorFob', parseFloat(e.target.value) || null)}
                                    placeholder="Valor declarado de la mercadería"
                                />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Derechos %', key: 'derechosPct' as const },
                                    { label: 'Tasa Est. %', key: 'tasaEstadisticaPct' as const },
                                    { label: 'IVA Ad. 10.5%', key: 'ivaAduana105Pct' as const },
                                    { label: 'IVA Ad. 21%', key: 'ivaAduana21Pct' as const },
                                ].map(({ label, key }) => (
                                    <div key={key}>
                                        <label className={labelClass}>{label}</label>
                                        <input
                                            type="number" step="0.1" min="0"
                                            className={`${inputClass} text-center`}
                                            value={form[key] || ''}
                                            onChange={(e) => setField(key, parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                ))}
                            </div>

                            {totalTaxes > 0 && (
                                <div className="border-t border-amber-200 dark:border-amber-500/20 pt-3 flex items-center justify-between">
                                    <span className="text-xs font-black text-amber-600 uppercase tracking-widest">Total Impuestos</span>
                                    <span className="text-lg font-black text-amber-600">${formatMoney(totalTaxes)} USD</span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* TOTAL CARD */}
            {totalUSD > 0 && (
                <div className="bg-gradient-to-br from-[#0B1628] to-[#1a2744] rounded-2xl p-6 text-center shadow-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300/60 mb-2">Costo Total Estimado</p>
                    <p className="text-4xl font-black text-white tracking-tight">${formatMoney(totalUSD)} <span className="text-lg text-blue-300">USD</span></p>
                    {totalARS && exchangeRate && (
                        <p className="text-sm font-bold text-slate-400 mt-2">
                            ≈ ARS {new Intl.NumberFormat('es-AR').format(Math.round(totalARS))}
                            <span className="text-[10px] ml-2 text-slate-500">(TC Oficial: ${exchangeRate})</span>
                        </p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-3 font-medium">
                        ✈️ Entrega estimada: {deliveryDays} días hábiles desde pick-up
                    </p>
                </div>
            )}

            {/* Notes */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/50">
                <label className={labelClass}>Notas adicionales (opcional)</label>
                <textarea
                    rows={2}
                    className={inputClass}
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    placeholder="Alguna aclaración especial para esta cotización..."
                    style={{ resize: 'none' }}
                />
            </div>

            {/* Preview button */}
            <button
                onClick={onPreview}
                disabled={!canPreview}
                className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
            >
                <Eye size={18} /> Vista Previa de la Cotización
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// QUOTE PREVIEW (PDF-ready)
// ═══════════════════════════════════════════════════════════════
const QuotePreview = React.forwardRef<HTMLDivElement, any>(function QuotePreview({
    form, shippingCost, gastoDoc, subtotalLogistico, derechosAmount, tasaAmount,
    iva105Amount, iva21Amount, totalTaxes, totalUSD, totalARS, exchangeRate, exchangeDate, deliveryDays
}, ref) {
    const formatMoney = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const originInfo = ORIGINS.find(o => o.value === form.origin);
    const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="max-w-2xl mx-auto">
            <div ref={ref} className="bg-white rounded-2xl shadow-xl overflow-hidden" style={{ fontFamily: "'Inter', 'Outfit', system-ui, sans-serif", color: '#1a1f36' }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-[#0B1628] to-[#152238] px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img src="/logo-dark.png" alt="Shippar" className="h-7" />
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-blue-300/60 uppercase tracking-[0.15em]">Cotización</p>
                            <p className="text-xs font-bold text-slate-400">{today}</p>
                            <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
                                Válida 72hs
                            </span>
                        </div>
                    </div>
                    <div className="mt-5 flex items-center gap-4">
                        <span className="text-2xl">{originInfo?.flag}</span>
                        <div>
                            <p className="text-white font-black text-lg tracking-tight">{originInfo?.label?.toUpperCase()} → BUENOS AIRES</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/15 px-2.5 py-1 rounded-full">
                                    {form.serviceType === 'Express' ? '⚡' : '✈️'} {form.serviceType} Air
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full">
                                    🕐 {deliveryDays} días hábiles
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 py-6 space-y-6">
                    {/* Client info */}
                    <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Cliente</p>
                            <p className="text-lg font-black text-slate-800">{form.clientName.toUpperCase()}</p>
                        </div>
                        {form.clientCode && (
                            <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">{form.clientCode}</span>
                        )}
                    </div>

                    {/* Big KG + Tarifa */}
                    <div className="grid grid-cols-2 gap-6 pb-5 border-b border-slate-100">
                        <div className="text-center">
                            <p className="text-3xl font-black text-slate-800">{form.weightKg}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">KG Totales</p>
                        </div>
                        <div className="text-center">
                            <p className="text-3xl font-black text-blue-600">${form.tarifaPerKg}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">USD / KG</p>
                        </div>
                    </div>

                    {/* Costos Logísticos */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                            <Plane size={12} /> Costos Logísticos
                        </p>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center py-2">
                                <span className="text-xs font-bold text-slate-600">Transporte aéreo</span>
                                <span className="text-sm font-black text-slate-800">${formatMoney(shippingCost)}</span>
                            </div>
                            {gastoDoc > 0 && (
                                <div className="flex justify-between items-center py-2 border-t border-slate-50">
                                    <span className="text-xs font-bold text-slate-600">Gasto documental</span>
                                    <span className="text-sm font-black text-slate-800">${formatMoney(gastoDoc)}</span>
                                </div>
                            )}
                            {form.guiaAerea > 0 && (
                                <div className="flex justify-between items-center py-2 border-t border-slate-50">
                                    <span className="text-xs font-bold text-slate-600">Guía aérea</span>
                                    <span className="text-sm font-black text-slate-800">${formatMoney(form.guiaAerea)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-t border-slate-200 mt-1">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Subtotal</span>
                                <span className="text-sm font-black text-slate-800">${formatMoney(subtotalLogistico)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Impuestos */}
                    {form.includeTaxes && totalTaxes > 0 && (
                        <div className="border-l-4 border-amber-400 bg-amber-50/50 rounded-r-xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-3 flex items-center gap-2">
                                <AlertTriangle size={12} /> Impuestos Estimados
                            </p>
                            {form.valorFob && (
                                <div className="flex justify-between items-center py-1 mb-2">
                                    <span className="text-[10px] font-bold text-slate-500">Valor FOB declarado</span>
                                    <span className="text-xs font-black text-slate-600">${formatMoney(form.valorFob)}</span>
                                </div>
                            )}
                            <div className="space-y-1">
                                {derechosAmount > 0 && (
                                    <div className="flex justify-between items-center py-1.5">
                                        <span className="text-xs font-bold text-slate-600">Derechos ({form.derechosPct}%)</span>
                                        <span className="text-sm font-black text-slate-700">${formatMoney(derechosAmount)}</span>
                                    </div>
                                )}
                                {tasaAmount > 0 && (
                                    <div className="flex justify-between items-center py-1.5">
                                        <span className="text-xs font-bold text-slate-600">Tasa estadística ({form.tasaEstadisticaPct}%)</span>
                                        <span className="text-sm font-black text-slate-700">${formatMoney(tasaAmount)}</span>
                                    </div>
                                )}
                                {iva105Amount > 0 && (
                                    <div className="flex justify-between items-center py-1.5">
                                        <span className="text-xs font-bold text-slate-600">IVA Aduana ({form.ivaAduana105Pct}%)</span>
                                        <span className="text-sm font-black text-slate-700">${formatMoney(iva105Amount)}</span>
                                    </div>
                                )}
                                {iva21Amount > 0 && (
                                    <div className="flex justify-between items-center py-1.5">
                                        <span className="text-xs font-bold text-slate-600">IVA Aduana ({form.ivaAduana21Pct}%)</span>
                                        <span className="text-sm font-black text-slate-700">${formatMoney(iva21Amount)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center py-2 border-t border-amber-200 mt-2">
                                <span className="text-xs font-black text-amber-600 uppercase tracking-wider">Total Impuestos</span>
                                <span className="text-sm font-black text-amber-600">${formatMoney(totalTaxes)}</span>
                            </div>
                            <p className="text-[8px] font-medium text-amber-500/80 mt-2 italic">* Los impuestos son aproximados y pueden variar según la determinación de Aduana</p>
                        </div>
                    )}

                    {/* Desglose antes del total */}
                    {form.includeTaxes && totalTaxes > 0 && (
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                            <span>Logística: ${formatMoney(subtotalLogistico)}</span>
                            <span>+</span>
                            <span>Impuestos: ${formatMoney(totalTaxes)}</span>
                            <span>=</span>
                            <span className="text-slate-800 font-black">${formatMoney(totalUSD)}</span>
                        </div>
                    )}

                    {/* TOTAL */}
                    <div className="bg-gradient-to-br from-[#0B1628] to-[#1a2744] rounded-2xl px-6 py-5 text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-300/50 mb-1">Costo Total</p>
                        <p className="text-3xl font-black text-white">${formatMoney(totalUSD)} <span className="text-base text-blue-300">USD</span></p>
                        {totalARS && exchangeRate && (
                            <p className="text-xs font-bold text-slate-400 mt-1.5">
                                ≈ ARS {new Intl.NumberFormat('es-AR').format(Math.round(totalARS))}
                                <span className="text-[9px] ml-1.5 text-slate-500">(TC Oficial BCRA: ${exchangeRate} — {exchangeDate})</span>
                            </p>
                        )}
                    </div>

                    {/* Qué incluye */}
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Esta cotización incluye</p>
                        <div className="grid grid-cols-2 gap-2">
                            {SERVICE_INCLUDES.map(item => (
                                <div key={item} className="flex items-center gap-2">
                                    <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                                    <span className="text-[10px] font-bold text-slate-600">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Disclaimers */}
                    <div className="pt-4 border-t border-slate-100 space-y-1.5">
                        <p className="text-[8px] font-medium text-slate-400 leading-relaxed">
                            Los gastos de envío son exactos pero quedan supeditados a los kg recepcionados en oficina. Por favor proveer datos exactos.
                        </p>
                        <p className="text-[8px] font-medium text-slate-400 leading-relaxed">
                            La propuesta comercial presentada refleja la aproximación de los costos finales. {exchangeDate && `Tipo de cambio USD Oficial BCRA al ${exchangeDate}.`}
                        </p>
                        <p className="text-[8px] font-medium text-slate-400 mt-2">
                            Cotización generada por Shippar · {today}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});
