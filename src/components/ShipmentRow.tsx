import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Package, Truck, ChevronRight, FileEdit, Copy, AlertTriangle, X, Save, Clock, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Shipment, Client } from '@/types';

type PendingChanges = Record<string, string | number | null>;


interface ShipmentRowProps {
    s: Shipment;
    clients: Client[];
    selectedIds: Set<string>;
    toggleSelectOne: (e: React.MouseEvent, id: string) => void;
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    handleInlineUpdate: (id: string, field: keyof Shipment, value: string | number | null) => void;
    statusOptions: string[];
    deleteShipments: (ids: string[]) => void;
    setShipments: (shipments: Shipment[] | ((prev: Shipment[]) => Shipment[])) => void;
    onReceiveShipment: (s: Shipment) => void;
    userRole?: string;
    isDepotView?: boolean;
}

export const ShipmentRow = React.memo(function ShipmentRow({
    s,
    clients,
    selectedIds,
    toggleSelectOne,
    expandedId,
    setExpandedId,
    handleInlineUpdate,
    statusOptions,
    deleteShipments,
    setShipments,
    onReceiveShipment,
    userRole = '',
    isDepotView = false,
}: ShipmentRowProps) {
    const [isQuoteOpen, setIsQuoteOpen] = useState(false);
    const [retenidoModal, setRetenidoModal] = useState(false);
    const [retenidoNota, setRetenidoNota] = useState('');
    const [pendingRetenidoValue, setPendingRetenidoValue] = useState<string | null>(null);
    const [pendingChanges, setPendingChangesState] = useState<PendingChanges>({});
    const quoteRef = useRef<HTMLTableCellElement>(null);
    const quoteTriggerRef = useRef<HTMLDivElement>(null);
    const quotePopupRef = useRef<HTMLDivElement>(null);
    const [quotePos, setQuotePos] = useState<{ top: number; left: number; flipUp: boolean }>({ top: 0, left: 0, flipUp: false });

    // Recalculate popup position when opening
    useEffect(() => {
        if (isQuoteOpen && quoteTriggerRef.current) {
            const rect = quoteTriggerRef.current.getBoundingClientRect();
            const popupHeight = 380; // approximate height of the popup
            const spaceBelow = window.innerHeight - rect.bottom;
            const flipUp = spaceBelow < popupHeight && rect.top > popupHeight;
            setQuotePos({
                top: flipUp ? rect.top + window.scrollY - popupHeight - 4 : rect.bottom + window.scrollY + 4,
                left: Math.max(8, rect.right + window.scrollX - 288), // 288 = w-72 = 18rem
                flipUp,
            });
        }
    }, [isQuoteOpen]);

    // Close quote popup on scroll / resize so it doesn't float detached
    useEffect(() => {
        if (!isQuoteOpen) return;
        const close = () => setIsQuoteOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [isQuoteOpen]);

    // Close quote popup on outside click
    useEffect(() => {
        if (!isQuoteOpen) return;
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (
                quotePopupRef.current && !quotePopupRef.current.contains(target) &&
                quoteTriggerRef.current && !quoteTriggerRef.current.contains(target)
            ) {
                setIsQuoteOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isQuoteOpen]);

    // ── Pending changes helpers ──
    const setPending = useCallback((field: string, value: string | number | null) => {
        setPendingChangesState(prev => ({ ...prev, [field]: value }));
    }, []);

    const getValue = useCallback((field: string, original: any) => {
        return field in pendingChanges ? pendingChanges[field] : original;
    }, [pendingChanges]);

    const isFieldDirty = useCallback((field: string) => {
        return field in pendingChanges;
    }, [pendingChanges]);

    const hasPending = Object.keys(pendingChanges).length > 0;

    const commitAll = useCallback(() => {
        // Validate: tracking_number cannot be empty
        if ('tracking_number' in pendingChanges && !String(pendingChanges.tracking_number || '').trim()) {
            toast.error('El número de guía no puede estar vacío');
            return;
        }
        // Special case: client change needs multiple fields
        if ('_client_select' in pendingChanges) {
            const clientName = pendingChanges._client_select as string;
            const selectedClient = clients.find(c => c.name === clientName);
            if (selectedClient) {
                handleInlineUpdate(s.id, 'client_id', selectedClient.id);
                handleInlineUpdate(s.id, 'client_name', selectedClient.name);
                handleInlineUpdate(s.id, 'client_code', selectedClient.code);
            } else {
                handleInlineUpdate(s.id, 'client_name', clientName);
            }
        }
        // Special case: status with receive modal
        if ('_status_import' in pendingChanges) {
            const val = pendingChanges._status_import as string;
            if (val === 'Recibido en Oficina') {
                onReceiveShipment(s);
            } else {
                handleInlineUpdate(s.id, 'internal_status', val);
            }
        }
        // Special case: depot status
        if ('_status_depot' in pendingChanges) {
            handleInlineUpdate(s.id, 'internal_status', pendingChanges._status_depot as string);
        }
        // All other regular fields
        const skipFields = ['_client_select', '_status_import', '_status_depot'];
        for (const [field, value] of Object.entries(pendingChanges)) {
            if (skipFields.includes(field)) continue;
            handleInlineUpdate(s.id, field as keyof Shipment, value);
        }
        setPendingChangesState({});
        toast.success('Cambios guardados');
    }, [pendingChanges, s, clients, handleInlineUpdate, onReceiveShipment]);

    const discardAll = useCallback(() => {
        setPendingChangesState({});
    }, []);

    // DEPOT ONLY: admin + operator can set Retirado, Despachado, ML/FULL
    const canMarkDelivered = userRole === 'super_admin' || userRole === 'admin' || userRole === 'operator';
    // Logistics + admin can mark Retenido
    const canMarkRetenido = userRole === 'super_admin' || userRole === 'admin' || userRole === 'logistics';



    const totalCotizado = (Number(getValue('precio_envio', s.precio_envio)) || 0) + (Number(getValue('gastos_documentales', s.gastos_documentales)) || 0) + (Number(getValue('impuestos', s.impuestos)) || 0);

    const dirtyClass = (field: string) => isFieldDirty(field) ? 'ring-1 ring-[#FFB020]/40 bg-[#FFB020]/5' : '';

    // Status accent color for left stripe
    const statusAccent = (() => {
        const st = (s.internal_status || '').toLowerCase();
        if (st === 'retenido') return '#EF4444';
        if (st === 'pendiente expo') return '#FFB020';
        if (st.includes('recibido') || st === 'retirado' || st === 'despachado') return '#10B981';
        return '#2E7BFF'; // transit default
    })();

    return (
        <React.Fragment key={s.id}>
            <tr
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                className={`transition-all duration-200 cursor-pointer group relative 
                    ${isQuoteOpen ? 'z-50' : 'z-10'}
                    border-b border-[var(--card-border)]
                    hover:bg-[#2E7BFF]/[0.03]
                `}
                style={{
                    boxShadow: hasPending
                        ? `inset 4px 0 0 #FFB020`
                        : expandedId === s.id
                            ? `inset 4px 0 0 #2E7BFF`
                            : `inset 4px 0 0 ${statusAccent}`,
                    backgroundColor: expandedId === s.id ? 'rgba(46,123,255,0.04)' : undefined,
                }}
            >
                <td className="pl-5 pr-2 py-2.5" onClick={(e) => toggleSelectOne(e, s.id)}>
                    <div
                        className={`w-3.5 h-3.5 rounded border-[1.5px] transition-all flex items-center justify-center ${selectedIds.has(s.id) ? 'bg-[#2E7BFF] border-[#2E7BFF]' : 'border-slate-400/25 group-hover:border-[#2E7BFF]/40'}`}
                    >
                        {selectedIds.has(s.id) && <CheckCircle2 size={9} className="text-white" />}
                    </div>
                </td>
                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <select
                        className={`erp-select text-[11px] w-full bg-transparent border-none p-1.5 ${dirtyClass('_client_select')}`}
                        style={{ backgroundImage: 'none', padding: '0.375rem 0.5rem' }}
                        value={(getValue('_client_select', s.client_name) as string) || ''}
                        onChange={(e) => setPending('_client_select', e.target.value)}
                    >
                        <option value={s.client_name} style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>{s.client_name}</option>
                        {clients.map(c => (
                            c.name.toUpperCase() !== s.client_name?.toUpperCase() && (
                                <option key={c.id} value={c.name} style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }} className="truncate max-w-[200px]">{c.name}</option>
                            )
                        ))}
                    </select>
                </td>
                {/* Identity: Client code — lower visual weight */}
                <td className="px-2 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider p-1.5 w-full truncate block cursor-default" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                        {s.client_code || ''}
                    </span>
                </td>
                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 group/track">
                        <input
                            autoComplete="off"
                            spellCheck="false"
                            className={`bg-transparent border-none font-mono text-[11px] font-semibold text-[#10B981] tracking-wider outline-none w-full hover:bg-white/[0.03] p-1.5 rounded-lg transition-all focus:bg-white/[0.05] uppercase ${dirtyClass('tracking_number')}`}
                            value={(getValue('tracking_number', s.tracking_number) as string) || ''}
                            onChange={(e) => setPending('tracking_number', e.target.value.toUpperCase())}
                        />
                        <button
                            type="button"
                            className="opacity-0 group-hover/track:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-500 rounded"
                            title="Copiar Tracking"
                            onClick={() => {
                                navigator.clipboard.writeText(s.tracking_number || '');
                                toast.success('Número de tracking copiado');
                            }}
                        >
                            <Copy size={12} />
                        </button>
                    </div>
                </td>
                {!isDepotView && (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <select
                            className={`bg-transparent border-none p-1.5 text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer rounded-lg transition-all hover:bg-[#2E7BFF]/[0.05]
                        ${s.internal_status === 'Retirado' ? 'text-[#10B981]' :
                                    s.internal_status === 'Recibido en Oficina' ? 'text-[#2E7BFF]' :
                                        s.internal_status === 'Pendiente Expo' ? 'text-[#FFB020]' :
                                            'text-slate-500'}
                    `}
                            value={(getValue('_status_import', s.internal_status) as string)}
                            onChange={(e) => {
                                const newVal = e.target.value;
                                if (newVal === s.internal_status) return;
                                setPending('_status_import', newVal);
                            }}
                        >
                            {statusOptions.map(opt => <option key={opt} value={opt} style={{ background: 'var(--surface-elevated)', color: 'var(--text-primary)' }}>{opt.toUpperCase()}</option>)}
                        </select>
                    </td>
                )}
                <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="date"
                        className={`erp-date-input bg-transparent border-none text-[11px] w-full ${dirtyClass('date_shipped')}`}
                        style={{ padding: '0.25rem 0.375rem' }}
                        value={(getValue('date_shipped', s.date_shipped) as string) || ''}
                        onChange={(e) => setPending('date_shipped', e.target.value)}
                    />
                </td>
                {isDepotView && (
                    <td className="px-3 py-1.5">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-400 font-[Outfit]">
                            {s.date_arrived || '—'}
                        </span>
                    </td>
                )}
                {isDepotView && (
                    <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                        {canMarkDelivered ? (
                            /* ── DEPOT / ADMIN: full interactive select ── */
                            <select
                                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center w-full appearance-none outline-none cursor-pointer border transition-all hover:scale-[1.02]
                            ${s.internal_status === 'Retirado' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)]'
                                        : s.internal_status === 'Mercado Libre full' ? 'bg-[#fffbeb] border-[#fde047] text-[#a16207] dark:bg-[#ffe600]/10 dark:border-[#ffe600]/30 dark:text-[#ffe600] dark:shadow-[0_0_12px_-2px_rgba(255,230,0,0.3)]'
                                            : s.internal_status === 'Retenido' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400 dark:shadow-[0_0_12px_-2px_rgba(239,68,68,0.3)]'
                                                : s.internal_status === 'Despachado' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400 dark:shadow-[0_0_12px_-2px_rgba(168,85,247,0.3)]'
                                                    : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300'}
                        `}
                                value={(getValue('_status_depot', s.internal_status) as string)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === s.internal_status || val === 'SIN_RETIRAR') return;
                                    if (val === 'Retenido') {
                                        setPendingRetenidoValue(val);
                                        setRetenidoNota('');
                                        setRetenidoModal(true);
                                    } else {
                                        setPending('_status_depot', val);
                                    }
                                }}
                            >
                                <option value={s.internal_status} className="dark:bg-slate-900 dark:text-slate-400">{['Retirado', 'Despachado', 'Mercado Libre full', 'Retenido'].includes(s.internal_status) ? s.internal_status.toUpperCase() : '— SELECCIONAR —'}</option>
                                <option value="Retirado" className="dark:bg-slate-900 dark:text-emerald-400">RETIRADO</option>
                                <option value="Despachado" className="dark:bg-slate-900 dark:text-purple-400">DESPACHADO</option>
                                <option value="Mercado Libre full" className="dark:bg-slate-900 dark:text-[#ffe600]">ML / FULL</option>
                                <option value="Retenido" className="dark:bg-slate-900 dark:text-red-500">RETENIDO</option>
                            </select>
                        ) : (
                            /* ── LOGISTICS / OTHERS: status badge OR retener button ── */
                            <div className="flex items-center justify-center">
                                {['Retirado', 'Mercado Libre full', 'Retenido', 'Despachado'].includes(s.internal_status) ? (
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border whitespace-nowrap
                                    ${s.internal_status === 'Retirado' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                            : s.internal_status === 'Mercado Libre full' ? 'border-[#ffe600]/30 bg-[#ffe600]/10 text-[#ffe600]'
                                                : s.internal_status === 'Retenido' ? 'border-red-500/30 bg-red-500/10 text-red-400'
                                                    : 'border-purple-500/30 bg-purple-500/10 text-purple-400'}`}>
                                        {s.internal_status === 'Mercado Libre full' ? 'ML/FULL' : s.internal_status.toUpperCase()}
                                    </span>
                                ) : canMarkRetenido ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setPendingRetenidoValue('Retenido'); setRetenidoNota(''); setRetenidoModal(true); }}
                                        className="erp-badge erp-badge-red cursor-pointer hover:bg-[#EF4444]/20 transition-all text-[8px]"
                                    >
                                        RETENER
                                    </button>
                                ) : (
                                    <span className="text-[9px] font-bold text-slate-500">—</span>
                                )}
                            </div>
                        )}

                    </td>
                )}
                {!isDepotView && (
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                            className={`bg-transparent border-none text-[10px] font-medium outline-none w-full uppercase tracking-wider hover:bg-white/[0.03] p-1 rounded-lg transition-all focus:bg-white/[0.05] ${dirtyClass('category')}`}
                            style={{ color: 'var(--text-muted)', opacity: 0.7 }}
                            value={(getValue('category', s.category) as string) || ''}
                            onChange={(e) => setPending('category', e.target.value.toUpperCase())}
                        />
                    </td>
                )}
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <div
                        ref={quoteTriggerRef}
                        className="flex items-center justify-end cursor-pointer hover:bg-white/[0.03] p-1.5 rounded-lg transition-all group"
                        onClick={() => setIsQuoteOpen(!isQuoteOpen)}
                    >
                        <span className="text-[10px] mr-1" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>$</span>
                        <span className={`text-[11px] font-bold w-14 text-right transition-colors ${totalCotizado > 0 ? 'text-[#10B981]' : 'text-[#2E7BFF] opacity-60'}`}>
                            {totalCotizado > 0 ? totalCotizado.toFixed(2) : '0.00'}
                        </span>
                        <FileEdit size={12} className="ml-2 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="number"
                        step="0.1"
                        className={`bg-transparent border-none text-[11px] font-semibold outline-none w-full text-right hover:bg-white/[0.03] p-1 rounded-lg transition-all focus:bg-white/[0.05] ${dirtyClass('weight')}`}
                        style={{ color: 'var(--text-primary)' }}
                        value={getValue('weight', s.weight) ?? ''}
                        onChange={(e) => setPending('weight', parseFloat(e.target.value) || 0)}
                    />
                </td>
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <select
                        className={`bg-transparent border-none text-[10px] font-medium tracking-wider uppercase outline-none w-full cursor-pointer hover:bg-white/[0.03] p-1 rounded-lg transition-all focus:bg-white/[0.05] text-right appearance-none ${dirtyClass('origin')}`}
                        style={{ color: 'var(--text-muted)', opacity: 0.7 }}
                        value={(getValue('origin', s.origin) as string) || 'CHINA'}
                        onChange={(e) => setPending('origin', e.target.value)}
                    >
                        <option value="CHINA" className="dark:bg-slate-900 dark:text-white">CHINA</option>
                        <option value="USA" className="dark:bg-slate-900 dark:text-white">USA</option>
                        <option value="PAKISTAN" className="dark:bg-slate-900 dark:text-white">PAKISTAN</option>
                        <option value="ESPAÑA" className="dark:bg-slate-900 dark:text-white">ESPAÑA</option>
                        <option value="REINO UNIDO" className="dark:bg-slate-900 dark:text-white">REINO UNIDO</option>
                        <option value="ALEMANIA" className="dark:bg-slate-900 dark:text-white">ALEMANIA</option>
                    </select>
                </td>
                {/* Save/Cancel bar when there are pending changes */}
                {hasPending && (
                    <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                            <button onClick={commitAll} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all" title="Guardar cambios">
                                <Save size={12} />
                            </button>
                            <button onClick={discardAll} className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white transition-all" title="Descartar">
                                <X size={12} />
                            </button>
                        </div>
                    </td>
                )}
                {!hasPending && (
                    <td className="px-3 py-1.5 text-right">
                        <ChevronRight size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${expandedId === s.id ? 'rotate-90 text-blue-600 dark:text-blue-500' : ''}`} />
                    </td>
                )}
            </tr>

            {/* EXPANDABLE SECTION */}
            <AnimatePresence>
                {expandedId === s.id && (
                    <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-50/50 dark:bg-white/[0.01]"
                    >
                        <td colSpan={12} className="px-10 py-6" style={{ borderBottom: '1px solid var(--card-border)' }}>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-3">
                                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Detalles del Paquete</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-[#2E7BFF]/10 rounded-lg flex items-center justify-center text-[#2E7BFF]">
                                            <Package size={15} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase" style={{ color: 'var(--text-primary)' }}>{s.category}</p>
                                            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{s.weight} KG</p>
                                            {s.boxes_count && s.boxes_count > 0 && (
                                                <p className="text-[10px] font-bold text-[#2E7BFF]">📦 {s.boxes_count} {s.boxes_count === 1 ? 'caja' : 'cajas'}</p>
                                            )}
                                        </div>
                                    </div>
                                    {s.internal_status === 'Retenido' && s.retenido_nota && (
                                        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                            <AlertTriangle size={11} className="text-[#EF4444] mt-0.5 shrink-0" />
                                            <p className="text-[10px] font-medium text-[#EF4444]">{s.retenido_nota}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Logística</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400">
                                            <Truck size={15} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Origen: {s.origin || 'Miami'}</p>
                                            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Actualizado: {s.updated_at ? format(new Date(s.updated_at), 'dd/MM/yyyy HH:mm') : '-'}</p>
                                        </div>
                                    </div>
                                    {/* Time in current state */}
                                    {s.updated_at && (() => {
                                        const hoursInState = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / (1000 * 60 * 60));
                                        const days = Math.floor(hoursInState / 24);
                                        const label = days > 0 ? `${days}d ${hoursInState % 24}h` : `${hoursInState}h`;
                                        const isLong = days > 5;
                                        return (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Clock size={10} style={{ color: isLong ? '#FFB020' : 'var(--text-muted)' }} />
                                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: isLong ? '#FFB020' : 'var(--text-muted)' }}>
                                                    {label} en "{s.internal_status}"
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Diferencias & Historial</p>
                                    {/* Declared vs received */}
                                    {s.delta_kg != null && Math.abs(s.delta_kg) > 0.1 ? (
                                        <div className="flex items-center gap-2">
                                            <Scale size={11} style={{ color: Math.abs(s.delta_kg) > 1 ? '#EF4444' : '#FFB020' }} />
                                            <span className="text-[10px] font-bold" style={{ color: Math.abs(s.delta_kg) > 1 ? '#EF4444' : '#FFB020' }}>
                                                Δ {s.delta_kg > 0 ? '+' : ''}{s.delta_kg.toFixed(1)} kg
                                                {s.weight > 0 && ` (${((s.delta_kg / s.weight) * 100).toFixed(0)}%)`}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={11} className="text-[#10B981]" />
                                            <span className="text-[10px] font-bold text-[#10B981]">Sin diferencia de peso</span>
                                        </div>
                                    )}
                                    {/* Edit history */}
                                    {s.edit_count != null && s.edit_count > 0 && (
                                        <div className="flex items-center gap-2">
                                            <FileEdit size={10} style={{ color: '#FFB020' }} />
                                            <span className="text-[10px] font-bold" style={{ color: '#FFB020' }}>
                                                {s.edit_count} edición{s.edit_count > 1 ? 'es' : ''} post-confirmación
                                            </span>
                                        </div>
                                    )}
                                    {s.post_delivery_edit && (
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={10} className="text-[#EF4444]" />
                                            <span className="text-[10px] font-bold text-[#EF4444]">Editado post-entrega</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => {
                                            setExpandedId(null);
                                            toast.info('Modificá los datos directamente en la tabla.');
                                        }}
                                        className="erp-btn erp-btn-ghost text-[9px]"
                                    >
                                        EDITAR EN TABLA
                                    </button>
                                    <button
                                        onClick={() => deleteShipments([s.id])}
                                        className="erp-btn text-[9px]"
                                        style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}
                                    >
                                        ELIMINAR
                                    </button>
                                </div>
                            </div>
                        </td>
                    </motion.tr>
                )}
            </AnimatePresence>

            {/* Modals rendered via portal to avoid table DOM issues */}
            {
                typeof document !== 'undefined' && ReactDOM.createPortal(
                    <>
                        {/* Quote detail popup — rendered in portal to escape table overflow */}
                        <AnimatePresence>
                            {isQuoteOpen && (
                                <motion.div
                                    ref={quotePopupRef}
                                    initial={{ opacity: 0, y: quotePos.flipUp ? 10 : -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: quotePos.flipUp ? 10 : -10, scale: 0.95 }}
                                    style={{ position: 'absolute', top: quotePos.top, left: quotePos.left }}
                                    className="w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700 p-5 z-[9998] flex flex-col gap-4 font-[Outfit] cursor-default"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700/50 pb-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                                            <FileEdit size={14} className="text-blue-500" /> Detalle de Cotización
                                        </h4>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Envío ($):</label>
                                            <input
                                                type="number" step="0.01" min="0"
                                                className={`w-28 text-right bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none p-2 rounded-lg focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-white dark:hover:bg-slate-800 ${dirtyClass('precio_envio')}`}
                                                value={getValue('precio_envio', s.precio_envio) ?? ''}
                                                onChange={(e) => setPending('precio_envio', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">G. Doc. ($):</label>
                                            <input
                                                type="number" step="0.01" min="0"
                                                className={`w-28 text-right bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none p-2 rounded-lg focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-white dark:hover:bg-slate-800 ${dirtyClass('gastos_documentales')}`}
                                                value={getValue('gastos_documentales', s.gastos_documentales) ?? ''}
                                                onChange={(e) => setPending('gastos_documentales', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Impuestos ($):</label>
                                            <input
                                                type="number" step="0.01" min="0"
                                                className={`w-28 text-right bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none p-2 rounded-lg focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-white dark:hover:bg-slate-800 ${dirtyClass('impuestos')}`}
                                                value={getValue('impuestos', s.impuestos) ?? ''}
                                                onChange={(e) => setPending('impuestos', parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-1">
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Aclaraciones (Opcional):</label>
                                            <textarea
                                                rows={2}
                                                className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 outline-none p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/50 transition-all hover:bg-white dark:hover:bg-slate-800 resize-none ${dirtyClass('observaciones_cotizacion')}`}
                                                value={(getValue('observaciones_cotizacion', s.observaciones_cotizacion) as string) || ''}
                                                onChange={(e) => setPending('observaciones_cotizacion', e.target.value)}
                                                placeholder="Escribe alguna nota sobre esta cotización..."
                                            />
                                        </div>
                                        <div className="pt-2 flex justify-end">
                                            <button
                                                onClick={() => setIsQuoteOpen(false)}
                                                className="bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all"
                                            >
                                                Cerrar
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {/* Retenido modal */}
                        <AnimatePresence>
                            {retenidoModal && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                                    onClick={(e) => { e.stopPropagation(); setRetenidoModal(false); }}
                                >
                                    <motion.div
                                        initial={{ scale: 0.95, y: 10 }}
                                        animate={{ scale: 1, y: 0 }}
                                        exit={{ scale: 0.95 }}
                                        className="bg-[#1c1c1e] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                                                <AlertTriangle size={18} className="text-red-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-white">Marcar como Retenido</h3>
                                                <p className="text-xs text-slate-500">Explicá el motivo de la retención</p>
                                            </div>
                                            <button onClick={() => setRetenidoModal(false)} className="ml-auto p-1 hover:bg-white/10 rounded-lg">
                                                <X size={14} className="text-slate-400" />
                                            </button>
                                        </div>
                                        <textarea
                                            autoFocus
                                            rows={3}
                                            value={retenidoNota}
                                            onChange={e => setRetenidoNota(e.target.value)}
                                            placeholder="Ej: Esperando INAL, pago pendiente, falta documentación..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-red-500/50 resize-none mb-4"
                                        />
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setRetenidoModal(false)}
                                                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-xs font-bold"
                                            >Cancelar</button>
                                            <button
                                                onClick={() => {
                                                    if (!retenidoNota.trim()) {
                                                        toast.error('El motivo es obligatorio');
                                                        return;
                                                    }
                                                    handleInlineUpdate(s.id, 'internal_status', 'Retenido');
                                                    handleInlineUpdate(s.id, 'retenido_nota', retenidoNota.trim());
                                                    setRetenidoModal(false);
                                                    toast.warning(`⚠️ Envío retenido: ${retenidoNota.trim()}`);
                                                }}
                                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black"
                                            >Confirmar Retención</button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>,
                    document.body
                )
            }
        </React.Fragment >
    );
}, (prevProps, nextProps) => {
    // Only re-render if its exact ID is the expanded one (now or before) or if the whole selected state changed
    if (prevProps.expandedId === prevProps.s.id || nextProps.expandedId === nextProps.s.id) return false;
    if (prevProps.selectedIds.has(prevProps.s.id) !== nextProps.selectedIds.has(nextProps.s.id)) return false;
    if (prevProps.s !== nextProps.s) return false;
    return true;
});
