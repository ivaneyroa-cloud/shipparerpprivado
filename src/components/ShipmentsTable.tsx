import React, { useRef } from 'react';
import { Search, Loader2, Filter, CheckCircle2 } from 'lucide-react';
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
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-56 min-w-[200px] text-left whitespace-nowrap" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>Número de Guía</th>
                            {!isDepotView && (
                                <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-40 text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                    <FilterDropdown label="Status Importación" type="status" options={statusOptions} selectedValues={selectedStatuses} isOpen={openFilterDropdown === 'status'} onToggleOpen={handleToggleDropdown} onToggleOption={toggleFilter} />
                                </th>
                            )}
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-28 text-left whitespace-nowrap select-none" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>
                                <div ref={dateShippedRef} className={`flex items-center gap-1 cursor-pointer transition-colors ${(dateShippedFrom || dateShippedTo) ? "text-[#2E7BFF]" : "hover:text-[var(--text-primary)]"}`} onClick={() => handleToggleDropdown('dateShipped')}>
                                    F. de Salida
                                    <Filter size={10} strokeWidth={1.5} className={(dateShippedFrom || dateShippedTo) ? "fill-[#2E7BFF] text-[#2E7BFF]" : ""} />
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
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-24 text-right whitespace-nowrap" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>Cotizado</th>
                            <th className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-[0.1em] w-20 text-right whitespace-nowrap" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)' }}>Peso</th>
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
                            filteredShipments.slice(0, visibleCount).map((s: Shipment) => (
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

                {visibleCount < filteredShipments.length && (
                    <div className="py-6 flex justify-center w-full relative z-10">
                        <button
                            onClick={() => setVisibleCount((v) => v + 50)}
                            className="erp-btn erp-btn-secondary text-[10px] tracking-wider"
                        >
                            VER {Math.min(50, filteredShipments.length - visibleCount)} MÁS... ({filteredShipments.length - visibleCount} restantes)
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
