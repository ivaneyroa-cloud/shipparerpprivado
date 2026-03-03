import React from 'react';
import { BaseModal } from '@/components/ui/BaseModal';
import { AlertCircle, Trash2, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger'
}: ConfirmationModalProps) {

    const colors = {
        danger: {
            bg: 'bg-red-500',
            text: 'text-red-500',
            hover: 'hover:bg-red-600',
            lightBg: 'bg-red-50 dark:bg-red-500/10',
            icon: <Trash2 size={24} className="text-red-500" />
        },
        warning: {
            bg: 'bg-orange-500',
            text: 'text-orange-500',
            hover: 'hover:bg-orange-600',
            lightBg: 'bg-orange-50 dark:bg-orange-500/10',
            icon: <AlertCircle size={24} className="text-orange-500" />
        },
        info: {
            bg: 'bg-blue-500',
            text: 'text-blue-500',
            hover: 'hover:bg-blue-600',
            lightBg: 'bg-blue-50 dark:bg-blue-500/10',
            icon: <AlertCircle size={24} className="text-blue-500" />
        }
    };

    const currentStyle = colors[variant];

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} size="sm" zIndex={200}>
            <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-full ${currentStyle.lightBg}`}>
                        {currentStyle.icon}
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
                    {title}
                </h3>
                <p className="text-slate-500 font-medium">
                    {message}
                </p>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-colors active:scale-95"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`flex-1 px-6 py-4 ${currentStyle.bg} ${currentStyle.hover} text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
