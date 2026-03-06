import React, { useRef, useState, useMemo } from 'react';
import { Search, Loader2, Filter, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ShipmentRow } from '@/components/ShipmentRow';
import { FilterDropdown } from '@/components/FilterDropdown';
import { DateFilterPopup } from '@/components/DateFilterPopup';
import { ReceiveShipmentModal } from '@/components/ReceiveShipmentModal';
import { useShipmentStore } from '@/store/useShipmentStore';
import { Shipment, Client } from '@/types';

interface ShipmentsTableProps {
    // Filter hook outputs (these come from useShipmentFilters which lives in page.tsx)
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    filteredShipments: Shipment[];
    // Filter dropdowns
    selectedStatuses: string[];
    selectedFinalStatuses: string[];
    selectedCategories: string[];
    selectedOrigins: string[];
    selectedClients: string[];
    selectedCodes: string[];
    uniqueCategories: string[];
    uniqueOrigins: string[];
    uniqueClients: string[];
    uniqueCodes: string[];
    uniqueFinalStatuses: string[];
    openFilterDropdown: string | null;
    setOpenFilterDropdown: (val: string | null) => void;
    toggleFilter: (type: string, value: string) => void;
    // Date filters
    dateShippedFrom: string;
    setDateShippedFrom: (val: string) => void;
    dateShippedTo: string;
    setDateShippedTo: (val: string) => void;
    dateArrivedFrom: string;
    setDateArrivedFrom: (val: string) => void;
    dateArrivedTo: string;
    setDateArrivedTo: (val: string) => void;
    // Domain data & handlers
    clients: Client[];
    statusOptions: string[];
    handleInlineUpdate: (id: string, field: keyof Shipment, value: string | number | null) => void;
    deleteShipments: (ids: string[]) => void;
    userRole?: string;
    isDepotView?: boolean;
}

