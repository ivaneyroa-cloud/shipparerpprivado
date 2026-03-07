"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, User, Bell, Lock, Globe, Shield, MapPin, Box, Plus, Trash2, Loader2, AlertTriangle, Layers, Pencil, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('system'); // 'account' or 'system'

    const [origins, setOrigins] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loadingOrigins, setLoadingOrigins] = useState(true);
    const [loadingCategories, setLoadingCategories] = useState(true);

    const [newOrigin, setNewOrigin] = useState({ name: '', code: '' });
    const [newCategory, setNewCategory] = useState({ name: '', description: '' });

    // Tax categories state
    const [taxCategories, setTaxCategories] = useState<any[]>([]);
    const [loadingTaxCats, setLoadingTaxCats] = useState(true);
    const [newTaxCat, setNewTaxCat] = useState({ name: '', derechos_pct: 0, tasa_estadistica_pct: 3, iva_pct: 21 });
    const [editingTaxId, setEditingTaxId] = useState<string | null>(null);

    const fetchOrigins = async () => {
        setLoadingOrigins(true);
        const { data, error } = await supabase.from('origins').select('id, name, code').order('name');
        if (!error && data) setOrigins(data);
        setLoadingOrigins(false);
    };

    const fetchCategories = async () => {
        setLoadingCategories(true);
        const { data, error } = await supabase.from('categories').select('id, name, description').order('name');
        if (!error && data) setCategories(data);
        setLoadingCategories(false);
    };

    useEffect(() => {
        fetchOrigins();
        fetchCategories();
        fetchTaxCategories();

        // Auto-select tab based on URL param if present
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tab = params.get('tab');
            if (tab === 'origins' || tab === 'products') {
                setActiveTab('system');
            }
        }
    }, []);

    const handleAddOrigin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrigin.name) return;
        const { error } = await supabase.from('origins').insert([{ name: newOrigin.name.toUpperCase(), code: newOrigin.code.toUpperCase() }]);
        if (!error) {
            setNewOrigin({ name: '', code: '' });
            fetchOrigins();
        } else {
            alert(`Error al guardar: ${error.message} (Recordá ejecutar SUPABASE_SETUP_V2.sql)`);
        }
    };

    const handleDeleteOrigin = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que querés borrar '${name}'?`)) return;
        await supabase.from('origins').delete().eq('id', id);
        fetchOrigins();
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategory.name) return;
        const { error } = await supabase.from('categories').insert([{ name: newCategory.name.toUpperCase(), description: newCategory.description }]);
        if (!error) {
            setNewCategory({ name: '', description: '' });
            fetchCategories();
        } else {
            alert(`Error al guardar: ${error.message} (Recordá ejecutar SUPABASE_SETUP_V2.sql)`);
        }
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que querés borrar '${name}'?`)) return;
        await supabase.from('categories').delete().eq('id', id);
        fetchCategories();
    };

    // Tax categories handlers
    const fetchTaxCategories = async () => {
        setLoadingTaxCats(true);
        const { data, error } = await supabase.from('tax_categories').select('*').order('name');
        if (!error && data) setTaxCategories(data);
        setLoadingTaxCats(false);
    };

    const handleSaveTaxCat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaxCat.name) return;
        const { data: { session } } = await supabase.auth.getSession();
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', session?.user.id).single();

        if (editingTaxId) {
            const { error } = await supabase.from('tax_categories').update({
                name: newTaxCat.name,
                derechos_pct: newTaxCat.derechos_pct,
                tasa_estadistica_pct: newTaxCat.tasa_estadistica_pct,
                iva_pct: newTaxCat.iva_pct,
            }).eq('id', editingTaxId);
            if (!error) {
                setEditingTaxId(null);
                setNewTaxCat({ name: '', derechos_pct: 0, tasa_estadistica_pct: 3, iva_pct: 21 });
                fetchTaxCategories();
            }
        } else {
            const { error } = await supabase.from('tax_categories').insert([{
                name: newTaxCat.name,
                derechos_pct: newTaxCat.derechos_pct,
                tasa_estadistica_pct: newTaxCat.tasa_estadistica_pct,
                iva_pct: newTaxCat.iva_pct,
                org_id: profile?.org_id,
            }]);
            if (!error) {
                setNewTaxCat({ name: '', derechos_pct: 0, tasa_estadistica_pct: 3, iva_pct: 21 });
                fetchTaxCategories();
            } else {
                alert(`Error: ${error.message}`);
            }
        }
    };

    const handleDeleteTaxCat = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar la categoría '${name}'?`)) return;
        await supabase.from('tax_categories').delete().eq('id', id);
        fetchTaxCategories();
    };

    const startEditTaxCat = (cat: any) => {
        setEditingTaxId(cat.id);
        setNewTaxCat({ name: cat.name, derechos_pct: cat.derechos_pct, tasa_estadistica_pct: cat.tasa_estadistica_pct, iva_pct: cat.iva_pct });
    };

    const sections = [
        { label: 'Perfil', icon: <User size={20} />, desc: 'Información de la cuenta y avatar' },
        { label: 'Notificaciones', icon: <Bell size={20} />, desc: 'Configuración de alertas y avisos' },
        { label: 'Seguridad', icon: <Lock size={20} />, desc: 'Contraseña y autenticación' },
        { label: 'Idioma', icon: <Globe size={20} />, desc: 'Preferencia de lenguaje' },
        { label: 'Privacidad', icon: <Shield size={20} />, desc: 'Gestión de datos y accesos' },
    ];

    return (
        <div className="space-y-8 max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3 lowercase">
                        <Settings className="text-blue-500" size={24} strokeWidth={1.5} /> configuración global
                    </h1>
                    <p className="text-slate-500 font-medium">Gestioná tus preferencias de cuenta y del HUB logístico</p>
                </div>

                <div className="flex bg-[#0f172a] p-1.5 border border-white/5 rounded-2xl w-max">
                    <button
                        onClick={() => setActiveTab('account')}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'account' ? 'bg-blue-600 text-white ' : 'text-slate-500 hover:text-white'}`}
                    >
                        Cuenta
                    </button>
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'system' ? 'bg-blue-600 text-white ' : 'text-slate-500 hover:text-white'}`}
                    >
                        Sistema Logístico
                    </button>
                </div>
            </div>

            {activeTab === 'system' && (
                <div className="space-y-8">
                    {origins.length === 0 && categories.length === 0 && !loadingOrigins && !loadingCategories && (
                        <div className="bg-amber-500/10 border border-amber-500/50 p-6 rounded-3xl flex items-center gap-4 text-amber-500 shadow-xl">
                            <AlertTriangle size={24} strokeWidth={1.5} />
                            <div>
                                <p className="font-black tracking-tight text-lg">¡Atención Administrador!</p>
                                <p className="text-sm font-medium opacity-80 mt-1 text-amber-400">Las tablas aún no existen en tu base de datos o están vacías. Asegurate de copiar y pegar el código que se encuentra en <b>SUPABASE_SETUP_V2.sql</b> en el "SQL Editor" de tu cuenta de Supabase y apretar "RUN" para activar este módulo.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
                        {/* Origins Panel */}
                        <div className="bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[650px]">
                            <div className="p-8 border-b border-white/5 bg-slate-900/50">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                                        <MapPin size={20} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white">Países de Origen</h2>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">({origins.length} Registrados)</p>
                                    </div>
                                </div>

                                <form onSubmit={handleAddOrigin} className="flex gap-3 relative z-10">
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-1 gap-2 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
                                        <input
                                            className="w-full bg-transparent text-white outline-none font-bold placeholder:text-slate-600 text-sm uppercase"
                                            placeholder="NUEVO ORIGEN (EJ: CHINA)"
                                            value={newOrigin.name}
                                            onChange={e => setNewOrigin({ ...newOrigin, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="w-24 bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-1 gap-2 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
                                        <input
                                            className="w-full bg-transparent text-emerald-400 outline-none font-black placeholder:text-slate-600 text-sm uppercase text-center"
                                            placeholder="ISO"
                                            value={newOrigin.code}
                                            maxLength={3}
                                            onChange={e => setNewOrigin({ ...newOrigin, code: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center group">
                                        <Plus size={18} strokeWidth={1.5} className="group-hover:rotate-90 transition-transform" />
                                    </button>
                                </form>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto space-y-3 relative">
                                {loadingOrigins ? (
                                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500 z-10 relative" size={32} /></div>
                                ) : origins.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-50 relative z-10">
                                        <MapPin size={32} strokeWidth={1} className="text-slate-500 mb-4 opacity-50" />
                                        <p className="text-center text-slate-500 font-medium tracking-tight">Sin países registrados</p>
                                    </div>
                                ) : origins.map((o, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                        key={o.id} className="bg-white/5 border border-white/5 p-5 rounded-[20px] flex items-center justify-between hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all group relative z-10"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-[#0f172a] border border-white/5 flex items-center justify-center text-emerald-500 font-black text-sm tracking-widest shadow-inner">
                                                {o.code || o.name.substring(0, 2)}
                                            </div>
                                            <p className="font-black text-white px-2 tracking-widest uppercase">{o.name}</p>
                                        </div>
                                        <button onClick={() => handleDeleteOrigin(o.id, o.name)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100">
                                            <Trash2 size={16} strokeWidth={1.5} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Categories Panel */}
                        <div className="bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col h-[650px]">
                            <div className="p-8 border-b border-white/5 bg-slate-900/50">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400">
                                        <Box size={20} strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white">Categorías de Productos</h2>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">({categories.length} Registradas)</p>
                                    </div>
                                </div>

                                <form onSubmit={handleAddCategory} className="flex gap-3 relative z-10">
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-1 gap-2 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500/50 transition-all">
                                        <input
                                            className="w-full bg-transparent text-white outline-none font-bold placeholder:text-slate-600 text-sm uppercase"
                                            placeholder="NUEVA CATEGORÍA (EJ: ROPA)"
                                            value={newCategory.name}
                                            onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-6 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center group">
                                        <Plus size={18} strokeWidth={1.5} className="group-hover:rotate-90 transition-transform" />
                                    </button>
                                </form>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto space-y-3 relative">
                                {loadingCategories ? (
                                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-amber-500 z-10 relative" size={32} /></div>
                                ) : categories.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-50 relative z-10">
                                        <Box size={32} strokeWidth={1} className="text-slate-500 mb-4 opacity-50" />
                                        <p className="text-center text-slate-500 font-medium tracking-tight">Sin categorías registradas</p>
                                    </div>
                                ) : categories.map((c, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                        key={c.id} className="bg-white/5 border border-white/5 p-5 rounded-[20px] flex items-center justify-between hover:bg-amber-500/5 hover:border-amber-500/30 transition-all group relative z-10"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-[#0f172a] border border-white/5 flex items-center justify-center shadow-inner">
                                                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_#f59e0b]"></div>
                                            </div>
                                            <p className="font-black text-white px-2 tracking-widest uppercase">{c.name}</p>
                                        </div>
                                        <button onClick={() => handleDeleteCategory(c.id, c.name)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100">
                                            <Trash2 size={16} strokeWidth={1.5} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tax Categories Panel - Full Width */}
                    <div className="bg-[#0f172a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-white/5 bg-slate-900/50">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400">
                                    <Scale size={20} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white">Categorías Arancelarias</h2>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">({taxCategories.length} Registradas) — Se usan en el cotizador</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveTaxCat} className="space-y-3 relative z-10">
                                <div className="flex gap-3">
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all">
                                        <input
                                            className="w-full bg-transparent text-white outline-none font-bold placeholder:text-slate-600 text-sm"
                                            placeholder="Nombre (ej: Electrónica, Indumentaria)"
                                            value={newTaxCat.name}
                                            onChange={e => setNewTaxCat({ ...newTaxCat, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                                        {editingTaxId ? <><Pencil size={14} /> Actualizar</> : <><Plus size={18} strokeWidth={1.5} /></>}
                                    </button>
                                    {editingTaxId && (
                                        <button type="button" onClick={() => { setEditingTaxId(null); setNewTaxCat({ name: '', derechos_pct: 0, tasa_estadistica_pct: 3, iva_pct: 21 }); }} className="px-4 rounded-2xl border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all text-xs font-black">
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-blue-500 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Derechos %</label>
                                        <input type="number" step="0.1" className="w-full bg-transparent text-white outline-none font-black text-sm text-center" value={newTaxCat.derechos_pct} onChange={e => setNewTaxCat({ ...newTaxCat, derechos_pct: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-blue-500 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Tasa Est. %</label>
                                        <input type="number" step="0.1" className="w-full bg-transparent text-white outline-none font-black text-sm text-center" value={newTaxCat.tasa_estadistica_pct} onChange={e => setNewTaxCat({ ...newTaxCat, tasa_estadistica_pct: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-blue-500 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">IVA %</label>
                                        <input type="number" step="0.1" className="w-full bg-transparent text-white outline-none font-black text-sm text-center" value={newTaxCat.iva_pct} onChange={e => setNewTaxCat({ ...newTaxCat, iva_pct: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto space-y-3 relative max-h-[400px]">
                            {loadingTaxCats ? (
                                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500 z-10 relative" size={32} /></div>
                            ) : taxCategories.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-50 relative z-10 py-10">
                                    <Scale size={32} strokeWidth={1} className="text-slate-500 mb-4 opacity-50" />
                                    <p className="text-center text-slate-500 font-medium tracking-tight">Sin categorías arancelarias — Cargá las de tus productos más comunes</p>
                                </div>
                            ) : taxCategories.map((tc, i) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    key={tc.id} className="bg-white/5 border border-white/5 p-5 rounded-[20px] flex items-center justify-between hover:bg-blue-500/5 hover:border-blue-500/30 transition-all group relative z-10"
                                >
                                    <div>
                                        <p className="font-black text-white tracking-wide uppercase">{tc.name}</p>
                                        <p className="text-xs font-bold text-slate-500 mt-0.5">
                                            Derechos {tc.derechos_pct}% · Tasa {tc.tasa_estadistica_pct}% · IVA {tc.iva_pct}%
                                        </p>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditTaxCat(tc)} className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all scale-90 group-hover:scale-100">
                                            <Pencil size={14} strokeWidth={1.5} />
                                        </button>
                                        <button onClick={() => handleDeleteTaxCat(tc.id, tc.name)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all scale-90 group-hover:scale-100">
                                            <Trash2 size={14} strokeWidth={1.5} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'account' && (
                <div className="bg-[#0f172a] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/5 bg-slate-900/50">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center text-white shadow-xl shadow-blue-600/20">
                                <Layers size={24} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Panel de Control de Usuario</h2>
                                <p className="text-base font-medium text-slate-500 mt-1">Versión de Sistema: 3.1.2 Elite</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {sections.map((section, i) => (
                            <motion.button
                                key={section.label}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="w-full flex items-center justify-between p-6 hover:bg-white/5 rounded-[28px] transition-all group"
                            >
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 flex items-center justify-center bg-slate-800 text-slate-400 group-hover:bg-blue-600 group-hover:text-white rounded-[20px] transition-all">
                                        {section.icon}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-white text-lg">{section.label}</p>
                                        <p className="text-sm font-medium text-slate-500">{section.desc}</p>
                                    </div>
                                </div>
                                <div className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <Settings size={16} strokeWidth={1.5} className="group-hover:rotate-90 transition-transform" />
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
