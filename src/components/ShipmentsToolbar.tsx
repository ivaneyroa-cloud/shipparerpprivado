import React from 'react';
import { Plus, X, Trash2, Maximize, Upload, Loader2, Minimize, ChevronLeft, Download } from 'lucide-react';

interface ShipmentsToolbarProps {
    isTableExpanded: boolean;
    setIsTableExpanded: (val: boolean) => void;
    hasActiveFilters: boolean;
    clearFilters: () => void;
    selectedIdsSize: number;
    deleteSelectedShipments: () => void;
    uploadingCsv: boolean;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    setShowAddModal: (val: boolean) => void;
    onExportExcel?: () => void;
}

export function ShipmentsToolbar({
    isTableExpanded,
    setIsTableExpanded,
    hasActiveFilters,
    clearFilters,
    selectedIdsSize,
    deleteSelectedShipments,
    uploadingCsv,
    handleFileUpload,
    setShowAddModal,
    onExportExcel,
}: ShipmentsToolbarProps) {
    if (isTableExpanded) {
        return (
            <div className="mb-4 shrink-0 flex items-end justify-between">
                <div>
                    <button
                        onClick={() => setIsTableExpanded(false)}
                        className="flex items-center gap-2 text-[#2E7BFF] hover:text-[#5B9AFF] font-semibold transition-colors mb-2 text-sm"
                    >
                        <ChevronLeft size={14} strokeWidth={1.5} />
                        Volver al Dashboard
                    </button>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                        Vista Detallada de Envíos
                        <span className="erp-badge erp-badge-blue">Modo Extendido</span>
                    </h1>
                </div>
                <button
                    onClick={() => setIsTableExpanded(false)}
                    className="erp-btn erp-btn-ghost text-xs"
                >
                    <Minimize size={14} strokeWidth={1.5} />
                    <span className="hidden md:inline">REDUCIR VISTA</span>
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
                <button
                    onClick={clearFilters}
                    className="erp-btn erp-btn-ghost text-[10px] tracking-wider px-3 py-2"
                >
                    <X size={12} strokeWidth={1.5} />
                    <span className="hidden md:inline">LIMPIAR</span>
                </button>
            )}
            {selectedIdsSize > 0 && (
                <button
                    onClick={deleteSelectedShipments}
                    className="erp-btn erp-btn-danger text-[10px] tracking-wider px-3 py-2"
                >
                    <Trash2 size={12} strokeWidth={1.5} />
                    <span className="hidden md:inline">ELIMINAR ({selectedIdsSize})</span>
                </button>
            )}
            <label className="erp-btn erp-btn-ghost text-xs cursor-pointer">
                {uploadingCsv ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> : <Upload size={14} strokeWidth={1.5} />}
                <span className="hidden md:inline">{uploadingCsv ? 'IMPORTANDO...' : 'IMPORTAR EXCEL'}</span>
                <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={uploadingCsv} />
            </label>
            {onExportExcel && (
                <button
                    onClick={onExportExcel}
                    className="erp-btn erp-btn-ghost text-xs"
                >
                    <Download size={14} strokeWidth={1.5} />
                    <span className="hidden md:inline">EXPORTAR EXCEL</span>
                </button>
            )}
            <button
                onClick={() => setIsTableExpanded(true)}
                className="erp-btn erp-btn-ghost text-xs"
            >
                <Maximize size={14} strokeWidth={1.5} />
                <span className="hidden md:inline">AMPLIAR</span>
            </button>
            <button
                onClick={() => setShowAddModal(true)}
                className="erp-btn erp-btn-primary text-xs"
            >
                <Plus size={14} strokeWidth={1.5} />
                <span className="hidden md:inline">NUEVO ENVÍO</span>
            </button>
        </div>
    );
}