export function ShipmentsTable({
    searchTerm,
    setSearchTerm,
    filteredShipments,
    selectedStatuses,
    selectedFinalStatuses,
    selectedCategories,
    selectedOrigins,
    selectedClients,
    selectedCodes,
    uniqueCategories,
    uniqueOrigins,
    uniqueClients,
    uniqueCodes,
    uniqueFinalStatuses,
    openFilterDropdown,
    setOpenFilterDropdown,
    toggleFilter,
    dateShippedFrom,
    setDateShippedFrom,
    dateShippedTo,
    setDateShippedTo,
    dateArrivedFrom,
    setDateArrivedFrom,
    dateArrivedTo,
    setDateArrivedTo,
    clients,
    statusOptions,
    handleInlineUpdate,
    deleteShipments,
    userRole,
    isDepotView = false,
}: ShipmentsTableProps) {
    // Zustand — all visual/interaction state lives here, zero props needed
    const {
        loading,
        isTableExpanded,
        selectedIds,
        expandedId,
        visibleCount,
        shipments,
        setShipments,
        toggleSelectAll,
        toggleSelectOne,
        setExpandedId,
        setVisibleCount,
    } = useShipmentStore();

    const [shipmentToReceive, setShipmentToReceive] = React.useState<Shipment | null>(null);

    const dateShippedRef = useRef<HTMLDivElement>(null);
    const dateArrivedRef = useRef<HTMLDivElement>(null);

    // ── Sorting state ──
    type SortField = 'client_name' | 'tracking_number' | 'date_shipped' | 'date_arrived' | 'created_at' | 'weight' | 'precio_envio' | 'origin' | 'internal_status' | null;
    type SortDir = 'asc' | 'desc';
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            if (sortDir === 'desc') setSortDir('asc');
            else { setSortField(null); setSortDir('desc'); } // third click resets
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={10} className="opacity-30 group-hover/sort:opacity-70 transition-opacity" />;
        return sortDir === 'desc'
            ? <ArrowDown size={10} className="text-[#2E7BFF]" />
            : <ArrowUp size={10} className="text-[#2E7BFF]" />;
    };

    const sortedShipments = useMemo(() => {
        if (!sortField) return filteredShipments;
        return [...filteredShipments].sort((a, b) => {
            let valA: any = (a as any)[sortField] ?? '';
            let valB: any = (b as any)[sortField] ?? '';
            // Numeric fields
            if (sortField === 'weight' || sortField === 'precio_envio') {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            }
            // Date fields
            if (['date_shipped', 'date_arrived', 'created_at'].includes(sortField)) {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            }
            // String comparison
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredShipments, sortField, sortDir]);

    const handleToggleDropdown = (type: string) => {
        setOpenFilterDropdown(openFilterDropdown === type ? null : type);
    };

    return (
        <div className="erp-card overflow-hidden flex flex-col transition-all" style={{ borderRadius: '16px' }}>
            {/* ── Search & Filter Control Strip ── */}
            <div className="px-5 py-4 border-b flex flex-col gap-4 shrink-0" style={{ borderColor: 'var(--card-border)' }}>
                <div className="flex gap-3 items-center">
                    <div className="relative w-full max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors" size={15} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar por guía o cliente..."
                            className="erp-input pl-10 pr-4 py-2.5 text-sm"
                            style={{ borderRadius: '12px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Data Zone ── */}
            <div className={`overflow-x-auto ${isTableExpanded ? 'flex-1 overflow-y-auto min-h-0' : ''}`}>
                <table className="w-full">
                    <thead>
                        <tr style={{ background: 'var(--table-header)' }}>
                            <th className="px-4 py-3 w-10" style={{ borderBottom: '1px solid var(--card-border)' }}>
                                <div
                                    onClick={() => toggleSelectAll(filteredShipments.map((s) => s.id))}
                                    className={`w-4 h-4 rounded border-[1.5px] transition-all cursor-pointer flex items-center justify-center ${selectedIds.size === filteredShipments.length && filteredShipments.length > 0 ? 'bg-[#2E7BFF] border-[#2E7BFF]' : 'border-slate-400/30 hover:border-[#2E7BFF]/50'}`}
                                >
                                    {selectedIds.size === filteredShipments.length && filteredShipments.length > 0 && <CheckCircle2 size={10} className="text-white" />}
                                </div>
                            </th>
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                <FilterDropdown label="Razón Social" type="client" options={uniqueClients} selectedValues={selectedClients} isOpen={openFilterDropdown === 'client'} onToggleOpen={handleToggleDropdown} onToggleOption={toggleFilter} width="w-72" />
                            </th>
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-24 text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                <FilterDropdown label="Código" type="code" options={uniqueCodes} selectedValues={selectedCodes} isOpen={openFilterDropdown === 'code'} onToggleOpen={handleToggleDropdown} onToggleOption={toggleFilter} width="w-48" />
                            </th>
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-56 min-w-[200px] text-left whitespace-nowrap cursor-pointer group/sort" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }} onClick={() => handleSort('tracking_number')}>
                                <div className="flex items-center gap-1">Número de Guía <SortIcon field="tracking_number" /></div>
                            </th>
                            {!isDepotView && (
                                <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-40 text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                    <FilterDropdown label="Status Importación" type="status" options={statusOptions} selectedValues={selectedStatuses} isOpen={openFilterDropdown === 'status'} onToggleOpen={handleToggleDropdown} onToggleOption={toggleFilter} />
                                </th>
                            )}
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-28 text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                <div className="flex items-center gap-1">
                                    <div ref={dateShippedRef} className={`flex items-center gap-1 cursor-pointer transition-colors ${(dateShippedFrom || dateShippedTo) ? "text-[#2E7BFF]" : "hover:text-[var(--text-primary)]"}`} onClick={() => handleToggleDropdown('dateShipped')}>
                                        F. de Salida
                                        <Filter size={10} strokeWidth={1.5} className={(dateShippedFrom || dateShippedTo) ? "fill-[#2E7BFF] text-[#2E7BFF]" : ""} />
                                    </div>
                                    <span className="cursor-pointer group/sort" onClick={(e) => { e.stopPropagation(); handleSort('date_shipped'); }}><SortIcon field="date_shipped" /></span>
                                </div>
                                <DateFilterPopup isOpen={openFilterDropdown === 'dateShipped'} onClose={() => setOpenFilterDropdown(null)} anchorRef={dateShippedRef} title="Rango de Fecha Salida" dateFrom={dateShippedFrom} setDateFrom={setDateShippedFrom} dateTo={dateShippedTo} setDateTo={setDateShippedTo} />
                            </th>
                            {isDepotView && (
                                <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-28 text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                    <div ref={dateArrivedRef} className={`flex items-center gap-1 cursor-pointer transition-colors ${(dateArrivedFrom || dateArrivedTo) ? "text-[#2E7BFF]" : "hover:text-[var(--text-primary)]"}`} onClick={() => handleToggleDropdown('dateArrived')}>
                                        F. Recibido
                                        <Filter size={10} strokeWidth={1.5} className={(dateArrivedFrom || dateArrivedTo) ? "fill-[#2E7BFF] text-[#2E7BFF]" : ""} />
                                    </div>
                                    <DateFilterPopup isOpen={openFilterDropdown === 'dateArrived'} onClose={() => setOpenFilterDropdown(null)} anchorRef={dateArrivedRef} title="Rango de Fecha Recibido" dateFrom={dateArrivedFrom} setDateFrom={setDateArrivedFrom} dateTo={dateArrivedTo} setDateTo={setDateArrivedTo} />
                                </th>
                            )}
                            {isDepotView && (
                                <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-24 text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                    <FilterDropdown label="Status Fin" type="final" options={uniqueFinalStatuses} selectedValues={selectedFinalStatuses} isOpen={openFilterDropdown === 'final'} onToggleOpen={handleToggleDropdown} onToggleOption={toggleFilter} width="w-48" />
                                </th>
                            )}
                            {!isDepotView && (
                                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 w-28 text-left whitespace-nowrap select-none">
                                    <FilterDropdown label="Categoría" type="category" options={uniqueCategories} selectedValues={selectedCategories} isOpen={openFilterDropdown === 'category'} onToggleOpen={handleToggleDropdown} onToggleOption={toggleFilter} width="w-48" />
                                </th>
                            )}
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-24 text-right whitespace-nowrap cursor-pointer group/sort" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }} onClick={() => handleSort('precio_envio')}>
                                <div className="flex items-center justify-end gap-1">Cotizado <SortIcon field="precio_envio" /></div>
                            </th>
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-20 text-right whitespace-nowrap cursor-pointer group/sort" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }} onClick={() => handleSort('weight')}>
                                <div className="flex items-center justify-end gap-1">Peso <SortIcon field="weight" /></div>
                            </th>
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-24 text-right whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                <FilterDropdown label="Origen" type="origin" options={uniqueOrigins} selectedValues={selectedOrigins} isOpen={openFilterDropdown === 'origin'} onToggleOpen={handleToggleDropdown} onToggleOption={toggleFilter} align="right" width="w-48" />
                            </th>
                            <th className="px-3 py-3 w-12 text-right" style={{ borderBottom: '1px solid var(--card-border)' }}></th>
                        </tr>
                    </thead>
                    <tbody className="bg-transparent relative z-0">
                        {loading ? (
                            <tr>
                                <td colSpan={12} className="px-6 py-20 text-center">
                                    <div className="flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                                </td>
                            </tr>
                        ) : filteredShipments.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="px-6 py-20 text-center text-slate-500 font-medium tracking-tight">
                                    No se encontraron envíos registrados.
                                </td>
                            </tr>
                        ) : (
                            sortedShipments.slice(0, visibleCount).map((s: Shipment) => (
                                <ShipmentRow
                                    key={s.id}
                                    s={s}
                                    clients={clients}
                                    selectedIds={selectedIds}
                                    toggleSelectOne={(e: React.MouseEvent, id: string) => { e.stopPropagation(); toggleSelectOne(id); }}
                                    expandedId={expandedId}
                                    setExpandedId={setExpandedId}
                                    handleInlineUpdate={handleInlineUpdate}
                                    statusOptions={statusOptions}
                                    deleteShipments={deleteShipments}
                                    setShipments={setShipments}
                                    onReceiveShipment={(s: Shipment) => setShipmentToReceive(s)}
                                    userRole={userRole}
                                    isDepotView={isDepotView}
                                />
                            ))
                        )}
                    </tbody>
                </table>

                {visibleCount < sortedShipments.length && (
                    <div className="py-6 flex justify-center w-full relative z-10">
                        <button
                            onClick={() => setVisibleCount((v) => v + 50)}
                            className="erp-btn erp-btn-secondary text-[10px] tracking-wider"
                        >
                            VER {Math.min(50, sortedShipments.length - visibleCount)} MÁS... ({sortedShipments.length - visibleCount} restantes)
                        </button>
                    </div>
                )}
            </div>

            <ReceiveShipmentModal
                isOpen={!!shipmentToReceive}
                onClose={() => setShipmentToReceive(null)}
                shipment={shipmentToReceive}
                onSuccess={() => {
                    setShipmentToReceive(null);
                    // Force a reload to reflect the exact new status and weights
                    window.location.reload();
                }}
            />
        </div>
    );
}
