'use client';

import React from 'react';
import { Phone, Mail, MapPin, FileText } from 'lucide-react';

interface MobileClientCardProps {
    client: any;
    onView: (client: any) => void;
    onTarifaSave: (clientId: string, val: string) => void;
}

export const MobileClientCard = React.memo(function MobileClientCard({ client, onView, onTarifaSave }: MobileClientCardProps) {
    const [editingTarifa, setEditingTarifa] = React.useState(false);
    const [draft, setDraft] = React.useState(client.tarifa_aplicable || '');

    return (
        <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}
            onClick={() => onView(client)}
        >
            <div className="p-4 space-y-2.5">
                {/* Row 1: Name + Code */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">
                            {client.name}
                        </h3>
                        {client.cuit && (
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5">{client.cuit}</p>
                        )}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md shrink-0">
                        {client.code}
                    </span>
                </div>

                {/* Row 2: Tax condition */}
                {client.tax_condition && (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md inline-block">
                        {client.tax_condition}
                    </span>
                )}

                {/* Row 3: Tarifa */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <FileText size={12} className="text-amber-500 shrink-0" />
                    {editingTarifa ? (
                        <input
                            autoFocus
                            className="flex-1 bg-amber-50 dark:bg-amber-500/10 border-b-2 border-amber-500 outline-none py-1 px-2 text-xs font-black text-amber-700 dark:text-amber-300 rounded-t"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => {
                                setEditingTarifa(false);
                                if (draft !== (client.tarifa_aplicable || '')) {
                                    onTarifaSave(client.id, draft);
                                }
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            placeholder="Ej: 17*kg..."
                        />
                    ) : (
                        <span
                            className="text-xs font-black text-amber-600 dark:text-amber-400 cursor-pointer flex-1"
                            onClick={() => setEditingTarifa(true)}
                        >
                            {client.tarifa_aplicable || '— Sin tarifa'}
                        </span>
                    )}
                </div>

                {/* Row 4: Contact info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {client.phone && (
                        <a href={`tel:${client.phone}`} className="flex items-center gap-1 font-bold hover:text-blue-500" onClick={(e) => e.stopPropagation()}>
                            <Phone size={11} /> {client.phone}
                        </a>
                    )}
                    {client.email && (
                        <a href={`mailto:${client.email}`} className="flex items-center gap-1 font-bold hover:text-blue-500 truncate max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                            <Mail size={11} /> {client.email}
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
});
