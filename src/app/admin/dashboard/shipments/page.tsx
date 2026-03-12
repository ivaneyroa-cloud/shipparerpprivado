"use client";

import React, { useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import { toast } from 'sonner';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { format } from 'date-fns';

import { useExcelImport } from '@/hooks/useExcelImport';
import { useAudioFeedback } from '@/hooks/useAudioFeedback';
import { useShipmentFilters } from '@/hooks/useShipmentFilters';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

import { AddShipmentModal } from '@/components/AddShipmentModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ShipmentsHeader } from '@/components/ShipmentsHeader';
import { ShipmentsToolbar } from '@/components/ShipmentsToolbar';
import { ShipmentsTable } from '@/components/ShipmentsTable';

import { useShipmentStore } from '@/store/useShipmentStore';
import { Client, Shipment, UserProfile } from '@/types';
import { isPossiblyTruncated } from '@/lib/pagination';
import { exportShipmentsToExcel } from '@/lib/export-excel';

// ─────────────────────────────────────────────
// Pure Orchestrator — no JSX table, no 30 useState
// ─────────────────────────────────────────────

export default function ShipmentsPage() {
    // ── Zustand (global visual state) ──
    const {
        shipments, setShipments, loading, setLoading,
        isTableExpanded, setIsTableExpanded,
        selectedIds, clearSelection,
        showAddModal, setShowAddModal,
        deleteModal, openDeleteModal, closeDeleteModal,
        showConfetti, triggerConfetti,
        resetVisibleCount,
    } = useShipmentStore();

    // ── Domain state (stays local — auth, month, clients) ──
    const [clients, setClients] = React.useState<Client[]>([]);
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [assignedClientIds, setAssignedClientIds] = React.useState<string[] | null | undefined>(undefined);
    const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), 'yyyy-MM'));
    const [shipmentViewTab, setShipmentViewTab] = React.useState<'transit' | 'received' | 'retenidos'>('transit');

    // ── Hooks ──
    const { playSuccess, playPop } = useAudioFeedback();
    const { uploadingCsv, handleFileUpload } = useExcelImport(() => refreshShipments());
    const [windowSize, setWindowSize] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }, []);

    const searchParams = useSearchParams();
    const initialStatusFilter = searchParams.get('status') || undefined;

    // Auto-switch tab based on ?status= param
    React.useEffect(() => {
        if (!initialStatusFilter) return;
        const s = initialStatusFilter.toLowerCase();
        if (s === 'retenido') {
            setShipmentViewTab('retenidos');
        } else if (receivedStatuses.some(st => st.toLowerCase() === s)) {
            setShipmentViewTab('received');
        } else {
            setShipmentViewTab('transit');
        }
    }, [initialStatusFilter]);

    const filterHook = useShipmentFilters(shipments, initialStatusFilter);
    const { filteredShipments, hasActiveFilters, clearFilters } = filterHook;

    // Reset visible count when filters change
    useEffect(() => { resetVisibleCount(); }, [
        filterHook.searchTerm, filterHook.selectedStatuses, filterHook.selectedFinalStatuses,
        filterHook.selectedCategories, filterHook.selectedOrigins, filterHook.selectedClients,
        filterHook.selectedCodes, filterHook.dateShippedFrom, filterHook.dateShippedTo,
        filterHook.dateArrivedFrom, filterHook.dateArrivedTo, resetVisibleCount
    ]);

    // ── Gamification ──
    const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
    const todayCount = useMemo(() => shipments.filter((s) => s.created_at?.startsWith(todayStr)).length, [shipments, todayStr]);
    const dailyGoal = 50;
    const progressPercent = useMemo(() => Math.min((todayCount / dailyGoal) * 100, 100), [todayCount]);

    const statusOptions = ['Guía Creada', 'Pendiente Expo', 'En Transito'];

    // Statuses for the two tab views
    const transitStatuses = ['Guía Creada', 'Pendiente Expo', 'En Transito'];
    const receivedStatuses = ['Recibido en Oficina', 'Enviado BUE', 'Cerrado/Facturado', 'Listo Para Entregar', 'Entregado', 'Retirado', 'Despachado', 'Mercado Libre full'];
    const retenidoStatuses = ['Retenido'];

    // ── Data fetching ──
    const SHIPMENT_COLUMNS = 'id, tracking_number, client_id, client_name, client_code, category, weight, internal_status, origin, date_shipped, date_arrived, created_at, updated_at, precio_envio, gastos_documentales, impuestos, observaciones_cotizacion, boxes_count, retenido_nota, quote_mode, quote_pdf_url';

    // Timeout wrapper for mobile resilience
    const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
        Promise.race([
            promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
        ]);

    const QUERY_TIMEOUT_MS = 15_000; // 15s timeout per query batch

    const fetchShipments = useCallback(async (clientIds: string[] | null) => {
        setLoading(true);
        try {
            // Base query builder helper
            const buildBase = () => {
                let q = supabase
                    .from('shipments')
                    .select(SHIPMENT_COLUMNS)
                    .order('created_at', { ascending: false });
                if (clientIds !== null && clientIds.length > 0) {
                    q = q.in('client_id', clientIds);
                }
                return q;
            };

            if (clientIds !== null && clientIds.length === 0) {
                setShipments([]);
                setLoading(false);
                return;
            }

            // ── Monthly tracking logic ──
            // Current month = show ALL unreceived (rolled forward) + received this month
            // Past month = show ONLY received in that month
            const currentMonth = format(new Date(), 'yyyy-MM');
            const isCurrentMonth = selectedMonth === currentMonth;

            const monthStart = `${selectedMonth}-01`;
            const monthEnd = format(
                new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0),
                'yyyy-MM-dd'
            );

            // Query 1: Shipments RECEIVED in the selected month (always needed)
            const receivedQuery = buildBase()
                .gte('date_arrived', monthStart)
                .lte('date_arrived', `${monthEnd}T23:59:59`);

            if (isCurrentMonth) {
                // Query 2: ALL unreceived shipments (they roll forward to current month)
                const unreceivedQuery = buildBase().is('date_arrived', null);

                // Query 3: Shipments CREATED in the selected month
                const createdQuery = buildBase()
                    .gte('created_at', `${monthStart}T00:00:00`)
                    .lte('created_at', `${monthEnd}T23:59:59`);

                const [receivedResult, unreceivedResult, createdResult] = await withTimeout(
                    Promise.all([receivedQuery, unreceivedQuery, createdQuery]),
                    QUERY_TIMEOUT_MS,
                    'Shipments fetch'
                );

                if (receivedResult.error) {
                    toast.error(`Error al cargar recepcionados: ${receivedResult.error.message}`);
                    return;
                }
                if (unreceivedResult.error) {
                    toast.error(`Error al cargar pendientes: ${unreceivedResult.error.message}`);
                    return;
                }

                // Merge & deduplicate all three sources
                const allMap = new Map<string, Shipment>();
                for (const s of (receivedResult.data || []) as Shipment[]) allMap.set(s.id, s);
                for (const s of (unreceivedResult.data || []) as Shipment[]) if (!allMap.has(s.id)) allMap.set(s.id, s);
                for (const s of (createdResult.data || []) as Shipment[]) if (!allMap.has(s.id)) allMap.set(s.id, s);
                const merged = Array.from(allMap.values());

                setShipments(merged);

                const totalFetched = (receivedResult.data?.length || 0) + (unreceivedResult.data?.length || 0) + (createdResult.data?.length || 0);
                if (isPossiblyTruncated(totalFetched)) {
                    toast.warning('⚠️ Se cargaron +1000 envíos. Puede haber datos no mostrados.', { duration: 6000 });
                }
            } else {
                // Past month: only shipments received in that month
                const result = await withTimeout(Promise.resolve(receivedQuery), QUERY_TIMEOUT_MS, 'Past month fetch');

                if (result.error) {
                    toast.error(`Error al cargar envíos: ${result.error.message}`);
                    return;
                }

                setShipments((result.data || []) as Shipment[]);

                if (isPossiblyTruncated((result.data || []).length)) {
                    toast.warning('⚠️ Se cargaron +1000 envíos. Acotá el rango para mejor precisión.', { duration: 6000 });
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error de red al cargar envíos.';
            toast.error(message.includes('timed out') ? '⏱️ La carga de envíos tardó demasiado. Intentá de nuevo.' : `Error de red: ${message}`);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, setLoading, setShipments]);

    // Safe wrapper — always passes the resolved auth context
    const refreshShipments = useCallback(() => {
        if (assignedClientIds === undefined) return;
        fetchShipments(assignedClientIds);
    }, [assignedClientIds, fetchShipments]);

    // ── Realtime sync ──
    useRealtimeRefresh('shipments', refreshShipments, assignedClientIds !== undefined);

    const fetchClients = useCallback(async (profile?: UserProfile) => {
        try {
            let query = supabase.from('clients').select('id, name, code, assigned_to, tarifa_aplicable, created_at').order('name');
            const currentProfile = profile || userProfile;
            if (currentProfile?.role === 'sales') {
                query = query.eq('assigned_to', currentProfile.id);
            }
            const { data, error } = await query;
            if (error) {
                toast.error(`Error al cargar clientes: ${error.message}`);
                return;
            }
            if (data) setClients(data);
        } catch (err) {
            toast.error('Error de red al cargar clientes.');
        }
    }, [userProfile]);

    // ── Init (auth + profile) ──
    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, role, org_id, is_active, full_name')
                    .eq('id', session.user.id)
                    .single();

                if (!profile) return;

                setUserProfile(profile);
                fetchClients(profile);

                if (profile.role === 'sales') {
                    const { data: myClients } = await supabase
                        .from('clients')
                        .select('id')
                        .eq('assigned_to', session.user.id);
                    const ids = myClients?.map((c) => c.id) || [];
                    setAssignedClientIds(ids);
                    fetchShipments(ids);
                } else {
                    setAssignedClientIds(null);
                    fetchShipments(null);
                }
            } catch (err) {
                toast.error('Error al inicializar la sesión.');
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (assignedClientIds === undefined) return;
        fetchShipments(assignedClientIds);
    }, [selectedMonth, assignedClientIds, fetchShipments]);

    // ── Handlers ──
    const handleAddSuccess = useCallback(() => {
        setShowAddModal(false);
        refreshShipments();
        triggerConfetti(4000);
        playSuccess();
        toast.success('¡Envío guardado con éxito!');
    }, [refreshShipments, setShowAddModal, triggerConfetti, playSuccess]);

    const handleInlineUpdate = useCallback(async (id: string, field: keyof Shipment, value: string | number | null) => {
        const { updateShipmentField, setEditingCell, shipments: currentShipments } = useShipmentStore.getState();

        // Snapshot for rollback
        const original = currentShipments.find(s => s.id === id);
        const originalValue = original ? original[field] : undefined;

        // Optimistic update
        updateShipmentField(id, field, value);

        if (field === 'internal_status' && (value === 'Retirado' || value === 'Recibido en Oficina')) {
            triggerConfetti(3000);
            playSuccess();
        } else {
            playPop();
        }

        const result = await secureShipmentUpdate(id, { [field]: value });

        if (!result.success) {
            // ROLLBACK — restore original value
            if (original && originalValue !== undefined) {
                updateShipmentField(id, field, originalValue as any);
            }
            toast.error(`Error al actualizar envío: ${result.error}`);
        } else {
            if (field === 'internal_status') {
                toast.success(`🎉 ¡Estado actualizado a ${value}!`);
            } else {
                toast.success('Dato actualizado');
            }
        }
        setEditingCell(null);
    }, [refreshShipments, playPop, playSuccess, triggerConfetti]);

    const deleteShipments = useCallback((ids: string[]) => {
        if (!ids.length) return;
        openDeleteModal(ids);
    }, [openDeleteModal]);

    const confirmDelete = useCallback(async () => {
        const ids = deleteModal.ids;
        if (!ids.length) return;

        setLoading(true);
        try {
            // Use soft-delete RPC (sets deleted_at = now()) instead of physical DELETE.
            // This matches the deleted_at IS NULL filter already used in all queries.
            const results = await Promise.all(
                ids.map(id => supabase.rpc('soft_delete_shipment', { p_id: id }))
            );
            const failed = results.filter(r => r.error);
            if (failed.length > 0) throw new Error(failed[0].error!.message);

            toast.success(`✅ ${ids.length === 1 ? 'Envío eliminado' : `${ids.length} envíos eliminados`} exitosamente.`);
            clearSelection();
            refreshShipments();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`Error al eliminar: ${message}`);
        } finally {
            setLoading(false);
            closeDeleteModal();
        }
    }, [deleteModal.ids, refreshShipments, setLoading, clearSelection, closeDeleteModal]);

    // ── Tab-filtered shipments ──
    const tabFilteredShipments = useMemo(() => {
        if (shipmentViewTab === 'retenidos') {
            return filteredShipments.filter(s => s.internal_status === 'Retenido');
        }
        const targetStatuses = shipmentViewTab === 'transit' ? transitStatuses : receivedStatuses;
        return filteredShipments.filter(s => targetStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase()));
    }, [filteredShipments, shipmentViewTab]);

    const transitCount = useMemo(() => filteredShipments.filter(s => transitStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase())).length, [filteredShipments]);
    const receivedCount = useMemo(() => filteredShipments.filter(s => receivedStatuses.some(st => st.toLowerCase() === (s.internal_status || '').toLowerCase())).length, [filteredShipments]);
    const retenidosCount = useMemo(() => filteredShipments.filter(s => s.internal_status === 'Retenido').length, [filteredShipments]);

    // ── Render ──
    return (
        <>
            {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} gravity={0.3} />}
            <div className={`erp-page-enter transition-all duration-300 ${isTableExpanded ? 'h-[calc(100vh-10rem)] flex flex-col' : 'space-y-4'}`}>

                {!isTableExpanded ? (
                    /* ═══ ZONE 1: Operation Header + Toolbar ═══ */
                    <div className="space-y-3">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <ShipmentsHeader
                                selectedMonth={selectedMonth}
                                setSelectedMonth={setSelectedMonth}
                                progressPercent={progressPercent}
                                todayCount={todayCount}
                                dailyGoal={dailyGoal}
                                totalShipments={filteredShipments.length}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <ShipmentsToolbar
                                isTableExpanded={isTableExpanded}
                                setIsTableExpanded={setIsTableExpanded}
                                hasActiveFilters={hasActiveFilters}
                                clearFilters={clearFilters}
                                selectedIdsSize={selectedIds.size}
                                deleteSelectedShipments={() => deleteShipments(Array.from(selectedIds))}
                                uploadingCsv={uploadingCsv}
                                handleFileUpload={handleFileUpload}
                                setShowAddModal={setShowAddModal}
                                onExportExcel={() => exportShipmentsToExcel(tabFilteredShipments)}
                            />
                        </div>
                    </div>
                ) : (
                    <ShipmentsToolbar
                        isTableExpanded={isTableExpanded}
                        setIsTableExpanded={setIsTableExpanded}
                        hasActiveFilters={hasActiveFilters}
                        clearFilters={clearFilters}
                        selectedIdsSize={selectedIds.size}
                        deleteSelectedShipments={() => deleteShipments(Array.from(selectedIds))}
                        uploadingCsv={uploadingCsv}
                        handleFileUpload={handleFileUpload}
                        setShowAddModal={setShowAddModal}
                        onExportExcel={() => exportShipmentsToExcel(tabFilteredShipments)}
                    />
                )}

                {/* ═══ ZONE 2: Status Segment Bar ═══ */}
                <div className="overflow-x-auto -mx-1 px-1 pb-1 hide-scrollbar">
                    <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
                        <button
                            onClick={() => { setShipmentViewTab('transit'); resetVisibleCount(); }}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${shipmentViewTab === 'transit'
                                ? 'bg-[#2E7BFF] text-white shadow-md shadow-[#2E7BFF]/25'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                                }`}
                        >
                            En Tránsito
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${shipmentViewTab === 'transit' ? 'bg-white/20 text-white' : 'bg-white/[0.06]'
                                }`}>{transitCount}</span>
                        </button>
                        <button
                            onClick={() => { setShipmentViewTab('received'); resetVisibleCount(); }}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${shipmentViewTab === 'received'
                                ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/25'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                                }`}
                        >
                            Recibidos
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${shipmentViewTab === 'received' ? 'bg-white/20 text-white' : 'bg-white/[0.06]'
                                }`}>{receivedCount}</span>
                        </button>
                        <button
                            onClick={() => { setShipmentViewTab('retenidos'); resetVisibleCount(); }}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${shipmentViewTab === 'retenidos'
                                ? 'bg-[#EF4444] text-white shadow-md shadow-[#EF4444]/25'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
                                } ${retenidosCount > 0 ? 'relative' : ''}`}
                        >
                            ⚠️ Retenidos
                            {retenidosCount > 0 && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${shipmentViewTab === 'retenidos' ? 'bg-white/20 text-white' : 'bg-[#EF4444]/15 text-[#F87171]'
                                    }`}>{retenidosCount}</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ═══ ZONE 3+4: Data Zone ═══ */}

                <ShipmentsTable
                    searchTerm={filterHook.searchTerm}
                    setSearchTerm={filterHook.setSearchTerm}
                    filteredShipments={tabFilteredShipments}
                    selectedStatuses={filterHook.selectedStatuses}
                    selectedFinalStatuses={filterHook.selectedFinalStatuses}
                    selectedCategories={filterHook.selectedCategories}
                    selectedOrigins={filterHook.selectedOrigins}
                    selectedClients={filterHook.selectedClients}
                    selectedCodes={filterHook.selectedCodes}
                    uniqueCategories={filterHook.uniqueCategories}
                    uniqueOrigins={filterHook.uniqueOrigins}
                    uniqueClients={filterHook.uniqueClients}
                    uniqueCodes={filterHook.uniqueCodes}
                    uniqueFinalStatuses={filterHook.uniqueFinalStatuses}
                    openFilterDropdown={filterHook.openFilterDropdown}
                    setOpenFilterDropdown={filterHook.setOpenFilterDropdown}
                    toggleFilter={filterHook.toggleFilter}
                    dateShippedFrom={filterHook.dateShippedFrom}
                    setDateShippedFrom={filterHook.setDateShippedFrom}
                    dateShippedTo={filterHook.dateShippedTo}
                    setDateShippedTo={filterHook.setDateShippedTo}
                    dateArrivedFrom={filterHook.dateArrivedFrom}
                    setDateArrivedFrom={filterHook.setDateArrivedFrom}
                    dateArrivedTo={filterHook.dateArrivedTo}
                    setDateArrivedTo={filterHook.setDateArrivedTo}
                    clients={clients}
                    statusOptions={statusOptions}
                    handleInlineUpdate={handleInlineUpdate}
                    deleteShipments={deleteShipments}
                    userRole={userProfile?.role}
                    isDepotView={shipmentViewTab === 'received'}
                />
            </div>

            <AddShipmentModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleAddSuccess}
                clients={clients}
            />
            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={closeDeleteModal}
                onConfirm={confirmDelete}
                title="Eliminar Envíos"
                message={`¿Estás seguro de que querés eliminar ${deleteModal.ids.length === 1 ? 'este envío' : `estos ${deleteModal.ids.length} envíos`}? Esta acción es irreversible y los datos no podrán recuperarse.`}
                confirmText="Eliminar Definitivamente"
                variant="danger"
            />
        </>
    );
}
