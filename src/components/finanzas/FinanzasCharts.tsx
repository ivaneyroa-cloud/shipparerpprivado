'use client';

// ═══════════════════════════════════════════════════════════════
// Finanzas Sub-Components — Extracted for maintainability
// ═══════════════════════════════════════════════════════════════

const formatMoneyFull = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export function StatusBadge({ status }: { status: string }) {
    const s = (status || '').toLowerCase();
    let color = 'var(--text-muted)';
    let bg = 'transparent';
    let border = 'var(--card-border)';

    if (s.includes('recibido') || s.includes('oficina')) { color = '#2E7BFF'; bg = 'rgba(46,123,255,0.08)'; border = 'rgba(46,123,255,0.2)'; }
    else if (s.includes('retirado')) { color = '#10B981'; bg = 'rgba(16,185,129,0.08)'; border = 'rgba(16,185,129,0.2)'; }
    else if (s.includes('retenido')) { color = '#EF4444'; bg = 'rgba(239,68,68,0.08)'; border = 'rgba(239,68,68,0.2)'; }
    else if (s.includes('despachado')) { color = '#A855F7'; bg = 'rgba(168,85,247,0.08)'; border = 'rgba(168,85,247,0.2)'; }
    else if (s.includes('mercado') || s.includes('ml')) { color = '#FFE600'; bg = 'rgba(255,230,0,0.08)'; border = 'rgba(255,230,0,0.2)'; }
    else if (s.includes('tránsito') || s.includes('transito')) { color = '#F97316'; bg = 'rgba(249,115,22,0.08)'; border = 'rgba(249,115,22,0.2)'; }

    return (
        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap"
            style={{ color, background: bg, border: `1px solid ${border}` }}>
            {status || '—'}
        </span>
    );
}

export function CobranzaBadge({ estado }: { estado: string }) {
    const colors: Record<string, { color: string; bg: string }> = {
        'Pendiente': { color: '#FFB020', bg: 'rgba(255,176,32,0.1)' },
        'Facturado': { color: '#2E7BFF', bg: 'rgba(46,123,255,0.1)' },
        'Pagado': { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    };
    const c = colors[estado] || colors['Pendiente'];
    return (
        <span className="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md"
            style={{ color: c.color, background: c.bg }}>
            {estado}
        </span>
    );
}

export function LegendRow({ color, label, count, amount }: { color: string; label: string; count: number; amount: number }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
            <span className="text-[10px] font-bold flex-1" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="text-[10px] font-black" style={{ color: 'var(--text-primary)' }}>{count}</span>
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}
            </span>
        </div>
    );
}

export function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) {
        return (
            <div className="w-28 h-28 rounded-full border-[12px] shrink-0 flex items-center justify-center"
                style={{ borderColor: 'var(--card-border)' }}>
                <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Sin datos</span>
            </div>
        );
    }

    let gradientParts: string[] = [];
    let cumulative = 0;
    segments.forEach(seg => {
        const pct = (seg.value / total) * 100;
        gradientParts.push(`${seg.color} ${cumulative}% ${cumulative + pct}%`);
        cumulative += pct;
    });

    return (
        <div className="relative w-28 h-28 shrink-0">
            <div className="w-full h-full rounded-full"
                style={{ background: `conic-gradient(${gradientParts.join(', ')})` }} />
            <div className="absolute inset-3 rounded-full flex items-center justify-center"
                style={{ background: 'var(--card-bg)' }}>
                <div className="text-center">
                    <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{segments.reduce((s, seg) => s + seg.value, 0) > 0 ? segments.length : 0}</p>
                    <p className="text-[8px] font-bold" style={{ color: 'var(--text-muted)' }}>estados</p>
                </div>
            </div>
        </div>
    );
}

export function MarginDistribution({ margins, avg, median }: { margins: number[]; avg: number; median: number }) {
    if (margins.length === 0) {
        return (
            <div className="h-32 flex items-center justify-center">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sin envíos cobrados para calcular margen</span>
            </div>
        );
    }

    const min = Math.min(...margins);
    const max = Math.max(...margins);
    const range = max - min || 1;
    const bucketCount = Math.min(12, margins.length);
    const bucketSize = range / bucketCount;
    const buckets: number[] = Array(bucketCount).fill(0);

    margins.forEach(m => {
        let idx = Math.floor((m - min) / bucketSize);
        if (idx >= bucketCount) idx = bucketCount - 1;
        buckets[idx]++;
    });

    const maxBucket = Math.max(...buckets);

    return (
        <div>
            <div className="flex items-end gap-[2px] h-24 mb-2">
                {buckets.map((count, i) => {
                    const height = maxBucket > 0 ? (count / maxBucket) * 100 : 0;
                    const bucketStart = min + i * bucketSize;
                    const isAvgBucket = avg >= bucketStart && avg < bucketStart + bucketSize;
                    return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                            <div
                                className="w-full rounded-t-sm transition-all"
                                style={{
                                    height: `${Math.max(height, 2)}%`,
                                    background: isAvgBucket ? '#2E7BFF' : 'rgba(46, 123, 255, 0.25)',
                                    minHeight: count > 0 ? '4px' : '0px'
                                }}
                                title={`${formatMoneyFull(bucketStart)} – ${formatMoneyFull(bucketStart + bucketSize)}: ${count} envíos`}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between items-center">
                <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {formatMoneyFull(min)}
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold" style={{ color: '#2E7BFF' }}>
                        Prom: {formatMoneyFull(avg)}
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                        Med: {formatMoneyFull(median)}
                    </span>
                </div>
                <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {formatMoneyFull(max)}
                </span>
            </div>
        </div>
    );
}
