/**
 * Calculator Engine — Volumetric weight, quotable weight, rounding.
 * All critical math lives here, NEVER in the LLM.
 */

export interface ComputedWeights {
    peso_vol_kg: number;
    peso_cotizable_kg: number;
    details: string;
}

/**
 * Calculate volumetric weight from dimensions (cm).
 * Formula: (L × A × H) / 5000
 */
export function calcVolumetric(l: number, w: number, h: number): number {
    return (l * w * h) / 5000;
}

/**
 * Round up to nearest 0.5 kg.
 * Examples: 24.1 → 24.5, 24.0 → 24.0, 23.7 → 24.0
 */
export function roundToHalfKg(kg: number): number {
    return Math.ceil(kg * 2) / 2;
}

/**
 * Compute all weight values from parsed message data.
 */
export function computeWeights(
    peso_real_kg: number | null,
    dims_cm: { l: number; w: number; h: number } | null
): ComputedWeights | null {
    // Need at least one of the two
    if (!peso_real_kg && !dims_cm) return null;

    let peso_vol_kg = 0;
    if (dims_cm) {
        peso_vol_kg = calcVolumetric(dims_cm.l, dims_cm.w, dims_cm.h);
        peso_vol_kg = roundToHalfKg(peso_vol_kg);
    }

    const real = peso_real_kg || 0;
    const peso_cotizable_kg = roundToHalfKg(Math.max(real, peso_vol_kg));

    const parts: string[] = [];
    if (peso_real_kg) parts.push(`Real: ${peso_real_kg} kg`);
    if (dims_cm) parts.push(`Vol: ${peso_vol_kg} kg (${dims_cm.l}×${dims_cm.w}×${dims_cm.h} / 5000)`);
    parts.push(`Cotizable: ${peso_cotizable_kg} kg`);

    return {
        peso_vol_kg,
        peso_cotizable_kg,
        details: parts.join(' | '),
    };
}
