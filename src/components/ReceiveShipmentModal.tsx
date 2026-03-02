"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, PackagePlus, Calculator, Trash2, CheckCircle2,
    DollarSign, Image as ImageIcon, Copy, Weight,
    ArrowDown, Layers, AlertTriangle, Package, Lock,
    Shield, History, Edit3
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { secureShipmentUpdate } from '@/lib/secure-shipment-update';
import { toast } from 'sonner';
import { Shipment, ShipmentPackage, ReceptionVersion } from '@/types';
import {
    MAX_BULK_COUNT, MAX_DIM_CM, MIN_DIM_CM, MAX_WEIGHT_KG, MIN_WEIGHT_KG,
    emptyBox, saveToLocal, loadFromLocal, clearLocal,
    validateReception, computeReceptionStatus, computeReceptionDiff,
} from '@/lib/reception-helpers';
import { trackReceptionPerformance } from '@/lib/reception-performance';

interface ReceiveShipmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    shipment: Shipment | null;
}

export function ReceiveShipmentModal({ isOpen, onClose, onSuccess, shipment }: ReceiveShipmentModalProps) {
    const [bultos, setBultos] = useState<ShipmentPackage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [costoFlete, setCostoFlete] = useState('');
    const [receptionStartTime] = useState<number>(Date.now());
    const [photo1, setPhoto1] = useState<File | null>(null);
    const [photo2, setPhoto2] = useState<File | null>(null);
    const [bulkCount, setBulkCount] = useState('');
    const [showBulkInput, setShowBulkInput] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [volWarnings, setVolWarnings] = useState<string[]>([]);
    const [previousBoxCount, setPreviousBoxCount] = useState(0);

    // ── Versioning state ──
    const [isEdit, setIsEdit] = useState(false);
    const [isPostDelivery, setIsPostDelivery] = useState(false);
    const [editReason, setEditReason] = useState('');
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [versions, setVersions] = useState<ReceptionVersion[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Refs for auto-focus
    const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
    const setInputRef = useCallback((key: string, el: HTMLInputElement | null) => {
        if (el) inputRefs.current.set(key, el);
        else inputRefs.current.delete(key);
    }, []);
    const focusField = useCallback((boxIndex: number, field: string) => {
        requestAnimationFrame(() => {
            const el = inputRefs.current.get(`${boxIndex}-${field}`);
            el?.focus(); el?.select();
        });
    }, []);

    // ── Delivered statuses (post-delivery protection) ──
    const DELIVERED_STATUSES = ['Retirado', 'Despachado', 'Mercado Libre full'];

    // ── Init ──
    useEffect(() => {
        if (isOpen && shipment) {
            const saved = loadFromLocal(shipment.id);
            const existingBultos = shipment.bultos && shipment.bultos.length > 0 ? shipment.bultos : [];
            const prevCount = existingBultos.length;
            setPreviousBoxCount(prevCount);

            // Detect edit vs first reception
            const hasExistingReception = prevCount > 0 && shipment.reception_status !== 'PENDING';
            setIsEdit(hasExistingReception);
            setIsPostDelivery(DELIVERED_STATUSES.includes(shipment.internal_status));
            setEditReason('');
            setShowReasonModal(false);
            setShowHistory(false);

            if (saved && saved.bultos.length > prevCount) {
                setBultos(saved.bultos);
                setCostoFlete(saved.costoFlete || shipment.costo_flete?.toString() || '');
                toast.info('📋 Datos parciales recuperados');
            } else if (prevCount > 0) {
                setBultos([...existingBultos, emptyBox()]);
                setCostoFlete(shipment.costo_flete?.toString() || '');
            } else {
                setBultos([emptyBox()]);
                setCostoFlete(shipment.costo_flete?.toString() || '');
            }

            setPhoto1(null);
            setPhoto2(null);
            setShowBulkInput(false);
            setBulkCount('');
            setValidationErrors([]);
            setVolWarnings([]);

            // Fetch version history
            fetchVersions(shipment.id);
        } else {
            setBultos([]);
            setPreviousBoxCount(0);
        }
    }, [isOpen, shipment]);

    const fetchVersions = async (shipmentId: string) => {
        const { data } = await supabase
            .from('reception_versions')
            .select('*')
            .eq('shipment_id', shipmentId)
            .order('version_number', { ascending: false })
            .limit(20);
        setVersions((data as ReceptionVersion[]) || []);
    };

    // ── Auto-save ──
    useEffect(() => {
        if (shipment && bultos.length > 0) {
            saveToLocal(shipment.id, { bultos, costoFlete });
        }
    }, [bultos, costoFlete, shipment]);

    // ── Box CRUD ──
    const addBox = useCallback(() => {
        setBultos(prev => {
            const next = [...prev, emptyBox()];
            setTimeout(() => focusField(next.length - 1, 'largo'), 50);
            return next;
        });
    }, [focusField]);

    const removeBox = (index: number) => {
        // Can't remove previously saved boxes
        if (index < previousBoxCount) {
            toast.error('No se pueden eliminar cajas ya recepcionadas');
            return;
        }
        setBultos(prev => prev.filter((_, i) => i !== index));
    };

    const duplicatePrevious = useCallback((focusPesoOnly = false) => {
        setBultos(prev => {
            if (prev.length === 0) return [...prev, emptyBox()];
            const last = prev[prev.length - 1];
            const clone: ShipmentPackage = {
                largo: last.largo, ancho: last.ancho, alto: last.alto,
                peso_fisico: focusPesoOnly ? 0 : last.peso_fisico,
                peso_volumetrico: last.peso_volumetrico,
                peso_computable: focusPesoOnly ? 0 : last.peso_computable,
            };
            if (!focusPesoOnly) {
                const maxW = Math.max(clone.peso_fisico, clone.peso_volumetrico);
                clone.peso_computable = Math.ceil(maxW * 2) / 2;
            }
            const next = [...prev, clone];
            setTimeout(() => focusField(next.length - 1, focusPesoOnly ? 'peso_fisico' : 'largo'), 50);
            return next;
        });
    }, [focusField]);

    const bulkDuplicate = useCallback(() => {
        const n = parseInt(bulkCount);
        if (!n || n < 1 || n > MAX_BULK_COUNT) {
            toast.error(`Ingresá un número entre 1 y ${MAX_BULK_COUNT}`);
            return;
        }
        setBultos(prev => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            const clones = Array.from({ length: n }, () => {
                const c = { ...last };
                c.peso_computable = Math.ceil(Math.max(c.peso_fisico, c.peso_volumetrico) * 2) / 2;
                return c;
            });
            return [...prev, ...clones];
        });
        setShowBulkInput(false);
        setBulkCount('');
        toast.success(`${n} caja${n > 1 ? 's' : ''} duplicada${n > 1 ? 's' : ''}`);
    }, [bulkCount]);

    // ── Update box field ──
    const updateBox = (index: number, field: keyof ShipmentPackage, value: string) => {
        // Block editing previously saved boxes
        if (index < previousBoxCount) return;

        const numValue = parseFloat(value) || 0;
        setBultos(prev => {
            const newBultos = [...prev];
            const box = { ...newBultos[index], [field]: numValue };

            if (field === 'largo' || field === 'ancho' || field === 'alto') {
                box.peso_volumetrico = parseFloat(((box.largo * box.ancho * box.alto) / 5000).toFixed(2));
            }
            box.peso_computable = Math.ceil(Math.max(box.peso_fisico, box.peso_volumetrico) * 2) / 2;
            newBultos[index] = box;
            return newBultos;
        });
    };

    // ── Keyboard ──
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, boxIndex: number, field: string) => {
        if (e.key === 'Enter' && field === 'peso_fisico') {
            e.preventDefault();
            addBox();
        }
    };

    // ── Totals ──
    const totalComputable = bultos.reduce((s, b) => s + b.peso_computable, 0);
    const totalFisico = bultos.reduce((s, b) => s + b.peso_fisico, 0);
    // Only count new boxes (not empty placeholders)
    const newBoxes = bultos.filter((b, i) => i >= previousBoxCount && b.largo > 0 && b.peso_fisico > 0);
    const allValidBoxes = bultos.filter(b => b.largo > 0 && b.peso_fisico > 0);

    // ── Declared vs Received ──
    const declaredKg = shipment?.weight || 0;
    const declaredBoxes = shipment?.boxes_count || 0;
    const receivedKg = totalComputable;
    const receivedBoxes = allValidBoxes.length;
    const deltaKg = receivedKg - declaredKg;
    const deltaBoxes = receivedBoxes - declaredBoxes;

    // ── Reception status computation ──
    const getReceptionStatus = () => computeReceptionStatus(receivedBoxes, declaredBoxes);

    // ── Validate all ──
    const validate = () => validateReception({
        bultos, previousBoxCount, costoFlete,
        photo1, photo2,
        existingPhoto1: shipment?.invoice_photo_1,
        existingPhoto2: shipment?.invoice_photo_2,
        totalComputable,
    });

    // ── Compute diff between old and new ──
    const computeDiff = (finalBultos: ShipmentPackage[], url1: string | null, url2: string | null) =>
        computeReceptionDiff(finalBultos, url1, url2, shipment || {}, costoFlete);

    // ── Submit (with versioning) ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shipment) return;

        // If edit, require reason
        if (isEdit && !editReason.trim()) {
            setShowReasonModal(true);
            return;
        }

        const { errors, warnings } = validate();
        setValidationErrors(errors);
        setVolWarnings(warnings);

        if (errors.length > 0) {
            toast.error(`${errors.length} error${errors.length > 1 ? 'es' : ''} de validación`);
            return;
        }

        if (warnings.length > 0) {
            warnings.forEach(w => console.warn('[Recepción Warning]', w));
            toast.warning(`⚠️ ${warnings.length} advertencia${warnings.length > 1 ? 's' : ''} volumétrica${warnings.length > 1 ? 's' : ''}`);
        }

        const finalBultos = bultos.filter(b => b.largo > 0 && b.peso_fisico > 0);
        const receptionStatus = getReceptionStatus();

        setIsLoading(true);
        try {
            // Get current user
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            let url1 = shipment.invoice_photo_1 || null;
            let url2 = shipment.invoice_photo_2 || null;

            if (photo1) {
                const ext = photo1.name.split('.').pop();
                const path = `receipts/${shipment.id}/1_${Date.now()}.${ext}`;
                const { error: err1 } = await supabase.storage.from('invoices').upload(path, photo1);
                if (!err1) { url1 = supabase.storage.from('invoices').getPublicUrl(path).data.publicUrl; }
            }
            if (photo2) {
                const ext = photo2.name.split('.').pop();
                const path = `receipts/${shipment.id}/2_${Date.now()}.${ext}`;
                const { error: err2 } = await supabase.storage.from('invoices').upload(path, photo2);
                if (!err2) { url2 = supabase.storage.from('invoices').getPublicUrl(path).data.publicUrl; }
            }

            const finalTotalComputable = finalBultos.reduce((s, b) => s + b.peso_computable, 0);
            const finalTotalFisico = finalBultos.reduce((s, b) => s + b.peso_fisico, 0);
            const finalDeltaKg = parseFloat((finalTotalComputable - declaredKg).toFixed(2));
            const finalDeltaBoxes = finalBultos.length - declaredBoxes;
            const nextVersion = (shipment.reception_version_count || 0) + 1;

            // Build version snapshot
            const payload = {
                bultos: finalBultos,
                costo_flete: parseFloat(costoFlete) || 0,
                peso_computable: parseFloat(finalTotalComputable.toFixed(2)),
                total_fisico: parseFloat(finalTotalFisico.toFixed(2)),
                boxes_count: finalBultos.length,
                invoice_photo_1: url1,
                invoice_photo_2: url2,
            };

            const diffSummary = isEdit ? computeDiff(finalBultos, url1, url2) : null;

            // 1. Insert version
            const { data: versionData, error: versionErr } = await supabase
                .from('reception_versions')
                .insert({
                    shipment_id: shipment.id,
                    version_number: nextVersion,
                    payload_snapshot: payload,
                    created_by: userId,
                    reason: isEdit ? editReason.trim() : null,
                    is_post_delivery: isPostDelivery && isEdit,
                    diff_summary: diffSummary,
                })
                .select('id')
                .single();

            if (versionErr) console.warn('Version insert failed:', versionErr.message);

            // 2. Update shipment via secure API
            const updateFields: Record<string, any> = {
                internal_status: 'Recibido en Oficina',
                date_arrived: new Date().toISOString().split('T')[0],
                weight: parseFloat(finalTotalFisico.toFixed(2)),
                peso_computable: parseFloat(finalTotalComputable.toFixed(2)),
                bultos: finalBultos,
                boxes_count: finalBultos.length,
                costo_flete: parseFloat(costoFlete) || 0,
                reception_status: receptionStatus,
                delta_kg: finalDeltaKg,
                delta_boxes: finalDeltaBoxes,
                reception_version_count: nextVersion,
                ...(versionData?.id && { current_version_id: versionData.id }),
                ...(isPostDelivery && isEdit && { edited_post_delivery: true }),
                ...(url1 && { invoice_photo_1: url1 }),
                ...(url2 && { invoice_photo_2: url2 }),
            };

            const result = await secureShipmentUpdate(shipment.id, updateFields);

            if (!result.success) throw new Error(result.error);

            // 3. Audit log for edits
            if (isEdit && userId) {
                const severity = isPostDelivery ? 'HIGH' : 'NORMAL';
                await supabase.from('activity_logs').insert({
                    user_id: userId,
                    action: isPostDelivery ? 'reception_edit_post_delivery' : 'reception_edit',
                    details: JSON.stringify({
                        shipment_id: shipment.id,
                        tracking_number: shipment.tracking_number,
                        version: nextVersion,
                        reason: editReason.trim(),
                        severity,
                        diff: diffSummary,
                        delta_kg: finalDeltaKg,
                        delta_monto: (parseFloat(costoFlete) || 0) - (shipment.costo_flete || 0),
                    }),
                });
            }

            clearLocal(shipment.id);

            if (isPostDelivery && isEdit) {
                toast.warning('⚠️ Edición post-entrega registrada — se notificará al manager');
            } else if (receptionStatus === 'PARTIAL') {
                toast.success(`📦 Recepción parcial registrada (${finalBultos.length}/${declaredBoxes} cajas)`);
            } else if (isEdit) {
                toast.success(`✏️ Recepción editada (v${nextVersion})`);
            } else {
                // Micro-success feedback based on precision
                const absDelta = Math.abs(finalDeltaKg);
                if (absDelta < 0.5) {
                    toast.success('🎯 Recepción confirmada — coincide con lo declarado');
                } else if (absDelta > 5) {
                    toast.warning(`⚠ Diferencia detectada: ${finalDeltaKg > 0 ? '+' : ''}${finalDeltaKg}kg vs declarado`);
                } else {
                    toast.success('✔ Recepción confirmada');
                }
            }

            // Performance event tracking (fire-and-forget)
            const durationSec = Math.round((Date.now() - receptionStartTime) / 1000);
            trackReceptionPerformance({
                shipmentId: shipment.id,
                trackingNumber: shipment.tracking_number,
                totalComputable: finalTotalComputable,
                boxesCount: finalBultos.length,
                deltaKg: finalDeltaKg,
                hadErrors: errors.length > 0,
                isEdit,
                durationSec,
                receptionStatus,
            });

            onSuccess();
        } catch (error: any) {
            toast.error(`Error al actualizar: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!shipment) return null;

    const receptionStatus = getReceptionStatus();
    const isPartial = receptionStatus === 'PARTIAL';

    // ── Delta badge helper ──
    const deltaBadge = (delta: number, unit: string) => {
        if (delta === 0) return <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">✓ Coincide</span>;
        const pos = delta > 0;
        const cls = pos ? 'text-amber-400 bg-amber-500/15' : 'text-red-400 bg-red-500/15';
        return <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${cls}`}><AlertTriangle size={10} />{pos ? '+' : ''}{unit === 'kg' ? delta.toFixed(1) : delta} {unit}</span>;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 backdrop-blur-sm overflow-y-auto py-6 px-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="bg-white dark:bg-[#1c1c1e] w-full max-w-4xl rounded-[28px] shadow-2xl border border-slate-200 dark:border-white/10 my-auto"
                    >
                        <div className="p-6 md:p-8">
                            {/* ── Header ── */}
                            <div className="flex justify-between items-center mb-5">
                                <div>
                                    <h2 className="text-xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
                                        <PackagePlus className="text-blue-500" /> Recepción en Oficina
                                        {isPartial && (
                                            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/20">
                                                PARCIAL
                                            </span>
                                        )}
                                        {receptionStatus === 'COMPLETE' && (
                                            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                                                COMPLETA
                                            </span>
                                        )}
                                    </h2>
                                    <p className="text-sm font-bold text-slate-500 mt-1">
                                        Guía: <span className="text-blue-600">{shipment.tracking_number}</span>
                                        <span className="text-slate-400 mx-2">·</span>
                                        <span className="text-slate-400">{shipment.client_name}</span>
                                        {isEdit && <span className="text-slate-400 mx-2">·</span>}
                                        {isEdit && <span className="text-blue-500">v{(shipment.reception_version_count || 0) + 1}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {versions.length > 0 && (
                                        <button type="button" onClick={() => setShowHistory(!showHistory)}
                                            className={`p-2 rounded-full transition-colors ${showHistory ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600' : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400'}`}>
                                            <History size={20} strokeWidth={2} />
                                        </button>
                                    )}
                                    <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                        <X size={24} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>

                            {/* ── Post-delivery warning ── */}
                            {isPostDelivery && isEdit && (
                                <div className="bg-red-50 dark:bg-red-500/10 border-2 border-red-300 dark:border-red-500/30 p-4 rounded-2xl mb-5 flex items-start gap-3">
                                    <Shield className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
                                    <div>
                                        <p className="text-sm font-black text-red-700 dark:text-red-400">⚠️ Edición post-entrega</p>
                                        <p className="text-xs text-red-600/70 dark:text-red-400/70 font-bold mt-0.5">
                                            Este envío ya fue marcado como <span className="uppercase font-black">{shipment.internal_status}</span>.
                                            Cualquier cambio quedará registrado con alta severidad y se notificará al manager.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── Edit badge ── */}
                            {shipment.edited_post_delivery && !isEdit && (
                                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-2 rounded-xl mb-5 flex items-center gap-2">
                                    <Edit3 size={14} className="text-red-500" />
                                    <span className="text-xs font-black text-red-600 dark:text-red-400">Editado después de entrega</span>
                                </div>
                            )}

                            {/* ── Edit reason input (shown when editing) ── */}
                            {isEdit && (
                                <div className={`mb-5 p-4 rounded-2xl border-2 transition-all ${!editReason.trim() && showReasonModal
                                    ? 'border-red-400 dark:border-red-500/50 bg-red-50 dark:bg-red-500/10'
                                    : editReason.trim()
                                        ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5'
                                        : 'border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5'
                                    }`}>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 flex items-center gap-1.5">
                                        <Edit3 size={11} /> Motivo de edición {isPostDelivery && <span className="text-red-500">* OBLIGATORIO</span>}
                                    </label>
                                    <input
                                        type="text" placeholder="Ej: Correción de peso caja 2, error de tipeo..."
                                        className="w-full bg-white dark:bg-[#161618] border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none focus:border-blue-500 font-bold text-sm text-slate-900 dark:text-white"
                                        value={editReason} onChange={(e) => { setEditReason(e.target.value); setShowReasonModal(false); }}
                                        autoFocus={showReasonModal}
                                    />
                                    {!editReason.trim() && showReasonModal && (
                                        <p className="text-xs text-red-500 font-bold mt-1.5">⚠️ Ingresá un motivo antes de confirmar</p>
                                    )}
                                </div>
                            )}

                            {/* ── Version history panel ── */}
                            <AnimatePresence>
                                {showHistory && versions.length > 0 && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-5">
                                        <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/8 rounded-2xl p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                                                <History size={11} /> Historial de versiones ({versions.length})
                                            </p>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {versions.map(v => (
                                                    <div key={v.id} className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${v.is_post_delivery
                                                        ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/15'
                                                        : 'bg-white dark:bg-white/[0.02] border-slate-100 dark:border-white/5'
                                                        }`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-blue-600 dark:text-blue-400">v{v.version_number}</span>
                                                            {v.is_post_delivery && <span className="text-[9px] font-black text-red-500 bg-red-100 dark:bg-red-500/15 px-1.5 py-0.5 rounded">POST-ENTREGA</span>}
                                                            {v.reason && <span className="text-slate-500 font-bold truncate max-w-[200px]">— {v.reason}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-400 font-bold">
                                                            {v.diff_summary && Object.keys(v.diff_summary).length > 0 && (
                                                                <span className="text-amber-500">{Object.keys(v.diff_summary).length} cambio{Object.keys(v.diff_summary).length > 1 ? 's' : ''}</span>
                                                            )}
                                                            <span>{new Date(v.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Declarado vs Recibido ── */}
                            {(declaredKg > 0 || declaredBoxes > 0) && (
                                <div className="grid grid-cols-2 gap-3 mb-5">
                                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-2xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                                            <Package size={11} /> Declarado
                                        </p>
                                        <div className="flex gap-4">
                                            <div>
                                                <p className="text-lg font-black text-slate-700 dark:text-slate-200">{declaredKg} <span className="text-xs text-slate-400">kg</span></p>
                                                <p className="text-[10px] text-slate-400 font-bold">Peso declarado</p>
                                            </div>
                                            {declaredBoxes > 0 && (
                                                <div className="border-l border-slate-200 dark:border-white/10 pl-4">
                                                    <p className="text-lg font-black text-slate-700 dark:text-slate-200">{declaredBoxes}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">Cajas</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/15 rounded-2xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2 flex items-center gap-1.5">
                                            <Weight size={11} /> Recibido
                                        </p>
                                        <div className="flex gap-4">
                                            <div>
                                                <p className="text-lg font-black text-blue-600 dark:text-blue-400">{receivedKg.toFixed(1)} <span className="text-xs text-blue-400/70">kg comp.</span></p>
                                                {declaredKg > 0 && deltaBadge(deltaKg, 'kg')}
                                            </div>
                                            {declaredBoxes > 0 && (
                                                <div className="border-l border-blue-200 dark:border-blue-500/20 pl-4">
                                                    <p className="text-lg font-black text-blue-600 dark:text-blue-400">{receivedBoxes}</p>
                                                    {deltaBadge(deltaBoxes, 'cajas')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">

                                {/* ── Validation errors ── */}
                                {validationErrors.length > 0 && (
                                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-4 rounded-2xl space-y-1">
                                        <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">⚠️ Errores de validación</p>
                                        {validationErrors.map((err, i) => (
                                            <p key={i} className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1.5">
                                                <span className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" /> {err}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {/* ── Volumetric warnings ── */}
                                {volWarnings.length > 0 && (
                                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-2xl">
                                        {volWarnings.map((w, i) => (
                                            <p key={i} className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                                                <AlertTriangle size={11} /> {w}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {/* ── Info Banner ── */}
                                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 p-3 rounded-2xl flex items-start gap-3">
                                    <Calculator className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />
                                    <p className="text-xs font-bold text-blue-700/70 dark:text-blue-400/70">
                                        <span className="text-blue-900 dark:text-blue-400">Volumétrica /5000</span> — Max {MAX_WEIGHT_KG}kg/caja, dims {MIN_DIM_CM}–{MAX_DIM_CM}cm.
                                        <span className="text-blue-500 ml-1">Enter en peso → nueva caja.</span>
                                    </p>
                                </div>

                                {/* ── Monto Factura + Photos ── */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1">
                                            <DollarSign size={11} /> Monto Factura (USD) *
                                        </label>
                                        <input
                                            type="number" step="0.01" min="0.01" placeholder="0.00" required
                                            className="w-full bg-white dark:bg-[#161618] border-2 border-red-300 dark:border-red-500/40 px-4 py-3 rounded-xl outline-none focus:border-red-500 font-bold text-slate-900 dark:text-white transition-colors"
                                            value={costoFlete} onChange={(e) => setCostoFlete(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1">
                                            <ImageIcon size={11} /> Factura 1 *
                                        </label>
                                        <input
                                            type="file" accept="image/*,application/pdf"
                                            className="w-full bg-white dark:bg-[#161618] border-2 border-red-300 dark:border-red-500/40 px-3 py-2.5 rounded-xl outline-none text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-500/10 dark:file:text-blue-400 cursor-pointer"
                                            onChange={(e) => setPhoto1(e.target.files?.[0] || null)}
                                        />
                                        {shipment.invoice_photo_1 && !photo1 && <p className="text-[10px] text-emerald-500 font-bold">✓ Ya cargada</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1">
                                            <ImageIcon size={11} /> Factura 2 *
                                        </label>
                                        <input
                                            type="file" accept="image/*,application/pdf"
                                            className="w-full bg-white dark:bg-[#161618] border-2 border-red-300 dark:border-red-500/40 px-3 py-2.5 rounded-xl outline-none text-xs text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-500/10 dark:file:text-blue-400 cursor-pointer"
                                            onChange={(e) => setPhoto2(e.target.files?.[0] || null)}
                                        />
                                        {shipment.invoice_photo_2 && !photo2 && <p className="text-[10px] text-emerald-500 font-bold">✓ Ya cargada</p>}
                                    </div>
                                </div>

                                {/* ── Bultos List ── */}
                                <div className="space-y-3">
                                    {bultos.map((box, index) => {
                                        const isPreviousBox = index < previousBoxCount;
                                        const volWon = box.peso_volumetrico > box.peso_fisico;
                                        const fisWon = box.peso_fisico > box.peso_volumetrico;
                                        const hasData = box.peso_fisico > 0 || box.peso_volumetrico > 0;

                                        // Check per-box limit violations for visual feedback
                                        const dimError = (v: number) => v > 0 && (v < MIN_DIM_CM || v > MAX_DIM_CM);
                                        const weightError = box.peso_fisico > 0 && (box.peso_fisico < MIN_WEIGHT_KG || box.peso_fisico > MAX_WEIGHT_KG);

                                        return (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.02 }}
                                                className={`border rounded-2xl p-4 relative group transition-all ${isPreviousBox
                                                    ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/15 opacity-80'
                                                    : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/8'
                                                    }`}
                                            >
                                                {/* Box header */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${isPreviousBox
                                                            ? 'bg-emerald-200 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                                            : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                                            }`}>
                                                            Caja {index + 1}
                                                        </span>
                                                        {isPreviousBox && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                                                                <Lock size={10} /> Recepcionada
                                                            </span>
                                                        )}
                                                    </div>
                                                    {!isPreviousBox && bultos.length > 1 && (
                                                        <button type="button" onClick={() => removeBox(index)}
                                                            className="text-slate-400 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-all p-1 hover:bg-red-500/10 rounded-lg">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Dimension inputs */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                    {(['largo', 'ancho', 'alto'] as const).map((dim) => (
                                                        <div key={dim} className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                {dim.charAt(0).toUpperCase() + dim.slice(1)} <span className="text-slate-300 dark:text-slate-600 font-medium normal-case">(cm)</span>
                                                            </label>
                                                            <input
                                                                ref={(el) => setInputRef(`${index}-${dim}`, el)}
                                                                required={!isPreviousBox}
                                                                disabled={isPreviousBox}
                                                                type="number" step="0.1" min={MIN_DIM_CM} max={MAX_DIM_CM}
                                                                className={`w-full px-3 py-2.5 rounded-xl outline-none text-sm font-bold transition-all ${isPreviousBox
                                                                    ? 'bg-emerald-100/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/15 text-emerald-800 dark:text-emerald-400 cursor-not-allowed'
                                                                    : dimError(box[dim])
                                                                        ? 'bg-white dark:bg-[#161618] border-2 border-red-400 dark:border-red-500/50 text-red-600 dark:text-red-400'
                                                                        : 'bg-white dark:bg-[#161618] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
                                                                    }`}
                                                                value={box[dim] || ''}
                                                                onChange={(e) => updateBox(index, dim, e.target.value)}
                                                                onKeyDown={(e) => handleKeyDown(e, index, dim)}
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                                                            P. Físico <span className="text-amber-400/60 font-medium normal-case">(kg)</span>
                                                        </label>
                                                        <input
                                                            ref={(el) => setInputRef(`${index}-peso_fisico`, el)}
                                                            required={!isPreviousBox}
                                                            disabled={isPreviousBox}
                                                            type="number" step="0.1" min={MIN_WEIGHT_KG} max={MAX_WEIGHT_KG}
                                                            className={`w-full px-3 py-2.5 rounded-xl outline-none text-sm font-bold transition-all ${isPreviousBox
                                                                ? 'bg-emerald-100/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/15 text-emerald-800 dark:text-emerald-400 cursor-not-allowed'
                                                                : weightError
                                                                    ? 'bg-red-50 dark:bg-red-500/10 border-2 border-red-400 dark:border-red-500/50 text-red-600 dark:text-red-400'
                                                                    : 'bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20'
                                                                }`}
                                                            value={box.peso_fisico || ''}
                                                            onChange={(e) => updateBox(index, 'peso_fisico', e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(e, index, 'peso_fisico')}
                                                            placeholder={isPreviousBox ? '' : 'Enter → nueva caja'}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Per-box live results */}
                                                {hasData && (
                                                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${fisWon ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-500/30'
                                                            : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                                                            }`}>
                                                            <Weight size={12} /> Físico: {box.peso_fisico} kg
                                                            {fisWon && <span className="text-[9px] opacity-70">← aplica</span>}
                                                        </div>
                                                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${volWon ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 ring-1 ring-purple-300 dark:ring-purple-500/30'
                                                            : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                                                            }`}>
                                                            <Layers size={12} /> Vol: {box.peso_volumetrico} kg
                                                            {volWon && <span className="text-[9px] opacity-70">← aplica</span>}
                                                        </div>
                                                        <ArrowDown size={14} className="text-slate-300 dark:text-slate-600 rotate-[-90deg]" />
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-500/30">
                                                            ⚡ Computable: {box.peso_computable} kg
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* ── Duplication tools ── */}
                                <div className="flex flex-wrap gap-2 items-center">
                                    <button type="button" onClick={addBox}
                                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5">
                                        + Nueva caja
                                    </button>
                                    {bultos.length > 0 && (
                                        <>
                                            <button type="button" onClick={() => duplicatePrevious(false)}
                                                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-xl font-bold text-xs text-blue-700 dark:text-blue-400 transition-colors flex items-center gap-1.5 border border-blue-200 dark:border-blue-500/20">
                                                <Copy size={12} /> Duplicar anterior
                                            </button>
                                            <button type="button" onClick={() => duplicatePrevious(true)}
                                                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 rounded-xl font-bold text-xs text-amber-700 dark:text-amber-400 transition-colors flex items-center gap-1.5 border border-amber-200 dark:border-amber-500/20">
                                                <Weight size={12} /> Mismas medidas, otro peso
                                            </button>
                                            {!showBulkInput ? (
                                                <button type="button" onClick={() => setShowBulkInput(true)}
                                                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 rounded-xl font-bold text-xs text-purple-700 dark:text-purple-400 transition-colors flex items-center gap-1.5 border border-purple-200 dark:border-purple-500/20">
                                                    <Layers size={12} /> Generar N iguales
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <input type="number" min="1" max={MAX_BULK_COUNT} placeholder="N" autoFocus
                                                        className="w-16 bg-white dark:bg-[#161618] border border-purple-300 dark:border-purple-500/30 px-2 py-2 rounded-lg outline-none focus:border-purple-500 text-xs font-bold text-center text-purple-700 dark:text-purple-400"
                                                        value={bulkCount} onChange={(e) => setBulkCount(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bulkDuplicate(); } }} />
                                                    <button type="button" onClick={bulkDuplicate}
                                                        className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-black transition-colors">OK</button>
                                                    <button type="button" onClick={() => { setShowBulkInput(false); setBulkCount(''); }}
                                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* ── Total + Submit ── */}
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-t border-slate-200 dark:border-white/10 pt-5">
                                    <div className="text-sm text-slate-500 font-bold flex items-center gap-3">
                                        <span>{allValidBoxes.length} caja{allValidBoxes.length !== 1 ? 's' : ''}</span>
                                        <span className="text-slate-300 dark:text-slate-600">·</span>
                                        <span>{totalFisico.toFixed(1)} kg físico</span>
                                        {isPartial && (
                                            <span className="text-amber-500 text-xs font-black flex items-center gap-1">
                                                <AlertTriangle size={12} /> Recepción parcial
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 bg-slate-900 dark:bg-white/[0.08] px-6 py-4 rounded-2xl shadow-xl border border-white/5">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Computable</p>
                                            <p className="text-2xl font-black text-white dark:text-blue-400">{totalComputable.toFixed(2)} <span className="text-sm text-slate-400">KG</span></p>
                                        </div>
                                        <button type="submit" disabled={isLoading}
                                            className="h-12 px-5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95 font-black text-sm shadow-lg shadow-emerald-500/25">
                                            {isLoading ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <CheckCircle2 size={18} />
                                                    {isPartial ? 'Guardar parcial' : 'Confirmar'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
