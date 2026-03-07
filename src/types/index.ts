export interface UserProfile {
    id: string;
    role: 'super_admin' | 'admin' | 'sales' | 'logistics' | 'billing' | 'operator';
    full_name?: string;
    email?: string;
    org_id?: string;
    created_at?: string;
}

export interface Client {
    id: string;
    name: string;
    code: string;
    assigned_to?: string;
    cuit?: string;
    address?: string;
    tax_condition?: string;
    service_type?: string;
    phone?: string;
    email?: string;
    tarifa_aplicable?: string;
    org_id?: string;
    created_at?: string;
}

export interface ShipmentPackage {
    largo: number;
    ancho: number;
    alto: number;
    peso_fisico: number;
    peso_volumetrico: number;
    peso_computable: number;
}

export interface Shipment {
    id: string;
    tracking_number: string;
    client_id: string | null;
    client_name: string;
    client_code: string;
    category: string;
    weight: number;
    internal_status: string;
    origin: string;
    date_shipped: string | null;
    date_arrived: string | null;
    date_dispatched?: string | null;
    org_id?: string;
    created_at?: string;
    updated_at?: string;

    // Campos de Cotización (Ventas)
    quote_mode?: 'manual' | 'pdf' | 'tarifario';
    quote_pdf_url?: string;
    precio_envio?: number;
    gastos_documentales?: number;
    impuestos?: number;
    observaciones_cotizacion?: string;

    // Campos de Depósito (Bultos)
    bultos?: ShipmentPackage[];
    peso_computable?: number;
    boxes_count?: number;

    // Campos de Recepción
    reception_status?: 'PENDING' | 'PARTIAL' | 'COMPLETE';
    delta_kg?: number;
    delta_boxes?: number;
    edited_post_delivery?: boolean;
    post_delivery_edit?: boolean;
    edit_count?: number;
    current_version_id?: string;
    reception_version_count?: number;
    received_at?: string;
    received_by?: string;
    received_weight?: number;
    has_weight_anomaly?: boolean;
    anomaly_percentage?: number;
    anomaly_absolute?: number;

    // Campos de Logística interna
    retenido_nota?: string;

    // Campos de Cobranzas
    estado_cobranza?: string;
    estado_pago_proveedor?: string;
    costo_flete?: number;
    costo_impuestos_proveedor?: number;
    monto_cobrado?: number;
    invoice_photo_1?: string;
    invoice_photo_2?: string;
    payment_proof_url?: string;
    payment_notes?: string;
}

export interface ReceptionVersion {
    id: string;
    shipment_id: string;
    version_number: number;
    payload_snapshot: {
        bultos: ShipmentPackage[];
        costo_flete: number;
        peso_computable: number;
        total_fisico: number;
        boxes_count: number;
        invoice_photo_1?: string;
        invoice_photo_2?: string;
    };
    created_by: string;
    created_at: string;
    reason: string | null;
    is_post_delivery: boolean;
    diff_summary?: Record<string, { old: any; new: any }>;
    // Joined fields
    creator_name?: string;
    creator_email?: string;
}

export type ShipmentCobranzasRow = Pick<Shipment,
    'id' | 'tracking_number' | 'client_id' | 'client_name' | 'internal_status' | 'bultos' |
    'invoice_photo_1' | 'invoice_photo_2' | 'peso_computable' | 'weight' |
    'precio_envio' | 'costo_flete' | 'costo_impuestos_proveedor' | 'gastos_documentales' | 'impuestos' | 'monto_cobrado' |
    'estado_cobranza' | 'estado_pago_proveedor' | 'updated_at' | 'payment_proof_url' | 'payment_notes' |
    'quote_mode' | 'quote_pdf_url'
>;
