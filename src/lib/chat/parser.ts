/**
 * Message Parser — Extracts structured data from free-text employee messages.
 * Uses regex patterns first; if critical fields are missing, LLM fallback is used.
 */

export interface ParsedMessage {
    peso_real_kg: number | null;
    dims_cm: { l: number; w: number; h: number } | null;
    route: string | null;         // 'china' | 'usa' | 'europa' | 'uk' | null
    service: string | null;       // 'express' | 'standard' | 'deposito' | null
    flags: string[];              // 'bateria' | 'iman' | 'liquido' | 'maquillaje' | 'marca'
    quoted_weight_kg: number | null; // if the employee says "cotizo X kg"
    boxes_count: number | null;
    raw: string;
}

// ── Regex patterns ──

const DIM_PATTERNS = [
    // 60x50x40, 60X50X40, 60*50*40
    /(\d+(?:[.,]\d+)?)\s*[xX×\*]\s*(\d+(?:[.,]\d+)?)\s*[xX×\*]\s*(\d+(?:[.,]\d+)?)/,
    // 60cm x 50cm x 40cm
    /(\d+(?:[.,]\d+)?)\s*cm?\s*[xX×\*]\s*(\d+(?:[.,]\d+)?)\s*cm?\s*[xX×\*]\s*(\d+(?:[.,]\d+)?)\s*cm?/,
    // "largo 60, ancho 50, alto 40" or "60 de largo 50 de ancho 40 de alto"
    /(?:largo|l)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[,;]?\s*(?:ancho|a|w)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?\s*[,;]?\s*(?:alto|h)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
];

const WEIGHT_PATTERNS = [
    // 18kg, 18 kg, 18kgs, 18 kgs, 18 kilos
    /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs?|kilos?)\b/i,
    // "peso 18", "pesa 18"
    /(?:peso|pesa)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i,
];

const QUOTE_WEIGHT_PATTERNS = [
    // "cotizo 18kg", "cotizo por 18", "voy a cotizar 18"
    /(?:cotizo|cotizar|cotizando)\s*(?:por\s+)?(\d+(?:[.,]\d+)?)\s*(?:kg|kgs?|kilos?)?\b/i,
];

const BOXES_PATTERNS = [
    /(\d+)\s*(?:cajas?|bultos?|paquetes?|packages?|boxes?)/i,
    /(?:cajas?|bultos?)\s*[:=]?\s*(\d+)/i,
];

const ROUTE_KEYWORDS: Record<string, string[]> = {
    china: ['china', 'cn', 'shenzhen', 'guangzhou', 'yiwu', 'shanghai', 'beijing', 'hongkong', 'hong kong'],
    usa: ['usa', 'estados unidos', 'eeuu', 'miami', 'new york', 'los angeles', 'america', 'americana', 'americano'],
    europa: ['europa', 'europe', 'alemania', 'españa', 'italia', 'francia', 'uk', 'reino unido', 'londres', 'paris'],
};

const SERVICE_KEYWORDS: Record<string, string[]> = {
    express: ['express', 'rapido', 'rápido', 'urgente', 'aéreo', 'aereo', 'avion', 'avión'],
    standard: ['standard', 'normal', 'maritimo', 'marítimo', 'barco', 'económico', 'economico'],
    deposito: ['deposito', 'depósito', 'consolidado', 'warehouse'],
};

const FLAG_KEYWORDS: Record<string, string[]> = {
    bateria: ['bateria', 'batería', 'baterias', 'baterías', 'battery', 'lithium', 'litio', 'pila', 'pilas'],
    iman: ['iman', 'imán', 'imanes', 'magnético', 'magnetico', 'magnet'],
    liquido: ['liquido', 'líquido', 'liquidos', 'líquidos', 'liquid', 'fluido'],
    maquillaje: ['maquillaje', 'cosmético', 'cosmetico', 'cosmetica', 'cosmética', 'makeup', 'skincare', 'crema', 'perfume'],
    marca: ['marca', 'branded', 'marca registrada', 'original', 'nike', 'adidas', 'gucci', 'louis vuitton', 'apple', 'samsung'],
};

function parseNum(str: string): number {
    return parseFloat(str.replace(',', '.'));
}

function detectKeyword(text: string, keywords: Record<string, string[]>): string | null {
    const lower = text.toLowerCase();
    for (const [key, words] of Object.entries(keywords)) {
        if (words.some(w => lower.includes(w))) return key;
    }
    return null;
}

function detectFlags(text: string): string[] {
    const lower = text.toLowerCase();
    const flags: string[] = [];
    for (const [flag, words] of Object.entries(FLAG_KEYWORDS)) {
        if (words.some(w => lower.includes(w))) flags.push(flag);
    }
    return flags;
}

/**
 * Parse a free-text message into structured data using regex patterns.
 */
export function parseMessage(text: string): ParsedMessage {
    const result: ParsedMessage = {
        peso_real_kg: null,
        dims_cm: null,
        route: null,
        service: null,
        flags: [],
        quoted_weight_kg: null,
        boxes_count: null,
        raw: text,
    };

    // Dimensions
    for (const pattern of DIM_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            result.dims_cm = {
                l: parseNum(match[1]),
                w: parseNum(match[2]),
                h: parseNum(match[3]),
            };
            break;
        }
    }

    // Weight
    for (const pattern of WEIGHT_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            result.peso_real_kg = parseNum(match[1]);
            break;
        }
    }

    // Quoted weight (what they're planning to quote)
    for (const pattern of QUOTE_WEIGHT_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            result.quoted_weight_kg = parseNum(match[1]);
            break;
        }
    }

    // Boxes count
    for (const pattern of BOXES_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            result.boxes_count = parseInt(match[1], 10);
            break;
        }
    }

    // Route, service, flags
    result.route = detectKeyword(text, ROUTE_KEYWORDS);
    result.service = detectKeyword(text, SERVICE_KEYWORDS);
    result.flags = detectFlags(text);

    return result;
}

/**
 * Returns an array of critical fields that are missing and should be asked for.
 */
export function getMissingFields(parsed: ParsedMessage): string[] {
    const missing: string[] = [];
    if (!parsed.peso_real_kg && !parsed.dims_cm) {
        missing.push('peso o medidas');
    }
    if (!parsed.route) {
        missing.push('ruta/origen');
    }
    return missing;
}
