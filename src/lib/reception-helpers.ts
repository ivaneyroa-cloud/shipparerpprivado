import { ShipmentPackage } from '@/types';

// ── Constants ──
export const MAX_DIM_CM = 200;
export const MIN_DIM_CM = 1;
export const MAX_WEIGHT_KG = 49;
export const MIN_WEIGHT_KG = 0.1;
export const MAX_BULK_COUNT = 50;
export const VOL_WARN_MIN = 0.1;
export const VOL_WARN_MAX = 500;

/**
 * Validates all boxes + photos + cost for a reception submission.
 */
export function validateReception({
    bultos,
    previousBoxCount,
    costoFlete,
    photo1,
    photo2,
    existingPhoto1,
    existingPhoto2,
    totalComputable,
}: {
    bultos: ShipmentPackage[];
    previousBoxCount: number;
    costoFlete: string;
    photo1: File | null;
    photo2: File | null;
    existingPhoto1: string | null | undefined;
    existingPhoto2: string | null | undefined;
    totalComputable: number;
}): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Monto factura
    const montoVal = parseFloat(costoFlete);
    if (!costoFlete || isNaN(montoVal) || montoVal <= 0) {
        errors.push('Monto factura (USD) es obligatorio y debe ser > 0');
    }

    // New boxes with data
    const newBoxes = bultos.filter((b, i) => i >= previousBoxCount && b.largo > 0 && b.peso_fisico > 0);
    if (newBoxes.length === 0 && previousBoxCount === 0) {
        errors.push('Debe haber al menos 1 caja con medidas completas');
    }

    // Per-box validation
    bultos.forEach((box, i) => {
        if (i < previousBoxCount) return;

        const label = `Caja ${i + 1}`;
        const hasSomeData = box.largo > 0 || box.ancho > 0 || box.alto > 0 || box.peso_fisico > 0;

        if (!hasSomeData && i === bultos.length - 1 && i > 0) return;

        if (hasSomeData) {
            for (const [dim, val] of [['Largo', box.largo], ['Ancho', box.ancho], ['Alto', box.alto]] as const) {
                if (val <= 0) errors.push(`${label}: ${dim} es obligatorio`);
                else if (val < MIN_DIM_CM) errors.push(`${label}: ${dim} debe ser ≥ ${MIN_DIM_CM} cm`);
                else if (val > MAX_DIM_CM) errors.push(`${label}: ${dim} debe ser ≤ ${MAX_DIM_CM} cm`);
            }

            if (box.peso_fisico <= 0) errors.push(`${label}: Peso físico es obligatorio`);
            else if (box.peso_fisico < MIN_WEIGHT_KG) errors.push(`${label}: Peso debe ser ≥ ${MIN_WEIGHT_KG} kg`);
            else if (box.peso_fisico > MAX_WEIGHT_KG) errors.push(`${label}: Peso debe ser ≤ ${MAX_WEIGHT_KG} kg`);

            if (box.peso_volumetrico > 0) {
                if (box.peso_volumetrico < VOL_WARN_MIN) {
                    warnings.push(`${label}: Peso volumétrico muy bajo (${box.peso_volumetrico} kg) — verificar medidas`);
                }
                if (box.peso_volumetrico > VOL_WARN_MAX) {
                    warnings.push(`${label}: Peso volumétrico muy alto (${box.peso_volumetrico} kg) — verificar medidas`);
                }
            }
        }
    });

    // Photos
    if (!photo1 && !existingPhoto1) errors.push('Factura 1 es obligatoria');
    if (!photo2 && !existingPhoto2) errors.push('Factura 2 es obligatoria');

    // Total computable
    if (totalComputable <= 0 && newBoxes.length > 0) errors.push('El peso total computable debe ser > 0');

    return { errors, warnings };
}

/**
 * Compute reception status based on received vs declared boxes.
 */
export function computeReceptionStatus(
    receivedBoxes: number,
    declaredBoxes: number
): 'PENDING' | 'PARTIAL' | 'COMPLETE' {
    if (receivedBoxes === 0) return 'PENDING';
    if (declaredBoxes > 0 && receivedBoxes < declaredBoxes) return 'PARTIAL';
    return 'COMPLETE';
}

/**
 * Compute diff between old and new reception data (for versioning).
 */
export function computeReceptionDiff(
    finalBultos: ShipmentPackage[],
    url1: string | null,
    url2: string | null,
    shipment: {
        costo_flete?: number | null;
        bultos?: ShipmentPackage[] | null;
        peso_computable?: number | null;
        invoice_photo_1?: string | null;
        invoice_photo_2?: string | null;
    },
    costoFlete: string
): Record<string, { old: any; new: any }> {
    const diff: Record<string, { old: any; new: any }> = {};
    const oldFlete = shipment.costo_flete || 0;
    const newFlete = parseFloat(costoFlete) || 0;
    if (oldFlete !== newFlete) diff['costo_flete'] = { old: oldFlete, new: newFlete };

    const oldBoxes = shipment.bultos?.length || 0;
    if (oldBoxes !== finalBultos.length) diff['boxes_count'] = { old: oldBoxes, new: finalBultos.length };

    const oldComputable = shipment.peso_computable || 0;
    const newComputable = finalBultos.reduce((s, b) => s + b.peso_computable, 0);
    if (Math.abs(oldComputable - newComputable) > 0.01) {
        diff['peso_computable'] = { old: oldComputable, new: parseFloat(newComputable.toFixed(2)) };
    }

    if (url1 && url1 !== shipment.invoice_photo_1) diff['invoice_photo_1'] = { old: '(prev)', new: '(new)' };
    if (url2 && url2 !== shipment.invoice_photo_2) diff['invoice_photo_2'] = { old: '(prev)', new: '(new)' };

    return diff;
}

/**
 * Creates an empty box with zeroed dimensions.
 */
export const emptyBox = (): ShipmentPackage => ({
    largo: 0, ancho: 0, alto: 0,
    peso_fisico: 0, peso_volumetrico: 0, peso_computable: 0,
});

// ── LocalStorage helpers ──
const STORAGE_PREFIX = 'shippar_receive_';
export function saveToLocal(id: string, data: { bultos: ShipmentPackage[]; costoFlete: string }) {
    try { localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(data)); } catch { }
}
export function loadFromLocal(id: string): { bultos: ShipmentPackage[]; costoFlete: string } | null {
    try { const r = localStorage.getItem(`${STORAGE_PREFIX}${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function clearLocal(id: string) {
    try { localStorage.removeItem(`${STORAGE_PREFIX}${id}`); } catch { }
}
