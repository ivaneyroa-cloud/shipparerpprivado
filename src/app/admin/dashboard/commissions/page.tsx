"use client";

import React from 'react';
import CommissionsDashboard from '@/components/CommissionsDashboard';

export default function CommissionsPage() {
    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">
                        Comisiones y Rendimiento 📈
                    </h1>
                    <p className="text-slate-500 font-medium text-lg">
                        Seguimiento de ventas, comisiones y objetivos mensuales.
                    </p>
                </div>
            </div>

            <CommissionsDashboard />
        </div>
    );
}
