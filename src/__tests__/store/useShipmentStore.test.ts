import { describe, it, expect, beforeEach } from 'vitest';
import { useShipmentStore } from '@/store/useShipmentStore';
import { Shipment } from '@/types';

// Helper to create a mock shipment
function mockShipment(overrides: Partial<Shipment> = {}): Shipment {
    return {
        id: 'ship-001',
        tracking_number: 'SF-12345',
        client_id: 'client-001',
        client_name: 'Test Client',
        client_code: 'SH-001',
        category: 'General',
        weight: 10,
        internal_status: 'Guía Creada',
        origin: 'China',
        date_shipped: null,
        date_arrived: null,
        ...overrides,
    };
}

describe('useShipmentStore', () => {
    beforeEach(() => {
        // Reset store to initial state before each test
        const store = useShipmentStore.getState();
        store.setShipments([]);
        store.setLoading(true);
        store.clearSelection();
        store.setExpandedId(null);
        store.setEditingCell(null);
        store.closeDeleteModal();
        store.setShowAddModal(false);
    });

    // ── Data ──
    describe('setShipments', () => {
        it('sets shipments from array', () => {
            const shipments = [mockShipment(), mockShipment({ id: 'ship-002' })];
            useShipmentStore.getState().setShipments(shipments);

            expect(useShipmentStore.getState().shipments).toHaveLength(2);
        });

        it('sets shipments from updater function', () => {
            useShipmentStore.getState().setShipments([mockShipment()]);
            useShipmentStore.getState().setShipments(prev => [
                ...prev,
                mockShipment({ id: 'ship-new' }),
            ]);

            expect(useShipmentStore.getState().shipments).toHaveLength(2);
        });
    });

    describe('updateShipmentField', () => {
        it('updates a single field on a specific shipment', () => {
            useShipmentStore.getState().setShipments([
                mockShipment({ id: 'a', weight: 10 }),
                mockShipment({ id: 'b', weight: 20 }),
            ]);

            useShipmentStore.getState().updateShipmentField('a', 'weight', 99);

            const shipments = useShipmentStore.getState().shipments;
            expect(shipments.find(s => s.id === 'a')?.weight).toBe(99);
            expect(shipments.find(s => s.id === 'b')?.weight).toBe(20); // unchanged
        });
    });

    describe('loading', () => {
        it('toggles loading state', () => {
            useShipmentStore.getState().setLoading(false);
            expect(useShipmentStore.getState().loading).toBe(false);

            useShipmentStore.getState().setLoading(true);
            expect(useShipmentStore.getState().loading).toBe(true);
        });
    });

    // ── View ──
    describe('table expansion', () => {
        it('toggles table expansion', () => {
            useShipmentStore.getState().setIsTableExpanded(true);
            expect(useShipmentStore.getState().isTableExpanded).toBe(true);
        });
    });

    describe('visibleCount', () => {
        it('sets visible count from number', () => {
            useShipmentStore.getState().setVisibleCount(100);
            expect(useShipmentStore.getState().visibleCount).toBe(100);
        });

        it('sets visible count from updater', () => {
            useShipmentStore.getState().setVisibleCount(50);
            useShipmentStore.getState().setVisibleCount(prev => prev + 25);
            expect(useShipmentStore.getState().visibleCount).toBe(75);
        });

        it('resets visible count to 50', () => {
            useShipmentStore.getState().setVisibleCount(999);
            useShipmentStore.getState().resetVisibleCount();
            expect(useShipmentStore.getState().visibleCount).toBe(50);
        });
    });

    // ── Selection ──
    describe('selection', () => {
        it('toggles select all on', () => {
            useShipmentStore.getState().toggleSelectAll(['a', 'b', 'c']);
            expect(useShipmentStore.getState().selectedIds.size).toBe(3);
        });

        it('toggles select all OFF when all are selected', () => {
            useShipmentStore.getState().toggleSelectAll(['a', 'b']);
            expect(useShipmentStore.getState().selectedIds.size).toBe(2);

            useShipmentStore.getState().toggleSelectAll(['a', 'b']);
            expect(useShipmentStore.getState().selectedIds.size).toBe(0);
        });

        it('toggle single selection on/off', () => {
            useShipmentStore.getState().toggleSelectOne('a');
            expect(useShipmentStore.getState().selectedIds.has('a')).toBe(true);

            useShipmentStore.getState().toggleSelectOne('a');
            expect(useShipmentStore.getState().selectedIds.has('a')).toBe(false);
        });

        it('clears all selection', () => {
            useShipmentStore.getState().toggleSelectAll(['a', 'b', 'c']);
            useShipmentStore.getState().clearSelection();
            expect(useShipmentStore.getState().selectedIds.size).toBe(0);
        });
    });

    // ── Interaction ──
    describe('expandedId', () => {
        it('sets and clears expanded row', () => {
            useShipmentStore.getState().setExpandedId('abc');
            expect(useShipmentStore.getState().expandedId).toBe('abc');

            useShipmentStore.getState().setExpandedId(null);
            expect(useShipmentStore.getState().expandedId).toBeNull();
        });
    });

    describe('editingCell', () => {
        it('sets editing cell', () => {
            useShipmentStore.getState().setEditingCell({ id: 'x', field: 'weight' });
            expect(useShipmentStore.getState().editingCell).toEqual({ id: 'x', field: 'weight' });
        });
    });

    // ── Modals ──
    describe('deleteModal', () => {
        it('opens with IDs and closes', () => {
            useShipmentStore.getState().openDeleteModal(['a', 'b']);
            expect(useShipmentStore.getState().deleteModal).toEqual({
                isOpen: true,
                ids: ['a', 'b'],
            });

            useShipmentStore.getState().closeDeleteModal();
            expect(useShipmentStore.getState().deleteModal).toEqual({
                isOpen: false,
                ids: [],
            });
        });
    });

    describe('showAddModal', () => {
        it('toggles add modal', () => {
            useShipmentStore.getState().setShowAddModal(true);
            expect(useShipmentStore.getState().showAddModal).toBe(true);
        });
    });
});
