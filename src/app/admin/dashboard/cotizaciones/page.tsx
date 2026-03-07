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
    const downloadPDF = async () => {
        if (!previewRef.current) {
            toast.error('Preview no disponible');
            return;
        }
        try {
            // Clone the preview content into a new window for clean PDF printing
            const printWindow = window.open('', '_blank', 'width=800,height=1100');
            if (!printWindow) {
                toast.error('Habilitá las ventanas emergentes para descargar el PDF');
                return;
            }

            const content = previewRef.current.innerHTML;

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Cotización ${form.clientName} - Shippar</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@700;800;900&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Inter', 'Outfit', system-ui, sans-serif;
                            background: #fff;
                            color: #1a1f36;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        .quote-container {
                            max-width: 700px;
                            margin: 0 auto;
                            background: white;
                        }
                        @media print {
                            body { margin: 0; }
                            .quote-container { max-width: 100%; }
                            .no-print { display: none !important; }
                        }
                    </style>
                    <script src="https://cdn.tailwindcss.com"><\/script>
                </head>
                <body>
                    <div class="quote-container">
                        ${content}
                    </div>
                    <div class="no-print" style="text-align:center;padding:20px;">
                        <button onclick="window.print()" style="background:#2563eb;color:white;padding:12px 32px;border:none;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer;font-family:Inter,sans-serif;">
                            📥 Descargar PDF
                        </button>
                        <p style="color:#999;font-size:11px;margin-top:8px;">Seleccioná "Guardar como PDF" en el diálogo de impresión</p>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();

            toast.success('Ventana de PDF abierta — usá "Guardar como PDF"');
        } catch (err: any) {
            console.error('PDF Error:', err);
            toast.error(`Error al generar PDF: ${err.message || 'desconocido'}`);
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
                            {taxCategories.length > 0 && (
                                <div>
                                    <label className={labelClass}>Categoría (auto-rellena %)</label>
                                    <select
                                        className={inputClass}
                                        defaultValue=""
                                        onChange={(e) => {
                                            if (e.target.value === '__manage__') {
                                                onOpenTaxManager();
                                                e.target.value = '';
                                                return;
                                            }
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
                                        <option value="__manage__">⚙️ Gestionar categorías...</option>
                                        {taxCategories.map((cat: any) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} — Der. {cat.derechos_pct}% / Tasa {cat.tasa_estadistica_pct}% / IVA {cat.iva_pct}%
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
            <div ref={ref} className="bg-white rounded-2xl shadow-xl overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#1a1f36' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #0B1628 0%, #152238 100%)' }} className="px-8 py-7">
                    <div className="flex items-center justify-between">
                        <div>
                            <img src="/logo-dark.png" alt="Shippar" className="h-7" />
                        </div>
                        <div className="text-right">
                            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cotización</p>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>{today}</p>
                            <p style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', marginTop: '4px' }}>Válida por 72 horas</p>
                        </div>
                    </div>
                    <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                        <p style={{ color: '#fff', fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em' }}>
                            {originInfo?.label?.toUpperCase()} → BUENOS AIRES
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0', background: 'rgba(59,130,246,0.12)', padding: '4px 12px', borderRadius: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                {form.serviceType} Air
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '4px 12px', borderRadius: '4px' }}>
                                {deliveryDays} días hábiles
                            </span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 py-7" style={{ lineHeight: 1.6 }}>
                    {/* Client info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '2px' }}>Cliente</p>
                            <p style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>{form.clientName.toUpperCase()}</p>
                        </div>
                        {form.clientCode && (
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '6px 14px', borderRadius: '6px' }}>{form.clientCode}</span>
                        )}
                    </div>

                    {/* Big KG + Tarifa */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '24px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '32px', fontWeight: 900, color: '#1e293b' }}>{form.weightKg}</p>
                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', marginTop: '4px' }}>KG Totales</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '32px', fontWeight: 900, color: '#2563eb' }}>${form.tarifaPerKg}</p>
                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', marginTop: '4px' }}>USD / KG</p>
                        </div>
                    </div>

                    {/* Detalle de Envío */}
                    <div style={{ paddingTop: '24px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#64748b', marginBottom: '12px' }}>
                            Detalle de Envío
                        </p>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Transporte aéreo</span>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>${formatMoney(shippingCost)}</span>
                            </div>
                            {gastoDoc > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f8fafc' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Gasto documental</span>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>${formatMoney(gastoDoc)}</span>
                                </div>
                            )}
                            {form.guiaAerea > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #f8fafc' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Guía aérea</span>
                                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>${formatMoney(form.guiaAerea)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '2px solid #e2e8f0', marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subtotal Envío</span>
                                <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b' }}>${formatMoney(subtotalLogistico)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Impuestos */}
                    {form.includeTaxes && totalTaxes > 0 && (
                        <div style={{ borderLeft: '3px solid #f59e0b', background: '#fffbeb', borderRadius: '0 8px 8px 0', padding: '16px 20px', marginTop: '24px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#92400e', marginBottom: '12px' }}>
                                Impuestos Estimados
                            </p>
                            {form.valorFob && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#78716c' }}>Valor FOB declarado</span>
                                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#44403c' }}>${formatMoney(form.valorFob)}</span>
                                </div>
                            )}
                            <div>
                                {derechosAmount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#57534e' }}>Derechos ({form.derechosPct}%)</span>
                                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#292524' }}>${formatMoney(derechosAmount)}</span>
                                    </div>
                                )}
                                {tasaAmount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#57534e' }}>Tasa estadística ({form.tasaEstadisticaPct}%)</span>
                                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#292524' }}>${formatMoney(tasaAmount)}</span>
                                    </div>
                                )}
                                {iva105Amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#57534e' }}>IVA Aduana ({form.ivaAduana105Pct}%)</span>
                                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#292524' }}>${formatMoney(iva105Amount)}</span>
                                    </div>
                                )}
                                {iva21Amount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#57534e' }}>IVA Aduana ({form.ivaAduana21Pct}%)</span>
                                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#292524' }}>${formatMoney(iva21Amount)}</span>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 4px', borderTop: '1px solid #fde68a', marginTop: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Impuestos</span>
                                <span style={{ fontSize: '14px', fontWeight: 900, color: '#92400e' }}>${formatMoney(totalTaxes)}</span>
                            </div>
                            <p style={{ fontSize: '9px', fontWeight: 500, color: '#78716c', marginTop: '8px' }}>* Los impuestos son estimados y pueden variar según la determinación final de Aduana.</p>
                        </div>
                    )}

                    {/* Desglose antes del total */}
                    {form.includeTaxes && totalTaxes > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                            <span>Envío: ${formatMoney(subtotalLogistico)}</span>
                            <span>+</span>
                            <span>Impuestos: ${formatMoney(totalTaxes)}</span>
                            <span>=</span>
                            <span style={{ color: '#1e293b', fontWeight: 800 }}>${formatMoney(totalUSD)}</span>
                        </div>
                    )}

                    {/* TOTAL */}
                    <div style={{ background: 'linear-gradient(135deg, #0B1628 0%, #1a2744 100%)', borderRadius: '12px', padding: '28px 24px', textAlign: 'center', marginTop: '16px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(148,163,184,0.6)', marginBottom: '6px' }}>Costo Total Estimado</p>
                        <p style={{ fontSize: '30px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
                            ${formatMoney(totalUSD)} <span style={{ fontSize: '16px', fontWeight: 700, color: '#93c5fd' }}>USD</span>
                        </p>
                        {totalARS && exchangeRate && (
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginTop: '8px' }}>
                                Equivalente ARS {new Intl.NumberFormat('es-AR').format(Math.round(totalARS))}
                                <span style={{ fontSize: '9px', marginLeft: '6px', color: '#64748b' }}>(TC Oficial BCRA: ${exchangeRate} — {exchangeDate})</span>
                            </p>
                        )}
                    </div>

                    {/* Qué incluye */}
                    <div style={{ paddingTop: '24px', marginTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                        <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#64748b', marginBottom: '14px' }}>Esta cotización incluye</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            {SERVICE_INCLUDES.map(item => (
                                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Disclaimers */}
                    <div style={{ paddingTop: '20px', marginTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                        <p style={{ fontSize: '9px', fontWeight: 500, color: '#64748b', lineHeight: 1.7, marginBottom: '6px' }}>
                            Los costos de envío quedan sujetos a los kilogramos efectivamente recepcionados en origen. Por favor proveer datos exactos.
                        </p>
                        <p style={{ fontSize: '9px', fontWeight: 500, color: '#64748b', lineHeight: 1.7, marginBottom: '6px' }}>
                            El cobro se realiza en pesos argentinos al tipo de cambio venta Banco Nación del día en que llega la mercadería. El monto en pesos puede variar.
                        </p>
                        <p style={{ fontSize: '9px', fontWeight: 500, color: '#64748b', lineHeight: 1.7, marginBottom: '6px' }}>
                            La presente propuesta comercial refleja una aproximación de los costos finales.{exchangeDate && ` Tipo de cambio USD Oficial BCRA al ${exchangeDate}.`}
                        </p>
                        <p style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', marginTop: '12px' }}>
                            Cotización generada por Shippar · {today}
                        </p>
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
