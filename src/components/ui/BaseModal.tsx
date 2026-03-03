"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const SIZE_MAP: Record<ModalSize, string> = {
    sm: 'min(95vw, 400px)',
    md: 'min(95vw, 520px)',
    lg: 'min(95vw, 640px)',
    xl: 'min(95vw, 800px)',
    '2xl': 'min(95vw, 1024px)',
    full: 'min(95vw, 1280px)',
};

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** Modal width preset. Default: 'md' */
    size?: ModalSize;
    /** Custom max-width override (CSS value) */
    maxWidth?: string;
    /** z-index. Default: 100 */
    zIndex?: number;
    /** Whether clicking the backdrop closes the modal. Default: true */
    closeOnBackdrop?: boolean;
    /** Additional className for the modal container */
    className?: string;
}

/**
 * BaseModal — standardized, fully responsive modal wrapper.
 *
 * Rules:
 * - Never exceeds viewport height
 * - Internal scroll when content overflows
 * - Body scroll locked while open
 * - Works at any browser zoom level
 * - Centered horizontally & vertically
 * - Minimum resolution: 1366x768
 */
export function BaseModal({
    isOpen,
    onClose,
    children,
    size = 'md',
    maxWidth,
    zIndex = 100,
    closeOnBackdrop = true,
    className = '',
}: BaseModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.touchAction = 'none';

            return () => {
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.touchAction = '';
                window.scrollTo(0, scrollY);
            };
        }
    }, [isOpen]);

    // Prevent scroll from leaking to background
    const handleOverlayWheel = useCallback((e: React.WheelEvent) => {
        // Only allow scroll inside the modal container, not the overlay background
        const target = e.target as HTMLElement;
        const modalContainer = overlayRef.current?.querySelector('.base-modal-container');
        if (modalContainer && !modalContainer.contains(target)) {
            e.preventDefault();
        }
    }, []);

    // Prevent touch scroll from leaking
    const handleOverlayTouchMove = useCallback((e: React.TouchEvent) => {
        const target = e.target as HTMLElement;
        const modalContainer = overlayRef.current?.querySelector('.base-modal-container');
        if (modalContainer && !modalContainer.contains(target)) {
            e.preventDefault();
        }
    }, []);

    const resolvedWidth = maxWidth || SIZE_MAP[size];

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    ref={overlayRef}
                    className="base-modal-overlay"
                    style={{ zIndex }}
                    onClick={closeOnBackdrop ? onClose : undefined}
                    onWheel={handleOverlayWheel}
                    onTouchMove={handleOverlayTouchMove}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 12 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400, duration: 0.2 }}
                        className={`base-modal-container ${className}`}
                        style={{ width: resolvedWidth }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
