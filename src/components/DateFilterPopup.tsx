import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar } from 'lucide-react';

interface DateFilterPopupProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLDivElement | null>;
    title: string;
    dateFrom: string;
    setDateFrom: (v: string) => void;
    dateTo: string;
    setDateTo: (v: string) => void;
}

export function DateFilterPopup({
    isOpen,
    onClose,
    anchorRef,
    title,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo
}: DateFilterPopupProps) {
    if (!isOpen || typeof document === 'undefined') return null;

    const top = (anchorRef.current?.getBoundingClientRect()?.bottom || 0) + 8;
    const left = anchorRef.current?.getBoundingClientRect()?.left || 0;

    return createPortal(
        <>
            <div className="fixed inset-0 z-[9998]" onClick={onClose} />
            <div
                className="fixed z-[9999] w-64 erp-card p-4 space-y-3"
                style={{ top, left, background: 'var(--surface-elevated)', borderColor: 'var(--card-border)' }}
            >
                <div className="flex items-center justify-between">
                    <p className="erp-kpi-label flex items-center gap-1.5">
                        <Calendar size={10} /> {title}
                    </p>
                    <button onClick={onClose} className="text-slate-500 hover:text-red-500 transition-colors">
                        <X size={12} />
                    </button>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Desde</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="erp-date-input w-full"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Hasta</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="erp-date-input w-full"
                    />
                </div>
                {(dateFrom || dateTo) && (
                    <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="erp-btn erp-btn-danger w-full text-[10px] py-1.5"
                    >
                        <X size={10} />Limpiar
                    </button>
                )}
            </div>
        </>,
        document.body
    );
}
