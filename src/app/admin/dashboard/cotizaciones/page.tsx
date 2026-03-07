'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Download, Eye, ArrowRight, Package, Plane, Scale,
    DollarSign, AlertTriangle, CheckCircle2, Search, X, ChevronDown,
    Globe, Clock, Shield, Settings, Plus, Trash2, Pencil
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
    'TCA (Terminal Cargas Argentina)',
    'Handling & almacenaje',
    'Despacho de importación',
    'Seguimiento en tiempo real',
    'Facturado a dólar oficial',
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
    const [taxCategories, setTaxCategories] = useState<any[]>([]);
    const [showTaxManager, setShowTaxManager] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    const refreshTaxCategories = () => {
        supabase.from('tax_categories').select('*').order('name').then(({ data }) => {
            if (data) setTaxCategories(data);
        });
    };

    // Fetch clients for autocomplete
    useEffect(() => {
        supabase.from('clients').select('id, name, code, tarifa_aplicable').order('name').then(({ data }) => {
            if (data) setClients(data);
        });
        // Fetch tax categories
        supabase.from('tax_categories').select('*').order('name').then(({ data }) => {
            if (data) setTaxCategories(data);
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

    // CIF = FOB + Flete ($2.70/kg) + Seguro (1% FOB)
    const FLETE_PER_KG = 2.70;
    const SEGURO_PCT = 0.01;
    const cifFlete = form.includeTaxes && form.valorFob ? (form.weightKg * FLETE_PER_KG) : 0;
    const cifSeguro = form.includeTaxes && form.valorFob ? (form.valorFob * SEGURO_PCT) : 0;
    const cifValue = form.includeTaxes && form.valorFob ? (form.valorFob + cifFlete + cifSeguro) : 0;

    // Derechos y Tasa se calculan sobre CIF
    const derechosAmount = form.includeTaxes && cifValue ? (cifValue * form.derechosPct / 100) : 0;
    const tasaAmount = form.includeTaxes && cifValue ? (cifValue * form.tasaEstadisticaPct / 100) : 0;
    // IVA se calcula sobre CIF + Derechos + Tasa (base acumulada, así lo hace Aduana)
    const ivaBase = cifValue + derechosAmount + tasaAmount;
    const iva105Amount = form.includeTaxes && cifValue ? (ivaBase * form.ivaAduana105Pct / 100) : 0;
    const iva21Amount = form.includeTaxes && cifValue ? (ivaBase * form.ivaAduana21Pct / 100) : 0;
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
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const downloadPDF = async () => {
        if (!previewRef.current) {
            toast.error('Preview no disponible');
            return;
        }
        setGeneratingPDF(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            // Render at 2x for crisp output
            const canvas = await html2canvas(previewRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#070d19',
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210; // A4 width mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const pdf = new jsPDF('p', 'mm', 'a4');
            let position = 0;
            const pageHeight = 297; // A4 height mm

            // Fill entire page with dark background
            pdf.setFillColor(7, 13, 25); // #070d19
            pdf.rect(0, 0, 210, 297, 'F');

            // Handle multi-page if content is taller than A4
            if (imgHeight <= pageHeight) {
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            } else {
                let remaining = imgHeight;
                while (remaining > 0) {
                    if (position < 0) {
                        pdf.setFillColor(7, 13, 25);
                        pdf.rect(0, 0, 210, 297, 'F');
                    }
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    remaining -= pageHeight;
                    position -= pageHeight;
                    if (remaining > 0) pdf.addPage();
                }
            }

            const fileName = `Cotizacion_${form.clientName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);
            toast.success('PDF descargado');
        } catch (err: any) {
            console.error('PDF Error:', err);
            toast.error(`Error al generar PDF: ${err.message || 'desconocido'}`);
        } finally {
            setGeneratingPDF(false);
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
                                cifValue={cifValue}
                                taxCategories={taxCategories}
                                onOpenTaxManager={() => setShowTaxManager(true)}
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

            {/* Tax Category Manager Modal */}
            {showTaxManager && (
                <TaxCategoryManager
                    categories={taxCategories}
                    onClose={() => setShowTaxManager(false)}
                    onRefresh={refreshTaxCategories}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// QUOTE FORM COMPONENT
// ═══════════════════════════════════════════════════════════════
function QuoteForm({
    form, setField, clientSearch, setClientSearch, showClientDropdown, setShowClientDropdown,
    filteredClients, selectClient, shippingCost, gastoDoc, subtotalLogistico, totalTaxes, totalUSD, totalARS,
    exchangeRate, deliveryDays, canPreview, cifValue, taxCategories, onOpenTaxManager, onPreview
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
                            {cifValue > 0 && (
                                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl px-4 py-2.5 flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Base Imponible (CIF)</span>
                                    <span className="text-xs font-black text-slate-600 dark:text-slate-300">${formatMoney(cifValue)} USD</span>
                                </div>
                            )}

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

                            {/* Tax category selector */}
                            <div>
                                <label className={labelClass}>Categoría Arancelaria (auto-rellena %)</label>
                                {taxCategories.length > 0 ? (
                                    <select
                                        className={inputClass}
                                        defaultValue=""
                                        onChange={(e) => {
                                            const cat = taxCategories.find((c: any) => c.id === e.target.value);
                                            if (cat) {
                                                setField('derechosPct', cat.derechos_pct || 0);
                                                setField('tasaEstadisticaPct', cat.tasa_estadistica_pct || 3);
                                                setField('ivaAduana105Pct', cat.iva_pct === 10.5 ? 10.5 : 0);
                                                setField('ivaAduana21Pct', cat.iva_pct === 21 ? 21 : 0);
                                            }
                                        }}
                                    >
                                        <option value="" disabled>Seleccionar categoría...</option>
                                        {taxCategories.map((cat: any) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} — Der. {cat.derechos_pct}% / Tasa {cat.tasa_estadistica_pct}% / IVA {cat.iva_pct}%
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-4 py-3 rounded-xl">
                                        No hay categorías cargadas. Andá a <a href="/admin/dashboard/settings" className="text-blue-500 underline hover:text-blue-400">Ajustes → Sistema Logístico</a> para crear tus categorías arancelarias.
                                    </p>
                                )}
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

    // Color system: blue=logistics, amber=taxes, green=result
    const S = {
        base: '#070d19',      // deepest layer
        bg: '#0B1628',        // main background
        card: '#111d32',      // card surfaces
        cardBorder: '#1e2d47',
        accent: '#3b82f6',    // blue - logistics
        text: '#f1f5f9',      // primary text
        muted: '#a8b8cc',     // labels, section titles (brighter for legibility)
        dim: '#cbd5e1',       // secondary text (LIGHT for legibility)
        white: '#ffffff',
        amber: '#d4a574',     // warm gold - taxes
        green: '#4ADE80',     // fintech green - total
        greenDim: '#2a9d5c',  // muted green
    };

    return (
        <div style={{ maxWidth: '580px', margin: '0 auto' }}>
            <div ref={ref} style={{ fontFamily: "'Inter', system-ui, sans-serif", background: S.base, color: S.text, borderRadius: '10px', overflow: 'hidden' }}>

                {/* ── TOP ACCENT BAR ── */}
                <div style={{ height: '3px', background: `linear-gradient(90deg, ${S.accent} 0%, ${S.green} 100%)` }} />

                {/* ── HEADER ── */}
                <div style={{ padding: '22px 20px 14px', background: S.bg, borderBottom: `1px solid ${S.cardBorder}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <img src="/logo-dark.png" alt="Shippar" style={{ height: '24px' }} />
                            <p style={{ fontSize: '6.5px', fontWeight: 500, color: S.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '3px', fontStyle: 'italic' }}>Tu socio en comercio internacional</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '6.5px', fontWeight: 500, color: S.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cotización</p>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: S.white, marginTop: '1px' }}>{today}</p>
                            <p style={{ fontSize: '6.5px', fontWeight: 400, color: S.muted, marginTop: '1px', fontStyle: 'italic' }}>Válida por 72hs</p>
                        </div>
                    </div>
                </div>

                {/* ── INFO CARDS (single grid) ── */}
                <div style={{ padding: '10px 20px', background: S.bg, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '5px' }}>
                    <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: '5px', padding: '8px' }}>
                        <p style={{ fontSize: '6px', fontWeight: 500, color: S.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Cliente</p>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: S.white, lineHeight: 1.2 }}>{form.clientName.toUpperCase()}</p>
                        {form.clientCode && <p style={{ fontSize: '7px', fontWeight: 500, color: S.accent, marginTop: '1px' }}>{form.clientCode}</p>}
                    </div>
                    <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: '5px', padding: '8px' }}>
                        <p style={{ fontSize: '6px', fontWeight: 500, color: S.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Ruta</p>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>{originInfo?.label?.toUpperCase()}</p>
                        <p style={{ fontSize: '7px', fontWeight: 400, color: S.dim }}>→ Buenos Aires</p>
                    </div>
                    <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: '5px', padding: '8px' }}>
                        <p style={{ fontSize: '6px', fontWeight: 500, color: S.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>Servicio</p>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>{form.serviceType} Air</p>
                        <p style={{ fontSize: '7px', fontWeight: 400, color: S.dim }}>{deliveryDays} días hábiles</p>
                    </div>
                    <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: '5px', padding: '8px', textAlign: 'center' }}>
                        <p style={{ fontSize: '6px', fontWeight: 500, color: S.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>KG Cotizados</p>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: S.white, lineHeight: 1 }}>{form.weightKg}</p>
                    </div>
                    <div style={{ background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: '5px', padding: '8px', textAlign: 'center' }}>
                        <p style={{ fontSize: '6px', fontWeight: 500, color: S.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>Tarifa por KG</p>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: S.accent, lineHeight: 1 }}>${form.tarifaPerKg}</p>
                    </div>
                </div>

                {/* ── DETALLE DE ENVÍO (blue accent) ── */}
                <div style={{ margin: '8px 20px 0', background: S.card, border: `1px solid ${S.cardBorder}`, borderLeft: `2px solid ${S.accent}`, borderRadius: '5px', padding: '10px 12px' }}>
                    <p style={{ fontSize: '6.5px', fontWeight: 600, color: S.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>Detalle de envío</p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ fontSize: '9px', fontWeight: 400, color: S.dim }}>Transporte aéreo</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>${formatMoney(shippingCost)}</span>
                    </div>
                    {gastoDoc > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: `1px solid ${S.cardBorder}` }}>
                            <span style={{ fontSize: '9px', fontWeight: 400, color: S.dim }}>Gasto documental</span>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>${formatMoney(gastoDoc)}</span>
                        </div>
                    )}
                    {form.guiaAerea > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderTop: `1px solid ${S.cardBorder}` }}>
                            <span style={{ fontSize: '9px', fontWeight: 400, color: S.dim }}>Guía aérea</span>
                            <span style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>${formatMoney(form.guiaAerea)}</span>
                        </div>
                    )}
                    <div style={{ borderTop: `2px solid ${S.accent}`, marginTop: '4px', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '7px', fontWeight: 600, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Subtotal Envío</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: S.white }}>${formatMoney(subtotalLogistico)}</span>
                    </div>
                </div>

                {/* ── IMPUESTOS (amber accent) ── */}
                {form.includeTaxes && totalTaxes > 0 && (
                    <div style={{ margin: '10px 20px 0', background: S.card, border: `1px solid ${S.cardBorder}`, borderLeft: `2px solid ${S.amber}`, borderRadius: '5px', padding: '10px 12px' }}>
                        <p style={{ fontSize: '6.5px', fontWeight: 600, color: S.amber, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>Impuestos estimados</p>

                        {form.valorFob && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', marginBottom: '3px' }}>
                                <span style={{ fontSize: '8px', fontWeight: 400, color: 'rgba(168,184,204,0.6)' }}>Valor FOB declarado</span>
                                <span style={{ fontSize: '8px', fontWeight: 500, color: 'rgba(203,213,225,0.5)' }}>USD ${formatMoney(form.valorFob)}</span>
                            </div>
                        )}
                        {derechosAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                <span style={{ fontSize: '9px', fontWeight: 400, color: S.dim }}>Derechos ({form.derechosPct}%)</span>
                                <span style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>USD ${formatMoney(derechosAmount)}</span>
                            </div>
                        )}
                        {tasaAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                <span style={{ fontSize: '9px', fontWeight: 400, color: S.dim }}>Tasa estadística ({form.tasaEstadisticaPct}%)</span>
                                <span style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>USD ${formatMoney(tasaAmount)}</span>
                            </div>
                        )}
                        {iva105Amount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                <span style={{ fontSize: '9px', fontWeight: 400, color: S.dim }}>IVA Aduana ({form.ivaAduana105Pct}%)</span>
                                <span style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>USD ${formatMoney(iva105Amount)}</span>
                            </div>
                        )}
                        {iva21Amount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                <span style={{ fontSize: '9px', fontWeight: 400, color: S.dim }}>IVA Aduana ({form.ivaAduana21Pct}%)</span>
                                <span style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>USD ${formatMoney(iva21Amount)}</span>
                            </div>
                        )}
                        <div style={{ borderTop: `1px solid rgba(212,165,116,0.25)`, marginTop: '3px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '7.5px', fontWeight: 600, color: '#e0a960', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total Impuestos</span>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#e0a960' }}>USD ${formatMoney(totalTaxes)}</span>
                        </div>
                        <p style={{ fontSize: '6px', fontWeight: 400, color: S.muted, marginTop: '4px', fontStyle: 'italic' }}>* Estimados, pueden variar según determinación de Aduana.</p>
                    </div>
                )}

                {/* ── RESUMEN ── */}
                {form.includeTaxes && totalTaxes > 0 && (
                    <div style={{ margin: '10px 20px 0', display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: '3px', alignItems: 'center', padding: '8px 8px', background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: '5px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '6px', fontWeight: 500, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Envío</p>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>${formatMoney(subtotalLogistico)}</p>
                        </div>
                        <span style={{ fontSize: '9px', color: S.muted, fontWeight: 700 }}>+</span>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '6px', fontWeight: 500, color: S.amber, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Impuestos</p>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: S.white }}>${formatMoney(totalTaxes)}</p>
                        </div>
                        <span style={{ fontSize: '9px', color: S.muted, fontWeight: 700 }}>=</span>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '6px', fontWeight: 500, color: S.green, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: S.green }}>${formatMoney(totalUSD)}</p>
                        </div>
                    </div>
                )}

                {/* ── TOTAL GRANDE (green accent) ── */}
                <div style={{ margin: '10px 20px 0', background: `linear-gradient(135deg, #0f3f2c 0%, #1a5e40 100%)`, border: `1px solid rgba(74,222,128,0.2)`, borderLeft: `3px solid ${S.green}`, borderRadius: '6px', padding: '18px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: '6.5px', fontWeight: 600, color: S.muted, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '4px' }}>Costo Total Estimado</p>
                    <p style={{ fontSize: '26px', fontWeight: 800, color: S.green, letterSpacing: '-0.02em', lineHeight: 1 }}>
                        ${formatMoney(totalUSD)} <span style={{ fontSize: '11px', fontWeight: 600, color: S.greenDim }}>USD</span>
                    </p>
                    {(totalARS || exchangeRate) && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(74,222,128,0.12)' }}>
                            {totalARS && exchangeRate && (
                                <p style={{ fontSize: '7.5px', fontWeight: 400, color: 'rgba(203,213,225,0.7)', lineHeight: 1 }}>
                                    Equivalente ARS {new Intl.NumberFormat('es-AR').format(Math.round(totalARS))}
                                </p>
                            )}
                            {exchangeRate && (
                                <p style={{ fontSize: '6px', fontWeight: 400, color: 'rgba(168,184,204,0.6)', marginTop: '3px', fontStyle: 'italic' }}>
                                    TC Oficial BCRA: ${exchangeRate} — {exchangeDate}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── QUÉ INCLUYE ── */}
                <div style={{ margin: '10px 20px 0', background: S.card, border: `1px solid ${S.cardBorder}`, borderRadius: '5px', padding: '10px 14px' }}>
                    <p style={{ fontSize: '6.5px', fontWeight: 600, color: S.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '4px', textAlign: 'center' }}>Incluye</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 6px' }}>
                        {SERVICE_INCLUDES.map(item => (
                            <div key={item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <CheckCircle2 size={7} style={{ color: S.green, flexShrink: 0 }} />
                                <span style={{ fontSize: '7.5px', fontWeight: 400, color: S.dim }}>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── DISCLAIMERS ── */}
                <div style={{ padding: '10px 20px 16px' }}>
                    <p style={{ fontSize: '6px', fontWeight: 400, color: S.muted, lineHeight: 1.4, fontStyle: 'italic' }}>
                        Costos sujetos a KG efectivamente recepcionados. Cobro en ARS al TC venta BNA del día de llegada (puede variar). Propuesta aproximada de costos finales.
                    </p>
                    <div style={{ marginTop: '10px', textAlign: 'center', borderTop: `1px solid ${S.cardBorder}`, paddingTop: '10px' }}>
                        <p style={{ fontSize: '7px', fontWeight: 600, color: S.dim, letterSpacing: '0.05em' }}>Shippar Global Logistics S.R.L.</p>
                        <p style={{ fontSize: '6.5px', fontWeight: 400, color: S.muted, fontStyle: 'italic', marginTop: '2px' }}>Comercio sin fronteras.</p>
                    </div>
                </div>

            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// TAX CATEGORY MANAGER MODAL
// ═══════════════════════════════════════════════════════════════
function TaxCategoryManager({ categories, onClose, onRefresh }: { categories: any[]; onClose: () => void; onRefresh: () => void }) {
    const [newName, setNewName] = useState('');
    const [newDerechos, setNewDerechos] = useState(0);
    const [newTasa, setNewTasa] = useState(3);
    const [newIva, setNewIva] = useState(21);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const inputClass = "w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400";

    const handleSave = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session?.user.id).single();

            if (editingId) {
                await supabase.from('tax_categories').update({
                    name: newName,
                    derechos_pct: newDerechos,
                    tasa_estadistica_pct: newTasa,
                    iva_pct: newIva,
                }).eq('id', editingId);
                toast.success('Categoría actualizada');
            } else {
                await supabase.from('tax_categories').insert({
                    name: newName,
                    derechos_pct: newDerechos,
                    tasa_estadistica_pct: newTasa,
                    iva_pct: newIva,
                    org_id: profile?.org_id,
                });
                toast.success('Categoría creada');
            }
            setNewName('');
            setNewDerechos(0);
            setNewTasa(3);
            setNewIva(21);
            setEditingId(null);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta categoría?')) return;
        await supabase.from('tax_categories').delete().eq('id', id);
        toast.success('Eliminada');
        onRefresh();
    };

    const startEdit = (cat: any) => {
        setEditingId(cat.id);
        setNewName(cat.name);
        setNewDerechos(cat.derechos_pct);
        setNewTasa(cat.tasa_estadistica_pct);
        setNewIva(cat.iva_pct);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">Categorías Arancelarias</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Creá y gestioná tus categorías con porcentajes predefinidos</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <X size={16} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                    {/* Add/Edit form */}
                    <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {editingId ? '✏️ Editando categoría' : '➕ Nueva categoría'}
                        </p>
                        <input
                            className={inputClass}
                            placeholder="Nombre (ej: Electrónica, Indumentaria...)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Derechos %</label>
                                <input type="number" step="0.1" className={`${inputClass} text-center`} value={newDerechos} onChange={(e) => setNewDerechos(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Tasa Est. %</label>
                                <input type="number" step="0.1" className={`${inputClass} text-center`} value={newTasa} onChange={(e) => setNewTasa(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">IVA %</label>
                                <input type="number" step="0.1" className={`${inputClass} text-center`} value={newIva} onChange={(e) => setNewIva(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                disabled={saving || !newName.trim()}
                                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                {editingId ? <><Pencil size={12} /> Actualizar</> : <><Plus size={12} /> Agregar</>}
                            </button>
                            {editingId && (
                                <button
                                    onClick={() => { setEditingId(null); setNewName(''); setNewDerechos(0); setNewTasa(3); setNewIva(21); }}
                                    className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    {categories.length === 0 ? (
                        <p className="text-center text-xs font-bold text-slate-400 py-6">No hay categorías creadas aún</p>
                    ) : (
                        <div className="space-y-2">
                            {categories.map((cat) => (
                                <div key={cat.id} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-white">{cat.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                                            Derechos {cat.derechos_pct}% · Tasa {cat.tasa_estadistica_pct}% · IVA {cat.iva_pct}%
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => startEdit(cat)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                                            <Pencil size={13} className="text-blue-500" />
                                        </button>
                                        <button onClick={() => handleDelete(cat.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                                            <Trash2 size={13} className="text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
