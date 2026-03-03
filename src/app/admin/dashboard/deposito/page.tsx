'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import { Package, Search, Truck, CheckCircle2, Clock, Archive, Plane, AlertTriangle, Zap, Scale, X, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { ReceiveShipmentModal } from '@/components/ReceiveShipmentModal';
import { QuickReceiveScreen } from '@/components/QuickReceiveScreen';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { Shipment } from '@/types';

type DepotTab = 'transit' | 'ready' | 'delivered';

// ── Config ──
const ANOMALY_PCT_THRESHOLD = 5; // percent
const ANOMALY_KG_THRESHOLD = 2; // kg
const STALE_DAYS_THRESHOLD = 5; // days in depot before alert

export default function DepositoPage() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<DepotTab>('transit');
    const [shipmentToReceive, setShipmentToReceive] = useState<Shipment | null>(null);
    const [quickReceiveMode, setQuickReceiveMode] = useState(false);
    const [filterStale, setFilterStale] = useState(false);

    // Transit = everything NOT yet at depot (still flying/shipping)
    const transitStatuses = ['Guía Creada', 'Pendiente Expo', 'En Transito'];

    // At depot = received, waiting for payment or dispatch
    const atDepotStatuses = ['Recibido en Oficina', 'Enviado BUE', 'Cerrado/Facturado', 'Listo Para Entregar'];

    // Already left the depot
    const deliveredStatuses = ['Entregado', 'Retirado', 'Despachado', 'Mercado Libre full'];

    useEffect(() => {
        fetchAllShipments();
    }, []);

    const fetchAllShipments = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shipments')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setShipments((data as Shipment[]) || []);
        } catch (error: any) {
            console.error('Error fetching shipments for depot:', error);
            toast.error('Error al cargar envíos para depósito');
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Realtime sync ──
    useRealtimeRefresh('shipments', fetchAllShipments);

    // ── Actions ──
    const handleDispatch = async (id: string, newStatus: 'Retirado' | 'Despachado' | 'Mercado Libre full' = 'Retirado') => {
        const target = shipments.find(s => s.id === id);
        if (target?.reception_status === 'PARTIAL') {
            toast.error('⚠️ Recepción parcial — completá la recepción antes de despachar');
            return;
        }

        const originalStatus = target?.internal_status;

        setShipments(prev => prev.map(s =>
            s.id === id ? { ...s, internal_status: newStatus } : s
        ));

        try {
            const updateFields: Record<string, any> = {
                internal_status: newStatus,
                date_dispatched: new Date().toISOString().slice(0, 10),
            };

            let result = await secureShipmentUpdate(id, updateFields);

            if (!result.success && result.error?.includes('date_dispatched')) {
                console.warn('Retrying without date_dispatched:', result.error);
                result = await secureShipmentUpdate(id, { internal_status: newStatus });
            }

            if (!result.success) throw new Error(result.error);

            const labels: Record<string, string> = {
                'Retirado': '🚚 Paquete marcado como Retirado',
                'Despachado': '📦 Paquete despachado',
                'Mercado Libre full': '🟡 Enviado a ML/Full',
            };
            toast.success(labels[newStatus] || 'Estado actualizado');
        } catch (error: any) {
            if (originalStatus) {
                setShipments(prev => prev.map(s =>
                    s.id === id ? { ...s, internal_status: originalStatus } : s
                ));
            }
            console.error('Dispatch error:', error);
            const msg = error?.message || error?.details || 'Error desconocido';
            toast.error(`Error al actualizar estado: ${msg}`);
        }
    };

    const handleUpdateDateArrived = async (id: string, date: string) => {
        const original = shipments.find(s => s.id === id);
        const originalDate = original?.date_arrived;

        setShipments(prev => prev.map(s => s.id === id ? { ...s, date_arrived: date } : s));

        try {
            const result = await secureShipmentUpdate(id, { date_arrived: date });

            if (!result.success) throw new Error(result.error);
        } catch (error: any) {
            setShipments(prev => prev.map(s =>
                s.id === id ? { ...s, date_arrived: originalDate ?? null } : s
            ));
            toast.error('Error al actualizar fecha');
        }
    };

    // ── Filter logic ──
    const getTabShipments = useCallback((tab: DepotTab) => {
        const statusGroup = tab === 'transit' ? transitStatuses
            : tab === 'ready' ? atDepotStatuses
                : deliveredStatuses;

        return shipments.filter(s => {
            const matchesStatus = statusGroup.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase());
            const matchesSearch =
                (s.tracking_number?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (s.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [shipments, searchTerm]);

    const transitShipments = useMemo(() => getTabShipments('transit'), [getTabShipments]);
    const readyShipments = useMemo(() => getTabShipments('ready'), [getTabShipments]);
    const deliveredShipments = useMemo(() => getTabShipments('delivered'), [getTabShipments]);

    const currentShipments = activeTab === 'transit' ? transitShipments
        : activeTab === 'ready' ? readyShipments
            : deliveredShipments;

    // ── Operational Metrics (derived from existing fields) ──
    const todayStr = new Date().toISOString().slice(0, 10);

    // Receptions today = shipments with date_arrived = today that are in atDepot or delivered
    const receivedToday = useMemo(() =>
        shipments.filter(s =>
            s.date_arrived === todayStr &&
            (atDepotStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase()) ||
                deliveredStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase()))
        )
        , [shipments, todayStr]);

    const receptionsTodayCount = receivedToday.length;

    const kgReceivedToday = useMemo(() =>
        receivedToday.reduce((sum, s) => sum + (s.weight || 0), 0)
        , [receivedToday]);

    const anomaliesToday = useMemo(() =>
        receivedToday.filter(s => s.delta_kg != null && (Math.abs(s.delta_kg) > ANOMALY_KG_THRESHOLD || (s.weight > 0 && Math.abs(s.delta_kg / s.weight) * 100 > ANOMALY_PCT_THRESHOLD))).length
        , [receivedToday]);

    // ── Stale shipment detection ──
    const staleShipments = useMemo(() => {
        const now = new Date();
        return readyShipments.filter(s => {
            const arrived = s.date_arrived || s.updated_at;
            if (!arrived) return false;
            return differenceInDays(now, new Date(arrived)) > STALE_DAYS_THRESHOLD;
        });
    }, [readyShipments]);

    // ── Days in depot for a shipment ──
    const daysInDepot = useCallback((s: Shipment) => {
        const arrived = s.date_arrived || s.updated_at;
        if (!arrived) return 0;
        return differenceInDays(new Date(), new Date(arrived));
    }, []);

    // ── Quick Receive Mode ──
    if (quickReceiveMode) {
        return (
            <QuickReceiveScreen
                shipments={shipments}
                onClose={() => setQuickReceiveMode(false)}
                onReceived={() => fetchAllShipments()}
            />
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-5">
            {/* ── 3: OPERATIONAL METRICS ROW ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="erp-card px-3.5 py-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Recepciones hoy</p>
                    <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{receptionsTodayCount}</p>
                </div>
                <div className="erp-card px-3.5 py-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Kg recibidos hoy</p>
                    <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{kgReceivedToday.toFixed(1)}</p>
                </div>
                <div className="erp-card px-3.5 py-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: anomaliesToday > 0 ? '#FFB020' : 'var(--text-muted)' }}>Diferencias hoy</p>
                    <p className="text-lg font-black" style={{ color: anomaliesToday > 0 ? '#FFB020' : 'var(--text-primary)' }}>{anomaliesToday}</p>
                </div>
                <div className="erp-card px-3.5 py-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>En depósito</p>
                    <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{readyShipments.length}</p>
                </div>
            </div>

            {/* ── 4: STALE SHIPMENT ALERT ── */}
            {staleShipments.length > 0 && (
                <button
                    onClick={() => {
                        setActiveTab('ready');
                        setFilterStale(prev => !prev);
                    }}
                    className="w-full erp-card px-4 py-3 flex items-center gap-3 text-left transition-all hover:opacity-80"
                    style={{ borderColor: 'rgba(255,176,32,0.2)' }}
                >
                    <AlertTriangle size={14} className="text-[#FFB020] shrink-0" />
                    <span className="text-xs font-bold" style={{ color: '#FFB020' }}>
                        ⚠ {staleShipments.length} envío{staleShipments.length > 1 ? 's' : ''} lleva{staleShipments.length > 1 ? 'n' : ''} más de {STALE_DAYS_THRESHOLD} días en depósito sin retiro
                    </span>
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        {filterStale ? 'Mostrando filtrados' : 'Click para filtrar'}
                    </span>
                </button>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Depósito</h1>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>Control físico de mercadería</p>
                </div>

                {/* KPI + Quick Receive */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* ── 1: QUICK RECEIVE BUTTON ── */}
                    <button
                        onClick={() => setQuickReceiveMode(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-white transition-all active:scale-95"
                        style={{ background: '#2E7BFF' }}
                    >
                        <Zap size={12} />
                        Modo Recepción
                    </button>

                    <div className="erp-card px-3 py-2 min-w-[80px]">
                        <p className="text-[8px] font-bold text-[#2E7BFF] uppercase tracking-wider">En Viaje</p>
                        <p className="text-sm font-black text-[#2E7BFF]">{transitShipments.length}</p>
                    </div>
                    <div className="erp-card px-3 py-2 min-w-[80px]" style={{ borderColor: 'rgba(255,176,32,0.15)' }}>
                        <p className="text-[8px] font-bold text-[#FFB020] uppercase tracking-wider">Depósito</p>
                        <p className="text-sm font-black text-[#FFB020]">{readyShipments.length}</p>
                    </div>
                    <div className="erp-card px-3 py-2 min-w-[80px]">
                        <p className="text-[8px] font-bold text-[#10B981] uppercase tracking-wider">Retirados</p>
                        <p className="text-sm font-black text-[#10B981]">{deliveredShipments.length}</p>
                    </div>
                    {(() => {
                        const partialCount = shipments.filter(s => s.reception_status === 'PARTIAL').length;
                        return partialCount > 0 ? (
                            <div className="erp-card px-3 py-2 min-w-[80px]" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                                <p className="text-[8px] font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-1">
                                    <AlertTriangle size={8} /> Parciales
                                </p>
                                <p className="text-sm font-black text-[#EF4444]">{partialCount}</p>
                            </div>
                        ) : null;
                    })()}
                </div>
            </div>

            {/* Search + Tabs */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o número de guía..."
                        className="erp-input pl-10 text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-0.5 p-1 rounded-lg" style={{ background: 'var(--input-bg)' }}>
                    <button
                        onClick={() => { setActiveTab('transit'); setFilterStale(false); }}
                        className={`px-3 py-2 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'transit'
                            ? 'bg-[#2E7BFF] text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Plane size={12} />
                        En Viaje
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === 'transit' ? 'bg-white/20' : 'bg-white/[0.04]'}`}>{transitShipments.length}</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('ready'); setFilterStale(false); }}
                        className={`px-3 py-2 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'ready'
                            ? 'bg-[#FFB020] text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Package size={12} />
                        En Depósito
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === 'ready' ? 'bg-white/20' : 'bg-white/[0.04]'}`}>{readyShipments.length}</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('delivered'); setFilterStale(false); }}
                        className={`px-3 py-2 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'delivered'
                            ? 'bg-[#10B981] text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Archive size={12} />
                        Retirados
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === 'delivered' ? 'bg-white/20' : 'bg-white/[0.04]'}`}>{deliveredShipments.length}</span>
                    </button>
                </div>

                <button
                    onClick={fetchAllShipments}
                    className="erp-card p-2.5 flex items-center justify-center shrink-0 hover:opacity-70 transition-opacity"
                    title="Actualizar lista"
                >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            {activeTab === 'ready' ? (
                /* ── Split View for Depósito ── */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Left: Listo para retirar */}
                    {(() => {
                        const listoParaRetirar = (filterStale ? staleShipments : readyShipments).filter(s => s.estado_cobranza === 'Pagado');
                        return (
                            <div className="erp-card overflow-hidden flex flex-col" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
                                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={13} className="text-[#10B981]" />
                                        <h3 className="text-[9px] font-bold text-[#10B981] uppercase tracking-wider">Listo para Retirar</h3>
                                    </div>
                                    <span className="text-[9px] font-bold text-[#10B981] px-2 py-0.5 rounded-md" style={{ background: 'rgba(16,185,129,0.08)' }}>{listoParaRetirar.length}</span>
                                </div>
                                <div className="overflow-x-auto flex-1">
                                    <table className="erp-table">
                                        <thead>
                                            <tr>
                                                <th>Cliente</th>
                                                <th>Guía</th>
                                                <th className="text-center">Días</th>
                                                <th className="text-center">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {listoParaRetirar.length === 0 ? (
                                                <tr><td colSpan={4} className="px-4 py-10 text-center text-xs font-bold" style={{ color: 'var(--text-muted)' }}>No hay envíos listos para retirar</td></tr>
                                            ) : (
                                                listoParaRetirar.map(s => {
                                                    const days = daysInDepot(s);
                                                    return (
                                                        <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-4 py-2.5">
                                                                <span className="font-bold text-xs truncate max-w-[140px] block" style={{ color: 'var(--text-primary)' }}>{s.client_name}</span>
                                                            </td>
                                                            <td className="px-4 py-2.5"><span className="font-mono text-[10px] font-bold text-[#10B981] uppercase">{s.tracking_number}</span></td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className={`text-[10px] font-bold ${days > STALE_DAYS_THRESHOLD ? 'text-[#FFB020]' : ''}`} style={days <= STALE_DAYS_THRESHOLD ? { color: 'var(--text-muted)' } : undefined}>
                                                                    {days}d
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                {s.reception_status === 'PARTIAL' ? (
                                                                    <div className="flex flex-col gap-1 items-center">
                                                                        <span className="text-[8px] font-bold uppercase tracking-wider text-[#FFB020] px-2 py-1 rounded-md flex items-center gap-1" style={{ background: 'rgba(255,176,32,0.08)' }}>
                                                                            <AlertTriangle size={8} /> Parcial
                                                                        </span>
                                                                        <button onClick={() => setShipmentToReceive(s)} className="text-[8px] font-bold uppercase text-[#2E7BFF] px-2 py-1 rounded-md hover:bg-[#2E7BFF]/10 transition-all">Completar</button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <button onClick={() => handleDispatch(s.id, 'Retirado')} className="text-[8px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md text-white transition-all active:scale-95 mx-auto" style={{ background: '#10B981' }}>
                                                                            Retirado
                                                                        </button>
                                                                        <div className="flex gap-0.5 justify-center">
                                                                            <button onClick={() => handleDispatch(s.id, 'Despachado')} className="text-[7px] font-bold uppercase px-1.5 py-1 rounded text-purple-400 hover:bg-purple-500/10 transition-all">Desp.</button>
                                                                            <button onClick={() => handleDispatch(s.id, 'Mercado Libre full')} className="text-[7px] font-bold uppercase px-1.5 py-1 rounded text-yellow-500 hover:bg-yellow-500/10 transition-all">ML</button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Right: Pendiente de cobro */}
                    {(() => {
                        const pendienteCobro = (filterStale ? staleShipments : readyShipments).filter(s => s.estado_cobranza !== 'Pagado');
                        return (
                            <div className="erp-card overflow-hidden flex flex-col" style={{ borderColor: 'rgba(239,68,68,0.12)' }}>
                                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <div className="flex items-center gap-2">
                                        <Clock size={13} className="text-[#EF4444]" />
                                        <h3 className="text-[9px] font-bold text-[#EF4444] uppercase tracking-wider">Pendiente de Cobro</h3>
                                    </div>
                                    <span className="text-[9px] font-bold text-[#EF4444] px-2 py-0.5 rounded-md" style={{ background: 'rgba(239,68,68,0.08)' }}>{pendienteCobro.length}</span>
                                </div>
                                <div className="overflow-x-auto flex-1">
                                    <table className="erp-table">
                                        <thead>
                                            <tr>
                                                <th>Cliente</th>
                                                <th>Guía</th>
                                                <th className="text-center">Días</th>
                                                <th className="text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pendienteCobro.length === 0 ? (
                                                <tr><td colSpan={4} className="px-4 py-10 text-center text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Todos los envíos están pagados 🎉</td></tr>
                                            ) : (
                                                pendienteCobro.map(s => {
                                                    const days = daysInDepot(s);
                                                    return (
                                                        <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-4 py-2.5"><span className="font-bold text-xs truncate max-w-[140px] block" style={{ color: 'var(--text-primary)' }}>{s.client_name}</span></td>
                                                            <td className="px-4 py-2.5"><span className="font-mono text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>{s.tracking_number}</span></td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className={`text-[10px] font-bold ${days > STALE_DAYS_THRESHOLD ? 'text-[#FFB020]' : ''}`} style={days <= STALE_DAYS_THRESHOLD ? { color: 'var(--text-muted)' } : undefined}>
                                                                    {days}d
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className="text-[8px] font-bold uppercase tracking-wider text-[#EF4444] px-2 py-1 rounded-md flex items-center gap-1 justify-center mx-auto w-fit" style={{ background: 'rgba(239,68,68,0.06)' }}>
                                                                    <Clock size={8} /> Sin Pagar
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            ) : (
                /* ── 5: REORDERED TABLE for Transit & Delivered ── */
                <div className="erp-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="erp-table">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Estado</th>
                                    {activeTab === 'delivered' && <th className="text-center">Días en depósito</th>}
                                    <th className="text-right">Peso (kg)</th>
                                    <th>Guía</th>
                                    <th>F. Llegada</th>
                                    <th className="text-center w-40">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-16 text-center">
                                            <div className="w-6 h-6 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
                                        </td>
                                    </tr>
                                ) : currentShipments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-16 text-center text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                                            {activeTab === 'transit' && 'No hay envíos en tránsito actualmente.'}
                                            {activeTab === 'delivered' && 'No hay envíos retirados registrados.'}
                                        </td>
                                    </tr>
                                ) : (
                                    currentShipments.map((s) => {
                                        const days = daysInDepot(s);
                                        return (
                                            <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group">
                                                {/* Client — DOMINANT */}
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-xs truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>{s.client_name}</p>
                                                </td>
                                                {/* Status — HIGH WEIGHT */}
                                                <td className="px-4 py-3">
                                                    <span className={`text-[9px] font-bold tracking-wider uppercase px-2.5 py-1.5 rounded-md inline-block
                                                        ${s.internal_status === 'En Transito'
                                                            ? 'text-[#2E7BFF]'
                                                            : s.internal_status === 'Pendiente Expo'
                                                                ? 'text-[#FFB020]'
                                                                : s.internal_status === 'Retirado' || s.internal_status === 'Despachado'
                                                                    ? 'text-[#10B981]'
                                                                    : ''
                                                        }`}
                                                        style={{
                                                            background: s.internal_status === 'En Transito' ? 'rgba(46,123,255,0.06)'
                                                                : s.internal_status === 'Pendiente Expo' ? 'rgba(255,176,32,0.06)'
                                                                    : s.internal_status === 'Retirado' || s.internal_status === 'Despachado' ? 'rgba(16,185,129,0.06)'
                                                                        : 'rgba(255,255,255,0.03)',
                                                            color: s.internal_status === 'En Transito' ? '#2E7BFF'
                                                                : s.internal_status === 'Pendiente Expo' ? '#FFB020'
                                                                    : s.internal_status === 'Retirado' || s.internal_status === 'Despachado' ? '#10B981'
                                                                        : 'var(--text-muted)',
                                                        }}
                                                    >
                                                        {s.internal_status}
                                                    </span>
                                                    {s.edited_post_delivery && (
                                                        <span className="block text-[8px] font-bold text-[#EF4444] mt-0.5">⚠ Editado post-entrega</span>
                                                    )}
                                                </td>
                                                {/* Days in depot — only for delivered */}
                                                {activeTab === 'delivered' && (
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`text-[10px] font-bold ${days > STALE_DAYS_THRESHOLD ? 'text-[#FFB020]' : ''}`} style={days <= STALE_DAYS_THRESHOLD ? { color: 'var(--text-muted)' } : undefined}>
                                                            {days}d
                                                        </span>
                                                    </td>
                                                )}
                                                {/* Weight */}
                                                <td className="px-4 py-3 text-right">
                                                    <span className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                                                        {Number(s.weight || 0).toFixed(1)}
                                                    </span>
                                                </td>
                                                {/* Tracking */}
                                                <td className="px-4 py-3">
                                                    <p className="font-mono text-[10px] font-bold text-[#10B981] tracking-wider uppercase">{s.tracking_number}</p>
                                                </td>
                                                {/* Date */}
                                                <td className="px-4 py-3">
                                                    {activeTab === 'transit' ? (
                                                        <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>—</span>
                                                    ) : (
                                                        <input
                                                            type="date"
                                                            className="bg-transparent border-none text-[10px] font-bold outline-none cursor-pointer hover:text-[#2E7BFF] transition-colors"
                                                            style={{ color: 'var(--text-muted)' }}
                                                            value={s.date_arrived || ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => handleUpdateDateArrived(s.id, e.target.value)}
                                                        />
                                                    )}
                                                </td>
                                                {/* Action — MINIMAL */}
                                                <td className="px-4 py-3 text-center">
                                                    {activeTab === 'transit' && (
                                                        <button
                                                            onClick={() => setShipmentToReceive(s)}
                                                            className="text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md text-white transition-all active:scale-95 flex items-center gap-1.5 mx-auto"
                                                            style={{ background: '#2E7BFF' }}
                                                        >
                                                            <Package size={11} />
                                                            Recepcionar
                                                        </button>
                                                    )}
                                                    {activeTab === 'delivered' && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#10B981] flex items-center gap-1 justify-center">
                                                            <CheckCircle2 size={11} />
                                                            Entregado
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Modal de Recepción (Calculadora Volumétrica) ── */}
            <ReceiveShipmentModal
                isOpen={!!shipmentToReceive}
                onClose={() => setShipmentToReceive(null)}
                shipment={shipmentToReceive}
                onSuccess={() => {
                    setShipmentToReceive(null);
                    fetchAllShipments();
                }}
            />
        </div>
    );
}
