import { useState, useCallback, useMemo } from 'react';

export function useShipmentFilters(shipments: any[], initialStatusFilter?: string) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialStatusFilter ? [initialStatusFilter] : []);
    const [selectedFinalStatuses, setSelectedFinalStatuses] = useState<string[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
    const [dateShippedFrom, setDateShippedFrom] = useState('');
    const [dateShippedTo, setDateShippedTo] = useState('');
    const [dateArrivedFrom, setDateArrivedFrom] = useState('');
    const [dateArrivedTo, setDateArrivedTo] = useState('');
    const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);

    const getFinalStatus = useCallback((internal_status: string) => {
        const st = (internal_status || '').toLowerCase().trim();
        if (st === 'retirado') return 'RETIRADO';
        if (st === 'mercado libre full' || st === 'ml / full' || st.includes('full')) return 'ML / FULL';
        if (st === 'retenido') return 'RETENIDO';
        if (st === 'despachado') return 'DESPACHADO';
        return 'SIN RETIRAR';
    }, []);

    const norm = useCallback((val: any) => (val || '').toString().toUpperCase().trim(), []);


    const uniqueCategories = useMemo(() =>
        Array.from(new Set(shipments.map((s: any) => norm(s.category) || 'OTROS'))).filter(Boolean).sort()
        , [shipments, norm]);
    const uniqueOrigins = useMemo(() =>
        Array.from(new Set(shipments.map((s: any) => norm(s.origin) || 'CHINA'))).filter(Boolean).sort()
        , [shipments, norm]);
    const uniqueClients = useMemo(() =>
        Array.from(new Set(shipments.map((s: any) => norm(s.client_name)))).filter(Boolean).sort()
        , [shipments, norm]);
    const uniqueCodes = useMemo(() =>
        Array.from(new Set(shipments.map((s: any) => norm(s.client_code)))).filter(Boolean).sort()
        , [shipments, norm]);
    const uniqueFinalStatuses = ['SIN RETIRAR', 'RETIRADO', 'ML / FULL', 'RETENIDO', 'DESPACHADO'];


    // useMemo: only recomputes when shipments or filter state actually changes
    const filteredShipments = useMemo(() => shipments.filter((s: any) => {
        const tracking = (s.tracking_number || '').toLowerCase();
        const client = (s.client_name || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        const matchesSearch = tracking.includes(search) || client.includes(search);
        if (!matchesSearch) return false;

        const finalStatus = getFinalStatus(s.internal_status);

        if (selectedStatuses.length > 0) {
            const statusNorm = norm(s.internal_status);
            if (!selectedStatuses.some(v => norm(v) === statusNorm)) return false;
        }

        if (selectedFinalStatuses.length > 0) {
            if (!selectedFinalStatuses.some(v => norm(v) === norm(finalStatus))) return false;
        }

        if (selectedCategories.length > 0) {
            const catNorm = norm(s.category) || 'OTROS';
            if (!selectedCategories.some(v => norm(v) === catNorm)) return false;
        }

        if (selectedOrigins.length > 0) {
            const originNorm = norm(s.origin) || 'CHINA';
            if (!selectedOrigins.some(v => norm(v) === originNorm)) return false;
        }

        if (selectedClients.length > 0) {
            const clientNorm = norm(s.client_name);
            if (!selectedClients.some(v => norm(v) === clientNorm)) return false;
        }

        if (selectedCodes.length > 0) {
            const codeNorm = norm(s.client_code);
            if (!selectedCodes.some(v => norm(v) === codeNorm)) return false;
        }

        // Date shipped filter
        if (dateShippedFrom || dateShippedTo) {
            const dateVal = s.date_shipped || '';
            if (!dateVal) return false; // No date = exclude when date filter is active
            if (dateShippedFrom && dateVal < dateShippedFrom) return false;
            if (dateShippedTo && dateVal > dateShippedTo) return false;
        }

        // Date arrived filter
        if (dateArrivedFrom || dateArrivedTo) {
            const dateVal = s.date_arrived || '';
            if (!dateVal) return false;
            if (dateArrivedFrom && dateVal < dateArrivedFrom) return false;
            if (dateArrivedTo && dateVal > dateArrivedTo) return false;
        }

        return true;
    }), [shipments, searchTerm, selectedStatuses, selectedFinalStatuses, selectedCategories, selectedOrigins, selectedClients, selectedCodes, dateShippedFrom, dateShippedTo, dateArrivedFrom, dateArrivedTo, norm, getFinalStatus]);

    const toggleFilter = useCallback((type: string, value: string, onToggleCallback?: () => void) => {
        const setterMap: Record<string, React.Dispatch<React.SetStateAction<string[]>>> = {
            'status': setSelectedStatuses,
            'final': setSelectedFinalStatuses,
            'category': setSelectedCategories,
            'origin': setSelectedOrigins,
            'client': setSelectedClients,
            'code': setSelectedCodes
        };

        const setter = setterMap[type];
        if (!setter) return;

        setter(prev => {
            const valNorm = value.toUpperCase().trim();
            const isAlreadySelected = prev.some(v => v.toUpperCase().trim() === valNorm);
            return isAlreadySelected
                ? prev.filter(v => v.toUpperCase().trim() !== valNorm)
                : [...prev, value];
        });

        if (onToggleCallback) onToggleCallback();
    }, []);

    const clearFilters = useCallback(() => {
        setSearchTerm('');
        setSelectedStatuses([]);
        setSelectedFinalStatuses([]);
        setSelectedCategories([]);
        setSelectedOrigins([]);
        setSelectedClients([]);
        setSelectedCodes([]);
        setDateShippedFrom('');
        setDateShippedTo('');
        setDateArrivedFrom('');
        setDateArrivedTo('');
    }, []);

    const hasActiveFilters = useMemo(() =>
        searchTerm !== '' ||
        selectedStatuses.length > 0 || selectedFinalStatuses.length > 0 ||
        selectedCategories.length > 0 || selectedOrigins.length > 0 ||
        selectedClients.length > 0 || selectedCodes.length > 0 ||
        dateShippedFrom !== '' || dateShippedTo !== '' ||
        dateArrivedFrom !== '' || dateArrivedTo !== ''
        , [searchTerm, selectedStatuses, selectedFinalStatuses, selectedCategories, selectedOrigins, selectedClients, selectedCodes, dateShippedFrom, dateShippedTo, dateArrivedFrom, dateArrivedTo]);

    return {
        searchTerm, setSearchTerm,
        selectedStatuses, selectedFinalStatuses, selectedCategories, selectedOrigins, selectedClients, selectedCodes,
        dateShippedFrom, setDateShippedFrom, dateShippedTo, setDateShippedTo,
        dateArrivedFrom, setDateArrivedFrom, dateArrivedTo, setDateArrivedTo,
        openFilterDropdown, setOpenFilterDropdown,
        uniqueCategories, uniqueOrigins, uniqueClients, uniqueCodes, uniqueFinalStatuses,
        filteredShipments,
        toggleFilter,
        clearFilters,
        hasActiveFilters
    };
}
