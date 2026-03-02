import * as XLSX from 'xlsx';
import { Shipment } from '@/types';

/**
 * Exports an array of shipments to an Excel (.xlsx) file.
 * Columns are mapped to Spanish labels for the end user.
 */
export function exportShipmentsToExcel(shipments: Shipment[], filename?: string) {
    if (!shipments.length) return;

    // Map shipment fields to human-readable columns
    const rows = shipments.map((s, i) => ({
        '#': i + 1,
        'Tracking': s.tracking_number || '',
        'Cliente': s.client_name || '',
        'Código Cliente': s.client_code || '',
        'Categoría': s.category || '',
        'Origen': s.origin || '',
        'Peso (kg)': s.weight || 0,
        'Peso Computable (kg)': s.peso_computable || 0,
        'Cajas': s.boxes_count || 0,
        'Estado': s.internal_status || '',
        'Fecha Envío': s.date_shipped || '',
        'Fecha Llegada': s.date_arrived || '',
        'Precio Envío (USD)': s.precio_envio || 0,
        'Gastos Doc (USD)': s.gastos_documentales || 0,
        'Impuestos (USD)': s.impuestos || 0,
        'Costo Flete (USD)': s.costo_flete || 0,
        'Observaciones': s.observaciones_cotizacion || '',
        'Nota Retención': s.retenido_nota || '',
        'Creado': s.created_at ? new Date(s.created_at).toLocaleDateString('es-AR') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0]).map(key => ({
        wch: Math.max(
            key.length + 2,
            ...rows.map(r => String((r as any)[key]).length)
        ),
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Envíos');

    const dateStr = new Date().toISOString().split('T')[0];
    const name = filename || `Shippar_Envios_${dateStr}.xlsx`;
    XLSX.writeFile(wb, name);
}
