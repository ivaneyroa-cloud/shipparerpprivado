import { create } from 'zustand';
import { Shipment } from '@/types';

interface ShipmentState {
    // Data
    shipments: Shipment[];
    loading: boolean;

    // View
    isTableExpanded: boolean;
    visibleCount: number;

    // Selection & Interaction
    selectedIds: Set<string>;
    expandedId: string | null;
    editingCell: { id: string; field: string } | null;

    // Delete Modal
    deleteModal: { isOpen: boolean; ids: string[] };

    // Add Modal
    showAddModal: boolean;

    // Confetti
    showConfetti: boolean;

    // Actions — Data
    setShipments: (shipments: Shipment[] | ((prev: Shipment[]) => Shipment[])) => void;
    updateShipmentField: (id: string, field: keyof Shipment, value: string | number | null) => void;
    setLoading: (loading: boolean) => void;

    // Actions — View
    setIsTableExpanded: (isExpanded: boolean) => void;
    setVisibleCount: (count: number | ((prev: number) => number)) => void;
    resetVisibleCount: () => void;

    // Actions — Selection
    toggleSelectAll: (allIds: string[]) => void;
    toggleSelectOne: (id: string) => void;
    clearSelection: () => void;

    // Actions — Interaction
    setExpandedId: (id: string | null) => void;
    setEditingCell: (cell: { id: string; field: string } | null) => void;

    // Actions — Modals
    openDeleteModal: (ids: string[]) => void;
    closeDeleteModal: () => void;
    setShowAddModal: (show: boolean) => void;

    // Actions — Confetti
    triggerConfetti: (durationMs?: number) => void;
}

export const useShipmentStore = create<ShipmentState>((set, get) => ({
    // Initial state
    shipments: [],
    loading: true,
    isTableExpanded: false,
    visibleCount: 50,
    selectedIds: new Set<string>(),
    expandedId: null,
    editingCell: null,
    deleteModal: { isOpen: false, ids: [] },
    showAddModal: false,
    showConfetti: false,

    // --- Data ---
    setShipments: (shipmentsOrUpdater) =>
        set((state) => ({
            shipments:
                typeof shipmentsOrUpdater === 'function'
                    ? shipmentsOrUpdater(state.shipments)
                    : shipmentsOrUpdater,
        })),
    updateShipmentField: (id, field, value) =>
        set((state) => ({
            shipments: state.shipments.map((s) =>
                s.id === id ? { ...s, [field]: value } : s
            ),
        })),
    setLoading: (loading) => set({ loading }),

    // --- View ---
    setIsTableExpanded: (isExpanded) => set({ isTableExpanded: isExpanded }),
    setVisibleCount: (count) =>
        set((state) => ({
            visibleCount: typeof count === 'function' ? count(state.visibleCount) : count,
        })),
    resetVisibleCount: () => set({ visibleCount: 50 }),

    // --- Selection ---
    toggleSelectAll: (allIds) =>
        set((state) => {
            if (state.selectedIds.size === allIds.length && allIds.length > 0) {
                return { selectedIds: new Set<string>() };
            }
            return { selectedIds: new Set(allIds) };
        }),
    toggleSelectOne: (id) =>
        set((state) => {
            const next = new Set(state.selectedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return { selectedIds: next };
        }),
    clearSelection: () => set({ selectedIds: new Set<string>() }),

    // --- Interaction ---
    setExpandedId: (id) => set({ expandedId: id }),
    setEditingCell: (cell) => set({ editingCell: cell }),

    // --- Modals ---
    openDeleteModal: (ids) => set({ deleteModal: { isOpen: true, ids } }),
    closeDeleteModal: () => set({ deleteModal: { isOpen: false, ids: [] } }),
    setShowAddModal: (show) => set({ showAddModal: show }),

    // --- Confetti ---
    triggerConfetti: (durationMs = 3000) => {
        set({ showConfetti: true });
        setTimeout(() => set({ showConfetti: false }), durationMs);
    },
}));
