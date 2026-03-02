"use client";

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X } from 'lucide-react';

interface FilterDropdownProps {
    label: string;
    type: string;
    options: string[];
    selectedValues: string[];
    isOpen: boolean;
    onToggleOpen: (type: string) => void;
    onToggleOption: (type: string, value: string) => void;
    align?: 'left' | 'right';
    width?: string;
}

export function FilterDropdown({
    label,
    type,
    options,
    selectedValues,
    isOpen,
    onToggleOpen,
    onToggleOption,
    align = 'left',
    width = 'w-56'
}: FilterDropdownProps) {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                left: align === 'right' ? rect.right : rect.left
            });
        }
    }, [isOpen, align]);

    const isActive = selectedValues.length > 0;

    return (
        <>
            <div
                ref={triggerRef}
                data-filter-trigger
                className={`flex items-center ${align === 'right' ? 'justify-end' : ''} gap-1 cursor-pointer transition-colors ${isActive ? "text-blue-500 dark:text-blue-400" : "hover:text-slate-800 dark:hover:text-white"}`}
                onClick={(e) => { e.stopPropagation(); onToggleOpen(type); }}
            >
                {align === 'right' && <Filter size={10} strokeWidth={1.5} className={isActive ? "fill-blue-400 text-blue-400" : ""} />}
                {label}
                {align !== 'right' && <Filter size={10} strokeWidth={1.5} className={isActive ? "fill-blue-400 text-blue-400" : ""} />}
                {isActive && (
                    <span className="bg-blue-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center ml-0.5">
                        {selectedValues.length}
                    </span>
                )}
            </div>

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-[9998]"
                                onClick={(e) => { e.stopPropagation(); onToggleOpen(type); }}
                            />
                            {/* Dropdown */}
                            <motion.div
                                data-filter-dropdown
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                transition={{ duration: 0.15 }}
                                className={`fixed z-[9999] ${width} bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-1.5 max-h-72 overflow-y-auto`}
                                style={{
                                    top: dropdownPos.top,
                                    ...(align === 'right'
                                        ? { right: window.innerWidth - dropdownPos.left }
                                        : { left: dropdownPos.left }
                                    )
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Clear all for this filter */}
                                {selectedValues.length > 0 && (
                                    <div
                                        onClick={() => {
                                            selectedValues.forEach(v => onToggleOption(type, v));
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer uppercase tracking-widest border-b border-slate-100 dark:border-white/5 mb-1"
                                    >
                                        <X size={10} strokeWidth={2} />
                                        Limpiar filtro
                                    </div>
                                )}

                                {options.map(opt => {
                                    const isChecked = selectedValues.some(v => v.toUpperCase().trim() === opt.toUpperCase().trim());
                                    return (
                                        <div
                                            key={opt}
                                            onClick={(e) => { e.stopPropagation(); onToggleOption(type, opt); }}
                                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-xs font-bold transition-colors ${isChecked ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-white/20'}`}>
                                                {isChecked && (
                                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span className="truncate">{opt}</span>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
