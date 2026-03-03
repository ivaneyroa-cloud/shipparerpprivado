'use client';

import React, { useState, useCallback } from 'react';
import { Copy, ChevronDown, Package, Scale, MapPin, Calendar, Save, X, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Shipment, Client } from '@/types';

interface MobileShipmentCardProps {
    s: Shipment;
    clients: Client[];
    handleInlineUpdate: (id: string, field: keyof Shipment, value: string | number | null) => void;
    statusOptions: string[];
    deleteShipments: (ids: string[]) => void;
    onReceiveShipment: (s: Shipment) => void;
    userRole?: string;
    isDepotView?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'guía creada': { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
    'en tránsito': { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
    'pendiente expo': { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30' },
    'recibido en oficina': { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
    'retirado': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    'despachado': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    'retenido': { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
    'mercado libre full': { bg: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30' },
};

const getStatusStyle = (status: string) => {
    const key = (status || '').toLowerCase();
    return STATUS_COLORS[key] || { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' };
};

const STATUS_ACCENT: Record<string, string> = {
    'retenido': '#EF4444',
    'pendiente expo': '#FFB020',
    'recibido en oficina': '#10B981',
    'retirado': '#10B981',
    'despachado': '#A855F7',
    'mercado libre full': '#EAB308',
};

export function MobileShipmentCard({ s, clients, handleInlineUpdate, statusOptions, deleteShipments, onReceiveShipment, userRole, isDepotView }: MobileShipmentCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [pending, setPendingState] = useState<Record<string, any>>({});
    const hasPending = Object.keys(pending).length > 0;

    const setPending = (field: string, value: any) => {
        setPendingState(prev => ({ ...prev, [field]: value }));
    };
    const getValue = (field: string, fallback: any) => field in pending ? pending[field] : fallback;

    const commitAll = useCallback(() => {
        for (const [field, value] of Object.entries(pending)) {
            if (field === '_client_select') {
                const matched = clients.find(c => c.name === value);
                if (matched) {
                    handleInlineUpdate(s.id, 'client_name', matched.name);
                    handleInlineUpdate(s.id, 'client_code', matched.code);
                    handleInlineUpdate(s.id, 'client_id', matched.id);
                }
            } else if (field === '_status_import') {
                if (value === 'Recibido en Oficina') {
                    onReceiveShipment(s);
                } else {
                    handleInlineUpdate(s.id, 'internal_status', value);
                }
            } else if (field === '_status_depot') {
                handleInlineUpdate(s.id, 'internal_status', value);
            } else {
                handleInlineUpdate(s.id, field as keyof Shipment, value);
            }
        }
        setPendingState({});
        toast.success('Cambios guardados');
    }, [pending, s, clients, handleInlineUpdate, onReceiveShipment]);

    const discardAll = useCallback(() => setPendingState({}), []);

    const statusKey = (s.internal_status || '').toLowerCase();
    const accentColor = STATUS_ACCENT[statusKey] || '#2E7BFF';
    const statusStyle = getStatusStyle(s.internal_status);
    const totalCotizado = (Number(s.precio_envio) || 0) + (Number(s.gastos_documentales) || 0) + (Number(s.impuestos) || 0);

    return (
        <div
            className="relative rounded-2xl border overflow-hidden transition-all"
            style={{
                borderColor: 'var(--card-border)',
                background: 'var(--card-bg)',
                borderLeftWidth: '4px',
                borderLeftColor: hasPending ? '#FFB020' : accentColor,
            }}
        >
            {/* ── COMPACT VIEW (always visible) ── */}
            <div className="p-4 space-y-2.5" onClick={() => setExpanded(!expanded)}>
                {/* Row 1: Status + Tracking copy */}
                <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        {s.internal_status || 'Sin status'}
                    </span>
                    <button
                        className="p-2 -m-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(s.tracking_number || '');
                            toast.success('Tracking copiado');
                        }}
                    >
                        <Copy size={14} className="text-slate-400" />
                    </button>
                </div>

                {/* Row 2: Client + Code */}
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate flex-1">
                        {s.client_name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md shrink-0">
                        {s.client_code}
                    </span>
                </div>

                {/* Row 3: Tracking */}
                <p className="font-mono text-xs font-semibold text-emerald-500 tracking-wider">
                    {s.tracking_number || '—'}
                </p>

                {/* Row 4: Meta chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {s.origin && (
                        <span className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            <MapPin size={10} /> {s.origin}
                        </span>
                    )}
                    {s.category && (
                        <span className="bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md uppercase">
                            {s.category}
                        </span>
                    )}
                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                        <Scale size={10} /> {Number(s.weight || 0).toFixed(1)}kg
                    </span>
                    {s.boxes_count && Number(s.boxes_count) > 0 && (
                        <span className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            <Package size={10} /> {s.boxes_count}
                        </span>
                    )}
                </div>

                {/* Row 5: Cotizado + Fecha */}
                <div className="flex items-center justify-between pt-1">
                    <span className={`text-sm font-black ${totalCotizado > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        USD {totalCotizado.toFixed(2)}
                    </span>
                    {s.date_shipped && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                            <Calendar size={11} /> {s.date_shipped}
                        </span>
                    )}
                </div>

                {/* Expand chevron */}
                <div className="flex justify-center pt-1">
                    <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </div>

            {/* ── EXPANDED EDIT SECTION ── */}
            {expanded && (
                <div className="border-t px-4 pb-4 pt-3 space-y-3" style={{ borderColor: 'var(--card-border)' }}>
                    {/* Client select */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cliente</label>
                        <select
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none"
                            value={(getValue('_client_select', s.client_name) as string) || ''}
                            onChange={(e) => setPending('_client_select', e.target.value)}
                        >
                            <option value={s.client_name}>{s.client_name}</option>
                            {clients.map(c => (
                                c.name.toUpperCase() !== s.client_name?.toUpperCase() && (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                )
                            ))}
                        </select>
                    </div>

                    {/* Tracking */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tracking</label>
                        <input
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-none uppercase"
                            value={(getValue('tracking_number', s.tracking_number) as string) || ''}
                            onChange={(e) => setPending('tracking_number', e.target.value.toUpperCase())}
                        />
                    </div>

                    {/* Status */}
                    {!isDepotView && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none"
                                value={(getValue('_status_import', s.internal_status) as string)}
                                onChange={(e) => setPending('_status_import', e.target.value)}
                            >
                                {statusOptions.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                            </select>
                        </div>
                    )}

                    {/* 2-col: Weight + Boxes */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Peso (KG)</label>
                            <input
                                type="number"
                                step="0.1"
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none"
                                value={getValue('weight', s.weight) ?? ''}
                                onChange={(e) => setPending('weight', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bultos</label>
                            <input
                                type="number"
                                min="1"
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none"
                                value={getValue('boxes_count', s.boxes_count) ?? ''}
                                onChange={(e) => setPending('boxes_count', parseInt(e.target.value) || 1)}
                            />
                        </div>
                    </div>

                    {/* 2-col: Origin + Category */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Origen</label>
                            <select
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none"
                                value={(getValue('origin', s.origin) as string) || 'CHINA'}
                                onChange={(e) => setPending('origin', e.target.value)}
                            >
                                <option value="CHINA">CHINA</option>
                                <option value="USA">USA</option>
                                <option value="PAKISTAN">PAKISTAN</option>
                                <option value="ESPAÑA">ESPAÑA</option>
                                <option value="REINO UNIDO">REINO UNIDO</option>
                                <option value="ALEMANIA">ALEMANIA</option>
                            </select>
                        </div>
                        {!isDepotView && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categoría</label>
                                <input
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none uppercase"
                                    value={(getValue('category', s.category) as string) || ''}
                                    onChange={(e) => setPending('category', e.target.value.toUpperCase())}
                                />
                            </div>
                        )}
                    </div>

                    {/* Date */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha de Salida</label>
                        <input
                            type="date"
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none"
                            value={(getValue('date_shipped', s.date_shipped) as string) || ''}
                            onChange={(e) => setPending('date_shipped', e.target.value)}
                        />
                    </div>

                    {/* Action buttons */}
                    {hasPending && (
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={commitAll}
                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                            >
                                <Save size={16} /> GUARDAR
                            </button>
                            <button
                                onClick={discardAll}
                                className="flex-1 flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-500 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                            >
                                <X size={16} /> DESCARTAR
                            </button>
                        </div>
                    )}

                    {/* Delete */}
                    {!hasPending && (
                        <button
                            onClick={() => {
                                if (confirm('¿Seguro que querés eliminar este envío?')) {
                                    deleteShipments([s.id]);
                                }
                            }}
                            className="w-full text-center text-xs font-bold text-red-500 hover:text-red-400 py-2 transition-colors"
                        >
                            Eliminar envío
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
