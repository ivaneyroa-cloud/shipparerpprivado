'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, CheckCircle2, AlertTriangle, X, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import type { Shipment } from '@/types';

// ── Config ──
const ANOMALY_PCT_THRESHOLD = 5;
const ANOMALY_KG_THRESHOLD = 2;

interface QuickReceiveScreenProps {
    shipments: Shipment[];
    onClose: () => void;
    onReceived: () => void;
}

export function QuickReceiveScreen({ shipments, onClose, onReceived }: QuickReceiveScreenProps) {
    const [guiaInput, setGuiaInput] = useState('');
    const [matchedShipment, setMatchedShipment] = useState<Shipment | null>(null);
    const [receivedWeight, setReceivedWeight] = useState('');
    const [receivedBoxes, setReceivedBoxes] = useState('');
    const [saving, setSaving] = useState(false);
    const [lastReceived, setLastReceived] = useState<{ name: string; tracking: string } | null>(null);
    const guiaRef = useRef<HTMLInputElement>(null);
    const weightRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        guiaRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!matchedShipment && guiaRef.current) {
            guiaRef.current.focus();
        }
    }, [matchedShipment]);

    const searchShipment = useCallback((value: string) => {
        const clean = value.trim().toUpperCase();
        if (!clean) {
            setMatchedShipment(null);
            return;
        }
        const found = shipments.find(s =>
            s.tracking_number?.toUpperCase() === clean
        );
        if (found) {
            setMatchedShipment(found);
            setReceivedWeight('');
            setReceivedBoxes('');
            setTimeout(() => weightRef.current?.focus(), 100);
        }
    }, [shipments]);

    const handleGuiaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchShipment(guiaInput);
        }
    };

    const declaredWeight = matchedShipment?.weight || 0;
    const receivedNum = parseFloat(receivedWeight) || 0;
    const diffAbsolute = receivedNum - declaredWeight;
    const diffPercent = declaredWeight > 0 ? (diffAbsolute / declaredWeight) * 100 : 0;
    const hasAnomaly = Math.abs(diffPercent) > ANOMALY_PCT_THRESHOLD || Math.abs(diffAbsolute) > ANOMALY_KG_THRESHOLD;

    const handleConfirm = async () => {
        if (!matchedShipment || !receivedNum) return;
        setSaving(true);

        try {
            const updatePayload: any = {
                date_arrived: new Date().toISOString().slice(0, 10),
                delta_kg: parseFloat(diffAbsolute.toFixed(2)),
                updated_at: new Date().toISOString(),
            };

            // Only set internal_status when transitioning from a different state
            if (matchedShipment.internal_status !== 'Recibido en Oficina') {
                updatePayload.internal_status = 'Recibido en Oficina';
            }

            if (receivedBoxes) {
                updatePayload.boxes_count = parseInt(receivedBoxes);
            }

            const result = await secureShipmentUpdate(matchedShipment.id, updatePayload);

            if (!result.success) throw new Error(result.error);

            setLastReceived({ name: matchedShipment.client_name, tracking: matchedShipment.tracking_number });
            toast.success(`✅ ${matchedShipment.tracking_number} recepcionado${hasAnomaly ? ' ⚠ con diferencia' : ''}`);

            setMatchedShipment(null);
            setGuiaInput('');
            setReceivedWeight('');
            setReceivedBoxes('');
            onReceived();
        } catch (error: any) {
            console.error('Quick receive error:', error);
            toast.error(`Error: ${error.message || 'Error desconocido'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--surface-bg)' }}>
            <div className="w-full max-w-lg px-6">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Modo Recepción</h1>
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Escaneo rápido de guías</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] transition-all" style={{ color: 'var(--text-muted)' }}>
                        <X size={18} />
                    </button>
                </div>

                {lastReceived && (
                    <div className="erp-card px-4 py-2.5 mb-4 flex items-center gap-2" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
                        <CheckCircle2 size={12} className="text-[#10B981]" />
                        <span className="text-[10px] font-bold text-[#10B981]">
                            Último: {lastReceived.tracking} — {lastReceived.name}
                        </span>
                    </div>
                )}

                {!matchedShipment ? (
                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
                                Número de guía
                            </label>
                            <div className="relative">
                                <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--text-muted)' }} />
                                <input
                                    ref={guiaRef}
                                    type="text"
                                    placeholder="Escanear o escribir número de guía..."
                                    className="erp-input pl-12 text-sm font-bold uppercase tracking-wider"
                                    style={{ height: '52px', fontSize: '16px' }}
                                    value={guiaInput}
                                    onChange={(e) => setGuiaInput(e.target.value.toUpperCase())}
                                    onKeyDown={handleGuiaKeyDown}
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => searchShipment(guiaInput)}
                            disabled={!guiaInput.trim()}
                            className="w-full py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white disabled:opacity-30 transition-all active:scale-[0.98]"
                            style={{ background: '#2E7BFF' }}
                        >
                            Buscar guía
                        </button>
                        {guiaInput.trim() && !matchedShipment && (
                            <p className="text-[10px] font-bold text-center" style={{ color: 'var(--text-muted)' }}>
                                Presioná Enter o escaneá el código de barras
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="erp-card p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Guía</span>
                                <span className="font-mono text-sm font-black text-[#10B981] uppercase">{matchedShipment.tracking_number}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cliente</span>
                                <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{matchedShipment.client_name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Peso declarado</span>
                                <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{declaredWeight} kg</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cajas declaradas</span>
                                <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{matchedShipment.boxes_count || '—'}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Peso recibido (kg)
                                </label>
                                <input
                                    ref={weightRef}
                                    type="number"
                                    step="0.1"
                                    placeholder="0.0"
                                    className="erp-input text-center text-lg font-black"
                                    style={{ height: '52px' }}
                                    value={receivedWeight}
                                    onChange={(e) => setReceivedWeight(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Cajas (opcional)
                                </label>
                                <input
                                    type="number"
                                    placeholder="—"
                                    className="erp-input text-center text-lg font-black"
                                    style={{ height: '52px' }}
                                    value={receivedBoxes}
                                    onChange={(e) => setReceivedBoxes(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        {receivedNum > 0 && (
                            <div className={`erp-card p-4`} style={hasAnomaly ? { borderColor: Math.abs(diffPercent) > 10 ? 'rgba(239,68,68,0.2)' : 'rgba(255,176,32,0.2)' } : undefined}>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Diferencia</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black" style={{
                                            color: hasAnomaly
                                                ? Math.abs(diffPercent) > 10 ? '#EF4444' : '#FFB020'
                                                : '#10B981'
                                        }}>
                                            {diffAbsolute > 0 ? '+' : ''}{diffAbsolute.toFixed(1)} kg
                                        </span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{
                                            color: hasAnomaly
                                                ? Math.abs(diffPercent) > 10 ? '#EF4444' : '#FFB020'
                                                : '#10B981',
                                            background: hasAnomaly
                                                ? Math.abs(diffPercent) > 10 ? 'rgba(239,68,68,0.08)' : 'rgba(255,176,32,0.08)'
                                                : 'rgba(16,185,129,0.08)'
                                        }}>
                                            {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                                {hasAnomaly && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <AlertTriangle size={11} style={{ color: Math.abs(diffPercent) > 10 ? '#EF4444' : '#FFB020' }} />
                                        <span className="text-[10px] font-bold" style={{ color: Math.abs(diffPercent) > 10 ? '#EF4444' : '#FFB020' }}>
                                            Diferencia significativa detectada
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setMatchedShipment(null);
                                    setGuiaInput('');
                                    setReceivedWeight('');
                                    setReceivedBoxes('');
                                }}
                                className="flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                style={{ color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!receivedNum || saving}
                                className="flex-[2] py-3 rounded-lg text-xs font-bold uppercase tracking-wider text-white disabled:opacity-30 transition-all active:scale-[0.98]"
                                style={{ background: hasAnomaly ? '#FFB020' : '#10B981' }}
                            >
                                {saving ? 'Guardando...' : hasAnomaly ? '⚠ Confirmar con diferencia' : '✓ Confirmar recepción'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
