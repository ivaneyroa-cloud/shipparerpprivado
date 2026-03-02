/**
 * Alert Engine — Generates rule-based alerts from parsed + computed data.
 * These rules are HARD — they run BEFORE the LLM and override it.
 */

import { ParsedMessage } from './parser';
import { ComputedWeights } from './calculator';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertType =
    | 'WEIGHT_MISMATCH'
    | 'PROHIBITED_ITEM'
    | 'ESCALATE_TO_ADMIN'
    | 'RECOMMEND_DEPOSITO'
    | 'MISSING_DATA'
    | 'MISSING_INVOICE';

export interface ChatAlert {
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    requires_action: boolean;  // if true, employee must act (correct/ignore/escalate)
    hard_stop: boolean;        // if true, blocks sending quote until resolved
}

/**
 * Generate alerts based on parsed message and computed weights.
 */
export function generateAlerts(
    parsed: ParsedMessage,
    computed: ComputedWeights | null
): ChatAlert[] {
    const alerts: ChatAlert[] = [];

    // ── CRITICAL: Prohibited items ──
    if (parsed.flags.includes('liquido')) {
        alerts.push({
            type: 'PROHIBITED_ITEM',
            severity: 'CRITICAL',
            message: '🚫 PROHIBIDO: Los líquidos NO pueden enviarse. Informale al cliente que este producto no se puede transportar.',
            requires_action: true,
            hard_stop: true,
        });
    }

    // ── HIGH: Escalate to admin ──
    if (parsed.flags.includes('maquillaje')) {
        alerts.push({
            type: 'ESCALATE_TO_ADMIN',
            severity: 'HIGH',
            message: '⚠️ ESCALAR: Productos cosméticos/maquillaje requieren aprobación de Iván antes de cotizar.',
            requires_action: true,
            hard_stop: false,
        });
    }

    if (parsed.flags.includes('marca')) {
        alerts.push({
            type: 'ESCALATE_TO_ADMIN',
            severity: 'HIGH',
            message: '⚠️ ESCALAR: Productos de marca registrada requieren verificación de Iván. Podrían tener restricciones aduaneras.',
            requires_action: true,
            hard_stop: false,
        });
    }

    // ── HIGH: Weight mismatch ──
    if (computed && parsed.peso_real_kg && computed.peso_vol_kg > 0) {
        if (computed.peso_vol_kg > parsed.peso_real_kg) {
            alerts.push({
                type: 'WEIGHT_MISMATCH',
                severity: 'HIGH',
                message: `⚠️ PESO INCORRECTO: El volumétrico (${computed.peso_vol_kg} kg) es MAYOR que el real (${parsed.peso_real_kg} kg). ` +
                    `Debés cotizar por ${computed.peso_cotizable_kg} kg (el mayor de los dos).`,
                requires_action: true,
                hard_stop: false,
            });
        }

        // Also check if they explicitly quoted the wrong weight
        if (parsed.quoted_weight_kg && parsed.quoted_weight_kg < computed.peso_cotizable_kg) {
            alerts.push({
                type: 'WEIGHT_MISMATCH',
                severity: 'HIGH',
                message: `🔴 COTIZACIÓN INCORRECTA: Dijiste que vas a cotizar ${parsed.quoted_weight_kg} kg, pero el peso cotizable es ${computed.peso_cotizable_kg} kg. ` +
                    `Corregí antes de enviar al cliente.`,
                requires_action: true,
                hard_stop: false,
            });
        }
    }

    // ── MEDIUM: Recommend deposito ──
    if (parsed.flags.includes('bateria') || parsed.flags.includes('iman')) {
        const item = parsed.flags.includes('bateria') ? 'baterías/litio' : 'imanes';
        alerts.push({
            type: 'RECOMMEND_DEPOSITO',
            severity: 'MEDIUM',
            message: `📦 RECOMENDACIÓN: Productos con ${item} deben ir por método DEPÓSITO (no express). Verificá con el cliente.`,
            requires_action: false,
            hard_stop: false,
        });
    }

    // ── MEDIUM: Missing invoice ──
    const lower = parsed.raw.toLowerCase();
    if (lower.includes('sin invoice') || lower.includes('sin factura') || lower.includes('no tiene invoice') || lower.includes('falta invoice')) {
        alerts.push({
            type: 'MISSING_INVOICE',
            severity: 'MEDIUM',
            message: '📋 INVOICE FALTANTE: El cliente necesita invoice para despachar. Pedí los datos o generá una invoice interna.',
            requires_action: false,
            hard_stop: false,
        });
    }

    // ── LOW: Missing critical data ──
    if (!parsed.peso_real_kg && !parsed.dims_cm) {
        alerts.push({
            type: 'MISSING_DATA',
            severity: 'LOW',
            message: '❓ Me faltan peso o medidas para validar la cotización. Pedí el dato al cliente.',
            requires_action: false,
            hard_stop: false,
        });
    }

    // Sort: CRITICAL first, then HIGH, MEDIUM, LOW
    const severityOrder: Record<AlertSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return alerts;
}

/**
 * Check if any alert requires a hard stop (blocks sending quote).
 */
export function hasHardStop(alerts: ChatAlert[]): boolean {
    return alerts.some(a => a.hard_stop);
}

/**
 * Check if any alert requires employee action.
 */
export function hasRequiredActions(alerts: ChatAlert[]): boolean {
    return alerts.some(a => a.requires_action);
}
